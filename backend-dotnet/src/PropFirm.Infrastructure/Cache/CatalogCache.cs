using System.Text.Json;
using Microsoft.Extensions.Configuration;
using StackExchange.Redis;

namespace PropFirm.Infrastructure.Cache;

/// <summary>
/// Cache-aside (lazy load / read-through) for catalog reads — same pattern as Python
/// <c>architecture/cache.py</c>: miss → Postgres → SETEX; admin/seed invalidates prefix.
/// </summary>
public sealed class CatalogCache
{
    private readonly IConnectionMultiplexer? _mux;
    private readonly int _ttlSeconds;
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public CatalogCache(IConfiguration config)
    {
        _ttlSeconds = int.TryParse(config["Redis:CatalogTtlSeconds"], out var ttl) ? ttl : 60;
        var url = config["Redis:Url"] ?? "127.0.0.1:6380";
        try
        {
            _mux = ConnectionMultiplexer.Connect(url);
        }
        catch
        {
            _mux = null; // Redis optional in tests / offline
        }
    }

    public static string ListKey(string? phase, string? variant) =>
        $"propfirm:catalog:products:{phase ?? "-"}:{variant ?? "-"}";

    public static string ItemKey(string id) => $"propfirm:catalog:product:{id}";

    public async Task<T?> GetAsync<T>(string key)
    {
        if (_mux is null) return default;
        var db = _mux.GetDatabase();
        var raw = await db.StringGetAsync(key);
        if (raw.IsNullOrEmpty) return default;
        return JsonSerializer.Deserialize<T>((string)raw!, JsonOpts);
    }

    public async Task SetAsync<T>(string key, T value, int? ttl = null)
    {
        if (_mux is null) return;
        var db = _mux.GetDatabase();
        var payload = JsonSerializer.Serialize(value, JsonOpts);
        await db.StringSetAsync(key, payload, TimeSpan.FromSeconds(ttl ?? _ttlSeconds));
    }

    public async Task InvalidateCatalogAsync()
    {
        if (_mux is null) return;
        var server = _mux.GetServers().FirstOrDefault(s => s.IsConnected);
        if (server is null) return;
        var db = _mux.GetDatabase();
        await foreach (var key in server.KeysAsync(pattern: "propfirm:catalog:*"))
            await db.KeyDeleteAsync(key);
    }
}
