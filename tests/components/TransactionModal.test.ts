import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TransactionModal from '@/components/TransactionModal.vue';
import { createTestingPinia } from '@pinia/testing';
import { useFinanceStore } from '@/stores/finance';
import { Account, Category } from '@/types';

// Mock PrimeVue components slightly if needed, or just let them render shallowly
// Ideally we stub complex PrimeVue components that might need dom environment features missing in jsdom
// but standard inputs usually work.

describe('TransactionModal.vue', () => {
  const mockAccounts: Account[] = [
    { id: 1, accountName: 'Cash', startingBalance: 0, accountTypeId: 1, isDefault: true }
  ];
  const mockCategories: Category[] = [
    { id: 1, name: 'Food', colorCode: '#fff', icon: 'pi-food' }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly when visible', () => {
    const wrapper = mount(TransactionModal, {
      props: {
        visible: true,
        transaction: null
      },
      global: {
        stubs: { Teleport: true },
        plugins: [createTestingPinia({
          createSpy: vi.fn,
          initialState: {
            finance: {
              accounts: mockAccounts,
              categories: mockCategories,
            }
          }
        })]
      }
    });

    expect(wrapper.text()).toContain('New Transaction');
    // Check if inputs exist
    expect(wrapper.find('input[type="text"]').exists()).toBe(true); // Title
    expect(wrapper.find('input[type="number"]').exists()).toBe(true); // Amount
  });

  it('does not render content when not visible', () => {
    const wrapper = mount(TransactionModal, {
        props: {
          visible: false,
          transaction: null
        },
        global: {
          plugins: [createTestingPinia()],
          stubs: {
            Teleport: true 
          }
        }
      });
      
      // When visible is false, the div inside Teleport (v-if="visible") should not be there.
      // Since we stub Teleport, we check if the modal container exists.
      expect(wrapper.find('.relative.bg-white').exists()).toBe(false);
  });

  it('validates form inputs (save disabled)', async () => {
    const wrapper = mount(TransactionModal, {
      props: {
        visible: false,
        transaction: null
      },
      global: {
        stubs: { Teleport: true },
        plugins: [createTestingPinia({
            initialState: {
                finance: { accounts: mockAccounts, categories: mockCategories }
            }
        })]
      }
    });

    await wrapper.setProps({ visible: true });

    // Initial state check
    const saveBtn = wrapper.findAll('button').filter(b => b.text() === 'Create')[0];
    expect(saveBtn.element.disabled).toBe(true);

    // Set Date
    await wrapper.find('input[type="date"]').setValue('2023-01-01');
    
    // Set Title
    await wrapper.find('input[type="text"]').setValue('Groceries');
    
    // Set Amount
    await wrapper.find('input[type="number"]').setValue(50);
    
    // Set Account - try setting value as the ID directly
    // This simulates user selecting the option with value "1"
    await wrapper.findAll('select')[0].setValue(1);

    await wrapper.vm.$nextTick();
    await flushPromises();

    // Re-query button
    const saveBtnEnabled = wrapper.findAll('button').filter(b => b.text() === 'Create')[0];
    expect(saveBtnEnabled.element.disabled).toBe(false);
  });

  it('calls store action on save', async () => {
    const wrapper = mount(TransactionModal, {
      props: {
        visible: false,
        transaction: null
      },
      global: {
        stubs: { Teleport: true },
        plugins: [createTestingPinia({
            stubActions: false, // We want to spy on real action or mock it
            initialState: {
                finance: { accounts: mockAccounts, categories: mockCategories }
            }
        })]
      }
    });

    const store = useFinanceStore();
    // Mock the addTransaction action
    store.addTransaction = vi.fn();

    // Trigger watcher to init form
    await wrapper.setProps({ visible: true });

    // Fill form
    await wrapper.find('input[type="text"]').setValue('Lunch');
    await wrapper.find('input[type="number"]').setValue(25);
    
    const select = wrapper.findAll('select')[0];
    const option = select.find('option[value="1"]');
    (option.element as HTMLOptionElement).selected = true;
    await select.trigger('change');

    // Click Save
    const saveBtn = wrapper.findAll('button').filter(b => b.text() === 'Create')[0];
    await saveBtn.trigger('click');

    expect(store.addTransaction).toHaveBeenCalledTimes(1);
    expect(store.addTransaction).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Lunch',
      amount: 25,
      accountId: 1
    }));
    
    // Should emit saved event
    expect(wrapper.emitted('saved')).toBeTruthy();
  });
});
