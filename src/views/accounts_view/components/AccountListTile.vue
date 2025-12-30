<template>
  <div
    class="flex items-center justify-between p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors"
  >
    <div class="flex flex-col">
      <p class="font-medium text-gray-900">
        {{ props.accountName }}
      </p>
      <p class="text-sm text-gray-500">
        {{ props.institutionName }} • Type: {{ accountType }} 
        <span
          v-if="props.isDefault"
          class="ml-2 px-1.5 py-0.5 text-xs font-semibold text-white bg-blue-500 rounded"
        >Default</span>
      </p>
      <p class="text-sm text-gray-700 mt-1">
        Balance: ${{ props.startingBalance.toLocaleString() }}
      </p>
    </div>

    <div class="flex space-x-2">
      <button
        class="px-3 py-1 text-sm font-medium text-white bg-green-500 hover:bg-green-600 rounded transition-colors"
        @click="handleEditClick"
      >
        Edit
      </button>
      <button
        class="px-3 py-1 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded transition-colors"
        @click="handleDeleteClick"
      >
        Delete
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useFinanceStore } from '@/stores/finance'
import { computed } from 'vue';


    interface Props {
        accountName: string
        institutionName: string
        startingBalance: number
        accountTypeId: number
        isDefault: boolean
    }

    const store = useFinanceStore();

    const emits = defineEmits<{
        (e: 'edit'): void,
        (e: 'delete'): void
    }>();

    function handleEditClick() {
        emits('edit');
    }


    function handleDeleteClick() {
        emits('delete');
    }

    const props = defineProps<Props>();

    const accountType = computed(() =>
      props.accountTypeId != null
        ? store.accountTypes.find((t) => t.id === props.accountTypeId)?.type ?? 'N/A'
        : 'N/A'
    );


</script>