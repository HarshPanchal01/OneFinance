namespace ONE_FINANCE.Services;

/// <summary>
/// Service locator for accessing services from anywhere in the app.
/// Use this sparingly - prefer constructor injection when possible.
/// Useful for places where DI is not available (e.g., converters, static methods).
/// </summary>
public static class ServiceHelper
{
    /// <summary>
    /// Gets a registered service from the DI container.
    /// </summary>
    /// <typeparam name="T">The type of service to retrieve.</typeparam>
    /// <returns>The service instance, or null if not registered.</returns>
    public static T? GetService<T>() where T : class
    {
        return Current?.GetService<T>();
    }

    /// <summary>
    /// Gets a required service from the DI container.
    /// Throws if the service is not registered.
    /// </summary>
    /// <typeparam name="T">The type of service to retrieve.</typeparam>
    /// <returns>The service instance.</returns>
    /// <exception cref="InvalidOperationException">Thrown when the service is not registered.</exception>
    public static T GetRequiredService<T>() where T : class
    {
        return Current?.GetService<T>() 
            ?? throw new InvalidOperationException($"Service {typeof(T).Name} is not registered.");
    }

    private static IServiceProvider? Current =>
#if WINDOWS
        MauiWinUIApplication.Current?.Services;
#elif ANDROID
        MauiApplication.Current?.Services;
#elif IOS || MACCATALYST
        MauiUIApplicationDelegate.Current?.Services;
#else
        null;
#endif
}
