import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export type AppearanceMode = 'light' | 'dark' | 'system';

export const useSettingsStore = defineStore('settings', () => {
  const appearance = ref<AppearanceMode>('system');
  const isDark = ref(false);

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
    applyAppearance();
  };

  watch(appearance, (newVal) => {
    localStorage.setItem('appearance', newVal);
    applyAppearance();
  });

  return {
    appearance,
    isDark,
    loadSettings,
    applyAppearance
  };
});