namespace ONE_FINANCE.ViewModels;

/// <summary>
/// View model for the Settings page.
/// </summary>
public class SettingsViewModel : BaseViewModel
{
    private string _appVersion = "1.0.0";
    private string _databasePath = string.Empty;

    public SettingsViewModel()
    {
        Title = "Settings";
        LoadSettings();
    }

    /// <summary>
    /// Application version string.
    /// </summary>
    public string AppVersion
    {
        get => _appVersion;
        set => SetProperty(ref _appVersion, value);
    }

    /// <summary>
    /// Path to the local database file.
    /// </summary>
    public string DatabasePath
    {
        get => _databasePath;
        set => SetProperty(ref _databasePath, value);
    }

    /// <summary>
    /// Loads the settings data.
    /// </summary>
    private void LoadSettings()
    {
        AppVersion = AppInfo.VersionString;
        DatabasePath = Path.Combine(FileSystem.AppDataDirectory, "onefinance.db3");
    }
}
