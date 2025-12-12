using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace OneFinance.ViewModels;

public partial class SettingsViewModel : ViewModelBase
{
    [ObservableProperty] private string _appVersion = "1.0.0";
    [ObservableProperty] private string _databaseLocation;

    public SettingsViewModel()
    {
        Title = "Settings";
        _databaseLocation = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "OneFinance", "onefinance.db3");
    }

    [RelayCommand]
    private void OpenDatabaseFolder()
    {
        var folder = Path.GetDirectoryName(DatabaseLocation);
        if (folder != null && Directory.Exists(folder))
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo { FileName = folder, UseShellExecute = true });
    }
}
