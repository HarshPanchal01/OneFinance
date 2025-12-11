using ONE_FINANCE.Services;

namespace ONE_FINANCE.ViewModels;

/// <summary>
/// View model for the Dashboard (main landing page).
/// </summary>
public class DashboardViewModel : BaseViewModel
{
    private readonly IDatabaseService _databaseService;

    private decimal _totalIncome;
    private decimal _totalExpenses;
    private decimal _balance;

    public DashboardViewModel(IDatabaseService databaseService)
    {
        _databaseService = databaseService;
        Title = "Dashboard";
    }

    /// <summary>
    /// Total income amount.
    /// </summary>
    public decimal TotalIncome
    {
        get => _totalIncome;
        set => SetProperty(ref _totalIncome, value);
    }

    /// <summary>
    /// Total expenses amount.
    /// </summary>
    public decimal TotalExpenses
    {
        get => _totalExpenses;
        set => SetProperty(ref _totalExpenses, value);
    }

    /// <summary>
    /// Current balance (income - expenses).
    /// </summary>
    public decimal Balance
    {
        get => _balance;
        set => SetProperty(ref _balance, value);
    }

    /// <summary>
    /// Called when the page appears. Loads dashboard data.
    /// </summary>
    public override async Task OnAppearingAsync()
    {
        await LoadDataAsync();
    }

    /// <summary>
    /// Loads the dashboard data.
    /// </summary>
    private async Task LoadDataAsync()
    {
        await ExecuteAsync(async () =>
        {
            var transactions = await _databaseService.GetAllAsync<Models.Transaction>();

            TotalIncome = transactions
                .Where(t => t.Type == Models.TransactionType.Income)
                .Sum(t => t.Amount);

            TotalExpenses = transactions
                .Where(t => t.Type == Models.TransactionType.Expense)
                .Sum(t => t.Amount);

            Balance = TotalIncome - TotalExpenses;
        }, "Failed to load dashboard data");
    }

    // Example: Navigate to add transaction page (for future use)
    // public async Task NavigateToAddTransaction()
    // {
    //     await NavigationService.NavigateToAsync(AppRoutes.AddTransaction);
    // }
}
