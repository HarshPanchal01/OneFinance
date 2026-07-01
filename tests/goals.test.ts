import { describe, it, expect } from "vitest";
import { computeGoalProjection } from "../src/utils";

const NOW = new Date("2026-07-01T12:00:00Z");

// Minimal goal shape the projection cares about.
function goal(overrides: Partial<Parameters<typeof computeGoalProjection>[0]> = {}) {
  return {
    targetAmount: 5000,
    targetDate: null as string | null,
    startingAmount: 0,
    createdDate: "2026-01-01",
    ...overrides,
  };
}

describe("computeGoalProjection — progress", () => {
  it("computes pct and remaining", () => {
    const p = computeGoalProjection(goal(), 1250, NOW);
    expect(p.pct).toBe(25);
    expect(p.remaining).toBe(3750);
    expect(p.reached).toBe(false);
  });

  it("flags reached and never projects once at/above target", () => {
    const p = computeGoalProjection(goal({ targetDate: "2026-12-31" }), 5000, NOW);
    expect(p.reached).toBe(true);
    expect(p.requiredMonthly).toBeNull();
    expect(p.onTrack).toBeNull();
    expect(p.dueWithinMonth).toBe(false);
  });

  it("guards divide-by-zero on a zero target", () => {
    const p = computeGoalProjection(goal({ targetAmount: 0 }), 0, NOW);
    expect(p.pct).toBe(0);
  });
});

describe("computeGoalProjection — projection", () => {
  it("returns no projection without a target date", () => {
    const p = computeGoalProjection(goal(), 1000, NOW);
    expect(p.requiredMonthly).toBeNull();
    expect(p.onTrack).toBeNull();
    expect(p.dueWithinMonth).toBe(false);
  });

  it("is on track when the measured pace will reach the target", () => {
    // Saved 3000 in 6 months (pace 500/mo); 2000 left over ~12 months → easily on track.
    const p = computeGoalProjection(
      goal({ targetDate: "2027-07-01", createdDate: "2026-01-01", startingAmount: 0 }),
      3000,
      NOW
    );
    expect(p.onTrack).toBe(true);
    expect(p.dueWithinMonth).toBe(false);
    expect(p.requiredMonthly).toBeGreaterThan(0);
  });

  it("is off track and reports a monthly rate below the remaining amount", () => {
    // No progress (pace 0) with ~12 months left → off track; rate ≈ 5000/12.
    const p = computeGoalProjection(
      goal({ targetDate: "2027-07-01", createdDate: "2026-06-01", startingAmount: 0 }),
      0,
      NOW
    );
    expect(p.onTrack).toBe(false);
    expect(p.dueWithinMonth).toBe(false);
    // ~12 months out → roughly 5000/12 ≈ 417/mo, and well under the remaining total.
    expect(p.requiredMonthly!).toBeGreaterThan(400);
    expect(p.requiredMonthly!).toBeLessThan(450);
    expect(p.requiredMonthly!).toBeLessThan(p.remaining);
  });

  it("flags a sub-month deadline so the UI shows a flat amount, not an inflated rate", () => {
    // Target 29 days out → months < 1 → dueWithinMonth, and the /mo rate exceeds the goal.
    const p = computeGoalProjection(
      goal({ targetDate: "2026-07-30", createdDate: "2026-07-01" }),
      0,
      NOW
    );
    expect(p.dueWithinMonth).toBe(true);
    expect(p.requiredMonthly!).toBeGreaterThan(5000); // rate exceeds the goal itself
  });

  it("marks a passed deadline as off track with no rate", () => {
    const p = computeGoalProjection(
      goal({ targetDate: "2026-06-01", createdDate: "2026-01-01" }),
      2000,
      NOW
    );
    expect(p.onTrack).toBe(false);
    expect(p.requiredMonthly).toBeNull();
    expect(p.dueWithinMonth).toBe(false);
  });
});
