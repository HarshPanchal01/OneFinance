using ONE_FINANCE.Views;

namespace ONE_FINANCE;

public partial class AppShell : Shell
{
	public AppShell()
	{
		InitializeComponent();

		// Register routes for pages that need programmatic navigation
		// (pages not in the flyout/tab structure)
		// Example: Routing.RegisterRoute(AppRoutes.AddTransaction, typeof(AddTransactionPage));
		
		RegisterRoutes();
	}

	/// <summary>
	/// Register all routes for navigation.
	/// Add new routes here as you create new pages.
	/// </summary>
	private static void RegisterRoutes()
	{
		// Detail/Modal pages that are navigated to programmatically
		// Routing.RegisterRoute(AppRoutes.AddTransaction, typeof(AddTransactionPage));
		// Routing.RegisterRoute(AppRoutes.TransactionDetail, typeof(TransactionDetailPage));
	}
}
