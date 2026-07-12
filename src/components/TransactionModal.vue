<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useFinanceStore } from "@/stores/finance";
import { matchRules } from "@/rules";
import type { Transaction } from "@/types";
import AmountInput from "@/components/AmountInput.vue";

const props = defineProps<{
  visible: boolean;
  transaction?: Transaction | null;
  defaultYear?: number;
  defaultMonth?: number;
}>();

const emit = defineEmits<{
  close: [];
  saved: [];
}>();

const store = useFinanceStore();

// Handle Esc key
function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && props.visible) {
    emit("close");
  }
}

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
});

// Form data
const form = ref({
  title: "",
  amount: 0 as number | null,
  date: (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })(),
  type: "expense" as "income" | "expense" | "transfer",
  categoryId: null as number | null,
  accountId: null as number | null,
  transferAccountId: null as number | null,
  notes: "",
  isExpenseTransfer: false,
  isIncomeTransfer: false,
});

// Get default date based on current period or today
function getDefaultDate(): string {
  if (props.defaultYear && props.defaultMonth) {
    // Use the 1st of the selected month as default
    const day = new Date().getDate();
    const maxDay = new Date(props.defaultYear, props.defaultMonth, 0).getDate();
    const safeDay = Math.min(day, maxDay);
    return `${props.defaultYear}-${String(props.defaultMonth).padStart(
      2,
      "0"
    )}-${String(safeDay).padStart(2, "0")}`;
  }
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Reset form when modal opens
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      lastSuggestedCategoryId.value = null;
      userPickedCategory.value = false;
      if (props.transaction) {
        // Edit mode
        form.value = {
          title: props.transaction.title,
          amount: props.transaction.amount,
          date: props.transaction.date,
          type: props.transaction.type,
          categoryId: props.transaction.categoryId,
          accountId: props.transaction.accountId,
          transferAccountId: props.transaction.transferAccountId || null,
          notes: props.transaction.notes || "",
          isExpenseTransfer: !!props.transaction.isExpenseTransfer,
          isIncomeTransfer: !!props.transaction.isIncomeTransfer,
        };
      } else {
        // Create mode - use current period's month/year for date
        // Find default account that is not an asset (since default type is expense)
        const validAccounts = store.accounts.filter(a => {
          const typeObj = store.accountTypes.find(t => t.id === a.accountTypeId);
          return typeObj?.classification !== 'asset' && typeObj?.classification !== 'investment';
        });
        const defaultAccount = validAccounts.find(a => a.isDefault);
        
        form.value = {
          title: "",
          amount: 0,
          date: getDefaultDate(),
          type: "expense",
          categoryId: null,
          accountId: defaultAccount ? defaultAccount.id : (validAccounts[0]?.id || null),
          transferAccountId: null,
          notes: "",
          isExpenseTransfer: false,
          isIncomeTransfer: false,
        };
      }
    }
  }
);

const isEditing = computed(() => !!props.transaction);

const modalTitle = computed(() =>
  isEditing.value ? "Edit Transaction" : "New Transaction"
);

// Filter categories by type (optional)
const filteredCategories = computed(() =>
  store.categories.filter(c => c.type === form.value.type || c.type === "both" || (form.value.type === 'transfer' && form.value.isExpenseTransfer && c.type === 'expense') || (form.value.type === 'transfer' && form.value.isIncomeTransfer && c.type === 'income'))
);

// Auto-categorization: suggest a category from the title while it's empty/ours.
// Tracks our own suggestion vs a manual pick so a user's choice is never overwritten.
const lastSuggestedCategoryId = ref<number | null>(null);
const userPickedCategory = ref(false);

// Re-selecting the already-selected option fires no change event, so focusing
// the select while a value is present must count as taking ownership of it —
// otherwise a re-affirmed suggestion could be retracted by a later title edit.
function onCategoryFocus() {
  if (form.value.categoryId != null) userPickedCategory.value = true;
}

// Only rules whose target category is selectable for the current type may fire.
const candidateRules = computed(() => {
  const validCategoryIds = new Set(filteredCategories.value.map((c) => c.id));
  return store.categorizationRules.filter((r) => validCategoryIds.has(r.categoryId));
});

// candidateRules is a source too so a title typed before the rules finish
// loading (cold start) still gets its suggestion when they arrive.
watch(
  () => [form.value.title, form.value.type, form.value.isExpenseTransfer, form.value.isIncomeTransfer, candidateRules.value],
  () => {
    const categoryVisible = form.value.type !== "transfer" || form.value.isExpenseTransfer || form.value.isIncomeTransfer;
    if (!categoryVisible || userPickedCategory.value) return;
    // Only claim an empty slot or replace our own earlier suggestion.
    if (form.value.categoryId != null && form.value.categoryId !== lastSuggestedCategoryId.value) return;

    const hit = matchRules(form.value.title, candidateRules.value);
    if (hit) {
      form.value.categoryId = hit.categoryId;
      lastSuggestedCategoryId.value = hit.categoryId;
    } else if (form.value.categoryId != null) {
      // The title no longer matches — retract our suggestion, not a user value.
      form.value.categoryId = null;
      lastSuggestedCategoryId.value = null;
    }
  }
);

// Filter accounts by transaction type (Assets only allowed for transfers)
const filteredAccounts = computed(() => {
  if (form.value.type === 'transfer') {
    return store.accounts;
  }
  return store.accounts.filter(a => {
    const typeObj = store.accountTypes.find(t => t.id === a.accountTypeId);
    return typeObj?.classification !== 'asset' && typeObj?.classification !== 'investment';
  });
});

function handleExpenseToggle() {
  if (form.value.isExpenseTransfer) {
    form.value.isIncomeTransfer = false;
  }
}

function handleIncomeToggle() {
  if (form.value.isIncomeTransfer) {
    form.value.isExpenseTransfer = false;
  }
}

function handleTypeChange(newType: "income" | "expense" | "transfer") {
  form.value.type = newType;
  if (newType !== 'transfer') {
    form.value.isExpenseTransfer = false;
    form.value.isIncomeTransfer = false;
    const isCurrentAccountValid = filteredAccounts.value.some(a => a.id === form.value.accountId);
    if (!isCurrentAccountValid) {
      form.value.accountId = filteredAccounts.value[0]?.id ?? null;
    }
  }
}

// Create another
const createAnother = ref(false);

// Validation
const isValid = computed(
  () =>
    form.value.title.trim().length > 0 &&
    (form.value.amount ?? 0) > 0 &&
    form.value.date &&
    form.value.accountId !== null &&
    (form.value.type !== 'transfer' || (form.value.transferAccountId !== null && form.value.transferAccountId !== form.value.accountId))
);

// Save transaction
async function save() {
  if (!isValid.value) return;

  try {
    const payload = {
      title: form.value.title,
      amount: form.value.amount ?? 0,
      date: form.value.date,
      type: form.value.type,
      categoryId: (form.value.type === 'transfer' && !form.value.isExpenseTransfer && !form.value.isIncomeTransfer) ? undefined : (form.value.categoryId ?? undefined),
      accountId: form.value.accountId!,
      transferAccountId: form.value.type === 'transfer' ? (form.value.transferAccountId ?? undefined) : undefined,
      notes: form.value.notes || undefined,
      isExpenseTransfer: form.value.type === 'transfer' ? form.value.isExpenseTransfer : false,
      isIncomeTransfer: form.value.type === 'transfer' ? form.value.isIncomeTransfer : false,
    };

    if (isEditing.value && props.transaction) {
      await store.editTransaction(props.transaction.id, payload);
      emit("saved");
      emit("close");
    } else {
      await store.addTransaction(payload);

      if (createAnother.value) {
        // Reset specific fields for the next transaction
        form.value.title = "";
        form.value.amount = 0;
        form.value.notes = "";
        // Keep date, type, account, and category as they are often repetitive.
        // The kept category now counts as the user's choice — clearing the
        // suggestion tracking stops the emptied title from retracting it.
        lastSuggestedCategoryId.value = null;
        userPickedCategory.value = false;
      } else {
        emit("saved");
        emit("close");
      }
    }
  } catch (error) {
    console.error("Failed to save transaction:", error);
  }
}

function close() {
  emit("close");
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex items-center justify-center"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/50"
        @click="close"
      />

      <!-- Modal -->
      <div
        class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full sm:max-w-md mx-4 sm:mx-auto flex flex-col max-h-[90vh]"
        @click.stop
        @mousedown.stop
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0"
        >
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ modalTitle }}
          </h3>
          <button
            class="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
            @click="close"
          >
            <i class="pi pi-times" />
          </button>
        </div>

        <!-- Form -->
        <div class="p-6 space-y-4 overflow-y-auto min-h-0">
          <!-- Type Toggle -->
          <div
            class="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"
          >
            <button
              :class="[
                'flex-1 py-2 text-sm font-medium transition-colors',
                form.type === 'expense'
                  ? 'bg-expense text-white'
                  : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600',
              ]"
              @click="handleTypeChange('expense')"
            >
              <i class="pi pi-arrow-down mr-2" />
              Expense
            </button>
            <button
              :class="[
                'flex-1 py-2 text-sm font-medium transition-colors',
                form.type === 'income'
                  ? 'bg-income text-white'
                  : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600',
              ]"
              @click="handleTypeChange('income')"
            >
              <i class="pi pi-arrow-up mr-2" />
              Income
            </button>
            <button
              :class="[
                'flex-1 py-2 text-sm font-medium transition-colors',
                form.type === 'transfer'
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600',
              ]"
              @click="handleTypeChange('transfer')"
            >
              <i class="pi pi-sync mr-2" />
              Transfer
            </button>
          </div>

          <!-- Title -->
          <div>
            <label
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Title
            </label>
            <input
              v-model="form.title"
              type="text"
              placeholder="e.g., Grocery shopping"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <!-- Amount -->
          <div>
            <label
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Amount
            </label>
            <AmountInput
              v-model="form.amount"
              show-currency
              placeholder="0.00"
            />
          </div>

          <!-- Date -->
          <div>
            <label
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Date
            </label>
            <input
              v-model="form.date"
              type="date"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <!-- Account -->
          <div :class="form.type === 'transfer' ? 'grid grid-cols-2 gap-4' : ''">
            <div>
              <label
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {{ form.type === 'transfer' ? 'From Account' : 'Account' }}
              </label>
              <select
                v-model="form.accountId"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option
                  v-for="account in filteredAccounts"
                  :key="account.id"
                  :value="account.id"
                >
                  {{ account.accountName }}
                </option>
              </select>
            </div>

            <div v-if="form.type === 'transfer'">
              <label
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                To Account
              </label>
              <select
                v-model="form.transferAccountId"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option
                  v-for="account in filteredAccounts"
                  :key="account.id"
                  :value="account.id"
                  :disabled="account.id === form.accountId"
                >
                  {{ account.accountName }}
                </option>
              </select>
            </div>
          </div>

          <!-- Transfer Expense/Income Toggle -->
          <div
            v-if="form.type === 'transfer'"
            class="flex items-center space-x-6 pt-1 pb-1"
          >
            <div class="flex items-center space-x-2">
              <input
                id="isExpenseTransfer"
                v-model="form.isExpenseTransfer"
                type="checkbox"
                class="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800"
                @change="handleExpenseToggle"
              />
              <label
                for="isExpenseTransfer"
                class="text-sm font-medium text-gray-700 dark:text-gray-300"
              >Log as Expense</label>
            </div>
            
            <div class="flex items-center space-x-2">
              <input
                id="isIncomeTransfer"
                v-model="form.isIncomeTransfer"
                type="checkbox"
                class="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800"
                @change="handleIncomeToggle"
              />
              <label
                for="isIncomeTransfer"
                class="text-sm font-medium text-gray-700 dark:text-gray-300"
              >Log as Income</label>
            </div>
          </div>

          <!-- Category -->
          <div v-if="form.type !== 'transfer' || form.isExpenseTransfer || form.isIncomeTransfer">
            <label
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Category
            </label>
            <select
              v-model="form.categoryId"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              @change="userPickedCategory = true"
              @focus="onCategoryFocus"
            >
              <option :value="null">
                No category
              </option>
              <option
                v-for="category in filteredCategories"
                :key="category.id"
                :value="category.id"
              >
                {{ category.name }}
              </option>
            </select>
          </div>

          <!-- Notes -->
          <div>
            <label
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Notes (optional)
            </label>
            <textarea
              v-model="form.notes"
              rows="2"
              placeholder="Add any additional notes..."
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>
        </div>

        <!-- Footer -->
        <div
          class="flex justify-between items-center px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0"
        >
          <div :class="{'w-full flex justify-end': isEditing}">
            <label
              v-if="!isEditing"
              class="flex items-center text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
            >
              <input
                v-model="createAnother"
                type="checkbox"
                class="w-4 h-4 mr-2 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800"
              />
              Create another
            </label>
          </div>
          <div class="flex space-x-3">
            <button
              class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              @click="close"
            >
              Cancel
            </button>
            <button
              :disabled="!isValid"
              class="px-4 py-2 bg-primary-500 dark:bg-primary-900/40 text-white dark:text-primary-300 hover:bg-primary-600 dark:hover:bg-primary-900/60 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              @click="save"
            >
              {{ isEditing ? "Update" : "Create" }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
