import { describe, it, expect } from "vitest";
import {
  simulateDebtPayoff,
  amortizationPayment,
  compoundInterestSeries,
  type SimDebt,
} from "../src/utils";

describe("simulateDebtPayoff", () => {
  it("pays off a single interest-free debt in the expected number of months", () => {
    const debts: SimDebt[] = [{ balance: 1000, rate: 0, minPayment: 100 }];
    const r = simulateDebtPayoff(debts, 0, "avalanche");
    expect(r.months).toBe(10);
    expect(r.totalInterest).toBe(0);
    expect(r.capped).toBe(false);
    expect(r.curve[0]).toBe(1000);
    expect(r.curve.at(-1)).toBe(0);
    expect(r.curve).toHaveLength(11); // start + 10 months
  });

  it("avalanche never costs more interest than snowball", () => {
    // A: small balance, low rate; B: large balance, high rate → the strategies diverge.
    const debts: SimDebt[] = [
      { balance: 1000, rate: 5, minPayment: 25 },
      { balance: 5000, rate: 20, minPayment: 100 },
    ];
    const avalanche = simulateDebtPayoff(debts, 200, "avalanche");
    const snowball = simulateDebtPayoff(debts, 200, "snowball");
    expect(avalanche.capped).toBe(false);
    expect(snowball.capped).toBe(false);
    // Avalanche (highest-rate-first) is interest-optimal.
    expect(avalanche.totalInterest).toBeLessThanOrEqual(snowball.totalInterest);
  });

  it("flags debts that can never be paid off (minimum below monthly interest)", () => {
    // 24%/yr = 2%/mo → $200 interest on $10k, but only $50 paid → balance grows.
    const debts: SimDebt[] = [{ balance: 10000, rate: 24, minPayment: 50 }];
    const r = simulateDebtPayoff(debts, 0, "avalanche");
    expect(r.capped).toBe(true);
    expect(r.months).toBe(1200);
  });

  it("keeps the balance curve monotonically non-increasing", () => {
    const debts: SimDebt[] = [
      { balance: 3000, rate: 12, minPayment: 80 },
      { balance: 1500, rate: 8, minPayment: 40 },
    ];
    const { curve } = simulateDebtPayoff(debts, 150, "snowball");
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]).toBeLessThanOrEqual(curve[i - 1] + 1e-9);
    }
  });
});

describe("amortizationPayment", () => {
  it("splits a zero-rate loan evenly", () => {
    expect(amortizationPayment(1200, 0, 12)).toBe(100);
  });

  it("matches the standard mortgage payment formula", () => {
    // $100k, 6% APR, 30 years → ~$599.55/mo.
    expect(amortizationPayment(100000, 0.06, 360)).toBeCloseTo(599.55, 1);
  });

  it("returns 0 for a non-positive term", () => {
    expect(amortizationPayment(100000, 0.05, 0)).toBe(0);
  });
});

describe("compoundInterestSeries", () => {
  it("returns a start point plus one entry per month", () => {
    const s = compoundInterestSeries(1000, 0, 0.05, 12);
    expect(s).toHaveLength(13);
    expect(s[0]).toEqual({ balance: 1000, totalContributions: 1000, totalInterest: 0 });
  });

  it("holds steady with no rate and no contributions", () => {
    const s = compoundInterestSeries(1000, 0, 0, 12);
    expect(s.at(-1)!.balance).toBe(1000);
    expect(s.at(-1)!.totalInterest).toBe(0);
  });

  it("sums contributions without interest when the rate is zero", () => {
    const s = compoundInterestSeries(0, 100, 0, 12);
    expect(s.at(-1)!.balance).toBeCloseTo(1200, 6);
    expect(s.at(-1)!.totalContributions).toBeCloseTo(1200, 6);
    expect(s.at(-1)!.totalInterest).toBe(0);
  });

  it("compounds a lump sum monthly (12% APR ≈ 1%/mo)", () => {
    const s = compoundInterestSeries(1000, 0, 0.12, 12);
    expect(s.at(-1)!.balance).toBeCloseTo(1126.83, 1); // 1000 * 1.01^12
    expect(s.at(-1)!.totalInterest).toBeCloseTo(126.83, 1);
  });
});
