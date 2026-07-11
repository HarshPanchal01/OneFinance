import { describe, it, expect } from "vitest";
import { ruleMatches, matchRules } from "../src/rules";
import type { CategorizationRule } from "../src/types";

function rule(overrides: Partial<CategorizationRule> = {}): CategorizationRule {
  return {
    id: 1,
    pattern: "starbucks",
    matchType: "contains",
    categoryId: 10,
    priority: 0,
    isActive: true,
    ...overrides,
  };
}

describe("ruleMatches", () => {
  it("contains matches a substring anywhere, case-insensitive", () => {
    expect(ruleMatches("STARBUCKS #123", rule())).toBe(true);
    expect(ruleMatches("Morning Starbucks run", rule())).toBe(true);
    expect(ruleMatches("Tim Hortons", rule())).toBe(false);
  });

  it("startsWith matches a prefix only", () => {
    const r = rule({ matchType: "startsWith" });
    expect(ruleMatches("Starbucks downtown", r)).toBe(true);
    expect(ruleMatches("Coffee at Starbucks", r)).toBe(false);
  });

  it("equals matches the whole trimmed title only", () => {
    const r = rule({ pattern: "rent", matchType: "equals" });
    expect(ruleMatches("  Rent ", r)).toBe(true);
    expect(ruleMatches("Rent payment", r)).toBe(false);
  });

  it("trims surrounding whitespace on the pattern", () => {
    expect(ruleMatches("Starbucks", rule({ pattern: "  starbucks  " }))).toBe(true);
  });

  it("never matches an empty or whitespace-only pattern", () => {
    expect(ruleMatches("anything", rule({ pattern: "" }))).toBe(false);
    expect(ruleMatches("anything", rule({ pattern: "   " }))).toBe(false);
  });

  it("never matches an empty or whitespace-only title", () => {
    expect(ruleMatches("", rule())).toBe(false);
    expect(ruleMatches("   ", rule())).toBe(false);
  });
});

describe("matchRules", () => {
  it("returns null when nothing matches or the list is empty", () => {
    expect(matchRules("Groceries", [])).toBeNull();
    expect(matchRules("Groceries", [rule()])).toBeNull();
  });

  it("lower priority number wins regardless of array order", () => {
    const rules = [
      rule({ id: 1, priority: 5, categoryId: 10 }),
      rule({ id: 2, priority: 0, categoryId: 20 }),
    ];
    expect(matchRules("Starbucks", rules)?.categoryId).toBe(20);
  });

  it("ties on priority break by lower id", () => {
    const rules = [
      rule({ id: 7, priority: 1, categoryId: 10 }),
      rule({ id: 3, priority: 1, categoryId: 20 }),
    ];
    expect(matchRules("Starbucks", rules)?.categoryId).toBe(20);
  });

  it("skips inactive rules and falls through to the next match", () => {
    const rules = [
      rule({ id: 1, priority: 0, isActive: false, categoryId: 10 }),
      rule({ id: 2, priority: 1, categoryId: 20 }),
    ];
    expect(matchRules("Starbucks", rules)?.categoryId).toBe(20);
  });

  it("treats SQLite 0/1 integers as isActive booleans", () => {
    const off = rule({ id: 1, priority: 0, isActive: 0 as unknown as boolean });
    const on = rule({ id: 2, priority: 1, isActive: 1 as unknown as boolean, categoryId: 20 });
    expect(matchRules("Starbucks", [off, on])?.categoryId).toBe(20);
  });
});
