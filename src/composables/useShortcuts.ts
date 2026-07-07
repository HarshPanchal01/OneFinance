import { computed, ref } from "vue";
import {
  SHORTCUTS,
  type ShortcutCombo,
  type ShortcutDef,
  type ShortcutId,
  combosEqual,
  comboToParts,
  eventMatchesCombo,
  parseCombo,
  pruneResetConflicts,
  serializeCombo,
} from "@/shortcuts";

const STORAGE_KEY = "keyboardShortcuts";
const VALID_IDS = new Set(SHORTCUTS.map((s) => s.id));

// Module-singleton state so every consumer shares one reactive binding set
// (mirrors useDashboardLayout).
const overrides = ref<Partial<Record<ShortcutId, ShortcutCombo>>>({});
const isMac = ref(false);
let loaded = false;
let platformResolved = false;

function persist() {
  const raw: Record<string, string> = {};
  for (const [id, combo] of Object.entries(overrides.value)) {
    if (combo) raw[id] = serializeCombo(combo);
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
  } catch (e) {
    console.error("Failed to persist keyboard shortcuts", e);
  }
}

function load() {
  if (loaded) return;
  loaded = true;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    const next: Partial<Record<ShortcutId, ShortcutCombo>> = {};
    for (const [id, serialized] of Object.entries(parsed)) {
      if (!VALID_IDS.has(id as ShortcutId)) continue;
      const combo = parseCombo(serialized);
      if (combo) next[id as ShortcutId] = combo;
    }
    overrides.value = next;
  } catch (e) {
    console.error("Failed to load keyboard shortcuts", e);
  }
}

async function resolvePlatform() {
  if (platformResolved) return;
  platformResolved = true;
  try {
    isMac.value = (await window.electronAPI.getPlatform()) === "darwin";
  } catch (e) {
    console.error("Failed to resolve platform for shortcuts", e);
  }
}

export function useShortcuts() {
  load();
  void resolvePlatform();

  // Effective combo for a shortcut: custom override if set, else its default.
  function comboFor(id: ShortcutId): ShortcutCombo {
    const def = SHORTCUTS.find((s) => s.id === id) as ShortcutDef;
    return overrides.value[id] ?? def.defaultCombo;
  }

  const bindings = computed(() =>
    SHORTCUTS.map((def) => ({
      def,
      combo: comboFor(def.id),
      isCustom: !!overrides.value[def.id],
    })),
  );

  function partsFor(id: ShortcutId): string[] {
    return comboToParts(comboFor(id), isMac.value);
  }

  // Display parts for a palette command, looked up by its linked shortcut.
  function partsForCommand(commandId: string): string[] | null {
    const def = SHORTCUTS.find((s) => s.commandId === commandId);
    return def ? comboToParts(comboFor(def.id), isMac.value) : null;
  }

  // The shortcut (if any) already bound to `combo`, ignoring `excludeId`.
  function findConflict(combo: ShortcutCombo, excludeId: ShortcutId): ShortcutDef | null {
    for (const def of SHORTCUTS) {
      if (def.id === excludeId) continue;
      if (combosEqual(comboFor(def.id), combo)) return def;
    }
    return null;
  }

  function setBinding(id: ShortcutId, combo: ShortcutCombo) {
    overrides.value = { ...overrides.value, [id]: combo };
    persist();
  }

  function resetBinding(id: ShortcutId) {
    overrides.value = pruneResetConflicts(overrides.value, id);
    persist();
  }

  function resetAll() {
    overrides.value = {};
    persist();
  }

  // Resolve a keydown event to the shortcut it triggers, or null.
  function matchEvent(e: KeyboardEvent): ShortcutId | null {
    for (const def of SHORTCUTS) {
      if (eventMatchesCombo(e, comboFor(def.id), isMac.value)) return def.id;
    }
    return null;
  }

  return {
    isMac,
    bindings,
    comboFor,
    partsFor,
    partsForCommand,
    findConflict,
    setBinding,
    resetBinding,
    resetAll,
    matchEvent,
  };
}
