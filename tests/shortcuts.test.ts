import { describe, it, expect } from "vitest";
import {
  SHORTCUTS,
  comboFromEvent,
  combosEqual,
  comboToParts,
  eventMatchesCombo,
  parseCombo,
  pruneResetConflicts,
  serializeCombo,
  type ShortcutCombo,
  type ShortcutId,
} from "../src/shortcuts";

// Minimal KeyboardEvent stand-in for the pure helpers.
function ev(
  key: string,
  { ctrl = false, meta = false, shift = false, alt = false } = {},
): KeyboardEvent {
  return { key, ctrlKey: ctrl, metaKey: meta, shiftKey: shift, altKey: alt } as KeyboardEvent;
}

function combo(overrides: Partial<ShortcutCombo> = {}): ShortcutCombo {
  return { key: "a", mod: true, shift: false, alt: false, ...overrides };
}

describe("comboFromEvent", () => {
  it("builds a combo from a mod+key press (Ctrl on non-mac)", () => {
    expect(comboFromEvent(ev("A", { ctrl: true, shift: true }), false)).toEqual({
      key: "a",
      mod: true,
      shift: true,
      alt: false,
    });
  });

  it("uses Cmd (meta) as the accelerator on macOS, not Ctrl", () => {
    expect(comboFromEvent(ev("d", { meta: true }), true)).toEqual({
      key: "d",
      mod: true,
      shift: false,
      alt: false,
    });
    // Ctrl alone is not the accelerator on mac.
    expect(comboFromEvent(ev("d", { ctrl: true }), true)).toBeNull();
  });

  it("returns null without the accelerator or for modifier-only presses", () => {
    expect(comboFromEvent(ev("d"), false)).toBeNull();
    expect(comboFromEvent(ev("Control", { ctrl: true }), false)).toBeNull();
    expect(comboFromEvent(ev("Shift", { ctrl: true, shift: true }), false)).toBeNull();
  });
});

describe("eventMatchesCombo — exact modifier state", () => {
  it("matches only the exact modifier combination", () => {
    const c = combo({ key: "a", shift: true });
    expect(eventMatchesCombo(ev("a", { ctrl: true, shift: true }), c, false)).toBe(true);
    // Ctrl+A (no shift) must NOT match Ctrl+Shift+A.
    expect(eventMatchesCombo(ev("a", { ctrl: true }), c, false)).toBe(false);
  });

  it("distinguishes mac Cmd from Ctrl", () => {
    const c = combo({ key: "k" });
    expect(eventMatchesCombo(ev("k", { meta: true }), c, true)).toBe(true);
    expect(eventMatchesCombo(ev("k", { ctrl: true }), c, true)).toBe(false);
  });
});

describe("comboToParts — OS-aware labels", () => {
  it("renders Ctrl/Shift on non-mac", () => {
    expect(comboToParts(combo({ key: "a", shift: true }), false)).toEqual(["Ctrl", "Shift", "A"]);
  });

  it("renders ⌘/⇧/⌥ on mac", () => {
    expect(comboToParts(combo({ key: "a", shift: true, alt: true }), true)).toEqual([
      "⌘",
      "⌥",
      "⇧",
      "A",
    ]);
  });
});

describe("serialize / parse round-trip", () => {
  it("round-trips every default combo", () => {
    for (const def of SHORTCUTS) {
      const parsed = parseCombo(serializeCombo(def.defaultCombo));
      expect(parsed).not.toBeNull();
      expect(combosEqual(parsed!, def.defaultCombo)).toBe(true);
    }
  });
});

describe("pruneResetConflicts — reset can't silently shadow another shortcut", () => {
  const insightsDefault = SHORTCUTS.find((s) => s.id === "insights")!.defaultCombo;

  it("drops an override that collides with the reset shortcut's restored default", () => {
    // insights was moved off its default; transactions was custom-bound onto it.
    const overrides: Partial<Record<ShortcutId, ShortcutCombo>> = {
      insights: { key: "m", mod: true, shift: false, alt: false },
      transactions: { ...insightsDefault },
    };
    const next = pruneResetConflicts(overrides, "insights");
    expect(next.insights).toBeUndefined(); // back to its default combo
    expect(next.transactions).toBeUndefined(); // colliding override cleared, not shadowed
  });

  it("leaves non-colliding overrides untouched", () => {
    const other: ShortcutCombo = { key: "j", mod: true, shift: false, alt: false };
    const overrides: Partial<Record<ShortcutId, ShortcutCombo>> = {
      insights: { key: "m", mod: true, shift: false, alt: false },
      transactions: other,
    };
    const next = pruneResetConflicts(overrides, "insights");
    expect(next.insights).toBeUndefined();
    expect(next.transactions).toEqual(other);
  });
});

describe("registry integrity", () => {
  it("has no duplicate ids or colliding default combos", () => {
    const ids = new Set<string>();
    const seen = new Set<string>();
    for (const def of SHORTCUTS) {
      expect(ids.has(def.id)).toBe(false);
      ids.add(def.id);
      const sig = serializeCombo(def.defaultCombo);
      expect(seen.has(sig)).toBe(false);
      seen.add(sig);
    }
  });
});
