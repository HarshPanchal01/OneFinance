// Pure auto-categorization rule matching (#143). No Vue/Electron imports — shared by
// TransactionModal's suggestion hook and unit-tested in tests/rules.test.ts.

import type { CategorizationRule } from "@/types";

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
export function matchRules(
  title: string,
  rules: CategorizationRule[]
): CategorizationRule | null {
  const ordered = [...rules].sort(
    (a, b) => a.priority - b.priority || a.id - b.id
  );
  return ordered.find((r) => r.isActive && ruleMatches(title, r)) ?? null;
}
