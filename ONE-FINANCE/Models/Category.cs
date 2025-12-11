using SQLite;

namespace ONE_FINANCE.Models;

/// <summary>
/// Represents a category for organizing transactions.
/// </summary>
public class Category : BaseEntity
{
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? Icon { get; set; }

    [MaxLength(20)]
    public string? Color { get; set; }

    /// <summary>
    /// Indicates if this category is for income or expense transactions.
    /// </summary>
    public TransactionType Type { get; set; }

    /// <summary>
    /// Indicates if this is a system-defined category that cannot be deleted.
    /// </summary>
    public bool IsSystem { get; set; }
}
