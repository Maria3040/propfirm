using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace PropFirm.Infrastructure.Security;

public sealed record IpIntel(
    string Ip,
    string? Country,
    string? CountryCode,
    string? City,
    string? Isp,
    string? Org,
    bool IsVpn,
    bool IsVps,
    string ConnectionKind,
    string Label);

/// <summary>Classifies client IPs via ip-api.com (proxy → VPN, hosting → VPS), matching Nest ip-intel.</summary>
public sealed class IpIntelService
{
    static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(4) };

    public async Task<IpIntel> LookupAsync(string? ip, CancellationToken ct = default)
    {
        var clean = (ip ?? "").Replace("::ffff:", "", StringComparison.OrdinalIgnoreCase).Trim();
        if (string.IsNullOrWhiteSpace(clean) || clean is "unknown" or "0.0.0.0")
            return Unknown("unknown");

        if (IsPrivateIp(clean))
        {
            return new IpIntel(
                clean, null, null, null, "Private network", null,
                false, false, "local", LabelFor("local"));
        }

        try
        {
            var url =
                $"http://ip-api.com/json/{Uri.EscapeDataString(clean)}?fields=status,message,country,countryCode,city,isp,org,proxy,hosting,query";
            using var res = await Http.GetAsync(url, ct);
            if (!res.IsSuccessStatusCode) return Unknown(clean);
            var data = await res.Content.ReadFromJsonAsync<IpApiResponse>(cancellationToken: ct);
            if (data is null || !string.Equals(data.Status, "success", StringComparison.OrdinalIgnoreCase))
                return Unknown(clean);

            var isVpn = data.Proxy;
            var kind = Classify(isVpn, data.Hosting, local: false);
            return new IpIntel(
                string.IsNullOrWhiteSpace(data.Query) ? clean : data.Query!,
                data.Country,
                data.CountryCode,
                data.City,
                data.Isp,
                data.Org,
                isVpn,
                kind == "vps",
                kind,
                LabelFor(kind));
        }
        catch
        {
            return Unknown(clean);
        }
    }

    static string Classify(bool proxy, bool hosting, bool local)
    {
        if (local) return "local";
        if (proxy) return "vpn";
        if (hosting) return "vps";
        return "residential";
    }

    public static string LabelFor(string kind) => kind switch
    {
        "vpn" => "VPN / Proxy",
        "vps" => "VPS / Datacenter",
        "residential" => "Residential (real IP)",
        "local" => "Local / Private network",
        _ => "Unknown",
    };

    static IpIntel Unknown(string ip) =>
        new(ip, null, null, null, null, null, false, false, "unknown", LabelFor("unknown"));

    static bool IsPrivateIp(string ip)
    {
        if (ip is "::1" or "127.0.0.1" or "localhost") return true;
        if (!IPAddress.TryParse(ip, out var addr)) return true;
        if (IPAddress.IsLoopback(addr)) return true;

        var v = ip;
        if (v.StartsWith("10.", StringComparison.Ordinal)) return true;
        if (v.StartsWith("192.168.", StringComparison.Ordinal)) return true;
        if (v.StartsWith("169.254.", StringComparison.Ordinal)) return true;
        if (v.StartsWith("172.", StringComparison.Ordinal))
        {
            var parts = v.Split('.');
            if (parts.Length > 1 && int.TryParse(parts[1], out var n) && n is >= 16 and <= 31)
                return true;
        }

        return false;
    }

    sealed class IpApiResponse
    {
        [JsonPropertyName("status")] public string? Status { get; set; }
        [JsonPropertyName("country")] public string? Country { get; set; }
        [JsonPropertyName("countryCode")] public string? CountryCode { get; set; }
        [JsonPropertyName("city")] public string? City { get; set; }
        [JsonPropertyName("isp")] public string? Isp { get; set; }
        [JsonPropertyName("org")] public string? Org { get; set; }
        [JsonPropertyName("proxy")] public bool Proxy { get; set; }
        [JsonPropertyName("hosting")] public bool Hosting { get; set; }
        [JsonPropertyName("query")] public string? Query { get; set; }
    }
}
