using System;
using System.Collections.Generic;
using System.Text;
using OneFinance.ViewModels;

namespace OneFinance.Services
{
    public interface IDialogProvider
    {
        DialogViewModel Dialog { get; set; }
    }
}
