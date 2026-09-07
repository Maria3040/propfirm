using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using PropFirm.Infrastructure;
using PropFirm.Infrastructure.Persistence;
using PropFirm.Infrastructure.Security;
using PropFirm.Infrastructure.Services;
using PropFirm.SharedKernel;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.UseUrls($"http://0.0.0.0:{builder.Configuration["HTTP_PORT"] ?? Environment.GetEnvironmentVariable("HTTP_PORT") ?? "6080"}");

builder.Services.AddPropFirmInfrastructure(builder.Configuration);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var jwt = new JwtTokenService(builder.Configuration);
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.MapInboundClaims = false;
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "propfirm",
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "propfirm",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey)),
            RoleClaimType = "role",
            NameClaimType = "sub",
        };
        o.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                if (string.IsNullOrEmpty(ctx.Token) &&
                    ctx.Request.Cookies.TryGetValue(jwt.CookieName, out var cookie))
                    ctx.Token = cookie;
                return Task.CompletedTask;
            },
        };
    });
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", p => p.RequireAssertion(ctx =>
        ctx.User.Claims.Any(c =>
            c.Value == "Admin" &&
            (c.Type is "role" or "Role" ||
             c.Type.Equals(ClaimTypes.Role, StringComparison.OrdinalIgnoreCase) ||
             c.Type.EndsWith("/role", StringComparison.OrdinalIgnoreCase)))));
});
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins((builder.Configuration["Cors:Origins"] ?? "http://localhost:3100,http://127.0.0.1:3100")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials()));

builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    if (!app.Environment.IsEnvironment("Testing"))
    {
        var db = scope.ServiceProvider.GetRequiredService<PropFirmDbContext>();
        var cache = scope.ServiceProvider.GetRequiredService<PropFirm.Infrastructure.Cache.CatalogCache>();
        await SeedData.EnsureSeededAsync(db, cache);
    }
}

app.UseSwagger();
app.UseSwaggerUI();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

static void SetAuthCookie(HttpResponse res, JwtTokenService tokens, string jwtValue)
{
    res.Cookies.Append(tokens.CookieName, jwtValue, new CookieOptions
    {
        HttpOnly = true,
        SameSite = SameSiteMode.Lax,
        Secure = false,
        Path = "/",
        Expires = DateTimeOffset.UtcNow.AddDays(7),
    });
}

static IResult DomainFail(Exception ex)
{
    var message = ex.Message;
    var status = message switch
    {
        "forbidden" => 403,
        "not found" => 404,
        "invalid credentials" => 401,
        _ => 400,
    };
    return Results.Json(new { detail = message }, statusCode: status);
}

static (string UserId, string Role) RequireUser(ClaimsPrincipal user)
{
    var id = user.FindFirstValue("sub")
             ?? user.FindFirstValue(ClaimTypes.NameIdentifier)
             ?? throw new DomainError("unauthorized");
    var role = user.FindFirstValue("role") ?? user.FindFirstValue(ClaimTypes.Role) ?? "Trader";
    return (id, role);
}

app.MapGet("/", () => Results.Ok(new { name = "PropFirm .NET modular monolith", docs = "/swagger" }));

app.MapPost("/api/auth/register", async (RegisterBody body, PropFirmAppService svc, JwtTokenService tokens, HttpResponse res) =>
{
    try
    {
        var (payload, token) = await svc.RegisterAsync(body.Email, body.Password, body.DisplayName ?? "");
        SetAuthCookie(res, tokens, token);
        return Results.Ok(payload);
    }
    catch (DomainError ex) { return DomainFail(ex); }
});

app.MapPost("/api/auth/login", async (LoginBody body, PropFirmAppService svc, JwtTokenService tokens, HttpRequest req, HttpResponse res) =>
{
    try
    {
        var (payload, token) = await svc.LoginAsync(body.Email, body.Password, body.ClientIp ?? req.HttpContext.Connection.RemoteIpAddress?.ToString(), req.Headers.UserAgent);
        SetAuthCookie(res, tokens, token);
        return Results.Ok(payload);
    }
    catch (DomainError ex) { return DomainFail(ex); }
});

app.MapPost("/api/auth/logout", (JwtTokenService tokens, HttpResponse res) =>
{
    res.Cookies.Delete(tokens.CookieName);
    return Results.Ok(new { ok = true });
});

app.MapGet("/api/users/me", async (ClaimsPrincipal user, PropFirmAppService svc) =>
{
    try
    {
        var (id, _) = RequireUser(user);
        var me = await svc.MeAsync(id);
        return me is null ? Results.Unauthorized() : Results.Ok(me);
    }
    catch (DomainError) { return Results.Unauthorized(); }
}).RequireAuthorization();

app.MapGet("/api/users/me/login-history", async (ClaimsPrincipal user, PropFirmAppService svc) =>
{
    try
    {
        var (id, _) = RequireUser(user);
        return Results.Ok(await svc.LoginHistoryAsync(id));
    }
    catch (DomainError ex) { return DomainFail(ex); }
}).RequireAuthorization();

app.MapGet("/api/users/me/verification", async (ClaimsPrincipal user, PropFirmAppService svc) =>
{
    try
    {
        var (id, _) = RequireUser(user);
        return Results.Ok(await svc.GetVerificationAsync(id));
    }
    catch (DomainError ex) { return DomainFail(ex); }
}).RequireAuthorization();

app.MapPost("/api/users/me/verification/start", async (ClaimsPrincipal user, PropFirmAppService svc) =>
{
    try
    {
        var (id, _) = RequireUser(user);
        return Results.Ok(await svc.StartVerificationAsync(id));
    }
    catch (DomainError ex) { return DomainFail(ex); }
}).RequireAuthorization();

app.MapPost("/api/users/me/2fa", async (TwoFaBody body, ClaimsPrincipal user, PropFirmAppService svc) =>
{
    try
    {
        var (id, _) = RequireUser(user);
        return Results.Ok(await svc.SetTwoFactorAsync(id, body.Enabled));
    }
    catch (DomainError ex) { return DomainFail(ex); }
}).RequireAuthorization();

app.MapGet("/api/users/me/preferences", async (ClaimsPrincipal user, PropFirmAppService svc) =>
{
    try
    {
        var (id, _) = RequireUser(user);
        return Results.Ok(await svc.GetPreferencesAsync(id));
    }
    catch (DomainError ex) { return DomainFail(ex); }
}).RequireAuthorization();

app.MapPatch("/api/users/me/preferences", async (PreferencesBody body, ClaimsPrincipal user, PropFirmAppService svc) =>
{
    try
    {
        var (id, _) = RequireUser(user);
        return Results.Ok(await svc.UpdatePreferencesAsync(id, body.Language));
    }
    catch (DomainError ex) { return DomainFail(ex); }
}).RequireAuthorization();

app.MapPost("/api/users/me/password", async (PasswordBody body, ClaimsPrincipal user, PropFirmAppService svc) =>
{
    try
    {
        var (id, _) = RequireUser(user);
        return Results.Ok(await svc.ChangePasswordAsync(id, body.CurrentPassword, body.NewPassword));
    }
    catch (DomainError ex) { return DomainFail(ex); }
}).RequireAuthorization();

app.MapGet("/api/feature-suggestions", async (ClaimsPrincipal user, PropFirmAppService svc) =>
{
    try
    {
        var (id, _) = RequireUser(user);
        return Results.Ok(await svc.ListMyFeatureSuggestionsAsync(id));
    }
    catch (DomainError ex) { return DomainFail(ex); }
}).RequireAuthorization();

app.MapPost("/api/feature-suggestions", async (SuggestionBody body, ClaimsPrincipal user, PropFirmAppService svc) =>
{
    try
    {
        var (id, _) = RequireUser(user);
        return Results.Ok(await svc.SubmitFeatureSuggestionAsync(
            id, body.Title, body.Category, body.Description, body.UseCase, body.Priority));
    }
    catch (DomainError ex) { return DomainFail(ex); }
}).RequireAuthorization();

app.MapGet("/api/affiliate/me", async (ClaimsPrincipal user, PropFirmAppService svc) =>
{
    try
    {
        var (id, _) = RequireUser(user);
        return Results.Ok(await svc.AffiliateDashboardAsync(id));
    }
    catch (DomainError ex) { return DomainFail(ex); }
}).RequireAuthorization();

app.MapGet("/api/economic-calendar", async (string? from, string? to, PropFirm.Infrastructure.Integrations.EconomicCalendarService calendar, CancellationToken ct) =>
{
    var result = await calendar.GetAsync(from, to, ct);
    return Results.Ok(new
    {
        source = result.Source,
        provider = result.Provider,
        from = result.From,
        to = result.To,
        detail = result.Detail,
        items = result.Items.Select(e => new
        {
            id = e.Id,
            datetime = e.Datetime,
            currency = e.Currency,
            country = e.Country,
            title = e.Title,
            impact = e.Impact,
            actual = e.Actual,
            forecast = e.Forecast,
            previous = e.Previous,
        }),
    });
});

app.MapGet("/api/catalog/products", async (string? phaseFamily, string? variant, PropFirmAppService svc) =>
    Results.Ok(await svc.ListProductsAsync(phaseFamily, variant)));

app.MapGet("/api/catalog/products/{productId}", async (string productId, PropFirmAppService svc) =>
{
    var row = await svc.GetProductAsync(productId);
    return row is null ? Results.NotFound(new { detail = "not found" }) : Results.Ok(row);
});

app.MapPost("/api/coupons/validate", (CouponBody body, PropFirmAppService svc) =>
{
    try { return Results.Ok(svc.ValidateCoupon(body.Code, body.Subtotal)); }
    catch (DomainError ex) { return DomainFail(ex); }
});

app.MapPost("/api/orders", async (OrderBody body, ClaimsPrincipal user, PropFirmAppService svc) =>
{
    try
    {
        var (id, _) = RequireUser(user);
        return Results.Ok(await svc.CreateOrderAsync(id, body.ProductId, body.AddonSwapFree, body.Platform, body.Quantity <= 0 ? 1 : body.Quantity, body.CouponCode));
    }
    catch (DomainError ex) { return DomainFail(ex); }
}).RequireAuthorization();

app.MapPost("/api/orders/{orderId}/confirm", async (string orderId, ClaimsPrincipal user, PropFirmAppService svc) =>
{
    try
    {
        var (id, _) = RequireUser(user);
        return Results.Ok(await svc.ConfirmOrderAsync(id, orderId));
    }
    catch (DomainError ex) { return DomainFail(ex); }
}).RequireAuthorization();

app.MapGet("/api/challenges", async (ClaimsPrincipal user, PropFirmAppService svc) =>
{
    try
    {
        var (id, role) = RequireUser(user);
        return Results.Ok(await svc.ListChallengesAsync(id, role));
    }
    catch (DomainError ex) { return DomainFail(ex); }
}).RequireAuthorization();

app.MapGet("/api/challenges/restore", async (string? token, PropFirmAppService svc) =>
{
    try
    {
        return Results.Ok(await svc.RestoreArchivedChallengeAsync(null, null, token ?? ""));
    }
    catch (DomainError ex) { return DomainFail(ex); }
});

app.MapPost("/api/challenges/restore", async (RestoreBody body, ClaimsPrincipal user, PropFirmAppService svc) =>
{
    try
    {
        var (id, role) = RequireUser(user);
        return Results.Ok(await svc.RestoreArchivedChallengeAsync(id, role, body.Token ?? ""));
    }
    catch (DomainError ex) { return DomainFail(ex); }
}).RequireAuthorization();

app.MapGet("/api/challenges/{challengeId}", async (string challengeId, ClaimsPrincipal user, PropFirmAppService svc) =>
{
    try
    {
        var (id, role) = RequireUser(user);
        return Results.Ok(await svc.GetChallengeAsync(id, role, challengeId));
    }
    catch (DomainError ex) { return DomainFail(ex); }
}).RequireAuthorization();

app.MapPost("/api/challenges/{challengeId}/trades/simulate", async (string challengeId, TradeBody body, ClaimsPrincipal user, PropFirmAppService svc) =>
{
    try
    {
        var (id, role) = RequireUser(user);
        return Results.Ok(await svc.SimulateTradeAsync(id, role, challengeId, body.Symbol ?? "EURUSD", body.Side ?? "buy", body.Lots, body.Pnl, body.TradeDay));
    }
    catch (DomainError ex) { return DomainFail(ex); }
}).RequireAuthorization();

app.MapPost("/api/challenges/{challengeId}/archive", async (string challengeId, ClaimsPrincipal user, PropFirmAppService svc) =>
{
    try
    {
        var (id, role) = RequireUser(user);
        return Results.Ok(await svc.ArchiveChallengeAsync(id, role, challengeId));
    }
    catch (DomainError ex) { return DomainFail(ex); }
}).RequireAuthorization();

app.MapGet("/api/competitions/joined", async (ClaimsPrincipal user, PropFirmAppService svc) =>
{
    var (id, _) = RequireUser(user);
    return Results.Ok(await svc.JoinedCompetitionsAsync(id));
}).RequireAuthorization();

app.MapGet("/api/competitions/{competitionId}/participants", async (string competitionId, PropFirmAppService svc) =>
    Results.Ok(await svc.ListCompetitionParticipantsAsync(competitionId)));

app.MapPost("/api/competitions/{competitionId}/join", async (string competitionId, JoinBody body, ClaimsPrincipal user, PropFirmAppService svc) =>
{
    try
    {
        var (id, _) = RequireUser(user);
        return Results.Ok(await svc.JoinCompetitionAsync(id, competitionId, body.Title));
    }
    catch (DomainError ex) { return DomainFail(ex); }
}).RequireAuthorization();

app.MapGet("/api/payments/history", async (int? page, int? pageSize, string? q, string? sortBy, string? sortDir, string? status, ClaimsPrincipal user, PropFirmAppService svc) =>
{
    var (id, _) = RequireUser(user);
    var result = await svc.PaymentHistoryAsync(id, page ?? 1, pageSize ?? 20, q, sortBy ?? "createdAt", sortDir ?? "desc", status);
    return Results.Ok(PageEnvelope(result));
}).RequireAuthorization();

app.MapGet("/api/notifications", async (int? page, int? pageSize, string? q, string? sortBy, string? sortDir, string? status, ClaimsPrincipal user, PropFirmAppService svc) =>
{
    var (id, _) = RequireUser(user);
    var result = await svc.NotificationHistoryAsync(id, page ?? 1, pageSize ?? 20, q, sortBy ?? "createdAt", sortDir ?? "desc", status);
    return Results.Ok(PageEnvelope(result));
}).RequireAuthorization();

app.MapGet("/api/payouts/wallet", async (ClaimsPrincipal user, PropFirmAppService svc) =>
{
    var (id, _) = RequireUser(user);
    return Results.Ok(await svc.WalletAsync(id));
}).RequireAuthorization();

app.MapGet("/api/payouts/eligible", async (ClaimsPrincipal user, PropFirmAppService svc) =>
{
    var (id, _) = RequireUser(user);
    return Results.Ok(await svc.EligiblePayoutsAsync(id));
}).RequireAuthorization();

app.MapGet("/api/payouts", async (int? page, int? pageSize, string? q, string? sortBy, string? sortDir, string? status, ClaimsPrincipal user, PropFirmAppService svc) =>
{
    var (id, _) = RequireUser(user);
    var result = await svc.PayoutHistoryAsync(id, page ?? 1, pageSize ?? 20, q, sortBy ?? "createdAt", sortDir ?? "desc", status);
    return Results.Ok(PageEnvelope(result));
}).RequireAuthorization();

app.MapPost("/api/payouts/request", async (PayoutBody body, ClaimsPrincipal user, PropFirmAppService svc) =>
{
    try
    {
        var (id, _) = RequireUser(user);
        return Results.Ok(await svc.RequestPayoutAsync(id, body.Amount, body.ChallengeId, body.Method, body.CryptoNetwork, body.CryptoAddress));
    }
    catch (DomainError ex) { return DomainFail(ex); }
}).RequireAuthorization();

static object PageEnvelope(PropFirm.Domain.Modules.Admin.PageResult<object> result) => new
{
    items = result.Items,
    page = result.Page,
    pageSize = result.PageSize,
    total = result.Total,
    totalPages = result.TotalPages,
    sortBy = result.SortBy,
    sortDir = result.SortDir,
    q = result.Q,
    filters = result.Filters,
};

app.MapGet("/api/admin/overview", async (PropFirmAppService svc) => Results.Ok(await svc.AdminOverviewAsync()))
    .RequireAuthorization("AdminOnly");

app.MapGet("/api/admin/traders", async (int? page, int? pageSize, string? q, string? sortBy, string? sortDir, string? role, PropFirmAppService svc) =>
{
    var result = await svc.AdminTradersAsync(page ?? 1, pageSize ?? 20, q, sortBy ?? "createdAt", sortDir ?? "desc", role);
    return Results.Ok(PageEnvelope(result));
}).RequireAuthorization("AdminOnly");

app.MapGet("/api/admin/payouts", async (int? page, int? pageSize, string? q, string? sortBy, string? sortDir, string? status, PropFirmAppService svc) =>
{
    var result = await svc.AdminPayoutsAsync(page ?? 1, pageSize ?? 20, q, sortBy ?? "createdAt", sortDir ?? "desc", status);
    return Results.Ok(PageEnvelope(result));
}).RequireAuthorization("AdminOnly");

app.MapGet("/api/admin/challenges", async (int? page, int? pageSize, string? q, string? sortBy, string? sortDir, string? status, PropFirmAppService svc) =>
{
    var result = await svc.AdminChallengesAsync(page ?? 1, pageSize ?? 20, q, sortBy ?? "createdAt", sortDir ?? "desc", status);
    return Results.Ok(PageEnvelope(result));
}).RequireAuthorization("AdminOnly");

app.MapPost("/api/admin/challenges/{challengeId}/close", async (string challengeId, PropFirmAppService svc) =>
{
    try { return Results.Ok(await svc.AdminCloseChallengeAsync(challengeId)); }
    catch (DomainError ex) { return DomainFail(ex); }
}).RequireAuthorization("AdminOnly");

app.MapGet("/api/admin/catalog/products", async (int? page, int? pageSize, string? q, string? sortBy, string? sortDir, string? isActive, PropFirmAppService svc) =>
{
    var result = await svc.AdminCatalogProductsAsync(page ?? 1, pageSize ?? 20, q, sortBy ?? "accountSize", sortDir ?? "asc", isActive);
    return Results.Ok(PageEnvelope(result));
}).RequireAuthorization("AdminOnly");

app.MapPatch("/api/admin/catalog/products/{productId}", async (string productId, CatalogPatchBody body, PropFirmAppService svc) =>
{
    try { return Results.Ok(await svc.AdminSetProductActiveAsync(productId, body.IsActive)); }
    catch (DomainError ex) { return DomainFail(ex); }
}).RequireAuthorization("AdminOnly");

app.MapGet("/api/admin/audit", async (int? page, int? pageSize, string? q, string? sortBy, string? sortDir, PropFirmAppService svc) =>
{
    var result = await svc.AdminAuditAsync(page ?? 1, pageSize ?? 20, q, sortBy ?? "occurredAt", sortDir ?? "desc");
    return Results.Ok(PageEnvelope(result));
}).RequireAuthorization("AdminOnly");

app.MapGet("/api/admin/notifications", async (int? page, int? pageSize, string? q, string? sortBy, string? sortDir, string? status, PropFirmAppService svc) =>
{
    var result = await svc.AdminNotificationsAsync(page ?? 1, pageSize ?? 20, q, sortBy ?? "createdAt", sortDir ?? "desc", status);
    return Results.Ok(PageEnvelope(result));
}).RequireAuthorization("AdminOnly");

app.MapPost("/api/admin/payouts/{payoutId}/approve", async (string payoutId, PropFirmAppService svc) =>
{
    try { return Results.Ok(await svc.DecidePayoutAsync(payoutId, true)); }
    catch (DomainError ex) { return DomainFail(ex); }
}).RequireAuthorization("AdminOnly");

app.MapPost("/api/admin/payouts/{payoutId}/reject", async (string payoutId, PropFirmAppService svc) =>
{
    try { return Results.Ok(await svc.DecidePayoutAsync(payoutId, false)); }
    catch (DomainError ex) { return DomainFail(ex); }
}).RequireAuthorization("AdminOnly");

app.MapPost("/api/admin/payouts/{payoutId}/comment", async (string payoutId, CommentBody body, PropFirmAppService svc) =>
{
    try { return Results.Ok(await svc.CommentPayoutAsync(payoutId, body.Subject ?? "", body.Message)); }
    catch (DomainError ex) { return DomainFail(ex); }
}).RequireAuthorization("AdminOnly");

app.MapGet("/api/admin/verifications", async (PropFirmAppService svc) =>
    Results.Ok(await svc.AdminListVerificationsAsync())).RequireAuthorization("AdminOnly");

app.MapPost("/api/admin/verifications/{traderId}/approve", async (string traderId, VerifyDecideBody body, PropFirmAppService svc) =>
{
    try { return Results.Ok(await svc.AdminDecideVerificationAsync(traderId, true, body.Comment)); }
    catch (DomainError ex) { return DomainFail(ex); }
}).RequireAuthorization("AdminOnly");

app.MapPost("/api/admin/verifications/{traderId}/reject", async (string traderId, VerifyDecideBody body, PropFirmAppService svc) =>
{
    try { return Results.Ok(await svc.AdminDecideVerificationAsync(traderId, false, body.Comment)); }
    catch (DomainError ex) { return DomainFail(ex); }
}).RequireAuthorization("AdminOnly");

app.MapPost("/api/admin/verifications/{traderId}/comment", async (string traderId, CommentBody body, PropFirmAppService svc) =>
{
    try { return Results.Ok(await svc.AdminCommentVerificationAsync(traderId, body.Subject, body.Message)); }
    catch (DomainError ex) { return DomainFail(ex); }
}).RequireAuthorization("AdminOnly");

app.Run();

public partial class Program { }

public record RegisterBody(string Email, string Password, string? DisplayName);
public record LoginBody(string Email, string Password, string? ClientIp);
public record CouponBody(string Code, decimal Subtotal);
public record OrderBody(string ProductId, bool AddonSwapFree, string? Platform, int Quantity, string? CouponCode);
public record TradeBody(string? Symbol, string? Side, decimal Lots, decimal Pnl, string? TradeDay);
public record RestoreBody(string? Token);
public record PayoutBody(decimal Amount, string ChallengeId, string? Method, string? CryptoNetwork, string? CryptoAddress);
public record CommentBody(string? Subject, string Message);
public record JoinBody(string? Title);
public record TwoFaBody(bool Enabled);
public record PreferencesBody(string? Language);
public record PasswordBody(string CurrentPassword, string NewPassword);
public record SuggestionBody(string Title, string Category, string Description, string? UseCase, string Priority);
public record VerifyDecideBody(string? Comment);
public record CatalogPatchBody(bool IsActive);
