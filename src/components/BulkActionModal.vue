<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useFinanceStore } from "@/stores/finance";

const props = defineProps<{
  visible: boolean;
  mode: "category" | "account";
  title: string;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [id: number | null];
}>();

const store = useFinanceStore();
const selectedId = ref<number | null>(null);

// Reset form when modal opens
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      selectedId.value = props.mode === 'account' ? (store.accounts[0]?.id || null) : null;
    }
  }
);

// Valid categories: excluding transfer categories (which don't have a UI category anyway, but it's safe to just show all)
const categories = computed(() => store.categories);

const isValid = computed(() => {
  if (props.mode === 'account') {
    return selectedId.value !== null;
  }
  return true; // category can be null
});

function handleConfirm() {
  if (isValid.value) {
    emit("confirm", selectedId.value);
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-gray-900/50 dark:bg-gray-900/80 backdrop-blur-sm transition-opacity"
        @click="emit('close')"
      />

      <!-- Modal -->
      <div
        class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700"
        >
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ title }}
          </h3>
          <button
            class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
            @click="emit('close')"
          >
            <i class="pi pi-times" />
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 overflow-y-auto">
          <div v-if="mode === 'category'">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Select Category
            </label>
            <select
              v-model="selectedId"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option :value="null">
                No category
              </option>
              <option
                v-for="cat in categories"
                :key="cat.id"
                :value="cat.id"
              >
                {{ cat.name }}
              </option>
            </select>
          </div>

          <div v-if="mode === 'account'">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Select Account
            </label>
            <select
              v-model="selectedId"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option
                v-for="acc in store.accounts"
                :key="acc.id"
                :value="acc.id"
              >
                {{ acc.accountName }}
              </option>
            </select>
          </div>
        </div>

        <!-- Footer -->
        <div
          class="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end space-x-3 shrink-0"
        >
          <button
            class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium"
            @click="emit('close')"
          >
            Cancel
          </button>
          <button
            class="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!isValid"
            @click="handleConfirm"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>