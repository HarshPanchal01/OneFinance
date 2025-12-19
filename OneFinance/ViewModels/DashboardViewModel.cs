using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using OneFinance.Models;
using OneFinance.Services;

namespace OneFinance.ViewModels;

public partial class DashboardViewModel : ViewModelBase
{
    private readonly IDatabaseService _databaseService;

    [ObservableProperty] private decimal _totalIncome;
    [ObservableProperty] private decimal _totalExpenses;
    [ObservableProperty] private decimal _balance;
    [ObservableProperty] private ObservableCollection<Transaction> _recentTransactions = new();

    public DashboardViewModel(IDatabaseService databaseService)
    {
        _databaseService = databaseService;
        Title = "Dashboard";
    }

    public override async Task OnAppearingAsync() => await LoadDataAsync();

    [RelayCommand]
    private async Task LoadDataAsync()
    {
        await ExecuteAsync(async () =>
        {
            var transactions = await _databaseService.GetTransactionsWithDetailsAsync();
            var accounts = await _databaseService.GetAccountsAsync();
            TotalIncome = transactions.Where(t => t.Type == TransactionType.Income).Sum(t => t.Amount);
            TotalExpenses = transactions.Where(t => t.Type == TransactionType.Expense).Sum(t => t.Amount);
            Balance = TotalIncome - TotalExpenses;
            Balance += accounts.Sum(t => t.Balance);
            RecentTransactions = new ObservableCollection<Transaction>(transactions.Take(5));
        });
    }
}
