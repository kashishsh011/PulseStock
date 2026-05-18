# PulseStock — Multi-Signal Stock Scoring Engine for Indian Equities

> Most platforms give you a verdict. PulseStock shows you the reasoning.

A dynamic stock analysis engine that fuses fundamental valuation, technical momentum, news sentiment, and global macro regime detection into a single explainable output — built specifically for Indian equities (NSE/BSE).

---

## The Problem

Retail investors in India are underserved by existing tools:
- Static equal-weight scoring ignores that fundamentals dominate in a macro crisis, technicals matter more during earnings season
- No tool accounts for how a Fed rate hike or crude spike affects Indian bank stocks automatically
- Conflicting signals (fundamentals say BUY, RSI says overbought) get hidden — that's how retail investors lose money

---

## How It Works

```
DATA SOURCES
  yfinance · Finnhub WebSockets · ET RSS Feed · FRED API (VIX, DXY)
         │
         ▼
┌──────────────────────────────────────────────┐
│  Fundamental  │  Technical   │  Sentiment    │
│  Module       │  Module      │  Module       │
└───────────────┴──────────────┴───────────────┘
         │
         ▼
  ADAPTIVE FUSION LAYER — Regime Detection × Weight Adjustment
         │
         ▼
  Aligned Bullish / Aligned Bearish / Conflicted
```

### Fundamental Score
```
F = 0.4 × f(P/E) + 0.4 × f(ROE) + 0.2 × f(D/E)
```
Each metric normalised against sector median, clamped to [-1, +1].

**Live example — HDFC Bank:**
P/E = 18 vs sector 22 (+0.36) · ROE = 16.5% (+0.20) · D/E = 0.72 (+0.18) → **Final: +0.61 Aligned Bullish**

### Technical Score
```
T = 0.5 × RSI_signal + 0.5 × MA_signal → clamp(-1, +1)
```
RSI < 30 → +1.0 (oversold) · RSI > 70 → -1.0 (overbought) · Price vs 20-day WMA for momentum signal.

### News Sentiment
ET RSS headlines → keyword classifier → Gemini LLM fallback (~15% of ambiguous headlines) → per-article score cached by category.

### Global Regime Detection

| Regime | Condition | Weight Shift |
|--------|-----------|-------------|
| Crisis | VIX > 30, DXY > 105 | Fundamentals dominate |
| Fed Day | US10Y spike | High-beta penalized |
| Commodity Shock | Crude > $90 | FMCG/Auto penalized |
| Normal | VIX < 20 | Equal weights |

---

## SEBI Compliance

Output labels follow SEBI-safe language — never "Buy/Sell", always "Aligned Bullish/Bearish". The **Conflicted** state explicitly surfaces signal disagreement rather than forcing a verdict. *For educational purposes only. Not SEBI-registered investment advice.*

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | Vanilla JS, HTML/CSS, Vite |
| Visualization | Three.js, Globe.gl, TradingView Lightweight Charts |
| Animation | GSAP, Lenis, Anime.js |
| Backend | Python, FastAPI (scaffolded) |
| Data | Finnhub WebSockets, yfinance, FRED API, ET RSS |

---

## Current Status

Frontend complete — 3D globe (Three.js + Globe.gl), TradingView candlestick charts, and GSAP animations fully functional. Backend Python modules (`fundamental.py`, `regime.py`, `news/fetcher.py`) are built as empty scaffolds — logic implementation is Phase 1 of the roadmap below.

---

## Project Structure

```
PulseStock/
├── public/                 # Static assets (textures, icons)
├── modules/                # Python scoring engine
│   ├── fundamental.py      # P/E, ROE, D/E scoring
│   ├── regime.py           # Macro regime detection
│   ├── sentiment.py        # Sentiment aggregation
│   └── technical.py        # RSI + MA scoring
├── news/                   # NLP and RSS parsing
│   ├── fetcher.py          # ET RSS feed ingestion
│   └── keyword_dict.py     # Keyword → score mappings
├── pipeline/
│   └── fusion.py           # Adaptive fusion layer
├── scripts/
│   └── run_daily.py        # Cron job for daily scoring
├── src/                    # Frontend source
│   ├── main.js             # Core UI, 3D Globe, orchestration
│   ├── finnhub.js          # WebSocket integration
│   ├── tradeView.js        # Trading UI
│   ├── portfolioView.js    # Portfolio dashboard
│   └── style.css
├── tests/                  # Unit tests
├── index.html
├── package.json
└── requirements.txt
```

---

## Getting Started

```bash
git clone https://github.com/kashishsh011/PulseStock.git
cd PulseStock
npm install && npm run dev

# Python backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
```

---

## Roadmap

### Phase 1 — Backend Construction
- [ ] Build `fundamental.py` — P/E, ROE, D/E scoring via yfinance
- [ ] Build `regime.py` — live VIX, Crude, DXY, US10Y, USDINR from FRED API
- [ ] FastAPI server with CORS to serve scoring modules
- [ ] Populate `requirements.txt` (fastapi, uvicorn, yfinance, pandas)

### Phase 2 — Live Data & Deployment
- [ ] Move API keys to `.env` (Vite `import.meta.env`)
- [ ] Finalize Finnhub WebSocket for real-time prices
- [ ] Replace hardcoded `sectorStocks` JSON with live FastAPI calls
- [ ] MongoDB Atlas via motor — 15-minute TTL cache for scores
- [ ] Deploy backend on Render, frontend on Vercel

### Phase 3 — Intelligence Layer
- [ ] Gemini API — plain English explanation per stock score
- [ ] News sentiment pipeline via ET RSS in `news/fetcher.py`
- [ ] Expand to FMCG, Auto, Energy sectors
- [ ] Historical score tracking
- [ ] Backtest against 5 RBI rate decisions — validate directional accuracy

### Phase 4 — User Features
- [ ] Watchlist and stock tracking
- [ ] SIP calculator integrated with scoring engine
- [ ] Regime change alerts via email/WhatsApp
- [ ] Head-to-head stock comparison across all five signals

---

## Stocks Tracked

| Sector | Stocks |
|--------|--------|
| Banking | HDFC Bank, SBI, ICICI Bank, Axis Bank, Kotak Bank |
| IT | TCS, Infosys, Wipro, HCL Tech, Tech Mahindra |
| Pharma | Sun Pharma, Dr. Reddy's, Cipla, Divis Lab, Lupin |

---

## Author

**Kashish** — 2nd Year B.Tech CS + Applied Mathematics, VIPS-TC (GGSIPU), Delhi
[GitHub](https://github.com/kashishsh011) · [LinkedIn](https://linkedin.com/in/kashishwork011)
