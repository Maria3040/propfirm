using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using PropFirm.Infrastructure.Persistence;

namespace PropFirm.Infrastructure.Mail;

public sealed class MailService(IConfiguration config, ILogger<MailService> log)
{
    public async Task<(string Status, string? Detail)> SendAsync(string to, string subject, string body)
    {
        var host = config["Smtp:Host"] ?? "127.0.0.1";
        var port = int.TryParse(config["Smtp:Port"], out var p) ? p : 2525;
        try
        {
            using var client = new SmtpClient(host, port) { EnableSsl = false };
            using var msg = new MailMessage("noreply@propfirm.local", to, subject, body);
            await client.SendMailAsync(msg);
            return ("Sent", null);
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "SMTP send failed to {To}", to);
            return ("Failed", ex.Message);
        }
    }

    public async Task NotifyAsync(PropFirmDbContext db, string to, string subject, string body)
    {
        var (status, detail) = await SendAsync(to, subject, body);
        db.Notifications.Add(new NotificationMessage
        {
            ToEmail = to,
            Subject = subject,
            Body = body,
            Status = status,
            DeliveryDetail = detail,
        });
    }
}
