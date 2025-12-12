using OneFinance.Models;

namespace OneFinance.Services;

public interface IDatabaseService
{
    Task InitializeAsync();
    Task<List<T>> GetAllAsync<T>() where T : BaseEntity, new();
    Task<T?> GetByIdAsync<T>(int id) where T : BaseEntity, new();
    Task<int> InsertAsync<T>(T entity) where T : BaseEntity, new();
    Task<int> UpdateAsync<T>(T entity) where T : BaseEntity, new();
    Task<int> DeleteAsync<T>(T entity) where T : BaseEntity, new();
    Task<List<Transaction>> GetTransactionsWithDetailsAsync();
    Task<List<Transaction>> GetTransactionsByMonthAsync(int year, int month);
    Task<List<Category>> GetCategoriesByTypeAsync(TransactionType type);
}
