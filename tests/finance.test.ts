import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getQuote,
  getQuotes,
  getAssetProfile,
  getHistoricalPrices,
  getDividendEvents,
  searchSymbols,
  fxPairSymbol,
  getFxRates,
  getHistoricalFxRate,
  getHistoricalFxRates,
  isPenceCurrency,
} from "../electron/finance";

// finance.ts builds `new YahooFinance(...)` at module load, so the mock must stand in
// for the default-exported class. vi.hoisted creates the method spies before the
// (auto-hoisted) vi.mock factory references them.
const { mockQuote, mockQuoteSummary, mockChart, mockSearch } = vi.hoisted(() => ({
  mockQuote: vi.fn(),
  mockQuoteSummary: vi.fn(),
  mockChart: vi.fn(),
  mockSearch: vi.fn(),
}));

vi.mock("yahoo-finance2", () => ({
  default: class {
    quote = mockQuote;
    quoteSummary = mockQuoteSummary;
    chart = mockChart;
    search = mockSearch;
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
  // finance.ts logs every call + every caught error; keep the test output clean.
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getQuote", () => {
  it("maps a Yahoo quote to the app shape", async () => {
    mockQuote.mockResolvedValue({
      symbol: "AAPL",
      regularMarketPrice: 250.5,
      regularMarketPreviousClose: 248,
      shortName: "Apple Inc.",
      longName: "Apple Incorporated",
      currency: "USD",
      fullExchangeName: "NasdaqGS",
    });

    const q = await getQuote("AAPL");
    expect(q).toMatchObject({
      symbol: "AAPL",
      price: 250.5,
      previousClose: 248,
      name: "Apple Inc.",
      currency: "USD",
      exchange: "NasdaqGS",
    });
    expect(typeof q.updatedAt).toBe("string");
  });

  it("falls back to longName when shortName is missing", async () => {
    mockQuote.mockResolvedValue({
      symbol: "VFV.TO",
      regularMarketPrice: 130,
      longName: "Vanguard S&P 500 Index ETF",
    });
    const q = await getQuote("VFV.TO");
    expect(q.name).toBe("Vanguard S&P 500 Index ETF");
  });

  it("requests with validateResult disabled (Yahoo schema drift)", async () => {
    mockQuote.mockResolvedValue({ symbol: "AAPL", regularMarketPrice: 1 });
    await getQuote("AAPL");
    expect(mockQuote).toHaveBeenCalledWith("AAPL", {}, { validateResult: false });
  });

  it("rethrows when the Yahoo call fails", async () => {
    mockQuote.mockRejectedValue(new Error("network down"));
    await expect(getQuote("AAPL")).rejects.toThrow("network down");
  });

  it("normalizes LSE pence (GBp) quotes to whole pounds (#175)", async () => {
    mockQuote.mockResolvedValue({
      symbol: "VOD.L",
      regularMarketPrice: 7250, // 72.50 pence... reported as 7250 pence
      regularMarketPreviousClose: 7000,
      shortName: "Vodafone",
      currency: "GBp",
    });
    const q = await getQuote("VOD.L");
    expect(q).toMatchObject({ price: 72.5, previousClose: 70, currency: "GBP" });
  });
});

describe("getQuotes", () => {
  it("returns [] and skips the API for an empty symbol list", async () => {
    expect(await getQuotes([])).toEqual([]);
    expect(mockQuote).not.toHaveBeenCalled();
  });

  it("maps a batch of quotes", async () => {
    mockQuote.mockResolvedValue([
      { symbol: "AAPL", regularMarketPrice: 250, regularMarketPreviousClose: 248, shortName: "Apple", currency: "USD" },
      { symbol: "VFV.TO", regularMarketPrice: 130, regularMarketPreviousClose: 128, shortName: "Vanguard S&P 500", currency: "CAD" },
    ]);
    const quotes = await getQuotes(["AAPL", "VFV.TO"]);
    expect(quotes).toHaveLength(2);
    expect(quotes[0]).toMatchObject({ symbol: "AAPL", price: 250, previousClose: 248, name: "Apple", currency: "USD" });
    expect(quotes[1]).toMatchObject({ symbol: "VFV.TO", price: 130, previousClose: 128, currency: "CAD" });
  });

  it("wraps a single-object response into an array", async () => {
    // Yahoo returns a bare object (not an array) when only one symbol is requested.
    mockQuote.mockResolvedValue({ symbol: "AAPL", regularMarketPrice: 250 });
    const quotes = await getQuotes(["AAPL"]);
    expect(quotes).toHaveLength(1);
    expect(quotes[0].symbol).toBe("AAPL");
  });

  it("rethrows when the batch call fails", async () => {
    mockQuote.mockRejectedValue(new Error("boom"));
    await expect(getQuotes(["AAPL"])).rejects.toThrow("boom");
  });

  it("normalizes pence (GBp/GBX) rows while leaving other currencies untouched (#175)", async () => {
    mockQuote.mockResolvedValue([
      { symbol: "VOD.L", regularMarketPrice: 7250, regularMarketPreviousClose: 7000, currency: "GBp" },
      { symbol: "AAPL", regularMarketPrice: 250, regularMarketPreviousClose: 248, currency: "USD" },
    ]);
    const quotes = await getQuotes(["VOD.L", "AAPL"]);
    expect(quotes[0]).toMatchObject({ price: 72.5, previousClose: 70, currency: "GBP" });
    expect(quotes[1]).toMatchObject({ price: 250, previousClose: 248, currency: "USD" });
  });
});

describe("fxPairSymbol", () => {
  it("builds the Yahoo FX symbol for a pair", () => {
    expect(fxPairSymbol("USD", "CAD")).toBe("USDCAD=X");
    expect(fxPairSymbol("EUR", "USD")).toBe("EURUSD=X");
  });

  it("uppercases lowercase codes", () => {
    expect(fxPairSymbol("usd", "cad")).toBe("USDCAD=X");
  });

  it("returns null for identity pairs (no conversion needed)", () => {
    expect(fxPairSymbol("USD", "USD")).toBeNull();
    expect(fxPairSymbol("usd", "USD")).toBeNull();
  });

  it("returns null for incomplete pairs", () => {
    expect(fxPairSymbol("", "CAD")).toBeNull();
    expect(fxPairSymbol("USD", "")).toBeNull();
  });
});

describe("getFxRates", () => {
  it("returns [] and skips the API when all pairs are identity/empty", async () => {
    expect(await getFxRates([])).toEqual([]);
    expect(await getFxRates([{ from: "USD", to: "USD" }, { from: "", to: "CAD" }])).toEqual([]);
    expect(mockQuote).not.toHaveBeenCalled();
  });

  it("dedupes pairs into one batch call and maps prices to rates", async () => {
    mockQuote.mockResolvedValue([
      { symbol: "USDCAD=X", regularMarketPrice: 1.37 },
      { symbol: "EURCAD=X", regularMarketPrice: 1.48 },
    ]);
    const rates = await getFxRates([
      { from: "USD", to: "CAD" },
      { from: "EUR", to: "CAD" },
      { from: "USD", to: "CAD" }, // duplicate
    ]);
    expect(mockQuote).toHaveBeenCalledTimes(1);
    expect(mockQuote.mock.calls[0][0]).toEqual(["USDCAD=X", "EURCAD=X"]);
    expect(rates).toHaveLength(2);
    expect(rates[0]).toMatchObject({ from: "USD", to: "CAD", rate: 1.37 });
    expect(rates[1]).toMatchObject({ from: "EUR", to: "CAD", rate: 1.48 });
    expect(typeof rates[0].updatedAt).toBe("string");
  });

  it("handles a single-object Yahoo response (one pair requested)", async () => {
    mockQuote.mockResolvedValue({ symbol: "USDCAD=X", regularMarketPrice: 1.37 });
    const rates = await getFxRates([{ from: "USD", to: "CAD" }]);
    expect(rates).toEqual([
      expect.objectContaining({ from: "USD", to: "CAD", rate: 1.37 }),
    ]);
  });

  it("drops FX quotes without a price", async () => {
    mockQuote.mockResolvedValue([
      { symbol: "USDCAD=X", regularMarketPrice: null },
      { symbol: "EURCAD=X", regularMarketPrice: 1.48 },
    ]);
    const rates = await getFxRates([
      { from: "USD", to: "CAD" },
      { from: "EUR", to: "CAD" },
    ]);
    expect(rates).toEqual([
      expect.objectContaining({ from: "EUR", to: "CAD", rate: 1.48 }),
    ]);
  });

  it("returns [] (does not throw) when the Yahoo call fails — callers keep cached rates", async () => {
    mockQuote.mockRejectedValue(new Error("fx down"));
    expect(await getFxRates([{ from: "USD", to: "CAD" }])).toEqual([]);
  });
});

describe("getAssetProfile", () => {
  it("returns ETF sector weightings as JSON", async () => {
    const weightings = { technology: 0.3, healthcare: 0.2 };
    mockQuoteSummary.mockResolvedValue({ topHoldings: { sectorWeightings: weightings } });
    const profile = await getAssetProfile("VFV.TO");
    expect(JSON.parse(profile as string)).toEqual(weightings);
  });

  it("returns a single-sector map for an individual stock", async () => {
    mockQuoteSummary.mockResolvedValue({ summaryProfile: { sector: "Technology" } });
    const profile = await getAssetProfile("AAPL");
    expect(JSON.parse(profile as string)).toEqual({ technology: 1 });
  });

  it("returns null when no sector data is available", async () => {
    mockQuoteSummary.mockResolvedValue({});
    expect(await getAssetProfile("AAPL")).toBeNull();
  });

  it("returns null (does not throw) on API error", async () => {
    mockQuoteSummary.mockRejectedValue(new Error("nope"));
    expect(await getAssetProfile("AAPL")).toBeNull();
  });
});

describe("getHistoricalPrices", () => {
  it("maps chart quotes to { date, close } rows", async () => {
    mockChart.mockResolvedValue({
      quotes: [
        { date: new Date("2026-06-10T13:30:00.000Z"), close: 200 },
        { date: new Date("2026-06-11T13:30:00.000Z"), close: 205 },
      ],
    });
    const prices = await getHistoricalPrices("AAPL", "2026-06-10", "2026-06-12");
    expect(prices).toEqual([
      { date: "2026-06-10", close: 200 },
      { date: "2026-06-11", close: 205 },
    ]);
  });

  it("drops the in-progress bar whose close is null (the partial-null bug this fixed)", async () => {
    mockChart.mockResolvedValue({
      quotes: [
        { date: new Date("2026-06-14T13:30:00.000Z"), close: 210 },
        // current-day candle: O/H/L/volume present but close not finalized yet
        { date: new Date("2026-06-15T13:30:00.000Z"), close: null, open: 295, high: 299, low: 293, volume: 15519515 },
      ],
    });
    const prices = await getHistoricalPrices("AAPL", "2026-06-14", "2026-06-16");
    expect(prices).toEqual([{ date: "2026-06-14", close: 210 }]);
  });

  it("skips rows without a date", async () => {
    mockChart.mockResolvedValue({
      quotes: [
        { date: null, close: 1 },
        { date: new Date("2026-06-10T13:30:00.000Z"), close: 200 },
      ],
    });
    const prices = await getHistoricalPrices("AAPL", "2026-06-10", "2026-06-12");
    expect(prices).toEqual([{ date: "2026-06-10", close: 200 }]);
  });

  it("returns [] when the chart result has no quotes", async () => {
    mockChart.mockResolvedValue({});
    expect(await getHistoricalPrices("AAPL", "2026-06-10", "2026-06-12")).toEqual([]);
  });

  it("returns [] (does not throw) on API error", async () => {
    mockChart.mockRejectedValue(new Error("chart failed"));
    expect(await getHistoricalPrices("AAPL", "2026-06-10", "2026-06-12")).toEqual([]);
  });

  it("requests a 1d interval with validateResult disabled", async () => {
    mockChart.mockResolvedValue({ quotes: [] });
    await getHistoricalPrices("AAPL", "2026-06-10", "2026-06-12");
    const [symbol, queryOptions, moduleOptions] = mockChart.mock.calls[0];
    expect(symbol).toBe("AAPL");
    expect(queryOptions.interval).toBe("1d");
    expect(moduleOptions).toEqual({ validateResult: false });
  });

  it("advances period2 when it equals period1 (Yahoo needs a non-empty range)", async () => {
    mockChart.mockResolvedValue({ quotes: [] });
    await getHistoricalPrices("AAPL", "2026-06-10", "2026-06-10");
    const { period1, period2 } = mockChart.mock.calls[0][1];
    expect(period2.getTime()).toBeGreaterThan(period1.getTime());
  });

  it("divides pence closes by 100 when the series currency is GBp (#175)", async () => {
    mockChart.mockResolvedValue({
      meta: { currency: "GBp" },
      quotes: [
        { date: new Date("2026-06-10T13:30:00.000Z"), close: 7250 },
        { date: new Date("2026-06-11T13:30:00.000Z"), close: 7300 },
      ],
    });
    const prices = await getHistoricalPrices("VOD.L", "2026-06-10", "2026-06-12");
    expect(prices).toEqual([
      { date: "2026-06-10", close: 72.5 },
      { date: "2026-06-11", close: 73 },
    ]);
  });

  it("leaves FX-pair closes unchanged (meta.currency is a whole currency, not pence)", async () => {
    mockChart.mockResolvedValue({
      meta: { currency: "USD" },
      quotes: [{ date: new Date("2026-06-10T13:30:00.000Z"), close: 1.36 }],
    });
    const prices = await getHistoricalPrices("GBPUSD=X", "2026-06-10", "2026-06-12");
    expect(prices).toEqual([{ date: "2026-06-10", close: 1.36 }]);
  });
});

describe("getDividendEvents", () => {
  it("maps chart dividend events to sorted { date, perShare } rows", async () => {
    mockChart.mockResolvedValue({
      events: {
        dividends: [
          { date: new Date("2026-06-12T13:30:00.000Z"), amount: 0.26 },
          { date: new Date("2026-03-12T13:30:00.000Z"), amount: 0.25 },
        ],
      },
      quotes: [],
    });
    const events = await getDividendEvents("AAPL", "2026-01-01", "2026-07-01");
    expect(events).toEqual([
      { date: "2026-03-12", perShare: 0.25 },
      { date: "2026-06-12", perShare: 0.26 },
    ]);
  });

  it("handles the raw payload shape: timestamp-keyed object with epoch-second dates", async () => {
    // With validateResult:false Yahoo's raw chart payload can come through
    // unnormalized — dividends keyed by timestamp, dates as epoch seconds.
    mockChart.mockResolvedValue({
      events: {
        dividends: {
          "1749735000": { amount: 0.26, date: 1749735000 }, // 2025-06-12
        },
      },
    });
    const events = await getDividendEvents("AAPL", "2025-01-01", "2025-07-01");
    expect(events).toEqual([{ date: "2025-06-12", perShare: 0.26 }]);
  });

  it("drops events without a date or a positive amount", async () => {
    mockChart.mockResolvedValue({
      events: {
        dividends: [
          { date: null, amount: 0.25 },
          { date: new Date("2026-06-12T13:30:00.000Z"), amount: 0 },
          { date: new Date("2026-06-12T13:30:00.000Z"), amount: null },
          { date: new Date("2026-03-12T13:30:00.000Z"), amount: 0.25 },
        ],
      },
    });
    const events = await getDividendEvents("AAPL", "2026-01-01", "2026-07-01");
    expect(events).toEqual([{ date: "2026-03-12", perShare: 0.25 }]);
  });

  it("returns [] when the chart result carries no dividend events", async () => {
    mockChart.mockResolvedValue({ quotes: [] });
    expect(await getDividendEvents("BTC-USD", "2026-01-01", "2026-07-01")).toEqual([]);
  });

  it("requests dividend events with validateResult disabled", async () => {
    mockChart.mockResolvedValue({});
    await getDividendEvents("AAPL", "2026-06-10", "2026-06-12");
    const [symbol, queryOptions, moduleOptions] = mockChart.mock.calls[0];
    expect(symbol).toBe("AAPL");
    expect(queryOptions.events).toBe("div");
    expect(moduleOptions).toEqual({ validateResult: false });
  });

  it("advances period2 when it equals period1 (Yahoo needs a non-empty range)", async () => {
    mockChart.mockResolvedValue({});
    await getDividendEvents("AAPL", "2026-06-10", "2026-06-10");
    const { period1, period2 } = mockChart.mock.calls[0][1];
    expect(period2.getTime()).toBeGreaterThan(period1.getTime());
  });

  it("rethrows on API error so the sync can tell failure from no-dividends", async () => {
    mockChart.mockRejectedValue(new Error("chart failed"));
    await expect(getDividendEvents("AAPL", "2026-01-01", "2026-07-01")).rejects.toThrow("chart failed");
  });

  it("normalizes pence (GBp) dividend amounts to whole pounds (#175)", async () => {
    mockChart.mockResolvedValue({
      meta: { currency: "GBp" },
      events: {
        dividends: [{ date: new Date("2026-06-12T13:30:00.000Z"), amount: 25 }],
      },
    });
    const events = await getDividendEvents("VOD.L", "2026-01-01", "2026-07-01");
    expect(events).toEqual([{ date: "2026-06-12", perShare: 0.25 }]);
  });
});

describe("isPenceCurrency", () => {
  it("matches Yahoo's pence codes and nothing else", () => {
    expect(isPenceCurrency("GBp")).toBe(true);
    expect(isPenceCurrency("GBX")).toBe(true);
    expect(isPenceCurrency("gbx")).toBe(true);
    expect(isPenceCurrency("GBP")).toBe(false); // whole pounds
    expect(isPenceCurrency("USD")).toBe(false);
    expect(isPenceCurrency(null)).toBe(false);
    expect(isPenceCurrency(undefined)).toBe(false);
  });
});

describe("getHistoricalFxRates", () => {
  const fxQuotes = (rows: [string, number][]) => ({
    quotes: rows.map(([date, close]) => ({ date: new Date(`${date}T13:30:00.000Z`), close })),
  });

  it("resolves each date to its close via one chart() call for the whole span", async () => {
    mockChart.mockResolvedValue(fxQuotes([
      ["2026-06-10", 1.36],
      ["2026-06-11", 1.37],
      ["2026-06-12", 1.38],
    ]));
    const rates = await getHistoricalFxRates("USD", "CAD", ["2026-06-10", "2026-06-12"]);
    expect(rates.get("2026-06-10")).toBe(1.36);
    expect(rates.get("2026-06-12")).toBe(1.38);
    expect(mockChart).toHaveBeenCalledTimes(1);
    expect(mockChart.mock.calls[0][0]).toBe("USDCAD=X");
  });

  it("falls back to the prior trading day's close for weekend/holiday dates", async () => {
    // 2026-06-13 is a Saturday — no candle for it
    mockChart.mockResolvedValue(fxQuotes([["2026-06-12", 1.37]]));
    const rates = await getHistoricalFxRates("USD", "CAD", ["2026-06-13"]);
    expect(rates.get("2026-06-13")).toBe(1.37);
  });

  it("maps identity pairs to 1 without a network call", async () => {
    const rates = await getHistoricalFxRates("CAD", "CAD", ["2026-06-10"]);
    expect(rates.get("2026-06-10")).toBe(1);
    expect(mockChart).not.toHaveBeenCalled();
  });

  it("maps a date with no close on or before it to null", async () => {
    mockChart.mockResolvedValue(fxQuotes([["2026-06-12", 1.37]]));
    const rates = await getHistoricalFxRates("USD", "CAD", ["2026-06-01"]);
    expect(rates.get("2026-06-01")).toBeNull();
  });

  it("rejects a 0-value candle (a persisted rate of 0 would zero the trade everywhere)", async () => {
    mockChart.mockResolvedValue(fxQuotes([["2026-06-12", 0]]));
    const rates = await getHistoricalFxRates("USD", "CAD", ["2026-06-12"]);
    expect(rates.get("2026-06-12")).toBeNull();
  });

  it("maps all dates to null (does not throw) on API error", async () => {
    mockChart.mockRejectedValue(new Error("chart failed"));
    const rates = await getHistoricalFxRates("USD", "CAD", ["2026-06-10"]);
    expect(rates.get("2026-06-10")).toBeNull();
  });

  it("returns an empty map for no dates or an incomplete pair", async () => {
    expect((await getHistoricalFxRates("USD", "CAD", [])).size).toBe(0);
    expect((await getHistoricalFxRates("", "CAD", ["2026-06-10"])).size).toBe(0);
    expect(mockChart).not.toHaveBeenCalled();
  });

  it("pads the fetched span so boundary dates resolve (a week back, a day forward)", async () => {
    mockChart.mockResolvedValue(fxQuotes([]));
    await getHistoricalFxRates("USD", "CAD", ["2026-06-10", "2026-06-12"]);
    const { period1, period2 } = mockChart.mock.calls[0][1];
    expect(period1.getTime()).toBeLessThan(new Date("2026-06-10").getTime());
    expect(period2.getTime()).toBeGreaterThan(new Date("2026-06-12").getTime());
  });
});

describe("getHistoricalFxRate", () => {
  it("returns the close on the trade date", async () => {
    mockChart.mockResolvedValue({
      quotes: [{ date: new Date("2026-06-10T13:30:00.000Z"), close: 1.36 }],
    });
    expect(await getHistoricalFxRate("USD", "CAD", "2026-06-10")).toBe(1.36);
  });

  it("returns 1 for an identity pair and null when unresolvable", async () => {
    expect(await getHistoricalFxRate("CAD", "CAD", "2026-06-10")).toBe(1);
    mockChart.mockResolvedValue({ quotes: [] });
    expect(await getHistoricalFxRate("USD", "CAD", "2026-06-10")).toBeNull();
  });
});

describe("searchSymbols", () => {
  it("keeps only investable quote types and drops indices/currencies/futures", async () => {
    mockSearch.mockResolvedValue({
      quotes: [
        { symbol: "AAPL", quoteType: "EQUITY", shortname: "Apple Inc." },
        { symbol: "VFV.TO", quoteType: "ETF", shortname: "Vanguard S&P 500" },
        { symbol: "VTSAX", quoteType: "MUTUALFUND", shortname: "Vanguard Total" },
        { symbol: "BTC-USD", quoteType: "CRYPTOCURRENCY", shortname: "Bitcoin USD" },
        { symbol: "^GSPC", quoteType: "INDEX", shortname: "S&P 500" },
        { symbol: "EURUSD=X", quoteType: "CURRENCY", shortname: "EUR/USD" },
        { symbol: "ES=F", quoteType: "FUTURE", shortname: "E-Mini S&P" },
      ],
    });
    const results = await searchSymbols("s&p");
    expect(results.map((r: { symbol: string }) => r.symbol)).toEqual([
      "AAPL",
      "VFV.TO",
      "VTSAX",
      "BTC-USD",
    ]);
  });

  it("drops results without a symbol", async () => {
    mockSearch.mockResolvedValue({
      quotes: [
        { quoteType: "EQUITY", shortname: "No symbol here" },
        { symbol: "AAPL", quoteType: "EQUITY", shortname: "Apple" },
      ],
    });
    const results = await searchSymbols("apple");
    expect(results).toHaveLength(1);
    expect(results[0].symbol).toBe("AAPL");
  });

  it("falls back through shortname -> longname -> exchange for the name", async () => {
    mockSearch.mockResolvedValue({
      quotes: [
        { symbol: "AAPL", quoteType: "EQUITY", longname: "Apple Incorporated" },
        { symbol: "XEQT.TO", quoteType: "ETF", exchange: "TOR" },
      ],
    });
    const results = await searchSymbols("x");
    expect(results[0].name).toBe("Apple Incorporated");
    expect(results[1].name).toBe("TOR");
  });

  it("returns [] when Yahoo returns no quotes", async () => {
    mockSearch.mockResolvedValue({});
    expect(await searchSymbols("zzzz")).toEqual([]);
  });

  it("rethrows when the search call fails", async () => {
    mockSearch.mockRejectedValue(new Error("search down"));
    await expect(searchSymbols("aapl")).rejects.toThrow("search down");
  });
});
