using SQLite;
using ONE_FINANCE.Models;

namespace ONE_FINANCE.Services;

/// <summary>
/// SQLite database service for local data persistence.
/// </summary>
public class DatabaseService : IDatabaseService
{
    private SQLiteAsyncConnection? _database;
    private readonly string _dbPath;

    public DatabaseService()
    {
        _dbPath = Path.Combine(FileSystem.AppDataDirectory, "onefinance.db3");
    }

    /// <inheritdoc/>
    public async Task InitializeAsync()
    {
        if (_database is not null)
            return;

        _database = new SQLiteAsyncConnection(_dbPath, SQLiteOpenFlags.ReadWrite | SQLiteOpenFlags.Create | SQLiteOpenFlags.SharedCache);

        // Create tables for all models
        await _database.CreateTableAsync<Transaction>();
        await _database.CreateTableAsync<Category>();

        // Seed default categories if needed
        await SeedDefaultCategoriesAsync();
    }

    /// <inheritdoc/>
    public async Task<List<T>> GetAllAsync<T>() where T : BaseEntity, new()
    {
        await InitializeAsync();
        return await _database!.Table<T>().ToListAsync();
    }

    /// <inheritdoc/>
    public async Task<T?> GetByIdAsync<T>(int id) where T : BaseEntity, new()
    {
        await InitializeAsync();
        return await _database!.Table<T>().FirstOrDefaultAsync(e => e.Id == id);
    }

    /// <inheritdoc/>
    public async Task<int> InsertAsync<T>(T entity) where T : BaseEntity, new()
    {
        await InitializeAsync();
        entity.CreatedAt = DateTime.UtcNow;
        return await _database!.InsertAsync(entity);
    }

    /// <inheritdoc/>
    public async Task<int> UpdateAsync<T>(T entity) where T : BaseEntity, new()
    {
        await InitializeAsync();
        entity.UpdatedAt = DateTime.UtcNow;
        return await _database!.UpdateAsync(entity);
    }

    /// <inheritdoc/>
    public async Task<int> DeleteAsync<T>(T entity) where T : BaseEntity, new()
    {
        await InitializeAsync();
        return await _database!.DeleteAsync(entity);
    }

    /// <summary>
    /// Seeds default categories for new installations.
    /// </summary>
    private async Task SeedDefaultCategoriesAsync()
    {
        var existingCategories = await _database!.Table<Category>().CountAsync();
        if (existingCategories > 0)
            return;

        var defaultCategories = new List<Category>
        {
            // Income categories
            new() { Name = "Salary", Type = TransactionType.Income, Icon = "💼", IsSystem = true },
            new() { Name = "Freelance", Type = TransactionType.Income, Icon = "💻", IsSystem = true },
            new() { Name = "Investments", Type = TransactionType.Income, Icon = "📈", IsSystem = true },
            new() { Name = "Other Income", Type = TransactionType.Income, Icon = "💰", IsSystem = true },

            // Expense categories
            new() { Name = "Food & Dining", Type = TransactionType.Expense, Icon = "🍔", IsSystem = true },
            new() { Name = "Transportation", Type = TransactionType.Expense, Icon = "🚗", IsSystem = true },
            new() { Name = "Shopping", Type = TransactionType.Expense, Icon = "🛒", IsSystem = true },
            new() { Name = "Entertainment", Type = TransactionType.Expense, Icon = "🎬", IsSystem = true },
            new() { Name = "Bills & Utilities", Type = TransactionType.Expense, Icon = "📄", IsSystem = true },
            new() { Name = "Healthcare", Type = TransactionType.Expense, Icon = "🏥", IsSystem = true },
            new() { Name = "Other Expense", Type = TransactionType.Expense, Icon = "📦", IsSystem = true },
        };

        foreach (var category in defaultCategories)
        {
            category.CreatedAt = DateTime.UtcNow;
            await _database.InsertAsync(category);
        }
    }
}
