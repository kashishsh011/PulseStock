// src/dataLoader.js
import { supabase } from './supabase.js'

/** Replaces hardcoded sectorStocks in main.js — returns {} on failure */
export async function loadSectorStocks() {
  try {
    const { data: stocks, error } = await supabase
      .from('stocks')
      .select(`
        ticker, name, sector, mock_price, fundamental, technical, news,
        fusion_scores ( score, label, breakdown )
      `)

    if (error || !stocks?.length) return {}

    // Reshape to match existing sectorStocks format exactly
    const result = {}
    stocks.forEach(s => {
      const sector = s.sector
      if (!result[sector]) result[sector] = []
      const fs = Array.isArray(s.fusion_scores) ? s.fusion_scores[0] : s.fusion_scores
      result[sector].push({
        name: s.name,
        ticker: s.ticker,
        score: fs?.score ?? 0,
        label: fs?.label ?? 'NEUTRAL',
        breakdown: fs?.breakdown ?? { F: 0, T: 0, N: 0, G: 0 },
        fundamental: s.fundamental,
        technical: s.technical,
        news: s.news ?? []
      })
    })
    return result
  } catch {
    return {}
  }
}

/** Replaces hardcoded geoEvents in main.js — returns [] on failure */
export async function loadGeoEvents() {
  try {
    const { data, error } = await supabase
      .from('geo_events')
      .select('*')
      .eq('active', true)
    if (error) return []
    return data ?? []
  } catch {
    return []
  }
}

/** Replaces POSITIONS in portfolioView.js — returns [] on failure */
export async function loadPositions(userId) {
  try {
    const { data, error } = await supabase
      .from('portfolio_positions')
      .select(`*, stocks(name, sector)`)
      .eq('user_id', userId)
    if (error) return []
    return data ?? []
  } catch {
    return []
  }
}

/** Replaces BANKING_WATCHLIST in tradeView.js — returns [] on failure */
export async function loadWatchlist(userId) {
  try {
    // If no user yet, load Banking stocks directly from stocks table
    if (!userId) {
      const { data, error } = await supabase
        .from('stocks')
        .select(`
          ticker, name, mock_price,
          fusion_scores ( score, label, breakdown )
        `)
        .eq('sector', 'Banking');
      if (error) throw error;
      return data ?? [];
    }

    // Authenticated user — load their personal watchlist
    const { data, error } = await supabase
      .from('watchlist')
      .select(`ticker, stocks(name, mock_price), fusion_scores(score, label, breakdown)`)
      .eq('user_id', userId);
    if (error) throw error;
    return data ?? [];
  } catch (err) {
    console.warn('loadWatchlist error:', err.message);
    return [];
  }
}