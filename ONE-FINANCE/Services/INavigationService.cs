namespace ONE_FINANCE.Services;

/// <summary>
/// Interface for navigation operations.
/// Provides a testable abstraction over Shell navigation.
/// </summary>
public interface INavigationService
{
    /// <summary>
    /// Navigates to the specified route.
    /// Use AppRoutes constants for type-safe navigation.
    /// </summary>
    /// <param name="route">The route to navigate to (use AppRoutes constants).</param>
    /// <param name="animate">Whether to animate the transition.</param>
    Task NavigateToAsync(string route, bool animate = true);

    /// <summary>
    /// Navigates to the specified route with parameters.
    /// </summary>
    /// <param name="route">The route to navigate to.</param>
    /// <param name="parameters">Dictionary of parameters to pass.</param>
    /// <param name="animate">Whether to animate the transition.</param>
    Task NavigateToAsync(string route, IDictionary<string, object> parameters, bool animate = true);

    /// <summary>
    /// Navigates to the specified route with a single parameter.
    /// </summary>
    /// <param name="route">The route to navigate to.</param>
    /// <param name="paramName">The parameter name.</param>
    /// <param name="paramValue">The parameter value.</param>
    Task NavigateToAsync(string route, string paramName, object paramValue);

    /// <summary>
    /// Navigates back to the previous page.
    /// </summary>
    Task GoBackAsync();

    /// <summary>
    /// Navigates back to the root/home page.
    /// </summary>
    Task GoToRootAsync();
}
