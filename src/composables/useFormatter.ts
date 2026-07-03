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

  // Format in an explicit currency (e.g. a holding's native currency);
  // null/undefined falls back to the user's localization currency.
  const formatCurrencyIn = (amount: number, currency?: string | null) => {
    const cur = currency ?? settingsStore.currency;
    if (cur === settingsStore.currency) {
      return _formatCurrency(amount, settingsStore.formattingLocale, cur);
    }
    // Foreign prices always carry an explicit small code suffix in the UI, so
    // drop the locale's own disambiguation prefix (some ICU builds render USD
    // under en-CA as "US$" even with narrowSymbol) to avoid marking it twice.
    return new Intl.NumberFormat(settingsStore.formattingLocale, {
      style: 'currency',
      currency: cur,
      currencyDisplay: 'narrowSymbol',
    })
      .formatToParts(amount)
      .map(p => (p.type === 'currency' ? p.value.replace(/^[A-Z]+(?=\W)/, '').replace(/^[A-Z]+$/, '') : p.value))
      .join('')
      .trim();
  };

  // True when a holding's native currency differs from the user's (drives the
  // "show native + currency code" treatment in templates).
  const isForeignCurrency = (currency?: string | null) => {
    return !!currency && currency !== settingsStore.currency;
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
    formatCurrencyIn,
    isForeignCurrency,
    formatDate,
    getCurrencySymbol,
  };
}
