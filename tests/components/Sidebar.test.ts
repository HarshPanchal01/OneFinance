import { mount } from '@vue/test-utils';
import { describe, it, expect, vi } from 'vitest';
import Sidebar from '@/components/Sidebar.vue';
import { createTestingPinia } from '@pinia/testing';
import { useFinanceStore } from '@/stores/finance';

describe('Sidebar.vue', () => {
  const globalOptions = {
    plugins: [
      createTestingPinia({
        createSpy: vi.fn,
        initialState: {
          finance: {
            ledgerYears: [2023],
            ledgerMonths: [{ year: 2023, month: 1 }, { year: 2023, month: 2 }],
            currentLedgerMonth: null
          }
        }
      })
    ],
    stubs: {
        Teleport: true,
        YearDeleteModal: true
    }
  };

  it('renders navigation items', () => {
    const wrapper = mount(Sidebar, { 
      props: { currentView: 'dashboard' },
      global: globalOptions 
    });

    expect(wrapper.text()).toContain('Dashboard');
    expect(wrapper.text()).toContain('Transactions');
    expect(wrapper.text()).toContain('Settings');
  });

  it('renders ledger tree structure', () => {
    const wrapper = mount(Sidebar, { 
        props: { currentView: 'dashboard' },
        global: globalOptions 
    });

    expect(wrapper.text()).toContain('2023');
    // Months are hidden initially? No, logic says v-if="expandedYears.has(yearNode.year)"
    // And auto-expand if currentLedgerMonth matches.
    // Here currentLedgerMonth is null, so it should be collapsed.
    expect(wrapper.text()).not.toContain('January');
  });

  it('expands year on click', async () => {
    const wrapper = mount(Sidebar, { 
        props: { currentView: 'dashboard' },
        global: globalOptions 
    });

    // Find year button
    const yearBtn = wrapper.findAll('button').find(b => b.text().includes('2023'));
    await yearBtn?.trigger('click');

    expect(wrapper.text()).toContain('January');
    expect(wrapper.text()).toContain('February');
  });

  it('navigates when month is clicked', async () => {
    const wrapper = mount(Sidebar, { 
        props: { currentView: 'dashboard' },
        global: globalOptions 
    });
    const store = useFinanceStore();
    store.selectPeriod = vi.fn();

    // Expand
    const yearBtn = wrapper.findAll('button').find(b => b.text().includes('2023'));
    await yearBtn?.trigger('click');

    // Click January
    const monthBtn = wrapper.findAll('button').find(b => b.text().includes('January'));
    await monthBtn?.trigger('click');

    expect(store.selectPeriod).toHaveBeenCalledWith(2023, 1);
    expect(wrapper.emitted('navigate')![0]).toEqual(['transactions']);
  });
});
