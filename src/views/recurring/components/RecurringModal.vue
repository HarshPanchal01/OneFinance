<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useFinanceStore } from "@/stores/finance";
import { RecurringTransaction, RecurringFrequency } from "@/types";
import AmountInput from "@/components/AmountInput.vue";

const props = defineProps<{
  visible: boolean;
  recurring?: RecurringTransaction | null;
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
  type: "expense" as "income" | "expense" | "transfer",
  categoryId: null as number | null,
  accountId: null as number | null,
  transferAccountId: null as number | null,
  frequency: "monthly" as RecurringFrequency,
  startDate: (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })(),
  isExpenseTransfer: false,
  isIncomeTransfer: false,
});

const isEditing = computed(() => !!props.recurring);
const modalTitle = computed(() => isEditing.value ? "Edit Schedule" : "New Schedule");

// Filter categories by type
const filteredCategories = computed(() => 
  store.categories.filter(c => c.type === form.value.type || c.type === "both" || (form.value.type === 'transfer' && form.value.isExpenseTransfer && c.type === 'expense') || (form.value.type === 'transfer' && form.value.isIncomeTransfer && c.type === 'income'))
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
    form.value.categoryId = null;
    form.value.isExpenseTransfer = false;
    form.value.isIncomeTransfer = false;
    const isCurrentAccountValid = filteredAccounts.value.some(a => a.id === form.value.accountId);
    if (!isCurrentAccountValid) {
      form.value.accountId = filteredAccounts.value[0]?.id ?? null;
    }
  }
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      if (props.recurring) {
        form.value = {
          title: props.recurring.title,
          amount: props.recurring.amount,
          type: props.recurring.type,
          categoryId: props.recurring.categoryId,
          accountId: props.recurring.accountId,
          transferAccountId: props.recurring.transferAccountId || null,
          frequency: props.recurring.frequency,
          startDate: props.recurring.startDate,
          isExpenseTransfer: !!props.recurring.isExpenseTransfer,
          isIncomeTransfer: !!props.recurring.isIncomeTransfer,
        };
      } else {
        const validAccounts = store.accounts.filter(a => {
          const typeObj = store.accountTypes.find(t => t.id === a.accountTypeId);
          return typeObj?.classification !== 'asset' && typeObj?.classification !== 'investment';
        });
        const defaultAccount = validAccounts.find(a => a.isDefault);

        const d = new Date();
        form.value = {
          title: "",
          amount: 0,
          type: "expense",
          categoryId: null,
          accountId: defaultAccount ? defaultAccount.id : (validAccounts[0]?.id || null),
          transferAccountId: null,
          frequency: "monthly",
          startDate: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
          isExpenseTransfer: false,
          isIncomeTransfer: false,
        };
      }
    }
  },
  { immediate: true }
);

// Validation
const isValid = computed(() =>
  form.value.title.trim().length > 0 &&
  (form.value.amount ?? 0) > 0 &&
  form.value.startDate &&
  form.value.accountId !== null &&
  (form.value.type !== 'transfer' || (form.value.transferAccountId !== null && form.value.transferAccountId !== form.value.accountId))
);

async function save() {
  if (!isValid.value) return;

  try {
    let nextRunDate = form.value.startDate;
    if (isEditing.value && props.recurring) {
      // If the user didn't touch the date or frequency, keep the current schedule
      if (form.value.startDate === props.recurring.startDate && 
          form.value.frequency === props.recurring.frequency) {
        nextRunDate = props.recurring.nextRunDate;
      } else {
        // If they DID change it, and the chosen start date is in the past,
        // we snap it to Today to ensure the new rule only applies going forward.
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        if (nextRunDate < todayStr) {
          nextRunDate = todayStr;
        }
      }
    }

    const payload = {
      title: form.value.title,
      amount: form.value.amount ?? 0,
      type: form.value.type,
      categoryId: (form.value.type === 'transfer' && !form.value.isExpenseTransfer && !form.value.isIncomeTransfer) ? null : (form.value.categoryId ?? null),
      accountId: form.value.accountId!,
      transferAccountId: form.value.type === 'transfer' ? (form.value.transferAccountId ?? null) : null,
      frequency: form.value.frequency,
      startDate: form.value.startDate,
      nextRunDate: nextRunDate,
      isActive: isEditing.value && props.recurring ? props.recurring.isActive : true,
      isExpenseTransfer: form.value.type === 'transfer' ? form.value.isExpenseTransfer : false,
      isIncomeTransfer: form.value.type === 'transfer' ? form.value.isIncomeTransfer : false,
    };

    if (isEditing.value && props.recurring) {
      await store.editRecurringTransaction(props.recurring.id, payload);
    } else {
      await store.addRecurringTransaction(payload);
    }
    
    emit("saved");
    emit("close");
  } catch (error) {
    console.error("Failed to save recurring transaction:", error);
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
            :class="{ 'opacity-75 cursor-not-allowed': isEditing }"
          >
            <button
              :disabled="isEditing"
              :class="[
                'flex-1 py-2 text-sm font-medium transition-colors',
                form.type === 'expense'
                  ? 'bg-expense text-white'
                  : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
                !isEditing && form.type !== 'expense' ? 'hover:bg-gray-100 dark:hover:bg-gray-600' : ''
              ]"
              @click="handleTypeChange('expense')"
            >
              <i class="pi pi-arrow-down mr-2" />
              Expense
            </button>
            <button
              :disabled="isEditing"
              :class="[
                'flex-1 py-2 text-sm font-medium transition-colors',
                form.type === 'income'
                  ? 'bg-income text-white'
                  : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
                !isEditing && form.type !== 'income' ? 'hover:bg-gray-100 dark:hover:bg-gray-600' : ''
              ]"
              @click="handleTypeChange('income')"
            >
              <i class="pi pi-arrow-up mr-2" />
              Income
            </button>
            <button
              :disabled="isEditing"
              :class="[
                'flex-1 py-2 text-sm font-medium transition-colors',
                form.type === 'transfer'
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
                !isEditing && form.type !== 'transfer' ? 'hover:bg-gray-100 dark:hover:bg-gray-600' : ''
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
              placeholder="e.g., Netflix Subscription"
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

          <!-- Frequency & Start Date Grid -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Frequency
              </label>
              <select
                v-model="form.frequency"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent cursor-pointer"
              >
                <option value="weekly">
                  Weekly
                </option>
                <option value="bi-weekly">
                  Bi-Weekly
                </option>
                <option value="monthly">
                  Monthly
                </option>
                <option value="yearly">
                  Yearly
                </option>
              </select>
            </div>
            <div>
              <label
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Start Date
              </label>
              <input
                v-model="form.startDate"
                type="date"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent cursor-pointer"
              />
            </div>
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

          <!-- Transfer Expense Toggle -->
          <div
            v-if="form.type === 'transfer'"
            class="flex items-center space-x-6 pt-1 pb-1"
          >
            <div class="flex items-center space-x-2">
              <input
                id="isExpenseTransferRecurring"
                v-model="form.isExpenseTransfer"
                type="checkbox"
                class="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800"
                @change="handleExpenseToggle"
              />
              <label
                for="isExpenseTransferRecurring"
                class="text-sm font-medium text-gray-700 dark:text-gray-300"
              >Log as Expense</label>
            </div>

            <div class="flex items-center space-x-2">
              <input
                id="isIncomeTransferRecurring"
                v-model="form.isIncomeTransfer"
                type="checkbox"
                class="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800"
                @change="handleIncomeToggle"
              />
              <label
                for="isIncomeTransferRecurring"
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
        </div>

        <!-- Footer -->
        <div
          class="flex justify-end items-center px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0 space-x-3"
        >
          <button
            class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            @click="close"
          >
            Cancel
          </button>
          <button
            :disabled="!isValid"
            class="px-4 py-2 bg-primary-50 dark:bg-primary-900/10 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/20 border border-primary-200 dark:border-primary-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            @click="save"
          >
            {{ isEditing ? "Update Schedule" : "Create Schedule" }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>