using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using PropFirm.Domain.Modules.Challenges;
using PropFirm.Domain.Modules.Payouts;
using PropFirm.Infrastructure.Cache;

namespace PropFirm.Infrastructure.Persistence;

public static class SeedData
{
    public static async Task EnsureSeededAsync(PropFirmDbContext db, CatalogCache? catalogCache = null)
    {
        // Shared Postgres may already contain Python-track tables.
        // EnsureCreatedAsync() then no-ops and never creates the EF "propfirm" schema.
        await db.Database.ExecuteSqlRawAsync("CREATE SCHEMA IF NOT EXISTS propfirm");

        var connection = db.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
            await db.Database.OpenConnectionAsync();

        await using (var cmd = connection.CreateCommand())
        {
            cmd.CommandText =
                """
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'propfirm' AND table_name = 'traders')
                """;
            var exists = (bool)(await cmd.ExecuteScalarAsync() ?? false);
            if (!exists)
                await db.GetService<IRelationalDatabaseCreator>().CreateTablesAsync();
        }

        await EnsureSchemaPatchesAsync(db);

        if (!await db.Traders.AnyAsync())
        {
            db.Traders.AddRange(
                new Trader
                {
                    Email = "trader@propfirm.local",
                    DisplayName = "Demo Trader",
                    Role = "Trader",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("Trader1!"),
                },
                new Trader
                {
                    Email = "admin@propfirm.local",
                    DisplayName = "Admin",
                    Role = "Admin",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin1!"),
                });
            await db.SaveChangesAsync();

            var trader = await db.Traders.SingleAsync(t => t.Email == "trader@propfirm.local");
            db.Wallets.Add(new Wallet { TraderId = trader.Id, AvailableBalance = 500m });
        }

        await EnsureCatalogAsync(db);
        await db.SaveChangesAsync();
        await EnsureDemoScenariosAsync(db);
        await db.Database.ExecuteSqlRawAsync(
            """
            UPDATE propfirm.challenge_instances c
            SET "MaxTradingDays" = p."MaxTradingDays"
            FROM propfirm.challenge_products p
            WHERE p."Sku" = c."Sku" AND p."MaxTradingDays" > 0
              AND (c."MaxTradingDays" = 0 OR c."MaxTradingDays" IS DISTINCT FROM p."MaxTradingDays");
            """);
        if (catalogCache is not null)
            await catalogCache.InvalidateCatalogAsync();
    }

    static async Task EnsureSchemaPatchesAsync(PropFirmDbContext db)
    {
        // Additive columns for evolving .NET schema on a shared Postgres volume.
        await db.Database.ExecuteSqlRawAsync(
            """
            ALTER TABLE propfirm.challenge_instances ADD COLUMN IF NOT EXISTS "Phase1TargetPct" numeric NOT NULL DEFAULT 0;
            ALTER TABLE propfirm.challenge_instances ADD COLUMN IF NOT EXISTS "Phase2TargetPct" numeric NOT NULL DEFAULT 0;
            ALTER TABLE propfirm.trading_accounts ADD COLUMN IF NOT EXISTS "Password" character varying(128) NOT NULL DEFAULT '';
            ALTER TABLE propfirm.trading_accounts ADD COLUMN IF NOT EXISTS "Server" character varying(128) NOT NULL DEFAULT 'PropFirm-Demo';
            ALTER TABLE propfirm.challenge_products ADD COLUMN IF NOT EXISTS "MaxTradingDays" integer NOT NULL DEFAULT 0;
            ALTER TABLE propfirm.orders ADD COLUMN IF NOT EXISTS "MaxTradingDays" integer NOT NULL DEFAULT 0;
            ALTER TABLE propfirm.orders ADD COLUMN IF NOT EXISTS "ListPrice" numeric NULL;
            ALTER TABLE propfirm.orders ADD COLUMN IF NOT EXISTS "CouponCode" character varying(64) NULL;
            ALTER TABLE propfirm.orders ADD COLUMN IF NOT EXISTS "DiscountAmount" numeric NULL;
            ALTER TABLE propfirm.challenge_instances ADD COLUMN IF NOT EXISTS "MaxTradingDays" integer NOT NULL DEFAULT 0;
            ALTER TABLE propfirm.challenge_instances ADD COLUMN IF NOT EXISTS "PreviousStatus" text NULL;
            ALTER TABLE propfirm.challenge_instances ADD COLUMN IF NOT EXISTS "ArchiveUndoToken" text NULL;
            ALTER TABLE propfirm.challenge_instances ADD COLUMN IF NOT EXISTS "SourceChallengeId" text NULL;
            CREATE TABLE IF NOT EXISTS propfirm.competition_joins (
                "Id" text PRIMARY KEY,
                "TraderId" text NOT NULL,
                "CompetitionId" text NOT NULL,
                "CompetitionTitle" character varying(300),
                "Login" text NOT NULL DEFAULT '',
                "Password" text NOT NULL DEFAULT '',
                "Platform" text NOT NULL DEFAULT 'matchtrader',
                "Server" text NOT NULL DEFAULT 'PropFirm-Comp',
                "AccountSize" numeric NOT NULL DEFAULT 100000,
                "Equity" numeric NOT NULL DEFAULT 100000,
                "CreatedAt" timestamptz NOT NULL DEFAULT now()
            );
            ALTER TABLE propfirm.competition_joins ADD COLUMN IF NOT EXISTS "AccountSize" numeric NOT NULL DEFAULT 100000;
            ALTER TABLE propfirm.competition_joins ADD COLUMN IF NOT EXISTS "Equity" numeric NOT NULL DEFAULT 100000;
            UPDATE propfirm.competition_joins
            SET "AccountSize" = 100000
            WHERE "AccountSize" = 0 OR "AccountSize" IS NULL;
            UPDATE propfirm.competition_joins
            SET "Equity" = COALESCE(NULLIF("Equity", 0), "AccountSize", 100000)
            WHERE "Equity" = 0 OR "Equity" IS NULL;
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_competition_joins_TraderId_CompetitionId"
                ON propfirm.competition_joins ("TraderId", "CompetitionId");
            ALTER TABLE propfirm.traders ADD COLUMN IF NOT EXISTS "TwoFactorEnabled" boolean NOT NULL DEFAULT false;
            ALTER TABLE propfirm.traders ADD COLUMN IF NOT EXISTS "PreferredLanguage" character varying(16) NOT NULL DEFAULT 'en';
            ALTER TABLE propfirm.traders ADD COLUMN IF NOT EXISTS "VerificationStatus" text NOT NULL DEFAULT 'None';
            ALTER TABLE propfirm.traders ADD COLUMN IF NOT EXISTS "VerificationRequestedAt" timestamptz NULL;
            ALTER TABLE propfirm.traders ADD COLUMN IF NOT EXISTS "VerificationDecidedAt" timestamptz NULL;
            ALTER TABLE propfirm.traders ADD COLUMN IF NOT EXISTS "VerificationAdminComment" text NULL;
            ALTER TABLE propfirm.traders ADD COLUMN IF NOT EXISTS "AffiliateCode" character varying(32) NULL;
            ALTER TABLE propfirm.login_history ADD COLUMN IF NOT EXISTS "Country" character varying(120) NULL;
            ALTER TABLE propfirm.login_history ADD COLUMN IF NOT EXISTS "CountryCode" character varying(8) NULL;
            ALTER TABLE propfirm.login_history ADD COLUMN IF NOT EXISTS "City" character varying(120) NULL;
            ALTER TABLE propfirm.login_history ADD COLUMN IF NOT EXISTS "Isp" character varying(200) NULL;
            ALTER TABLE propfirm.login_history ADD COLUMN IF NOT EXISTS "Org" character varying(200) NULL;
            CREATE TABLE IF NOT EXISTS propfirm.feature_suggestions (
                "Id" text PRIMARY KEY,
                "TraderId" text NOT NULL,
                "Title" character varying(200) NOT NULL,
                "Category" character varying(100) NOT NULL,
                "Description" text NOT NULL,
                "UseCase" text NULL,
                "Priority" character varying(40) NOT NULL DEFAULT 'medium',
                "Status" character varying(40) NOT NULL DEFAULT 'Submitted',
                "CreatedAt" timestamptz NOT NULL DEFAULT now()
            );
            """);
        // Backfill targets on older challenge rows so profit-target UI is not blank.
        await db.Database.ExecuteSqlRawAsync(
            """
            UPDATE propfirm.challenge_instances
            SET "Phase1TargetPct" = "ProfitTargetPct"
            WHERE "Phase1TargetPct" = 0 AND "ProfitTargetPct" > 0;
            """);
        // Multi-phase funded live accounts: clear leftover evaluation profit targets.
        // Instant funded (Phases <= 1) keep catalog ProfitTargetPct (may be > 0).
        await db.Database.ExecuteSqlRawAsync(
            """
            UPDATE propfirm.challenge_instances
            SET "ProfitTargetPct" = 0
            WHERE "Status" = 'Funded' AND "Phases" > 1 AND "ProfitTargetPct" <> 0;
            """);
        // Sync max trading days onto existing challenge rows from catalog SKU.
        await db.Database.ExecuteSqlRawAsync(
            """
            UPDATE propfirm.challenge_instances c
            SET "MaxTradingDays" = p."MaxTradingDays"
            FROM propfirm.challenge_products p
            WHERE p."Sku" = c."Sku" AND c."MaxTradingDays" = 0 AND p."MaxTradingDays" > 0;
            """);
    }

    /// <summary>Upsert full evaluation ladder by SKU (keeps existing IDs so bookmarked checkout URLs keep working).</summary>
    static async Task EnsureCatalogAsync(PropFirmDbContext db)
    {
        var desired = CatalogSeed.Build();
        var existing = await db.Products.ToListAsync();
        var bySku = existing.ToDictionary(p => p.Sku, StringComparer.OrdinalIgnoreCase);

        foreach (var row in desired)
        {
            if (bySku.TryGetValue(row.Sku, out var cur))
            {
                cur.Name = row.Name;
                cur.PhaseFamily = row.PhaseFamily;
                cur.Variant = row.Variant;
                cur.AccountSize = row.AccountSize;
                cur.Price = row.Price;
                cur.Phases = row.Phases;
                cur.ProfitTargetPct = row.ProfitTargetPct;
                cur.Phase1TargetPct = row.Phase1TargetPct;
                cur.Phase2TargetPct = row.Phase2TargetPct;
                cur.DailyLossPct = row.DailyLossPct;
                cur.MaxLossPct = row.MaxLossPct;
                cur.MinTradingDays = row.MinTradingDays;
                cur.MaxTradingDays = row.MaxTradingDays;
                cur.ProfitSplitPct = row.ProfitSplitPct;
                cur.IsMostPopular = row.IsMostPopular;
                cur.IsActive = true;
            }
            else
            {
                db.Products.Add(row);
            }
        }

        // Retire demo SKUs that are not in the full ladder (e.g. old Instant Funded label).
        var keep = desired.Select(p => p.Sku).ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var orphan in existing.Where(p => !keep.Contains(p.Sku)))
            orphan.IsActive = false;
    }

    /// <summary>
    /// Idempotent scenario accounts for demo trader (phase pass lineage, breach, funded profit, competition).
    /// </summary>
    static async Task EnsureDemoScenariosAsync(PropFirmDbContext db)
    {
        var trader = await db.Traders.FirstOrDefaultAsync(t => t.Email == "trader@propfirm.local");
        if (trader is null) return;

        var wallet = await db.Wallets.FindAsync(trader.Id);
        if (wallet is null)
        {
            wallet = new Wallet { TraderId = trader.Id, AvailableBalance = 500m };
            db.Wallets.Add(wallet);
        }

        var product = await db.Products.FirstOrDefaultAsync(p => p.Sku == "2STEP-FLEX-100K")
                      ?? await db.Products.FirstOrDefaultAsync(p => p.Phases == 2 && p.AccountSize == 100_000m);
        if (product is null) return;

        async Task<(Challenge Challenge, TradingAccount Acc)> EnsureLoginAsync(
            string login,
            string status,
            int phase,
            decimal equity,
            string? sourceId = null,
            string? failReason = null,
            bool locked = false)
        {
            var acc = await db.TradingAccounts.FirstOrDefaultAsync(a =>
                a.Login == login && a.TraderId == trader.Id);
            if (acc is null)
            {
                // Avoid hijacking another trader's login (e.g. shared demo names).
                var taken = await db.TradingAccounts.AnyAsync(a => a.Login == login);
                if (taken) login = $"d{login}";
                acc = await db.TradingAccounts.FirstOrDefaultAsync(a =>
                    a.Login == login && a.TraderId == trader.Id);
            }

            if (acc is not null)
            {
                var existing = await db.Challenges.FindAsync(acc.ChallengeId)
                               ?? throw new InvalidOperationException($"challenge missing for {login}");
                existing.Status = status;
                existing.CurrentPhase = phase;
                existing.Phases = product.Phases;
                existing.AccountSize = product.AccountSize;
                existing.FailReason = failReason;
                existing.SourceChallengeId = sourceId ?? existing.SourceChallengeId;
                existing.ProfitTargetPct = status == ChallengeStatuses.Funded
                    ? 0
                    : ChallengeProgression.TargetPctForPhase(
                        phase, product.Phase1TargetPct, product.Phase2TargetPct, product.ProfitTargetPct);
                existing.Phase1TargetPct = product.Phase1TargetPct;
                existing.Phase2TargetPct = product.Phase2TargetPct;
                existing.DailyLossPct = product.DailyLossPct;
                existing.MaxLossPct = product.MaxLossPct;
                existing.MinTradingDays = product.MinTradingDays;
                existing.MaxTradingDays = product.MaxTradingDays;
                existing.ProfitSplitPct = product.ProfitSplitPct;
                existing.Archived = false;
                acc.Equity = equity;
                acc.StartingBalance = product.AccountSize;
                acc.HighWaterMark = Math.Max(equity, product.AccountSize);
                acc.Locked = locked || status is ChallengeStatuses.Failed or ChallengeStatuses.Passed or ChallengeStatuses.Closed;
                return (existing, acc);
            }

            var challenge = new Challenge
            {
                TraderId = trader.Id,
                ProductId = product.Id,
                Sku = product.Sku,
                AccountSize = product.AccountSize,
                Status = status,
                CurrentPhase = phase,
                Phases = product.Phases,
                ProfitTargetPct = status == ChallengeStatuses.Funded
                    ? 0
                    : ChallengeProgression.TargetPctForPhase(
                        phase, product.Phase1TargetPct, product.Phase2TargetPct, product.ProfitTargetPct),
                Phase1TargetPct = product.Phase1TargetPct,
                Phase2TargetPct = product.Phase2TargetPct,
                DailyLossPct = product.DailyLossPct,
                MaxLossPct = product.MaxLossPct,
                MinTradingDays = product.MinTradingDays,
                MaxTradingDays = product.MaxTradingDays,
                ProfitSplitPct = product.ProfitSplitPct,
                SourceChallengeId = sourceId,
                FailReason = failReason,
            };
            db.Challenges.Add(challenge);
            var created = new TradingAccount
            {
                ChallengeId = challenge.Id,
                TraderId = trader.Id,
                Login = login,
                Password = "DemoPass1!",
                Server = "PropFirm-Demo",
                Platform = "mt5",
                StartingBalance = product.AccountSize,
                Equity = equity,
                HighWaterMark = Math.Max(equity, product.AccountSize),
                Locked = locked || status is ChallengeStatuses.Failed or ChallengeStatuses.Passed or ChallengeStatuses.Closed,
            };
            db.TradingAccounts.Add(created);
            return (challenge, created);
        }

        // Active evaluation phase 1
        await EnsureLoginAsync("mt5100001", ChallengeStatuses.Active, 1, product.AccountSize);

        // Passed phase 1 + Active phase 2 (FundingPips-style lineage)
        var (passedP1, _) = await EnsureLoginAsync(
            "mt5396011", ChallengeStatuses.Passed, 1, product.AccountSize * 1.10m, locked: true);
        await EnsureLoginAsync(
            "mt5396012", ChallengeStatuses.Active, 2, product.AccountSize, sourceId: passedP1.Id);

        // Breached phase 2 — visible under Failed filter (not only Archive)
        await EnsureLoginAsync(
            "mt5200002",
            ChallengeStatuses.Failed,
            2,
            product.AccountSize * 0.88m,
            failReason: "Daily loss exceeded limit",
            locked: true);

        // Funded with profit → eligible on rewards / request payout
        var (funded, fundedAcc) = await EnsureLoginAsync(
            "mt5195181", ChallengeStatuses.Funded, 2, 112_000m);
        funded.ProfitTargetPct = 0;
        fundedAcc.Locked = false;
        var share = ProfitShare.ProfitShareCap(fundedAcc.Equity, funded.AccountSize, funded.ProfitSplitPct);
        if (wallet.AvailableBalance < share)
            wallet.AvailableBalance = Math.Max(wallet.AvailableBalance, share);

        // Competition with visible $100k balance
        var comp = await db.CompetitionJoins.FirstOrDefaultAsync(j =>
            j.TraderId == trader.Id && j.CompetitionId == "demo-sprint-100k");
        if (comp is null)
        {
            db.CompetitionJoins.Add(new CompetitionJoin
            {
                TraderId = trader.Id,
                CompetitionId = "demo-sprint-100k",
                CompetitionTitle = "Demo Sprint $100k",
                Login = "comp100521",
                Password = "CmpDemo1!",
                Platform = "matchtrader",
                Server = "PropFirm-Comp",
                AccountSize = 100_000m,
                Equity = 100_000m,
            });
        }
        else
        {
            if (comp.AccountSize <= 0) comp.AccountSize = 100_000m;
            if (comp.Equity <= 0) comp.Equity = comp.AccountSize;
        }

        // Upcoming October competition — roster of joined traders (pre-start leaderboard).
        await EnsureUpcomingCompetitionRosterAsync(db, trader);
        await EnsureFeatureSuggestionSeedsAsync(db, trader);
        await EnsureDemoLoginHistoryAsync(db, trader);

        await db.SaveChangesAsync();
    }

    static async Task EnsureDemoLoginHistoryAsync(PropFirmDbContext db, Trader trader)
    {
        // Only seed when history is empty or still the old stub labels ("ok").
        var anyRich = await db.LoginHistories.AnyAsync(h =>
            h.TraderId == trader.Id &&
            h.ConnectionKind != null &&
            h.ConnectionKind != "residential" &&
            h.ConnectionLabel != null &&
            h.ConnectionLabel != "ok");
        if (anyRich) return;

        var hasAny = await db.LoginHistories.AnyAsync(h => h.TraderId == trader.Id);
        if (hasAny)
        {
            // Upgrade stub rows so Security page shows VPN/VPS badges for existing demos.
            var stubs = await db.LoginHistories
                .Where(h => h.TraderId == trader.Id && (h.ConnectionLabel == "ok" || h.ConnectionLabel == null))
                .OrderByDescending(h => h.CreatedAt)
                .Take(3)
                .ToListAsync();
            if (stubs.Count > 0)
            {
                stubs[0].Ip = "203.0.113.10";
                stubs[0].Country = "Germany";
                stubs[0].CountryCode = "DE";
                stubs[0].City = "Frankfurt";
                stubs[0].Isp = "Demo VPN Provider";
                stubs[0].Org = "Demo VPN";
                stubs[0].IsVpn = true;
                stubs[0].IsVps = false;
                stubs[0].ConnectionKind = "vpn";
                stubs[0].ConnectionLabel = "VPN / Proxy";
            }
            if (stubs.Count > 1)
            {
                stubs[1].Ip = "198.51.100.44";
                stubs[1].Country = "Netherlands";
                stubs[1].CountryCode = "NL";
                stubs[1].City = "Amsterdam";
                stubs[1].Isp = "Demo Datacenter";
                stubs[1].Org = "Demo Cloud";
                stubs[1].IsVpn = false;
                stubs[1].IsVps = true;
                stubs[1].ConnectionKind = "vps";
                stubs[1].ConnectionLabel = "VPS / Datacenter";
            }
            return;
        }

        db.LoginHistories.AddRange(
            new LoginHistory
            {
                TraderId = trader.Id,
                Ip = "203.0.113.10",
                Country = "Germany",
                CountryCode = "DE",
                City = "Frankfurt",
                Isp = "Demo VPN Provider",
                Org = "Demo VPN",
                IsVpn = true,
                IsVps = false,
                ConnectionKind = "vpn",
                ConnectionLabel = "VPN / Proxy",
                UserAgent = "DemoSeed/1.0",
                CreatedAt = DateTimeOffset.UtcNow.AddDays(-2),
            },
            new LoginHistory
            {
                TraderId = trader.Id,
                Ip = "198.51.100.44",
                Country = "Netherlands",
                CountryCode = "NL",
                City = "Amsterdam",
                Isp = "Demo Datacenter",
                Org = "Demo Cloud",
                IsVpn = false,
                IsVps = true,
                ConnectionKind = "vps",
                ConnectionLabel = "VPS / Datacenter",
                UserAgent = "DemoSeed/1.0",
                CreatedAt = DateTimeOffset.UtcNow.AddDays(-1),
            },
            new LoginHistory
            {
                TraderId = trader.Id,
                Ip = "8.8.8.8",
                Country = "United States",
                CountryCode = "US",
                City = "Mountain View",
                Isp = "Google LLC",
                Org = "Google Public DNS",
                IsVpn = false,
                IsVps = false,
                ConnectionKind = "residential",
                ConnectionLabel = "Residential (real IP)",
                UserAgent = "DemoSeed/1.0",
                CreatedAt = DateTimeOffset.UtcNow.AddHours(-3),
            });
    }

    static async Task EnsureFeatureSuggestionSeedsAsync(PropFirmDbContext db, Trader trader)
    {
        if (await db.FeatureSuggestions.AnyAsync(s => s.TraderId == trader.Id)) return;
        db.FeatureSuggestions.AddRange(
            new FeatureSuggestion
            {
                TraderId = trader.Id,
                Title = "Dark mode for accounts desk",
                Category = "ui-ux",
                Description = "Add a theme toggle so the accounts sidebar matches night trading sessions.",
                UseCase = "Late-night trading reviews without eye strain.",
                Priority = "medium",
                Status = "Submitted",
            },
            new FeatureSuggestion
            {
                TraderId = trader.Id,
                Title = "Export payout CSV",
                Category = "payments-payouts",
                Description = "Allow downloading payout history as CSV for accountants.",
                UseCase = "Monthly bookkeeping.",
                Priority = "high",
                Status = "Submitted",
            });
    }

    static async Task EnsureUpcomingCompetitionRosterAsync(PropFirmDbContext db, Trader demoTrader)
    {
        const string competitionId = "oct-2026-upcoming";
        const string title = "October 2026 Monthly Competition";

        async Task EnsureJoin(string traderId, string login)
        {
            var exists = await db.CompetitionJoins.AnyAsync(j =>
                j.TraderId == traderId && j.CompetitionId == competitionId);
            if (exists) return;
            db.CompetitionJoins.Add(new CompetitionJoin
            {
                TraderId = traderId,
                CompetitionId = competitionId,
                CompetitionTitle = title,
                Login = login,
                Password = "CmpDemo1!",
                Platform = "matchtrader",
                Server = "PropFirm-Comp",
                AccountSize = 100_000m,
                Equity = 100_000m,
            });
        }

        await EnsureJoin(demoTrader.Id, "compOctDemo");

        var roster = new (string Email, string Name, string Login)[]
        {
            ("comp.alice@propfirm.local", "Alice N", "compOctAlice"),
            ("comp.bruno@propfirm.local", "Bruno M", "compOctBruno"),
            ("comp.chen@propfirm.local", "Chen L", "compOctChen"),
            ("comp.daria@propfirm.local", "Daria K", "compOctDaria"),
            ("comp.eli@propfirm.local", "Eli R", "compOctEli"),
            ("comp.farah@propfirm.local", "Farah S", "compOctFarah"),
            ("comp.gio@propfirm.local", "Gio P", "compOctGio"),
            ("comp.hana@propfirm.local", "Hana T", "compOctHana"),
            ("comp.ivan@propfirm.local", "Ivan P", "compOctIvan"),
            ("comp.jade@propfirm.local", "Jade W", "compOctJade"),
            ("comp.kai@propfirm.local", "Kai M", "compOctKai"),
            ("comp.lena@propfirm.local", "Lena O", "compOctLena"),
            ("comp.marco@propfirm.local", "Marco V", "compOctMarco"),
            ("comp.nina@propfirm.local", "Nina B", "compOctNina"),
            ("comp.omar@propfirm.local", "Omar H", "compOctOmar"),
            ("comp.priya@propfirm.local", "Priya S", "compOctPriya"),
            ("comp.quinn@propfirm.local", "Quinn A", "compOctQuinn"),
            ("comp.rita@propfirm.local", "Rita C", "compOctRita"),
            ("comp.sam@propfirm.local", "Sam D", "compOctSam"),
            ("comp.tina@propfirm.local", "Tina E", "compOctTina"),
            ("comp.uma@propfirm.local", "Uma F", "compOctUma"),
            ("comp.vik@propfirm.local", "Vik G", "compOctVik"),
            ("comp.wren@propfirm.local", "Wren J", "compOctWren"),
            ("comp.yara@propfirm.local", "Yara Z", "compOctYara"),
        };

        foreach (var (email, name, login) in roster)
        {
            var row = await db.Traders.FirstOrDefaultAsync(t => t.Email == email);
            if (row is null)
            {
                row = new Trader
                {
                    Email = email,
                    DisplayName = name,
                    Role = "Trader",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("Trader1!"),
                };
                db.Traders.Add(row);
                await db.SaveChangesAsync();
            }

            await EnsureJoin(row.Id, login);
        }
    }
}
