import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

/**
 * Fetch current quote for a given symbol

 */
export async function getQuote(symbol: string) {
  try {
    const result = await yahooFinance.quote(symbol) as any;
    return {
      symbol: result.symbol,
      price: result.regularMarketPrice,
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
    const results = await yahooFinance.quote(symbols) as any;
    // If only one symbol is passed, yahooFinance.quote returns a single object
    const quotes = Array.isArray(results) ? results : [results];
    
    return quotes.map((result: any) => ({
      symbol: result.symbol,
      price: result.regularMarketPrice,
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
 * Search for symbols
 */
export async function searchSymbols(query: string) {
  try {
    const result = await yahooFinance.search(query) as any;
    return result.quotes.map((q: any) => ({
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
