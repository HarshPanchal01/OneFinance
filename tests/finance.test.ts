import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getQuote,
  getQuotes,
  getAssetProfile,
  getHistoricalPrices,
  searchSymbols,
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
});

describe("getQuotes", () => {
  it("returns [] and skips the API for an empty symbol list", async () => {
    expect(await getQuotes([])).toEqual([]);
    expect(mockQuote).not.toHaveBeenCalled();
  });

  it("maps a batch of quotes", async () => {
    mockQuote.mockResolvedValue([
      { symbol: "AAPL", regularMarketPrice: 250, regularMarketPreviousClose: 248, shortName: "Apple" },
      { symbol: "MSFT", regularMarketPrice: 400, regularMarketPreviousClose: 395, shortName: "Microsoft" },
    ]);
    const quotes = await getQuotes(["AAPL", "MSFT"]);
    expect(quotes).toHaveLength(2);
    expect(quotes[0]).toMatchObject({ symbol: "AAPL", price: 250, previousClose: 248, name: "Apple" });
    expect(quotes[1]).toMatchObject({ symbol: "MSFT", price: 400, previousClose: 395 });
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
