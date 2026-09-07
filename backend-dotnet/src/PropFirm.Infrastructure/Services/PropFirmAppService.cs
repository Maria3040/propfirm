using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PropFirm.Domain.Modules.Admin;
using PropFirm.Domain.Modules.Challenges;
using PropFirm.Domain.Modules.Commerce;
using PropFirm.Domain.Modules.Payouts;
using PropFirm.Domain.Modules.Risk;
using PropFirm.Infrastructure.Cache;
using PropFirm.Infrastructure.Mail;
using PropFirm.Infrastructure.Persistence;
using PropFirm.Infrastructure.Security;
using PropFirm.SharedKernel;

namespace PropFirm.Infrastructure.Services;

public sealed class PropFirmAppService(
    PropFirmDbContext db,
    JwtTokenService jwt,
    MailService mail,
    CatalogCache catalogCache,
    HistoryQueries history,
    IpIntelService ipIntel)
{
    public async Task<(object Payload, string Token)> RegisterAsync(string email, string password, string displayName)
    {
        email = email.Trim().ToLowerInvariant();
        if (await db.Traders.AnyAsync(t => t.Email == email))
            throw new DomainError("email already registered");
        var trader = new Trader
        {
            Email = email,
            DisplayName = string.IsNullOrWhiteSpace(displayName) ? email : displayName,
            Role = "Trader",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
        };
        db.Traders.Add(trader);
        db.Wallets.Add(new Wallet { TraderId = trader.Id, AvailableBalance = 0 });
        await db.SaveChangesAsync();
        var token = jwt.Issue(trader.Id, trader.Email, trader.Role, trader.DisplayName);
        return (AuthPayload(trader, token), token);
    }

    public async Task<(object Payload, string Token)> LoginAsync(string email, string password, string? clientIp, string? userAgent)
    {
        var trader = await db.Traders.SingleOrDefaultAsync(t => t.Email == email.Trim().ToLowerInvariant())
                     ?? throw new DomainError("invalid credentials");
        if (!BCrypt.Net.BCrypt.Verify(password, trader.PasswordHash))
            throw new DomainError("invalid credentials");

        var previous = await db.LoginHistories
            .Where(h => h.TraderId == trader.Id)
            .OrderByDescending(h => h.CreatedAt)
            .FirstOrDefaultAsync();

        var intel = await ipIntel.LookupAsync(clientIp);
        db.LoginHistories.Add(new LoginHistory
        {
            TraderId = trader.Id,
            Ip = intel.Ip,
            Country = intel.Country,
            CountryCode = intel.CountryCode,
            City = intel.City,
            Isp = intel.Isp,
            Org = intel.Org,
            UserAgent = userAgent,
            IsVpn = intel.IsVpn,
            IsVps = intel.IsVps,
            ConnectionKind = intel.ConnectionKind,
            ConnectionLabel = intel.Label,
        });

        var prevIp = NormalizeIp(previous?.Ip);
        var nextIp = NormalizeIp(intel.Ip);
        if (!string.IsNullOrEmpty(prevIp) && !string.IsNullOrEmpty(nextIp) &&
            !string.Equals(prevIp, nextIp, StringComparison.OrdinalIgnoreCase))
        {
            await mail.NotifyAsync(db, trader.Email, "New login from a different IP",
                $"Hi {trader.DisplayName},\n\n" +
                $"We noticed a sign-in from a new IP address.\n\n" +
                $"Previous IP: {previous!.Ip}\n" +
                $"New IP: {intel.Ip}\n" +
                $"Connection: {intel.Label}\n" +
                $"Location: {FormatLocation(intel)}\n" +
                $"When: {DateTimeOffset.UtcNow:u}\n\n" +
                "If this was you, you can ignore this email. If not, change your password and contact support.\n\n" +
                "- PropFirm Security");
        }

        await db.SaveChangesAsync();
        var token = jwt.Issue(trader.Id, trader.Email, trader.Role, trader.DisplayName);
        return (AuthPayload(trader, token), token);
    }

    static string NormalizeIp(string? ip) =>
        (ip ?? "").Replace("::ffff:", "", StringComparison.OrdinalIgnoreCase).Trim();

    static string FormatLocation(IpIntel intel)
    {
        var parts = new[] { intel.City, intel.Country }.Where(s => !string.IsNullOrWhiteSpace(s));
        var loc = string.Join(", ", parts);
        return string.IsNullOrWhiteSpace(loc) ? "unknown" : loc;
    }

    public async Task<object?> MeAsync(string userId)
    {
        var t = await db.Traders.FindAsync(userId);
        return t is null
            ? null
            : new
            {
                id = t.Id,
                userId = t.Id,
                email = t.Email,
                displayName = t.DisplayName,
                role = t.Role,
                twoFactorEnabled = t.TwoFactorEnabled,
                preferredLanguage = string.IsNullOrWhiteSpace(t.PreferredLanguage) ? "en" : t.PreferredLanguage,
                verificationStatus = t.VerificationStatus,
                verificationRequestedAt = t.VerificationRequestedAt,
                verificationDecidedAt = t.VerificationDecidedAt,
                verificationAdminComment = t.VerificationAdminComment,
            };
    }

    public async Task<IReadOnlyList<object>> LoginHistoryAsync(string traderId)
    {
        var rows = await db.LoginHistories
            .Where(h => h.TraderId == traderId)
            .OrderByDescending(h => h.CreatedAt)
            .Take(50)
            .ToListAsync();
        return rows.Select(h => (object)new
        {
            id = h.Id,
            ip = h.Ip ?? "unknown",
            country = h.Country,
            countryCode = h.CountryCode,
            city = h.City,
            isp = h.Isp,
            org = h.Org,
            connectionKind = h.ConnectionKind ?? "unknown",
            connectionLabel = string.IsNullOrWhiteSpace(h.ConnectionLabel) || h.ConnectionLabel is "ok" or "unknown"
                ? IpIntelService.LabelFor(h.ConnectionKind ?? "unknown")
                : h.ConnectionLabel,
            isVpn = h.IsVpn,
            isVps = h.IsVps,
            userAgent = h.UserAgent,
            createdAt = h.CreatedAt,
        }).ToList();
    }

    public async Task<object> GetVerificationAsync(string traderId)
    {
        var t = await db.Traders.FindAsync(traderId) ?? throw new DomainError("not found");
        return new
        {
            status = t.VerificationStatus,
            requestedAt = t.VerificationRequestedAt,
            decidedAt = t.VerificationDecidedAt,
            adminComment = t.VerificationAdminComment,
        };
    }

    public async Task<object> StartVerificationAsync(string traderId)
    {
        var t = await db.Traders.FindAsync(traderId) ?? throw new DomainError("not found");
        if (t.VerificationStatus is "Pending" or "Approved")
            return await GetVerificationAsync(traderId);

        t.VerificationStatus = "Pending";
        t.VerificationRequestedAt = DateTimeOffset.UtcNow;
        t.VerificationDecidedAt = null;
        t.VerificationAdminComment = null;
        await mail.NotifyAsync(db, t.Email, "Identity verification received",
            $"Hi {t.DisplayName},\n\nWe received your identity verification request. An admin will review it shortly.\n\n- PropFirm");
        db.AuditEntries.Add(new AuditEntry
        {
            EventType = "VerificationRequested",
            Source = "settings",
            Summary = $"Trader {t.Email} requested identity verification",
        });
        await db.SaveChangesAsync();
        return await GetVerificationAsync(traderId);
    }

    public async Task<object> SetTwoFactorAsync(string traderId, bool enabled)
    {
        var t = await db.Traders.FindAsync(traderId) ?? throw new DomainError("not found");
        t.TwoFactorEnabled = enabled;
        await mail.NotifyAsync(db, t.Email,
            enabled ? "Two-factor authentication enabled" : "Two-factor authentication disabled",
            $"Hi {t.DisplayName},\n\n2FA is now {(enabled ? "enabled" : "disabled")} on your PropFirm account.\n\n- PropFirm");
        await db.SaveChangesAsync();
        return new { twoFactorEnabled = t.TwoFactorEnabled };
    }

    public async Task<object> GetPreferencesAsync(string traderId)
    {
        var t = await db.Traders.FindAsync(traderId) ?? throw new DomainError("not found");
        return new { language = string.IsNullOrWhiteSpace(t.PreferredLanguage) ? "en" : t.PreferredLanguage };
    }

    public async Task<object> UpdatePreferencesAsync(string traderId, string? language)
    {
        var t = await db.Traders.FindAsync(traderId) ?? throw new DomainError("not found");
        var lang = string.IsNullOrWhiteSpace(language) ? "en" : language.Trim().ToLowerInvariant();
        var allowed = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            { "en", "es", "de", "fr", "tr", "ar" };
        if (!allowed.Contains(lang)) throw new DomainError("unsupported language");
        t.PreferredLanguage = lang;
        await db.SaveChangesAsync();
        return new { language = t.PreferredLanguage };
    }

    public async Task<object> SubmitFeatureSuggestionAsync(
        string traderId, string title, string category, string description, string? useCase, string priority)
    {
        if (string.IsNullOrWhiteSpace(title) || string.IsNullOrWhiteSpace(category) ||
            string.IsNullOrWhiteSpace(description) || string.IsNullOrWhiteSpace(priority))
            throw new DomainError("title, category, description, and priority are required");
        var row = new FeatureSuggestion
        {
            TraderId = traderId,
            Title = title.Trim(),
            Category = category.Trim(),
            Description = description.Trim(),
            UseCase = string.IsNullOrWhiteSpace(useCase) ? null : useCase.Trim(),
            Priority = priority.Trim(),
            Status = "Submitted",
        };
        db.FeatureSuggestions.Add(row);
        await db.SaveChangesAsync();
        return new
        {
            id = row.Id,
            title = row.Title,
            category = row.Category,
            priority = row.Priority,
            status = row.Status,
            createdAt = row.CreatedAt,
        };
    }

    public async Task<IReadOnlyList<object>> ListMyFeatureSuggestionsAsync(string traderId)
    {
        var rows = await db.FeatureSuggestions
            .Where(s => s.TraderId == traderId)
            .OrderByDescending(s => s.CreatedAt)
            .Take(50)
            .ToListAsync();
        return rows.Select(s => (object)new
        {
            id = s.Id,
            title = s.Title,
            category = s.Category,
            description = s.Description,
            useCase = s.UseCase,
            priority = s.Priority,
            status = s.Status,
            createdAt = s.CreatedAt,
        }).ToList();
    }

    public async Task<object> AffiliateDashboardAsync(string traderId)
    {
        var t = await db.Traders.FindAsync(traderId) ?? throw new DomainError("not found");
        if (string.IsNullOrWhiteSpace(t.AffiliateCode))
        {
            t.AffiliateCode = $"PF{Random.Shared.Next(100000, 999999):X}";
            await db.SaveChangesAsync();
        }

        // Demo affiliate payload (stable shape for the UI); code is trader-specific.
        return new
        {
            code = t.AffiliateCode,
            referralUrl = $"http://localhost:3100/register?referral_code={t.AffiliateCode}",
            stats = new { totalReferrals = 12, totalPaidOut = 1840.5m, availableBalance = 326.75m },
            referrals = new object[]
            {
                new { id = "r1", email = "m***@gmail.com", joinedAt = "2026-08-28", status = "paid", commission = 145m },
                new { id = "r2", email = "a***@outlook.com", joinedAt = "2026-08-21", status = "qualified", commission = 89.5m },
                new { id = "r3", email = "j***@yahoo.com", joinedAt = "2026-08-12", status = "paid", commission = 210m },
                new { id = "r4", email = "s***@icloud.com", joinedAt = "2026-07-30", status = "pending", commission = 0m },
                new { id = "r5", email = "t***@proton.me", joinedAt = "2026-07-18", status = "paid", commission = 175m },
            },
            rewards = new object[]
            {
                new { id = "rw1", title = "Starter", description = "Earn your first 5 qualified referrals.", progress = 5m, target = 5m, status = "claimed" },
                new { id = "rw2", title = "Growth", description = "Reach $1,000 in lifetime commissions.", progress = 1840.5m, target = 1000m, status = "claimed" },
                new { id = "rw3", title = "Pro Partner", description = "Refer 25 traders who purchase a challenge.", progress = 12m, target = 25m, status = "in_progress" },
                new { id = "rw4", title = "Elite", description = "Unlock higher commission tiers at 50 referrals.", progress = 12m, target = 50m, status = "locked" },
            },
            earningsSeries = BuildAffiliateEarningsSeries(),
        };
    }

    static object[] BuildAffiliateEarningsSeries()
    {
        var daily = new[] { 0m, 45m, 0m, 120m, 80m, 0m, 35m, 210m, 0m, 55m, 145m, 89.5m, 0m, 0m, 175m };
        var cum = 0m;
        var list = new List<object>();
        for (var i = 0; i < daily.Length; i++)
        {
            cum += daily[i];
            var d = DateTime.UtcNow.Date.AddDays(-(daily.Length - 1 - i));
            list.Add(new { date = d.ToString("yyyy-MM-dd"), amount = daily[i], cumulative = cum });
        }
        return list.ToArray();
    }

    public async Task<object> AdminListVerificationsAsync()
    {
        var rows = await db.Traders
            .Where(t => t.VerificationStatus != "None")
            .OrderByDescending(t => t.VerificationRequestedAt)
            .Take(100)
            .ToListAsync();
        return new
        {
            items = rows.Select(t => new
            {
                traderId = t.Id,
                email = t.Email,
                displayName = t.DisplayName,
                status = t.VerificationStatus,
                requestedAt = t.VerificationRequestedAt,
                decidedAt = t.VerificationDecidedAt,
                adminComment = t.VerificationAdminComment,
            }).ToList(),
        };
    }

    public async Task<object> AdminDecideVerificationAsync(string traderId, bool approve, string? comment)
    {
        var t = await db.Traders.FindAsync(traderId) ?? throw new DomainError("not found");
        if (t.VerificationStatus != "Pending")
            throw new DomainError("verification is not pending");
        t.VerificationStatus = approve ? "Approved" : "Rejected";
        t.VerificationDecidedAt = DateTimeOffset.UtcNow;
        t.VerificationAdminComment = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim();
        var subject = approve ? "Identity verification approved" : "Identity verification rejected";
        var body =
            $"Hi {t.DisplayName},\n\nYour identity verification was {t.VerificationStatus.ToLowerInvariant()}.\n" +
            (string.IsNullOrWhiteSpace(t.VerificationAdminComment)
                ? ""
                : $"\nAdmin comment:\n{t.VerificationAdminComment}\n") +
            "\n- PropFirm Compliance";
        await mail.NotifyAsync(db, t.Email, subject, body);
        db.AuditEntries.Add(new AuditEntry
        {
            EventType = approve ? "VerificationApproved" : "VerificationRejected",
            Source = "admin",
            Summary = $"{t.Email} verification {t.VerificationStatus}",
            PayloadJson = JsonSerializer.Serialize(new { traderId, comment = t.VerificationAdminComment }),
        });
        await db.SaveChangesAsync();
        return await GetVerificationAsync(traderId);
    }

    public async Task<object> AdminCommentVerificationAsync(string traderId, string? subject, string message)
    {
        if (string.IsNullOrWhiteSpace(message)) throw new DomainError("message is required");
        var t = await db.Traders.FindAsync(traderId) ?? throw new DomainError("not found");
        var subj = string.IsNullOrWhiteSpace(subject)
            ? $"Regarding your identity verification"
            : subject.Trim();
        await mail.NotifyAsync(db, t.Email, subj,
            $"Hi {t.DisplayName},\n\n{message.Trim()}\n\n- PropFirm Compliance");
        return new { ok = true, toEmail = t.Email, subject = subj };
    }

    public async Task<object> ChangePasswordAsync(string traderId, string currentPassword, string newPassword)
    {
        if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 8)
            throw new DomainError("new password must be at least 8 characters");
        var t = await db.Traders.FindAsync(traderId) ?? throw new DomainError("not found");
        if (!BCrypt.Net.BCrypt.Verify(currentPassword, t.PasswordHash))
            throw new DomainError("current password is incorrect");
        t.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        await db.SaveChangesAsync();
        return new { ok = true };
    }

    public async Task<IReadOnlyList<object>> ListProductsAsync(string? phaseFamily = null, string? variant = null)
    {
        var key = CatalogCache.ListKey(phaseFamily, variant);
        var cachedRows = await catalogCache.GetAsync<List<JsonElement>>(key);
        if (cachedRows is not null)
            return cachedRows.Cast<object>().ToList();

        var q = db.Products.Where(p => p.IsActive);
        if (!string.IsNullOrWhiteSpace(phaseFamily))
            q = q.Where(p => p.PhaseFamily == phaseFamily);
        if (!string.IsNullOrWhiteSpace(variant))
            q = q.Where(p => p.Variant == variant);

        var rows = await q.OrderBy(p => p.AccountSize).ThenBy(p => p.Sku).ToListAsync();
        var mapped = rows.Select(MapProduct).ToList();
        await catalogCache.SetAsync(key, mapped);
        return mapped;
    }

    public async Task<object?> GetProductAsync(string productId)
    {
        var key = CatalogCache.ItemKey(productId);
        var cached = await catalogCache.GetAsync<JsonElement>(key);
        if (cached.ValueKind is not JsonValueKind.Undefined and not JsonValueKind.Null)
            return cached;

        var row = await db.Products.FirstOrDefaultAsync(p => p.Id == productId && p.IsActive);
        if (row is null) return null;
        var mapped = MapProduct(row);
        await catalogCache.SetAsync(key, mapped);
        return mapped;
    }

    public object ValidateCoupon(string code, decimal subtotal)
    {
        var coupon = Pricing.LookupCoupon(code) ?? throw new DomainError("coupon not found");
        var quote = Pricing.ApplyCoupon(coupon, subtotal);
        return new
        {
            code = quote.Code,
            kind = quote.Kind,
            value = quote.Value,
            discountAmount = quote.DiscountAmount,
            finalTotal = quote.FinalTotal,
            message = quote.Message,
        };
    }

    public async Task<object> CreateOrderAsync(
        string traderId,
        string productId,
        bool addonSwapFree,
        string? platform,
        int quantity,
        string? couponCode)
    {
        var product = await db.Products.FindAsync(productId) ?? throw new DomainError("product not found");
        if (!product.IsActive) throw new DomainError("product inactive");
        var (total, plat) = Pricing.PriceOrder(product.Price, addonSwapFree, platform, quantity);
        if (!string.IsNullOrWhiteSpace(couponCode))
        {
            var coupon = Pricing.LookupCoupon(couponCode) ?? throw new DomainError("coupon not found");
            total = Pricing.ApplyCoupon(coupon, total).FinalTotal;
        }

        var order = new Order
        {
            TraderId = traderId,
            ProductId = product.Id,
            Sku = product.Sku,
            Price = total,
            AccountSize = product.AccountSize,
            Phases = product.Phases,
            ProfitTargetPct = product.ProfitTargetPct,
            Phase1TargetPct = product.Phase1TargetPct,
            Phase2TargetPct = product.Phase2TargetPct,
            DailyLossPct = product.DailyLossPct,
            MaxLossPct = product.MaxLossPct,
            MinTradingDays = product.MinTradingDays,
            MaxTradingDays = product.MaxTradingDays,
            AddonSwapFree = addonSwapFree,
            Platform = plat,
            Status = "Pending",
            PaymentIntentId = $"pi_{Guid.NewGuid():N}"[..24],
        };
        db.Orders.Add(order);
        await db.SaveChangesAsync();
        return new { orderId = order.Id, status = order.Status, price = order.Price, paymentIntentId = order.PaymentIntentId };
    }

    public async Task<object> EligiblePayoutsAsync(string traderId)
    {
        var wallet = await db.Wallets.FindAsync(traderId);
        var bal = wallet?.AvailableBalance ?? 0m;
        var funded = await db.Challenges
            .Where(c => c.TraderId == traderId && c.Status == ChallengeStatuses.Funded)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync();

        var accounts = new List<object>();
        foreach (var c in funded)
        {
            var acc = await db.TradingAccounts.FirstOrDefaultAsync(a => a.ChallengeId == c.Id);
            var equity = acc?.Equity ?? c.AccountSize;
            var product = await db.Products.FindAsync(c.ProductId);
            var split = product?.ProfitSplitPct ?? c.ProfitSplitPct;
            var cap = ProfitShare.ProfitShareCap(equity, c.AccountSize, split);
            var already = await db.PayoutRequests
                .Where(p => p.ChallengeId == c.Id && (p.Status == "Pending" || p.Status == "Approved"))
                .SumAsync(p => (decimal?)p.Amount) ?? 0;
            var shareAvailable = ProfitShare.RemainingWithdrawable(cap, already);
            // Withdrawable is profit-share remaining (wallet is topped up on request if needed).
            var withdrawable = shareAvailable;
            accounts.Add(new
            {
                id = c.Id,
                sku = c.Sku,
                status = c.Status,
                accountSize = c.AccountSize,
                equity,
                login = acc?.Login,
                platform = acc?.Platform,
                profitSplitPct = split,
                grossProfit = Math.Round(Math.Max(0m, equity - c.AccountSize), 2),
                profitShareCap = cap,
                alreadyRequested = already,
                profitShareAvailable = shareAvailable,
                withdrawable,
            });
        }

        return new { availableBalance = bal, accounts };
    }

    public async Task<object> ConfirmOrderAsync(string traderId, string orderId)
    {
        var order = await db.Orders.FindAsync(orderId) ?? throw new DomainError("not found");
        if (order.TraderId != traderId) throw new DomainError("forbidden");
        if (order.Status == "Paid")
        {
            var existing = await db.Challenges.FirstOrDefaultAsync(c => c.OrderId == order.Id);
            return new { orderId = order.Id, challengeId = existing?.Id, status = order.Status };
        }

        order.Status = "Paid";
        order.PaidAt = DateTimeOffset.UtcNow;
        var challenge = await ProvisionChallengeAsync(order);
        var trader = await db.Traders.FindAsync(traderId);
        if (trader is not null)
        {
            await mail.NotifyAsync(db, trader.Email, "Challenge purchased — invoice & credentials",
                $"Order {order.Id} paid (${order.Price:F2}). Challenge {challenge.Id} ({order.Sku}) is ready.");
        }

        db.AuditEntries.Add(new AuditEntry
        {
            EventType = "OrderPaid",
            Source = "commerce",
            Summary = $"Order {order.Id} paid",
            PayloadJson = JsonSerializer.Serialize(new { orderId = order.Id, challengeId = challenge.Id }),
        });
        await db.SaveChangesAsync();
        return new { orderId = order.Id, challengeId = challenge.Id, status = order.Status };
    }

    public async Task<IReadOnlyList<object>> ListChallengesAsync(string userId, string role)
    {
        var q = db.Challenges.AsQueryable();
        if (role != "Admin") q = q.Where(c => c.TraderId == userId);
        var rows = await q.OrderByDescending(c => c.CreatedAt).Take(100).ToListAsync();
        var list = new List<object>();
        foreach (var c in rows)
        {
            var acc = await db.TradingAccounts.FirstOrDefaultAsync(a => a.ChallengeId == c.Id);
            list.Add(MapChallenge(c, acc));
        }

        var joinsQ = db.CompetitionJoins.AsQueryable();
        if (role != "Admin") joinsQ = joinsQ.Where(j => j.TraderId == userId);
        var joins = await joinsQ.OrderByDescending(j => j.CreatedAt).Take(50).ToListAsync();
        foreach (var j in joins)
            list.Add(MapCompetitionAccount(j));

        return list;
    }

    public async Task<object> GetChallengeAsync(string userId, string role, string challengeId)
    {
        var join = await db.CompetitionJoins.FindAsync(challengeId);
        if (join is not null)
        {
            if (role != "Admin" && join.TraderId != userId) throw new DomainError("forbidden");
            return MapCompetitionDetail(join);
        }

        var c = await FindChallengeAsync(challengeId) ?? throw new DomainError("not found");
        if (role != "Admin" && c.TraderId != userId) throw new DomainError("forbidden");
        var acc = await db.TradingAccounts.FirstOrDefaultAsync(a => a.ChallengeId == c.Id);
        var trades = await db.Trades.Where(t => t.ChallengeId == c.Id).OrderBy(t => t.CreatedAt).Take(200).ToListAsync();
        return MapChallengeDetail(c, acc, trades);
    }

    public async Task<object> ArchiveChallengeAsync(string userId, string role, string challengeId)
    {
        var c = await FindChallengeAsync(challengeId) ?? throw new DomainError("not found");
        if (role != "Admin" && c.TraderId != userId) throw new DomainError("forbidden");
        if (c.Status is ChallengeStatuses.Closed && c.Archived)
            return new { ok = true, id = c.Id, status = c.Status, alreadyArchived = true };

        c.PreviousStatus = c.Status;
        c.ArchiveUndoToken = Guid.NewGuid().ToString("N");
        c.Status = ChallengeStatuses.Closed;
        c.Archived = true;
        var acc = await db.TradingAccounts.FirstOrDefaultAsync(a => a.ChallengeId == c.Id);
        if (acc is not null) acc.Locked = true;

        var trader = await db.Traders.FindAsync(c.TraderId);
        if (trader is not null)
        {
            var login = acc?.Login ?? c.Id[..8];
            var undoUrl = $"http://localhost:3100/accounts/restore?token={c.ArchiveUndoToken}";
            await mail.NotifyAsync(db, trader.Email, $"Account archived — #{login}",
                $"Your PropFirm account #{login} ({c.Sku}) was archived and trading is disabled.\n\n" +
                $"To undo this within a few days, open:\n{undoUrl}\n\n" +
                "If you meant to archive it, you can ignore this email.");
        }

        await db.SaveChangesAsync();
        return new { ok = true, id = c.Id, status = c.Status, emailSent = trader is not null };
    }

    public async Task<object> RestoreArchivedChallengeAsync(string? userId, string? role, string token)
    {
        if (string.IsNullOrWhiteSpace(token)) throw new DomainError("invalid token");
        var c = await db.Challenges.FirstOrDefaultAsync(x => x.ArchiveUndoToken == token)
                ?? throw new DomainError("not found");
        if (!string.IsNullOrEmpty(userId) && role != "Admin" && c.TraderId != userId)
            throw new DomainError("forbidden");

        var restore = string.IsNullOrWhiteSpace(c.PreviousStatus)
            ? (c.Phases <= 1 || c.CurrentPhase >= c.Phases ? ChallengeStatuses.Funded : ChallengeStatuses.Active)
            : c.PreviousStatus!;
        if (restore is ChallengeStatuses.Failed or ChallengeStatuses.Closed or ChallengeStatuses.Passed)
            restore = ChallengeStatuses.Active;

        c.Status = restore;
        c.Archived = false;
        c.ArchiveUndoToken = null;
        c.PreviousStatus = null;
        c.FailReason = null;
        var acc = await db.TradingAccounts.FirstOrDefaultAsync(a => a.ChallengeId == c.Id);
        if (acc is not null) acc.Locked = false;

        var trader = await db.Traders.FindAsync(c.TraderId);
        if (trader is not null)
        {
            await mail.NotifyAsync(db, trader.Email, "Account restored",
                $"Your account ({c.Sku}) was restored from archive. Status is now {c.Status}.");
        }

        await db.SaveChangesAsync();
        return new { ok = true, id = c.Id, status = c.Status };
    }

    public async Task<object> SimulateTradeAsync(
        string userId,
        string role,
        string challengeId,
        string symbol,
        string side,
        decimal lots,
        decimal pnl,
        string? tradeDay = null)
    {
        var c = await FindChallengeAsync(challengeId) ?? throw new DomainError("not found");
        if (role != "Admin" && c.TraderId != userId) throw new DomainError("forbidden");
        if (c.Status is ChallengeStatuses.Failed or ChallengeStatuses.Closed or ChallengeStatuses.Passed)
            throw new DomainError("challenge locked");
        if (c.Status is not (ChallengeStatuses.Active or ChallengeStatuses.Funded))
            throw new DomainError("challenge not active");

        var acc = await db.TradingAccounts.FirstOrDefaultAsync(a => a.ChallengeId == c.Id)
                  ?? throw new DomainError("account missing");
        if (acc.Locked) throw new DomainError("account locked");

        var tradeAt = DateTimeOffset.UtcNow;
        if (!string.IsNullOrWhiteSpace(tradeDay))
        {
            if (!DateOnly.TryParse(tradeDay, out var d))
                throw new DomainError("invalid tradeDay");
            tradeAt = new DateTimeOffset(d.ToDateTime(new TimeOnly(15, 0), DateTimeKind.Utc));
        }

        acc.Equity += pnl;
        if (acc.Equity > acc.HighWaterMark) acc.HighWaterMark = acc.Equity;
        db.Trades.Add(new Trade
        {
            AccountId = acc.Id,
            ChallengeId = c.Id,
            Symbol = symbol,
            Side = side,
            Lots = lots,
            Pnl = pnl,
            EquityAfter = acc.Equity,
            CreatedAt = tradeAt,
        });

        var tradeDate = tradeAt.UtcDateTime.Date;
        var priorTrades = await db.Trades.Where(t => t.ChallengeId == c.Id).ToListAsync();
        // Include the staged trade from the change tracker.
        var dayPnl = priorTrades.Where(t => t.CreatedAt.UtcDateTime.Date == tradeDate).Sum(t => t.Pnl) + pnl;
        var daySet = priorTrades.Select(t => t.CreatedAt.UtcDateTime.Date).ToHashSet();
        daySet.Add(tradeDate);
        var tradingDays = daySet.Count;

        var targetPct = c.Status == ChallengeStatuses.Funded
            ? c.ProfitTargetPct
            : ChallengeProgression.TargetPctForPhase(
                c.CurrentPhase, c.Phase1TargetPct, c.Phase2TargetPct, c.ProfitTargetPct);

        var risk = RiskRules.Evaluate(new RiskInput(
            acc.StartingBalance,
            acc.Equity,
            dayPnl,
            tradingDays,
            targetPct,
            c.DailyLossPct,
            c.MaxLossPct,
            c.MinTradingDays,
            c.MaxTradingDays));

        if (risk.Kind == "breach")
        {
            c.Status = ChallengeStatuses.Failed;
            c.FailReason = risk.Reason;
            acc.Locked = true;
            var trader = await db.Traders.FindAsync(c.TraderId);
            if (trader is not null)
            {
                await mail.NotifyAsync(db, trader.Email, $"Account breached — {risk.Rule}",
                    $"Challenge {c.Id} ({c.Sku}) breached: {risk.Reason}\nTrading is disabled for login {acc.Login}.");
            }
        }
        else if (risk.Kind == "target" && c.Status == ChallengeStatuses.Active)
        {
            if (c.CurrentPhase >= c.Phases)
            {
                // Keep passed phase account; provision a separate Funded account.
                var funded = await ProvisionContinuationAsync(c, Math.Max(1, c.Phases), ChallengeStatuses.Funded);
                var fundedAcc = await db.TradingAccounts.FirstAsync(a => a.ChallengeId == funded.Id);
                var wallet = await db.Wallets.FindAsync(c.TraderId);
                if (wallet is not null)
                {
                    wallet.AvailableBalance += 100m;
                    wallet.UpdatedAt = DateTimeOffset.UtcNow;
                }
                var trader = await db.Traders.FindAsync(c.TraderId);
                if (trader is not null)
                {
                    await mail.NotifyAsync(db, trader.Email, "You are funded!",
                        $"Phase {c.CurrentPhase} passed on #{acc.Login}. New funded account #{fundedAcc.Login}.\n" +
                        $"Login {fundedAcc.Login} / {fundedAcc.Password} @ {fundedAcc.Server}.\n" +
                        "Live rules: daily loss and max drawdown still apply. No profit target.");
                }
            }
            else
            {
                var passedPhase = c.CurrentPhase;
                var nextPhase = ChallengeProgression.NextPhase(c.CurrentPhase, c.Phases);
                var next = await ProvisionContinuationAsync(c, nextPhase, ChallengeStatuses.Active);
                var nextAcc = await db.TradingAccounts.FirstAsync(a => a.ChallengeId == next.Id);
                var trader = await db.Traders.FindAsync(c.TraderId);
                if (trader is not null)
                {
                    await mail.NotifyAsync(db, trader.Email, $"Phase {passedPhase} passed — phase {nextPhase} credentials",
                        $"#{acc.Login} is now Passed (phase {passedPhase}).\n" +
                        $"New phase {nextPhase} account #{nextAcc.Login}.\n" +
                        $"Platform: {nextAcc.Platform}\nLogin: {nextAcc.Login}\nPassword: {nextAcc.Password}\nServer: {nextAcc.Server}\n" +
                        $"Account size ${next.AccountSize:F2}. Profit target: {next.ProfitTargetPct}%.");
                }
            }
        }
        // Target hit while already Funded: leave status as Funded (payout eligibility via profit share).

        await db.SaveChangesAsync();
        acc = await db.TradingAccounts.FirstAsync(a => a.ChallengeId == c.Id);
        var trades = await db.Trades.Where(t => t.ChallengeId == c.Id).OrderBy(t => t.CreatedAt).Take(200).ToListAsync();
        return new
        {
            challenge = MapChallengeDetail(c, acc, trades),
            equity = acc.Equity,
            challengeStatus = c.Status,
            failReason = c.FailReason,
            risk = new { risk.Kind, risk.Rule, risk.Reason },
            tradingDays,
            dayPnl,
        };
    }

    /// <summary>
    /// Marks the finished phase account as Passed and provisions a new challenge + trading account
    /// for the next phase (or Funded). Each phase is its own accounts-list row.
    /// </summary>
    private async Task<Challenge> ProvisionContinuationAsync(Challenge from, int phase, string status)
    {
        var oldAcc = await db.TradingAccounts.FirstOrDefaultAsync(a => a.ChallengeId == from.Id);
        if (oldAcc is not null) oldAcc.Locked = true;
        from.Status = ChallengeStatuses.Passed;

        var targetPct = status == ChallengeStatuses.Funded
            ? 0m
            : ChallengeProgression.TargetPctForPhase(
                phase, from.Phase1TargetPct, from.Phase2TargetPct, from.ProfitTargetPct);

        var next = new Challenge
        {
            TraderId = from.TraderId,
            OrderId = from.OrderId,
            ProductId = from.ProductId,
            Sku = from.Sku,
            AccountSize = from.AccountSize,
            Status = status,
            CurrentPhase = phase,
            Phases = from.Phases,
            ProfitTargetPct = targetPct,
            Phase1TargetPct = from.Phase1TargetPct,
            Phase2TargetPct = from.Phase2TargetPct,
            DailyLossPct = from.DailyLossPct,
            MaxLossPct = from.MaxLossPct,
            MinTradingDays = from.MinTradingDays,
            MaxTradingDays = from.MaxTradingDays,
            ProfitSplitPct = from.ProfitSplitPct,
            SourceChallengeId = from.Id,
        };
        db.Challenges.Add(next);

        var login = $"mt{Random.Shared.Next(1000000, 9999999)}";
        var password = $"Pf{Random.Shared.Next(100000, 999999)}!";
        db.TradingAccounts.Add(new TradingAccount
        {
            ChallengeId = next.Id,
            TraderId = from.TraderId,
            Login = login,
            Password = password,
            Server = "PropFirm-Demo",
            Platform = oldAcc?.Platform ?? "mt5",
            StartingBalance = from.AccountSize,
            Equity = from.AccountSize,
            HighWaterMark = from.AccountSize,
            Locked = false,
        });
        return next;
    }

    async Task<Challenge?> FindChallengeAsync(string idOrLogin)
    {
        var key = idOrLogin.Trim().TrimStart('#');
        var byId = await db.Challenges.FindAsync(idOrLogin) ?? await db.Challenges.FindAsync(key);
        if (byId is not null) return byId;
        var acc = await db.TradingAccounts.FirstOrDefaultAsync(a =>
            a.Login == key || a.Login == idOrLogin || a.Login == $"mt5{key}" || a.Login == $"mt{key}");
        if (acc is null) return null;
        return await db.Challenges.FindAsync(acc.ChallengeId);
    }

    public async Task<object> JoinedCompetitionsAsync(string traderId)
    {
        var ids = await db.CompetitionJoins.Where(j => j.TraderId == traderId)
            .Select(j => j.CompetitionId).ToListAsync();
        return new { competitionIds = ids };
    }

    public async Task<object> ListCompetitionParticipantsAsync(string competitionId)
    {
        var joins = await db.CompetitionJoins
            .Where(j => j.CompetitionId == competitionId)
            .OrderBy(j => j.CreatedAt)
            .Take(500)
            .ToListAsync();
        var traderIds = joins.Select(j => j.TraderId).Distinct().ToList();
        var traders = await db.Traders.Where(t => traderIds.Contains(t.Id)).ToListAsync();
        var byId = traders.ToDictionary(t => t.Id);

        var participants = joins.Select((j, i) =>
        {
            byId.TryGetValue(j.TraderId, out var t);
            var name = string.IsNullOrWhiteSpace(t?.DisplayName)
                ? (t?.Email?.Split('@').FirstOrDefault() ?? $"Trader {(i + 1)}")
                : t!.DisplayName;
            return new
            {
                rank = i + 1,
                traderId = j.TraderId,
                name,
                email = t?.Email,
                login = j.Login,
                platform = j.Platform,
                accountSize = j.AccountSize > 0 ? j.AccountSize : 100_000m,
                joinedAt = j.CreatedAt,
            };
        }).ToList();

        return new { competitionId, count = participants.Count, participants };
    }

    public async Task<object> JoinCompetitionAsync(string traderId, string competitionId, string? title)
    {
        var existing = await db.CompetitionJoins.FirstOrDefaultAsync(j =>
            j.TraderId == traderId && j.CompetitionId == competitionId);
        if (existing is not null)
            return new { joined = true, alreadyJoined = true, emailSent = false };

        var login = $"comp{Random.Shared.Next(100000, 999999)}";
        var password = $"Cmp{Random.Shared.Next(100000, 999999)}!";
        const decimal size = 100_000m;
        var row = new CompetitionJoin
        {
            TraderId = traderId,
            CompetitionId = competitionId,
            CompetitionTitle = title,
            Login = login,
            Password = password,
            Platform = "matchtrader",
            Server = "PropFirm-Comp",
            AccountSize = size,
            Equity = size,
        };
        db.CompetitionJoins.Add(row);

        var trader = await db.Traders.FindAsync(traderId) ?? throw new DomainError("not found");
        await mail.NotifyAsync(db, trader.Email, "Competition joined — credentials",
            $"You joined: {title ?? competitionId} (free — no payment).\n\n" +
            $"Platform: {row.Platform}\nLogin: {row.Login}\nPassword: {row.Password}\nServer: {row.Server}\n\n" +
            "Use Credentials on your dashboard for competition accounts.");
        await db.SaveChangesAsync();
        return new { joined = true, alreadyJoined = false, emailSent = true, login, platform = row.Platform };
    }

    public Task<PageResult<object>> PaymentHistoryAsync(
        string traderId, int page, int pageSize, string? q, string sortBy, string sortDir, string? status) =>
        history.PaymentHistoryAsync(traderId, page, pageSize, q, sortBy, sortDir, status);

    public Task<PageResult<object>> PayoutHistoryAsync(
        string traderId, int page, int pageSize, string? q, string sortBy, string sortDir, string? status) =>
        history.PayoutHistoryAsync(traderId, page, pageSize, q, sortBy, sortDir, status);

    public async Task<PageResult<object>> NotificationHistoryAsync(
        string traderId, int page, int pageSize, string? q, string sortBy, string sortDir, string? status)
    {
        var trader = await db.Traders.FindAsync(traderId) ?? throw new DomainError("not found");
        return await history.NotificationHistoryAsync(trader.Email, page, pageSize, q, sortBy, sortDir, status);
    }

    static void RotateCredentials(TradingAccount acc)
    {
        acc.Login = $"mt5{Random.Shared.Next(100000, 999999)}";
        acc.Password = $"Pf{Random.Shared.Next(100000, 999999)}!";
        acc.Server = "PropFirm-Demo";
    }

    public async Task<object> WalletAsync(string traderId)
    {
        var w = await db.Wallets.FindAsync(traderId);
        return new { traderId, availableBalance = w?.AvailableBalance ?? 0m };
    }

    public async Task<object> RequestPayoutAsync(
        string traderId,
        decimal amount,
        string challengeId,
        string? method,
        string? cryptoNetwork,
        string? cryptoAddress)
    {
        if (amount <= 0) throw new DomainError("invalid amount");
        var c = await db.Challenges.FindAsync(challengeId) ?? throw new DomainError("invalid challenge");
        if (c.TraderId != traderId || c.Status != ChallengeStatuses.Funded)
            throw new DomainError("invalid challenge");
        var acc = await db.TradingAccounts.FirstAsync(a => a.ChallengeId == c.Id);
        var cap = ProfitShare.ProfitShareCap(acc.Equity, c.AccountSize, c.ProfitSplitPct);
        var already = await db.PayoutRequests
            .Where(p => p.ChallengeId == c.Id && (p.Status == "Pending" || p.Status == "Approved"))
            .SumAsync(p => (decimal?)p.Amount) ?? 0;
        var available = ProfitShare.RemainingWithdrawable(cap, already);
        if (amount > available) throw new DomainError($"amount exceeds profit share for this account ({available:F2})");
        var wallet = await db.Wallets.FindAsync(traderId) ?? throw new DomainError("wallet missing");
        // Credit wallet from profit share so reward requests are not blocked by demo wallet balance.
        if (amount > wallet.AvailableBalance)
        {
            wallet.AvailableBalance = amount;
            wallet.UpdatedAt = DateTimeOffset.UtcNow;
        }
        if (string.Equals(method, "crypto", StringComparison.OrdinalIgnoreCase) &&
            (string.IsNullOrWhiteSpace(cryptoNetwork) || string.IsNullOrWhiteSpace(cryptoAddress)))
            throw new DomainError("cryptoNetwork and cryptoAddress required");

        var row = new PayoutRequest
        {
            TraderId = traderId,
            Amount = amount,
            Status = "Pending",
            ChallengeId = c.Id,
            Method = method ?? "crypto",
            RewardType = "Profit share",
            CryptoNetwork = cryptoNetwork,
            CryptoAddress = cryptoAddress,
        };
        db.PayoutRequests.Add(row);
        await db.SaveChangesAsync();
        return new { id = row.Id, status = row.Status, amount = row.Amount, challengeId = row.ChallengeId };
    }

    public async Task<object> AdminOverviewAsync()
    {
        return new
        {
            traders = await db.Traders.CountAsync(),
            challengesActive = await db.Challenges.CountAsync(c => c.Status == ChallengeStatuses.Active),
            challengesFunded = await db.Challenges.CountAsync(c => c.Status == ChallengeStatuses.Funded),
            challengesFailed = await db.Challenges.CountAsync(c => c.Status == ChallengeStatuses.Failed),
            payoutsPending = await db.PayoutRequests.CountAsync(p => p.Status == "Pending"),
            payoutsNeedsVpsInvoice = await db.PayoutRequests.CountAsync(p => p.Status == "NeedsVpsInvoice"),
            ordersPaid = await db.Orders.CountAsync(o => o.Status == "Paid"),
            productsActive = await db.Products.CountAsync(p => p.IsActive),
            generatedAt = DateTimeOffset.UtcNow,
        };
    }

    public async Task<PageResult<object>> AdminTradersAsync(int page, int pageSize, string? q, string sortBy, string sortDir, string? role)
    {
        (page, pageSize, sortDir) = ListQuery.Normalize(page, pageSize, sortDir);
        var query = db.Traders.AsQueryable();
        var filters = new Dictionary<string, object?>();
        if (!string.IsNullOrWhiteSpace(role))
        {
            query = query.Where(t => t.Role == role);
            filters["role"] = role;
        }
        if (!string.IsNullOrWhiteSpace(q))
        {
            var like = q.Trim();
            query = query.Where(t => t.Email.Contains(like) || t.DisplayName.Contains(like));
        }

        query = (sortBy, sortDir) switch
        {
            ("email", "asc") => query.OrderBy(t => t.Email),
            ("email", _) => query.OrderByDescending(t => t.Email),
            ("role", "asc") => query.OrderBy(t => t.Role),
            ("role", _) => query.OrderByDescending(t => t.Role),
            ("displayName", "asc") => query.OrderBy(t => t.DisplayName),
            ("displayName", _) => query.OrderByDescending(t => t.DisplayName),
            (_, "asc") => query.OrderBy(t => t.CreatedAt),
            _ => query.OrderByDescending(t => t.CreatedAt),
        };

        var total = await query.CountAsync();
        var rows = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        var items = new List<object>();
        foreach (var t in rows)
        {
            var wallet = await db.Wallets.FindAsync(t.Id);
            var count = await db.Challenges.CountAsync(c => c.TraderId == t.Id);
            items.Add(new
            {
                id = t.Id,
                email = t.Email,
                displayName = t.DisplayName,
                role = t.Role,
                createdAt = t.CreatedAt,
                walletBalance = wallet?.AvailableBalance ?? 0m,
                challengeCount = count,
            });
        }

        return PageResult<object>.Create(items, page, pageSize, total, sortBy, sortDir, q, filters);
    }

    public async Task<PageResult<object>> AdminPayoutsAsync(int page, int pageSize, string? q, string sortBy, string sortDir, string? status)
    {
        (page, pageSize, sortDir) = ListQuery.Normalize(page, pageSize, sortDir);
        var query = db.PayoutRequests.AsQueryable();
        var filters = new Dictionary<string, object?>();
        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(p => p.Status == status);
            filters["status"] = status;
        }
        if (!string.IsNullOrWhiteSpace(q))
        {
            var like = q.Trim();
            var traderIds = await db.Traders.Where(t => t.Email.Contains(like)).Select(t => t.Id).ToListAsync();
            query = query.Where(p => p.Id.Contains(like) || (p.CryptoAddress != null && p.CryptoAddress.Contains(like)) || traderIds.Contains(p.TraderId));
        }

        query = sortDir == "asc"
            ? query.OrderBy(p => p.CreatedAt)
            : query.OrderByDescending(p => p.CreatedAt);

        var total = await query.CountAsync();
        var rows = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        var items = new List<object>();
        foreach (var r in rows) items.Add(await MapPayoutAsync(r));
        return PageResult<object>.Create(items, page, pageSize, total, sortBy, sortDir, q, filters);
    }

    public async Task<PageResult<object>> AdminChallengesAsync(int page, int pageSize, string? q, string sortBy, string sortDir, string? status)
    {
        (page, pageSize, sortDir) = ListQuery.Normalize(page, pageSize, sortDir);
        var query = db.Challenges.AsQueryable();
        var filters = new Dictionary<string, object?>();
        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(c => c.Status == status);
            filters["status"] = status;
        }
        if (!string.IsNullOrWhiteSpace(q))
        {
            var like = q.Trim();
            var traderIds = await db.Traders
                .Where(t => t.Email.Contains(like) || t.DisplayName.Contains(like))
                .Select(t => t.Id)
                .ToListAsync();
            query = query.Where(c =>
                c.Id.Contains(like) ||
                c.Sku.Contains(like) ||
                traderIds.Contains(c.TraderId));
        }

        query = (sortBy, sortDir) switch
        {
            ("sku", "asc") => query.OrderBy(c => c.Sku),
            ("sku", _) => query.OrderByDescending(c => c.Sku),
            ("status", "asc") => query.OrderBy(c => c.Status),
            ("status", _) => query.OrderByDescending(c => c.Status),
            ("equity", "asc") => query.OrderBy(c => c.AccountSize),
            ("equity", _) => query.OrderByDescending(c => c.AccountSize),
            (_, "asc") => query.OrderBy(c => c.CreatedAt),
            _ => query.OrderByDescending(c => c.CreatedAt),
        };

        var total = await query.CountAsync();
        var rows = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        var items = new List<object>();
        foreach (var c in rows)
        {
            var acc = await db.TradingAccounts.FirstOrDefaultAsync(a => a.ChallengeId == c.Id);
            var trader = await db.Traders.FindAsync(c.TraderId);
            items.Add(new
            {
                id = c.Id,
                traderId = c.TraderId,
                traderEmail = trader?.Email,
                sku = c.Sku,
                status = c.Status,
                failReason = c.FailReason,
                currentPhase = c.CurrentPhase,
                equity = acc?.Equity ?? c.AccountSize,
                accountSize = c.AccountSize,
                createdAt = c.CreatedAt,
                archived = c.Archived,
            });
        }

        return PageResult<object>.Create(items, page, pageSize, total, sortBy, sortDir, q, filters);
    }

    public async Task<object> AdminCloseChallengeAsync(string challengeId)
    {
        var c = await FindChallengeAsync(challengeId) ?? throw new DomainError("not found");
        if (c.Status is ChallengeStatuses.Closed or ChallengeStatuses.Failed)
            return new { ok = true, id = c.Id, status = c.Status, alreadyClosed = true };

        c.PreviousStatus = c.Status;
        c.Status = ChallengeStatuses.Closed;
        c.FailReason ??= "Closed by admin";
        var acc = await db.TradingAccounts.FirstOrDefaultAsync(a => a.ChallengeId == c.Id);
        if (acc is not null) acc.Locked = true;
        db.AuditEntries.Add(new AuditEntry
        {
            EventType = "ChallengeForceClosed",
            Source = "admin",
            Summary = $"Admin closed challenge {c.Sku} ({c.Id})",
        });
        await db.SaveChangesAsync();
        return new { ok = true, id = c.Id, status = c.Status };
    }

    public async Task<PageResult<object>> AdminCatalogProductsAsync(int page, int pageSize, string? q, string sortBy, string sortDir, string? isActive)
    {
        (page, pageSize, sortDir) = ListQuery.Normalize(page, pageSize, sortDir);
        var query = db.Products.AsQueryable();
        var filters = new Dictionary<string, object?>();
        if (!string.IsNullOrWhiteSpace(isActive) && bool.TryParse(isActive, out var active))
        {
            query = query.Where(p => p.IsActive == active);
            filters["isActive"] = isActive;
        }
        if (!string.IsNullOrWhiteSpace(q))
        {
            var like = q.Trim();
            query = query.Where(p => p.Sku.Contains(like) || p.Name.Contains(like));
        }

        query = (sortBy, sortDir) switch
        {
            ("sku", "asc") => query.OrderBy(p => p.Sku),
            ("sku", _) => query.OrderByDescending(p => p.Sku),
            ("price", "asc") => query.OrderBy(p => p.Price),
            ("price", _) => query.OrderByDescending(p => p.Price),
            ("profitSplitPct", "asc") => query.OrderBy(p => p.ProfitSplitPct),
            ("profitSplitPct", _) => query.OrderByDescending(p => p.ProfitSplitPct),
            ("accountSize", "asc") => query.OrderBy(p => p.AccountSize),
            ("accountSize", _) => query.OrderByDescending(p => p.AccountSize),
            (_, "asc") => query.OrderBy(p => p.Sku),
            _ => query.OrderByDescending(p => p.AccountSize),
        };

        var total = await query.CountAsync();
        var rows = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        var items = rows.Select(MapProduct).Cast<object>().ToList();
        return PageResult<object>.Create(items, page, pageSize, total, sortBy, sortDir, q, filters);
    }

    public async Task<object> AdminSetProductActiveAsync(string productId, bool isActive)
    {
        var p = await db.Products.FindAsync(productId) ?? throw new DomainError("not found");
        p.IsActive = isActive;
        await catalogCache.InvalidateCatalogAsync();
        db.AuditEntries.Add(new AuditEntry
        {
            EventType = "CatalogProductUpdated",
            Source = "admin",
            Summary = $"Product {p.Sku} isActive={isActive}",
        });
        await db.SaveChangesAsync();
        return MapProduct(p);
    }

    public async Task<PageResult<object>> AdminAuditAsync(int page, int pageSize, string? q, string sortBy, string sortDir)
    {
        (page, pageSize, sortDir) = ListQuery.Normalize(page, pageSize, sortDir);
        var query = db.AuditEntries.AsQueryable();
        if (!string.IsNullOrWhiteSpace(q))
        {
            var like = q.Trim();
            query = query.Where(a =>
                a.EventType.Contains(like) ||
                a.Source.Contains(like) ||
                a.Summary.Contains(like));
        }

        query = (sortBy, sortDir) switch
        {
            ("eventType", "asc") => query.OrderBy(a => a.EventType),
            ("eventType", _) => query.OrderByDescending(a => a.EventType),
            ("source", "asc") => query.OrderBy(a => a.Source),
            ("source", _) => query.OrderByDescending(a => a.Source),
            (_, "asc") => query.OrderBy(a => a.OccurredAt),
            _ => query.OrderByDescending(a => a.OccurredAt),
        };

        var total = await query.CountAsync();
        var rows = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        var items = rows.Select(a => (object)new
        {
            id = a.Id,
            eventType = a.EventType,
            source = a.Source,
            summary = a.Summary,
            payloadJson = a.PayloadJson,
            occurredAt = a.OccurredAt,
        }).ToList();
        return PageResult<object>.Create(items, page, pageSize, total, sortBy, sortDir, q, null);
    }

    public async Task<PageResult<object>> AdminNotificationsAsync(int page, int pageSize, string? q, string sortBy, string sortDir, string? status)
    {
        (page, pageSize, sortDir) = ListQuery.Normalize(page, pageSize, sortDir);
        var query = db.Notifications.AsQueryable();
        var filters = new Dictionary<string, object?>();
        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(n => n.Status == status);
            filters["status"] = status;
        }
        if (!string.IsNullOrWhiteSpace(q))
        {
            var like = q.Trim();
            query = query.Where(n => n.ToEmail.Contains(like) || n.Subject.Contains(like));
        }

        query = (sortBy, sortDir) switch
        {
            ("toEmail", "asc") => query.OrderBy(n => n.ToEmail),
            ("toEmail", _) => query.OrderByDescending(n => n.ToEmail),
            ("subject", "asc") => query.OrderBy(n => n.Subject),
            ("subject", _) => query.OrderByDescending(n => n.Subject),
            ("status", "asc") => query.OrderBy(n => n.Status),
            ("status", _) => query.OrderByDescending(n => n.Status),
            (_, "asc") => query.OrderBy(n => n.CreatedAt),
            _ => query.OrderByDescending(n => n.CreatedAt),
        };

        var total = await query.CountAsync();
        var rows = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        var items = rows.Select(n => (object)new
        {
            id = n.Id,
            toEmail = n.ToEmail,
            subject = n.Subject,
            body = n.Body,
            status = n.Status,
            deliveryDetail = n.DeliveryDetail,
            createdAt = n.CreatedAt,
        }).ToList();
        return PageResult<object>.Create(items, page, pageSize, total, sortBy, sortDir, q, filters);
    }

    public async Task<object> DecidePayoutAsync(string payoutId, bool approve)
    {
        var row = await db.PayoutRequests.FindAsync(payoutId) ?? throw new DomainError("not found");
        if (row.Status is not ("Pending" or "NeedsVpsInvoice")) throw new DomainError("already decided");
        var snap = await LatestConnectionAsync(row.TraderId);
        var risk = IpRisk.Assess(snap);
        if (approve)
        {
            var (ok, reason) = IpRisk.CanApprove(row.Status, risk, row.VpsInvoiceStatus);
            if (!ok) throw new DomainError(reason);
            var wallet = await db.Wallets.FindAsync(row.TraderId) ?? throw new DomainError("wallet missing");
            if (row.Amount > wallet.AvailableBalance) throw new DomainError("insufficient balance");
            wallet.AvailableBalance -= row.Amount;
            wallet.UpdatedAt = DateTimeOffset.UtcNow;
            row.Status = "Approved";
            var trader = await db.Traders.FindAsync(row.TraderId);
            if (trader is not null)
            {
                await mail.NotifyAsync(db, trader.Email, $"Payout approved - ${row.Amount:F2}",
                    $"Payout {row.Id} approved. Destination: {row.CryptoNetwork} {row.CryptoAddress}");
            }
        }
        else
        {
            row.Status = "Rejected";
            var trader = await db.Traders.FindAsync(row.TraderId);
            if (trader is not null)
                await mail.NotifyAsync(db, trader.Email, "Payout rejected", "Your payout request was rejected.");
        }

        row.DecidedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return await MapPayoutAsync(row);
    }

    public async Task<object> CommentPayoutAsync(string payoutId, string subject, string message)
    {
        var row = await db.PayoutRequests.FindAsync(payoutId) ?? throw new DomainError("not found");
        if (string.IsNullOrWhiteSpace(message)) throw new DomainError("message is required");
        var trader = await db.Traders.FindAsync(row.TraderId) ?? throw new DomainError("trader not found");
        var subj = string.IsNullOrWhiteSpace(subject) ? $"Regarding your payout {row.Id[..8]}" : subject.Trim();
        var body = $"Hi {trader.DisplayName},\n\nPayout {row.Id} (${row.Amount:F2}, {row.Status})\n\n{message.Trim()}\n\n- PropFirm Compliance";
        await mail.NotifyAsync(db, trader.Email, subj, body);
        db.AuditEntries.Add(new AuditEntry
        {
            EventType = "PayoutAdminComment",
            Source = "admin",
            Summary = $"Admin emailed trader about payout {row.Id}",
            PayloadJson = JsonSerializer.Serialize(new { payoutId = row.Id, subject = subj }),
        });
        await db.SaveChangesAsync();
        return new { ok = true, toEmail = trader.Email, subject = subj };
    }

    private async Task<Challenge> ProvisionChallengeAsync(Order order)
    {
        var existing = await db.Challenges.FirstOrDefaultAsync(c => c.OrderId == order.Id);
        if (existing is not null) return existing;

        var status = order.Phases <= 1 ? ChallengeStatuses.Funded : ChallengeStatuses.Active;
        var p1 = order.Phase1TargetPct > 0 ? order.Phase1TargetPct : order.ProfitTargetPct;
        var p2 = order.Phase2TargetPct;
        var challenge = new Challenge
        {
            TraderId = order.TraderId,
            OrderId = order.Id,
            ProductId = order.ProductId,
            Sku = order.Sku,
            AccountSize = order.AccountSize,
            Status = status,
            CurrentPhase = 1,
            Phases = order.Phases,
            ProfitTargetPct = p1,
            Phase1TargetPct = p1,
            Phase2TargetPct = p2,
            DailyLossPct = order.DailyLossPct,
            MaxLossPct = order.MaxLossPct,
            MinTradingDays = order.MinTradingDays,
            MaxTradingDays = order.MaxTradingDays,
            ProfitSplitPct = 80,
        };
        db.Challenges.Add(challenge);
        var login = $"mt5{Random.Shared.Next(100000, 999999)}";
        var password = $"Pf{Random.Shared.Next(100000, 999999)}!";
        db.TradingAccounts.Add(new TradingAccount
        {
            ChallengeId = challenge.Id,
            TraderId = order.TraderId,
            Login = login,
            Password = password,
            Server = "PropFirm-Demo",
            Platform = order.Platform,
            StartingBalance = order.AccountSize,
            Equity = order.AccountSize,
            HighWaterMark = order.AccountSize,
        });
        return challenge;
    }

    private async Task<ConnectionSnapshot?> LatestConnectionAsync(string traderId)
    {
        var row = await db.LoginHistories.Where(l => l.TraderId == traderId)
            .OrderByDescending(l => l.CreatedAt).FirstOrDefaultAsync();
        return row is null
            ? null
            : new ConnectionSnapshot(row.Ip, row.IsVpn, row.IsVps, row.ConnectionKind, row.ConnectionLabel);
    }

    private async Task<object> MapPayoutAsync(PayoutRequest r)
    {
        var trader = await db.Traders.FindAsync(r.TraderId);
        var snap = await LatestConnectionAsync(r.TraderId);
        var risk = IpRisk.Assess(snap);
        var (ok, block) = IpRisk.CanApprove(r.Status, risk, r.VpsInvoiceStatus);
        return new
        {
            id = r.Id,
            traderId = r.TraderId,
            traderEmail = trader?.Email,
            amount = r.Amount,
            status = r.Status,
            challengeId = r.ChallengeId,
            method = r.Method,
            rewardType = r.RewardType,
            cryptoNetwork = r.CryptoNetwork,
            cryptoAddress = r.CryptoAddress,
            vpsInvoiceStatus = r.VpsInvoiceStatus,
            ipRiskNote = r.IpRiskNote ?? risk.Summary,
            ipRisk = new
            {
                hasViolation = risk.HasViolation,
                code = risk.Code,
                summary = risk.Summary,
                requiresVpsInvoice = risk.RequiresVpsInvoice,
                lastIp = snap?.Ip,
                isVpn = snap?.IsVpn ?? false,
                isVps = snap?.IsVps ?? false,
                connectionLabel = snap?.ConnectionLabel,
            },
            canApprove = ok,
            approveBlockedReason = ok ? null : block,
            createdAt = r.CreatedAt,
            decidedAt = r.DecidedAt,
        };
    }

    private static object MapProduct(Product p) => new
    {
        id = p.Id,
        sku = p.Sku,
        name = p.Name,
        accountSize = p.AccountSize,
        price = p.Price,
        phaseFamily = p.PhaseFamily,
        variant = p.Variant,
        profitSplitPct = p.ProfitSplitPct,
        isActive = p.IsActive,
        isMostPopular = p.IsMostPopular,
        phases = p.Phases,
        profitTargetPct = p.ProfitTargetPct,
        dailyLossPct = p.DailyLossPct,
        maxLossPct = p.MaxLossPct,
        minTradingDays = p.MinTradingDays,
        maxTradingDays = p.MaxTradingDays,
        phase1TargetPct = p.Phase1TargetPct,
        phase2TargetPct = p.Phase2TargetPct,
    };

    private static object MapChallenge(Challenge c, TradingAccount? acc)
    {
        var equity = acc?.Equity ?? c.AccountSize;
        var pnl = Math.Round(equity - c.AccountSize, 2);
        var profitPct = c.AccountSize == 0 ? 0m : Math.Round((pnl / c.AccountSize) * 100m, 1);
        return new
        {
            id = c.Id,
            traderId = c.TraderId,
            sku = c.Sku,
            accountSize = c.AccountSize,
            status = c.Status,
            failReason = c.FailReason,
            currentPhase = c.CurrentPhase,
            phases = c.Phases,
            equity,
            pnl,
            profitPct,
            locked = acc?.Locked ?? false,
            login = acc?.Login,
            platform = acc?.Platform,
            createdAt = c.CreatedAt,
            archived = c.Archived,
            kind = "challenge",
            sourceChallengeId = c.SourceChallengeId,
            profitSplitPct = c.ProfitSplitPct,
            profitTargetPct = c.Status == ChallengeStatuses.Funded
                ? c.ProfitTargetPct
                : ChallengeProgression.TargetPctForPhase(
                    c.CurrentPhase, c.Phase1TargetPct, c.Phase2TargetPct, c.ProfitTargetPct),
            hasProfitTarget = (c.Status == ChallengeStatuses.Funded
                ? c.ProfitTargetPct
                : ChallengeProgression.TargetPctForPhase(
                    c.CurrentPhase, c.Phase1TargetPct, c.Phase2TargetPct, c.ProfitTargetPct)) > 0,
        };
    }

    private static object MapCompetitionAccount(CompetitionJoin j)
    {
        var size = j.AccountSize > 0 ? j.AccountSize : 100_000m;
        var equity = j.Equity > 0 ? j.Equity : size;
        var pnl = Math.Round(equity - size, 2);
        var profitPct = size == 0 ? 0m : Math.Round((pnl / size) * 100m, 1);
        return new
        {
            id = j.Id,
            traderId = j.TraderId,
            sku = "COMPETITION",
            accountSize = size,
            status = "Active",
            failReason = (string?)null,
            currentPhase = 1,
            phases = 1,
            equity,
            locked = false,
            login = j.Login,
            platform = j.Platform,
            createdAt = j.CreatedAt,
            archived = false,
            kind = "competition",
            competitionId = j.CompetitionId,
            competitionTitle = j.CompetitionTitle,
            profitSplitPct = 0m,
            profitTargetPct = 0m,
            hasProfitTarget = false,
            pnl,
            profitPct,
        };
    }

    private static object MapCompetitionDetail(CompetitionJoin j)
    {
        var size = j.AccountSize > 0 ? j.AccountSize : 100_000m;
        var equity = j.Equity > 0 ? j.Equity : size;
        var profitPct = size == 0 ? 0m : ((equity - size) / size) * 100m;
        return new
        {
            id = j.Id,
            traderId = j.TraderId,
            sku = "COMPETITION",
            accountSize = size,
            phases = 1,
            currentPhase = 1,
            profitTargetPct = 0m,
            hasProfitTarget = false,
            dailyLossPct = 0m,
            maxLossPct = 0m,
            maxDailyLossPct = 0m,
            maxTotalLossPct = 0m,
            minTradingDays = 0,
            maxTradingDays = 0,
            status = "Active",
            failReason = (string?)null,
            createdAt = j.CreatedAt,
            kind = "competition",
            competitionId = j.CompetitionId,
            competitionTitle = j.CompetitionTitle,
            account = new
            {
                id = j.Id,
                login = j.Login,
                password = j.Password,
                platform = j.Platform,
                server = j.Server,
                equity,
                startingBalance = size,
                highWaterMark = Math.Max(equity, size),
                locked = false,
            },
            progress = new
            {
                equity,
                maxEquity = Math.Max(equity, size),
                targetEquity = (decimal?)null,
                targetPct = 0m,
                hasProfitTarget = false,
                profitPct,
                tradingDays = 0,
                minTradingDays = 0,
                maxTradingDays = 0,
                dayPnl = 0m,
                dailyLossRemaining = 0m,
                maxLossRemaining = 0m,
            },
            equitySeries = Array.Empty<object>(),
        };
    }

    private static object MapChallengeDetail(Challenge c, TradingAccount? acc, IReadOnlyList<Trade> trades)
    {
        var equity = acc?.Equity ?? c.AccountSize;
        var hwm = acc?.HighWaterMark ?? equity;
        // Funded: use stored ProfitTargetPct (0 = no target). Evaluation: phase targets.
        var targetPct = c.Status == ChallengeStatuses.Funded
            ? c.ProfitTargetPct
            : ChallengeProgression.TargetPctForPhase(
                c.CurrentPhase, c.Phase1TargetPct, c.Phase2TargetPct, c.ProfitTargetPct);
        if (c.Status != ChallengeStatuses.Funded && targetPct <= 0)
            targetPct = c.ProfitTargetPct;
        var maxEquity = Math.Max(Math.Max(equity, hwm), c.AccountSize);
        if (trades.Count > 0)
            maxEquity = Math.Max(maxEquity, trades.Max(t => t.EquityAfter));
        var tradingDays = trades.Select(t => t.CreatedAt.UtcDateTime.Date).Distinct().Count();
        var today = DateTime.UtcNow.Date;
        var dayPnl = trades.Where(t => t.CreatedAt.UtcDateTime.Date == today).Sum(t => t.Pnl);
        var profitPct = c.AccountSize == 0 ? 0 : ((equity - c.AccountSize) / c.AccountSize) * 100m;
        var hasProfitTarget = targetPct > 0;
        var startBal = acc?.StartingBalance ?? c.AccountSize;
        var dailyCap = startBal * (c.DailyLossPct / 100m);
        var maxLossFloor = startBal * (1m - c.MaxLossPct / 100m);
        // Day start equity ≈ current equity − today's PnL; remaining daily loss mirrors max-loss remaining.
        var dayStartEquity = equity - dayPnl;
        var dailyFloor = dayStartEquity - dailyCap;
        var dailyLossRemaining = Math.Max(0, equity - dailyFloor);
        var maxLossRemaining = Math.Max(0, equity - maxLossFloor);

        return new
        {
            id = c.Id,
            traderId = c.TraderId,
            orderId = c.OrderId,
            productId = c.ProductId,
            sku = c.Sku,
            accountSize = c.AccountSize,
            phases = c.Phases,
            currentPhase = c.CurrentPhase,
            profitTargetPct = targetPct,
            phase1TargetPct = c.Phase1TargetPct,
            phase2TargetPct = c.Phase2TargetPct,
            hasProfitTarget,
            dailyLossPct = c.DailyLossPct,
            maxLossPct = c.MaxLossPct,
            maxDailyLossPct = c.DailyLossPct,
            maxTotalLossPct = c.MaxLossPct,
            minTradingDays = c.MinTradingDays,
            maxTradingDays = c.MaxTradingDays,
            status = c.Status,
            failReason = c.FailReason,
            createdAt = c.CreatedAt,
            account = acc is null
                ? null
                : new
                {
                    id = acc.Id,
                    login = acc.Login,
                    password = string.IsNullOrEmpty(acc.Password) ? "changeme" : acc.Password,
                    platform = acc.Platform,
                    server = string.IsNullOrEmpty(acc.Server) ? "PropFirm-Demo" : acc.Server,
                    equity = acc.Equity,
                    startingBalance = acc.StartingBalance,
                    highWaterMark = acc.HighWaterMark,
                    locked = acc.Locked,
                },
            progress = new
            {
                equity,
                maxEquity,
                targetEquity = hasProfitTarget ? c.AccountSize * (1 + targetPct / 100m) : (decimal?)null,
                targetPct,
                hasProfitTarget,
                profitPct,
                tradingDays,
                minTradingDays = c.MinTradingDays,
                maxTradingDays = c.MaxTradingDays,
                dayPnl,
                dayStartEquity,
                dailyCap,
                dailyFloor,
                dailyLossRemaining,
                maxLossFloor,
                maxLossRemaining,
            },
            equitySeries = trades.Select(t => new { t = t.CreatedAt, equity = t.EquityAfter, dayPnl = t.Pnl }).ToList(),
        };
    }

    private static object AuthPayload(Trader t, string token) => new
    {
        userId = t.Id,
        email = t.Email,
        displayName = t.DisplayName,
        role = t.Role,
        accessToken = token,
    };
}
