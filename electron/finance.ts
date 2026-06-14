import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

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
    const results = await yahooFinance.historical(symbol, {
      period1: d1,
      period2: d2,
      interval: '1d'
    });
    return results.map(r => ({
      date: r.date.toISOString().split('T')[0],
      close: r.close
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
