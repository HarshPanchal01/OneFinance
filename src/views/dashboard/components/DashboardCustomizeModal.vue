<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  DASHBOARD_WIDGETS,
  DEFAULT_DETAIL_ORDER,
  type DashboardWidgetId,
} from "@/views/dashboard/widgets";
import type { DashboardLayout } from "@/composables/useDashboardLayout";

const props = defineProps<{
  visible: boolean;
  layout: DashboardLayout;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", layout: DashboardLayout): void;
}>();

// Draft state — only committed on Save, discarded on Cancel.
const draftHidden = ref<Set<DashboardWidgetId>>(new Set());
const draftOrder = ref<DashboardWidgetId[]>([]);

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      draftHidden.value = new Set(props.layout.hidden);
      draftOrder.value = [...props.layout.detailOrder];
    }
  },
  { immediate: true }
);

const topWidgets = computed(() =>
  DASHBOARD_WIDGETS.filter((w) => w.zone === "top")
);

const detailWidgets = computed(() =>
  draftOrder.value.map((id) => DASHBOARD_WIDGETS.find((w) => w.id === id)!)
);

function isVisible(id: DashboardWidgetId) {
  return !draftHidden.value.has(id);
}

function toggle(id: DashboardWidgetId) {
  const next = new Set(draftHidden.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  draftHidden.value = next;
}

function move(index: number, delta: number) {
  const target = index + delta;
  if (target < 0 || target >= draftOrder.value.length) return;
  const next = [...draftOrder.value];
  [next[index], next[target]] = [next[target], next[index]];
  draftOrder.value = next;
}

function resetDraft() {
  draftHidden.value = new Set();
  draftOrder.value = [...DEFAULT_DETAIL_ORDER];
}

function save() {
  emit("save", {
    hidden: [...draftHidden.value],
    detailOrder: [...draftOrder.value],
  });
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        class="absolute inset-0 bg-black/50"
        @click="emit('close')"
      />

      <div
        class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 flex flex-col max-h-[85vh]"
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0"
        >
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            Customize Dashboard
          </h3>
          <button
            class="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
            @click="emit('close')"
          >
            <i class="pi pi-times" />
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-5 overflow-y-auto">
          <!-- Fixed-position widgets: show/hide only -->
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">
              Overview
            </p>
            <ul class="space-y-2">
              <li
                v-for="widget in topWidgets"
                :key="widget.id"
                class="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
              >
                <span class="text-sm font-medium text-gray-800 dark:text-gray-100">
                  {{ widget.label }}
                </span>
                <button
                  type="button"
                  role="switch"
                  :aria-checked="isVisible(widget.id)"
                  class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
                  :class="isVisible(widget.id) ? 'bg-primary-500 dark:bg-primary-500/30' : 'bg-gray-200 dark:bg-gray-700'"
                  @click="toggle(widget.id)"
                >
                  <span
                    class="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform"
                    :class="isVisible(widget.id) ? 'translate-x-5' : 'translate-x-1'"
                  />
                </button>
              </li>
            </ul>
          </div>

          <!-- Detail-row widgets: show/hide + reorder -->
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">
              Widgets
            </p>
            <ul class="space-y-2">
              <li
                v-for="(widget, index) in detailWidgets"
                :key="widget.id"
                class="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
              >
                <div class="flex flex-col">
                  <button
                    type="button"
                    class="p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
                    :disabled="index === 0"
                    aria-label="Move up"
                    @click="move(index, -1)"
                  >
                    <i class="pi pi-chevron-up text-xs" />
                  </button>
                  <button
                    type="button"
                    class="p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
                    :disabled="index === detailWidgets.length - 1"
                    aria-label="Move down"
                    @click="move(index, 1)"
                  >
                    <i class="pi pi-chevron-down text-xs" />
                  </button>
                </div>
                <span class="flex-1 text-sm font-medium text-gray-800 dark:text-gray-100">
                  {{ widget.label }}
                </span>
                <button
                  type="button"
                  role="switch"
                  :aria-checked="isVisible(widget.id)"
                  class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
                  :class="isVisible(widget.id) ? 'bg-primary-500 dark:bg-primary-500/30' : 'bg-gray-200 dark:bg-gray-700'"
                  @click="toggle(widget.id)"
                >
                  <span
                    class="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform"
                    :class="isVisible(widget.id) ? 'translate-x-5' : 'translate-x-1'"
                  />
                </button>
              </li>
            </ul>
          </div>
        </div>

        <!-- Footer -->
        <div
          class="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0"
        >
          <button
            class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            @click="resetDraft"
          >
            Reset to default
          </button>

          <div class="flex space-x-3">
            <button
              class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              @click="emit('close')"
            >
              Cancel
            </button>
            <button
              class="px-4 py-2 bg-primary-500 dark:bg-primary-900/40 text-white dark:text-primary-300 hover:bg-primary-600 dark:hover:bg-primary-900/60 rounded-lg transition-colors"
              @click="save"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
