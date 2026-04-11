// fusionEngine.js
// The single source of truth for all Fusion Score calculations
// Every number in the UI that shows a score comes from here

// ─────────────────────────────────────────
// SECTION 1: SIGNAL WEIGHTS
// Change these weights here only — nowhere else
// ─────────────────────────────────────────
const WEIGHTS = {
  fundamental: 0.30,
  technical:   0.25,
  news:        0.25,
  global:      0.20,
};

// ─────────────────────────────────────────
// SECTION 2: REGIME SCORE MAP
// Maps your header regime tag → a G score
// ─────────────────────────────────────────
const REGIME_SCORE_MAP = {
  "FED POLICY DAY":   -0.30,
  "RISK OFF":         -0.60,
  "RISK ON":          +0.50,
  "NEUTRAL":           0.00,
  "ELEVATED":         -0.40,
  "GEOPOLITICAL":     -0.50,
  "EARNINGS SEASON":  +0.10,
};

// ─────────────────────────────────────────
// SECTION 3: FUNDAMENTAL SCORE CALCULATOR
// Input: fundamentalData object for a stock
// Output: number between -1.0 and +1.0
// ─────────────────────────────────────────
export function calcFundamentalScore(data) {
  const scores = [];

  // P/E vs sector: if stock PE is 10% below sector = good
  if (data.pe && data.sectorPE) {
    const peDiff = (data.sectorPE - data.pe) / data.sectorPE;
    scores.push(Math.max(-1, Math.min(1, peDiff * 2)));
  }

  // ROE: above 15% is good for banks
  if (data.roe !== undefined) {
    scores.push(data.roe >= 15 ? +0.4 : data.roe >= 10 ? +0.1 : -0.3);
  }

  // NPA ratio: lower is better (bank-specific)
  if (data.npa !== undefined) {
    scores.push(data.npa <= 1.5 ? +0.4 : data.npa <= 3 ? 0 : -0.4);
  }

  // Revenue growth QoQ
  if (data.revenueGrowth !== undefined) {
    scores.push(data.revenueGrowth > 10 ? +0.3 : data.revenueGrowth > 0 ? +0.1 : -0.3);
  }

  if (scores.length === 0) return 0;
  const raw = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.max(-1, Math.min(1, raw)); // clamp to [-1, 1]
}

// ─────────────────────────────────────────
// SECTION 4: TECHNICAL SCORE CALCULATOR
// Input: technicalData object for a stock
// Output: number between -1.0 and +1.0
// ─────────────────────────────────────────
export function calcTechnicalScore(data) {
  const scores = [];

  // RSI: 30-70 is neutral zone, extremes are signals
  if (data.rsi !== undefined) {
    if (data.rsi > 75) scores.push(-0.6);       // overbought
    else if (data.rsi > 60) scores.push(-0.2);   // slightly overbought
    else if (data.rsi < 25) scores.push(+0.6);   // oversold = opportunity
    else if (data.rsi < 40) scores.push(+0.2);
    else scores.push(0);                          // neutral 40-60
  }

  // Price vs 20d WMA
  if (data.priceVsWMA !== undefined) {
    // priceVsWMA = percentage above/below WMA
    scores.push(Math.max(-1, Math.min(1, data.priceVsWMA / 10)));
  }

  // MACD signal
  if (data.macd !== undefined) {
    scores.push(data.macd > 0 ? +0.4 : -0.4);
  }

  // Volume trend
  if (data.volumeTrend !== undefined) {
    // volumeTrend: +1 = increasing, -1 = decreasing
    scores.push(data.volumeTrend * 0.3);
  }

  if (scores.length === 0) return 0;
  const raw = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.max(-1, Math.min(1, raw));
}

// ─────────────────────────────────────────
// SECTION 5: NEWS SCORE CALCULATOR
// Input: array of news items with sentiment
// Output: number between -1.0 and +1.0
// ─────────────────────────────────────────
export function calcNewsScore(newsItems) {
  if (!newsItems || newsItems.length === 0) return 0;

  const now = Date.now();
  let weightedSum = 0;
  let totalWeight = 0;

  newsItems.forEach(item => {
    // Recency weight: last 24h = 1.0, older = 0.5
    const ageHours = (now - new Date(item.timestamp).getTime()) / 3600000;
    const recencyWeight = ageHours <= 24 ? 1.0 : 0.5;

    // Sentiment: "positive" = +1, "neutral" = 0, "negative" = -1
    const sentimentScore =
      item.sentiment === "positive" ? +1 :
      item.sentiment === "negative" ? -1 : 0;

    weightedSum += sentimentScore * recencyWeight;
    totalWeight += recencyWeight;
  });

  const raw = totalWeight > 0 ? weightedSum / totalWeight : 0;
  return Math.max(-1, Math.min(1, raw));
}

// ─────────────────────────────────────────
// SECTION 6: GLOBAL REGIME SCORE
// Input: regime string from your header
// Output: number between -1.0 and +1.0
// ─────────────────────────────────────────
export function calcGlobalScore(regimeLabel) {
  return REGIME_SCORE_MAP[regimeLabel] ?? 0;
}

// ─────────────────────────────────────────
// SECTION 7: REGIME LABEL FROM FUSION SCORE
// Input: final fusion score number
// Output: label string + color
// ─────────────────────────────────────────
export function getFusionLabel(score) {
  if (score > 0.50)  return { label: "BULLISH",         color: "#4ade80" };
  if (score > 0.20)  return { label: "LEANING BULLISH", color: "#86efac" };
  if (score > 0.05)  return { label: "CONFLICTED",      color: "#fbbf24" };
  if (score > -0.05) return { label: "NEUTRAL",         color: "#94a3b8" };
  if (score > -0.20) return { label: "CONFLICTED",      color: "#fbbf24" };
  if (score > -0.50) return { label: "LEANING BEARISH", color: "#f87171" };
  return               { label: "BEARISH",              color: "#ef4444" };
}

// ─────────────────────────────────────────
// SECTION 8: MAIN FUSION CALCULATOR
// This is the only function your UI components should call
// Input: all four signal data objects + regime label
// Output: { score, label, color, breakdown }
// ─────────────────────────────────────────
export function calcFusionScore({
  fundamentalData,
  technicalData,
  newsItems,
  regimeLabel,
}) {
  const F = calcFundamentalScore(fundamentalData);
  const T = calcTechnicalScore(technicalData);
  const N = calcNewsScore(newsItems);
  const G = calcGlobalScore(regimeLabel);

  const score =
    F * WEIGHTS.fundamental +
    T * WEIGHTS.technical +
    N * WEIGHTS.news +
    G * WEIGHTS.global;

  const rounded = Math.round(score * 100) / 100;
  const { label, color } = getFusionLabel(rounded);

  return {
    score: rounded,
    label,
    color,
    breakdown: { F, T, N, G }, // these are what your 4 signal bars show
  };
}