<script setup lang="ts">
import { useFinanceStore } from '@/stores/finance'
import { useSettingsStore } from '@/stores/settings'
import { useFormatter } from '@/composables/useFormatter'
import { computed, ref, watch } from 'vue';


    interface Props {
        accountName: string
        institutionName: string
        startingBalance: number
        balance?: number
        accountTypeId: number
        isDefault: boolean
        isHighlighted?: boolean
    }

    const store = useFinanceStore();
    const settingsStore = useSettingsStore();
    const { formatCurrency } = useFormatter();
    const tileRef = ref<HTMLElement | null>(null);

    const emits = defineEmits<{
        (e: 'edit'): void,
        (e: 'delete'): void,
        (e: 'view-transactions'): void
    }>();

    function handleEditClick() {
        emits('edit');
    }


    function handleDeleteClick() {
        emits('delete');
    }

    const props = defineProps<Props>();

    const accountTypeObj = computed(() =>
      props.accountTypeId != null
        ? store.accountTypes.find((t) => t.id === props.accountTypeId)
        : null
    );

    const accountType = computed(() => accountTypeObj.value?.type ?? 'N/A');
    const accountClassification = computed(() => accountTypeObj.value?.classification ?? 'liquid');

    const displayBalance = computed(() => {
      const rawBalance = props.balance ?? props.startingBalance;
      return accountClassification.value === 'liability' ? Math.abs(rawBalance) : rawBalance;
    });

    watch(() => props.isHighlighted, (newVal) => {
      if (newVal && tileRef.value) {
        tileRef.value.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, { immediate: true });

</script>

<template>
  <div
    ref="tileRef"
    class="grid grid-cols-[1fr_200px_150px_200px_120px] items-center px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30"
    :class="[
      isHighlighted ? 'highlight-blink' : ''
    ]"
  >
    <div class="font-bold text-gray-900 dark:text-white flex items-center min-w-0">
      <span class="truncate">{{ props.accountName }}</span>
      <span
        v-if="props.isDefault"
        class="ml-2 px-1.5 py-0.5 text-[10px] uppercase font-bold text-white bg-primary-500 rounded shrink-0"
      >Default</span>
    </div>
    <div class="text-gray-500 dark:text-gray-400 truncate pr-4">
      {{ props.institutionName || '---' }}
    </div>
    <div class="text-gray-500 dark:text-gray-400 truncate pr-4">
      {{ accountType }}
    </div>
    <div class="text-right font-semibold text-gray-900 dark:text-white">
      <span :class="{ 'privacy-blur': settingsStore.privacyMode }">{{ formatCurrency(displayBalance) }}</span>
    </div>
    <div class="flex items-center justify-end space-x-2">
      <button
        class="p-1 text-gray-400 hover:text-primary-500 transition-colors"
        title="View Transactions"
        @click="emits('view-transactions')"
      >
        <i class="pi pi-list" />
      </button>
      <button
        class="p-1 text-gray-400 hover:text-primary-500 transition-colors"
        title="Edit"
        @click="handleEditClick"
      >
        <i class="pi pi-pencil" />
      </button>
      <button
        class="p-1 text-gray-400 hover:text-expense transition-colors"
        title="Delete"
        @click="handleDeleteClick"
      >
        <i class="pi pi-trash" />
      </button>
    </div>
  </div>
</template>