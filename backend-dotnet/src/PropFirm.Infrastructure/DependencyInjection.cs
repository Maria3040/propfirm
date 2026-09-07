using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PropFirm.Infrastructure.Cache;
using PropFirm.Infrastructure.Integrations;
using PropFirm.Infrastructure.Mail;
using PropFirm.Infrastructure.Persistence;
using PropFirm.Infrastructure.Security;
using PropFirm.Infrastructure.Services;

namespace PropFirm.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddPropFirmInfrastructure(this IServiceCollection services, IConfiguration config)
    {
        var cs = config.GetConnectionString("Default")
                 ?? "Host=127.0.0.1;Port=15433;Database=propfirm;Username=propfirm;Password=propfirm_dev";

        services.AddDbContext<PropFirmDbContext>(o => o.UseNpgsql(cs));
        services.AddSingleton<JwtTokenService>();
        services.AddSingleton<IpIntelService>();
        services.AddSingleton<CatalogCache>();
        services.AddSingleton<HistoryQueries>();
        services.AddSingleton<EconomicCalendarService>();
        services.AddScoped<MailService>();
        services.AddScoped<PropFirmAppService>();
        return services;
    }
}
