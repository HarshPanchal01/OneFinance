import { defineStore } from 'pinia';
import { ref, watch, computed } from 'vue';

export type AppearanceMode = 'light' | 'dark' | 'system';

export const regionalSettings = [
  { label: 'System', value: 'system', currency: 'USD' },
  { label: 'United States ($)', value: 'en-US', currency: 'USD' },
  { label: 'Canada ($)', value: 'en-CA', currency: 'CAD' },
  { label: 'Australia ($)', value: 'en-AU', currency: 'AUD' },
  { label: 'United Kingdom (£)', value: 'en-GB', currency: 'GBP' },
  { label: 'Eurozone (€)', value: 'de-DE', currency: 'EUR' },
  { label: 'India (₹)', value: 'hi-IN', currency: 'INR' },
  { label: 'Japan (¥)', value: 'ja-JP', currency: 'JPY' },
  { label: 'China (¥)', value: 'zh-CN', currency: 'CNY' },
  { label: 'Switzerland (Fr)', value: 'fr-CH', currency: 'CHF' },
  { label: 'Brazil (R$)', value: 'pt-BR', currency: 'BRL' },
];

export const useSettingsStore = defineStore('settings', () => {
  const appearance = ref<AppearanceMode>('system');
  const isDark = ref(false);
  const privacyMode = ref(false);
  const region = ref('system');

  const resolvedRegion = computed(() => {
    return region.value === 'system' ? navigator.language : region.value;
  });

  const currency = computed(() => {
    const setting = regionalSettings.find(r => r.value === region.value);
    if (setting && region.value !== 'system') {
      return setting.currency;
    }
    // Fallback for system locale
    try {
      return new Intl.NumberFormat(navigator.language, { style: 'currency', currency: 'USD' })
        .resolvedOptions().currency || 'USD';
    } catch {
      return 'USD';
    }
  });

  const applyAppearance = () => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    isDark.value = appearance.value === 'dark' || (appearance.value === 'system' && prefersDark);
    
    if (isDark.value) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }
  };

  const loadSettings = () => {
    const savedAppearance = localStorage.getItem('appearance');
    if (savedAppearance) {
      appearance.value = savedAppearance as AppearanceMode;
    }
    const savedPrivacy = localStorage.getItem('privacyMode');
    if (savedPrivacy) {
      privacyMode.value = savedPrivacy === 'true';
    }
    const savedRegion = localStorage.getItem('region');
    if (savedRegion) {
      region.value = savedRegion;
    }
    applyAppearance();
  };

  const togglePrivacyMode = () => {
    privacyMode.value = !privacyMode.value;
  };

  watch(appearance, (newVal) => {
    localStorage.setItem('appearance', newVal);
    applyAppearance();
  });

  watch(privacyMode, (newVal) => {
    localStorage.setItem('privacyMode', String(newVal));
  });

  watch(region, (newVal) => {
    localStorage.setItem('region', newVal);
  });

  return {
    appearance,
    isDark,
    privacyMode,
    region,
    currency,
    resolvedLocale: resolvedRegion,
    loadSettings,
    applyAppearance,
    togglePrivacyMode
  };
});