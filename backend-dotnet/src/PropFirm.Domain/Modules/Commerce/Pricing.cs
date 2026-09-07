using PropFirm.SharedKernel;

namespace PropFirm.Domain.Modules.Commerce;

public sealed record Coupon(string Code, string Kind, decimal Value, decimal MinSubtotal = 0, bool Active = true);

public sealed record CouponQuote(
    string Code,
    string Kind,
    decimal Value,
    decimal DiscountAmount,
    decimal FinalTotal,
    string Message);

public static class Pricing
{
    public static string NormalizeCode(string? code) => (code ?? string.Empty).Trim().ToUpperInvariant();

    public static readonly IReadOnlyDictionary<string, Coupon> DemoCoupons = new Dictionary<string, Coupon>
    {
        ["WELCOME10"] = new("WELCOME10", "percent", 10),
        ["SAVE20"] = new("SAVE20", "percent", 20),
        ["FLAT50"] = new("FLAT50", "flat", 50, 50),
        ["FREEPASS"] = new("FREEPASS", "percent", 100),
        ["EXPIRED"] = new("EXPIRED", "percent", 15, Active: false),
    };

    public static Coupon? LookupCoupon(string? code) =>
        DemoCoupons.TryGetValue(NormalizeCode(code), out var c) ? c : null;

    public static CouponQuote ApplyCoupon(Coupon coupon, decimal subtotal)
    {
        var code = NormalizeCode(coupon.Code);
        if (string.IsNullOrEmpty(code)) throw new DomainError("coupon code required");
        if (!coupon.Active) throw new DomainError("coupon is not active");
        if (subtotal < 0) throw new DomainError("invalid subtotal");
        if (subtotal < coupon.MinSubtotal)
            throw new DomainError($"minimum subtotal for this coupon is {coupon.MinSubtotal:F2}");

        decimal discount;
        string message;
        if (coupon.Kind == "percent")
        {
            if (coupon.Value <= 0 || coupon.Value > 100) throw new DomainError("invalid percent coupon");
            discount = Math.Round(subtotal * (coupon.Value / 100m), 2);
            message = $"Coupon applied: {coupon.Value:G}% off";
        }
        else if (coupon.Kind == "flat")
        {
            if (coupon.Value <= 0) throw new DomainError("invalid flat coupon");
            discount = Math.Round(Math.Min(coupon.Value, subtotal), 2);
            message = $"Coupon applied: ${coupon.Value:F2} off";
        }
        else throw new DomainError("unknown coupon kind");

        var final = Math.Round(Math.Max(0m, subtotal - discount), 2);
        return new CouponQuote(code, coupon.Kind, coupon.Value, discount, final, message);
    }

    public static (decimal Total, string Platform) PriceOrder(
        decimal productPrice,
        bool addonSwapFree,
        string? platform,
        int quantity)
    {
        var p = (platform ?? "mt5").ToLowerInvariant();
        if (p is not ("mt5" or "matchtrader" or "ctrader")) p = "mt5";
        var fee = p == "ctrader" ? 20m : 0m;
        var q = Math.Clamp(quantity <= 0 ? 1 : quantity, 1, 10);
        var mult = addonSwapFree ? 1.1m : 1m;
        var unit = productPrice * mult + fee;
        return (Math.Round(unit * q, 2), p);
    }
}
