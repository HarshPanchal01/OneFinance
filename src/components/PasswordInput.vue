<script setup lang="ts">
import { ref } from "vue";

const model = defineModel<string>({ required: true });
defineProps<{ autofocus?: boolean }>();

const show = ref(false);
</script>

<template>
  <div class="relative">
    <input
      v-model="model"
      :type="show ? 'text' : 'password'"
      :autofocus="autofocus"
      class="w-full px-3 py-2 pr-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
    />
    <button
      type="button"
      tabindex="-1"
      :aria-label="show ? 'Hide password' : 'Show password'"
      class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
      @click="show = !show"
    >
      <i
        :class="show ? 'pi pi-eye-slash' : 'pi pi-eye'"
        class="text-sm"
      />
    </button>
  </div>
</template>
