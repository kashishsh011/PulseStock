import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { lenis } from './main.js';
import { mountLightweightCandlestickFromCanvas } from './lightweightCandleMount.js';

const POSITIONS = [
  {
    ticker: 'HDFCBANK',
    name: 'HDFC Bank',
    qty: 10,
    entry: 1640.0,
    ltp: 1711.62,
    label: 'CONFLICTED',
    score: 0.16,
    breakdown: { F: 0.43, T: -0.14, N: 0.5, G: -0.3 },
  },
  {
    ticker: 'SBIN',
    name: 'SBI',
    qty: 25,
    entry: 748.0,
    ltp: 776.4,
    label: 'BULLISH',
    score: 0.42,
    breakdown: { F: 0.3, T: 0.25, N: 0.2, G: -0.1 },
  },
  {
    ticker: 'ICICIBANK',
    name: 'ICICI Bank',
    qty: 8,
    entry: 1120.0,
    ltp: 1096.5,
    label: 'BEARISH',
    score: -0.21,
    breakdown: { F: -0.1, T: -0.3, N: -0.2, G: -0.3 },
  },
  {
    ticker: 'KOTAKBANK',
    name: 'Kotak Bank',
    qty: 5,
    entry: 1790.0,
    ltp: 1815.2,
    label: 'LEANING BULLISH',
    score: 0.31,
    breakdown: { F: 0.4, T: 0.2, N: 0.3, G: -0.2 },
  },
  {
    ticker: 'AXISBANK',
    name: 'Axis Bank',
    qty: 15,
    entry: 1058.0,
    ltp: 1063.1,
    label: 'NEUTRAL',
    score: 0.05,
    breakdown: { F: 0.1, T: 0.05, N: 0.0, G: -0.1 },
  },
];

POSITIONS.forEach((p) => {
  p.daysHeld = 3 + Math.floor(Math.random() * 19);
});

let selectedTicker = POSITIONS[0].ticker;

function getBadgeClass(label) {
  const u = (label || '').toUpperCase();
  if (u.includes('BULLISH') && !u.includes('LEANING')) return 'trade-badge--bull';
  if (u.includes('LEANING BULLISH')) return 'trade-badge--lean-bull';
  if (u.includes('BEARISH')) return 'trade-badge--bear';
  if (u.includes('CONFLICTED')) return 'trade-badge--conflict';
  return 'trade-badge--neutral';
}

function buildSignalBarHTML(fullLabel, value) {
  const isPositive = value >= 0;
  const fillPercent = Math.min(50, Math.abs(value) * 50);
  const color = isPositive ? '#4ade80' : '#f87171';
  const left = isPositive ? 50 : 50 - fillPercent;
  const sign = value > 0 ? '+' : '';
  return `
    <div class="port-fusion-bar-row" style="margin-bottom:14px;">
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

function miniFusionBar(score) {
  const fill = Math.min(50, Math.abs(score) * 50);
  const left = score >= 0 ? 50 : 50 - fill;
  const color = score >= 0 ? '#4ade80' : '#f87171';
  return `<div class="port-mini-fusion-track" aria-hidden="true"><div class="port-mini-fusion-mid"></div><div class="port-mini-fusion-fill" style="left:${left}%;width:${fill}%;background:${color}"></div></div>`;
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

function updatePortfolioOHLC(candles) {
  if (!candles?.length) return;
  const last = candles[candles.length - 1];
  const fmt = (v) => (v < 1 ? v.toFixed(4) : v.toFixed(2));
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  set('port-ohlc-open', fmt(candles[0].open));
  set('port-ohlc-high', fmt(Math.max(...candles.map((c) => c.high))));
  set('port-ohlc-low', fmt(Math.min(...candles.map((c) => c.low))));
  set('port-ohlc-close', fmt(last.close));
}

function resizePortfolioCanvases() {
  const lwDiv = document.getElementById('lw-chart-div-portfolio');
  const candleEl = document.getElementById('portfolio-candle-chart');
  const ddEl = document.getElementById('port-drawdown-chart');
  const anchor = lwDiv || candleEl;
  if (!anchor) return;
  const wrap = anchor.closest('.port-chart-block');
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
  if (ddEl) {
    const rw = ddEl.parentElement?.clientWidth || w;
    ddEl.width = Math.max(280, rw - 32);
    ddEl.height = 80;
    ddEl.style.width = '100%';
    ddEl.style.height = '80px';
  }
}

function drawDrawdownChart() {
  const canvas = document.getElementById('port-drawdown-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const n = 20;
  const values = [];
  let v = 0;
  for (let i = 0; i < n; i++) {
    if (i < 12) v += (Math.random() - 0.58) * 1.1;
    else v += (Math.random() - 0.35) * 0.9;
    if (i === 13) v = Math.min(v, -9);
    if (i > 14) v = Math.min(0, v + 0.35);
    values.push(Math.max(-12, Math.min(0, v)));
  }
  const pad = { l: 6, r: 6, t: 6, b: 4 };
  const cw = W - pad.l - pad.r;
  const ch = H - pad.t - pad.b;
  const minV = Math.min(...values, -1);
  const maxV = 0.5;
  const rng = maxV - minV || 1;
  const toX = (i) => pad.l + (i / (n - 1)) * cw;
  const toY = (val) => pad.t + ch - ((val - minV) / rng) * ch;

  ctx.beginPath();
  ctx.moveTo(toX(0), toY(values[0]));
  values.forEach((val, i) => ctx.lineTo(toX(i), toY(val)));
  ctx.lineTo(toX(n - 1), H - pad.b);
  ctx.lineTo(toX(0), H - pad.b);
  ctx.closePath();
  ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
  ctx.fill();

  ctx.beginPath();
  values.forEach((val, i) => (i === 0 ? ctx.moveTo(toX(i), toY(val)) : ctx.lineTo(toX(i), toY(val))));
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1.25;
  ctx.stroke();
}

function getPosition(ticker) {
  return POSITIONS.find((p) => p.ticker === ticker) || POSITIONS[0];
}

function formatInr(n) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function updateSummaryBar() {
  let totalValue = 0;
  let totalCost = 0;
  POSITIONS.forEach((p) => {
    totalValue += p.qty * p.ltp;
    totalCost += p.qty * p.entry;
  });
  const totalPnL = totalValue - totalCost;
  const dayChange = totalCost > 0 ? ((totalPnL / totalCost) * 100).toFixed(2) : '0.00';
  const pnlEl = document.getElementById('port-sum-pnl');
  const dayEl = document.getElementById('port-sum-day');
  const valEl = document.getElementById('port-sum-value');
  const sharpeEl = document.getElementById('port-sum-sharpe');
  if (pnlEl) {
    pnlEl.textContent = formatInr(totalPnL);
    pnlEl.classList.toggle('port-val-pos', totalPnL >= 0);
    pnlEl.classList.toggle('port-val-neg', totalPnL < 0);
  }
  if (dayEl) {
    dayEl.textContent = `${totalPnL >= 0 ? '+' : ''}${dayChange}%`;
    dayEl.classList.toggle('port-val-pos', totalPnL >= 0);
    dayEl.classList.toggle('port-val-neg', totalPnL < 0);
  }
  if (valEl) valEl.textContent = formatInr(totalValue);
  if (sharpeEl) sharpeEl.textContent = '1.15';
}

function renderFusionPanel(stock) {
  const el = document.getElementById('port-fusion-bars');
  if (!el) return;
  const bars = [
    { label: 'Fundamental', value: stock.breakdown.F },
    { label: 'Technical', value: stock.breakdown.T },
    { label: 'News', value: stock.breakdown.N },
    { label: 'Global', value: stock.breakdown.G },
  ];
  el.innerHTML = `<div class="signal-bars">${bars.map((b) => buildSignalBarHTML(b.label, b.value)).join('')}</div>`;
  const badge = document.getElementById('port-fusion-score-badge');
  if (badge) {
    const sc = stock.score;
    const sign = sc > 0 ? '+' : '';
    badge.textContent = `${sign}${sc.toFixed(2)}`;
    badge.style.color = sc >= 0 ? '#4ade80' : '#f87171';
  }
}

function renderPositionsList() {
  const ul = document.getElementById('port-positions-list');
  const countEl = document.getElementById('port-positions-count');
  if (!ul) return;
  if (countEl) countEl.textContent = String(POSITIONS.length);
  ul.innerHTML = POSITIONS.map((p) => {
    const cost = p.qty * p.entry;
    const val = p.qty * p.ltp;
    const pnl = val - cost;
    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
    const active = p.ticker === selectedTicker ? ' active' : '';
    const pnlClass = pnl >= 0 ? 'port-val-pos' : 'port-val-neg';
    return `
      <li class="port-position-row${active}" data-ticker="${p.ticker}">
        <div class="port-pos-main">
          <span class="port-pos-ticker mono">${p.ticker}</span>
          <span class="trade-badge ${getBadgeClass(p.label)}">${p.label}</span>
          ${miniFusionBar(p.score)}
        </div>
        <div class="port-pos-qty mono">${p.qty} × ${p.entry.toFixed(2)}</div>
        <div class="port-pos-pnl mono ${pnlClass}">
          <div>${p.ltp.toFixed(2)}</div>
          <div class="port-pos-pnl-sub">${formatInr(pnl)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)</div>
        </div>
        <button type="button" class="port-exit-btn" data-ticker="${p.ticker}">EXIT</button>
      </li>
    `;
  }).join('');
}

function selectPosition(ticker, flash = true) {
  selectedTicker = ticker;
  const stock = getPosition(ticker);
  renderPositionsList();

  const titleEl = document.getElementById('port-chart-title');
  const tickEl = document.getElementById('port-chart-ticker');
  if (titleEl) titleEl.textContent = stock.name;
  if (tickEl) tickEl.textContent = stock.ticker;

  resizePortfolioCanvases();
  const candles = generateCandles(stock.ltp, 60);
  mountLightweightCandlestickFromCanvas('portfolio-candle-chart', candles, 'lw-chart-div-portfolio');
  updatePortfolioOHLC(candles);

  const cost = stock.qty * stock.entry;
  const val = stock.qty * stock.ltp;
  const pnl = val - cost;
  const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;

  const setTxt = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  setTxt('port-metric-pnl', formatInr(pnl));
  const pnlPctEl = document.getElementById('port-metric-pnl-pct');
  if (pnlPctEl) {
    pnlPctEl.textContent = `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`;
    pnlPctEl.classList.toggle('port-val-pos', pnl >= 0);
    pnlPctEl.classList.toggle('port-val-neg', pnl < 0);
  }
  setTxt('port-metric-size', formatInr(val));
  setTxt('port-metric-days', String(stock.daysHeld));

  renderFusionPanel(stock);

  if (flash) {
    gsap.fromTo(
      '#port-col-center',
      { boxShadow: '0 0 0 rgba(34,197,94,0)' },
      {
        boxShadow: '0 0 28px rgba(34, 197, 94, 0.35)',
        duration: 0.45,
        yoyo: true,
        repeat: 1,
        ease: 'power2.inOut',
      }
    );
  }
}

function showToast(ticker) {
  const toast = document.getElementById('port-toast');
  if (!toast) return;
  toast.textContent = `Order placed (mock) · ${ticker}`;
  gsap.killTweensOf(toast);
  toast.style.pointerEvents = 'auto';
  gsap.fromTo(toast, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.36, ease: 'power2.out' });
  gsap.to(toast, {
    autoAlpha: 0,
    duration: 0.45,
    delay: 2.5,
    ease: 'power2.inOut',
    onComplete: () => {
      toast.style.pointerEvents = 'none';
    },
  });
}

function setActiveNavTab(target) {
  document.querySelectorAll('.top-nav .tab').forEach((t) => {
    t.classList.toggle('active', t.getAttribute('data-target') === target);
  });
}

function wireNavPortfolioTab() {
  document.querySelectorAll('.top-nav .tab[data-target="portfolio"]').forEach((tab) => {
    tab.addEventListener('click', () => {
      setActiveNavTab('portfolio');
      lenis.scrollTo('#portfolio-view', { duration: 1.75 });
    });
  });
}

const PORT_WAITLIST_STORAGE_KEY = 'pulsestock_portfolio_waitlist_done';

function isValidPortfolioWaitlistEmail(value) {
  const s = (value || '').trim();
  return s.includes('@') && s.includes('.');
}

function setupPortfolioWaitlistBanner() {
  const anchor = document.getElementById('port-waitlist-anchor');
  const banner = document.getElementById('port-waitlist-banner');
  const formPane = document.getElementById('port-waitlist-form-pane');
  const successPane = document.getElementById('port-waitlist-success-pane');
  const input = document.getElementById('port-waitlist-email');
  const submitBtn = document.getElementById('port-waitlist-submit');
  if (!anchor || !banner || !formPane || !successPane || !input || !submitBtn) return;

  if (localStorage.getItem(PORT_WAITLIST_STORAGE_KEY) === '1') {
    anchor.style.display = 'none';
    return;
  }

  let finished = false;
  let waitlistSubmitted = false;

  anchor.setAttribute('aria-hidden', 'false');
  anchor.classList.add('port-waitlist-anchor-active');
  gsap.set(banner, { y: 18, opacity: 0 });
  banner.style.pointerEvents = 'none';
  gsap.to(banner, {
    y: 0,
    opacity: 1,
    duration: 0.58,
    ease: 'power3.out',
    onComplete: () => {
      banner.style.pointerEvents = 'auto';
    },
  });

  function dismissBannerAfterSuccess() {
    finished = true;
    gsap.to(banner, {
      y: 48,
      opacity: 0,
      duration: 0.42,
      ease: 'power3.inOut',
      onComplete: () => {
        anchor.style.display = 'none';
        anchor.classList.remove('port-waitlist-anchor-active');
      },
    });
  }

  submitBtn.addEventListener('click', () => {
    if (finished || waitlistSubmitted) return;
    const email = input.value;
    if (!isValidPortfolioWaitlistEmail(email)) {
      input.focus();
      gsap.fromTo(input, { x: -4 }, { x: 0, duration: 0.1, ease: 'sine.inOut', yoyo: true, repeat: 3 });
      return;
    }
    waitlistSubmitted = true;
    localStorage.setItem(PORT_WAITLIST_STORAGE_KEY, '1');
    formPane.setAttribute('hidden', '');
    successPane.removeAttribute('hidden');
    gsap.fromTo(successPane, { opacity: 0 }, { opacity: 1, duration: 0.38, ease: 'power2.out' });
    gsap.delayedCall(2, dismissBannerAfterSuccess);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitBtn.click();
  });
}

function wireScrollLinks() {
  document.getElementById('port-link-geo')?.addEventListener('click', (e) => {
    e.preventDefault();
    setActiveNavTab('geo');
    lenis.scrollTo('#geo-view', { duration: 1.75 });
  });
  document.getElementById('port-btn-trade')?.addEventListener('click', () => {
    setActiveNavTab('signals');
    lenis.scrollTo('#trade-view', { duration: 1.75 });
  });
}

function setupPortfolioScrollTransitions() {
  if (typeof window !== 'undefined' && window.__portfolioScrollST) return;
  if (typeof window !== 'undefined') window.__portfolioScrollST = true;

  if (typeof window !== 'undefined' && !window.__lenisBridged) {
    window.__lenisBridged = true;
    lenis.on('scroll', ScrollTrigger.update);
  }

  /* Trade-desk exit scrub removed: with Lenis + ScrollTrigger it could leave progress "stuck"
     and keep .trade-desk-grid / ribbon / ticker at opacity 0 while AI Signals is in view. */

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      gsap.set('#port-summary-bar', { y: -25, opacity: 0 });
      gsap.set('#port-col-left', { x: -50, opacity: 0 });
      gsap.set('#port-col-center', { y: 40, opacity: 0 });
      gsap.set('#port-col-right', { x: 50, opacity: 0 });

      gsap
        .timeline({
          scrollTrigger: {
            trigger: '#portfolio-view',
            start: 'top 80%',
            end: 'top 10%',
            scrub: 1.55,
            once: false,
            invalidateOnRefresh: true,
          },
        })
        .to('#port-summary-bar', { y: 0, opacity: 1, duration: 0.42, ease: 'power2.out' }, 0)
        .to('#port-col-left', { x: 0, opacity: 1, duration: 0.52, ease: 'power3.out' }, 0.1)
        .to('#port-col-center', { y: 0, opacity: 1, duration: 0.52, ease: 'power3.out' }, 0.18)
        .to('#port-col-right', { x: 0, opacity: 1, duration: 0.52, ease: 'power3.out' }, 0.26);
    });
  });

  ScrollTrigger.create({
    trigger: '#port-col-left',
    start: 'top 70%',
    once: true,
    invalidateOnRefresh: true,
    onEnter: () => {
      gsap.fromTo(
        '.port-position-row',
        { x: -16, opacity: 0 },
        { x: 0, opacity: 1, stagger: 0.09, duration: 0.44, ease: 'power2.out', delay: 0.12 }
      );
    },
  });
}

export function initPortfolioView() {
  const root = document.getElementById('portfolio-view');
  if (!root) return;

  resizePortfolioCanvases();
  updateSummaryBar();
  renderPositionsList();
  selectPosition(selectedTicker, false);
  drawDrawdownChart();

  const list = document.getElementById('port-positions-list');
  list?.addEventListener('click', (e) => {
    const exitBtn = e.target.closest('.port-exit-btn');
    if (exitBtn) {
      e.stopPropagation();
      showToast(exitBtn.getAttribute('data-ticker') || '');
      return;
    }
    const row = e.target.closest('.port-position-row');
    if (row?.dataset.ticker) selectPosition(row.dataset.ticker, true);
  });

  wireNavPortfolioTab();
  wireScrollLinks();
  setupPortfolioScrollTransitions();
  setupPortfolioWaitlistBanner();

  const tickerEl = document.getElementById('port-ticker-content');
  if (tickerEl && !tickerEl.dataset.gsapBound) {
    tickerEl.dataset.gsapBound = '1';
    gsap.to('#port-ticker-content', {
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
      resizePortfolioCanvases();
      const st = getPosition(selectedTicker);
      const candles = generateCandles(st.ltp, 60);
      mountLightweightCandlestickFromCanvas('portfolio-candle-chart', candles, 'lw-chart-div-portfolio');
      updatePortfolioOHLC(candles);
      drawDrawdownChart();
      ScrollTrigger.refresh();
    }, 120);
  });

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      ScrollTrigger.refresh();
    });
  });
}
