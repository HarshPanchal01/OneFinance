// Pure auto-categorization rule matching (#143). No Vue/Electron imports — shared by
// TransactionModal's suggestion hook and unit-tested in tests/rules.test.ts.

import type { CategorizationRule, RuleMatchType } from "@/types";

// Single source of truth for rule ordering — also mirrored by the SQL
// `ORDER BY priority ASC, id ASC` in getCategorizationRules (electron/db.ts).
export function compareRules(
  a: Pick<CategorizationRule, "priority" | "id">,
  b: Pick<CategorizationRule, "priority" | "id">
): number {
  return a.priority - b.priority || a.id - b.id;
}

// Canonical display labels; drives both the RuleModal select and the list chips.
export const MATCH_TYPE_LABELS: Record<RuleMatchType, string> = {
  contains: "Contains",
  startsWith: "Starts with",
  equals: "Equals",
};

// Priorities can go sparse after a category CASCADE delete, so "append at end"
// must use max+1, not rules.length (length can point mid-list).
export function nextRulePriority(rules: CategorizationRule[]): number {
  return rules.reduce((max, r) => Math.max(max, r.priority + 1), 0);
}

export function ruleMatches(
  title: string,
  rule: Pick<CategorizationRule, "pattern" | "matchType">
): boolean {
  const t = title.trim().toLowerCase();
  const p = rule.pattern.trim().toLowerCase();
  // An empty pattern would match everything under 'contains' ("".includes("") is true).
  if (!t || !p) return false;
  switch (rule.matchType) {
    case "startsWith":
      return t.startsWith(p);
    case "equals":
      return t === p;
    default:
      return t.includes(p);
  }
}

// First active rule matching the title, in priority order (priority asc, id asc).
// Callers pre-filter by transaction-type validity; the matcher is type-agnostic.
// The defensive sort keeps the pure contract independent of input order.
export function matchRules(
  title: string,
  rules: CategorizationRule[]
): CategorizationRule | null {
  const ordered = [...rules].sort(compareRules);
  return ordered.find((r) => r.isActive && ruleMatches(title, r)) ?? null;
}
