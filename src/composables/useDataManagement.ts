import { toRaw } from "vue";
import { useFinanceStore } from "@/stores/finance";
import { verifyImportData } from "@/utils";

// Interfaces for the modals based on their usage in SettingsView
interface ConfirmationModalInstance {
  openConfirmation(options: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
  }): Promise<boolean>;
}

interface ErrorModalInstance {
  openConfirmation(options: {
    title: string;
    message: string;
    confirmText?: string;
  }): Promise<boolean>;
}

interface NotificationModalInstance {
  openConfirmation(options: {
    title: string;
    message: string;
    confirmText?: string;
  }): Promise<boolean>;
}

interface ImportActionModalInstance {
  openConfirmation(options: {
    title: string;
    message: string;
  }): Promise<{ action: 'replace' | 'append'; skipDuplicates: boolean } | null>;
}

export function useDataManagement() {
  const store = useFinanceStore();

  async function openDbLocation() {
    await window.electronAPI.openDbLocation();
  }

  async function deleteDatabase(
    confirmModal: ConfirmationModalInstance | undefined,
    notificationModal: NotificationModalInstance | undefined,
    errorModal: ErrorModalInstance | undefined
  ) {
    const confirmed = await confirmModal?.openConfirmation({
      title: "⚠️ DELETE DATABASE?",
      message:
        "This will permanently delete all your financial data including:\n- All transactions\n- All accounts\n- All ledger periods.\n\nThe app will close after deletion. Are you sure?",
      confirmText: "Delete",
      cancelText: "Cancel",
    });

    if (confirmed) {
      const success = await window.electronAPI.deleteDatabase();
      if (success) {
        await notificationModal?.openConfirmation({
          title: "Database Deleted",
          message:
            "Database deleted. Please restart the application (run npm run dev).\n",
          confirmText: "Okay",
        });
        // Fully quit (not hide-to-tray) so the DB is recreated on next launch
        await window.electronAPI.quitApp();
      } else {
        await errorModal?.openConfirmation({
          title: "Error",
          message: "Failed to delete database. Please try closing the app first.",
          confirmText: "Okay",
        });
      }
    }
  }

  async function exportData(notificationModal: NotificationModalInstance | undefined) {
    const accountsValue = toRaw(store.accounts);
    const transactionsValue = await window.electronAPI.getTransactions();
    const categoriesValue = toRaw(store.categories);
    const accountTypesValue = toRaw(store.accountTypes);
    const ledgerYearsValue = toRaw(store.ledgerYears);
    const recurringTransactionsValue = await window.electronAPI.getRecurringTransactions();
    const budgetsValue = await window.electronAPI.getBudgets();
    const goalsValue = await window.electronAPI.getSavingsGoals();
    const categorizationRulesValue = await window.electronAPI.getCategorizationRules();
    const databaseVersion = toRaw(store.databaseVersion);
    const investmentHoldingsValue = toRaw(store.investmentHoldings);
    
    // We need to fetch all investment transactions, history and adjustments for a complete export
    let investmentTransactionsValue: any[] = [];
    let investmentHistoryValue: any[] = [];
    let investmentAdjustmentsValue: any[] = [];
    
    for (const holding of store.investmentHoldings) {
        const txs = await window.electronAPI.getInvestmentTransactions(holding.id);
        investmentTransactionsValue = investmentTransactionsValue.concat(txs);
    }
    
    const dividendsValue = await window.electronAPI.getInvestmentDividends();

    const investmentAccounts = store.accounts.filter(a => {
        const type = store.accountTypes.find(at => at.id === a.accountTypeId);
        return type?.classification === 'investment';
    });
    
    for (const acc of investmentAccounts) {
        const hist = await window.electronAPI.getInvestmentHistory(acc.id);
        investmentHistoryValue = investmentHistoryValue.concat(hist);

        const adj = await window.electronAPI.getInvestmentAdjustments(acc.id);
        investmentAdjustmentsValue = investmentAdjustmentsValue.concat(adj);
    }

    const data = {
      databaseVersion: databaseVersion,
      accounts: accountsValue,
      transactions: transactionsValue,
      categories: categoriesValue,
      accountTypes: accountTypesValue,
      ledgerYears: ledgerYearsValue,
      recurringTransactions: recurringTransactionsValue,
      investmentHoldings: investmentHoldingsValue,
      investmentTransactions: investmentTransactionsValue,
      investmentHistory: investmentHistoryValue,
      investmentAdjustments: investmentAdjustmentsValue,
      dividends: dividendsValue,
      budgets: budgetsValue,
      goals: goalsValue,
      categorizationRules: categorizationRulesValue,
    };

    const timestamp = new Date().toDateString();

    const dataStr = JSON.stringify(data, null, 2);

    const result = await window.electronAPI.exportDatabase({
      data: dataStr,
      defaultName: "One-Finance Export " + timestamp,
    });

    if (!result.success) {
      return;
    }

    await notificationModal?.openConfirmation({
      title: "Database Exported",
      message: "A JSON file is available with the data at the location",
      confirmText: "Okay",
    });
  }

  async function importData(
    errorModal: ErrorModalInstance | undefined,
    actionModal: ImportActionModalInstance | undefined,
    notificationModal: NotificationModalInstance | undefined
  ) {
    const result = await window.electronAPI.importDatabase();

    if (!result.success || result.data == undefined) {
      if (result.error) {
        await errorModal?.openConfirmation({
          title: "Import Error",
          message: result.error,
          confirmText: "Okay",
        });
      }
      return;
    }

    const verification = verifyImportData(result.data, store.databaseVersion);

    if (!verification.success) {
      return await errorModal?.openConfirmation({
        title: "Import Error",
        message: verification.reason || "The selected file is not a valid OneFinance export file.",
        confirmText: "Okay",
      });
    }

    const response = await actionModal?.openConfirmation({
      title: "Import Data",
      message: "Choose how you want to import the data:",
    });

    if (response) {
      if (response.action === "replace") {
        await store.deleteAllDataFromTables();

        const success = await store.importDatabaseData(result.data, false, true);

        if (!success) {
          return await errorModal?.openConfirmation({
            title: "Import Error",
            message: "An error occurred while importing data.",
            confirmText: "Okay",
          });
        }
      } else {
        const success = await store.importDatabaseData(
          result.data,
          response.skipDuplicates
        );

        if (!success) {
          return await errorModal?.openConfirmation({
            title: "Import Error",
            message: "An error occurred while importing data.",
            confirmText: "Okay",
          });
        }
      }
    } else {
      return;
    }

    return await notificationModal?.openConfirmation({
      title: "Import Successful",
      message: "Data imported successfully.",
      confirmText: "Okay",
    });
  }

  return {
    openDbLocation,
    deleteDatabase,
    exportData,
    importData,
  };
}
