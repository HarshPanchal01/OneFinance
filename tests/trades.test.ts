import { describe, it, expect } from "vitest";
import { tradeCashImpact } from "../src/utils";

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
