namespace PropFirm.Infrastructure.Persistence;

/// <summary>Full evaluation-plan catalog (parity with Python <c>seed_data.build_catalog</c>).</summary>
public static class CatalogSeed
{
    public static IReadOnlyList<Product> Build()
    {
        var outList = new List<Product>();

        void AddTwoStep(string variant, string tagline, decimal maxLoss, decimal daily, decimal p1, decimal p2,
            decimal split, int minDays, int maxDays, (int size, decimal price, bool popular)[] ladder)
        {
            var nameV = char.ToUpper(variant[0]) + variant[1..];
            foreach (var (size, price, popular) in ladder)
            {
                outList.Add(new Product
                {
                    Sku = $"2STEP-{variant.ToUpperInvariant()}-{SizeLabel(size)}",
                    Name = $"2-Step {nameV} ${SizeLabel(size)}",
                    PhaseFamily = "two_step",
                    Variant = variant,
                    AccountSize = size,
                    Price = price,
                    Phases = 2,
                    ProfitTargetPct = p1,
                    Phase1TargetPct = p1,
                    Phase2TargetPct = p2,
                    DailyLossPct = daily,
                    MaxLossPct = maxLoss,
                    MinTradingDays = minDays,
                    MaxTradingDays = maxDays,
                    ProfitSplitPct = split,
                    IsMostPopular = popular,
                    IsActive = true,
                });
            }
        }

        AddTwoStep("standard", "Highest Profit Split", 10, 5, 8, 5, 80, 3, 30,
        [
            (5000, 36, false), (10000, 66, false), (25000, 179, false),
            (50000, 299, false), (100000, 549, false), (200000, 1099, false),
        ]);
        AddTwoStep("flex", "Biggest Max Loss", 12, 4, 10, 6, 95, 1, 0,
        [
            (5000, 32, false), (10000, 59, false), (25000, 159, false),
            (50000, 269, false), (100000, 499, true), (200000, 999, false),
        ]);
        AddTwoStep("pro", "Lowest Profit Target", 6, 3, 6, 6, 80, 2, 45,
        [
            (5000, 29, false), (10000, 55, false), (25000, 134, false),
            (50000, 224, false), (100000, 422, false), (200000, 844, false),
        ]);

        int[] sizes = [5000, 10000, 25000, 50000, 100000, 200000];
        decimal[] onePrices = [66, 99, 199, 329, 599, 1199];
        for (var i = 0; i < sizes.Length; i++)
        {
            var size = sizes[i];
            outList.Add(new Product
            {
                Sku = $"1STEP-FLEX-{SizeLabel(size)}",
                Name = $"1-Step Flex ${SizeLabel(size)}",
                PhaseFamily = "one_step_flex",
                Variant = "flex",
                AccountSize = size,
                Price = onePrices[i],
                Phases = 1,
                ProfitTargetPct = 10,
                Phase1TargetPct = 10,
                Phase2TargetPct = 0,
                DailyLossPct = 4,
                MaxLossPct = 12,
                MinTradingDays = 0,
                MaxTradingDays = 0,
                ProfitSplitPct = 95,
                IsMostPopular = size == 100000,
                IsActive = true,
            });
        }

        decimal[] zeroPrices = [60, 99, 219, 379, 699, 1399];
        for (var i = 0; i < sizes.Length; i++)
        {
            var size = sizes[i];
            outList.Add(new Product
            {
                Sku = $"ZERO-{SizeLabel(size)}",
                Name = $"Zero ${SizeLabel(size)}",
                PhaseFamily = "zero",
                Variant = "standard",
                AccountSize = size,
                Price = zeroPrices[i],
                Phases = 1,
                ProfitTargetPct = 0,
                Phase1TargetPct = 0,
                Phase2TargetPct = 0,
                DailyLossPct = 4,
                MaxLossPct = 10,
                MinTradingDays = 0,
                MaxTradingDays = 0,
                ProfitSplitPct = 85,
                IsMostPopular = size == 100000,
                IsActive = true,
            });
        }

        return outList;
    }

    static string SizeLabel(int n) => n >= 1000 ? $"{n / 1000}K" : $"{n}";
}
