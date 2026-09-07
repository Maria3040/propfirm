using System.Collections.Concurrent;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace PropFirm.Infrastructure.Integrations;

public sealed record EconomicCalendarEventDto(
    string Id,
    string Datetime,
    string Currency,
    string Country,
    string Title,
    string Impact,
    string? Actual,
    string? Forecast,
    string? Previous);

public sealed record EconomicCalendarResponse(
    string Source,
    string Provider,
    string From,
    string To,
    IReadOnlyList<EconomicCalendarEventDto> Items,
    string? Detail);

/// <summary>
/// Fetches live economic calendar rows from Financial Modeling Prep.
/// Without <c>Fmp:ApiKey</c>, returns an empty live envelope so the UI can fall back to demo data.
/// </summary>
public sealed class EconomicCalendarService(IConfiguration config, ILogger<EconomicCalendarService> logger)
{
    static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(20) };
    static readonly ConcurrentDictionary<string, (DateTimeOffset Expires, EconomicCalendarResponse Payload)> Cache = new();
    static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    public async Task<EconomicCalendarResponse> GetAsync(string? from, string? to, CancellationToken ct = default)
    {
        var fromDate = ParseDay(from) ?? DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-2));
        var toDate = ParseDay(to) ?? DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5));
        if (toDate < fromDate) (fromDate, toDate) = (toDate, fromDate);
        if (toDate.DayNumber - fromDate.DayNumber > 90)
            toDate = fromDate.AddDays(90);

        var fromStr = fromDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var toStr = toDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var apiKey = (config["Fmp:ApiKey"] ?? config["FMP_API_KEY"] ?? "").Trim();

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return new EconomicCalendarResponse(
                "demo",
                "none",
                fromStr,
                toStr,
                Array.Empty<EconomicCalendarEventDto>(),
                "Set Fmp:ApiKey (or env Fmp__ApiKey) to load live data from Financial Modeling Prep.");
        }

        var cacheKey = $"{fromStr}:{toStr}:{apiKey.GetHashCode(StringComparison.Ordinal)}";
        if (Cache.TryGetValue(cacheKey, out var hit) && hit.Expires > DateTimeOffset.UtcNow)
            return hit.Payload;

        try
        {
            var urls = new[]
            {
                $"https://financialmodelingprep.com/stable/economic-calendar?from={fromStr}&to={toStr}&apikey={Uri.EscapeDataString(apiKey)}",
                $"https://financialmodelingprep.com/api/v3/economic_calendar?from={fromStr}&to={toStr}&apikey={Uri.EscapeDataString(apiKey)}",
            };

            Exception? last = null;
            foreach (var url in urls)
            {
                try
                {
                    using var res = await Http.GetAsync(url, ct);
                    var body = await res.Content.ReadAsStringAsync(ct);
                    if (!res.IsSuccessStatusCode)
                    {
                        last = new InvalidOperationException($"FMP {(int)res.StatusCode}: {Trim(body, 180)}");
                        continue;
                    }

                    List<FmpRow>? rows;
                    try
                    {
                        rows = JsonSerializer.Deserialize<List<FmpRow>>(body, JsonOpts);
                    }
                    catch (JsonException)
                    {
                        using var doc = JsonDocument.Parse(body);
                        if (doc.RootElement.TryGetProperty("Error Message", out var err))
                        {
                            last = new InvalidOperationException(err.GetString() ?? "FMP error");
                            continue;
                        }
                        throw;
                    }

                    if (rows is null)
                    {
                        last = new InvalidOperationException("Empty FMP response");
                        continue;
                    }

                    var items = rows
                        .Select(Map)
                        .Where(x => x is not null)
                        .Cast<EconomicCalendarEventDto>()
                        .OrderBy(x => x.Datetime)
                        .ToList();

                    var payload = new EconomicCalendarResponse("live", "fmp", fromStr, toStr, items, null);
                    Cache[cacheKey] = (DateTimeOffset.UtcNow.AddMinutes(15), payload);
                    return payload;
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    last = ex;
                }
            }

            logger.LogWarning(last, "FMP economic calendar failed");
            return new EconomicCalendarResponse(
                "error",
                "fmp",
                fromStr,
                toStr,
                Array.Empty<EconomicCalendarEventDto>(),
                last?.Message ?? "Failed to load economic calendar");
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "FMP economic calendar unexpected failure");
            return new EconomicCalendarResponse(
                "error",
                "fmp",
                fromStr,
                toStr,
                Array.Empty<EconomicCalendarEventDto>(),
                ex.Message);
        }
    }

    static EconomicCalendarEventDto? Map(FmpRow row)
    {
        var title = (row.Event ?? row.Title ?? "").Trim();
        if (string.IsNullOrWhiteSpace(title)) return null;
        var when = NormalizeDate(row.Date ?? row.DateTime);
        if (when is null) return null;
        var currency = (row.Currency ?? GuessCurrency(row.Country) ?? "USD").Trim().ToUpperInvariant();
        var country = (row.Country ?? "").Trim();
        var id = $"fmp-{when:yyyyMMddHHmm}-{currency}-{StableHash(title)}";
        return new EconomicCalendarEventDto(
            id,
            when.Value.ToUniversalTime().ToString("o"),
            currency.Length > 3 ? currency[..3] : currency,
            country,
            title,
            MapImpact(row.Impact),
            FormatVal(row.Actual),
            FormatVal(row.Estimate ?? row.Forecast),
            FormatVal(row.Previous));
    }

    static string MapImpact(string? impact)
    {
        var v = (impact ?? "").Trim().ToLowerInvariant();
        if (v is "high" or "3" or "red") return "high";
        if (v is "medium" or "med" or "2" or "orange" or "yellow") return "medium";
        if (v is "low" or "1" or "green") return "low";
        if (string.IsNullOrWhiteSpace(v) || v is "holiday" or "none") return "none";
        return "medium";
    }

    static string? FormatVal(object? value)
    {
        if (value is null) return null;
        if (value is JsonElement je)
        {
            return je.ValueKind switch
            {
                JsonValueKind.Null or JsonValueKind.Undefined => null,
                JsonValueKind.Number => je.GetRawText(),
                JsonValueKind.String => string.IsNullOrWhiteSpace(je.GetString()) ? null : je.GetString(),
                _ => je.ToString(),
            };
        }
        var s = Convert.ToString(value, CultureInfo.InvariantCulture);
        return string.IsNullOrWhiteSpace(s) || s is "null" ? null : s;
    }

    static DateTimeOffset? NormalizeDate(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        if (DateTimeOffset.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var dto))
            return dto;
        if (DateTime.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var dt))
            return new DateTimeOffset(DateTime.SpecifyKind(dt, DateTimeKind.Utc));
        return null;
    }

    static DateOnly? ParseDay(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        return DateOnly.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.None, out var d) ? d : null;
    }

    static string? GuessCurrency(string? country) => (country ?? "").Trim().ToUpperInvariant() switch
    {
        "US" or "USA" or "UNITED STATES" => "USD",
        "EU" or "EURO AREA" or "EUROZONE" or "GERMANY" or "FRANCE" or "ITALY" or "SPAIN" => "EUR",
        "GB" or "UK" or "UNITED KINGDOM" => "GBP",
        "JP" or "JAPAN" => "JPY",
        "CA" or "CANADA" => "CAD",
        "AU" or "AUSTRALIA" => "AUD",
        "CH" or "SWITZERLAND" => "CHF",
        "NZ" or "NEW ZEALAND" => "NZD",
        _ => null,
    };

    static string StableHash(string s)
    {
        unchecked
        {
            var h = 23;
            foreach (var c in s) h = h * 31 + c;
            return Math.Abs(h).ToString("x", CultureInfo.InvariantCulture);
        }
    }

    static string Trim(string s, int max) =>
        string.IsNullOrEmpty(s) ? "" : s.Length <= max ? s : s[..max] + "…";

    sealed class FmpRow
    {
        [JsonPropertyName("date")] public string? Date { get; set; }
        [JsonPropertyName("dateTime")] public string? DateTime { get; set; }
        [JsonPropertyName("country")] public string? Country { get; set; }
        [JsonPropertyName("event")] public string? Event { get; set; }
        [JsonPropertyName("title")] public string? Title { get; set; }
        [JsonPropertyName("currency")] public string? Currency { get; set; }
        [JsonPropertyName("previous")] public object? Previous { get; set; }
        [JsonPropertyName("estimate")] public object? Estimate { get; set; }
        [JsonPropertyName("forecast")] public object? Forecast { get; set; }
        [JsonPropertyName("actual")] public object? Actual { get; set; }
        [JsonPropertyName("impact")] public string? Impact { get; set; }
    }
}
