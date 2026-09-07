using Microsoft.EntityFrameworkCore;
using PropFirm.SharedKernel;

namespace PropFirm.Infrastructure.Persistence;

public sealed class PropFirmDbContext : DbContext, IUnitOfWork
{
    public PropFirmDbContext(DbContextOptions<PropFirmDbContext> options) : base(options) { }

    public DbSet<Trader> Traders => Set<Trader>();
    public DbSet<LoginHistory> LoginHistories => Set<LoginHistory>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<Challenge> Challenges => Set<Challenge>();
    public DbSet<TradingAccount> TradingAccounts => Set<TradingAccount>();
    public DbSet<Trade> Trades => Set<Trade>();
    public DbSet<Wallet> Wallets => Set<Wallet>();
    public DbSet<PayoutRequest> PayoutRequests => Set<PayoutRequest>();
    public DbSet<NotificationMessage> Notifications => Set<NotificationMessage>();
    public DbSet<AuditEntry> AuditEntries => Set<AuditEntry>();
    public DbSet<CompetitionJoin> CompetitionJoins => Set<CompetitionJoin>();
    public DbSet<FeatureSuggestion> FeatureSuggestions => Set<FeatureSuggestion>();

    public Task<int> SaveEntitiesAsync(CancellationToken cancellationToken = default) =>
        SaveChangesAsync(cancellationToken);

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("propfirm");

        modelBuilder.Entity<Trader>(e =>
        {
            e.ToTable("traders");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.Email).HasMaxLength(200);
            e.Property(x => x.DisplayName).HasMaxLength(200);
            e.Property(x => x.Role).HasMaxLength(64);
            e.Ignore(x => x.DomainEvents);
        });

        modelBuilder.Entity<LoginHistory>(e =>
        {
            e.ToTable("login_history");
            e.HasKey(x => x.Id);
            e.Ignore(x => x.DomainEvents);
        });

        modelBuilder.Entity<Product>(e =>
        {
            e.ToTable("challenge_products");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Sku).IsUnique();
            e.Ignore(x => x.DomainEvents);
        });

        modelBuilder.Entity<Order>(e =>
        {
            e.ToTable("orders");
            e.HasKey(x => x.Id);
            e.Ignore(x => x.DomainEvents);
        });

        modelBuilder.Entity<Challenge>(e =>
        {
            e.ToTable("challenge_instances");
            e.HasKey(x => x.Id);
            e.Ignore(x => x.DomainEvents);
        });

        modelBuilder.Entity<TradingAccount>(e =>
        {
            e.ToTable("trading_accounts");
            e.HasKey(x => x.Id);
            e.Ignore(x => x.DomainEvents);
        });

        modelBuilder.Entity<Trade>(e =>
        {
            e.ToTable("trades");
            e.HasKey(x => x.Id);
            e.Ignore(x => x.DomainEvents);
        });

        modelBuilder.Entity<Wallet>(e =>
        {
            e.ToTable("trader_wallets");
            e.HasKey(x => x.TraderId);
        });

        modelBuilder.Entity<PayoutRequest>(e =>
        {
            e.ToTable("payout_requests");
            e.HasKey(x => x.Id);
            e.Ignore(x => x.DomainEvents);
        });

        modelBuilder.Entity<NotificationMessage>(e =>
        {
            e.ToTable("notification_messages");
            e.HasKey(x => x.Id);
            e.Ignore(x => x.DomainEvents);
        });

        modelBuilder.Entity<AuditEntry>(e =>
        {
            e.ToTable("audit_entries");
            e.HasKey(x => x.Id);
            e.Ignore(x => x.DomainEvents);
        });

        modelBuilder.Entity<CompetitionJoin>(e =>
        {
            e.ToTable("competition_joins");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.TraderId, x.CompetitionId }).IsUnique();
            e.Ignore(x => x.DomainEvents);
        });

        modelBuilder.Entity<FeatureSuggestion>(e =>
        {
            e.ToTable("feature_suggestions");
            e.HasKey(x => x.Id);
            e.Property(x => x.Title).HasMaxLength(200);
            e.Property(x => x.Category).HasMaxLength(100);
            e.Property(x => x.Priority).HasMaxLength(40);
            e.Property(x => x.Status).HasMaxLength(40);
            e.Ignore(x => x.DomainEvents);
        });
    }
}
