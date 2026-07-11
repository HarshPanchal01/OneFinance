<script setup lang="ts">
import { computed, ref } from "vue";
import { useFinanceStore } from "@/stores/finance";
import { MATCH_TYPE_LABELS } from "@/rules";
import type { CategorizationRule } from "@/types";

const props = defineProps<{
  editingRule: CategorizationRule;
}>();

defineEmits<{
  (e: "closeRuleModal"): void;
  (e: "saveRule", ruleForm: CategorizationRule): void;
}>();

const store = useFinanceStore();

const ruleForm = ref({ ...props.editingRule, isActive: !!props.editingRule.isActive });

const isValid = computed(
  () => ruleForm.value.pattern.trim().length > 0 && ruleForm.value.categoryId !== 0
);
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <div
        class="absolute inset-0 bg-black/50"
        @click="$emit('closeRuleModal')"
      />

      <div
        class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] flex flex-col"
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0"
        >
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ editingRule.id != 0 ? "Edit Rule" : "New Rule" }}
          </h3>
          <button
            class="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
            @click="$emit('closeRuleModal')"
          >
            <i class="pi pi-times" />
          </button>
        </div>

        <!-- Form -->
        <div class="p-6 space-y-4">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            When a transaction title matches, the category is suggested
            automatically — you can always override it before saving.
          </p>

          <!-- Match type + pattern -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title
            </label>
            <div class="flex gap-2">
              <select
                v-model="ruleForm.matchType"
                class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option
                  v-for="(label, value) in MATCH_TYPE_LABELS"
                  :key="value"
                  :value="value"
                >
                  {{ label }}
                </option>
              </select>
              <input
                v-model="ruleForm.pattern"
                type="text"
                placeholder="e.g., Starbucks"
                class="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Matching is case-insensitive.
            </p>
          </div>

          <!-- Target category -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Set Category To
            </label>
            <select
              v-model="ruleForm.categoryId"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option
                :value="0"
                disabled
              >
                Select a category
              </option>
              <option
                v-for="category in store.categories"
                :key="category.id"
                :value="category.id"
              >
                {{ category.name }} ({{ category.type }})
              </option>
            </select>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              The rule only fires on transactions the category's type allows.
            </p>
          </div>

          <!-- Active toggle -->
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Active</span>
            <button
              type="button"
              role="switch"
              :aria-checked="ruleForm.isActive"
              class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
              :class="ruleForm.isActive ? 'bg-primary-500 dark:bg-primary-500/30' : 'bg-gray-200 dark:bg-gray-700'"
              @click="ruleForm.isActive = !ruleForm.isActive"
            >
              <span
                class="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform"
                :class="ruleForm.isActive ? 'translate-x-5' : 'translate-x-1'"
              />
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div
          class="flex justify-end space-x-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0"
        >
          <button
            class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            @click="$emit('closeRuleModal')"
          >
            Cancel
          </button>
          <button
            :disabled="!isValid"
            class="px-4 py-2 bg-primary-500 dark:bg-primary-900/40 text-white dark:text-primary-300 hover:bg-primary-600 dark:hover:bg-primary-900/60 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            @click="$emit('saveRule', ruleForm)"
          >
            {{ editingRule.id != 0 ? "Update" : "Create" }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
