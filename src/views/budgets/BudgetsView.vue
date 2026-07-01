<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useFinanceStore } from "@/stores/finance";
import { useSettingsStore } from "@/stores/settings";
import { useFormatter } from "@/composables/useFormatter";
import { getDateRange, toIsoDateString } from "@/utils";
import type { Category, SearchOptions } from "@/types";
import BudgetModal from "./components/BudgetModal.vue";
import ConfirmationModal from "@/components/ConfirmationModal.vue";

const emit = defineEmits<{
  (e: "navigate-transactions"): void;
}>();

const store = useFinanceStore();
const settingsStore = useSettingsStore();
const { formatCurrency } = useFormatter();

const confirmModal = ref<InstanceType<typeof ConfirmationModal>>();

const showModal = ref(false);
const selectedCategory = ref<Category | null>(null);

const budgeted = computed(() => store.budgetProgress);

const budgetedIds = computed(() => new Set(store.budgets.map((b) => b.categoryId)));

// Expense-capable categories without a budget, sorted by this month's spend so
// the biggest un-tracked spenders surface first.
const unbudgeted = computed(() =>
  store.categories
    .filter((c) => (c.type === "expense" || c.type === "both") && !budgetedIds.value.has(c.id))
    .map((c) => ({ ...c, spent: store.currentMonthSpendByCategory.get(c.id) ?? 0 }))
    .sort((a, b) => b.spent - a.spent)
);

const totalLimit = computed(() => budgeted.value.reduce((sum, b) => sum + b.limit, 0));
const totalSpent = computed(() => budgeted.value.reduce((sum, b) => sum + b.spent, 0));
const totalRemaining = computed(() => totalLimit.value - totalSpent.value);
const overallPct = computed(() => (totalLimit.value > 0 ? (totalSpent.value / totalLimit.value) * 100 : 0));
const overBudgetCount = computed(() => budgeted.value.filter((b) => b.over).length);

const monthLabel = computed(() =>
  new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })
);

const daysLeft = computed(() => {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return lastDay - now.getDate();
});

function currentAmountFor(categoryId: number): number | null {
  return store.budgets.find((b) => b.categoryId === categoryId)?.amount ?? null;
}

// Open Transactions filtered to this category's current-month expenses so the
// user can see what makes up the budget's spend.
function openBreakdown(categoryId: number) {
  const { startDate, endDate } = getDateRange("thisMonth");
  const filter: SearchOptions = {
    fromDate: toIsoDateString(startDate),
    toDate: toIsoDateString(endDate),
    type: "expense",
    categoryIds: [categoryId],
  };
  store.setTransactionFilter(filter);
  store.searchTransactions(filter);
  emit("navigate-transactions");
}

function openModal(category: Category) {
  selectedCategory.value = category;
  showModal.value = true;
}

// Edit a budget: open the modal for the real store category (single source of truth).
function editBudget(categoryId: number) {
  const category = store.categories.find((c) => c.id === categoryId);
  if (category) openModal(category);
}

function openAdd() {
  selectedCategory.value = null;
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
  selectedCategory.value = null;
}

async function saveBudget(categoryId: number, amount: number) {
  await store.saveBudget(categoryId, amount);
  closeModal();
}

async function removeBudget() {
  if (!selectedCategory.value) return;
  const categoryId = selectedCategory.value.id;
  closeModal();
  if (
    await confirmModal.value?.openConfirmation({
      title: "Remove Budget",
      message: "Are you sure you want to remove this category's budget?",
      cancelText: "Cancel",
      confirmText: "Remove",
    })
  ) {
    await store.removeBudget(categoryId);
  }
}

onMounted(async () => {
  await store.fetchBudgets();
  if (store.dashboardTransactions.length === 0) {
    await store.refreshDashboardData();
  }
});
</script>

<template>
  <div class="h-full flex flex-col gap-4 min-h-0">
    <!-- Header -->
    <div class="flex items-start justify-between gap-3 shrink-0">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          Budgets
        </h1>
        <p class="text-gray-500 dark:text-gray-400 mt-1">
          Set a monthly spending limit per category and track this month's progress.
        </p>
      </div>
      <button
        v-if="unbudgeted.length > 0"
        class="inline-flex items-center px-5 py-2 bg-primary-500 dark:bg-primary-900/40 text-white dark:text-primary-300 hover:bg-primary-600 dark:hover:bg-primary-900/60 font-medium rounded-lg transition-colors whitespace-nowrap"
        @click="openAdd"
      >
        <i class="pi pi-plus mr-2" />
        Add Budget
      </button>
    </div>

    <!-- Summary -->
    <div
      v-if="budgeted.length > 0"
      class="card p-5 shrink-0"
    >
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-sm font-medium text-gray-500 dark:text-gray-400">
            {{ monthLabel }}
          </p>
          <p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            <span :class="{ 'privacy-blur': settingsStore.privacyMode }">{{ formatCurrency(totalSpent) }}</span>
            <span class="text-base font-normal text-gray-400 dark:text-gray-500">
              / <span :class="{ 'privacy-blur': settingsStore.privacyMode }">{{ formatCurrency(totalLimit) }}</span>
            </span>
          </p>
        </div>
        <div class="text-right">
          <p
            class="text-lg font-semibold"
            :class="totalRemaining >= 0 ? 'text-income' : 'text-expense'"
          >
            <span :class="{ 'privacy-blur': settingsStore.privacyMode }">{{ formatCurrency(Math.abs(totalRemaining)) }}</span>
            {{ totalRemaining >= 0 ? "left" : "over" }}
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {{ daysLeft }} {{ daysLeft === 1 ? "day" : "days" }} left this month
          </p>
        </div>
      </div>

      <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-3">
        <div
          class="h-2 rounded-full transition-all"
          :class="overallPct > 100 ? 'bg-expense' : 'bg-primary-500'"
          :style="{ width: Math.min(100, overallPct) + '%' }"
        />
      </div>

      <p
        v-if="overBudgetCount > 0"
        class="text-sm font-medium text-expense mt-3"
      >
        <i class="pi pi-exclamation-triangle mr-1" />
        {{ overBudgetCount }} {{ overBudgetCount === 1 ? "category is" : "categories are" }} over budget
      </p>
    </div>

    <!-- Lists -->
    <div class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden -mx-2 px-2 py-1 space-y-6">
      <!-- Budgeted categories -->
      <div v-if="budgeted.length > 0">
        <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Budgeted
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div
            v-for="b in budgeted"
            :key="b.categoryId"
            class="card p-4 cursor-pointer transition-shadow"
            :class="b.over
              ? 'ring-1 ring-expense/50 bg-expense/5 hover:ring-2 hover:ring-expense/60'
              : 'hover:ring-2 hover:ring-primary-500/40'"
            title="View transactions in this category"
            @click="openBreakdown(b.categoryId)"
          >
            <div class="flex items-center justify-between gap-2 mb-2.5">
              <span class="inline-flex items-center gap-2 min-w-0">
                <span
                  class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  :style="{ backgroundColor: b.categoryColor + '20' }"
                >
                  <i
                    :class="['pi', b.categoryIcon]"
                    :style="{ color: b.categoryColor }"
                  />
                </span>
                <span class="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {{ b.categoryName }}
                </span>
              </span>
              <button
                class="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Edit budget"
                @click.stop="editBudget(b.categoryId)"
              >
                <i class="pi pi-pencil text-xs" />
              </button>
            </div>

            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div
                class="h-2.5 rounded-full"
                :style="{
                  width: Math.min(100, b.pct) + '%',
                  backgroundColor: b.over ? '#ef4444' : b.categoryColor,
                }"
              />
            </div>

            <div class="flex items-center justify-between mt-2.5 text-sm">
              <span
                class="font-semibold text-gray-900 dark:text-white"
                :class="{ 'privacy-blur': settingsStore.privacyMode }"
              >
                {{ formatCurrency(b.spent) }}
                <span class="font-normal text-gray-400 dark:text-gray-500">/ {{ formatCurrency(b.limit) }}</span>
              </span>
              <span
                class="inline-flex items-center gap-1.5 text-xs font-medium"
                :class="b.over ? 'text-expense' : 'text-income'"
              >
                <i
                  v-if="b.over"
                  class="pi pi-exclamation-triangle"
                />
                <span>{{ Math.round(b.pct) }}%</span>
                <span class="text-gray-300 dark:text-gray-600">·</span>
                <span>
                  <span :class="{ 'privacy-blur': settingsStore.privacyMode }">{{ formatCurrency(Math.abs(b.remaining)) }}</span>
                  {{ b.over ? "over" : "left" }}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Unbudgeted categories -->
      <div v-if="unbudgeted.length > 0">
        <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          No budget set
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            v-for="cat in unbudgeted"
            :key="cat.id"
            class="group card p-4 flex items-center justify-between gap-2 text-left hover:ring-2 hover:ring-primary-500/40 transition-shadow"
            title="Set a budget for this category"
            @click="openModal(cat)"
          >
            <span class="inline-flex items-center gap-2 min-w-0">
              <span
                class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                :style="{ backgroundColor: cat.colorCode + '20' }"
              >
                <i
                  :class="['pi', cat.icon]"
                  :style="{ color: cat.colorCode }"
                />
              </span>
              <span class="min-w-0">
                <span class="block text-sm font-medium text-gray-900 dark:text-white truncate">
                  {{ cat.name }}
                </span>
                <span
                  v-if="cat.spent > 0"
                  class="block text-xs text-gray-500 dark:text-gray-400"
                  :class="{ 'privacy-blur': settingsStore.privacyMode }"
                >
                  {{ formatCurrency(cat.spent) }} this month
                </span>
              </span>
            </span>
            <i class="pi pi-plus text-sm text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </button>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-if="budgeted.length === 0 && unbudgeted.length === 0"
        class="h-full flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400"
      >
        <i class="pi pi-wallet text-4xl text-gray-300 dark:text-gray-600 mb-3" />
        <p>No expense categories yet</p>
        <p class="text-sm mt-1">
          Create an expense category to start budgeting.
        </p>
      </div>
    </div>
  </div>

  <BudgetModal
    v-if="showModal"
    :category="selectedCategory"
    :current-amount="selectedCategory ? currentAmountFor(selectedCategory.id) : null"
    :available-categories="unbudgeted"
    @close="closeModal"
    @save="saveBudget"
    @remove="removeBudget"
  />

  <ConfirmationModal ref="confirmModal" />
</template>
