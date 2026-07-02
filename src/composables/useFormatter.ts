import { useSettingsStore } from "@/stores/settings";
import { formatCurrency as _formatCurrency, formatDate as _formatDate } from "@/utils";

export function useFormatter() {
  const settingsStore = useSettingsStore();

  const formatCurrency = (amount: number) => {
    return _formatCurrency(
      amount,
      settingsStore.formattingLocale,
      settingsStore.currency
    );
  };

  const formatDate = (dateString: string) => {
    return _formatDate(dateString, settingsStore.formattingLocale);
  };

  const getCurrencySymbol = () => {
    const parts = new Intl.NumberFormat(settingsStore.formattingLocale, {
      style: 'currency',
      currency: settingsStore.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).formatToParts(0);

    const currencyPart = parts.find(part => part.type === 'currency');
    return currencyPart ? currencyPart.value : '$';
  };

  return {
    formatCurrency,
    formatDate,
    getCurrencySymbol,
  };
}
