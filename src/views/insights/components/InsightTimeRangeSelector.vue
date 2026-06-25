<script setup lang="ts">
import { ref, watch, nextTick, computed } from "vue";
import DatePicker from "primevue/datepicker";

const props = defineProps<{
  modelValue: string;

  customRange: any;
  // Optional override of the preset list (e.g. the dashboard uses a shorter set).
  options?: { value: string; label: string }[];
}>();

const defaultOptions = [
  { value: "thisMonth", label: "This Month" },
  { value: "last3Months", label: "Last 3 Months" },
  { value: "last6Months", label: "Last 6 Months" },
  { value: "lastYear", label: "Last Year" },
  { value: "thisYear", label: "This Year" },
  { value: "ytd", label: "YTD" },
  { value: "allTime", label: "All Time" },
  { value: "custom", label: "Custom" },
];
const rangeOptions = computed(() => props.options ?? defaultOptions);

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
   
  (e: "update:customRange", value: any): void;
}>();

 
const tempCustomDate = ref<any>(null);
 
const datePickerRef = ref<any>(null);
const localValue = ref(props.modelValue);

// Sync local value with prop
watch(() => props.modelValue, (val) => {
  localValue.value = val;
});

// Helper to reliably open DatePicker
function showDatePicker() {
  const picker = datePickerRef.value;
  if (!picker) return;

  // Force the calendar to always open downwards, overriding PrimeVue's automatic upward flip.
  // This ensures it behaves like a standard dropdown and doesn't inflate or shift the layout.
  if (picker.alignOverlay && !picker._patchedAlign) {
    const originalAlign = picker.alignOverlay;
    picker.alignOverlay = function() {
      // Let PrimeVue calculate horizontal bounds and initial position
      originalAlign.call(this);
      // Immediately override the vertical placement to force it below the input
      if (picker.overlay && picker.$el) {
        const rect = picker.$el.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        
        picker.overlay.style.top = (rect.bottom + scrollTop + 4) + 'px'; // +4px for a visual gap
        // Align the right edge of the calendar flush with the right edge of the select input
        picker.overlay.style.left = (rect.right + scrollLeft - picker.overlay.offsetWidth) + 'px';
        picker.overlay.style.transformOrigin = 'right top';
      }
    };
    picker._patchedAlign = true;
  }

  if (typeof picker.show === "function") {
    picker.show();
  } else if (typeof picker.showOverlay === "function") {
    picker.showOverlay();
  } else if (typeof picker.onInputClick === "function") {
    // Fallback for some PrimeVue versions
    picker.onInputClick();
  } else {
    // Last resort: try to focus the input element if accessible
    const input = picker.$el?.querySelector("input");
    if (input) {
      input.click();
      input.focus();
    }
  }
}

function onSelectChange(event: Event) {
   
  const newVal = (event.target as any).value;
  localValue.value = newVal;

  if (newVal === 'custom' || newVal === 'custom_edit') {
    // For custom, only use existing range if available, otherwise start empty.
    // For custom_edit, always use existing range.
    const existing = (newVal === 'custom_edit' || props.customRange) ? props.customRange : null;
    tempCustomDate.value = existing ? [...existing] : null;
    nextTick(() => showDatePicker());
  } else {
    emit("update:modelValue", newVal);
  }
}

function onDatePickerHide() {
  // Check if we have a valid range
  if (Array.isArray(tempCustomDate.value) && tempCustomDate.value[0] && tempCustomDate.value[1]) {
     emit("update:customRange", tempCustomDate.value);
     
     // Now we confirm the switch to custom
     if (localValue.value === 'custom' || localValue.value === 'custom_edit') {
         emit("update:modelValue", 'custom');
         localValue.value = 'custom';
     }
  } else {
     // User cancelled or didn't pick full range
     // Revert local value to parent's value
     localValue.value = props.modelValue;
     tempCustomDate.value = null; 
  }
}
</script>

<template>
  <div class="flex items-center gap-2 relative">
    <DatePicker 
      ref="datePickerRef"
      v-model="tempCustomDate" 
      selection-mode="range" 
      :manual-input="false"
      :hide-on-range-selection="true"
      date-format="yy-mm-dd"
      class="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
      @hide="onDatePickerHide"
    />
    <select
      :value="localValue"
      class="text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-3 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none cursor-pointer min-w-[7rem] z-10 relative"
      @change="onSelectChange"
    >
      <option
        v-for="opt in rangeOptions"
        :key="opt.value"
        :value="opt.value"
      >
        {{ opt.label }}
      </option>
      <option
        v-if="modelValue === 'custom'"
        value="custom_edit"
        class="font-semibold text-primary-600 dark:text-primary-400"
      >
        Change Dates...
      </option>
    </select>
  </div>
</template>