using ONE_FINANCE.ViewModels;

namespace ONE_FINANCE.Views;

/// <summary>
/// Base page class that integrates with BaseViewModel lifecycle.
/// Inherit from this to get automatic OnAppearing/OnDisappearing calls to ViewModel.
/// </summary>
public abstract class BasePage<TViewModel> : ContentPage where TViewModel : BaseViewModel
{
    protected TViewModel ViewModel { get; }

    protected BasePage(TViewModel viewModel)
    {
        BindingContext = ViewModel = viewModel;
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        await ViewModel.OnAppearingAsync();
    }

    protected override async void OnDisappearing()
    {
        base.OnDisappearing();
        await ViewModel.OnDisappearingAsync();
    }
}
