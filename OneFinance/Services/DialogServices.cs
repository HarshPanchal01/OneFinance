using OneFinance.ViewModels;
using System;
using System.Collections.Generic;
using System.Text;

namespace OneFinance.Services
{
    public class DialogServices
    {
        public async Task ShowDialog<THost,TDialogViewModel>(THost host, TDialogViewModel dialogViewModel)
            where TDialogViewModel : DialogViewModel
            where THost : IDialogProvider
        {
            host.Dialog = dialogViewModel;
            dialogViewModel.Show();

            await dialogViewModel.WaitAsync();
        }
    }
}
