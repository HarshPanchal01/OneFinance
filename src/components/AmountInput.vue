<script setup lang="ts">
import { ref, watch } from 'vue';

const model = defineModel<number | null>({ default: 0 });

defineProps<{
  placeholder?: string;
  disabled?: boolean;
  showCurrency?: boolean;
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const displayValue = ref(model.value === null || model.value === 0 ? '' : model.value.toString());

// Keep display in sync with model when changed from outside
watch(model, (newVal) => {
  if (document.activeElement !== inputRef.value) {
    displayValue.value = newVal === null || newVal === 0 ? '' : newVal.toString();
  }
});

const evaluate = () => {
  if (!displayValue.value) {
    model.value = null;
    return;
  }

  let sanitized = displayValue.value.replace(/x/g, '*').replace(/,/g, '');
  // Allow numbers, basic operators, parens, and spaces
  sanitized = sanitized.replace(/[^0-9+\-*/(). ]/g, '');
  
  if (!sanitized.trim()) {
    displayValue.value = model.value === null || model.value === 0 ? '' : model.value.toString();
    return;
  }

  try {
    const result = new Function(`return ${sanitized}`)();
    if (typeof result === 'number' && isFinite(result)) {
      // Round to 2 decimal places for currency
      const rounded = Math.round(result * 100) / 100;
      model.value = rounded;
      displayValue.value = rounded.toString();
    } else {
      displayValue.value = model.value === null || model.value === 0 ? '' : model.value.toString();
    }
  } catch {
    // Revert to last valid numeric value on error
    displayValue.value = model.value === null || model.value === 0 ? '' : model.value.toString();
  }
};

const handleBlur = () => {
  evaluate();
};

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    evaluate();
    inputRef.value?.blur();
  }
};

const handleFocus = (e: Event) => {
  (e.target as HTMLInputElement).select();
};
</script>

<template>
  <div class="relative group">
    <span
      v-if="showCurrency"
      class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none transition-colors group-focus-within:text-primary-500"
    >$</span>
    <input
      ref="inputRef"
      :value="displayValue"
      type="text"
      :placeholder="placeholder || '0.00'"
      :disabled="disabled"
      :class="[
        'w-full py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none',
        showCurrency ? 'pl-7' : 'px-3'
      ]"
      @input="(e) => displayValue = (e.target as HTMLInputElement).value"
      @blur="handleBlur"
      @keydown="handleKeydown"
      @focus="handleFocus"
    />
  </div>
</template>

