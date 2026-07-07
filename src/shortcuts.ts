// Single source of truth for the app's global keyboard shortcuts. Consumed by the
// keydown handler (App.vue), the command palette hints (CommandPalette.vue), and the
// Settings remap UI (SettingsView.vue) via the useShortcuts composable — replacing the
// three hand-synced copies that #147 left behind.
//
// `mod` is the primary accelerator: Cmd on macOS, Ctrl on Windows/Linux.

export type ShortcutId =
  | "command-palette"
  | "new-transaction"
  | "dashboard"
  | "transactions"
  | "recurring"
  | "budgets"
  | "goals"
  | "insights"
  | "investment-insights"
  | "calculators"
  | "categories"
  | "accounts"
  | "investments"
  | "settings"
  | "toggle-privacy"
  | "lock";

export interface ShortcutCombo {
  key: string; // normalized single lowercase character (e.g. "a", "k")
  mod: boolean; // Cmd on macOS, Ctrl elsewhere
  shift: boolean;
  alt: boolean;
}

export interface ShortcutDef {
  id: ShortcutId;
  description: string;
  defaultCombo: ShortcutCombo;
  // Links to a command in commands.ts so the palette can share the same action.
  // Absent for shortcuts with no palette entry (command-palette toggles the palette).
  commandId?: string;
}

function combo(
  key: string,
  { shift = false, alt = false }: { shift?: boolean; alt?: boolean } = {},
): ShortcutCombo {
  return { key, mod: true, shift, alt };
}

export const SHORTCUTS: ShortcutDef[] = [
  { id: "command-palette", description: "Open command palette", defaultCombo: combo("k") },
  { id: "new-transaction", description: "New transaction", defaultCombo: combo("n"), commandId: "new-transaction" },
  { id: "dashboard", description: "Go to Dashboard", defaultCombo: combo("d"), commandId: "dashboard" },
  { id: "transactions", description: "Go to Transactions", defaultCombo: combo("t"), commandId: "transactions" },
  { id: "recurring", description: "Go to Schedules", defaultCombo: combo("s"), commandId: "recurring" },
  { id: "budgets", description: "Go to Budgets", defaultCombo: combo("b"), commandId: "budgets" },
  { id: "goals", description: "Go to Goals", defaultCombo: combo("g"), commandId: "goals" },
  { id: "insights", description: "Go to General Insights", defaultCombo: combo("i"), commandId: "insights" },
  { id: "investment-insights", description: "Go to Portfolio Insights", defaultCombo: combo("p"), commandId: "investment-insights" },
  { id: "calculators", description: "Go to Calculators", defaultCombo: combo("c", { shift: true }), commandId: "calculators" },
  { id: "categories", description: "Go to Labels", defaultCombo: combo("l"), commandId: "categories" },
  { id: "accounts", description: "Go to Accounts", defaultCombo: combo("a", { shift: true }), commandId: "accounts" },
  { id: "investments", description: "Go to Investments", defaultCombo: combo("i", { shift: true }), commandId: "investments" },
  { id: "settings", description: "Go to Settings", defaultCombo: combo("s", { shift: true }), commandId: "settings" },
  { id: "toggle-privacy", description: "Toggle Privacy Mode", defaultCombo: combo("p", { shift: true }), commandId: "toggle-privacy" },
  { id: "lock", description: "Lock OneFinance", defaultCombo: combo("l", { shift: true }), commandId: "lock" },
];

const MODIFIER_KEYS = new Set(["control", "shift", "alt", "meta", "os"]);

// Build a combo from a keydown event. Returns null for a modifier-only press (used by
// the capture UI so holding Ctrl alone doesn't register a binding) or when no `mod` is
// held (all app shortcuts require the accelerator).
export function comboFromEvent(e: KeyboardEvent, isMac: boolean): ShortcutCombo | null {
  const key = e.key.toLowerCase();
  if (MODIFIER_KEYS.has(key)) return null;
  const mod = isMac ? e.metaKey : e.ctrlKey;
  if (!mod) return null;
  return { key, mod, shift: e.shiftKey, alt: e.altKey };
}

export function combosEqual(a: ShortcutCombo, b: ShortcutCombo): boolean {
  return a.key === b.key && a.mod === b.mod && a.shift === b.shift && a.alt === b.alt;
}

// Match an event against an effective combo (exact modifier state, so Ctrl+A and
// Ctrl+Shift+A stay distinct and unbound plain combos fall through to the browser).
export function eventMatchesCombo(e: KeyboardEvent, combo: ShortcutCombo, isMac: boolean): boolean {
  const mod = isMac ? e.metaKey : e.ctrlKey;
  return (
    e.key.toLowerCase() === combo.key &&
    mod === combo.mod &&
    e.shiftKey === combo.shift &&
    e.altKey === combo.alt
  );
}

const KEY_LABELS: Record<string, string> = {
  " ": "Space",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
};

function keyLabel(key: string): string {
  return KEY_LABELS[key] ?? key.toUpperCase();
}

// OS-aware chip labels, e.g. ["⌘","⇧","A"] on macOS vs ["Ctrl","Shift","A"] elsewhere.
export function comboToParts(combo: ShortcutCombo, isMac: boolean): string[] {
  const parts: string[] = [];
  if (combo.mod) parts.push(isMac ? "⌘" : "Ctrl");
  if (combo.alt) parts.push(isMac ? "⌥" : "Alt");
  if (combo.shift) parts.push(isMac ? "⇧" : "Shift");
  parts.push(keyLabel(combo.key));
  return parts;
}

export function serializeCombo(combo: ShortcutCombo): string {
  return [combo.mod ? "mod" : "", combo.alt ? "alt" : "", combo.shift ? "shift" : "", combo.key]
    .filter(Boolean)
    .join("+");
}

export function parseCombo(raw: string): ShortcutCombo | null {
  const tokens = raw.split("+");
  const key = tokens.pop();
  if (!key) return null;
  return {
    key,
    mod: tokens.includes("mod"),
    shift: tokens.includes("shift"),
    alt: tokens.includes("alt"),
  };
}

// Reset `resetId` to its default, then drop any override that now collides with that
// restored default. Unlike setBinding, reset has no conflict check — and since
// matchEvent resolves duplicates by registry order, a reclaimed combo would leave the
// other shortcut silently shadowed. Defaults never collide, so a cleared shortcut
// falls back to a distinct binding.
export function pruneResetConflicts(
  overrides: Partial<Record<ShortcutId, ShortcutCombo>>,
  resetId: ShortcutId,
): Partial<Record<ShortcutId, ShortcutCombo>> {
  const next = { ...overrides };
  delete next[resetId];
  const restored = SHORTCUTS.find((s) => s.id === resetId)!.defaultCombo;
  for (const def of SHORTCUTS) {
    if (def.id === resetId) continue;
    const override = next[def.id];
    if (override && combosEqual(override, restored)) delete next[def.id];
  }
  return next;
}
