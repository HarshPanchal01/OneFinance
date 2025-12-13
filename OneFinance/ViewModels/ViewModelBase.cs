using CommunityToolkit.Mvvm.ComponentModel;

namespace OneFinance.ViewModels;

public abstract partial class ViewModelBase : ObservableObject
{
    [ObservableProperty]
    private string _title = string.Empty;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(IsNotBusy))]
    private bool _isBusy;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(HasError))]
    private string? _errorMessage;

    public bool IsNotBusy => !IsBusy;
    public bool HasError => !string.IsNullOrEmpty(ErrorMessage);

    public virtual Task OnAppearingAsync() => Task.CompletedTask;

    protected async Task ExecuteAsync(Func<Task> operation)
    {
        if (IsBusy) return;
        try
        {
            IsBusy = true;
            ErrorMessage = null;
            await operation();
        }
        catch (Exception ex)
        {
            ErrorMessage = ex.Message;
        }
        finally
        {
            IsBusy = false;
        }
    }
}
