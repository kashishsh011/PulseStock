import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { lenis } from './main.js';
import { mountLightweightCandlestickFromCanvas } from './lightweightCandleMount.js';
import { loadWatchlist } from './dataLoader.js';

/** Geo → Trade handoff context (mutable for future map integration). */
export const tradeContext = {
  country: 'Russia',
  commodity: 'Crude Oil',
  regime: 'Risk-Off',
  /** Hand-off target; merged with `BANKING_WATCHLIST` row on init when tickers match. */
  stock: {
    name: 'HDFC Bank',
    ticker: 'HDFCBANK',
    score: 0.16,
    label: 'CONFLICTED',
    breakdown: { F: 0.43, T: -0.14, N: 0.5, G: -0.3 },
  },
  indiaImpact: ['Banking margins under pressure', 'FII outflows', 'Rate differential risk'],
};

const COUNTRY_FLAGS = {
  Russia: '🇷🇺',
  'United States of America': '🇺🇸',
  China: '🇨🇳',
  India: '🇮🇳',
  Ukraine: '🇺🇦',
  Iran: '🇮🇷',
};

/** Same Banking rows as main.js `sectorStocks.Banking` (hardcoded copy — do not import main). */
// Fallback used until Supabase loads
const BANKING_WATCHLIST_FALLBACK = [
  { name: 'HDFC Bank', ticker: 'HDFCBANK', score: 0.16, label: 'CONFLICTED', breakdown: { F: 0.43, T: -0.14, N: 0.5, G: -0.3 }, mockPrice: 1655 },
  { name: 'SBI', ticker: 'SBIN', score: 0.42, label: 'BULLISH', breakdown: { F: 0.3, T: 0.25, N: 0.2, G: -0.1 }, mockPrice: 776 },
  { name: 'ICICI Bank', ticker: 'ICICIBANK', score: -0.21, label: 'BEARISH', breakdown: { F: -0.1, T: -0.3, N: -0.2, G: -0.3 }, mockPrice: 1096 },
  { name: 'Axis Bank', ticker: 'AXISBANK', score: 0.05, label: 'NEUTRAL', breakdown: { F: 0.1, T: 0.05, N: 0, G: -0.1 }, mockPrice: 1063 },
  { name: 'Kotak Bank', ticker: 'KOTAKBANK', score: 0.31, label: 'LEANING BULLISH', breakdown: { F: 0.4, T: 0.2, N: 0.3, G: -0.2 }, mockPrice: 1815 },
];

// This will be populated from Supabase on init
let BANKING_WATCHLIST = [...BANKING_WATCHLIST_FALLBACK];

function getBadgeClass(label) {
  const u = (label || '').toUpperCase();
  if (u.includes('BULLISH') && !u.includes('LEANING')) return 'trade-badge--bull';
  if (u.includes('LEANING BULLISH')) return 'trade-badge--lean-bull';
  if (u.includes('BEARISH')) return 'trade-badge--bear';
  if (u.includes('CONFLICTED')) return 'trade-badge--conflict';
  return 'trade-badge--neutral';
}

function getScoreColor(score) {
  return score >= 0 ? '#4ade80' : '#f87171';
}

function buildSignalBarHTML(fullLabel, value) {
  const isPositive = value >= 0;
  const fillPercent = Math.min(50, Math.abs(value) * 50);
  const color = isPositive ? '#4ade80' : '#f87171';
  const left = isPositive ? 50 : 50 - fillPercent;
  const sign = value > 0 ? '+' : '';
  return `
    <div class="trade-fusion-bar-row" style="margin-bottom:14px;">
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

function buildAiReasoning(stock) {
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

function computeRSI(closes, period = 14) {
  const rsiArr = new Array(closes.length).fill(null);
  if (closes.length < period + 1) {
    return closes.map(() => 50);
  }
  const changes = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    const ch = changes[i];
    if (ch >= 0) avgGain += ch;
    else avgLoss -= ch;
  }
  avgGain /= period;
  avgLoss /= period;

  const rs = () => (avgLoss === 0 ? 100 : avgGain / avgLoss);
  const toRsi = () => 100 - 100 / (1 + rs());

  rsiArr[period] = toRsi();
  for (let i = period; i < changes.length; i++) {
    const ch = changes[i];
    const gain = ch > 0 ? ch : 0;
    const loss = ch < 0 ? -ch : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsiArr[i + 1] = toRsi();
  }
  return closes.map((_, i) => {
    const v = rsiArr[i];
    return v == null ? 50 : Math.max(0, Math.min(100, v));
  });
}

function drawRsiLine(canvas, rsiValues) {
  if (!canvas || !rsiValues.length) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const pad = { l: 8, r: 8, t: 6, b: 6 };
  const cw = W - pad.l - pad.r;
  const ch = H - pad.t - pad.b;
  const toY = (r) => pad.t + ch - (r / 100) * ch;
  const toX = (i) => pad.l + (i / Math.max(1, rsiValues.length - 1)) * cw;

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 0.5;
  [30, 50, 70].forEach((lvl) => {
    const y = toY(lvl);
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(W - pad.r, y);
    ctx.stroke();
  });

  ctx.beginPath();
  rsiValues.forEach((r, i) => {
    const x = toX(i);
    const y = toY(r);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.25;
  ctx.stroke();
}

function updateTradeOHLC(candles) {
  if (!candles?.length) return;
  const last = candles[candles.length - 1];
  const fmt = (v) => (v < 1 ? v.toFixed(4) : v.toFixed(2));
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  set('trade-ohlc-open', fmt(candles[0].open));
  set('trade-ohlc-high', fmt(Math.max(...candles.map((c) => c.high))));
  set('trade-ohlc-low', fmt(Math.min(...candles.map((c) => c.low))));
  set('trade-ohlc-close', fmt(last.close));
}

function resizeTradeCanvases() {
  const lwDiv = document.getElementById('lw-chart-div-trade');
  const candleEl = document.getElementById('trade-candle-chart');
  const rsiEl = document.getElementById('trade-rsi-chart');
  const anchor = lwDiv || candleEl;
  if (!anchor || !rsiEl) return;
  const wrap = anchor.closest('.trade-chart-block');
  const w = Math.max(320, Math.floor(wrap?.clientWidth || 640));
  if (candleEl && !lwDiv) {
    candleEl.width = w;
    candleEl.height = 220;
    candleEl.style.width = '100%';
    candleEl.style.height = '220px';
  } else if (lwDiv) {
    lwDiv.style.width = '100%';
    lwDiv.style.height = '220px';
  }
  rsiEl.width = w;
  rsiEl.height = 72;
  rsiEl.style.width = '100%';
  rsiEl.style.height = '72px';
}

let state = {
  activeStock: null,
  candles: [],
  tradeSide: 'buy',
  orderType: 'market',
  lenis: null,
};

function renderFusionPanel(stock) {
  const barsEl = document.getElementById('trade-fusion-bars');
  const badgeEl = document.getElementById('trade-fusion-score-badge');
  const aiEl = document.getElementById('trade-ai-text');
  const riskEl = document.getElementById('trade-risk-list');
  if (!barsEl || !badgeEl || !aiEl || !riskEl) return;

  const bars = [
    { label: 'Fundamental', value: stock.breakdown.F },
    { label: 'Technical', value: stock.breakdown.T },
    { label: 'News', value: stock.breakdown.N },
    { label: 'Global', value: stock.breakdown.G },
  ];
  barsEl.innerHTML = `<div class="signal-bars">${bars.map((b) => buildSignalBarHTML(b.label, b.value)).join('')}</div>`;

  const sc = stock.score;
  const sign = sc > 0 ? '+' : '';
  badgeEl.textContent = `${sign}${sc.toFixed(2)}`;
  badgeEl.style.color = getScoreColor(sc);

  aiEl.innerHTML = buildAiReasoning(stock);

  const mag = Math.min(1, Math.abs(sc));
  const suggestedPct = Math.round(4 + mag * 11);
  const rr = (1.2 + Math.abs(stock.breakdown.T) * 1.5).toFixed(2);

  riskEl.innerHTML = `
    <li><span class="trade-risk-k">Max Drawdown</span><span class="trade-risk-v">15%</span></li>
    <li><span class="trade-risk-k">Suggested position size</span><span class="trade-risk-v">${suggestedPct}% of book (mock)</span></li>
    <li><span class="trade-risk-k">Risk / Reward</span><span class="trade-risk-v">1 : ${rr}</span></li>
  `;
}

function updateRibbonStock(stock) {
  const nameEl = document.getElementById('trade-ribbon-stock-name');
  const labelEl = document.getElementById('trade-ribbon-stock-label');
  if (nameEl) nameEl.textContent = stock.name;
  if (labelEl) {
    labelEl.textContent = stock.label;
    labelEl.className = `trade-badge trade-badge--ribbon ${getBadgeClass(stock.label)}`;
  }
}

function updateContextRibbon() {
  const flag = COUNTRY_FLAGS[tradeContext.country] || '🌐';
  const fEl = document.getElementById('trade-ribbon-flag');
  const cEl = document.getElementById('trade-ribbon-country');
  const coEl = document.getElementById('trade-ribbon-commodity');
  const rEl = document.getElementById('trade-ribbon-regime');
  const impactEl = document.getElementById('trade-ribbon-impact');
  if (fEl) fEl.textContent = flag;
  if (cEl) cEl.textContent = tradeContext.country;
  if (coEl) coEl.textContent = tradeContext.commodity;
  if (rEl) rEl.textContent = tradeContext.regime;
  if (impactEl) {
    impactEl.innerHTML = (tradeContext.indiaImpact || [])
      .map((t) => `<span class="trade-impact-pill mono">${t}</span>`)
      .join('');
  }
  updateRibbonStock(tradeContext.stock);
}

function renderWatchlist(activeTicker) {
  const ul = document.getElementById('trade-watchlist');
  if (!ul) return;
  ul.innerHTML = BANKING_WATCHLIST.map((s) => {
    const active = s.ticker === activeTicker;
    const col = getScoreColor(s.score);
    return `
      <li class="trade-wl-row${active ? ' active' : ''}" data-ticker="${s.ticker}">
        <span class="trade-wl-ticker mono">${s.ticker}</span>
        <span class="trade-wl-score mono" style="color:${col}">${s.score >= 0 ? '+' : ''}${s.score.toFixed(2)}</span>
        <span class="trade-badge ${getBadgeClass(s.label)}">${s.label}</span>
      </li>
    `;
  }).join('');
}

function selectStock(ticker, flashTicket = true) {
  const stock = BANKING_WATCHLIST.find((s) => s.ticker === ticker);
  if (!stock) return;
  state.activeStock = stock;

  renderWatchlist(ticker);
  updateRibbonStock(stock);
  tradeContext.stock = {
    name: stock.name,
    ticker: stock.ticker,
    score: stock.score,
    label: stock.label,
    breakdown: { ...stock.breakdown },
  };

  const titleEl = document.getElementById('trade-chart-title');
  const tickEl = document.getElementById('trade-chart-ticker');
  if (titleEl) titleEl.textContent = stock.name;
  if (tickEl) tickEl.textContent = stock.ticker;

  const tn = document.getElementById('trade-ticket-stock-name');
  const tt = document.getElementById('trade-ticket-ticker');
  if (tn) tn.textContent = stock.name;
  if (tt) tt.textContent = stock.ticker;

  resizeTradeCanvases();
  const candles = generateCandles(stock.mockPrice, 60);
  state.candles = mountLightweightCandlestickFromCanvas('trade-candle-chart', candles, 'lw-chart-div-trade');
  const closes = state.candles.map((c) => c.close);
  const rsi = computeRSI(closes, 14);
  drawRsiLine(document.getElementById('trade-rsi-chart'), rsi);
  updateTradeOHLC(state.candles);

  const last = state.candles[state.candles.length - 1];
  const priceEl = document.getElementById('trade-ticket-price');
  if (priceEl) priceEl.textContent = last.close < 1 ? last.close.toFixed(4) : last.close.toFixed(2);

  renderFusionPanel(stock);
  updateMarginDisplay();

  if (flashTicket) {
    gsap.fromTo(
      '#trade-order-ticket',
      { boxShadow: '0 0 0 rgba(34,197,94,0)' },
      {
        boxShadow: '0 0 28px rgba(34, 197, 94, 0.35)',
        duration: 0.35,
        yoyo: true,
        repeat: 1,
        ease: 'power2.out',
      }
    );
  }
}

function updateMarginDisplay() {
  const qtyEl = document.getElementById('trade-qty');
  const priceEl = document.getElementById('trade-ticket-price');
  const marginEl = document.getElementById('trade-margin-val');
  if (!qtyEl || !priceEl || !marginEl) return;
  const qty = Math.max(1, parseInt(qtyEl.value, 10) || 1);
  const price = parseFloat(String(priceEl.textContent).replace(/,/g, '')) || 0;
  const margin = qty * price * 0.2;
  marginEl.textContent = margin < 1 ? margin.toFixed(2) : `₹${margin.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function openSimulateModal() {
  const stock = state.activeStock;
  if (!stock) return;
  const side = state.tradeSide;
  const qtyEl = document.getElementById('trade-qty');
  const priceEl = document.getElementById('trade-ticket-price');
  const qty = Math.max(1, parseInt(qtyEl?.value, 10) || 1);
  const entry = parseFloat(String(priceEl?.textContent).replace(/,/g, '')) || 0;
  const label = (stock.label || '').toUpperCase();
  const bearish = label.includes('BEARISH');
  const bullish = label.includes('BULLISH') && !label.includes('LEANING');
  const leaningBull = label.includes('LEANING BULLISH');

  let directionNote = '';
  let projected = '';
  const arrow = stock.score >= 0 ? '↑' : '↓';
  const arrowClass = stock.score >= 0 ? 'trade-modal-up' : 'trade-modal-down';

  const aligned =
    (bearish && side === 'sell') ||
    (bullish && side === 'buy') ||
    (leaningBull && side === 'buy');

  if (aligned) {
    directionNote = '<p class="trade-modal-line trade-modal-ok"><strong>Signal-aligned trade</strong> — direction matches Fusion bias (educational mock).</p>';
    projected = `<p class="trade-modal-line">Projected scenario (mock): favorable drift vs. entry over the next 5 sessions, scaled by |score| ${Math.abs(stock.score).toFixed(2)}.</p>`;
  } else if ((bearish && side === 'buy') || (bullish && side === 'sell')) {
    directionNote = '<p class="trade-modal-line trade-modal-warn"><strong>Against the signal</strong> — higher friction in the mock engine.</p>';
    projected = '<p class="trade-modal-line">Projected scenario (mock): adverse path more likely until pillars realign.</p>';
  } else {
    directionNote = '<p class="trade-modal-line">Mixed / neutral regime — no clean edge in the mock.</p>';
    projected = '<p class="trade-modal-line">Projected scenario (mock): two-way chop; size down.</p>';
  }

  const body = document.getElementById('trade-modal-body');
  if (body) {
    body.innerHTML = `
      <p class="trade-modal-line mono">Entry (mock): <strong>${entry.toFixed(2)}</strong> × ${qty} qty</p>
      <p class="trade-modal-line">Fusion direction: <span class="${arrowClass} mono">${arrow}</span> (${stock.score >= 0 ? '+' : ''}${stock.score.toFixed(2)})</p>
      ${directionNote}
      ${projected}
    `;
  }
  const overlay = document.getElementById('trade-modal-overlay');
  if (overlay) {
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    gsap.fromTo('.trade-modal', { opacity: 0, y: 12, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.48, ease: 'power3.out' });
  }
}

function closeSimulateModal() {
  const overlay = document.getElementById('trade-modal-overlay');
  if (overlay) {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  }
}

function wireSignalsTab() {
  document.querySelectorAll('.top-nav .tab[data-target="signals"]').forEach((tab) => {
    tab.addEventListener('click', () => {
      lenis.scrollTo('#trade-view', {
        duration: 1.75,
        onComplete: () => ScrollTrigger.refresh(),
      });
    });
  });
}

function wirePortfolioButton() {
  const btn = document.getElementById('trade-portfolio-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    document.querySelectorAll('.top-nav .tab').forEach((t) => t.classList.remove('active'));
    document.querySelector('.top-nav .tab[data-target="earth"]')?.classList.add('active');
    lenis?.scrollTo('#earth-view', { duration: 1.75 });
  });
}

/** Cinematic scrubbed transition Geo Map ↔ Trade Desk (no pin). */
function setupGeoTradeCinematicScroll() {
  const geoExitTl = gsap.timeline({
    scrollTrigger: {
      trigger: '#trade-view',
      start: 'top bottom',
      end: 'top 60%',
      scrub: 1.55,
      once: false,
    },
  });

  geoExitTl
    .to(
      '.bottom-trend-panel',
      {
        y: 40,
        opacity: 0,
        duration: 0.4,
        ease: 'power2.in',
      },
      0
    )
    .to(
      '.geo-left-panel',
      {
        x: -30,
        opacity: 0,
        scale: 0.97,
        transformOrigin: 'left center',
        duration: 0.5,
        ease: 'power2.in',
      },
      0.05
    )
    .to(
      '.geo-right-panel',
      {
        x: 30,
        opacity: 0,
        scale: 0.97,
        transformOrigin: 'right center',
        duration: 0.5,
        ease: 'power2.in',
      },
      0.05
    )
    .to(
      '#svg-map-container',
      {
        opacity: 0.08,
        duration: 0.6,
        ease: 'power1.in',
      },
      0
    );

  ScrollTrigger.create({
    trigger: '#geo-view',
    start: 'top top',
    end: 'bottom top',
    onLeaveBack: () => {
      gsap.to(['.geo-left-panel', '.geo-right-panel', '.bottom-trend-panel'], {
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
        duration: 0.4,
        ease: 'power2.out',
        overwrite: 'auto',
      });
      gsap.to('#svg-map-container', { opacity: 1, duration: 0.4, overwrite: 'auto' });
    },
  });
}

function clearTradeScrollAnimProps() {
  const clearSel = (sel) => {
    gsap.utils.toArray(sel).forEach((el) => {
      if (el) gsap.set(el, { clearProps: 'all' });
    });
  };
  clearSel('#trade-context-ribbon');
  clearSel('#trade-watchlist');
  clearSel('#trade-col-center');
  clearSel('#trade-col-right');
  // NOTE: do NOT clear #lw-chart-div-trade here — its own ScrollTrigger manages
  // the reveal and clearing opacity/scaleY prematurely would hide the chart again.
  clearSel('#trade-watchlist .trade-wl-row');
  clearSel('#trade-fusion-bars .trade-fusion-bar-row');
  clearSel('#trade-col-right .ai-explainer');
}

/** One-shot entrances when #trade-view enters (trigger #trade-view, once: true). */
function setupTradeScrollEntrances() {
  const st = { trigger: '#trade-view', once: true };

  gsap.set(
    ['#trade-context-ribbon', '#trade-watchlist', '#trade-col-center', '#trade-col-right'],
    { opacity: 0 }
  );
  gsap.set('#trade-context-ribbon', { y: -40, opacity: 0 });
  gsap.set('#trade-watchlist', { x: -60, opacity: 0 });
  gsap.set('#trade-col-center', { y: 50, opacity: 0 });
  gsap.set('#trade-col-right', { x: 60, opacity: 0 });

  const wlRows = gsap.utils.toArray('#trade-watchlist .trade-wl-row');
  gsap.set(wlRows, { x: -20, opacity: 0 });

  gsap.set('#lw-chart-div-trade', {
    opacity: 0,
    scaleY: 0.92,
    transformOrigin: '50% 100%',
  });

  const fusionRows = gsap.utils.toArray('#trade-fusion-bars .trade-fusion-bar-row');
  gsap.set(fusionRows, { scaleX: 0, opacity: 0, transformOrigin: 'left center' });

  gsap.set('#trade-col-right .ai-explainer', { opacity: 0, y: 12 });

  gsap.to('#trade-context-ribbon', {
    y: 0,
    opacity: 1,
    duration: 0.72,
    ease: 'power2.out',
    scrollTrigger: { ...st, start: 'top 90%' },
  });

  gsap.to('#trade-watchlist', {
    x: 0,
    opacity: 1,
    duration: 0.82,
    ease: 'power3.out',
    delay: 0.12,
    scrollTrigger: { ...st, start: 'top 85%' },
  });

  gsap.to('#trade-col-center', {
    y: 0,
    opacity: 1,
    duration: 0.82,
    ease: 'power3.out',
    delay: 0.22,
    scrollTrigger: { ...st, start: 'top 85%' },
  });

  gsap.to('#trade-col-right', {
    x: 0,
    opacity: 1,
    duration: 0.82,
    ease: 'power3.out',
    delay: 0.32,
    scrollTrigger: { ...st, start: 'top 85%' },
  });

  gsap.to(wlRows, {
    x: 0,
    opacity: 1,
    duration: 0.5,
    stagger: 0.09,
    ease: 'power2.out',
    delay: 0.42,
    scrollTrigger: { ...st, start: 'top 80%' },
  });

  gsap.to('#lw-chart-div-trade', {
    opacity: 1,
    scaleY: 1,
    duration: 0.62,
    ease: 'power2.out',
    delay: 0.38,
    scrollTrigger: {
      ...st,
      start: 'top 80%',
      // If already in-view on page load / direct nav, reveal immediately
      onRefresh(self) {
        if (self.progress === 1) {
          gsap.set('#lw-chart-div-trade', { opacity: 1, scaleY: 1, clearProps: 'transform' });
        }
      },
    },
    onComplete() {
      // Ensure inline scaleY doesn't linger and conflict with ResizeObserver redraws
      gsap.set('#lw-chart-div-trade', { clearProps: 'scaleY,transformOrigin' });
    },
  });

  gsap.to(fusionRows, {
    scaleX: 1,
    opacity: 1,
    duration: 0.62,
    stagger: 0.11,
    ease: 'power2.out',
    delay: 0.52,
    scrollTrigger: { ...st, start: 'top 75%' },
  });

  gsap.to('#trade-col-right .ai-explainer', {
    opacity: 1,
    y: 0,
    duration: 0.62,
    ease: 'power2.out',
    delay: 0.68,
    scrollTrigger: { ...st, start: 'top 75%' },
    onComplete: clearTradeScrollAnimProps,
  });
}

export async function initTradeView() {
  gsap.registerPlugin(ScrollTrigger);

  if (typeof window !== 'undefined' && !window.__lenisBridged) {
    window.__lenisBridged = true;
    lenis.on('scroll', ScrollTrigger.update);
  }

  const root = document.getElementById('trade-view');
  if (!root) return;

  state.lenis = lenis;

  updateContextRibbon();

  // Load watchlist from Supabase, fall back to hardcoded if empty
  try {
    const remoteWatchlist = await loadWatchlist(null); // null = no user auth yet
    if (remoteWatchlist.length > 0) {
      BANKING_WATCHLIST = remoteWatchlist.map(row => ({
        name: row.stocks?.name ?? row.ticker,
        ticker: row.ticker,
        score: row.fusion_scores?.score ?? 0,
        label: row.fusion_scores?.label ?? 'NEUTRAL',
        breakdown: row.fusion_scores?.breakdown ?? { F: 0, T: 0, N: 0, G: 0 },
        mockPrice: row.stocks?.mock_price ?? 1000,
      }));
    }
  } catch (err) {
    console.warn('Watchlist load failed, using fallback:', err.message);
  }

  const initialTicker =
    BANKING_WATCHLIST.find((s) => s.ticker === tradeContext.stock?.ticker)?.ticker || BANKING_WATCHLIST[0].ticker;
  selectStock(initialTicker, false);

  setupGeoTradeCinematicScroll();
  setupTradeScrollEntrances();

  const wl = document.getElementById('trade-watchlist');
  wl?.addEventListener('click', (e) => {
    const row = e.target.closest('.trade-wl-row');
    if (!row?.dataset.ticker) return;
    selectStock(row.dataset.ticker, true);
  });

  document.querySelectorAll('.trade-side-btn').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.trade-side-btn').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      state.tradeSide = b.dataset.side || 'buy';
    });
  });

  document.querySelectorAll('.trade-type-btn').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.trade-type-btn').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      state.orderType = b.dataset.otype || 'market';
    });
  });

  document.getElementById('trade-qty')?.addEventListener('input', updateMarginDisplay);

  document.getElementById('trade-simulate-btn')?.addEventListener('click', openSimulateModal);
  document.getElementById('trade-modal-close')?.addEventListener('click', closeSimulateModal);
  document.getElementById('trade-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'trade-modal-overlay') closeSimulateModal();
  });

  const ribbon = document.getElementById('trade-context-ribbon');
  const ribToggle = document.getElementById('trade-ribbon-collapse');
  ribToggle?.addEventListener('click', () => {
    const collapsed = ribbon?.classList.toggle('collapsed');
    ribToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    ribToggle.textContent = collapsed ? '▸' : '▾';
  });

  wireSignalsTab();
  wirePortfolioButton();

  const tickerEl = document.getElementById('trade-ticker-content');
  if (tickerEl && !tickerEl.dataset.gsapBound) {
    tickerEl.dataset.gsapBound = '1';
    gsap.to('#trade-ticker-content', {
      xPercent: -50,
      ease: 'none',
      duration: 22,
      repeat: -1,
    });
  }

  let resizeT;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      if (state.activeStock) selectStock(state.activeStock.ticker, false);
      ScrollTrigger.refresh();
    }, 120);
  });

  ScrollTrigger.refresh();
}
