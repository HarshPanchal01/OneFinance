<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useFinanceStore } from "@/stores/finance";
import { useSettingsStore } from "@/stores/settings";
import { useFormatter } from "@/composables/useFormatter";
import { toIsoDateString } from "@/utils";
import type { SavingsGoal } from "@/types";
import GoalModal from "./components/GoalModal.vue";
import ContributeModal from "./components/ContributeModal.vue";
import ConfirmationModal from "@/components/ConfirmationModal.vue";

const store = useFinanceStore();
const settingsStore = useSettingsStore();
const { formatCurrency, formatDate } = useFormatter();

const confirmModal = ref<InstanceType<typeof ConfirmationModal>>();

const showModal = ref(false);
const editingGoal = ref<SavingsGoal | null>(null);

const contributingGoal = ref<SavingsGoal | null>(null);

const goals = computed(() => store.goalProgress);

const totalSaved = computed(() => goals.value.reduce((sum, g) => sum + g.currentSaved, 0));
const totalTarget = computed(() => goals.value.reduce((sum, g) => sum + g.targetAmount, 0));
const totalRemaining = computed(() => Math.max(0, totalTarget.value - totalSaved.value));
const overallPct = computed(() => (totalTarget.value > 0 ? (totalSaved.value / totalTarget.value) * 100 : 0));
const reachedCount = computed(() => goals.value.filter((g) => g.reached).length);

function rawGoal(id: number): SavingsGoal | undefined {
  return store.goals.find((g) => g.id === id);
}

function openAdd() {
  editingGoal.value = null;
  showModal.value = true;
}

function openEdit(id: number) {
  editingGoal.value = rawGoal(id) ?? null;
  if (editingGoal.value) showModal.value = true;
}

function closeModal() {
  showModal.value = false;
  editingGoal.value = null;
}

async function saveGoal(payload: {
  id?: number;
  name: string;
  targetAmount: number;
  targetDate: string | null;
  accountId: number | null;
  currentAmount: number;
}) {
  const existing = payload.id != null ? rawGoal(payload.id) : undefined;

  // Baseline (startingAmount) anchors the pace projection to where the goal began;
  // it's preserved on edit, but re-anchored when the tracking source changes (new
  // goal, or the linked account was swapped) since the old baseline no longer applies.
  const sourceChanged = existing != null && existing.accountId !== payload.accountId;
  let startingAmount: number;
  if (existing && !sourceChanged) {
    startingAmount = existing.startingAmount;
  } else if (payload.accountId != null) {
    startingAmount = store.accounts.find((a) => a.id === payload.accountId)?.balance ?? 0;
  } else {
    startingAmount = payload.currentAmount;
  }

  await store.saveGoal({
    id: payload.id,
    name: payload.name,
    targetAmount: payload.targetAmount,
    targetDate: payload.targetDate,
    accountId: payload.accountId,
    currentAmount: payload.currentAmount,
    startingAmount,
    createdDate: existing?.createdDate ?? toIsoDateString(new Date()),
  });
  closeModal();
}

async function removeGoal() {
  if (!editingGoal.value) return;
  const id = editingGoal.value.id;
  closeModal();
  if (
    await confirmModal.value?.openConfirmation({
      title: "Delete Goal",
      message: "Are you sure you want to delete this savings goal?",
      cancelText: "Cancel",
      confirmText: "Delete",
    })
  ) {
    await store.removeGoal(id);
  }
}

function openContribute(id: number) {
  contributingGoal.value = rawGoal(id) ?? null;
}

async function addFunds(amount: number) {
  const goal = contributingGoal.value;
  contributingGoal.value = null;
  if (!goal) return;
  await store.saveGoal({ ...goal, currentAmount: goal.currentAmount + amount });
}

onMounted(async () => {
  await store.fetchGoals();
});
</script>

<template>
  <div class="h-full flex flex-col gap-4 min-h-0">
    <!-- Header -->
    <div class="flex items-start justify-between gap-3 shrink-0">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          Savings Goals
        </h1>
        <p class="text-gray-500 dark:text-gray-400 mt-1">
          Set a target, track progress, and see if you're on pace to hit it.
        </p>
      </div>
      <button
        class="inline-flex items-center px-5 py-2 bg-primary-500 dark:bg-primary-900/40 text-white dark:text-primary-300 hover:bg-primary-600 dark:hover:bg-primary-900/60 font-medium rounded-lg transition-colors whitespace-nowrap"
        @click="openAdd"
      >
        <i class="pi pi-plus mr-2" />
        New Goal
      </button>
    </div>

    <!-- Summary -->
    <div
      v-if="goals.length > 0"
      class="card p-5 shrink-0"
    >
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-sm font-medium text-gray-500 dark:text-gray-400">
            Total saved
          </p>
          <p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            <span :class="{ 'privacy-blur': settingsStore.privacyMode }">{{ formatCurrency(totalSaved) }}</span>
            <span class="text-base font-normal text-gray-400 dark:text-gray-500">
              / <span :class="{ 'privacy-blur': settingsStore.privacyMode }">{{ formatCurrency(totalTarget) }}</span>
            </span>
          </p>
        </div>
        <div class="text-right">
          <p class="text-lg font-semibold text-gray-900 dark:text-white">
            <span :class="{ 'privacy-blur': settingsStore.privacyMode }">{{ formatCurrency(totalRemaining) }}</span>
            <span class="text-sm font-normal text-gray-400 dark:text-gray-500"> to go</span>
          </p>
          <p
            v-if="reachedCount > 0"
            class="text-xs text-income font-medium mt-0.5"
          >
            {{ reachedCount }} {{ reachedCount === 1 ? "goal" : "goals" }} reached
          </p>
        </div>
      </div>

      <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-3">
        <div
          class="h-2 rounded-full bg-primary-500 transition-all"
          :style="{ width: Math.min(100, overallPct) + '%' }"
        />
      </div>
    </div>

    <!-- Goals grid -->
    <div class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden -mx-2 px-2 py-1">
      <div
        v-if="goals.length > 0"
        class="grid grid-cols-1 md:grid-cols-2 gap-3"
      >
        <div
          v-for="g in goals"
          :key="g.id"
          class="card p-4"
          :class="g.reached ? 'ring-1 ring-income/50 bg-income/5' : ''"
        >
          <!-- Title row -->
          <div class="flex items-center justify-between gap-2 mb-2.5">
            <span class="inline-flex items-center gap-2 min-w-0">
              <span class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-primary-500/15">
                <i
                  :class="['pi', g.reached ? 'pi-check-circle' : 'pi-flag']"
                  class="text-primary-500"
                />
              </span>
              <span class="min-w-0">
                <span class="block text-sm font-medium text-gray-900 dark:text-white truncate">
                  {{ g.name }}
                </span>
                <span class="block text-xs text-gray-500 dark:text-gray-400 truncate">
                  <i
                    v-if="g.accountName"
                    class="pi pi-wallet text-[10px] mr-0.5"
                  />
                  {{ g.accountName ?? "Manual" }}
                </span>
              </span>
            </span>
            <div class="flex items-center shrink-0">
              <button
                v-if="g.accountId == null && !g.reached"
                class="p-1.5 rounded-lg text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Add funds"
                @click="openContribute(g.id)"
              >
                <i class="pi pi-plus-circle text-sm" />
              </button>
              <button
                class="p-1.5 rounded-lg text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Edit goal"
                @click="openEdit(g.id)"
              >
                <i class="pi pi-pencil text-xs" />
              </button>
            </div>
          </div>

          <!-- Progress bar -->
          <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div
              class="h-2.5 rounded-full transition-all"
              :class="g.reached ? 'bg-income' : 'bg-primary-500'"
              :style="{ width: Math.min(100, g.pct) + '%' }"
            />
          </div>

          <!-- Amounts + percent -->
          <div class="flex items-center justify-between mt-2.5 text-sm">
            <span
              class="font-semibold text-gray-900 dark:text-white"
              :class="{ 'privacy-blur': settingsStore.privacyMode }"
            >
              {{ formatCurrency(g.currentSaved) }}
              <span class="font-normal text-gray-400 dark:text-gray-500">/ {{ formatCurrency(g.targetAmount) }}</span>
            </span>
            <span
              class="inline-flex items-center gap-1.5 text-xs font-medium"
              :class="g.reached ? 'text-income' : 'text-gray-500 dark:text-gray-400'"
            >
              <span>{{ Math.round(g.pct) }}%</span>
              <template v-if="!g.reached">
                <span class="text-gray-300 dark:text-gray-600">·</span>
                <span>
                  <span :class="{ 'privacy-blur': settingsStore.privacyMode }">{{ formatCurrency(g.remaining) }}</span> to go
                </span>
              </template>
              <template v-else>
                <i class="pi pi-check-circle" />
                <span>Reached</span>
              </template>
            </span>
          </div>

          <!-- Projection -->
          <p
            v-if="!g.reached && g.targetDate"
            class="text-xs mt-2 inline-flex items-center gap-1.5"
            :class="g.onTrack ? 'text-income' : 'text-expense'"
          >
            <i :class="['pi', g.onTrack ? 'pi-check' : 'pi-exclamation-triangle']" />
            <span v-if="g.onTrack">On track for {{ formatDate(g.targetDate) }}</span>
            <span v-else-if="g.dueWithinMonth">
              Need <span :class="{ 'privacy-blur': settingsStore.privacyMode }">{{ formatCurrency(g.remaining) }}</span> by {{ formatDate(g.targetDate) }}
            </span>
            <span v-else-if="g.requiredMonthly != null && g.requiredMonthly > 0">
              Need <span :class="{ 'privacy-blur': settingsStore.privacyMode }">{{ formatCurrency(g.requiredMonthly) }}</span>/mo by {{ formatDate(g.targetDate) }}
            </span>
            <span v-else>Target date {{ formatDate(g.targetDate) }} passed</span>
          </p>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-else
        class="h-full flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400"
      >
        <i class="pi pi-flag text-4xl text-gray-300 dark:text-gray-600 mb-3" />
        <p>No savings goals yet</p>
        <p class="text-sm mt-1">
          Create a goal to track progress toward a target.
        </p>
      </div>
    </div>
  </div>

  <GoalModal
    v-if="showModal"
    :goal="editingGoal"
    @close="closeModal"
    @save="saveGoal"
    @remove="removeGoal"
  />

  <ContributeModal
    v-if="contributingGoal"
    :goal="contributingGoal"
    @close="contributingGoal = null"
    @add="addFunds"
  />

  <ConfirmationModal ref="confirmModal" />
</template>
