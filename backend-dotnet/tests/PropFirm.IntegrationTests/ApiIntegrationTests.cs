using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using PropFirm.Infrastructure.Persistence;

namespace PropFirm.IntegrationTests;

public class PropFirmApiFactory : WebApplicationFactory<Program>
{
    private readonly string _dbName = "propfirm-test-" + Guid.NewGuid().ToString("N");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<DbContextOptions<PropFirmDbContext>>();
            services.RemoveAll<DbContextOptions>();
            services.RemoveAll<IDbContextOptionsConfiguration<PropFirmDbContext>>();
            services.RemoveAll<PropFirmDbContext>();

            services.AddDbContext<PropFirmDbContext>(o => o.UseInMemoryDatabase(_dbName));
        });
    }

    public async Task<HttpClient> CreateSeededClientAsync()
    {
        var client = CreateClient(new WebApplicationFactoryClientOptions
        {
            HandleCookies = true,
            AllowAutoRedirect = false,
        });
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PropFirmDbContext>();
        await SeedData.EnsureSeededAsync(db);
        return client;
    }
}

public class AuthAndCatalogTests : IClassFixture<PropFirmApiFactory>
{
    private readonly PropFirmApiFactory _factory;

    public AuthAndCatalogTests(PropFirmApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Login_admin_and_read_overview()
    {
        var client = await _factory.CreateSeededClientAsync();
        var login = await client.PostAsJsonAsync("/api/auth/login", new { email = "admin@propfirm.local", password = "Admin1!" });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var session = await login.Content.ReadFromJsonAsync<AuthDto>();
        Assert.NotNull(session?.accessToken);
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", session.accessToken);

        var overview = await client.GetAsync("/api/admin/overview");
        Assert.Equal(HttpStatusCode.OK, overview.StatusCode);
        var body = await overview.Content.ReadFromJsonAsync<Dictionary<string, object>>();
        Assert.NotNull(body);
        Assert.True(body.ContainsKey("traders"));
    }

    [Fact]
    public async Task Trader_forbidden_on_admin()
    {
        var client = await new PropFirmApiFactory().CreateSeededClientAsync();
        var login = await client.PostAsJsonAsync("/api/auth/login", new { email = "trader@propfirm.local", password = "Trader1!" });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var session = await login.Content.ReadFromJsonAsync<AuthDto>();
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", session!.accessToken);
        var overview = await client.GetAsync("/api/admin/overview");
        Assert.Equal(HttpStatusCode.Forbidden, overview.StatusCode);
    }

    [Fact]
    public async Task Catalog_lists_seed_products()
    {
        var client = await _factory.CreateSeededClientAsync();
        var res = await client.GetAsync("/api/catalog/products");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var products = await res.Content.ReadFromJsonAsync<List<Dictionary<string, object>>>();
        Assert.NotNull(products);
        Assert.NotEmpty(products);
    }

    private sealed record AuthDto(string accessToken);
}

public class OrderFlowIntegrationTests : IClassFixture<PropFirmApiFactory>
{
    private readonly PropFirmApiFactory _factory;
    public OrderFlowIntegrationTests(PropFirmApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Purchase_confirm_and_simulate_trade()
    {
        var client = await _factory.CreateSeededClientAsync();
        var login = await client.PostAsJsonAsync("/api/auth/login", new { email = "trader@propfirm.local", password = "Trader1!" });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var session = await login.Content.ReadFromJsonAsync<AuthDto>();
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", session!.accessToken);
        var products = await client.GetFromJsonAsync<List<ProductDto>>("/api/catalog/products");
        Assert.NotNull(products);
        var product = products[0];

        var orderRes = await client.PostAsJsonAsync("/api/orders", new
        {
            productId = product.Id,
            addonSwapFree = false,
            platform = "mt5",
            quantity = 1,
        });
        Assert.Equal(HttpStatusCode.OK, orderRes.StatusCode);
        var order = await orderRes.Content.ReadFromJsonAsync<OrderDto>();
        Assert.NotNull(order);

        var confirm = await client.PostAsync($"/api/orders/{order.Id}/confirm", null);
        Assert.Equal(HttpStatusCode.OK, confirm.StatusCode);
        var confirmed = await confirm.Content.ReadFromJsonAsync<ConfirmDto>();
        Assert.NotNull(confirmed?.ChallengeId);

        var sim = await client.PostAsJsonAsync($"/api/challenges/{confirmed.ChallengeId}/trades/simulate", new
        {
            symbol = "EURUSD",
            side = "buy",
            lots = 0.1,
            pnl = 50,
        });
        Assert.Equal(HttpStatusCode.OK, sim.StatusCode);
    }

    private sealed record ProductDto(string Id, string Sku);
    private sealed record OrderDto(string Id);
    private sealed record ConfirmDto(string? ChallengeId);
    private sealed record AuthDto(string accessToken);
}
