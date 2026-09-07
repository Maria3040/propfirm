using PropFirm.SharedKernel;

namespace PropFirm.Infrastructure.Persistence;

public class Trader : Entity<string>
{
    public Trader() { Id = Guid.NewGuid().ToString("D"); }
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string Role { get; set; } = "Trader";
    public bool TwoFactorEnabled { get; set; }
    public string PreferredLanguage { get; set; } = "en";
    /// <summary>None | Pending | Approved | Rejected</summary>
    public string VerificationStatus { get; set; } = "None";
    public DateTimeOffset? VerificationRequestedAt { get; set; }
    public DateTimeOffset? VerificationDecidedAt { get; set; }
    public string? VerificationAdminComment { get; set; }
    public string? AffiliateCode { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class LoginHistory : Entity<string>
{
    public LoginHistory() { Id = Guid.NewGuid().ToString("D"); }
    public string TraderId { get; set; } = "";
    public string? Ip { get; set; }
    public string? Country { get; set; }
    public string? CountryCode { get; set; }
    public string? City { get; set; }
    public string? Isp { get; set; }
    public string? Org { get; set; }
    public bool IsVpn { get; set; }
    public bool IsVps { get; set; }
    public string? ConnectionKind { get; set; }
    public string? ConnectionLabel { get; set; }
    public string? UserAgent { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class Product : Entity<string>
{
    public Product() { Id = Guid.NewGuid().ToString("D"); }
    public string Sku { get; set; } = "";
    public string Name { get; set; } = "";
    public string PhaseFamily { get; set; } = "two_step";
    public string Variant { get; set; } = "flex";
    public decimal AccountSize { get; set; }
    public decimal Price { get; set; }
    public int Phases { get; set; } = 2;
    public decimal ProfitTargetPct { get; set; }
    public decimal Phase1TargetPct { get; set; }
    public decimal Phase2TargetPct { get; set; }
    public decimal DailyLossPct { get; set; }
    public decimal MaxLossPct { get; set; }
    public int MinTradingDays { get; set; }
    /// <summary>0 = unlimited. When &gt; 0, exceeding days breaches the challenge.</summary>
    public int MaxTradingDays { get; set; }
    public decimal ProfitSplitPct { get; set; } = 85;
    public bool IsMostPopular { get; set; }
    public bool IsActive { get; set; } = true;
}

public class Order : Entity<string>
{
    public Order() { Id = Guid.NewGuid().ToString("D"); }
    public string TraderId { get; set; } = "";
    public string ProductId { get; set; } = "";
    public string Sku { get; set; } = "";
    public decimal Price { get; set; }
    public decimal AccountSize { get; set; }
    public int Phases { get; set; }
    public decimal ProfitTargetPct { get; set; }
    public decimal Phase1TargetPct { get; set; }
    public decimal Phase2TargetPct { get; set; }
    public decimal DailyLossPct { get; set; }
    public decimal MaxLossPct { get; set; }
    public int MinTradingDays { get; set; }
    public int MaxTradingDays { get; set; }
    public bool AddonSwapFree { get; set; }
    public string Platform { get; set; } = "mt5";
    public string Status { get; set; } = "Pending";
    public string? PaymentIntentId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? PaidAt { get; set; }
}

public class Challenge : Entity<string>
{
    public Challenge() { Id = Guid.NewGuid().ToString("D"); }
    public string TraderId { get; set; } = "";
    public string? OrderId { get; set; }
    public string ProductId { get; set; } = "";
    public string Sku { get; set; } = "";
    public decimal AccountSize { get; set; }
    public string Status { get; set; } = "Active";
    public string? FailReason { get; set; }
    public int CurrentPhase { get; set; } = 1;
    public int Phases { get; set; } = 2;
    public decimal ProfitTargetPct { get; set; }
    public decimal Phase1TargetPct { get; set; }
    public decimal Phase2TargetPct { get; set; }
    public decimal DailyLossPct { get; set; }
    public decimal MaxLossPct { get; set; }
    public int MinTradingDays { get; set; }
    public int MaxTradingDays { get; set; }
    public decimal ProfitSplitPct { get; set; } = 85;
    public bool Archived { get; set; }
    /// <summary>Status before archive (for undo).</summary>
    public string? PreviousStatus { get; set; }
    public string? ArchiveUndoToken { get; set; }
    /// <summary>Prior challenge this account was provisioned from (phase pass / funded).</summary>
    public string? SourceChallengeId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class TradingAccount : Entity<string>
{
    public TradingAccount() { Id = Guid.NewGuid().ToString("D"); }
    public string ChallengeId { get; set; } = "";
    public string TraderId { get; set; } = "";
    public string Login { get; set; } = "";
    public string Password { get; set; } = "";
    public string Server { get; set; } = "PropFirm-Demo";
    public string Platform { get; set; } = "mt5";
    public decimal StartingBalance { get; set; }
    public decimal Equity { get; set; }
    public decimal HighWaterMark { get; set; }
    public bool Locked { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class CompetitionJoin : Entity<string>
{
    public CompetitionJoin() { Id = Guid.NewGuid().ToString("D"); }
    public string TraderId { get; set; } = "";
    public string CompetitionId { get; set; } = "";
    public string? CompetitionTitle { get; set; }
    public string Login { get; set; } = "";
    public string Password { get; set; } = "";
    public string Platform { get; set; } = "matchtrader";
    public string Server { get; set; } = "PropFirm-Comp";
    public decimal AccountSize { get; set; } = 100_000m;
    public decimal Equity { get; set; } = 100_000m;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class Trade : Entity<string>
{
    public Trade() { Id = Guid.NewGuid().ToString("D"); }
    public string AccountId { get; set; } = "";
    public string ChallengeId { get; set; } = "";
    public string Symbol { get; set; } = "";
    public string Side { get; set; } = "";
    public decimal Lots { get; set; }
    public decimal Pnl { get; set; }
    public decimal EquityAfter { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class Wallet
{
    public string TraderId { get; set; } = "";
    public decimal AvailableBalance { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class PayoutRequest : Entity<string>
{
    public PayoutRequest() { Id = Guid.NewGuid().ToString("D"); }
    public string TraderId { get; set; } = "";
    public decimal Amount { get; set; }
    public string Status { get; set; } = "Pending";
    public string? ChallengeId { get; set; }
    public string? Method { get; set; }
    public string? RewardType { get; set; }
    public string? CryptoNetwork { get; set; }
    public string? CryptoAddress { get; set; }
    public string? VpsInvoiceStatus { get; set; }
    public string? IpRiskNote { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? DecidedAt { get; set; }
}

public class NotificationMessage : Entity<string>
{
    public NotificationMessage() { Id = Guid.NewGuid().ToString("D"); }
    public string ToEmail { get; set; } = "";
    public string Subject { get; set; } = "";
    public string Body { get; set; } = "";
    public string Status { get; set; } = "Queued";
    public string? DeliveryDetail { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class AuditEntry : Entity<string>
{
    public AuditEntry() { Id = Guid.NewGuid().ToString("D"); }
    public string EventType { get; set; } = "";
    public string Source { get; set; } = "";
    public string Summary { get; set; } = "";
    public string? PayloadJson { get; set; }
    public DateTimeOffset OccurredAt { get; set; } = DateTimeOffset.UtcNow;
}

public class FeatureSuggestion : Entity<string>
{
    public FeatureSuggestion() { Id = Guid.NewGuid().ToString("D"); }
    public string TraderId { get; set; } = "";
    public string Title { get; set; } = "";
    public string Category { get; set; } = "";
    public string Description { get; set; } = "";
    public string? UseCase { get; set; }
    public string Priority { get; set; } = "medium";
    public string Status { get; set; } = "Submitted";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
