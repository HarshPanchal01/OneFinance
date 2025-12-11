namespace ONE_FINANCE.Services;

/// <summary>
/// Navigation service implementation using Shell navigation.
/// Provides centralized, testable navigation throughout the app.
/// </summary>
public class NavigationService : INavigationService
{
    /// <inheritdoc/>
    public async Task NavigateToAsync(string route, bool animate = true)
    {
        await Shell.Current.GoToAsync(route, animate);
    }

    /// <inheritdoc/>
    public async Task NavigateToAsync(string route, IDictionary<string, object> parameters, bool animate = true)
    {
        await Shell.Current.GoToAsync(route, animate, parameters);
    }

    /// <inheritdoc/>
    public async Task NavigateToAsync(string route, string paramName, object paramValue)
    {
        var parameters = new Dictionary<string, object> { { paramName, paramValue } };
        await Shell.Current.GoToAsync(route, parameters);
    }

    /// <inheritdoc/>
    public async Task GoBackAsync()
    {
        await Shell.Current.GoToAsync("..");
    }

    /// <inheritdoc/>
    public async Task GoToRootAsync()
    {
        await Shell.Current.GoToAsync("//");
    }
}
