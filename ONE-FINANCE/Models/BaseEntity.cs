using SQLite;

namespace ONE_FINANCE.Models;

/// <summary>
/// Base entity class for all database models.
/// Provides common properties like Id and timestamps.
/// </summary>
public abstract class BaseEntity
{
    [PrimaryKey, AutoIncrement]
    public int Id { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }
}
