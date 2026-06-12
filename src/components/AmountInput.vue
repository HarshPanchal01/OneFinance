<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useSettingsStore } from '@/stores/settings';

const model = defineModel<number | null>({ default: 0 });

const props = defineProps<{
  placeholder?: string;
  disabled?: boolean;
  showCurrency?: boolean;
}>();

const settingsStore = useSettingsStore();
const inputRef = ref<HTMLInputElement | null>(null);
const symbolRef = ref<HTMLElement | null>(null);
const symbolWidth = ref(10);
const displayValue = ref(model.value === null || model.value === 0 ? '' : model.value.toString());

const currencySymbol = computed(() => {
  try {
    const parts = new Intl.NumberFormat(settingsStore.resolvedLocale, {
      style: 'currency',
      currency: settingsStore.currency,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0);
    return parts.find(p => p.type === 'currency')?.value || '$';
  } catch {
    return '$';
  }
});

const updateSymbolWidth = () => {
  if (symbolRef.value) {
    symbolWidth.value = symbolRef.value.offsetWidth;
  }
};

// When this component mounts inside a v-show parent (e.g. CalculatorsView), the parent
// has display:none, making offsetWidth = 0. A ResizeObserver on the input fires once the
// parent becomes visible and layout is established, letting us re-measure correctly.
let resizeObserver: ResizeObserver | null = null;

onMounted(async () => {
  await nextTick();
  updateSymbolWidth();
  if (props.showCurrency && inputRef.value && (symbolRef.value?.offsetWidth ?? 0) === 0) {
    resizeObserver = new ResizeObserver(() => {
      if ((symbolRef.value?.offsetWidth ?? 0) > 0) {
        updateSymbolWidth();
        resizeObserver?.disconnect();
        resizeObserver = null;
      }
    });
    resizeObserver.observe(inputRef.value);
  }
});

onUnmounted(() => {
  resizeObserver?.disconnect();
});

watch(currencySymbol, () => {
  nextTick(updateSymbolWidth);
});

const inputPaddingStyle = computed(() => {
  if (!props.showCurrency) return {};
  // 12px (left-3) + symbol width + 8px (gap)
  return { paddingLeft: `${symbolWidth.value + 20}px` };
});

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
      ref="symbolRef"
      class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none transition-colors group-focus-within:text-primary-500 whitespace-nowrap"
    >{{ currencySymbol }}</span>
    <input
      ref="inputRef"
      :value="displayValue"
      type="text"
      :placeholder="placeholder || '0.00'"
      :disabled="disabled"
      :class="[
        'w-full py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none',
        !showCurrency ? 'px-3' : ''
      ]"
      :style="inputPaddingStyle"
      @input="(e) => displayValue = (e.target as HTMLInputElement).value"
      @blur="handleBlur"
      @keydown="handleKeydown"
      @focus="handleFocus"
    />
  </div>
</template>

