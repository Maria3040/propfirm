using System.Data;
using Dapper;
using Microsoft.Extensions.Configuration;
using Npgsql;
using PropFirm.Domain.Modules.Admin;

namespace PropFirm.Infrastructure.Persistence;

/// <summary>Read-model queries via Dapper (EF Core remains the write path).</summary>
public sealed class HistoryQueries(IConfiguration config)
{
    string Cs => config.GetConnectionString("Default")
                 ?? "Host=127.0.0.1;Port=15433;Database=propfirm;Username=propfirm;Password=propfirm_dev";

    async Task<IDbConnection> OpenAsync()
    {
        var conn = new NpgsqlConnection(Cs);
        await conn.OpenAsync();
        return conn;
    }

    public async Task<PageResult<object>> PaymentHistoryAsync(
        string traderId, int page, int pageSize, string? q, string sortBy, string sortDir, string? status)
    {
        (page, pageSize, sortDir) = ListQuery.Normalize(page, pageSize, sortDir);
        var orderCol = sortBy switch
        {
            "price" or "amount" => @"""Price""",
            "sku" => @"""Sku""",
            "status" => @"""Status""",
            _ => @"""CreatedAt""",
        };
        var dir = sortDir == "asc" ? "ASC" : "DESC";

        await using var conn = (NpgsqlConnection)await OpenAsync();
        var where = @"WHERE o.""TraderId"" = @traderId";
        if (!string.IsNullOrWhiteSpace(status))
            where += @" AND o.""Status"" ILIKE @status";
        if (!string.IsNullOrWhiteSpace(q))
            where += @" AND (o.""Sku"" ILIKE @q OR o.""Id"" ILIKE @q OR COALESCE(o.""PaymentIntentId"",'') ILIKE @q OR COALESCE(o.""CouponCode"",'') ILIKE @q)";

        var total = await conn.ExecuteScalarAsync<int>(
            $@"SELECT COUNT(*)::int FROM propfirm.orders o {where}",
            new { traderId, status, q = q is null ? null : $"%{q}%" });

        var rows = (await conn.QueryAsync<PaymentRow>(
            $@"SELECT o.""Id"" AS Id, o.""Sku"" AS Sku, o.""Price"" AS Price, o.""Status"" AS Status,
                      o.""PaymentIntentId"" AS PaymentIntentId, o.""CreatedAt"" AS CreatedAt, o.""PaidAt"" AS PaidAt,
                      o.""AccountSize"" AS AccountSize, o.""Platform"" AS Platform,
                      o.""ListPrice"" AS ListPrice, o.""CouponCode"" AS CouponCode, o.""DiscountAmount"" AS DiscountAmount
               FROM propfirm.orders o
               {where}
               ORDER BY {orderCol} {dir}
               OFFSET @offset LIMIT @limit",
            new
            {
                traderId,
                status,
                q = q is null ? null : $"%{q}%",
                offset = (page - 1) * pageSize,
                limit = pageSize,
            })).Cast<object>().ToList();

        return PageResult<object>.Create(rows, page, pageSize, total, sortBy, sortDir, q,
            new Dictionary<string, object?> { ["status"] = status });
    }

    public async Task<PageResult<object>> PayoutHistoryAsync(
        string traderId, int page, int pageSize, string? q, string sortBy, string sortDir, string? status)
    {
        (page, pageSize, sortDir) = ListQuery.Normalize(page, pageSize, sortDir);
        var orderCol = sortBy switch
        {
            "amount" => @"""Amount""",
            "status" => @"""Status""",
            "method" => @"""Method""",
            _ => @"""CreatedAt""",
        };
        var dir = sortDir == "asc" ? "ASC" : "DESC";

        await using var conn = (NpgsqlConnection)await OpenAsync();
        var where = @"WHERE p.""TraderId"" = @traderId";
        if (!string.IsNullOrWhiteSpace(status))
            where += @" AND p.""Status"" ILIKE @status";
        if (!string.IsNullOrWhiteSpace(q))
            where += @" AND (p.""Id"" ILIKE @q OR COALESCE(p.""ChallengeId"",'') ILIKE @q OR COALESCE(p.""Method"",'') ILIKE @q OR COALESCE(p.""CryptoAddress"",'') ILIKE @q)";

        var total = await conn.ExecuteScalarAsync<int>(
            $@"SELECT COUNT(*)::int FROM propfirm.payout_requests p {where}",
            new { traderId, status, q = q is null ? null : $"%{q}%" });

        var rows = (await conn.QueryAsync<PayoutRow>(
            $@"SELECT p.""Id"" AS Id, p.""Amount"" AS Amount, p.""Status"" AS Status, p.""ChallengeId"" AS ChallengeId,
                      p.""Method"" AS Method, p.""RewardType"" AS RewardType, p.""CryptoNetwork"" AS CryptoNetwork,
                      p.""CryptoAddress"" AS CryptoAddress, p.""CreatedAt"" AS CreatedAt, p.""DecidedAt"" AS DecidedAt
               FROM propfirm.payout_requests p
               {where}
               ORDER BY {orderCol} {dir}
               OFFSET @offset LIMIT @limit",
            new
            {
                traderId,
                status,
                q = q is null ? null : $"%{q}%",
                offset = (page - 1) * pageSize,
                limit = pageSize,
            })).Cast<object>().ToList();

        return PageResult<object>.Create(rows, page, pageSize, total, sortBy, sortDir, q,
            new Dictionary<string, object?> { ["status"] = status });
    }

    public async Task<PageResult<object>> NotificationHistoryAsync(
        string toEmail, int page, int pageSize, string? q, string sortBy, string sortDir, string? status)
    {
        (page, pageSize, sortDir) = ListQuery.Normalize(page, pageSize, sortDir);
        var orderCol = sortBy switch
        {
            "subject" => @"""Subject""",
            "status" => @"""Status""",
            "toEmail" => @"""ToEmail""",
            _ => @"""CreatedAt""",
        };
        var dir = sortDir == "asc" ? "ASC" : "DESC";

        await using var conn = (NpgsqlConnection)await OpenAsync();
        var where = @"WHERE n.""ToEmail"" ILIKE @toEmail";
        if (!string.IsNullOrWhiteSpace(status))
            where += @" AND n.""Status"" ILIKE @status";
        if (!string.IsNullOrWhiteSpace(q))
            where += @" AND (n.""Subject"" ILIKE @q OR n.""Body"" ILIKE @q OR n.""Id"" ILIKE @q OR COALESCE(n.""DeliveryDetail"",'') ILIKE @q)";

        var total = await conn.ExecuteScalarAsync<int>(
            $@"SELECT COUNT(*)::int FROM propfirm.notification_messages n {where}",
            new { toEmail, status, q = q is null ? null : $"%{q}%" });

        var rows = (await conn.QueryAsync<NotificationRow>(
            $@"SELECT n.""Id"" AS Id, n.""ToEmail"" AS ToEmail, n.""Subject"" AS Subject, n.""Body"" AS Body,
                      n.""Status"" AS Status, n.""DeliveryDetail"" AS DeliveryDetail, n.""CreatedAt"" AS CreatedAt
               FROM propfirm.notification_messages n
               {where}
               ORDER BY {orderCol} {dir}
               OFFSET @offset LIMIT @limit",
            new
            {
                toEmail,
                status,
                q = q is null ? null : $"%{q}%",
                offset = (page - 1) * pageSize,
                limit = pageSize,
            })).Cast<object>().ToList();

        return PageResult<object>.Create(rows, page, pageSize, total, sortBy, sortDir, q,
            new Dictionary<string, object?> { ["status"] = status });
    }

    public sealed class PaymentRow
    {
        public string Id { get; set; } = "";
        public string Sku { get; set; } = "";
        public decimal Price { get; set; }
        public string Status { get; set; } = "";
        public string? PaymentIntentId { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset? PaidAt { get; set; }
        public decimal AccountSize { get; set; }
        public string? Platform { get; set; }
        public decimal? ListPrice { get; set; }
        public string? CouponCode { get; set; }
        public decimal? DiscountAmount { get; set; }
    }

    public sealed class PayoutRow
    {
        public string Id { get; set; } = "";
        public decimal Amount { get; set; }
        public string Status { get; set; } = "";
        public string? ChallengeId { get; set; }
        public string? Method { get; set; }
        public string? RewardType { get; set; }
        public string? CryptoNetwork { get; set; }
        public string? CryptoAddress { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset? DecidedAt { get; set; }
    }

    public sealed class NotificationRow
    {
        public string Id { get; set; } = "";
        public string ToEmail { get; set; } = "";
        public string Subject { get; set; } = "";
        public string Body { get; set; } = "";
        public string Status { get; set; } = "";
        public string? DeliveryDetail { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
    }
}
