import { useSettingsStore } from "@/stores/settings";
import { formatCurrency as _formatCurrency, formatDate as _formatDate } from "@/utils";

export function useFormatter() {
  const settingsStore = useSettingsStore();

  const formatCurrency = (amount: number) => {
    // We split the locale (e.g., 'de-DE') and force the language part to 'en'
    // This keeps the regional formatting (separators) but uses English labels/symbols
    const localeParts = settingsStore.resolvedLocale.split('-');
    const forcedLocale = localeParts.length > 1 ? `en-${localeParts[1]}` : 'en-US';

    return _formatCurrency(
      amount,
      forcedLocale,
      settingsStore.currency
    );
  };

  const formatDate = (dateString: string) => {
    const localeParts = settingsStore.resolvedLocale.split('-');
    const forcedLocale = localeParts.length > 1 ? `en-${localeParts[1]}` : 'en-US';
    
    return _formatDate(dateString, forcedLocale);
  };

  return {
    formatCurrency,
    formatDate,
  };
}
