<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import type { Command } from "@/commands";

const props = defineProps<{
  visible: boolean;
  commands: Command[];
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "run", command: Command): void;
}>();

const query = ref("");
const selectedIndex = ref(0);
const inputEl = ref<HTMLInputElement>();
const listEl = ref<HTMLElement>();

// Substring match ranks highest (earlier = better); otherwise a subsequence
// match with a small streak bonus so contiguous hits win. null = no match.
function fuzzyScore(q: string, text: string): number | null {
  if (!q) return 0;
  const t = text.toLowerCase();
  const idx = t.indexOf(q);
  if (idx !== -1) return 1000 - idx;

  let ti = 0;
  let score = 0;
  let streak = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found === -1) return null;
    streak = found === ti ? streak + 1 : 0;
    score += 10 + streak;
    ti = found + 1;
  }
  return score;
}

const filtered = computed<Command[]>(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return props.commands;

  return props.commands
    .map((cmd) => ({
      cmd,
      score: fuzzyScore(q, `${cmd.label} ${cmd.keywords ?? ""} ${cmd.section}`),
    }))
    .filter((r): r is { cmd: Command; score: number } => r.score !== null)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.cmd);
});

watch(
  () => props.visible,
  (open) => {
    if (open) {
      query.value = "";
      selectedIndex.value = 0;
      void nextTick(() => inputEl.value?.focus());
    }
  },
);

// Snap back to the best match on every keystroke so Enter runs the top result.
watch(query, () => {
  selectedIndex.value = 0;
});

function move(delta: number) {
  const count = filtered.value.length;
  if (count === 0) return;
  selectedIndex.value = (selectedIndex.value + delta + count) % count;
  void nextTick(() => {
    listEl.value
      ?.querySelector(".cmd-row-selected")
      ?.scrollIntoView({ block: "nearest" });
  });
}

// Only hover-select on genuine pointer movement: arrow-key scrolling slides rows
// under a stationary cursor, which fires mousemove in Chromium and would otherwise
// hijack the keyboard selection.
let lastX = -1;
let lastY = -1;
function onRowHover(e: MouseEvent, index: number) {
  if (e.clientX === lastX && e.clientY === lastY) return;
  lastX = e.clientX;
  lastY = e.clientY;
  selectedIndex.value = index;
}

function run(cmd: Command) {
  emit("run", cmd);
  emit("close");
}

function onEnter() {
  const cmd = filtered.value[selectedIndex.value];
  if (cmd) run(cmd);
}

// Section headers only make sense on the full, section-contiguous list. Once a
// query reorders results by score, sections interleave, so headers are hidden.
function isSectionStart(index: number): boolean {
  if (query.value.trim()) return false;
  return index === 0 || filtered.value[index - 1].section !== filtered.value[index].section;
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
    >
      <div
        class="absolute inset-0 bg-black/50"
        @click="emit('close')"
      />
      <div
        class="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        <!-- Search input -->
        <div class="flex items-center px-4 border-b border-gray-200 dark:border-gray-700">
          <i class="pi pi-search text-gray-400 dark:text-gray-500" />
          <input
            ref="inputEl"
            v-model="query"
            type="text"
            placeholder="Search commands..."
            class="flex-1 bg-transparent px-3 py-3.5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none"
            @keydown.down.prevent="move(1)"
            @keydown.up.prevent="move(-1)"
            @keydown.enter.prevent="onEnter"
            @keydown.esc.prevent="emit('close')"
          />
        </div>

        <!-- Results -->
        <div
          ref="listEl"
          class="max-h-80 overflow-y-auto p-2"
        >
          <p
            v-if="filtered.length === 0"
            class="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
          >
            No matching commands
          </p>

          <template
            v-for="(cmd, i) in filtered"
            :key="cmd.id"
          >
            <p
              v-if="isSectionStart(i)"
              class="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500"
            >
              {{ cmd.section }}
            </p>
            <button
              :class="[
                'w-full flex items-center px-3 py-2 rounded-lg text-sm transition-colors text-left',
                i === selectedIndex
                  ? 'cmd-row-selected bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
              ]"
              @click="run(cmd)"
              @mousemove="onRowHover($event, i)"
            >
              <i :class="['pi mr-3 text-base', cmd.icon]" />
              <span class="flex-1">{{ cmd.label }}</span>
              <span
                v-if="cmd.shortcut"
                class="flex items-center space-x-1"
              >
                <kbd
                  v-for="key in cmd.shortcut"
                  :key="key"
                  class="px-1.5 py-0.5 text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded border border-gray-300 dark:border-gray-600"
                >
                  {{ key }}
                </kbd>
              </span>
            </button>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>
