using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using OneFinance.Models;
using OneFinance.Services;
using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Text;
using System.Threading.Tasks;

namespace OneFinance.ViewModels
{
    public partial class AccountsViewModel : ViewModelBase
    {

        private readonly IDatabaseService _databaseService;
        private readonly INavigationService _navigationService;
        private readonly MainWindowViewModel _mainWindowModel;
        private readonly DialogServices _dialogService;

        [ObservableProperty] private string title = "Accounts";
        [ObservableProperty] private ObservableCollection<Account> accounts = new ObservableCollection<Account>();

        public AccountsViewModel(MainWindowViewModel mainWindowModel, DialogServices dialogService, IDatabaseService databaseService, INavigationService navigationService)
        {
            _mainWindowModel = mainWindowModel;
            _dialogService = dialogService;
            _databaseService = databaseService;
            _navigationService = navigationService;
        }

        public override async Task OnAppearingAsync()
        {
            Accounts = new ObservableCollection<Account>(await GetAccountsAsync()); 
            await base.OnAppearingAsync();
            return;
        }

        private async Task<List<Account>> GetAccountsAsync()
        {
            try
            {
                return await _databaseService.GetAccountsAsync();
            }
            catch (Exception ex)
            {
                return new List<Account>();
            }
            
        }

        [RelayCommand]
        private void AddAccount() => _navigationService.NavigateTo("AccountForm");

        [RelayCommand]
        private void EditAccount(Account? t) { if (t != null) _navigationService.NavigateTo("AccountForm", t.Id); }

        [RelayCommand]
        private async Task DeleteAccount(Account? t) { if (t != null) {

                var confirmViewModel = new ConfirmDialogViewModel { 
                
                    Title = $"Delete {t.Name}?",
                    Message = "Are you sure you want to delete this account?",

                };

                await _dialogService.ShowDialog(_mainWindowModel, confirmViewModel);

                var result = confirmViewModel.Confirmed;

                if (!result) return;
                
                Accounts.Remove(t);
                await _databaseService.DeleteAccountByIdAsync(t.Id);
            } 
        }

    }
    
}
