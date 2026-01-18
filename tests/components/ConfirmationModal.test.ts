import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import ConfirmationModal from '@/components/ConfirmationModal.vue';

describe('ConfirmationModal.vue', () => {
  it('is hidden by default', () => {
    const wrapper = mount(ConfirmationModal);
    expect(wrapper.find('.fixed').exists()).toBe(false);
  });

  it('opens and resolves with true when confirmed', async () => {
    const wrapper = mount(ConfirmationModal);
    const component = wrapper.vm as any;

    const promise = component.openConfirmation({
        title: 'Test',
        message: 'Are you sure?',
        confirmText: 'Yes',
        cancelText: 'No'
    });

    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('Test');
    expect(wrapper.text()).toContain('Are you sure?');

    // Click confirm
    await wrapper.findAll('button')[1].trigger('click'); // 2nd button is confirm

    const result = await promise;
    expect(result).toBe(true);
    expect(wrapper.find('.fixed').exists()).toBe(false);
  });

  it('opens and resolves with false when cancelled', async () => {
    const wrapper = mount(ConfirmationModal);
    const component = wrapper.vm as any;

    const promise = component.openConfirmation({
        title: 'Delete?',
        message: 'Really?'
    });

    await wrapper.vm.$nextTick();
    
    // Click cancel
    await wrapper.findAll('button')[0].trigger('click'); // 1st button is cancel

    const result = await promise;
    expect(result).toBe(false);
    expect(wrapper.find('.fixed').exists()).toBe(false);
  });
});
