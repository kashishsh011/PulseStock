import './style.css'
import Globe from 'globe.gl'
import gsap from 'gsap'
import * as animePkg from 'animejs';
const anime = animePkg.default || animePkg;
import Lenis from '@studio-freight/lenis'
import { calcFusionScore } from './engine/fusionEngine.js';
import { getTensionByName, getTensionColor, getISOByName } from './data/countryTensionData.js';

// 1. Initialize Lenis for smooth scroll (even though UI is mostly fixed, good for any internal overflow)
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  direction: 'vertical',
  gestureDirection: 'vertical',
  smooth: true,
});

function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// 2. Clock logic
function updateClock() {
  const now = new Date();
  document.getElementById('clock').innerText = now.toLocaleTimeString('en-US', { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();

// 3. Initialize 3D Globe
const globeContainer = document.getElementById('globeViz');

const world = Globe()
  (globeContainer)
  .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-dark.jpg')
  .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
  .backgroundColor('rgba(0,0,0,0)');

const geoEvents = [
  { name: 'Strait of Hormuz', lat: 26, lng: 56, region: 'me', severity: 'critical', color: '#ef4444', impact: 'Crude +4.2% → Commodity Shock regime → banking margins under pressure' },
  { name: 'ECB Emergency', lat: 50, lng: 10, region: 'eu', severity: 'high', color: '#f59e0b', impact: 'EUR/USD volatile → DXY strengthens → FII outflow risk for Indian equities' },
  { name: 'South China Sea', lat: 15, lng: 114, region: 'ap', severity: 'medium', color: '#3b82f6', impact: 'Shipping route risk → supply chain pressure → mild inflation signal' },
  { name: 'Fed Decision', lat: 38, lng: -77, region: 'us', severity: 'high', color: '#f59e0b', impact: 'US10Y +12bps → rate differential shift → capital flow repricing for Indian banks' },
  { name: 'Ukraine Conflict', lat: 49, lng: 32, region: 'eu', severity: 'critical', color: '#ef4444', impact: 'Energy prices elevated → VIX spike risk → FII panic outflows' },
  { name: 'Taiwan Strait', lat: 24, lng: 121, region: 'ap', severity: 'high', color: '#f59e0b', impact: 'Semiconductor supply risk → IT sector impact → broad market volatility' },
  { name: 'Venezuela Crude', lat: 8, lng: -66, region: 'us', severity: 'medium', color: '#3b82f6', impact: 'Oil supply uncertainty → crude price support → RBI forced action risk' },
  { name: 'Red Sea Shipping', lat: 15, lng: 42, region: 'me', severity: 'critical', color: '#ef4444', impact: 'Trade route disruption → import cost spike → inflation pressure on Indian banks' },
];

world
  .pointsData(geoEvents)
  .pointLat(d => d.lat)
  .pointLng(d => d.lng)
  .pointColor(d => d.color)
  .pointAltitude(0.02)
  .pointRadius(d => d.severity === 'critical' ? 0.5 : d.severity === 'high' ? 0.35 : 0.25)
  .pointLabel(d => `
    <div style="background:rgba(10,14,20,0.95);border:0.5px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 12px;max-width:220px;font-family:Inter,sans-serif">
      <div style="color:#f8fafc;font-size:12px;font-weight:500;margin-bottom:4px">${d.name}</div>
      <div style="font-size:10px;padding:2px 6px;border-radius:4px;display:inline-block;margin-bottom:6px;background:${d.severity==='critical'?'rgba(239,68,68,0.15)':d.severity==='high'?'rgba(245,158,11,0.15)':'rgba(59,130,246,0.15)'};color:${d.color}">${d.severity.toUpperCase()}</div>
      <div style="color:rgba(255,255,255,0.5);font-size:11px;line-height:1.5">${d.impact}</div>
    </div>
  `);

/* Align with flat map / getTensionColor() palette (#e05c5c / #e09a3c / #3a7d44) */
const countryColors = {
  'Oman': '#e05c5c', 'Iran': '#e05c5c', 'United Arab Emirates': '#e05c5c',
  'Germany': '#e09a3c', 'France': '#e09a3c',
  'China': '#e09a3c', 'Philippines': '#e09a3c', 'Vietnam': '#e09a3c',
  'United States of America': '#e09a3c',
  'Ukraine': '#e05c5c',
  'Taiwan': '#e09a3c',
  'Venezuela': '#e09a3c',
  'Yemen': '#e05c5c', 'Saudi Arabia': '#e05c5c'
};
let hoverD;
let selectedRegion = 'all';
let selectedSector = 'Banking';
let selectedStock = null;
let selectedCountry = null;
let sidebarMode = 'list';
let detailTab = 'Overall';
let countriesGeo = [];
let globeFeatures = [];
let pathNodes = [];
let capturedCenterLng = 0;
// Landing page sidebar state (separate from geo map sidebar)
let landingSelectedStock = null;
let landingSidebarMode = 'list';
let landingDetailTab = 'Overall';
/** Until true, landing right panel shows sector overview instead of the stock list. */
let landingSectorListUnlocked = false;

const LANDING_DETAIL_TAB_IDS = {
  Overall: 'panel-landing-overall',
  Fundamental: 'panel-landing-fundamental',
  Technical: 'panel-landing-technical',
  News: 'panel-landing-news',
  AI: 'panel-landing-ai',
};

const sectorStocks = {
  "Banking": [
    { name: "HDFC Bank",  ticker: "HDFCBANK",  score: 0.16,  label: "CONFLICTED",
      breakdown: { F: 0.43, T: -0.14, N: 0.50, G: -0.30 },
      fundamental: { pe: 18.2, sectorPE: 20.1, roe: 16.5, npa: 1.2, revenueGrowth: 12, promoterHolding: 26.1 },
      technical: { rsi: 68, priceVsWMA: 0.8, macd: "Bearish crossover", volumeTrend: "Decreasing", support: 1612.00, resistance: 1698.00 },
      news: [
        { headline: "HDFC Bank Q3 profit rises 18% YoY beating estimates", sentiment: "POSITIVE", source: "Bloomberg", time: "2h ago" },
        { headline: "RBI flags concern over rising retail loan defaults", sentiment: "NEGATIVE", source: "Economic Times", time: "4h ago" },
        { headline: "FII outflows continue for third consecutive session", sentiment: "NEGATIVE", source: "Moneycontrol", time: "5h ago" },
        { headline: "HDFC Bank to expand rural banking by 200 branches", sentiment: "POSITIVE", source: "Business Standard", time: "8h ago" },
        { headline: "Banking sector cautious ahead of Fed policy decision", sentiment: "NEUTRAL", source: "Reuters", time: "12h ago" }
      ]
    },
    { name: "SBI",        ticker: "SBIN",       score: 0.42,  label: "BULLISH",
      breakdown: { F: 0.30, T: 0.25, N: 0.20, G: -0.10 },
      fundamental: { pe: 9.1, sectorPE: 20.1, roe: 14.2, npa: 2.8, revenueGrowth: 8, promoterHolding: 57.5 },
      technical: { rsi: 55, priceVsWMA: 1.2, macd: "Bullish crossover", volumeTrend: "Increasing", support: 740.00, resistance: 812.00 },
      news: [
        { headline: "SBI reports strong Q3 with NPA improvement", sentiment: "POSITIVE", source: "Bloomberg", time: "3h ago" },
        { headline: "SBI rural lending grows 22% YoY", sentiment: "POSITIVE", source: "Economic Times", time: "6h ago" },
        { headline: "PSU banks face margin pressure from rate cuts", sentiment: "NEGATIVE", source: "Moneycontrol", time: "8h ago" },
        { headline: "SBI to raise capital via QIP next quarter", sentiment: "NEUTRAL", source: "Business Standard", time: "10h ago" },
        { headline: "Government may increase SBI stake says report", sentiment: "POSITIVE", source: "Reuters", time: "14h ago" }
      ]
    },
    { name: "ICICI Bank", ticker: "ICICIBANK",  score: -0.21, label: "BEARISH",
      breakdown: { F: -0.10, T: -0.30, N: -0.20, G: -0.30 },
      fundamental: { pe: 17.4, sectorPE: 20.1, roe: 15.1, npa: 1.8, revenueGrowth: 6, promoterHolding: 0 },
      technical: { rsi: 72, priceVsWMA: -0.5, macd: "Bearish crossover", volumeTrend: "Decreasing", support: 1050.00, resistance: 1142.00 },
      news: [
        { headline: "ICICI Bank faces RBI scrutiny over loan practices", sentiment: "NEGATIVE", source: "Bloomberg", time: "1h ago" },
        { headline: "ICICI retail loan book shows stress signals", sentiment: "NEGATIVE", source: "Economic Times", time: "5h ago" },
        { headline: "ICICI Bank Q3 results in line with estimates", sentiment: "NEUTRAL", source: "Moneycontrol", time: "7h ago" },
        { headline: "ICICI digital banking users cross 10 million", sentiment: "POSITIVE", source: "Business Standard", time: "9h ago" },
        { headline: "FII selling concentrated in ICICI and HDFC", sentiment: "NEGATIVE", source: "Reuters", time: "11h ago" }
      ]
    },
    { name: "Axis Bank",  ticker: "AXISBANK",   score: 0.05,  label: "NEUTRAL",
      breakdown: { F: 0.10, T: 0.05, N: 0.00, G: -0.10 },
      fundamental: { pe: 14.2, sectorPE: 20.1, roe: 13.8, npa: 1.5, revenueGrowth: 9, promoterHolding: 8.2 },
      technical: { rsi: 51, priceVsWMA: 0.2, macd: "Neutral", volumeTrend: "Stable", support: 1020.00, resistance: 1105.00 },
      news: [
        { headline: "Axis Bank steady growth amid market volatility", sentiment: "NEUTRAL", source: "Bloomberg", time: "4h ago" },
        { headline: "Axis Bank SME lending grows 18% YoY", sentiment: "POSITIVE", source: "Economic Times", time: "6h ago" },
        { headline: "Axis Bank management guidance cautious for Q4", sentiment: "NEGATIVE", source: "Moneycontrol", time: "9h ago" },
        { headline: "Axis Bank launches new UPI product", sentiment: "POSITIVE", source: "Business Standard", time: "12h ago" },
        { headline: "Banking index flat as global cues mixed", sentiment: "NEUTRAL", source: "Reuters", time: "15h ago" }
      ]
    },
    { name: "Kotak Bank", ticker: "KOTAKBANK",  score: 0.31,  label: "LEANING BULLISH",
      breakdown: { F: 0.40, T: 0.20, N: 0.30, G: -0.20 },
      fundamental: { pe: 20.1, sectorPE: 20.1, roe: 17.2, npa: 0.8, revenueGrowth: 15, promoterHolding: 25.9 },
      technical: { rsi: 62, priceVsWMA: 1.8, macd: "Bullish crossover", volumeTrend: "Increasing", support: 1740.00, resistance: 1890.00 },
      news: [
        { headline: "Kotak Bank best in class NPA at 0.8%", sentiment: "POSITIVE", source: "Bloomberg", time: "2h ago" },
        { headline: "Kotak expands wealth management division", sentiment: "POSITIVE", source: "Economic Times", time: "5h ago" },
        { headline: "Kotak valuations stretched say analysts", sentiment: "NEGATIVE", source: "Moneycontrol", time: "7h ago" },
        { headline: "Kotak 811 digital accounts cross 5 million", sentiment: "POSITIVE", source: "Business Standard", time: "10h ago" },
        { headline: "Private banks outperform PSU in Q3 season", sentiment: "POSITIVE", source: "Reuters", time: "13h ago" }
      ]
    }
  ],
  "IT": [
    { name: "TCS",        ticker: "TCS",       score: 0.38,  label: "BULLISH",
      breakdown: { F: 0.50, T: 0.30, N: 0.25, G: -0.10 },
      fundamental: { pe: 28.4, sectorPE: 30.2, roe: 44.1, npa: 0, revenueGrowth: 11, promoterHolding: 72.3 },
      technical: { rsi: 58, priceVsWMA: 1.5, macd: "Bullish crossover", volumeTrend: "Increasing", support: 3680.00, resistance: 3950.00 },
      news: [
        { headline: "TCS wins $500M deal from European bank, largest in 3 years", sentiment: "POSITIVE", source: "Bloomberg", time: "1h ago" },
        { headline: "TCS Q3 revenue beat expectations at 11% YoY growth", sentiment: "POSITIVE", source: "Economic Times", time: "3h ago" },
        { headline: "Rupee depreciation may hurt IT margins in Q4", sentiment: "NEGATIVE", source: "Moneycontrol", time: "6h ago" },
        { headline: "US visa curbs pose headwind for Indian IT hiring", sentiment: "NEGATIVE", source: "Business Standard", time: "9h ago" },
        { headline: "AI-related deals driving demand for IT services globally", sentiment: "POSITIVE", source: "Reuters", time: "12h ago" }
      ]
    },
    { name: "Infosys",    ticker: "INFY",      score: 0.22,  label: "LEANING BULLISH",
      breakdown: { F: 0.35, T: 0.15, N: 0.20, G: -0.10 },
      fundamental: { pe: 24.8, sectorPE: 30.2, roe: 31.7, npa: 0, revenueGrowth: 9, promoterHolding: 14.9 },
      technical: { rsi: 55, priceVsWMA: 0.9, macd: "Bullish crossover", volumeTrend: "Stable", support: 1520.00, resistance: 1680.00 },
      news: [
        { headline: "Infosys raises FY24 revenue guidance to 11-11.5%", sentiment: "POSITIVE", source: "Bloomberg", time: "2h ago" },
        { headline: "Infosys lands AI transformation deal with Fortune 500 firm", sentiment: "POSITIVE", source: "Economic Times", time: "5h ago" },
        { headline: "Infosys faces attrition concerns in mid-level management", sentiment: "NEGATIVE", source: "Moneycontrol", time: "7h ago" },
        { headline: "Infosys digital revenue now 60% of total business", sentiment: "POSITIVE", source: "Business Standard", time: "10h ago" },
        { headline: "Global IT spending slowdown risk from macro uncertainty", sentiment: "NEUTRAL", source: "Reuters", time: "14h ago" }
      ]
    },
    { name: "Wipro",      ticker: "WIPRO",     score: -0.08, label: "NEUTRAL",
      breakdown: { F: 0.05, T: -0.10, N: -0.15, G: -0.10 },
      fundamental: { pe: 22.1, sectorPE: 30.2, roe: 15.2, npa: 0, revenueGrowth: 4, promoterHolding: 72.9 },
      technical: { rsi: 48, priceVsWMA: -0.3, macd: "Neutral", volumeTrend: "Decreasing", support: 445.00, resistance: 510.00 },
      news: [
        { headline: "Wipro Q3 revenue flat, below street estimates", sentiment: "NEGATIVE", source: "Bloomberg", time: "3h ago" },
        { headline: "Wipro CEO outlines 5-year AI strategy at analyst day", sentiment: "POSITIVE", source: "Economic Times", time: "6h ago" },
        { headline: "Wipro loses two senior executives to rival firms", sentiment: "NEGATIVE", source: "Moneycontrol", time: "8h ago" },
        { headline: "Wipro Energy sector deals grow 18% YoY", sentiment: "POSITIVE", source: "Business Standard", time: "11h ago" },
        { headline: "IT sector outlook cautious as BFSI clients cut budgets", sentiment: "NEUTRAL", source: "Reuters", time: "15h ago" }
      ]
    },
    { name: "HCL Tech",   ticker: "HCLTECH",   score: 0.45,  label: "BULLISH",
      breakdown: { F: 0.55, T: 0.40, N: 0.30, G: -0.10 },
      fundamental: { pe: 26.3, sectorPE: 30.2, roe: 22.8, npa: 0, revenueGrowth: 14, promoterHolding: 60.8 },
      technical: { rsi: 63, priceVsWMA: 2.1, macd: "Bullish crossover", volumeTrend: "Increasing", support: 1580.00, resistance: 1750.00 },
      news: [
        { headline: "HCL Tech best performing IT stock YTD with 22% gain", sentiment: "POSITIVE", source: "Bloomberg", time: "1h ago" },
        { headline: "HCL Tech wins cloud transformation deal from US pharma major", sentiment: "POSITIVE", source: "Economic Times", time: "4h ago" },
        { headline: "HCL Tech products division growth slows to 8%", sentiment: "NEUTRAL", source: "Moneycontrol", time: "7h ago" },
        { headline: "HCL Tech expands Europe presence with UK acquisition", sentiment: "POSITIVE", source: "Business Standard", time: "9h ago" },
        { headline: "Analysts upgrade HCL Tech on strong deal pipeline", sentiment: "POSITIVE", source: "Reuters", time: "13h ago" }
      ]
    },
    { name: "Tech M",     ticker: "TECHM",     score: -0.18, label: "BEARISH",
      breakdown: { F: -0.15, T: -0.20, N: -0.15, G: -0.10 },
      fundamental: { pe: 38.9, sectorPE: 30.2, roe: 8.4, npa: 0, revenueGrowth: 2, promoterHolding: 35.1 },
      technical: { rsi: 71, priceVsWMA: -1.2, macd: "Bearish crossover", volumeTrend: "Decreasing", support: 1190.00, resistance: 1340.00 },
      news: [
        { headline: "Tech Mahindra restructuring costs weigh on Q3 margins", sentiment: "NEGATIVE", source: "Bloomberg", time: "2h ago" },
        { headline: "Tech M CEO flags slow recovery in telecom vertical", sentiment: "NEGATIVE", source: "Economic Times", time: "5h ago" },
        { headline: "Tech M bags $120M deal from Scandinavian telecom firm", sentiment: "POSITIVE", source: "Moneycontrol", time: "8h ago" },
        { headline: "Tech M valuation premium hard to justify say analysts", sentiment: "NEGATIVE", source: "Business Standard", time: "10h ago" },
        { headline: "Telecom IT spending globally under pressure in 2024", sentiment: "NEGATIVE", source: "Reuters", time: "13h ago" }
      ]
    }
  ],
  "Pharma": [
    { name: "Sun Pharma",  ticker: "SUNPHARMA", score: 0.52,  label: "BULLISH",
      breakdown: { F: 0.60, T: 0.45, N: 0.40, G: 0.10 },
      fundamental: { pe: 34.2, sectorPE: 32.0, roe: 18.4, npa: 0, revenueGrowth: 16, promoterHolding: 54.5 },
      technical: { rsi: 61, priceVsWMA: 2.8, macd: "Bullish crossover", volumeTrend: "Increasing", support: 1420.00, resistance: 1610.00 },
      news: [
        { headline: "Sun Pharma US specialty business grows 28% YoY", sentiment: "POSITIVE", source: "Bloomberg", time: "1h ago" },
        { headline: "Sun Pharma receives USFDA approval for generic cancer drug", sentiment: "POSITIVE", source: "Economic Times", time: "4h ago" },
        { headline: "Sun Pharma capex guidance raised to ₹2,200 Cr for FY25", sentiment: "NEUTRAL", source: "Moneycontrol", time: "6h ago" },
        { headline: "US generic price erosion slowing says Sun Pharma management", sentiment: "POSITIVE", source: "Business Standard", time: "9h ago" },
        { headline: "Pharma sector benefits from easing raw material costs", sentiment: "POSITIVE", source: "Reuters", time: "12h ago" }
      ]
    },
    { name: "Dr. Reddy's", ticker: "DRREDDY",   score: 0.28,  label: "LEANING BULLISH",
      breakdown: { F: 0.40, T: 0.20, N: 0.25, G: 0.05 },
      fundamental: { pe: 19.8, sectorPE: 32.0, roe: 21.3, npa: 0, revenueGrowth: 13, promoterHolding: 26.6 },
      technical: { rsi: 57, priceVsWMA: 1.1, macd: "Bullish crossover", volumeTrend: "Stable", support: 5620.00, resistance: 6200.00 },
      news: [
        { headline: "Dr Reddy's completes Nicotinell brand acquisition in Europe", sentiment: "POSITIVE", source: "Bloomberg", time: "2h ago" },
        { headline: "Dr Reddy's biosimilar pipeline gets analyst upgrades", sentiment: "POSITIVE", source: "Economic Times", time: "5h ago" },
        { headline: "USFDA issues warning letter to Dr Reddy's Hyderabad plant", sentiment: "NEGATIVE", source: "Moneycontrol", time: "7h ago" },
        { headline: "Dr Reddy's Russia business headwinds from sanctions", sentiment: "NEGATIVE", source: "Business Standard", time: "10h ago" },
        { headline: "Generic drug pricing stable in US market in Q4", sentiment: "NEUTRAL", source: "Reuters", time: "14h ago" }
      ]
    },
    { name: "Cipla",       ticker: "CIPLA",     score: 0.14,  label: "NEUTRAL",
      breakdown: { F: 0.20, T: 0.10, N: 0.10, G: 0.00 },
      fundamental: { pe: 26.5, sectorPE: 32.0, roe: 14.8, npa: 0, revenueGrowth: 8, promoterHolding: 33.5 },
      technical: { rsi: 53, priceVsWMA: 0.4, macd: "Neutral", volumeTrend: "Stable", support: 1230.00, resistance: 1390.00 },
      news: [
        { headline: "Cipla India business grows steadily on chronic care demand", sentiment: "POSITIVE", source: "Bloomberg", time: "3h ago" },
        { headline: "Cipla gets tentative USFDA approval for generic Revlimid", sentiment: "POSITIVE", source: "Economic Times", time: "6h ago" },
        { headline: "Cipla South Africa unit faces pricing pressure", sentiment: "NEGATIVE", source: "Moneycontrol", time: "8h ago" },
        { headline: "Cipla maintains FY25 guidance at 8-10% revenue growth", sentiment: "NEUTRAL", source: "Business Standard", time: "11h ago" },
        { headline: "India pharma exports stable despite logistics challenges", sentiment: "NEUTRAL", source: "Reuters", time: "15h ago" }
      ]
    },
    { name: "Divis Lab",   ticker: "DIVISLAB",  score: -0.12, label: "BEARISH",
      breakdown: { F: -0.05, T: -0.20, N: -0.10, G: -0.10 },
      fundamental: { pe: 58.1, sectorPE: 32.0, roe: 16.2, npa: 0, revenueGrowth: -4, promoterHolding: 51.9 },
      technical: { rsi: 68, priceVsWMA: -0.8, macd: "Bearish crossover", volumeTrend: "Decreasing", support: 3450.00, resistance: 3900.00 },
      news: [
        { headline: "Divis Lab revenue declines for second consecutive quarter", sentiment: "NEGATIVE", source: "Bloomberg", time: "2h ago" },
        { headline: "API price pressure from Chinese competition hurts Divis margins", sentiment: "NEGATIVE", source: "Economic Times", time: "5h ago" },
        { headline: "Divis Lab Kakinada facility expansion on track", sentiment: "POSITIVE", source: "Moneycontrol", time: "8h ago" },
        { headline: "Divis trades at premium to pharma peers despite earnings miss", sentiment: "NEGATIVE", source: "Business Standard", time: "11h ago" },
        { headline: "China API supply normalizing, reduces India's pricing power", sentiment: "NEGATIVE", source: "Reuters", time: "14h ago" }
      ]
    },
    { name: "Lupin",       ticker: "LUPIN",     score: 0.33,  label: "LEANING BULLISH",
      breakdown: { F: 0.40, T: 0.30, N: 0.25, G: 0.00 },
      fundamental: { pe: 29.7, sectorPE: 32.0, roe: 12.1, npa: 0, revenueGrowth: 18, promoterHolding: 46.9 },
      technical: { rsi: 59, priceVsWMA: 1.7, macd: "Bullish crossover", volumeTrend: "Increasing", support: 1680.00, resistance: 1890.00 },
      news: [
        { headline: "Lupin US revenue soars 32% on new product launches", sentiment: "POSITIVE", source: "Bloomberg", time: "1h ago" },
        { headline: "Lupin gets USFDA nod for gNuvaring, high-value product", sentiment: "POSITIVE", source: "Economic Times", time: "4h ago" },
        { headline: "Lupin Europe business faces generic competition headwinds", sentiment: "NEGATIVE", source: "Moneycontrol", time: "7h ago" },
        { headline: "Lupin complex generics pipeline one of best in sector", sentiment: "POSITIVE", source: "Business Standard", time: "10h ago" },
        { headline: "Pharma index outperforms broader market in March rally", sentiment: "POSITIVE", source: "Reuters", time: "13h ago" }
      ]
    }
  ]
};

const sectorCountryMap = {
  "Banking": ["USA", "RUS", "CHN", "ARE", "GBR"],
  "IT": ["USA", "GBR", "DEU", "AUS", "CAN"],
  "Pharma": ["USA", "DEU", "CHN", "GBR", "BRA"],
  "Energy": ["RUS", "SAU", "IRN", "ARE", "USA"],
  "Auto": ["JPN", "DEU", "CHN", "KOR", "USA"],
  "FMCG": ["IDN", "BRA", "CHN", "UKR", "TUR"]
};

const regionCoordinates = {
  all: { lat: 20, lng: 0 },
  me:  { lat: 25, lng: 45 },
  eu:  { lat: 50, lng: 10 },
  ap:  { lat: 20, lng: 100 },
  us:  { lat: 20, lng: -80 },
  af:  { lat: 0,  lng: 20 }
};

function getCountryISO(feature) {
  // Try direct properties first
  const directISO = feature?.properties?.iso_a3 || feature?.properties?.ISO_A3;
  if (directISO && directISO !== '-99') return directISO;
  // Fall back to name-based lookup
  const name = getCountryName(feature);
  if (!name) return null;
  return getISOByName(name) || getTensionByName(name)?.id || null;
}

function getBadgeStyles(label) {
  const normalized = (label || '').toUpperCase();
  if (normalized === 'BULLISH') return { background: '#0f766e', color: '#a7f3d0' };
  if (normalized === 'BEARISH') return { background: '#7f1d1d', color: '#fecaca' };
  if (normalized === 'CONFLICTED') return { background: '#78350f', color: '#fcd34d' };
  if (normalized === 'NEUTRAL') return { background: '#334155', color: '#cbd5e1' };
  if (normalized === 'LEANING BULLISH') return { background: '#166534', color: '#bbf7d0' };
  return { background: '#1f2937', color: '#e2e8f0' };
}

function getScoreColor(score) {
  return score >= 0 ? '#4ade80' : '#f87171';
}

function updateRegionButtons() {
  document.querySelectorAll('.region-btn').forEach(btn => {
    const active = btn.dataset.region === selectedRegion;
    btn.classList.toggle('active', active);
    btn.style.border = active ? '1px solid #4ade80' : '1px solid transparent';
  });
}

function updateSectorStyles() {
  document.querySelectorAll('.sector-list li').forEach(li => {
    const sector = li.dataset.sector || li.textContent.trim().split(' ')[0];
    const active = sector === selectedSector;
    li.style.borderLeft = active ? '4px solid #4ade80' : '4px solid transparent';
    li.style.background = active ? 'rgba(255,255,255,0.06)' : 'transparent';
  });
}

function showGeoView() {
  const currentActive = document.querySelector('.top-nav .tab.active');
  if (currentActive) currentActive.classList.remove('active');
  const geoTab = document.querySelector('.top-nav .tab[data-target="geo"]');
  if (geoTab) {
    geoTab.classList.add('active');
    lenis.scrollTo('#geo-view', { duration: 1.5 });
  }
}

function setSelectedRegion(region) {
  selectedRegion = region;
  updateRegionButtons();
  const coords = regionCoordinates[region] || regionCoordinates.all;
  if (world && world.controls) {
    world.pointOfView({ lat: coords.lat, lng: coords.lng, altitude: 2 }, 1000);
  }
  const filtered = region === 'all'
    ? geoEvents
    : geoEvents.filter(e => e.region === region);
  world.pointsData(filtered);
}

function setSelectedSector(sector) {
  selectedSector = sector;
  selectedStock = null;
  landingSectorListUnlocked = true;
  landingSidebarMode = 'list';
  landingDetailTab = 'Overall';
  sidebarMode = 'list';
  detailTab = 'Overall';
  updateSectorStyles();
  renderGeoRightPanel();
  renderLandingRightPanel();
  // Update globe polygon colors to highlight sector-relevant countries
  if (world && countriesGeo.length) world.polygonCapColor(world.polygonCapColor());
}

function setSelectedStock(stock) {
  selectedStock = stock;
  sidebarMode = 'detail';
  detailTab = 'Overall';
  renderGeoRightPanel();
}

function setLandingStock(stock) {
  landingSelectedStock = stock;
  landingSidebarMode = 'detail';
  landingDetailTab = 'Overall';
  renderLandingRightPanel();
}

function setSelectedCountry(country) {
  selectedCountry = country;
  renderGeoRightPanel();
  if (world) world.polygonCapColor(world.polygonCapColor());
}

function buildCountryCard() {
  if (!selectedCountry) return '';
  const tensionColor = getTensionColor(selectedCountry.score);
  return `
    <div style="margin-bottom:18px;padding:16px;background:#0f0f1a;border:1px solid #222;border-radius:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div>
          <div style="font-size:1rem;color:#fff;font-weight:700;">${selectedCountry.name}</div>
          <div style="color:#94a3b8;font-size:12px;margin-top:4px;">${selectedCountry.region}</div>
        </div>
        <div style="padding:5px 10px;border-radius:999px;border:1px solid ${tensionColor};background:${tensionColor}22;color:${tensionColor};font-size:11px;">Tension ${selectedCountry.score}/100</div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;">${selectedCountry.commodities.map(c => `<span style="padding:6px 10px;background:#111827;border:1px solid #222;border-radius:999px;color:#f8fafc;font-size:11px;">${c}</span>`).join('')}</div>
    </div>
  `;
}

function buildStockRow(stock) {
  const badge = getBadgeStyles(stock.label);
  return `
    <div data-action="select-stock" data-ticker="${stock.ticker}" style="padding:12px 0;border-bottom:1px solid #1e1e2e;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;transition:background 0.2s;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:14px;font-family:monospace;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${stock.name}</div>
      </div>
      <div style="font-size:12px;font-family:monospace;color:${getScoreColor(stock.score)};min-width:60px;text-align:right;">${stock.score >= 0 ? '+' : ''}${stock.score.toFixed(2)}</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="padding:2px 8px;border-radius:999px;background:${badge.background};color:${badge.color};font-size:11px;font-weight:600;white-space:nowrap;">${stock.label}</div>
        <span style="color:#94a3b8;font-size:14px;">›</span>
      </div>
    </div>
  `;
}

function renderDetailTabContent() {
  const container = document.getElementById('detail-tab-content');
  if (!container || !selectedStock) return;
  if (detailTab === 'Overall') {
    container.innerHTML = '';
    return;
  }
  if (detailTab === 'Fundamental') {
    const f = selectedStock.fundamental;
    const colorFor = (value, type) => {
      if (type === 'roe') return value >= 15 ? '#4ade80' : value >= 10 ? '#f59e0b' : '#f87171';
      if (type === 'npa') return value <= 1.5 ? '#4ade80' : value <= 3 ? '#f59e0b' : '#f87171';
      if (type === 'revenueGrowth') return value >= 0 ? '#4ade80' : '#f87171';
      return '#ffffff';
    };
    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #1e1e2e;">
        <span style="color:#94a3b8;font-size:12px;font-family:monospace;">P/E vs Sector</span>
        <span style="color:#fff;font-size:13px;font-family:monospace;">${f.pe} vs ${f.sectorPE}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #1e1e2e;">
        <span style="color:#94a3b8;font-size:12px;font-family:monospace;">ROE</span>
        <span style="color:${colorFor(f.roe,'roe')};font-size:13px;font-family:monospace;">${f.roe}%</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #1e1e2e;">
        <span style="color:#94a3b8;font-size:12px;font-family:monospace;">NPA</span>
        <span style="color:${colorFor(f.npa,'npa')};font-size:13px;font-family:monospace;">${f.npa}%</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #1e1e2e;">
        <span style="color:#94a3b8;font-size:12px;font-family:monospace;">Revenue Growth</span>
        <span style="color:${colorFor(f.revenueGrowth,'revenueGrowth')};font-size:13px;font-family:monospace;">${f.revenueGrowth}%</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 0;">
        <span style="color:#94a3b8;font-size:12px;font-family:monospace;">Promoter Holding</span>
        <span style="color:#fff;font-size:13px;font-family:monospace;">${f.promoterHolding}%</span>
      </div>
    `;
    return;
  }
  if (detailTab === 'Technical') {
    const t = selectedStock.technical;
    const rsiColor = t.rsi > 70 ? '#f87171' : t.rsi < 30 ? '#4ade80' : '#94a3b8';
    const rsiTag = t.rsi > 70 ? 'Overbought' : t.rsi < 30 ? 'Oversold' : 'Neutral';
    const macdColor = t.macd.toLowerCase().includes('bullish') ? '#4ade80' : t.macd.toLowerCase().includes('bearish') ? '#f87171' : '#94a3b8';
    const volumeColor = t.volumeTrend === 'Increasing' ? '#4ade80' : t.volumeTrend === 'Decreasing' ? '#f87171' : '#94a3b8';
    const priceColor = t.priceVsWMA >= 0 ? '#4ade80' : '#f87171';
    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #1e1e2e;">
        <span style="color:#94a3b8;font-size:12px;font-family:monospace;">RSI 14</span>
        <span style="color:${rsiColor};font-size:13px;font-family:monospace;">${t.rsi}% (${rsiTag})</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #1e1e2e;">
        <span style="color:#94a3b8;font-size:12px;font-family:monospace;">Price vs 20d WMA</span>
        <span style="color:${priceColor};font-size:13px;font-family:monospace;">${t.priceVsWMA >= 0 ? '+' : ''}${t.priceVsWMA}%</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #1e1e2e;">
        <span style="color:#94a3b8;font-size:12px;font-family:monospace;">MACD</span>
        <span style="color:${macdColor};font-size:13px;font-family:monospace;">${t.macd}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #1e1e2e;">
        <span style="color:#94a3b8;font-size:12px;font-family:monospace;">Volume Trend</span>
        <span style="color:${volumeColor};font-size:13px;font-family:monospace;">${t.volumeTrend}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 0;">
        <span style="color:#94a3b8;font-size:12px;font-family:monospace;">Support</span>
        <span style="color:#fff;font-size:13px;font-family:monospace;">${t.support.toFixed(2)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 0;">
        <span style="color:#94a3b8;font-size:12px;font-family:monospace;">Resistance</span>
        <span style="color:#fff;font-size:13px;font-family:monospace;">${t.resistance.toFixed(2)}</span>
      </div>
    `;
    return;
  }
  if (detailTab === 'News AI') {
    container.innerHTML = selectedStock.news.map(item => `
      <div style="padding:12px 0;border-bottom:1px solid #1e1e2e;">
        <div style="display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;background:${item.sentiment === 'POSITIVE' ? '#14532d' : item.sentiment === 'NEGATIVE' ? '#7f1d1d' : '#334155'};color:${item.sentiment === 'POSITIVE' ? '#86efac' : item.sentiment === 'NEGATIVE' ? '#fecaca' : '#cbd5e1'};font-size:11px;font-family:monospace;font-weight:600;">${item.sentiment}</div>
        <p style="margin:10px 0 6px;color:#fff;font-size:13px;line-height:1.4;">${item.headline}</p>
        <div style="color:#94a3b8;font-size:11px;">${item.source} · ${item.time}</div>
      </div>
    `).join('');
    return;
  }
}

function renderGeoRightPanel() {
  const dynamic = document.getElementById('geo-right-panel-dynamic');
  if (!dynamic) return;
  const countryCard = buildCountryCard();
  let html = countryCard;
  if (sidebarMode === 'list') {
    if (!selectedSector) {
      html += `<div style="padding:40px 20px;text-align:center;color:#94a3b8;font-size:13px;">Select a sector to see top stocks</div>`;
    } else {
      const stocks = sectorStocks[selectedSector] || [];
      html += `
        <div style="margin-bottom:16px;">
          <div style="font-size:11px;font-family:monospace;color:#94a3b8;text-transform:uppercase;letter-spacing:0.12em;">TOP STOCKS</div>
          <div style="font-size:15px;color:#fff;font-family:monospace;margin-top:6px;">${selectedSector}</div>
        </div>
        <div>${stocks.map(buildStockRow).join('')}</div>
      `;
    }
  } else if (sidebarMode === 'detail' && selectedStock) {
    const badge = getBadgeStyles(selectedStock.label);
    const scoreColor = getScoreColor(selectedStock.score);
    const scoreFill = Math.min(50, Math.abs(selectedStock.score) * 50);
    const scoreLeft = selectedStock.score >= 0 ? 50 : 50 - scoreFill;
    const tabButtons = ['Overall','Fundamental','Technical','News AI'].map(tab => `
      <button data-action="detail-tab" data-tab="${tab}" style="flex:1;padding:10px 0;border:none;background:none;color:${detailTab===tab ? '#fff' : '#94a3b8'};border-bottom:3px solid ${detailTab===tab ? '#4ade80' : 'transparent'};font-family:monospace;font-size:12px;cursor:pointer;">${tab}</button>
    `).join('');
    html += `
      <div style="padding-bottom:12px;border-bottom:1px solid #1e1e2e;display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <button data-action="back" style="background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;">←</button>
        <div style="flex:1;text-align:center;color:#fff;font-size:16px;font-weight:700;font-family:monospace;">${selectedStock.name}</div>
        <div style="padding:4px 10px;border-radius:999px;background:${badge.background};color:${badge.color};font-size:11px;white-space:nowrap;">${selectedStock.label}</div>
      </div>
      <div style="margin-top:16px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;color:#94a3b8;font-family:monospace;">
          <span>FUSION SCORE</span>
          <span style="color:${scoreColor};font-weight:600;">${selectedStock.score >= 0 ? '+' : ''}${selectedStock.score.toFixed(2)}</span>
        </div>
        <div style="position:relative;height:6px;background:#1e1e2e;border-radius:999px;margin-top:8px;">
          <div style="position:absolute;left:50%;top:0;width:1px;height:100%;background:#333;transform:translateX(-50%);"></div>
          <div style="position:absolute;top:0;height:100%;width:${scoreFill}%;left:${scoreLeft}%;background:${scoreColor};border-radius:999px;transition:all 0.4s ease;"></div>
        </div>
      </div>
      <div style="height:1px;background:#1e1e2e;margin:18px 0;"></div>
      <div id="signal-bars-container"></div>
      <div style="display:flex;gap:8px;margin-top:18px;">
        ${tabButtons}
      </div>
      <div id="detail-tab-content" style="margin-top:16px;"></div>
    `;
  } else {
    html += `<div style="padding:24px 20px;color:#94a3b8;font-size:13px;">Select a stock to view detail information.</div>`;
  }
  dynamic.innerHTML = html;
  if (sidebarMode === 'detail' && selectedStock) {
    renderSignalBars({ breakdown: selectedStock.breakdown });
    renderDetailTabContent();
  }
}

function handleGeoRightPanelClick(event) {
  const stockRow = event.target.closest('[data-action="select-stock"]');
  if (stockRow) {
    const ticker = stockRow.dataset.ticker;
    if (selectedSector && sectorStocks[selectedSector]) {
      const stock = sectorStocks[selectedSector].find(s => s.ticker === ticker);
      if (stock) setSelectedStock(stock);
    }
    return;
  }
  const back = event.target.closest('[data-action="back"]');
  if (back) {
    selectedStock = null;
    sidebarMode = 'list';
    detailTab = 'Overall';
    renderGeoRightPanel();
    return;
  }
  const tabBtn = event.target.closest('[data-action="detail-tab"]');
  if (tabBtn) {
    detailTab = tabBtn.dataset.tab;
    renderGeoRightPanel();
    return;
  }
}

function applyGeoRightPanelDelegation() {
  const geoRightPanel = document.querySelector('.geo-right-panel');
  if (!geoRightPanel || geoRightPanel.dataset.geoClickBound === '1') return;
  geoRightPanel.dataset.geoClickBound = '1';
  geoRightPanel.addEventListener('click', handleGeoRightPanelClick);
}

function renderSelectedSectorState() {
  updateSectorStyles();
  renderGeoRightPanel();
  renderLandingRightPanel();
}

function ensureGeoRightPanel() {
  if (!document.querySelector('.geo-right-panel')) return;
  applyGeoRightPanelDelegation();
  updateSectorStyles();
  renderGeoRightPanel();
  wireGeoMapChromeOnce();
}

function wireGeoMapChromeOnce() {
  if (typeof window !== 'undefined' && window.__geoMapChromeWired) return;
  if (typeof window !== 'undefined') window.__geoMapChromeWired = true;
  const closeBtn = document.getElementById('close-geo-right');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      document.querySelector('.geo-right-panel')?.classList.add('hidden');
    });
  }
}

// ─── LANDING PAGE RIGHT SIDEBAR ───────────────────────────────────────────────

function buildLandingStockRow(stock) {
  const badge = getBadgeStyles(stock.label);
  return `
    <div data-action="landing-select-stock" data-ticker="${stock.ticker}"
      style="padding:12px 0;border-bottom:1px solid #1e1e2e;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:10px;transition:background 0.2s;"
      onmouseenter="this.style.background='#1a1a2e'" onmouseleave="this.style.background='transparent'">
      <div style="flex:1;min-width:0;">
        <div style="font-size:14px;font-family:monospace;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${stock.name}</div>
      </div>
      <div style="font-size:12px;font-family:monospace;color:${getScoreColor(stock.score)};min-width:55px;text-align:right;">${stock.score >= 0 ? '+' : ''}${stock.score.toFixed(2)}</div>
      <div style="display:flex;align-items:center;gap:6px;">
        <div style="padding:2px 8px;border-radius:999px;background:${badge.background};color:${badge.color};font-size:11px;font-weight:600;white-space:nowrap;">${stock.label}</div>
        <span style="color:#94a3b8;font-size:14px;">›</span>
      </div>
    </div>
  `;
}

function computeSectorSnapshot(sectorKey) {
  const stocks = sectorStocks[sectorKey];
  if (!stocks || !stocks.length) {
    return {
      avgScore: 0,
      topGainer: null,
      topLoser: null,
      sentiment: 'CONFLICTED',
    };
  }
  const avgScore = stocks.reduce((a, s) => a + s.score, 0) / stocks.length;
  const byScore = [...stocks].sort((a, b) => b.score - a.score);
  const topGainer = byScore[0];
  const topLoser = byScore[byScore.length - 1];
  let sentiment = 'CONFLICTED';
  if (avgScore > 0.12) sentiment = 'BULLISH';
  else if (avgScore < -0.08) sentiment = 'BEARISH';
  return { avgScore, topGainer, topLoser, sentiment };
}

function buildSectorOverviewHTML() {
  if (!selectedSector) {
    return `<div class="tab-content-container" style="min-height:120px;justify-content:center;"><p style="text-align:center;color:#aab4c8;font-size:13px;line-height:1.5;margin:0;">Select a sector on the left to load its snapshot and stock list.</p></div>`;
  }
  const snap = computeSectorSnapshot(selectedSector);
  const badge = getBadgeStyles(snap.sentiment);
  const gainerLine = snap.topGainer
    ? `${snap.topGainer.name} (${snap.topGainer.score >= 0 ? '+' : ''}${snap.topGainer.score.toFixed(2)})`
    : '—';
  const loserLine = snap.topLoser
    ? `${snap.topLoser.name} (${snap.topLoser.score >= 0 ? '+' : ''}${snap.topLoser.score.toFixed(2)})`
    : '—';
  const avgColor = getScoreColor(snap.avgScore);
  return `
    <div class="tab-content-container" style="gap:12px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;width:100%;">
        <div style="min-width:0;flex:1;">
          <div style="font-size:11px;font-family:monospace;color:#aab4c8;text-transform:uppercase;letter-spacing:0.08em;">SECTOR OVERVIEW</div>
          <div style="font-size:18px;color:#fff;font-weight:700;font-family:var(--font-display,system-ui);margin-top:8px;line-height:1.2;">${selectedSector}</div>
        </div>
        <div class="signal-tag" style="flex-shrink:0;background:${badge.background};color:${badge.color};border-color:${badge.color};">${snap.sentiment}</div>
      </div>
      <div class="metric"><span>Avg fusion score</span><span style="font-family:monospace;font-weight:600;color:${avgColor};">${snap.avgScore >= 0 ? '+' : ''}${snap.avgScore.toFixed(2)}</span></div>
      <div class="metric"><span>Top gainer</span><span style="font-size:13px;text-align:right;color:#4ade80;max-width:60%;">${gainerLine}</span></div>
      <div class="metric"><span>Top loser</span><span style="font-size:13px;text-align:right;color:#f87171;max-width:60%;">${loserLine}</span></div>
      <p style="font-size:12px;color:#aab4c8;line-height:1.5;margin:4px 0 0;">Click the same sector in the left panel to open the full stock list.</p>
    </div>
  `;
}

function buildLandingFundamentalPanel(stock) {
  const f = stock.fundamental;
  const colorFor = (value, type) => {
    if (type === 'roe') return value >= 15 ? '#4ade80' : value >= 10 ? '#f59e0b' : '#f87171';
    if (type === 'npa') return value <= 1.5 ? '#4ade80' : value <= 3 ? '#f59e0b' : '#f87171';
    if (type === 'revenueGrowth') return value >= 0 ? '#4ade80' : '#f87171';
    return '#ffffff';
  };
  return `
    <div class="metric"><span>P/E ratio</span><span style="font-family:monospace;font-weight:600;">${f.pe} <span style="opacity:0.55;font-size:11px;">vs ${f.sectorPE}</span></span></div>
    <div class="metric"><span>ROE</span><span style="font-family:monospace;font-weight:600;color:${colorFor(f.roe, 'roe')}">${f.roe}%</span></div>
    <div class="metric"><span>NPA</span><span style="font-family:monospace;font-weight:600;color:${colorFor(f.npa, 'npa')}">${f.npa}%</span></div>
    <div class="metric"><span>Revenue growth</span><span style="font-family:monospace;font-weight:600;color:${colorFor(f.revenueGrowth, 'revenueGrowth')}">${f.revenueGrowth}%</span></div>
    <div class="metric"><span>Promoter holding</span><span style="font-family:monospace;font-weight:600;">${f.promoterHolding}%</span></div>
  `;
}

function buildLandingTechnicalPanel(stock) {
  const t = stock.technical;
  const rsiColor = t.rsi > 70 ? '#f87171' : t.rsi < 30 ? '#4ade80' : '#aab4c8';
  const rsiTag = t.rsi > 70 ? 'Overbought' : t.rsi < 30 ? 'Oversold' : 'Neutral';
  const macdColor = t.macd.toLowerCase().includes('bullish') ? '#4ade80' : t.macd.toLowerCase().includes('bearish') ? '#f87171' : '#aab4c8';
  const volumeColor = t.volumeTrend === 'Increasing' ? '#4ade80' : t.volumeTrend === 'Decreasing' ? '#f87171' : '#aab4c8';
  const dmaColor = t.priceVsWMA >= 0 ? '#4ade80' : '#f87171';
  const dmaLabel = t.priceVsWMA >= 0 ? `${t.priceVsWMA}% above` : `${Math.abs(t.priceVsWMA)}% below`;
  return `
    <div class="metric"><span>RSI (14)</span><span style="font-family:monospace;font-weight:600;color:${rsiColor};text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:55%;">${t.rsi} · ${rsiTag}</span></div>
    <div class="metric"><span>MACD signal</span><span style="font-family:monospace;font-weight:600;color:${macdColor};text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:55%;">${t.macd}</span></div>
    <div class="metric"><span>200DMA position</span><span style="font-family:monospace;font-weight:600;color:${dmaColor};text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:55%;">${dmaLabel}</span></div>
    <div class="metric"><span>Volume trend</span><span style="font-family:monospace;font-weight:600;color:${volumeColor};text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:55%;">${t.volumeTrend}</span></div>
  `;
}

function buildLandingNewsPanel(stock) {
  const items = (stock.news || []).slice(0, 3);
  if (!items.length) {
    return '<p style="color:#aab4c8;font-size:13px;line-height:1.5;margin:0;">No recent headlines for this name.</p>';
  }
  return items.map(item => `
    <div class="news-item" style="flex-direction:column;align-items:stretch;justify-content:flex-start;gap:8px;">
      <div class="kw-tag" style="align-self:flex-start;padding:4px 8px;border-radius:999px;background:${item.sentiment === 'POSITIVE' ? '#14532d' : item.sentiment === 'NEGATIVE' ? '#7f1d1d' : '#334155'};color:${item.sentiment === 'POSITIVE' ? '#86efac' : item.sentiment === 'NEGATIVE' ? '#fecaca' : '#cbd5e1'};font-size:11px;font-family:monospace;">${item.sentiment}</div>
      <p class="headline" style="margin:0;">${item.headline}</p>
      <div class="news-meta" style="width:100%;justify-content:space-between;"><span>${item.source}</span><span>${item.time}</span></div>
    </div>
  `).join('');
}

function buildLandingAiPanel(stock) {
  const { F, T, N, G } = stock.breakdown;
  const label = (stock.label || '').toUpperCase();
  let body = '';
  if (label.includes('CONFLICTED') || label.includes('NEUTRAL')) {
    body = `Fusion is pulling in different directions: fundamentals score ${F >= 0 ? '+' : ''}${F.toFixed(2)} and news ${N >= 0 ? '+' : ''}${N.toFixed(2)}, while technicals read ${T >= 0 ? '+' : ''}${T.toFixed(2)} and global risk ${G >= 0 ? '+' : ''}${G.toFixed(2)}. That mismatch usually means chop until one pillar clearly leads—size for two-way tape and watch whether global headlines or earnings revisions move first.`;
  } else if (label.includes('BULLISH')) {
    body = `The stack is mostly aligned with a constructive view: fundamentals ${F >= 0 ? '+' : ''}${F.toFixed(2)}, technicals ${T >= 0 ? '+' : ''}${T.toFixed(2)}, and news flow ${N >= 0 ? '+' : ''}${N.toFixed(2)} reinforce each other, with only global (${G >= 0 ? '+' : ''}${G.toFixed(2)}) acting as the main spoiler. Treat dips as noise unless global breaks worse—confirmation is when news and price action keep scoring together.`;
  } else if (label.includes('BEARISH')) {
    body = `Pressure is broad: fundamentals ${F >= 0 ? '+' : ''}${F.toFixed(2)}, tape ${T >= 0 ? '+' : ''}${T.toFixed(2)}, and headlines ${N >= 0 ? '+' : ''}${N.toFixed(2)} skew soft while global stress ${G >= 0 ? '+' : ''}${G.toFixed(2)} adds fuel. Bounces are likely fragile until at least one pillar stops deteriorating—use strength to reduce, not to chase.`;
  } else {
    body = `Blend of inputs: F ${F >= 0 ? '+' : ''}${F.toFixed(2)}, T ${T >= 0 ? '+' : ''}${T.toFixed(2)}, N ${N >= 0 ? '+' : ''}${N.toFixed(2)}, G ${G >= 0 ? '+' : ''}${G.toFixed(2)}. The model reads this as a nuanced setup—neither clean breakout nor clean breakdown—so confirmation from the next two sessions of price + news matters more than the point estimate alone.`;
  }
  return `<div class="ai-explainer" style="margin-top:0;"><p style="margin:0;font-size:13px;line-height:1.55;color:#e2e8f0;">${body}</p></div>`;
}

function buildLandingOverallPanel(stock) {
  const bars = [
    { label: 'Fundamental', value: stock.breakdown.F },
    { label: 'Technical', value: stock.breakdown.T },
    { label: 'News', value: stock.breakdown.N },
    { label: 'Global', value: stock.breakdown.G },
  ];
  return `<div class="signal-bars">${bars.map(b => buildLandingSignalBarHTML(b.label, b.value)).join('')}</div>`;
}

function syncLandingDetailTabs() {
  const root = document.getElementById('right-signal-panel');
  if (!root) return;
  root.querySelectorAll('[data-action="landing-detail-tab"]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === landingDetailTab);
  });
  Object.keys(LANDING_DETAIL_TAB_IDS).forEach(tab => {
    const el = document.getElementById(LANDING_DETAIL_TAB_IDS[tab]);
    if (!el) return;
    const on = tab === landingDetailTab;
    el.classList.toggle('active', on);
    el.classList.toggle('hidden', !on);
  });
}

function buildLandingSignalBarHTML(fullLabel, value) {
  const isPositive = value >= 0;
  const fillPercent = Math.min(50, Math.abs(value) * 50);
  const color = isPositive ? '#4ade80' : '#f87171';
  const left = isPositive ? 50 : 50 - fillPercent;
  const sign = value > 0 ? '+' : '';
  return `
    <div style="margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="color:#94a3b8;font-size:12px;font-family:monospace;">${fullLabel}</span>
        <span style="font-size:12px;font-family:monospace;color:${color};font-weight:500;">${sign}${value.toFixed(2)}</span>
      </div>
      <div style="position:relative;height:6px;background:#1e1e2e;border-radius:3px;">
        <div style="position:absolute;left:50%;top:0;width:1px;height:100%;background:#333;"></div>
        <div style="position:absolute;top:0;height:100%;border-radius:3px;background:${color};width:${fillPercent}%;left:${left}%;transition:all 0.4s ease;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:3px;">
        <span style="color:#444;font-size:10px;font-family:monospace;">-1</span>
        <span style="color:#444;font-size:10px;font-family:monospace;">0</span>
        <span style="color:#444;font-size:10px;font-family:monospace;">+1</span>
      </div>
    </div>
  `;
}

function renderLandingRightPanel() {
  const panelWrap = document.querySelector('#right-signal-panel .panel-content-wrap');
  if (!panelWrap) {
    console.warn('landing panel not found');
    return;
  }

  let html = '';

  if (landingSidebarMode === 'list') {
    if (!landingSectorListUnlocked) {
      html = buildSectorOverviewHTML();
    } else if (!selectedSector) {
      html = `<div class="tab-content-container" style="min-height:120px;justify-content:center;"><p style="text-align:center;color:#aab4c8;font-size:13px;margin:0;">Select a sector to see top stocks.</p></div>`;
    } else {
      const stocks = sectorStocks[selectedSector] || [];
      html = `
        <div class="tab-content-container" style="gap:0;padding-bottom:4px;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:12px;">
          <div style="font-size:11px;font-family:monospace;color:#aab4c8;text-transform:uppercase;letter-spacing:0.08em;">TOP STOCKS</div>
          <div style="font-size:16px;color:#fff;font-family:monospace;margin-top:8px;font-weight:600;line-height:1.2;">${selectedSector}</div>
        </div>
        <div class="tab-content-container" style="gap:0;min-height:0;">${stocks.map(buildLandingStockRow).join('')}</div>
      `;
    }
  } else if (landingSidebarMode === 'detail' && landingSelectedStock) {
    const stock = landingSelectedStock;
    const badge = getBadgeStyles(stock.label);
    const scoreColor = getScoreColor(stock.score);
    const scoreFill = Math.min(50, Math.abs(stock.score) * 50);
    const scoreLeft = stock.score >= 0 ? 50 : 50 - scoreFill;
    const tabs = ['Overall', 'Fundamental', 'Technical', 'News', 'AI'];
    const tabButtons = tabs.map(tab => `
      <button type="button" class="sub-tab${landingDetailTab === tab ? ' active' : ''}" data-action="landing-detail-tab" data-tab="${tab}">${tab}</button>
    `).join('');

    const overallBody = buildLandingOverallPanel(stock);
    const fundBody = buildLandingFundamentalPanel(stock);
    const techBody = buildLandingTechnicalPanel(stock);
    const newsBody = buildLandingNewsPanel(stock);
    const aiBody = buildLandingAiPanel(stock);

    html = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.08);width:100%;min-width:0;">
        <button type="button" data-action="landing-back" style="background:none;border:none;color:#aab4c8;font-size:18px;cursor:pointer;padding:0;line-height:1;flex-shrink:0;">←</button>
        <div style="flex:1;min-width:0;text-align:center;color:#fff;font-size:15px;font-weight:700;font-family:monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${stock.name}</div>
        <div style="padding:4px 8px;border-radius:999px;background:${badge.background};color:${badge.color};font-size:10px;white-space:nowrap;flex-shrink:1;max-width:110px;overflow:hidden;text-overflow:ellipsis;border:1px solid ${badge.color};">${stock.label}</div>
      </div>
      <div style="margin-top:16px;width:100%;min-width:0;">
        <div style="display:flex;justify-content:space-between;font-size:12px;color:#aab4c8;font-family:monospace;margin-bottom:8px;">
          <span>FUSION SCORE</span>
          <span style="color:${scoreColor};font-weight:600;">${stock.score >= 0 ? '+' : ''}${stock.score.toFixed(2)}</span>
        </div>
        <div style="position:relative;height:6px;background:#1e1e2e;border-radius:999px;">
          <div style="position:absolute;left:50%;top:0;width:1px;height:100%;background:#333;transform:translateX(-50%);"></div>
          <div style="position:absolute;top:0;height:100%;width:${scoreFill}%;left:${scoreLeft}%;background:${scoreColor};border-radius:999px;transition:all 0.4s ease;"></div>
        </div>
      </div>
      <div style="height:1px;background:rgba(255,255,255,0.08);margin:8px 0;"></div>
      <div class="analysis-tabs" style="margin-top:0;margin-bottom:12px;flex-wrap:nowrap;overflow-x:auto;">${tabButtons}</div>
      <div class="tab-content-container" id="landing-detail-tab-root" style="min-height:120px;">
        <div id="panel-landing-overall" class="sub-panel${landingDetailTab === 'Overall' ? ' active' : ''}${landingDetailTab === 'Overall' ? '' : ' hidden'}">${overallBody}</div>
        <div id="panel-landing-fundamental" class="sub-panel${landingDetailTab === 'Fundamental' ? ' active' : ''}${landingDetailTab === 'Fundamental' ? '' : ' hidden'}">${fundBody}</div>
        <div id="panel-landing-technical" class="sub-panel${landingDetailTab === 'Technical' ? ' active' : ''}${landingDetailTab === 'Technical' ? '' : ' hidden'}">${techBody}</div>
        <div id="panel-landing-news" class="sub-panel${landingDetailTab === 'News' ? ' active' : ''}${landingDetailTab === 'News' ? '' : ' hidden'}">${newsBody}</div>
        <div id="panel-landing-ai" class="sub-panel${landingDetailTab === 'AI' ? ' active' : ''}${landingDetailTab === 'AI' ? '' : ' hidden'}">${aiBody}</div>
      </div>
    `;
  } else {
    html = buildSectorOverviewHTML();
  }

  let landingDynamic = document.getElementById('landing-dynamic-content');
  if (!landingDynamic) {
    landingDynamic = document.createElement('div');
    landingDynamic.id = 'landing-dynamic-content';
    panelWrap.insertBefore(landingDynamic, panelWrap.firstChild);
  }
  landingDynamic.style.cssText = 'width:100%;min-width:0;display:flex;flex-direction:column;align-items:stretch;gap:0;';
  landingDynamic.innerHTML = html;
  if (landingSidebarMode === 'detail' && landingSelectedStock) {
    syncLandingDetailTabs();
  }
}

function handleLandingRightPanelClick(event) {
  const stockRow = event.target.closest('[data-action="landing-select-stock"]');
  if (stockRow) {
    const ticker = stockRow.dataset.ticker;
    if (selectedSector && sectorStocks[selectedSector]) {
      const stock = sectorStocks[selectedSector].find(s => s.ticker === ticker);
      if (stock) setLandingStock(stock);
    }
    return;
  }
  const back = event.target.closest('[data-action="landing-back"]');
  if (back) {
    landingSelectedStock = null;
    landingSidebarMode = 'list';
    landingDetailTab = 'Overall';
    renderLandingRightPanel();
    return;
  }
  const tabBtn = event.target.closest('[data-action="landing-detail-tab"]');
  if (tabBtn) {
    landingDetailTab = tabBtn.dataset.tab;
    syncLandingDetailTabs();
    return;
  }
}

function getCountryName(feature) {
  return feature?.properties?.name || feature?.properties?.NAME || feature?.properties?.ADMIN || feature?.properties?.admin || null;
}

// Morph Projection (Sphere -> Flat)
function projectMorph(lng, lat, progress, centerLng) {
  // FLAT target (Mercator, adjusted for SVG viewport)
  const xf = (lng + 180) * (1000 / 360) * 0.95 + 10;
  const latRad = lat * Math.PI / 180;
  const mercN = Math.log(Math.tan((Math.PI / 4) + (latRad / 2)));
  const yf = Math.max(-1000, Math.min(1500, (650 / 2) - (1000 * mercN / (2 * Math.PI)))) * 1.1 - 40;

  // SPHERE target (Orthographic)
  const R = 300; 
  let dLng = lng - centerLng;
  while (dLng > 180) dLng -= 360;
  while (dLng < -180) dLng += 360;
  let rLng = dLng * Math.PI / 180;

  // Fold back-face to avoid messy crisscrosses at start
  if (progress < 0.05 && Math.cos(rLng) < 0) {
      rLng = Math.sign(rLng) * Math.PI/2; 
  } else if (progress < 1) {
      if (Math.cos(rLng) < 0) {
         const edgeLng = Math.sign(rLng) * Math.PI/2;
         rLng = edgeLng + (rLng - edgeLng) * Math.pow(progress, 0.4); 
      }
  }
  
  const xs = 500 + R * Math.cos(latRad) * Math.sin(rLng);
  // Subtract Y due to SVG coordinates being flipped vs Cartesian
  const ys = 325 - R * Math.sin(latRad);

  // Easing curve (smooth step) - quicker mid-section for punchier feel
  const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

  const x = xs + (xf - xs) * ease;
  const y = ys + (yf - ys) * ease;
  return [x.toFixed(1), y.toFixed(1)];
}

function updateMapMorph(progress) {
  for(let i=0; i<pathNodes.length; i++) {
     let f = pathNodes[i].feature;
     let d = '';
     if (!f.geometry || !f.geometry.coordinates) continue;
     
     if (f.geometry.type === 'Polygon') {
        d += 'M ';
        f.geometry.coordinates[0].forEach((pt, idx) => {
           const [x,y] = projectMorph(pt[0], pt[1], progress, capturedCenterLng);
           d += `${x},${y} ${idx === f.geometry.coordinates[0].length-1 ? 'Z' : 'L '}`;
        });
     } else if (f.geometry.type === 'MultiPolygon') {
        f.geometry.coordinates.forEach(poly => {
           d += ' M ';
           poly[0].forEach((pt, idx) => {
              const [x,y] = projectMorph(pt[0], pt[1], progress, capturedCenterLng);
              d += `${x},${y} ${idx === poly[0].length-1 ? 'Z' : 'L '}`;
           });
        });
     }
     pathNodes[i].node.setAttribute('d', d);
  }
}

function renderFlatMap(features) {
  const mapContainer = document.getElementById('svg-map-container');
  if(!mapContainer) return;
  
  // Add a defs section for the 3D bevel/gradient effect on the paths
  const svgHeader = `<svg class="flat-map-svg" viewBox="0 0 1000 650" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
    <defs>
      <filter id="bevel3d" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="3" dy="5" stdDeviation="4" flood-color="#000000" flood-opacity="0.8"/>
        <feComponentTransfer><feFuncA type="linear" slope="0.5"/></feComponentTransfer>
      </filter>
      <radialGradient id="oceanGlow" cx="50%" cy="50%" r="50%">
        <stop offset="60%" stop-color="rgba(10,14,20,0)"/>
        <stop offset="100%" stop-color="rgba(255,255,255,0.02)"/>
      </radialGradient>
    </defs>
    <!-- Background circle that mimics the globe's ocean when progress=0 -->
    <circle id="ocean-bg" cx="500" cy="325" r="300" fill="url(#oceanGlow)" opacity="1"/>
  `;
  let svgPaths = '';
  
  features.forEach((f, idx) => {
    if (!f.geometry || !f.geometry.coordinates) return;
    const name = getCountryName(f);
    const entry = getTensionByName(name);
    const baseColor = entry ? getTensionColor(entry.score) : (countryColors[f.properties.NAME] || countryColors[f.properties.ADMIN]);
    const fill = baseColor ? baseColor : 'rgba(200, 200, 200, 0.08)';
    // Removed the slow SVG filter="url(#bevel3d)" entirely from paths. 
    svgPaths += `<path id="path-geo-${idx}" class="map-country" fill="${fill}" data-country="${name || f.properties.NAME}"></path>`;
  });
  
  mapContainer.innerHTML = svgHeader + svgPaths + '</svg>';
  
  // Cache for performance
  pathNodes = [];
  features.forEach((f, idx) => {
    if (!f.geometry || !f.geometry.coordinates) return;
    const node = document.getElementById(`path-geo-${idx}`);
    if (node) pathNodes.push({ node, feature: f });
  });
  
  // Interactivity
  document.querySelectorAll('.map-country').forEach(p => {
    p.addEventListener('click', (e) => {
       // Mock UI update on click
       const cName = e.target.getAttribute('data-country') || 'ASSET';
       const title = document.getElementById('active-asset-title');
       if (title) {
           title.innerHTML = cName.substring(0, 10).toUpperCase() + ` <span style="opacity:0.4; font-size:10px;">/ USD</span>`;
       }
       generateChartData();
    });
    // Removed hardcoded pointerEvents here. We handle it in animateUnroll.
  });
  
  // Initially map is transparent
  mapContainer.style.opacity = '0';
  updateMapMorph(0);
}

fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
  .then(res => res.json())
  .then(async data => {
    const topojson = await import('topojson-client');
    const geojson = topojson.feature(data, data.objects.countries);
    countriesGeo = geojson.features;
    globeFeatures = countriesGeo;

    world.polygonsData(countriesGeo)
      .polygonAltitude(d => d === hoverD ? 0.06 : 0.01)
      .polygonCapColor(d => {
        const name = getCountryName(d);
        const entry = getTensionByName(name);
        const iso = getCountryISO(d);
        const isSelected = selectedCountry && selectedCountry.name === name;
        if (d === hoverD) return entry ? getTensionColor(entry.score) + 'aa' : 'rgba(58, 125, 68, 0.42)';
        if (isSelected) return entry ? getTensionColor(entry.score) + 'cc' : 'rgba(58, 125, 68, 0.28)';
        // Sector-based highlighting
        if (selectedSector && sectorCountryMap[selectedSector]) {
          const relevantIsos = sectorCountryMap[selectedSector];
          if (iso && relevantIsos.includes(iso)) {
            return entry ? getTensionColor(entry.score) + 'cc' : 'rgba(58, 125, 68, 0.52)';
          }
          return 'rgba(255,255,255,0.02)';
        }
        return entry ? getTensionColor(entry.score) + '44' : 'rgba(255,255,255,0.03)';
      })
      .polygonSideColor(() => 'rgba(255, 255, 255, 0.05)')
      .polygonStrokeColor(() => '#2a2a3a')
      .polygonLabel(d => {
        const name = getCountryName(d);
        const entry = getTensionByName(name);
        if (!entry) return '';
        return `
          <div style="background:#111827; border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:10px 12px; color:white; font-family:Inter,sans-serif; font-size:12px; min-width:160px;">
            <div style="font-weight:600; margin-bottom:6px;">${entry.name}</div>
            <div style="color:#f59e0b; margin-bottom:6px;">Tension: ${entry.score}/100</div>
            <div style="color:#9ca3af; font-size:11px;">${entry.commodities.join(' · ')}</div>
          </div>`;
      })
      .onPolygonHover(d => {
        hoverD = d;
        world.polygonCapColor(world.polygonCapColor());
        world.polygonAltitude(world.polygonAltitude());
      })
      .onPolygonClick(d => {
        const name = getCountryName(d);
        const entry = getTensionByName(name);
        if (!entry) return;
        setSelectedCountry(entry);
        showGeoView();
      });

    // Point interaction
    world.onPointClick(d => {
       world.pointOfView({ lat: d.lat, lng: d.lng, altitude: 1 }, 1000);
       generateChartData(); // Mock signal data change
    });
      
    // Render the SPA flat map version
    renderFlatMap(globeFeatures);
  });

// Auto-rotate globe
world.controls().autoRotate = true;
world.controls().autoRotateSpeed = 0.5;

// Prevent zooming for SPA layout consistency
world.controls().enableZoom = false;

// Custom SPA scroll transitions: Unrolling the Earth
let activeView = 'earth';
let targetProgress = 0;
let currentProgress = 0;
let lastComputedAnim = -1; // Cache tracker to prevent infinite CPU rendering

lenis.on('scroll', (e) => {
  const h = window.innerHeight;
  let progress = e.scroll / h; 
  if (progress > 1) progress = 1;
  if (progress < 0) progress = 0;
  targetProgress = progress;
  
  // Top nav active state sync immediately
  if(progress > 0.5 && activeView !== 'geo'){
    activeView = 'geo';
    document.querySelectorAll('.top-nav .tab').forEach(t=>t.classList.remove('active'));
    const b = document.querySelector('.top-nav .tab[data-target="geo"]');
    if(b) b.classList.add('active');
  } else if (progress <= 0.5 && activeView !== 'earth') {
    activeView = 'earth';
    document.querySelectorAll('.top-nav .tab').forEach(t=>t.classList.remove('active'));
    const b = document.querySelector('.top-nav .tab[data-target="earth"]');
    if(b) b.classList.add('active');
  }
});

// Decoupled Animation Loop for silky smooth unfolding
function animateUnroll() {
  if (Math.abs(targetProgress - currentProgress) > 0.001) {
      // Much faster catch-up so it feels tightly bound to the mouse wheel
      currentProgress += (targetProgress - currentProgress) * 0.35;
  } else {
      currentProgress = targetProgress;
  }
  
  // Accelerate the visual unroll so it finishes by ~75% of the scroll down
  let computedAnim = currentProgress * 1.35;
  if (computedAnim > 1) computedAnim = 1;

  const svgMap = document.getElementById('svg-map-container');
  const globeCanvas = document.getElementById('globeViz');
  
  if (computedAnim > 0 && capturedCenterLng === 0) {
      capturedCenterLng = world.pointOfView().lng || 0;
      world.controls().autoRotate = false;
  }
  if (computedAnim <= 0) {
      world.controls().autoRotate = true;
      capturedCenterLng = 0; 
  }
  
  // Removed altitude zooming so the globe remains perfectly static during the crossfade
  // Optical illusion crossfade
  const crossfadeRange = 0.25; // Blend over slightly more scroll for butter smoothness
  let gOp = 1 - (computedAnim / crossfadeRange);
  let sOp = computedAnim / (crossfadeRange * 0.5); 
  
  if (gOp < 0) gOp = 0;
  if (sOp > 1) sOp = 1;
  
  if(globeCanvas && globeCanvas.style.opacity !== gOp.toFixed(3)) globeCanvas.style.opacity = gOp.toFixed(3);
  if(svgMap && svgMap.style.opacity !== sOp.toFixed(3)) svgMap.style.opacity = sOp.toFixed(3);
  
  // Perform the intense recalculation ONLY if state changed!
  if (computedAnim !== lastComputedAnim) {
      if (computedAnim > 0 && pathNodes.length > 0) {
         updateMapMorph(computedAnim);
         
         const oceanBg = document.getElementById('ocean-bg');
         if (oceanBg) {
            oceanBg.setAttribute('opacity', (1 - (computedAnim * 2)).toFixed(2));
         }
      }
      
      // Dynamic CSS hardware-accelerated DropShadow toggled only when completely flat
      if (svgMap) {
         if (computedAnim >= 1) {
            svgMap.style.filter = 'drop-shadow(2px 5px 6px rgba(0,0,0,0.4))';
         } else {
            svgMap.style.filter = 'none';
         }
         
         // Fix Invisible Hitbox Blocker:
         // The SVG paths MUST be unclickable when globe is visible, otherwise they block everything below them!
         if (sOp <= 0.02) {
            svgMap.style.visibility = 'hidden';
            svgMap.style.pointerEvents = 'none';
            const svgEl = svgMap.querySelector('svg');
            if(svgEl) svgEl.style.pointerEvents = 'none';
         } else {
            svgMap.style.visibility = 'visible';
            svgMap.style.pointerEvents = 'auto';
            const svgEl = svgMap.querySelector('svg');
            if(svgEl) svgEl.style.pointerEvents = 'auto';
            document.querySelectorAll('.map-country').forEach(p => p.style.pointerEvents = 'auto');
         }
      }
      lastComputedAnim = computedAnim;
  }

  // Panels stay open — user controls minimize manually via the button

  // Smoothly remove bottom news line
  const bottomPanel = document.getElementById('earth-footer');
  if (bottomPanel) {
     bottomPanel.style.transition = 'transform 0.4s ease, opacity 0.4s ease';
     if (computedAnim > 0.05) {
         bottomPanel.style.transform = 'translateY(100px)';
         bottomPanel.style.opacity = '0';
         bottomPanel.style.pointerEvents = 'none';
     } else {
         bottomPanel.style.transform = 'translateY(0px)';
         bottomPanel.style.opacity = '1';
         bottomPanel.style.pointerEvents = 'auto'; // allow clicking if there were links
     }
  }

  requestAnimationFrame(animateUnroll);
}
requestAnimationFrame(animateUnroll);

// Handle window resize for globe
window.addEventListener('resize', () => {
  world.width(window.innerWidth);
  world.height(window.innerHeight);
});


// 4. Initial GSAP Animations
const tl = gsap.timeline();

// Fade in header
tl.from('.top-nav', { y: -50, opacity: 0, duration: 0.8, ease: "power3.out" })
  // Slide in left panel
  .from('.slide-in-left', { x: -50, opacity: 0, duration: 0.6, ease: "power2.out"}, "-=0.4")
  // Slide in right panel
  .from('.slide-in-right', { x: 50, opacity: 0, duration: 0.6, ease: "power2.out"}, "-=0.4")
  // Slide up bottom panel
  .from('.bottom-panel', { y: 50, opacity: 0, duration: 0.6, ease: "power2.out"}, "-=0.4")
  .from('.gti-box', { opacity: 0, y: -10, duration: 0.4 }, '-=0.2')
  .from('#gti-sparkline', { opacity: 0, duration: 0.5 }, '-=0.2')
  .from('.region-grid', { opacity: 0, y: 10, duration: 0.4 }, '-=0.3')
  .from('.scenario-block', { opacity: 0, y: 10, duration: 0.3, stagger: 0.1 }, '-=0.2')
  .from('.signal-bars', { opacity: 0, duration: 0.4 }, '-=0.2');


// Manual Minimization logic for Left Panel
const leftMinBtn = document.getElementById('minimize-left-btn');
const leftFilterPanel = document.getElementById('left-filter-panel');
let userManuallyClosed = false; // Guard: prevents RAF loop from overriding manual clicks
let hasPageScrolled = false;

window.addEventListener('scroll', () => {
  hasPageScrolled = window.scrollY > 10;
});

function openPanel(panel, button) {
  if (!panel) return;
  panel.classList.remove('minimized');
  if (button) {
    const icon = button.querySelector('svg');
    if (icon) icon.style.transform = 'rotate(0deg)';
  }
}

function togglePanel(panel, button) {
  if (!panel) return;
  panel.classList.toggle('minimized');
  if (button) {
    const icon = button.querySelector('svg');
    if (icon) icon.style.transform = panel.classList.contains('minimized') ? 'rotate(180deg)' : 'rotate(0deg)';
  }
}

if (leftFilterPanel && leftMinBtn) {
  openPanel(leftFilterPanel, leftMinBtn);
  leftMinBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    userManuallyClosed = !leftFilterPanel.classList.contains('minimized'); // will be closed after toggle
    togglePanel(leftFilterPanel, leftMinBtn);
  });
}

const rightMinBtn = document.getElementById('minimize-right-btn');
const rightSignalPanel = document.getElementById('right-signal-panel');
let userManuallyClosedRight = false;

if (rightSignalPanel && rightMinBtn) {
  openPanel(rightSignalPanel, rightMinBtn);
  rightMinBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    userManuallyClosedRight = !rightSignalPanel.classList.contains('minimized');
    togglePanel(rightSignalPanel, rightMinBtn);
  });
}

// Tabs logic for Signal Card
const subTabs = document.querySelectorAll('.sub-tab');
subTabs.forEach(tab => {
  tab.addEventListener('click', (e) => {
    // remove active from all subtabs
    subTabs.forEach(t => t.classList.remove('active'));
    // hide all sub panels
    document.querySelectorAll('.sub-panel').forEach(p => {
       p.classList.remove('active');
       p.classList.add('hidden');
    });

    // add active to clicked tab
    const target = e.target;
    target.classList.add('active');

    // show target panel
    const panelId = target.getAttribute('data-panel');
    const panel = document.getElementById('panel-' + panelId);
    panel.classList.remove('hidden');
    panel.classList.add('active');
  });
});

// Sector List interactions
const sectorListItems = document.querySelectorAll('.sector-list li:not(.disabled)');
sectorListItems.forEach(li => {
  li.addEventListener('click', () => {
    document.querySelectorAll('.sector-list li').forEach(l => l.classList.remove('active'));
    li.classList.add('active');
    const selected = li.dataset.sector || li.textContent.trim().split(' ')[0];
    setSelectedSector(selected);
    gsap.from('.stock-list', { opacity: 0.5, y: 5, duration: 0.3 });
  });
});

function getRegimeLabel() {
  const regimeStat = Array.from(document.querySelectorAll('.stat')).find(stat => {
    const label = stat.querySelector('.label');
    return label?.textContent.trim().toUpperCase() === 'REGIME:';
  });
  return regimeStat?.querySelector('.value')?.textContent.trim() || 'FED POLICY DAY';
}

function formatSignalValue(value) {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
}

function buildSignalBarHTML(fullLabel, value) {
  const isPositive = value >= 0;
  const fillPercent = Math.min(50, Math.abs(value) * 50);
  const color = isPositive ? '#4ade80' : '#f87171';
  const left = isPositive ? 50 : 50 - fillPercent;

  return `
    <div class="signal-bar-row">
      <div class="signal-bar-header">
        <span>${fullLabel}</span>
        <span class="signal-bar-value" style="color:${color};">${formatSignalValue(value)}</span>
      </div>
      <div class="signal-bar-track">
        <div class="signal-bar-center"></div>
        <div class="signal-bar-fill" style="width:${fillPercent}%; left:${left}%; background:${color};"></div>
      </div>
      <div class="signal-bar-scale">
        <span>-1</span>
        <span>0</span>
        <span>+1</span>
      </div>
    </div>
  `;
}

function renderSignalBars(result) {
  const container = document.getElementById('signal-bars-container');
  if (!container || !result || !result.breakdown) return;

  const bars = [
    { fullLabel: 'Fundamental', value: result.breakdown.F },
    { fullLabel: 'Technical', value: result.breakdown.T },
    { fullLabel: 'News', value: result.breakdown.N },
    { fullLabel: 'Global', value: result.breakdown.G },
  ];

  container.innerHTML = bars.map(bar => buildSignalBarHTML(bar.fullLabel, bar.value)).join('');
}

const fusionInputs = {
  HDFCBANK: {
    fundamentalData: { pe: 12.5, sectorPE: 18, roe: 16.5, npa: 1.1, revenueGrowth: 12 },
    technicalData: { rsi: 66, priceVsWMA: 1.8, macd: -0.22, volumeTrend: -0.4 },
    newsItems: [
      { timestamp: new Date().toISOString(), sentiment: 'positive' },
      { timestamp: new Date(Date.now() - 5 * 3600000).toISOString(), sentiment: 'neutral' }
    ]
  },
  SBIN: {
    fundamentalData: { pe: 9.8, sectorPE: 18, roe: 14.2, npa: 2.2, revenueGrowth: 8 },
    technicalData: { rsi: 58, priceVsWMA: -0.5, macd: 0.18, volumeTrend: 0.6 },
    newsItems: [
      { timestamp: new Date().toISOString(), sentiment: 'positive' },
      { timestamp: new Date(Date.now() - 14 * 3600000).toISOString(), sentiment: 'positive' }
    ]
  },
  ICICIBANK: {
    fundamentalData: { pe: 11.2, sectorPE: 18, roe: 15.8, npa: 1.4, revenueGrowth: 10 },
    technicalData: { rsi: 62, priceVsWMA: 0.9, macd: 0.05, volumeTrend: 0.2 },
    newsItems: [
      { timestamp: new Date().toISOString(), sentiment: 'neutral' },
      { timestamp: new Date(Date.now() - 28 * 3600000).toISOString(), sentiment: 'positive' }
    ]
  },
  AXISBANK: {
    fundamentalData: { pe: 13.9, sectorPE: 18, roe: 12.1, npa: 3.2, revenueGrowth: 6 },
    technicalData: { rsi: 72, priceVsWMA: 2.7, macd: -0.35, volumeTrend: -0.5 },
    newsItems: [
      { timestamp: new Date().toISOString(), sentiment: 'negative' },
      { timestamp: new Date(Date.now() - 8 * 3600000).toISOString(), sentiment: 'neutral' }
    ]
  }
};

function renderFusionSidebar(symbol) {
  const inputs = fusionInputs[symbol] || fusionInputs.HDFCBANK;
  const regimeLabel = getRegimeLabel();
  const result = calcFusionScore({
    ...inputs,
    regimeLabel,
  });

  const finalScoreEl = document.getElementById('final-score');
  const badgeEl = document.querySelector('.signal-tag');
  if (finalScoreEl) {
    finalScoreEl.textContent = result.score >= 0 ? `+${result.score.toFixed(2)}` : result.score.toFixed(2);
  }
  if (badgeEl) {
    badgeEl.textContent = result.label;
    badgeEl.style.color = result.color;
    badgeEl.style.borderColor = result.color;
    badgeEl.style.background = `${result.color}22`;
  }

  const panelFusionScore = document.getElementById('panel-fusion-score');
  if (panelFusionScore) {
    panelFusionScore.textContent = result.score >= 0 ? `+${result.score.toFixed(2)}` : result.score.toFixed(2);
  }

  renderSignalBars(result);
}

// Use Anime.js for hover effects on stock list
const stockItems = document.querySelectorAll('.stock-item');
stockItems.forEach(item => {
  item.addEventListener('mouseenter', () => {
    if(!item.classList.contains('active')) {
      anime({
        targets: item,
        translateX: 5,
        backgroundColor: 'rgba(255,255,255,0.1)',
        duration: 300,
        easing: 'easeOutSine'
      });
    }
  });
  item.addEventListener('mouseleave', () => {
    if(!item.classList.contains('active')) {
      anime({
        targets: item,
        translateX: 0,
        backgroundColor: 'rgba(0,0,0,0.2)',
        duration: 300,
        easing: 'easeOutSine'
      });
    }
  });

  // Click to change dummy text
  item.addEventListener('click', () => {
    stockItems.forEach(si => {
      si.classList.remove('active');
      anime({ targets: si, translateX: 0, backgroundColor: 'rgba(0,0,0,0.2)', duration: 200 });
    });
    item.classList.add('active');
    
    // Change main card title & update fusion score sidebar
    const symbol = item.getAttribute('data-stock');
    const currentStockEl = document.getElementById('current-stock');
    if (currentStockEl) currentStockEl.innerText = symbol;
    renderFusionSidebar(symbol);
    
    // Simple UI change animation on selection
    gsap.from('.main-signal-card', { opacity: 0.5, scale: 0.98, duration: 0.3, ease: "power1.out"});
  });
});

// Ticker continuous scroll animation with GSAP
gsap.to('.ticker-content', {
  xPercent: -50,
  ease: "none",
  duration: 20,
  repeat: -1
});

// showGeoView defined earlier in file (line ~208), no duplicate needed

// Top Nav Tabs interaction
const mainTabs = document.querySelectorAll('.top-nav .tab');
mainTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    mainTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    // Animate a brief flash or feedback
    gsap.fromTo(tab, 
      { backgroundColor: 'rgba(255,255,255,0.2)' },
      { backgroundColor: 'rgba(34, 197, 94, 0.1)', duration: 0.4 }
    );
    
    // SPA scrolling logic
    const target = tab.getAttribute('data-target');
    if (target === 'earth') lenis.scrollTo('#earth-view', { duration: 1.5 });
    if (target === 'geo') lenis.scrollTo('#geo-view', { duration: 1.5 });
  });
});

/* === GEO MAP CHART === */
const assetBaseData = {
  RUB: { base: 0.011, pct: '+0.00%', pair: '/ USD', color: 'green' },
  OIL: { base: 83.1, pct: '-0.88%', pair: '/ USOIL', color: 'red' },
  GOLD: { base: 2282.2, pct: '+1.51%', pair: '/ XAU', color: 'green' },
  GAS: { base: 3.19, pct: '-1.47%', pair: '/ NG', color: 'red' },
};

function generateCandles(basePrice, count = 60) {
  const candles = [];
  let price = basePrice;
  const now = Date.now();
  for (let i = count; i >= 0; i--) {
    const open = price;
    const change = (Math.random() - 0.49) * basePrice * 0.012;
    const close = Math.max(open + change, basePrice * 0.85);
    const high = Math.max(open, close) + Math.random() * basePrice * 0.005;
    const low = Math.min(open, close) - Math.random() * basePrice * 0.005;
    candles.push({ open, high, low, close, time: now - i * 3600000 });
    price = close;
  }
  return candles;
}

function drawCandlestickChart(canvasId, candles) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const padding = { top: 10, bottom: 10, left: 8, right: 8 };
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;

  const prices = candles.flatMap((c) => [c.high, c.low]);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const priceRange = maxP - minP || 1;

  const toY = (p) => padding.top + chartH - ((p - minP) / priceRange) * chartH;
  const candleW = Math.max(2, Math.floor(chartW / candles.length) - 1);
  const gap = Math.floor(chartW / candles.length);

  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(W - padding.right, y);
    ctx.stroke();
  }

  candles.forEach((c, i) => {
    const x = padding.left + i * gap + gap / 2;
    const isUp = c.close >= c.open;
    const color = isUp ? '#22c55e' : '#ef4444';
    const openY = toY(c.open);
    const closeY = toY(c.close);
    const highY = toY(c.high);
    const lowY = toY(c.low);

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, highY);
    ctx.lineTo(x, lowY);
    ctx.stroke();

    const bodyTop = Math.min(openY, closeY);
    const bodyH = Math.max(1, Math.abs(closeY - openY));
    ctx.fillStyle = color;
    ctx.fillRect(x - candleW / 2, bodyTop, candleW, bodyH);
  });

  const lastClose = candles[candles.length - 1].close;
  const lineY = toY(lastClose);
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(padding.left, lineY);
  ctx.lineTo(W - padding.right, lineY);
  ctx.stroke();
  ctx.setLineDash([]);

  return candles;
}

function updateOHLC(candles) {
  if (!candles || !candles.length) return;
  const last = candles[candles.length - 1];
  const ohlcOpen = document.getElementById('ohlc-open');
  const ohlcHigh = document.getElementById('ohlc-high');
  const ohlcLow = document.getElementById('ohlc-low');
  const ohlcClose = document.getElementById('ohlc-close');
  const fmt = (v) => (v < 1 ? v.toFixed(4) : v.toFixed(2));
  if (ohlcOpen) ohlcOpen.textContent = fmt(candles[0].open);
  if (ohlcHigh) ohlcHigh.textContent = fmt(Math.max(...candles.map((c) => c.high)));
  if (ohlcLow) ohlcLow.textContent = fmt(Math.min(...candles.map((c) => c.low)));
  if (ohlcClose) ohlcClose.textContent = fmt(last.close);
}

function loadAssetChart(asset) {
  const data = assetBaseData[asset] || assetBaseData.OIL;
  const candles = generateCandles(data.base);
  drawCandlestickChart('commodity-chart', candles);
  updateOHLC(candles);

  const titleEl = document.getElementById('active-asset-title');
  const indEl = document.getElementById('active-asset-indicator');
  if (titleEl) titleEl.innerHTML = `${asset} <span style="opacity:0.4;font-size:10px;">${data.pair}</span>`;
  if (indEl) {
    indEl.textContent = data.pct;
    indEl.className = 'c-indicator ' + data.color;
  }
}

function generateChartData() {
  const active = document.querySelector('.geo-right-panel .asset-card.active');
  const asset = active?.dataset?.asset || 'OIL';
  const data = assetBaseData[asset] || assetBaseData.OIL;
  const candles = generateCandles(data.base);
  drawCandlestickChart('commodity-chart', candles);
  updateOHLC(candles);
}

// GTI Sparkline
const sparkCanvas = document.getElementById('gti-sparkline');
if (sparkCanvas) {
  const sCtx = sparkCanvas.getContext('2d');
  const points = [58, 61, 59, 64, 63, 67, 65, 70, 68, 72, 69, 68];
  const w = sparkCanvas.width, h = sparkCanvas.height;
  const min = 50, max = 80;
  const toY = v => h - ((v - min) / (max - min)) * h;
  const toX = i => (i / (points.length - 1)) * w;

  sCtx.beginPath();
  points.forEach((p, i) => i === 0 ? sCtx.moveTo(toX(i), toY(p)) : sCtx.lineTo(toX(i), toY(p)));
  sCtx.strokeStyle = '#f59e0b';
  sCtx.lineWidth = 1.5;
  sCtx.stroke();

  // Fill under line
  sCtx.lineTo(w, h); sCtx.lineTo(0, h); sCtx.closePath();
  sCtx.fillStyle = 'rgba(245,158,11,0.12)';
  sCtx.fill();
}

// Scenario sliders
const oilSlider = document.getElementById('oil-slider');
const geoSlider = document.getElementById('geo-slider');
const rateSlider = document.getElementById('rate-slider');

function updateScenario(type, val) {
  const v = parseInt(val);
  if (type === 'oil') {
    document.getElementById('oil-val').textContent = v + '%';
    document.getElementById('oil-bar').style.width = v + '%';
  }
  if (type === 'geo') {
    document.getElementById('geo-val').textContent = v + '%';
    document.getElementById('geo-bar').style.width = v + '%';
    // Update GTI
    const gti = (60 + v * 0.4).toFixed(1);
    document.getElementById('gti-value').textContent = gti;
    document.getElementById('gti-delta').textContent = '+' + (v * 0.08).toFixed(1) + ' today';
    // Update severity label
    const sevEl = document.getElementById('gti-severity');
    if (v > 85) { sevEl.textContent = 'CRITICAL'; sevEl.style.color = '#ef4444'; sevEl.style.borderColor = 'rgba(239,68,68,0.3)'; sevEl.style.background = 'rgba(239,68,68,0.1)'; }
    else if (v > 50) { sevEl.textContent = 'ELEVATED'; sevEl.style.color = '#f59e0b'; sevEl.style.borderColor = 'rgba(245,158,11,0.25)'; sevEl.style.background = 'rgba(245,158,11,0.12)'; }
    else { sevEl.textContent = 'MODERATE'; sevEl.style.color = '#3b82f6'; sevEl.style.borderColor = 'rgba(59,130,246,0.25)'; sevEl.style.background = 'rgba(59,130,246,0.1)'; }
    // Update regime in nav
    if (v > 85) updateRegime('CRISIS MODE', 'red');
  }
  if (type === 'rate') {
    document.getElementById('rate-val').textContent = v + '%';
    document.getElementById('rate-bar').style.width = v + '%';
    if (v > 50) updateRegime('FED POLICY DAY', 'amber');
  }
}

function updateRegime(label, color) {
  const regimeEl = document.querySelector('.stat .value.amber, .stat .value.red, .stat .value.green');
  if (regimeEl) {
    regimeEl.textContent = label;
    // Keep standard classes + dynamic color class
    regimeEl.className = 'value ' + color;
  }
}

if (oilSlider) oilSlider.addEventListener('input', e => updateScenario('oil', e.target.value));
if (geoSlider) geoSlider.addEventListener('input', e => updateScenario('geo', e.target.value));
if (rateSlider) rateSlider.addEventListener('input', e => updateScenario('rate', e.target.value));

let activeRegion = 'all';

document.querySelectorAll('.region-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setSelectedRegion(btn.dataset.region);
  });
});
updateRegionButtons();

function finalizeAppInitialization() {
  renderLandingRightPanel();
  renderFusionSidebar('HDFCBANK');
  ensureGeoRightPanel();

  const landingRightPanelEl = document.getElementById('right-signal-panel');
  if (landingRightPanelEl && landingRightPanelEl.dataset.landingClickBound !== '1') {
    landingRightPanelEl.dataset.landingClickBound = '1';
    landingRightPanelEl.addEventListener('click', handleLandingRightPanelClick);
  }

  document.querySelectorAll('.asset-card').forEach((card) => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.asset-card').forEach((c) => c.classList.remove('active'));
      card.classList.add('active');
      const asset = card.dataset.asset;
      loadAssetChart(asset);
      gsap.from('.chart-header', { opacity: 0.5, y: 8, duration: 0.25 });
    });
  });

  setTimeout(() => {
    document.querySelectorAll('.asset-card').forEach((c) => c.classList.remove('active'));
    document.querySelector('.asset-card[data-asset="OIL"]')?.classList.add('active');
    loadAssetChart('OIL');
  }, 300);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', finalizeAppInitialization);
} else {
  finalizeAppInitialization();
}


