import { describe, it, expect } from "vitest";
import { dividendCashImpact, sharesHeldOn, tradeCashImpact } from "../src/utils";

// price/fees are native to the trade's currency; fxRate converts the whole
// trade to user currency (null = legacy user-currency row, rate 1).
describe("tradeCashImpact", () => {
  it("drains cash on a buy: -(qty * price + fees) * rate", () => {
    expect(tradeCashImpact({ type: "buy", quantity: 10, price: 100, fees: 5, fxRate: 1.35 }))
      .toBeCloseTo(-(10 * 100 + 5) * 1.35);
  });

  it("adds cash on a sell: (qty * price - fees) * rate", () => {
    expect(tradeCashImpact({ type: "sell", quantity: 10, price: 100, fees: 5, fxRate: 1.35 }))
      .toBeCloseTo((10 * 100 - 5) * 1.35);
  });

  it("treats a null/absent fxRate as 1 (legacy user-currency rows)", () => {
    expect(tradeCashImpact({ type: "buy", quantity: 2, price: 50, fees: 0, fxRate: null })).toBe(-100);
    expect(tradeCashImpact({ type: "sell", quantity: 2, price: 50, fees: 0 })).toBe(100);
  });

  it("nets to the fee drag when a buy and sell at the same price/rate cancel", () => {
    const buy = tradeCashImpact({ type: "buy", quantity: 5, price: 20, fees: 2, fxRate: 1.5 });
    const sell = tradeCashImpact({ type: "sell", quantity: 5, price: 20, fees: 2, fxRate: 1.5 });
    expect(buy + sell).toBeCloseTo(-2 * 2 * 1.5);
  });
});

describe("dividendCashImpact", () => {
  it("converts the native amount at the captured pay-date rate", () => {
    expect(dividendCashImpact({ amount: 12.5, fxRate: 1.36 })).toBeCloseTo(12.5 * 1.36);
  });

  it("treats a null/absent fxRate as 1 (user-currency rows)", () => {
    expect(dividendCashImpact({ amount: 12.5, fxRate: null })).toBe(12.5);
    expect(dividendCashImpact({ amount: 12.5 })).toBe(12.5);
  });
});

describe("sharesHeldOn", () => {
  const trades = [
    { type: "buy" as const, quantity: 10, date: "2026-01-10" },
    { type: "buy" as const, quantity: 5, date: "2026-03-01" },
    { type: "sell" as const, quantity: 8, date: "2026-05-20" },
  ];

  it("nets buys and sells up to and including the date", () => {
    expect(sharesHeldOn(trades, "2026-02-01")).toBe(10);
    expect(sharesHeldOn(trades, "2026-03-01")).toBe(15); // same-day trade counts
    expect(sharesHeldOn(trades, "2026-06-01")).toBe(7);
  });

  it("ignores trades after the date", () => {
    expect(sharesHeldOn(trades, "2026-01-09")).toBe(0);
  });

  it("returns 0 for an empty history", () => {
    expect(sharesHeldOn([], "2026-06-01")).toBe(0);
  });
});
