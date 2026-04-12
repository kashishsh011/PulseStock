const HALF_HOUR = 60 * 30;

const explicitCountryProfiles = [
  { id: 'RUS', name: 'Russia', region: 'Europe', score: 78, commodities: ['CRUDE', 'GAS', 'WHEAT'] },
  { id: 'IRN', name: 'Iran', region: 'Middle East', score: 82, commodities: ['CRUDE', 'GAS'] },
  { id: 'ISR', name: 'Israel', region: 'Middle East', score: 74, commodities: ['CRUDE', 'DEFENSE'] },
  { id: 'SAU', name: 'Saudi Arabia', region: 'Middle East', score: 45, commodities: ['CRUDE'] },
  { id: 'CHN', name: 'China', region: 'Asia Pacific', score: 61, commodities: ['COPPER', 'COAL', 'GOLD'] },
  { id: 'PAK', name: 'Pakistan', region: 'Asia Pacific', score: 69, commodities: ['WHEAT', 'GAS'] },
  { id: 'USA', name: 'United States', region: 'Americas', score: 42, commodities: ['GOLD', 'DXY'] },
  { id: 'UKR', name: 'Ukraine', region: 'Europe', score: 71, commodities: ['WHEAT', 'GAS'] },
  { id: 'ARE', name: 'United Arab Emirates', region: 'Middle East', score: 28, commodities: ['GOLD', 'CRUDE'] },
  { id: 'IDN', name: 'Indonesia', region: 'Asia Pacific', score: 33, commodities: ['COAL', 'PALM OIL'] },
  { id: 'IND', name: 'India', region: 'Asia Pacific', score: 36, commodities: ['DIESEL', 'RICE'] },
  { id: 'TUR', name: 'Turkey', region: 'Europe', score: 58, commodities: ['GAS', 'WHEAT'] },
  { id: 'DEU', name: 'Germany', region: 'Europe', score: 34, commodities: ['GAS', 'AUTO'] },
  { id: 'EGY', name: 'Egypt', region: 'Middle East', score: 44, commodities: ['LNG', 'SHIPPING'] },
];

const countryAliases = {
  russia: 'RUS',
  iran: 'IRN',
  israel: 'ISR',
  'saudi arabia': 'SAU',
  china: 'CHN',
  pakistan: 'PAK',
  usa: 'USA',
  'united states': 'USA',
  'united states of america': 'USA',
  ukraine: 'UKR',
  uae: 'ARE',
  'united arab emirates': 'ARE',
  indonesia: 'IDN',
  india: 'IND',
  turkey: 'TUR',
  'türkiye': 'TUR',
  germany: 'DEU',
  egypt: 'EGY',
};

const countryById = new Map(explicitCountryProfiles.map((country) => [country.id, country]));
const countryByAlias = new Map(
  Object.entries(countryAliases).map(([alias, id]) => [alias, countryById.get(id)]),
);

const regionScoreBaseline = {
  Europe: 34,
  'Middle East': 44,
  'Asia Pacific': 36,
  Americas: 29,
  Africa: 24,
  Oceania: 22,
  Global: 30,
};

const regionCommodityFallback = {
  Europe: ['GAS', 'WHEAT'],
  'Middle East': ['CRUDE', 'LNG'],
  'Asia Pacific': ['COPPER', 'LNG'],
  Americas: ['GOLD', 'CRUDE'],
  Africa: ['LNG', 'URANIUM'],
  Oceania: ['IRON ORE', 'LNG'],
  Global: ['CRUDE', 'GOLD'],
};

function hashSeed(input) {
  return [...String(input || '')].reduce((accumulator, char, index) => {
    return accumulator + char.charCodeAt(0) * (index + 17);
  }, 0);
}

function normalizeRegionName(region) {
  if (!region) return 'Global';
  const normalized = region.toLowerCase();
  if (normalized.includes('asia')) return 'Asia Pacific';
  if (normalized.includes('middle')) return 'Middle East';
  if (normalized.includes('europe')) return 'Europe';
  if (normalized.includes('america')) return 'Americas';
  if (normalized.includes('africa')) return 'Africa';
  if (normalized.includes('oceania')) return 'Oceania';
  return region;
}

function buildMockCandles(startOpen, closes, digits = 2) {
  const startTime = Math.floor(Date.now() / 1000) - closes.length * HALF_HOUR;
  let previousClose = startOpen;

  return closes.map((close, index) => {
    const open = index === 0 ? startOpen : previousClose;
    const wick = Math.max(Math.abs(close - open) * 0.7, close * 0.0018, 0.03);
    const high = Math.max(open, close) + wick * (1 + (index % 4) * 0.08);
    const low = Math.min(open, close) - wick * (0.9 + (index % 5) * 0.06);
    previousClose = close;

    return {
      time: startTime + index * HALF_HOUR,
      open: Number(open.toFixed(digits + 1)),
      high: Number(high.toFixed(digits + 1)),
      low: Number(low.toFixed(digits + 1)),
      close: Number(close.toFixed(digits + 1)),
    };
  });
}

function createGeoAsset(config) {
  const candles = buildMockCandles(config.startOpen, config.closes, config.digits ?? 2);
  const sessionHigh = Math.max(...candles.map((item) => item.high));
  const sessionLow = Math.min(...candles.map((item) => item.low));
  const sessionOpen = candles[0]?.open ?? config.startOpen;
  const sessionClose = candles.at(-1)?.close ?? config.startOpen;

  return {
    ...config,
    candles,
    stats: {
      open: sessionOpen,
      high: sessionHigh,
      low: sessionLow,
      close: sessionClose,
    },
    priceLabel: sessionClose.toFixed(config.digits ?? 2),
    changeLabel: `${config.change >= 0 ? '+' : '-'}${Math.abs(config.change).toFixed(2)}%`,
    tone: config.change >= 0 ? 'positive' : 'negative',
  };
}

export const macroStats = {
  gti: 71.4,
  delta: '+2.1',
  regime: 'Elevated',
  vix: 14.2,
  crude: 85.4,
  usdInr: 83.1,
};

export const trendHistory = [54, 58, 60, 66, 70, 72, 68, 64, 69, 71, 73, 70];

export const geoNewsFeed = [
  {
    headline: 'Strait of Hormuz naval drill disrupts tanker risk premium',
    time: '08:57 AM',
    region: 'Middle East',
    severity: 'critical',
  },
  {
    headline: 'ECB emergency statement pushes Europe risk gauges higher',
    time: '07:57 AM',
    region: 'Europe',
    severity: 'high',
  },
];

export const earthPulseHotspots = [
  { title: 'Red Sea Logistics', region: 'Middle East', score: 84, copy: 'Insurance premia and freight stress keep import-cost signals hot.' },
  { title: 'Black Sea Grain', region: 'Europe', score: 72, copy: 'Wheat flows remain fragile and drive food-inflation sensitivity.' },
  { title: 'Taiwan Supply Chain', region: 'Asia Pacific', score: 63, copy: 'Semiconductor flow headlines still reprice IT export expectations.' },
  { title: 'US Rates Crosswind', region: 'Americas', score: 49, copy: 'Rate-differential noise keeps capital flow models choppy.' },
];

export const regionFilters = ['All', 'Middle East', 'Europe', 'Asia Pacific', 'Americas', 'Africa'];

export const geoAssets = {
  RUB: createGeoAsset({
    key: 'RUB',
    name: 'Rouble',
    symbol: 'USD/RUB',
    digits: 2,
    startOpen: 91.84,
    closes: [91.92, 91.88, 91.73, 91.67, 91.58, 91.71, 91.96, 91.84, 91.68, 91.74, 91.93, 92.08, 92.15, 92.11, 92.04, 92.18, 92.31, 92.27, 92.2, 92.24, 92.36, 92.42, 92.47, 92.58],
    change: 0.82,
    context: 'FX stress monitor',
    insight: 'Ruble pricing stays bid while energy corridors remain noisy and capital-flow expectations stay defensive.',
    exposures: [
      { label: 'Energy', value: 71 },
      { label: 'Rates', value: 44 },
      { label: 'Defense', value: 38 },
    ],
  }),
  OIL: createGeoAsset({
    key: 'OIL',
    name: 'Crude Oil',
    symbol: 'USOIL',
    digits: 2,
    startOpen: 82.16,
    closes: [82.08, 81.96, 81.62, 81.44, 81.34, 81.78, 82.19, 81.41, 80.92, 81.36, 82.36, 82.82, 82.58, 82.11, 82.93, 83.74, 83.48, 82.86, 83.27, 83.94, 84.02, 84.88, 85.64, 85.15],
    change: -0.16,
    context: 'Energy supply route pricing',
    insight: 'Shipping disruption risk keeps crude elevated, while intraday selling appears only when liquidity returns through Europe.',
    exposures: [
      { label: 'Energy', value: 64 },
      { label: 'Defense', value: 24 },
      { label: 'Logistics', value: 18 },
    ],
  }),
  GOLD: createGeoAsset({
    key: 'GOLD',
    name: 'Gold',
    symbol: 'XAUUSD',
    digits: 1,
    startOpen: 2291.4,
    closes: [2294.1, 2296.8, 2293.4, 2298.2, 2301.5, 2299.6, 2304.8, 2308.6, 2311.9, 2307.5, 2302.8, 2305.4, 2312.2, 2315.9, 2314.1, 2318.7, 2321.3, 2317.8, 2324.2, 2328.9, 2331.2, 2327.4, 2324.1, 2322.6],
    change: 1.5,
    context: 'Safe-haven accumulation',
    insight: 'Gold remains the cleanest hedge when geopolitical impulse is outrunning central-bank communication clarity.',
    exposures: [
      { label: 'Metals', value: 58 },
      { label: 'FX', value: 31 },
      { label: 'Defense', value: 22 },
    ],
  }),
  GAS: createGeoAsset({
    key: 'GAS',
    name: 'Natural Gas',
    symbol: 'NATGAS',
    digits: 3,
    startOpen: 3.11,
    closes: [3.08, 3.06, 3.03, 3.01, 3.05, 3.09, 3.12, 3.07, 3.01, 3.04, 3.08, 3.15, 3.11, 3.06, 3.1, 3.18, 3.2, 3.17, 3.16, 3.22, 3.25, 3.28, 3.24, 3.23],
    change: 1.02,
    context: 'Pipeline sensitivity gauge',
    insight: 'Natural gas stays jumpy because even modest route headlines still reprice European inventory expectations quickly.',
    exposures: [
      { label: 'Utilities', value: 52 },
      { label: 'Energy', value: 49 },
      { label: 'Chemicals', value: 17 },
    ],
  }),
};

export const geoCountryAssetMap = {
  Russia: 'OIL',
  Iran: 'OIL',
  Israel: 'GOLD',
  'Saudi Arabia': 'OIL',
  China: 'GAS',
  Pakistan: 'GAS',
  'United States': 'GOLD',
  Ukraine: 'GOLD',
  'United Arab Emirates': 'OIL',
  Indonesia: 'GAS',
  India: 'OIL',
};

export const sectorStocks = {
  Banking: [
    {
      name: 'Axis Bank',
      ticker: 'AXISBANK',
      score: 0.05,
      label: 'NEUTRAL',
      breakdown: { F: 0.1, T: 0.05, N: 0.0, G: -0.1 },
      overview: 'Funding is steady, but management guidance remains cautious with mixed global cues.',
      fundamental: { pe: 14.2, sectorPE: 20.1, roe: 13.8, npa: 1.5, revenueGrowth: 9, promoterHolding: 8.2 },
      technical: { rsi: 51, priceVsWMA: 0.2, macd: 'Neutral', volumeTrend: 'Stable', support: 1020, resistance: 1105 },
      news: [
        { headline: 'Axis Bank steady growth amid market volatility', sentiment: 'NEUTRAL', source: 'Bloomberg', time: '4h ago' },
        { headline: 'Axis Bank SME lending grows 18% YoY', sentiment: 'POSITIVE', source: 'Economic Times', time: '6h ago' },
        { headline: 'Axis Bank management guidance cautious for Q4', sentiment: 'NEGATIVE', source: 'Moneycontrol', time: '9h ago' },
      ],
    },
    {
      name: 'HDFC Bank',
      ticker: 'HDFCBANK',
      score: 0.16,
      label: 'CONFLICTED',
      breakdown: { F: 0.43, T: -0.14, N: 0.5, G: -0.3 },
      overview: 'Fundamentals hold up well, but external macro pressure still clips sentiment.',
      fundamental: { pe: 18.2, sectorPE: 20.1, roe: 16.5, npa: 1.2, revenueGrowth: 12, promoterHolding: 26.1 },
      technical: { rsi: 68, priceVsWMA: 0.8, macd: 'Bearish crossover', volumeTrend: 'Decreasing', support: 1612, resistance: 1698 },
      news: [
        { headline: 'HDFC Bank Q3 profit rises 18% YoY beating estimates', sentiment: 'POSITIVE', source: 'Bloomberg', time: '2h ago' },
        { headline: 'RBI flags concern over rising retail loan defaults', sentiment: 'NEGATIVE', source: 'Economic Times', time: '4h ago' },
        { headline: 'FII outflows continue for third consecutive session', sentiment: 'NEGATIVE', source: 'Moneycontrol', time: '5h ago' },
      ],
    },
    {
      name: 'SBI',
      ticker: 'SBIN',
      score: 0.42,
      label: 'BULLISH',
      breakdown: { F: 0.3, T: 0.25, N: 0.2, G: -0.1 },
      overview: 'Credit growth stays strong and valuation remains supportive despite regime drag.',
      fundamental: { pe: 9.1, sectorPE: 20.1, roe: 14.2, npa: 2.8, revenueGrowth: 8, promoterHolding: 57.5 },
      technical: { rsi: 55, priceVsWMA: 1.2, macd: 'Bullish crossover', volumeTrend: 'Increasing', support: 740, resistance: 812 },
      news: [
        { headline: 'SBI reports strong quarter with NPA improvement', sentiment: 'POSITIVE', source: 'Bloomberg', time: '3h ago' },
        { headline: 'SBI rural lending grows 22% YoY', sentiment: 'POSITIVE', source: 'Economic Times', time: '6h ago' },
        { headline: 'PSU banks face margin pressure from rate cuts', sentiment: 'NEGATIVE', source: 'Moneycontrol', time: '8h ago' },
      ],
    },
    {
      name: 'ICICI Bank',
      ticker: 'ICICIBANK',
      score: -0.21,
      label: 'BEARISH',
      breakdown: { F: -0.1, T: -0.3, N: -0.2, G: -0.3 },
      overview: 'Loan-quality headlines and weaker tape keep the signal under pressure.',
      fundamental: { pe: 17.4, sectorPE: 20.1, roe: 15.1, npa: 1.8, revenueGrowth: 6, promoterHolding: 0 },
      technical: { rsi: 72, priceVsWMA: -0.5, macd: 'Bearish crossover', volumeTrend: 'Decreasing', support: 1050, resistance: 1142 },
      news: [
        { headline: 'ICICI Bank faces RBI scrutiny over loan practices', sentiment: 'NEGATIVE', source: 'Bloomberg', time: '1h ago' },
        { headline: 'ICICI retail loan book shows stress signals', sentiment: 'NEGATIVE', source: 'Economic Times', time: '5h ago' },
        { headline: 'ICICI Bank results remain broadly in line', sentiment: 'NEUTRAL', source: 'Moneycontrol', time: '7h ago' },
      ],
    },
  ],
  IT: [
    {
      name: 'TCS',
      ticker: 'TCS',
      score: 0.38,
      label: 'BULLISH',
      breakdown: { F: 0.5, T: 0.3, N: 0.25, G: -0.1 },
      overview: 'Deal wins and resilient digital demand keep the medium-term setup constructive.',
      fundamental: { pe: 28.4, sectorPE: 30.2, roe: 44.1, npa: 0, revenueGrowth: 11, promoterHolding: 72.3 },
      technical: { rsi: 58, priceVsWMA: 1.5, macd: 'Bullish crossover', volumeTrend: 'Increasing', support: 3680, resistance: 3950 },
      news: [
        { headline: 'TCS wins $500M deal from European bank', sentiment: 'POSITIVE', source: 'Bloomberg', time: '1h ago' },
        { headline: 'TCS revenue beats expectations at 11% YoY growth', sentiment: 'POSITIVE', source: 'Economic Times', time: '3h ago' },
        { headline: 'Rupee depreciation may hurt IT margins in Q4', sentiment: 'NEGATIVE', source: 'Moneycontrol', time: '6h ago' },
      ],
    },
    {
      name: 'Infosys',
      ticker: 'INFY',
      score: 0.22,
      label: 'LEANING BULLISH',
      breakdown: { F: 0.35, T: 0.15, N: 0.2, G: -0.1 },
      overview: 'Guidance improved, but macro caution still caps full-throttle momentum.',
      fundamental: { pe: 24.8, sectorPE: 30.2, roe: 31.7, npa: 0, revenueGrowth: 9, promoterHolding: 14.9 },
      technical: { rsi: 55, priceVsWMA: 0.9, macd: 'Bullish crossover', volumeTrend: 'Stable', support: 1520, resistance: 1680 },
      news: [
        { headline: 'Infosys raises FY24 revenue guidance', sentiment: 'POSITIVE', source: 'Bloomberg', time: '2h ago' },
        { headline: 'Infosys lands AI transformation deal with Fortune 500 firm', sentiment: 'POSITIVE', source: 'Economic Times', time: '5h ago' },
        { headline: 'Infosys faces attrition concerns in mid-level management', sentiment: 'NEGATIVE', source: 'Moneycontrol', time: '7h ago' },
      ],
    },
    {
      name: 'HCL Tech',
      ticker: 'HCLTECH',
      score: 0.45,
      label: 'BULLISH',
      breakdown: { F: 0.55, T: 0.4, N: 0.3, G: -0.1 },
      overview: 'Pipeline quality and relative momentum remain among the strongest in the group.',
      fundamental: { pe: 26.3, sectorPE: 30.2, roe: 22.8, npa: 0, revenueGrowth: 14, promoterHolding: 60.8 },
      technical: { rsi: 63, priceVsWMA: 2.1, macd: 'Bullish crossover', volumeTrend: 'Increasing', support: 1580, resistance: 1750 },
      news: [
        { headline: 'HCL Tech best performing IT stock YTD', sentiment: 'POSITIVE', source: 'Bloomberg', time: '1h ago' },
        { headline: 'HCL Tech wins cloud transformation deal from US pharma major', sentiment: 'POSITIVE', source: 'Economic Times', time: '4h ago' },
        { headline: 'Products division growth slows to 8%', sentiment: 'NEUTRAL', source: 'Moneycontrol', time: '7h ago' },
      ],
    },
  ],
  Pharma: [
    {
      name: 'Sun Pharma',
      ticker: 'SUNPHARMA',
      score: 0.52,
      label: 'BULLISH',
      breakdown: { F: 0.6, T: 0.45, N: 0.4, G: 0.1 },
      overview: 'Specialty and export strength continue to outweigh macro turbulence.',
      fundamental: { pe: 34.2, sectorPE: 32, roe: 18.4, npa: 0, revenueGrowth: 16, promoterHolding: 54.5 },
      technical: { rsi: 61, priceVsWMA: 2.8, macd: 'Bullish crossover', volumeTrend: 'Increasing', support: 1420, resistance: 1610 },
      news: [
        { headline: 'Sun Pharma US specialty business grows 28% YoY', sentiment: 'POSITIVE', source: 'Bloomberg', time: '1h ago' },
        { headline: 'Sun Pharma receives USFDA approval for generic cancer drug', sentiment: 'POSITIVE', source: 'Economic Times', time: '4h ago' },
        { headline: 'Capex guidance raised for FY25', sentiment: 'NEUTRAL', source: 'Moneycontrol', time: '6h ago' },
      ],
    },
    {
      name: "Dr. Reddy's",
      ticker: 'DRREDDY',
      score: 0.28,
      label: 'LEANING BULLISH',
      breakdown: { F: 0.4, T: 0.2, N: 0.25, G: 0.05 },
      overview: 'Execution is improving, though regulatory noise still shows up in the feed mix.',
      fundamental: { pe: 19.8, sectorPE: 32, roe: 21.3, npa: 0, revenueGrowth: 13, promoterHolding: 26.6 },
      technical: { rsi: 57, priceVsWMA: 1.1, macd: 'Bullish crossover', volumeTrend: 'Stable', support: 5620, resistance: 6200 },
      news: [
        { headline: "Dr Reddy's completes Nicotinell brand acquisition in Europe", sentiment: 'POSITIVE', source: 'Bloomberg', time: '2h ago' },
        { headline: "Dr Reddy's biosimilar pipeline gets analyst upgrades", sentiment: 'POSITIVE', source: 'Economic Times', time: '5h ago' },
        { headline: 'USFDA issues warning letter to Hyderabad plant', sentiment: 'NEGATIVE', source: 'Moneycontrol', time: '7h ago' },
      ],
    },
    {
      name: 'Lupin',
      ticker: 'LUPIN',
      score: 0.33,
      label: 'LEANING BULLISH',
      breakdown: { F: 0.4, T: 0.3, N: 0.25, G: 0.0 },
      overview: 'Product mix and improving export cadence keep the balance of signals constructive.',
      fundamental: { pe: 29.7, sectorPE: 32, roe: 12.1, npa: 0, revenueGrowth: 18, promoterHolding: 46.9 },
      technical: { rsi: 59, priceVsWMA: 1.7, macd: 'Bullish crossover', volumeTrend: 'Increasing', support: 1680, resistance: 1890 },
      news: [
        { headline: 'Lupin US revenue soars 32% on new product launches', sentiment: 'POSITIVE', source: 'Bloomberg', time: '1h ago' },
        { headline: 'Lupin gets USFDA nod for a high-value product', sentiment: 'POSITIVE', source: 'Economic Times', time: '4h ago' },
        { headline: 'Europe business faces generic competition headwinds', sentiment: 'NEGATIVE', source: 'Moneycontrol', time: '7h ago' },
      ],
    },
  ],
};

export const aiSignalsSummary = [
  { label: 'Bullish', value: 6 },
  { label: 'Conflicted', value: 3 },
  { label: 'Bearish', value: 2 },
];

export function getTensionColor(score) {
  if (score > 80) return '#ef4444';
  if (score > 35) return '#f59e0b';
  return '#22c55e';
}

export function getTensionTier(score) {
  if (score > 80) return 'critical';
  if (score > 35) return 'medium';
  return 'low';
}

export function getExplicitCountryProfile(nameOrIso) {
  if (!nameOrIso) return null;
  return countryById.get(String(nameOrIso).toUpperCase()) || countryByAlias.get(String(nameOrIso).trim().toLowerCase()) || null;
}

export function getCountryProfile({ name, iso, region }) {
  const explicit = getExplicitCountryProfile(iso || name);
  if (explicit) return explicit;

  const resolvedRegion = normalizeRegionName(region);
  const hash = hashSeed(`${iso || ''}:${name || ''}:${resolvedRegion}`);
  const base = regionScoreBaseline[resolvedRegion] ?? regionScoreBaseline.Global;
  const score = Math.max(14, Math.min(74, base + (hash % 18) - 7));
  const fallbackCommodities = regionCommodityFallback[resolvedRegion] ?? regionCommodityFallback.Global;

  return {
    id: iso || 'UNK',
    name,
    region: resolvedRegion,
    score,
    commodities: fallbackCommodities,
  };
}

export function getGeoAssetKeyForCountry(country) {
  if (!country?.name) return 'OIL';
  const mapped = geoCountryAssetMap[country.name];
  if (mapped) return mapped;

  if (country.commodities.includes('GAS') || country.commodities.includes('LNG')) return 'GAS';
  if (country.commodities.includes('GOLD')) return 'GOLD';
  return 'OIL';
}

export function getSectorStocks(sector = 'Banking') {
  return sectorStocks[sector] || sectorStocks.Banking;
}

export function getStockByTicker(ticker) {
  return Object.values(sectorStocks)
    .flat()
    .find((stock) => stock.ticker === ticker) || sectorStocks.Banking[0];
}

export function getTopSignals() {
  return Object.values(sectorStocks)
    .flat()
    .slice()
    .sort((left, right) => right.score - left.score);
}

export function getDefaultGeoState() {
  return {
    country: explicitCountryProfiles[0],
    assetKey: 'OIL',
    sector: 'Banking',
    ticker: 'AXISBANK',
  };
}
