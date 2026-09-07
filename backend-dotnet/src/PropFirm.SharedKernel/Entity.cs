namespace PropFirm.SharedKernel;

/// <summary>Book ch07-aligned entity base with domain-event collection.</summary>
public abstract class Entity<TId> : IEntity<TId> where TId : notnull
{
    public virtual TId Id { get; protected set; } = default!;

    public bool IsTransient() => EqualityComparer<TId>.Default.Equals(Id, default!);

    public override bool Equals(object? obj) => obj is Entity<TId> other && Equals(other);

    public bool Equals(IEntity<TId>? other)
    {
        if (other is null || other.IsTransient() || IsTransient()) return false;
        return EqualityComparer<TId>.Default.Equals(Id, other.Id);
    }

    public override int GetHashCode() =>
        IsTransient() ? base.GetHashCode() : HashCode.Combine(Id);

    private List<IEventNotification>? _domainEvents;

    public IReadOnlyCollection<IEventNotification> DomainEvents =>
        (IReadOnlyCollection<IEventNotification>?)_domainEvents ?? Array.Empty<IEventNotification>();

    public void AddDomainEvent(IEventNotification evt)
    {
        _domainEvents ??= new List<IEventNotification>();
        _domainEvents.Add(evt);
    }

    public void RemoveDomainEvent(IEventNotification evt) => _domainEvents?.Remove(evt);

    public void ClearDomainEvents() => _domainEvents?.Clear();
}

public interface IEntity<TId> where TId : notnull
{
    TId Id { get; }
    bool IsTransient();
}

public interface IEventNotification { }

public interface IUnitOfWork
{
    Task<int> SaveEntitiesAsync(CancellationToken cancellationToken = default);
}

public interface IRepository
{
}

public interface IRepository<T> : IRepository where T : class
{
    IUnitOfWork UnitOfWork { get; }
}

public sealed class DomainError : Exception
{
    public DomainError(string message) : base(message) { }
}
