import { mount } from '@vue/test-utils';
import { describe, it, expect, vi } from 'vitest';
import { createTestingPinia } from '@pinia/testing';
import DashboardView from '@/views/DashboardView.vue';
import TransactionsView from '@/views/TransactionsView.vue';
import SettingsView from '@/views/settings/SettingsView.vue';
import InsightsView from '@/views/insights/InsightsView.vue';
import AccountsView from '@/views/accounts/AccountsView.vue';
import CategoriesView from '@/views/CategoriesView.vue';
import { Account, Category } from '@/types';
import PrimeVue from 'primevue/config';
import Aura from '@primevue/themes/aura';
import { useFinanceStore } from '@/stores/finance';

// Mock chart.js to avoid canvas errors in JSDOM
vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  registerables: [],
}));
vi.mock('vue-chartjs', () => ({
  Bar: { template: '<div></div>' },
  Line: { template: '<div></div>' },
  Pie: { template: '<div></div>' },
  Doughnut: { template: '<div></div>' }
}));
// Mock PrimeVue Chart
vi.mock('primevue/chart', () => ({
  default: { template: '<div class="mock-chart"></div>' }
}));

describe('View Smoke Tests', () => {
  const mockAccounts: Account[] = [
    { id: 1, accountName: 'Test Bank', startingBalance: 1000, accountTypeId: 1, isDefault: true, balance: 1000 }
  ];
  const mockCategories: Category[] = [
    { id: 1, name: 'Food', colorCode: '#fff', icon: 'pi-food' }
  ];

  const globalOptions = {
    plugins: [
      createTestingPinia({
        createSpy: vi.fn,
        initialState: {
          finance: {
            accounts: mockAccounts,
            categories: mockCategories,
            transactions: [],
            periodSummary: { totalIncome: 1000, totalExpenses: 500, balance: 500, transactionCount: 5 },
            expenseBreakdown: [],
            recentTransactions: [],
            monthlyTrends: [],
            netWorthTrends: [],
            ledgerYears: [2023],
            ledgerMonths: [{ year: 2023, month: 1 }]
          }
        }
      }),
      [PrimeVue, {
        theme: {
            preset: Aura,
            options: {
                darkModeSelector: '.dark-mode',
                cssLayer: false
            }
        }
      }]
    ] as any[], // Cast to any[] to avoid strict plugin type mismatch
    stubs: {
      Teleport: true,
      TransactionModal: true,
      ConfirmationModal: true,
      ErrorModal: true,
      NotificationModal: true,
      AccountDeleteModal: true,
      SettingsImportModal: true,
      CashFlowChart: true,
      PacingChart: true,
      ExpenseBreakdownChart: true,
      NetWorthChart: true,
      AppChart: true
    }
  };

  it('renders DashboardView', () => {
    console.log('[Test: View] Mounting DashboardView...');
    const wrapper = mount(DashboardView, { global: globalOptions });
    expect(wrapper.text()).toContain('Dashboard');
    expect(wrapper.text()).toContain('Total Income');
    console.log('[Test: View] DashboardView mounted successfully.');
  });

  it('renders TransactionsView', () => {
    console.log('[Test: View] Mounting TransactionsView...');
    const wrapper = mount(TransactionsView, { global: globalOptions });
    expect(wrapper.text()).toContain('Transactions');
    expect(wrapper.exists()).toBe(true);
    console.log('[Test: View] TransactionsView mounted successfully.');
  });

  it('renders SettingsView', () => {
    console.log('[Test: View] Mounting SettingsView...');
    const wrapper = mount(SettingsView, { global: globalOptions });
    expect(wrapper.text()).toContain('One Finance');
    expect(wrapper.text()).toContain('Data Management');
    console.log('[Test: View] SettingsView mounted successfully.');
  });

  it('renders InsightsView', async () => {
    console.log('[Test: View] Mounting InsightsView...');
    const pinia = createTestingPinia({
      // ...
      createSpy: vi.fn,
      initialState: {
        finance: {
          accounts: mockAccounts,
          categories: mockCategories,
          transactions: [],
          periodSummary: { totalIncome: 1000, totalExpenses: 500, balance: 500, transactionCount: 5 },
          expenseBreakdown: [],
          recentTransactions: [],
          monthlyTrends: [],
          netWorthTrends: [],
          ledgerYears: [2023],
          ledgerMonths: [{ year: 2023, month: 1 }]
        }
      }
    });

    // Setup mock return before mounting
    const store = useFinanceStore(pinia); // Get the store instance associated with this pinia
    // We need to cast to any or appropriate type to access the mock
    (store.fetchPacingData as any).mockResolvedValue({ seriesA: [], seriesB: [] });
    (store.fetchRollingMonthlyTrends as any).mockResolvedValue([]);
    (store.fetchNetWorthTrend as any).mockResolvedValue([]);
    (store.fetchPeriodSummarySync as any).mockReturnValue(); // Sync action

    const wrapper = mount(InsightsView, { 
        global: {
            ...globalOptions, // Copy stubs
            plugins: [
                pinia,
                globalOptions.plugins[1] // PrimeVue
            ]
        }
    });
    
    // Wait for promises
    await new Promise(resolve => setTimeout(resolve, 0));
    
    expect(wrapper.text()).toContain('Insights');
    expect(wrapper.text()).toContain('Savings Rate');
    console.log('[Test: View] InsightsView mounted successfully.');
  });

  it('renders AccountsView', () => {
    console.log('[Test: View] Mounting AccountsView...');
    const wrapper = mount(AccountsView, { global: globalOptions });
    expect(wrapper.text()).toContain('Accounts');
    expect(wrapper.text()).toContain('Test Bank');
    console.log('[Test: View] AccountsView mounted successfully.');
  });

  it('renders CategoriesView', () => {
    console.log('[Test: View] Mounting CategoriesView...');
    const wrapper = mount(CategoriesView, { global: globalOptions });
    expect(wrapper.text()).toContain('Categories');
    expect(wrapper.text()).toContain('Food');
    console.log('[Test: View] CategoriesView mounted successfully.');
  });
});