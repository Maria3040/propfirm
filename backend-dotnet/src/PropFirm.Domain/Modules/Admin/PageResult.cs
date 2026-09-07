namespace PropFirm.Domain.Modules.Admin;

/// <summary>Shared list envelope for admin tables (server-side pagination).</summary>
public sealed record PageResult<T>(
    IReadOnlyList<T> Items,
    int Page,
    int PageSize,
    int Total,
    int TotalPages,
    string SortBy,
    string SortDir,
    string? Q,
    IReadOnlyDictionary<string, object?> Filters)
{
    public static PageResult<T> Create(
        IReadOnlyList<T> items,
        int page,
        int pageSize,
        int total,
        string sortBy,
        string sortDir,
        string? q,
        IReadOnlyDictionary<string, object?>? filters = null)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var totalPages = total == 0 ? 1 : (int)Math.Ceiling(total / (double)pageSize);
        return new(items, page, pageSize, total, totalPages, sortBy, sortDir, q, filters ?? new Dictionary<string, object?>());
    }
}

public static class ListQuery
{
    public static (int Page, int PageSize, string SortDir) Normalize(int page, int pageSize, string? sortDir)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize <= 0 ? 20 : pageSize, 1, 100);
        var dir = string.Equals(sortDir, "asc", StringComparison.OrdinalIgnoreCase) ? "asc" : "desc";
        return (page, pageSize, dir);
    }
}
