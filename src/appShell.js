import './app-shell.css';
import { macroStats } from './data/appData.js';

const viewLoaders = {
  earth: () => import('./views/earthView.js'),
  geo: () => import('./views/geoView.js'),
  signals: () => import('./views/aiSignalsView.js'),
};

const mountedViews = new Map();
const paneElements = new Map();

document.body.innerHTML = `
  <div id="app" class="app-shell">
    <div class="app-background" aria-hidden="true">
      <div class="bg-orb orb-one" data-orb="0"></div>
      <div class="bg-orb orb-two" data-orb="1"></div>
      <div class="bg-orb orb-three" data-orb="2"></div>
      <div class="bg-grid"></div>
    </div>

    <header class="app-header">
      <div class="brand-lockup">
        <div class="brand-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
        </div>
        <div>
          <div class="brand-title">PulseStock</div>
          <div class="brand-subtitle">Trader v2.0</div>
        </div>
      </div>

      <div class="gti-headline">
        <span class="eyebrow">Global Tension Index</span>
        <div class="gti-headline-row">
          <strong>${macroStats.gti}</strong>
          <span class="header-delta">${macroStats.delta}</span>
          <span class="tone-pill tone-warning">${macroStats.regime}</span>
        </div>
      </div>

      <nav class="header-tabs" aria-label="Primary">
        <button class="header-tab is-active" data-view="earth">Earth Pulse</button>
        <button class="header-tab" data-view="geo">Geo Map</button>
        <button class="header-tab" data-view="signals">AI Signals</button>
      </nav>

      <div class="header-status">
        <span class="status-chip status-live">LIVE / 2 feeds</span>
        <span class="status-chip"><span id="utc-clock">--:--:--</span> UTC</span>
      </div>
    </header>

    <main class="view-host">
      <section class="view-pane is-active" id="earth-view" aria-label="Earth Pulse"></section>
      <section class="view-pane" id="geo-view" aria-label="Geo Map"></section>
      <section class="view-pane" id="signals-view" aria-label="AI Signals"></section>
    </main>
  </div>
`;

['earth', 'geo', 'signals'].forEach((viewName) => {
  paneElements.set(viewName, document.getElementById(`${viewName}-view`));
});

function updateClock() {
  const now = new Date();
  const clock = document.getElementById('utc-clock');
  if (clock) {
    clock.textContent = now.toLocaleTimeString('en-GB', {
      hour12: false,
      timeZone: 'UTC',
    });
  }
}

function startBackgroundAnimation() {
  const orbs = Array.from(document.querySelectorAll('[data-orb]'));
  let frameId = 0;

  const tick = (time) => {
    orbs.forEach((orb, index) => {
      const x = Math.sin(time * 0.00018 + index * 1.7) * (24 + index * 18);
      const y = Math.cos(time * 0.00015 + index * 1.2) * (18 + index * 12);
      const scale = 1 + Math.sin(time * 0.00012 + index) * 0.04;
      orb.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    });

    frameId = requestAnimationFrame(tick);
  };

  frameId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frameId);
}

async function ensureView(viewName) {
  if (mountedViews.has(viewName)) return mountedViews.get(viewName);

  const pane = paneElements.get(viewName);
  pane.innerHTML = `<div class="loading-panel">Loading ${viewName.replace(/^\w/, (match) => match.toUpperCase())}...</div>`;

  const module = await viewLoaders[viewName]();
  const controller = module.mount(pane);
  mountedViews.set(viewName, controller);
  return controller;
}

async function setActiveView(viewName) {
  document.querySelectorAll('.header-tab').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.view === viewName);
  });

  paneElements.forEach((pane, key) => {
    pane.classList.toggle('is-active', key === viewName);
  });

  const controller = await ensureView(viewName);
  controller?.onShow?.();
}

document.querySelectorAll('.header-tab').forEach((button) => {
  button.addEventListener('click', () => {
    setActiveView(button.dataset.view);
  });
});

updateClock();
setInterval(updateClock, 1000);
startBackgroundAnimation();
setActiveView('earth');
