using CommunityToolkit.Mvvm.ComponentModel;
using System;
using System.Collections.Generic;
using System.Text;

namespace OneFinance.ViewModels
{
    public partial class DialogViewModel : ViewModelBase
    {

        [ObservableProperty] private bool _isDialogOpen;

        protected TaskCompletionSource closeTask = new TaskCompletionSource();

        public async Task WaitAsync()
        {
            await closeTask.Task;
        }
        public void Show()
        {
            if (closeTask.Task.IsCompleted) closeTask = new TaskCompletionSource();
            IsDialogOpen = true;
        }

        public void Close()
        {
            IsDialogOpen = false;

            closeTask.TrySetResult();
        }
    }
}
