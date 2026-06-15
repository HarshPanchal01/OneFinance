<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from "vue";
import { useFinanceStore } from "@/stores/finance";
import DatePicker from "primevue/datepicker";
import { toIsoDateString } from "@/utils";
import AmountInput from "@/components/AmountInput.vue";

const props = defineProps<{
  initialAccountId?: number | null;
  initialRecurringId?: number | null;
}>();

const store = useFinanceStore();
const searchText = ref("");
const searchInput = ref<HTMLInputElement | null>(null);

// Search State
const selectedCategoryIds = ref<number[]>([]);
const selectedAccountIds = ref<number[]>([]);
const selectedRecurringId = ref<number | null>(null);
 
const dateRange = ref<any>(null);
const minAmount = ref<number | null>(null);
const maxAmount = ref<number | null>(null);
const typeFilter = ref<'all' | 'income' | 'expense' | 'transfer'>('all');
const sortOrder = ref<'desc' | 'asc' | 'amount-desc' | 'amount-asc'>('desc');

// Label Picker State
const showLabelPicker = ref(false);
const labelPickerRef = ref<HTMLDivElement | null>(null);
const labelSearch = ref("");

// Account Picker State
const showAccountPicker = ref(false);
const accountPickerRef = ref<HTMLDivElement | null>(null);
const accountSearch = ref("");

// Amount Picker State
const showAmountPicker = ref(false);
const amountPickerRef = ref<HTMLDivElement | null>(null);

// Type Picker State
const showTypePicker = ref(false);
const typePickerRef = ref<HTMLDivElement | null>(null);

// Sort Picker State
const showSortPicker = ref(false);
const sortPickerRef = ref<HTMLDivElement | null>(null);

// Date Picker State
interface DatePickerRef {
  show?: () => void;
  showOverlay?: () => void;
  onInputClick?: () => void;
  $el: HTMLElement;
}
const datePicker = ref<DatePickerRef | null>(null);

// Helper to check if a category is selected
function isCategorySelected(id: number): boolean {
  return selectedCategoryIds.value.includes(id);
}

// Toggle a category selection
async function toggleCategory(id: number) {
  if (selectedCategoryIds.value.includes(id)) {
    selectedCategoryIds.value = selectedCategoryIds.value.filter(cId => cId !== id);
  } else {
    selectedCategoryIds.value.push(id);
  }
  await handleSearch();
}

// Helper to check if an account is selected
function isAccountSelected(id: number): boolean {
  return selectedAccountIds.value.includes(id);
}

// Toggle an account selection
async function toggleAccount(id: number) {
  if (selectedAccountIds.value.includes(id)) {
    selectedAccountIds.value = selectedAccountIds.value.filter(aId => aId !== id);
  } else {
    selectedAccountIds.value.push(id);
  }
  await handleSearch();
}

function applyAmountFilter() {
  handleSearch();
  showAmountPicker.value = false;
}

function selectType(type: 'all' | 'income' | 'expense' | 'transfer') {
  typeFilter.value = type;
  handleSearch();
  showTypePicker.value = false;
}

function selectSort(order: 'desc' | 'asc' | 'amount-desc' | 'amount-asc') {
  sortOrder.value = order;
  handleSearch();
  showSortPicker.value = false;
}

// Filter categories for the picker list
const pickerCategories = computed(() => {
  const term = labelSearch.value.toLowerCase();
  return store.categories.filter(c => c.name.toLowerCase().includes(term));
});

// Filter accounts for the picker list
const pickerAccounts = computed(() => {
  const term = accountSearch.value.toLowerCase();
  return store.accounts.filter(a => a.accountName.toLowerCase().includes(term));
});

function toggleDatePicker() {
  const picker = datePicker.value;
  if (!picker) return;

  // Try standard methods if they exist
  if (typeof picker.show === "function") {
    picker.show();
  } else if (typeof picker.showOverlay === "function") {
    picker.showOverlay();
  } else if (typeof picker.onInputClick === "function") {
    // Fallback for some PrimeVue versions
    picker.onInputClick();
  } else {
    // Last resort: try to focus the input element if accessible
    const input = picker.$el.querySelector("input");
    if (input) {
      input.click();
      input.focus();
    }
  }
}

// Toggle pickers exclusively
function togglePicker(picker: 'label' | 'account' | 'amount' | 'type' | 'sort') {
  if (picker === 'label') {
    showLabelPicker.value = !showLabelPicker.value;
    showAccountPicker.value = false;
    showAmountPicker.value = false;
    showTypePicker.value = false;
    showSortPicker.value = false;
  } else if (picker === 'account') {
    showAccountPicker.value = !showAccountPicker.value;
    showLabelPicker.value = false;
    showAmountPicker.value = false;
    showTypePicker.value = false;
    showSortPicker.value = false;
  } else if (picker === 'amount') {
    showAmountPicker.value = !showAmountPicker.value;
    showLabelPicker.value = false;
    showAccountPicker.value = false;
    showTypePicker.value = false;
    showSortPicker.value = false;
  } else if (picker === 'type') {
    showTypePicker.value = !showTypePicker.value;
    showLabelPicker.value = false;
    showAccountPicker.value = false;
    showAmountPicker.value = false;
    showSortPicker.value = false;
  } else if (picker === 'sort') {
    showSortPicker.value = !showSortPicker.value;
    showLabelPicker.value = false;
    showAccountPicker.value = false;
    showAmountPicker.value = false;
    showTypePicker.value = false;
  }
}

async function handleSearch() {
  // Format dates
  let fromDate: string | null = null;
  let toDate: string | null = null;

  if (dateRange.value && dateRange.value[0]) {
    fromDate = toIsoDateString(dateRange.value[0]);
    if (dateRange.value[1]) {
      toDate = toIsoDateString(dateRange.value[1]);
    }
  }
  
  await store.searchTransactions({
    text: searchText.value,
    categoryIds: [...selectedCategoryIds.value],
    accountIds: [...selectedAccountIds.value],
    recurringId: selectedRecurringId.value ?? undefined,
    fromDate,
    toDate,
    minAmount: minAmount.value,
    maxAmount: maxAmount.value,
    type: typeFilter.value === 'all' ? null : typeFilter.value,
    sortOrder: sortOrder.value
  });
}

function clear() {
  searchText.value = "";
  selectedCategoryIds.value = [];
  selectedAccountIds.value = [];
  selectedRecurringId.value = null;
  dateRange.value = null;
  minAmount.value = null;
  maxAmount.value = null;
  typeFilter.value = 'all';
  sortOrder.value = 'desc';
  store.clearSearch();
  searchInput.value?.focus();
}

// Keyboard shortcuts
function handleKeydown(e: KeyboardEvent) {
  // Press '/' to focus search
  const isInputFocused = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA';
  
  if (e.key === "/" && !isInputFocused && !showLabelPicker.value && !showAmountPicker.value && !showAccountPicker.value && !showTypePicker.value && !showSortPicker.value) {
    e.preventDefault();
    searchInput.value?.focus();
    return;
  }

  // Search on Enter
  if (e.key === "Enter" && !showLabelPicker.value && !showAmountPicker.value && !showAccountPicker.value && !showTypePicker.value && !showSortPicker.value) {
    handleSearch();
  }
}

// Click outside handler for Pickers
function handleClickOutside(e: MouseEvent) {
  const target = e.target as Node;
  if (labelPickerRef.value && !labelPickerRef.value.contains(target)) {
    showLabelPicker.value = false;
  }
  if (accountPickerRef.value && !accountPickerRef.value.contains(target)) {
    showAccountPicker.value = false;
  }
  if (amountPickerRef.value && !amountPickerRef.value.contains(target)) {
    showAmountPicker.value = false;
  }
  if (typePickerRef.value && !typePickerRef.value.contains(target)) {
    showTypePicker.value = false;
  }
  if (sortPickerRef.value && !sortPickerRef.value.contains(target)) {
    showSortPicker.value = false;
  }
}

async function checkInitialFilters() {
  let needsSearch = false;
  if (props.initialAccountId) {
    selectedAccountIds.value = [props.initialAccountId];
    needsSearch = true;
  }
  if (props.initialRecurringId) {
    selectedRecurringId.value = props.initialRecurringId;
    needsSearch = true;
  }
  if (needsSearch) {
    await handleSearch();
  }
}

onMounted(async () => {
  window.addEventListener("keydown", handleKeydown);
  window.addEventListener("click", handleClickOutside);
  
  // Ensure data is loaded
  if (store.categories.length === 0) {
    await store.fetchCategories();
  }
  if (store.accounts.length === 0) {
    await store.fetchAccounts();
  }
  if (store.recurringTransactions.length === 0) {
    await store.fetchRecurringTransactions();
  }

  // Sync state from store transactionFilter (if initiated from another view)
  if (store.transactionFilter) {
    const f = store.transactionFilter;
    if (f.text) searchText.value = f.text;
    if (f.categoryIds) selectedCategoryIds.value = [...f.categoryIds];
    if (f.accountIds) selectedAccountIds.value = [...f.accountIds];
    if (f.recurringId) selectedRecurringId.value = f.recurringId;
    if (f.fromDate) {
      const start = new Date(f.fromDate + 'T00:00:00'); 
      const end = f.toDate ? new Date(f.toDate + 'T00:00:00') : new Date(start);
      dateRange.value = [start, end];
    }
    if (f.minAmount !== undefined && f.minAmount !== null) minAmount.value = f.minAmount;
    if (f.maxAmount !== undefined && f.maxAmount !== null) maxAmount.value = f.maxAmount;
    if (f.type) typeFilter.value = f.type;
    if (f.sortOrder) sortOrder.value = f.sortOrder;
  }

  checkInitialFilters();
});

watch(() => props.initialAccountId, () => {
  checkInitialFilters();
});

watch(() => props.initialRecurringId, () => {
  checkInitialFilters();
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
  window.removeEventListener("click", handleClickOutside);
  store.clearSearch();
});
</script>

<template>
  <div
    class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-[1.050rem] flex items-center justify-center"
  >
    <div class="relative w-full max-w-xl group flex gap-2">
      <!-- Search Input Container -->
      <div class="relative flex-grow flex items-center border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus-within:ring-2 focus-within:ring-primary-500 transition-all">
        <!-- Account Picker Button -->
        <div
          ref="accountPickerRef"
          class="relative ml-1"
        >
          <button
            class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
            title="Filter by Account"
            @click.stop="togglePicker('account')"
          >
            <i
              class="pi pi-wallet"
              :class="selectedAccountIds.length > 0 ? 'text-primary-500' : ''"
            />
            <span
              v-if="selectedAccountIds.length > 0"
              class="text-xs font-bold bg-primary-100 text-primary-700 px-1 rounded"
            >
              {{ selectedAccountIds.length }}
            </span>
          </button>

          <!-- Account Picker Dropdown -->
          <div
            v-if="showAccountPicker"
            class="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 flex flex-col overflow-hidden"
          >
            <div class="p-2 border-b border-gray-100 dark:border-gray-700">
              <span class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-2 px-1">Filter Accounts</span>
              <input
                v-model="accountSearch"
                type="text"
                placeholder="Filter accounts..."
                class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none transition-all"
                autofocus
                @click.stop
              />
            </div>
            
            <div class="max-h-60 overflow-y-auto p-1 space-y-0.5">
              <div
                v-if="pickerAccounts.length === 0"
                class="px-3 py-2 text-sm text-gray-500 text-center"
              >
                No accounts found
              </div>
              <button
                v-for="account in pickerAccounts"
                :key="account.id"
                class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                @click.stop="toggleAccount(account.id)"
              >
                <!-- Checkbox visual -->
                <input
                  type="checkbox"
                  :checked="isAccountSelected(account.id)"
                  class="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 pointer-events-none"
                  tabindex="-1"
                />
                <span class="text-gray-900 dark:text-white truncate flex-1">{{ account.accountName }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Label Picker Button -->
        <div
          ref="labelPickerRef"
          class="relative ml-1"
        >
          <button
            class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
            title="Filter by Label"
            @click.stop="togglePicker('label')"
          >
            <i
              class="pi pi-tags"
              :class="selectedCategoryIds.length > 0 ? 'text-primary-500' : ''"
            />
            <span
              v-if="selectedCategoryIds.length > 0"
              class="text-xs font-bold bg-primary-100 text-primary-700 px-1 rounded"
            >
              {{ selectedCategoryIds.length }}
            </span>
          </button>

          <!-- Label Picker Dropdown -->
          <div
            v-if="showLabelPicker"
            class="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 flex flex-col overflow-hidden"
          >
            <div class="p-2 border-b border-gray-100 dark:border-gray-700">
              <span class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-2 px-1">Filter Labels</span>
              <input
                v-model="labelSearch"
                type="text"
                placeholder="Filter labels..."
                class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none transition-all"
                autofocus
                @click.stop
              />
            </div>
            
            <div class="max-h-60 overflow-y-auto p-1 space-y-0.5">
              <div
                v-if="pickerCategories.length === 0"
                class="px-3 py-2 text-sm text-gray-500 text-center"
              >
                No labels found
              </div>
              <button
                v-for="category in pickerCategories"
                :key="category.id"
                class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                @click.stop="toggleCategory(category.id)"
              >
                <!-- Checkbox visual -->
                <input
                  type="checkbox"
                  :checked="isCategorySelected(category.id)"
                  class="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 pointer-events-none"
                  tabindex="-1"
                />
                <!-- Icon & Name -->
                <i
                  :class="['pi', category.icon]"
                  :style="{ color: category.colorCode }"
                />
                <span class="text-gray-900 dark:text-white truncate flex-1">{{ category.name }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Date Picker Button/Popup -->
        <div class="relative ml-1">
          <!-- Hidden DatePicker, triggered by button -->
          <DatePicker 
            ref="datePicker"
            v-model="dateRange" 
            selection-mode="range" 
            :manual-input="false"
            :hide-on-range-selection="true"
            date-format="yy-mm-dd"
            class="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
            @hide="handleSearch"
          />
           
          <button
            class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-1 relative z-10"
            title="Filter by Date"
            @click="toggleDatePicker"
          >
            <i
              class="pi pi-calendar"
              :class="dateRange ? 'text-primary-500' : ''"
            />
            <span
              v-if="dateRange"
              class="w-2 h-2 rounded-full bg-primary-500 absolute top-1 right-1"
            />
          </button>
        </div>

        <!-- Amount Picker -->
        <div
          ref="amountPickerRef"
          class="relative ml-1"
        >
          <button
            class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
            title="Filter by Amount"
            @click.stop="togglePicker('amount')"
          >
            <i
              class="pi pi-dollar"
              :class="(minAmount !== null || maxAmount !== null) ? 'text-primary-500' : ''"
            />
            <span
              v-if="(minAmount !== null || maxAmount !== null)"
              class="w-2 h-2 rounded-full bg-primary-500 absolute top-1 right-1"
            />
          </button>

          <!-- Amount Picker Dropdown -->
          <div
            v-if="showAmountPicker"
            class="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 flex flex-col overflow-hidden p-3 space-y-3"
            @click.stop
          >
            <div>
              <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Min Amount</label>
              <AmountInput
                v-model="minAmount"
                placeholder="0.00"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Max Amount</label>
              <AmountInput
                v-model="maxAmount"
                placeholder="∞"
              />
            </div>
            <button
              class="w-1/2 mx-auto py-1.5 bg-primary-500 dark:bg-primary-900/40 text-white dark:text-primary-300 hover:bg-primary-600 dark:hover:bg-primary-900/60 text-sm font-medium rounded transition-colors"
              @click="applyAmountFilter"
            >
              Apply
            </button>
          </div>
        </div>

        <!-- Type Picker -->
        <div
          ref="typePickerRef"
          class="relative ml-1"
        >
          <button
            class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
            title="Filter by Type"
            @click.stop="togglePicker('type')"
          >
            <i
              class="pi pi-arrow-right-arrow-left"
              :class="typeFilter !== 'all' ? 'text-primary-500' : ''"
            />
            <span
              v-if="typeFilter !== 'all'"
              class="w-2 h-2 rounded-full bg-primary-500 absolute top-1 right-1"
            />
          </button>

          <!-- Type Picker Dropdown -->
          <div
            v-if="showTypePicker"
            class="absolute top-full left-0 mt-2 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 flex flex-col overflow-hidden p-1 space-y-0.5"
            @click.stop
          >
            <button
              class="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              :class="typeFilter === 'all' ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400 font-medium' : 'text-gray-700 dark:text-gray-200'"
              @click="selectType('all')"
            >
              All
            </button>
            <button
              class="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              :class="typeFilter === 'income' ? 'bg-income/10 text-income font-medium' : 'text-gray-700 dark:text-gray-200'"
              @click="selectType('income')"
            >
              Income
            </button>
            <button
              class="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              :class="typeFilter === 'expense' ? 'bg-expense/10 text-expense font-medium' : 'text-gray-700 dark:text-gray-200'"
              @click="selectType('expense')"
            >
              Expense
            </button>
            <button
              class="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              :class="typeFilter === 'transfer' ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400 font-medium' : 'text-gray-700 dark:text-gray-200'"
              @click="selectType('transfer')"
            >
              Transfer
            </button>
          </div>
        </div>

        <!-- Sort Picker -->
        <div
          ref="sortPickerRef"
          class="relative ml-1"
        >
          <button
            class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
            title="Sort Transactions"
            @click.stop="togglePicker('sort')"
          >
            <i
              class="pi"
              :class="[
                sortOrder === 'desc' ? 'pi-sort-amount-down' : 
                sortOrder === 'asc' ? 'pi-sort-amount-up-alt' :
                sortOrder === 'amount-desc' ? 'pi-sort-numeric-down-alt' : 'pi-sort-numeric-up',
                sortOrder !== 'desc' ? 'text-primary-500' : ''
              ]"
            />
            <span
              v-if="sortOrder !== 'desc'"
              class="w-2 h-2 rounded-full bg-primary-500 absolute top-1 right-1"
            />
          </button>

          <!-- Sort Picker Dropdown -->
          <div
            v-if="showSortPicker"
            class="absolute top-full left-0 mt-2 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 flex flex-col overflow-hidden p-1 space-y-0.5"
            @click.stop
          >
            <button
              class="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              :class="sortOrder === 'desc' ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400 font-medium' : 'text-gray-700 dark:text-gray-200'"
              @click="selectSort('desc')"
            >
              Newest First
            </button>
            <button
              class="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              :class="sortOrder === 'asc' ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400 font-medium' : 'text-gray-700 dark:text-gray-200'"
              @click="selectSort('asc')"
            >
              Oldest First
            </button>
            <div class="h-px bg-gray-100 dark:bg-gray-700 my-1" />
            <button
              class="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              :class="sortOrder === 'amount-desc' ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400 font-medium' : 'text-gray-700 dark:text-gray-200'"
              @click="selectSort('amount-desc')"
            >
              Highest Amount
            </button>
            <button
              class="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              :class="sortOrder === 'amount-asc' ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400 font-medium' : 'text-gray-700 dark:text-gray-200'"
              @click="selectSort('amount-asc')"
            >
              Lowest Amount
            </button>
          </div>
        </div>
        
        <!-- Separator -->
        <div class="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-2" />

        <!-- Search Input -->
        <input
          ref="searchInput"
          v-model="searchText"
          type="text"
          placeholder="Search transactions..."
          class="flex-grow py-2 pr-20 bg-transparent border-none focus:ring-0 focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 min-w-0"
          @keydown="handleKeydown"
        />

        <!-- Actions (Right) -->
        <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10">
          <button
            v-if="searchText || selectedCategoryIds.length > 0 || selectedAccountIds.length > 0 || dateRange || minAmount !== null || maxAmount !== null || typeFilter !== 'all' || sortOrder !== 'desc'"
            class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Clear Filters"
            @click="clear"
          >
            <i class="pi pi-times" />
          </button>

          <button
            class="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Search"
            @click="handleSearch"
          >
            <i class="pi pi-search" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
