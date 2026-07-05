import YahooFinance from 'yahoo-finance2';
import { FxRate } from '@/types';
import { closeOnOrBefore } from '@/utils';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// Quote types the app can actually track + price. Excludes indices (e.g. ^GSPE),
// currencies, futures, etc., which have no tradeable holding and break price fetch.
const INVESTABLE_QUOTE_TYPES = ['EQUITY', 'ETF', 'MUTUALFUND', 'CRYPTOCURRENCY'];

/**
 * Fetch current quote for a given symbol

 */
export async function getQuote(symbol: string) {
  try {
    console.log(`[Yahoo API] Fetching quote for: ${symbol}`);
    const result = await yahooFinance.quote(symbol, {}, { validateResult: false }) as any;
    return {
      symbol: result.symbol,
      price: result.regularMarketPrice,
      previousClose: result.regularMarketPreviousClose,
      name: result.shortName || result.longName,
      currency: result.currency,
      exchange: result.fullExchangeName,
      updatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error(`[Finance] Error fetching quote for ${symbol}:`, error);
    throw error;
  }
}

/**
 * Fetch quotes for multiple symbols
 */
export async function getQuotes(symbols: string[]) {
  if (symbols.length === 0) return [];
  
  try {
    console.log(`[Yahoo API] Fetching batch quotes for ${symbols.length} symbols: ${symbols.join(', ')}`);
    const results = await yahooFinance.quote(symbols, {}, { validateResult: false }) as any;
    // If only one symbol is passed, yahooFinance.quote returns a single object
    const quotes = Array.isArray(results) ? results : [results];
    
    return quotes.map((result: any) => ({
      symbol: result.symbol,
      price: result.regularMarketPrice,
      previousClose: result.regularMarketPreviousClose,
      name: result.shortName || result.longName,
      currency: result.currency,
      exchange: result.fullExchangeName,
      updatedAt: new Date().toISOString()
    }));
  } catch (error) {
    console.error(`[Finance] Error fetching batch quotes:`, error);
    throw error;
  }
}

/**
 * Yahoo FX quote symbol for a currency pair ('USD','CAD' -> 'USDCAD=X').
 * Returns null for identity or incomplete pairs (no fetch needed/possible).
 */
export function fxPairSymbol(from: string, to: string): string | null {
  if (!from || !to) return null;
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  if (f === t) return null;
  return `${f}${t}=X`;
}

/**
 * Fetch FX rates for currency pairs in one batch quote call.
 * Never throws — a failure returns [] so callers keep their cached rates.
 */
export async function getFxRates(pairs: { from: string; to: string }[]): Promise<FxRate[]> {
  const symbolToPair = new Map<string, { from: string; to: string }>();
  for (const p of pairs) {
    const sym = fxPairSymbol(p.from, p.to);
    if (sym) symbolToPair.set(sym, { from: p.from.toUpperCase(), to: p.to.toUpperCase() });
  }
  if (symbolToPair.size === 0) return [];

  try {
    const quotes = await getQuotes([...symbolToPair.keys()]);
    return quotes
      .filter(q => q.symbol && symbolToPair.has(q.symbol) && q.price != null)
      .map(q => ({
        ...symbolToPair.get(q.symbol)!,
        rate: q.price as number,
        updatedAt: q.updatedAt,
      }));
  } catch (error) {
    console.error('[Finance] Error fetching FX rates:', error);
    return [];
  }
}

/**
 * FX rates for a currency pair as of specific dates, via ONE chart() call
 * spanning the full date range (frugality rule: callers persist the result per
 * trade row — this is only hit at trade creation or a user-currency change).
 * Identity pairs map to 1 with no network call; unknown dates map to null.
 */
export async function getHistoricalFxRates(from: string, to: string, dates: string[]): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>();
  if (dates.length === 0 || !from || !to) return result;

  if (!fxPairSymbol(from, to)) {
    for (const d of dates) result.set(d, 1);
    return result;
  }

  const sorted = [...dates].sort();
  // Pad a week back so the earliest date can still resolve to a prior close,
  // and a day forward since Yahoo's period2 can exclude the end day's candle
  const start = new Date(sorted[0]);
  start.setDate(start.getDate() - 7);
  const end = new Date(sorted[sorted.length - 1]);
  end.setDate(end.getDate() + 1);
  const rows = await getHistoricalPrices(fxPairSymbol(from, to)!, start, end);
  for (const d of dates) {
    // A 0-value candle (Yahoo bad-data day) must not become a persisted rate —
    // it would zero the trade out of every balance
    const close = closeOnOrBefore(rows, d);
    result.set(d, close != null && close > 0 ? close : null);
  }
  return result;
}

/**
 * FX rate for from->to as of a single date (trade-date rate for cost basis).
 * Returns null when unresolvable so callers can fall back to a live rate.
 */
export async function getHistoricalFxRate(from: string, to: string, date: string): Promise<number | null> {
  const rates = await getHistoricalFxRates(from, to, [date]);
  return rates.get(date) ?? null;
}

/**
 * Fetch asset profile (sectors/weightings) for a given symbol
 */
export async function getAssetProfile(symbol: string) {
  try {
    console.log(`[Yahoo API] Fetching asset profile for: ${symbol}`);
    const summary = await yahooFinance.quoteSummary(symbol, { modules: ['topHoldings', 'summaryProfile'] }, { validateResult: false }) as any;
    let sectorData: any = null;

    if (summary.topHoldings && summary.topHoldings.sectorWeightings) {
      // ETF
      sectorData = summary.topHoldings.sectorWeightings;
    } else if (summary.summaryProfile && summary.summaryProfile.sector) {
      // Stock
      sectorData = { [summary.summaryProfile.sector.toLowerCase()]: 1 };
    }

    return sectorData ? JSON.stringify(sectorData) : null;
  } catch (error) {
    console.error(`[Finance] Error fetching asset profile for ${symbol}:`, error);
    return null;
  }
}

/**
 * Fetch historical daily closing prices
 */
export async function getHistoricalPrices(symbol: string, period1: string | Date, period2: string | Date = new Date()) {
  try {
    const d1 = new Date(period1);
    const d2 = new Date(period2);

    // Yahoo Finance requires period2 to be strictly greater than period1
    if (d1.toISOString().split('T')[0] === d2.toISOString().split('T')[0]) {
      d2.setDate(d2.getDate() + 1);
    }

    console.log(`[Yahoo API] Fetching historical prices for ${symbol} from ${d1.toISOString().split('T')[0]} to ${d2.toISOString().split('T')[0]}`);
    // chart() replaces the deprecated historical(): it returns raw daily rows (incl. an
    // in-progress current-day bar with a null close) instead of throwing on partial-null
    // rows the way historical() does. We drop null-close rows ourselves; validateResult
    // is off for the usual Yahoo schema drift.
    const result = await yahooFinance.chart(symbol, {
      period1: d1,
      period2: d2,
      interval: '1d'
    }, { validateResult: false }) as any;
    return (result?.quotes ?? [])
      .filter((q: any) => q?.date && q.close != null)
      .map((q: any) => ({
        date: new Date(q.date).toISOString().split('T')[0],
        close: q.close as number,
      }));
  } catch (error) {
    console.error(`[Finance] Error fetching historical prices for ${symbol}:`, error);
    return [];
  }
}

/**
 * Search for symbols
 */
export async function searchSymbols(query: string) {
  try {
    console.log(`[Yahoo API] Searching symbols for query: "${query}"`);
    // validateResult:false — Yahoo's search payload often drifts from the library's
    // schema, which would otherwise throw and break search entirely.
    const result = await yahooFinance.search(query, {}, { validateResult: false }) as any;
    return (result.quotes ?? [])
      .filter((q: any) => q.symbol && INVESTABLE_QUOTE_TYPES.includes(q.quoteType))
      .map((q: any) => ({
        symbol: q.symbol,
        name: q.shortname || q.longname || q.exchange,
        type: q.quoteType,
        exchange: q.exchange
      }));
  } catch (error) {
    console.error(`[Finance] Error searching symbols for "${query}":`, error);
    throw error;
  }
}
