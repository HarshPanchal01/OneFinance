<script setup lang="ts">
import { AccountType } from '@/types';
import { ref } from 'vue';

const props = defineProps<{
  editingAccountType: AccountType;
  nameLocked?: boolean;
}>();

const accountTypeForm = ref({...props.editingAccountType});

defineEmits<{
  (e: 'closeAccountTypeModal'): void;
  (e: 'saveAccountType', accountTypeForm: AccountType): void;
}>();


</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        class="absolute inset-0 bg-black/50"
        @click="$emit('closeAccountTypeModal')"
      />

      <div
        class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] flex flex-col"
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0"
        >
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ editingAccountType.id != 0 ? "Edit Account Type" : "New Account Type" }}
          </h3>
          <button
            class="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
            @click="$emit('closeAccountTypeModal')"
          >
            <i class="pi pi-times" />
          </button>
        </div>

        <!-- Form -->
        <div class="p-6 space-y-4 overflow-y-auto min-h-0">
          <!-- Preview -->
          <div class="flex justify-center" />

          <!-- Name -->
          <div>
            <label
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Name
            </label>
            <input
              v-model="accountTypeForm.type"
              type="text"
              placeholder="e.g., RRSP"
              :disabled="nameLocked"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <p
              v-if="nameLocked"
              class="text-xs text-gray-500 dark:text-gray-400 mt-1"
            >
              <i class="pi pi-lock text-xs mr-1" />
              Default account type — the name can't be changed.
            </p>
          </div>

          <!-- Classification -->
          <div>
            <label
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Classification
            </label>
            <select
              v-model="accountTypeForm.classification"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="liquid">
                Liquid (Cash/Checking)
              </option>
              <option value="asset">
                Asset (Property/Investments)
              </option>
              <option value="liability">
                Liability (Loans/Credit Cards)
              </option>
            </select>
          </div>
        </div>  

        <!-- Footer -->
        <div
          class="flex justify-end space-x-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700"
        >
          <button
            class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            @click="$emit('closeAccountTypeModal')"
          >
            Cancel
          </button>
          <button
            :disabled="!accountTypeForm.type.trim()"
            class="px-4 py-2 bg-primary-500 dark:bg-primary-900/40 text-white dark:text-primary-300 hover:bg-primary-600 dark:hover:bg-primary-900/60 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            @click="$emit('saveAccountType', accountTypeForm)"
          >
            {{ editingAccountType.id != 0 ? "Update" : "Create" }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>