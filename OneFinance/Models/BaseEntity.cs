using SQLite;

namespace OneFinance.Models;

/// <summary>
/// Base entity with common properties for all models.
/// </summary>
public abstract class BaseEntity
{
    [PrimaryKey, AutoIncrement]
    public int Id { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }
}
