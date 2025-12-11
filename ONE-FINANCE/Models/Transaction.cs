using SQLite;

namespace ONE_FINANCE.Models;

/// <summary>
/// Represents a financial transaction (income or expense).
/// </summary>
public class Transaction : BaseEntity
{
    [MaxLength(200)]
    public string Description { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    public TransactionType Type { get; set; }

    [MaxLength(100)]
    public string Category { get; set; } = string.Empty;

    public DateTime Date { get; set; } = DateTime.Today;

    [MaxLength(500)]
    public string? Notes { get; set; }
}

/// <summary>
/// Defines the type of transaction.
/// </summary>
public enum TransactionType
{
    Income,
    Expense
}
