<script setup lang="ts">
import { useFormatter } from "@/composables/useFormatter";
import { useSettingsStore } from "@/stores/settings";

const props = defineProps<{
  amount: number;
  class?: string;
  showBlur?: boolean;
}>();

const { formatCurrency } = useFormatter();
const settingsStore = useSettingsStore();
</script>

<template>
  <span
    :class="[
      props.class,
      { 'privacy-blur': settingsStore.privacyMode && (props.showBlur !== false) }
    ]"
  >
    {{ formatCurrency(props.amount) }}
  </span>
</template>
