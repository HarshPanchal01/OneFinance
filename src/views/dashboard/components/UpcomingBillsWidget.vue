<script setup lang="ts">
import { computed } from "vue";
import { useFinanceStore } from "@/stores/finance";
import { useSettingsStore } from "@/stores/settings";
import { useFormatter } from "@/composables/useFormatter";

const emit = defineEmits<{
  (e: "open-recurring", id?: number): void;
}>();

const store = useFinanceStore();
const settingsStore = useSettingsStore();
const { formatCurrency, formatDate } = useFormatter();

const upcoming = computed(() =>
  [...store.recurringTransactions]
    .filter((r) => r.isActive)
    .sort((a, b) => a.nextRunDate.localeCompare(b.nextRunDate))
    .map((r) => {
      const cat = r.categoryId != null ? store.categories.find((c) => c.id === r.categoryId) : undefined;
      return {
        id: r.id,
        title: r.title,
        amount: r.amount,
        type: r.type,
        reminderEnabled: r.reminderEnabled,
        nextRunDate: r.nextRunDate,
        icon: cat?.icon ?? "pi-calendar",
        color: cat?.colorCode ?? "#6b7280",
      };
    })
);

function dueLabel(nextRunDate: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = nextRunDate.split("-").map(Number);
  const due = new Date(y, m - 1, d);
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return "Overdue";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days <= 14) return `in ${days} days`;
  return formatDate(nextRunDate);
}

function amountClass(type: string): string {
  if (type === "income") return "text-income";
  if (type === "expense") return "text-expense";
  return "text-gray-700 dark:text-gray-200";
}
</script>

<template>
  <div class="card p-5 flex flex-col h-full">
    <div class="flex items-center justify-between mb-4 shrink-0">
      <h2 class="text-base font-semibold text-gray-900 dark:text-white">
        Upcoming Bills
      </h2>
      <button
        class="btn-view-all"
        @click="emit('open-recurring')"
      >
        View all
      </button>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto -mr-3 pr-3">
      <div
        v-if="upcoming.length === 0"
        class="h-full flex flex-col items-center justify-center py-6 text-gray-500 dark:text-gray-400"
      >
        <i class="pi pi-calendar text-3xl text-gray-300 dark:text-gray-600 mb-2" />
        <p class="text-sm">
          No upcoming schedules
        </p>
      </div>

      <ul
        v-else
        class="space-y-2"
      >
        <li
          v-for="bill in upcoming"
          :key="bill.id"
          class="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          @click="emit('open-recurring', bill.id)"
        >
          <div
            class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            :style="{ backgroundColor: bill.color + '20' }"
          >
            <i
              :class="['pi', bill.icon]"
              :style="{ color: bill.color }"
            />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <span class="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                {{ bill.title }}
              </span>
              <i
                v-if="bill.reminderEnabled"
                class="pi pi-bell text-xs text-primary-400 shrink-0"
              />
            </div>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ dueLabel(bill.nextRunDate) }}
            </p>
          </div>
          <span
            class="text-sm font-semibold shrink-0"
            :class="[amountClass(bill.type), { 'privacy-blur': settingsStore.privacyMode }]"
          >
            {{ formatCurrency(bill.amount) }}
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>
