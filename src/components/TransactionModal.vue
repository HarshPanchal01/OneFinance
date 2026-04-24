<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useFinanceStore } from "@/stores/finance";
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
        };
      } else {
        // Create mode - use current period's month/year for date
        // Find default account
        const defaultAccount = store.accounts.find(a => a.isDefault);
        
        form.value = {
          title: "",
          amount: 0,
          date: getDefaultDate(),
          type: "expense",
          categoryId: null,
          accountId: defaultAccount ? defaultAccount.id : (store.accounts[0]?.id),
          transferAccountId: null,
          notes: "",
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
  store.categories.filter(c => c.type === form.value.type || c.type === "both")
);

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
      categoryId: form.value.type === 'transfer' ? undefined : (form.value.categoryId ?? undefined),
      accountId: form.value.accountId!,
      transferAccountId: form.value.type === 'transfer' ? (form.value.transferAccountId ?? undefined) : undefined,
      notes: form.value.notes || undefined,
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
        // Keep date, type, account, and category as they are often repetitive
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
              @click="form.type = 'expense'"
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
              @click="form.type = 'income'"
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
              @click="form.type = 'transfer'"
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
                  v-for="account in store.accounts"
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
                  v-for="account in store.accounts"
                  :key="account.id"
                  :value="account.id"
                  :disabled="account.id === form.accountId"
                >
                  {{ account.accountName }}
                </option>
              </select>
            </div>
          </div>

          <!-- Category -->
          <div v-if="form.type !== 'transfer'">
            <label
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Category
            </label>
            <select
              v-model="form.categoryId"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
              class="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
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
