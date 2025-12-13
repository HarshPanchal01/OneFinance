namespace OneFinance.Services;

public interface INavigationService
{
    string CurrentView { get; }
    event Action<string>? NavigationChanged;
    void NavigateTo(string viewName, object? parameter = null);
    object? GetCurrentParameter();
    void GoBack();
    bool CanGoBack { get; }
}
