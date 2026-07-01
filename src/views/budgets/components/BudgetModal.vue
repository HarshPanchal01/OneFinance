<script setup lang="ts">
import { computed, ref } from "vue";
import type { Category } from "@/types";
import { useFormatter } from "@/composables/useFormatter";

const props = defineProps<{
  category: Category | null;
  currentAmount: number | null;
  availableCategories?: Category[];
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", categoryId: number, amount: number): void;
  (e: "remove"): void;
}>();

const { getCurrencySymbol } = useFormatter();

const amount = ref<number | null>(props.currentAmount);
const selectedCategoryId = ref<number | null>(props.category?.id ?? null);

// In "add" mode (no fixed category) the user picks from a dropdown; otherwise locked.
const activeCategory = computed<Category | null>(() => {
  if (props.category) return props.category;
  return props.availableCategories?.find((c) => c.id === selectedCategoryId.value) ?? null;
});

const isValid = () => selectedCategoryId.value != null && amount.value != null && amount.value > 0;

function save() {
  if (!isValid()) return;
  emit("save", selectedCategoryId.value as number, amount.value as number);
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <div
        class="absolute inset-0 bg-black/50"
        @click="emit('close')"
      />

      <div
        class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 flex flex-col"
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0"
        >
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ currentAmount != null ? "Edit Budget" : "Set Budget" }}
          </h3>
          <button
            class="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
            @click="emit('close')"
          >
            <i class="pi pi-times" />
          </button>
        </div>

        <!-- Form -->
        <div class="p-6 space-y-4">
          <!-- Category: locked preview or picker -->
          <div
            v-if="category"
            class="flex items-center gap-3"
          >
            <span
              class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              :style="{ backgroundColor: category.colorCode + '20' }"
            >
              <i
                :class="['pi', category.icon]"
                :style="{ color: category.colorCode }"
              />
            </span>
            <div class="min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                {{ category.name }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Monthly limit
              </p>
            </div>
          </div>

          <div v-else>
            <label
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Category
            </label>
            <div class="flex items-center gap-3">
              <span
                v-if="activeCategory"
                class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                :style="{ backgroundColor: activeCategory.colorCode + '20' }"
              >
                <i
                  :class="['pi', activeCategory.icon]"
                  :style="{ color: activeCategory.colorCode }"
                />
              </span>
              <select
                v-model.number="selectedCategoryId"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option
                  :value="null"
                  disabled
                >
                  Select a category
                </option>
                <option
                  v-for="cat in availableCategories"
                  :key="cat.id"
                  :value="cat.id"
                >
                  {{ cat.name }}
                </option>
              </select>
            </div>
          </div>

          <!-- Amount -->
          <div>
            <label
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Monthly Limit
            </label>
            <div class="relative">
              <span
                class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
              >
                {{ getCurrencySymbol() }}
              </span>
              <input
                v-model.number="amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                class="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                @keydown.enter="save"
              />
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div
          class="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0"
        >
          <button
            v-if="currentAmount != null"
            class="px-4 py-2 text-expense hover:bg-expense/10 rounded-lg transition-colors"
            @click="emit('remove')"
          >
            Remove
          </button>
          <span v-else />

          <div class="flex space-x-3">
            <button
              class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              @click="emit('close')"
            >
              Cancel
            </button>
            <button
              :disabled="!isValid()"
              class="px-4 py-2 bg-primary-500 dark:bg-primary-900/40 text-white dark:text-primary-300 hover:bg-primary-600 dark:hover:bg-primary-900/60 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              @click="save"
            >
              {{ currentAmount != null ? "Update" : "Set" }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
