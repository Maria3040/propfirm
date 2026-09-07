using System.Net;
using System.Net.Http.Json;
using PropFirm.IntegrationTests;

namespace PropFirm.E2ETests;

/// <summary>
/// End-to-end style API journeys using the in-process test host (WebApplicationFactory).
/// Frontend Playwright e2e remains under frontend/e2e against a running stack.
/// </summary>
public class TravelerJourneyE2E : IClassFixture<PropFirmApiFactory>
{
    private readonly PropFirmApiFactory _factory;

    public TravelerJourneyE2E(PropFirmApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Happy_path_login_catalog_coupon_admin_lists()
    {
        var client = await _factory.CreateSeededClientAsync();
        var bad = await client.PostAsJsonAsync("/api/auth/login", new { email = "trader@propfirm.local", password = "wrong" });
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);

        var login = await client.PostAsJsonAsync("/api/auth/login", new { email = "trader@propfirm.local", password = "Trader1!" });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var traderSession = await login.Content.ReadFromJsonAsync<AuthDto>();
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", traderSession!.accessToken);

        var me = await client.GetAsync("/api/users/me");
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);

        var coupon = await client.PostAsJsonAsync("/api/coupons/validate", new { code = "WELCOME10", subtotal = 100 });
        Assert.Equal(HttpStatusCode.OK, coupon.StatusCode);

        await client.PostAsJsonAsync("/api/auth/logout", new { });
        client.DefaultRequestHeaders.Authorization = null;
        var adminLogin = await client.PostAsJsonAsync("/api/auth/login", new { email = "admin@propfirm.local", password = "Admin1!" });
        Assert.Equal(HttpStatusCode.OK, adminLogin.StatusCode);
        var adminSession = await adminLogin.Content.ReadFromJsonAsync<AuthDto>();
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", adminSession!.accessToken);

        var traders = await client.GetAsync("/api/admin/traders?page=1&pageSize=10&q=trader@");
        Assert.Equal(HttpStatusCode.OK, traders.StatusCode);
        var page = await traders.Content.ReadFromJsonAsync<AdminPage>();
        Assert.NotNull(page);
        Assert.True(page.Total >= 1);
        Assert.NotNull(page.Items);
    }

    private sealed record AdminPage(List<object> Items, int Total);
    private sealed record AuthDto(string accessToken);
}
