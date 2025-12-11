using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows.Input;
using ONE_FINANCE.Services;

namespace ONE_FINANCE.ViewModels;

/// <summary>
/// Base view model class implementing INotifyPropertyChanged.
/// Provides common functionality for all view models including navigation.
/// </summary>
public abstract class BaseViewModel : INotifyPropertyChanged
{
    private bool _isBusy;
    private string _title = string.Empty;
    private string? _errorMessage;

    protected readonly INavigationService NavigationService;

    protected BaseViewModel()
    {
        NavigationService = ServiceHelper.GetRequiredService<INavigationService>();
    }

    /// <summary>
    /// Indicates if the view model is currently busy (loading, processing, etc.).
    /// </summary>
    public bool IsBusy
    {
        get => _isBusy;
        set
        {
            if (SetProperty(ref _isBusy, value))
                OnPropertyChanged(nameof(IsNotBusy));
        }
    }

    /// <summary>
    /// Inverse of IsBusy - useful for enabling/disabling UI elements.
    /// </summary>
    public bool IsNotBusy => !IsBusy;

    /// <summary>
    /// The title of the current page/view.
    /// </summary>
    public string Title
    {
        get => _title;
        set => SetProperty(ref _title, value);
    }

    /// <summary>
    /// Error message to display to the user.
    /// </summary>
    public string? ErrorMessage
    {
        get => _errorMessage;
        set
        {
            if (SetProperty(ref _errorMessage, value))
                OnPropertyChanged(nameof(HasError));
        }
    }

    /// <summary>
    /// Indicates if there is an error message to display.
    /// </summary>
    public bool HasError => !string.IsNullOrEmpty(ErrorMessage);

    public event PropertyChangedEventHandler? PropertyChanged;

    /// <summary>
    /// Sets a property value and raises PropertyChanged if the value changed.
    /// </summary>
    protected bool SetProperty<T>(ref T backingStore, T value, [CallerMemberName] string propertyName = "")
    {
        if (EqualityComparer<T>.Default.Equals(backingStore, value))
            return false;

        backingStore = value;
        OnPropertyChanged(propertyName);
        return true;
    }

    /// <summary>
    /// Raises the PropertyChanged event for the specified property.
    /// </summary>
    protected void OnPropertyChanged([CallerMemberName] string propertyName = "")
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }

    /// <summary>
    /// Executes an async operation with busy indicator and error handling.
    /// </summary>
    protected async Task ExecuteAsync(Func<Task> operation, string? errorMessage = null)
    {
        if (IsBusy)
            return;

        try
        {
            IsBusy = true;
            ErrorMessage = null;
            await operation();
        }
        catch (Exception ex)
        {
            ErrorMessage = errorMessage ?? ex.Message;
            System.Diagnostics.Debug.WriteLine($"Error: {ex}");
        }
        finally
        {
            IsBusy = false;
        }
    }

    /// <summary>
    /// Executes an async operation with busy indicator and returns a result.
    /// </summary>
    protected async Task<T?> ExecuteAsync<T>(Func<Task<T>> operation, string? errorMessage = null)
    {
        if (IsBusy)
            return default;

        try
        {
            IsBusy = true;
            ErrorMessage = null;
            return await operation();
        }
        catch (Exception ex)
        {
            ErrorMessage = errorMessage ?? ex.Message;
            System.Diagnostics.Debug.WriteLine($"Error: {ex}");
            return default;
        }
        finally
        {
            IsBusy = false;
        }
    }

    /// <summary>
    /// Called when the page appears. Override to load data.
    /// </summary>
    public virtual Task OnAppearingAsync() => Task.CompletedTask;

    /// <summary>
    /// Called when the page disappears. Override to cleanup.
    /// </summary>
    public virtual Task OnDisappearingAsync() => Task.CompletedTask;
}
