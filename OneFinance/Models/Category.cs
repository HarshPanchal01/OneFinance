using SQLite;

namespace OneFinance.Models;

[Table("Categories")]
public class Category : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public TransactionType Type { get; set; }
    public string Icon { get; set; } = "📁";
    public bool IsSystem { get; set; }

    [Ignore]
    public string DisplayName => $"{Icon} {Name}";
}
