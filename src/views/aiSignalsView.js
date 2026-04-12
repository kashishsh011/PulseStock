import { aiSignalsSummary, getSectorStocks } from '../data/appData.js';
import { buildBipolarBar, buildNewsRow, labelToTone } from '../utils/viewHelpers.js';

function buildSummaryCards() {
  return aiSignalsSummary
    .map((item) => {
      return `
        <article class="summary-card">
          <span class="eyebrow">${item.label}</span>
          <strong>${item.value}</strong>
        </article>
      `;
    })
    .join('');
}

function buildSignalQueue(stocks, activeTicker) {
  return stocks
    .map((stock) => {
      return `
        <button class="signal-queue-item ${stock.ticker === activeTicker ? 'is-active' : ''}" data-action="pick-stock" data-ticker="${stock.ticker}">
          <div>
            <strong>${stock.name}</strong>
            <small>${stock.ticker}</small>
          </div>
          <span class="tone-pill tone-${labelToTone(stock.label)}">${stock.label}</span>
        </button>
      `;
    })
    .join('');
}

export function mount(container) {
  const state = {
    sector: 'Banking',
    ticker: 'AXISBANK',
    tab: 'Overall',
  };

  function render() {
    const activeStock = getSectorStocks(state.sector).find((stock) => stock.ticker === state.ticker) || getSectorStocks(state.sector)[0];
    const tabs = ['Overall', 'Fundamental', 'Technical', 'News AI'];

    let body = `
      <div class="detail-block">
        <p>${activeStock.overview}</p>
      </div>
    `;

    if (state.tab === 'Fundamental') {
      body = `
        <div class="metric-grid">
          <div class="metric-card"><span>P/E</span><strong>${activeStock.fundamental.pe}</strong></div>
          <div class="metric-card"><span>Sector P/E</span><strong>${activeStock.fundamental.sectorPE}</strong></div>
          <div class="metric-card"><span>ROE</span><strong>${activeStock.fundamental.roe}%</strong></div>
          <div class="metric-card"><span>NPA</span><strong>${activeStock.fundamental.npa}%</strong></div>
        </div>
      `;
    }

    if (state.tab === 'Technical') {
      body = `
        <div class="metric-grid">
          <div class="metric-card"><span>RSI</span><strong>${activeStock.technical.rsi}</strong></div>
          <div class="metric-card"><span>WMA Gap</span><strong>${activeStock.technical.priceVsWMA}%</strong></div>
          <div class="metric-card"><span>Support</span><strong>${activeStock.technical.support}</strong></div>
          <div class="metric-card"><span>Resistance</span><strong>${activeStock.technical.resistance}</strong></div>
        </div>
      `;
    }

    if (state.tab === 'News AI') {
      body = `<div class="news-list">${activeStock.news.map(buildNewsRow).join('')}</div>`;
    }

    container.innerHTML = `
      <div class="signals-view-shell">
        <aside class="app-panel signals-sidebar">
          <div class="panel-section">
            <span class="eyebrow">Signal Summary</span>
            <div class="summary-grid">${buildSummaryCards()}</div>
          </div>

          <div class="panel-section">
            <span class="eyebrow">Sector Lenses</span>
            <div class="stacked-button-group">
              ${Object.keys({ Banking: true, IT: true, Pharma: true })
                .map((sector) => {
                  return `
                    <button class="stacked-button ${sector === state.sector ? 'is-active' : ''}" data-action="pick-sector" data-sector="${sector}">
                      ${sector}
                    </button>
                  `;
                })
                .join('')}
            </div>
          </div>

          <div class="panel-section">
            <span class="eyebrow">Top Signals</span>
            <div class="signal-queue">
              ${buildSignalQueue(getSectorStocks(state.sector), activeStock.ticker)}
            </div>
          </div>
        </aside>

        <section class="app-panel signals-board">
          <div class="signals-board-head">
            <div>
              <span class="eyebrow">AI Signals</span>
              <h1>${activeStock.name}</h1>
              <p>Cross-signal ranking remains anchored to the same Fusion inputs, but now it lives in a dedicated view instead of being buried inside the old globe layout.</p>
            </div>
            <span class="tone-pill tone-${labelToTone(activeStock.label)}">${activeStock.label}</span>
          </div>

          <div class="signals-hero-grid">
            <article class="hero-card">
              <span class="eyebrow">Fusion Score</span>
              ${buildBipolarBar({ label: 'Composite', value: activeStock.score })}
            </article>
            <article class="hero-card">
              ${buildBipolarBar({ label: 'Fundamental', value: activeStock.breakdown.F })}
              ${buildBipolarBar({ label: 'Technical', value: activeStock.breakdown.T })}
              ${buildBipolarBar({ label: 'News', value: activeStock.breakdown.N })}
              ${buildBipolarBar({ label: 'Global', value: activeStock.breakdown.G })}
            </article>
          </div>

          <div class="analysis-tabs">
            ${tabs
              .map((tab) => {
                return `
                  <button class="analysis-tab ${tab === state.tab ? 'is-active' : ''}" data-action="pick-tab" data-tab="${tab}">
                    ${tab}
                  </button>
                `;
              })
              .join('')}
          </div>

          ${body}
        </section>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    container.querySelectorAll('[data-action="pick-sector"]').forEach((button) => {
      button.addEventListener('click', () => {
        state.sector = button.dataset.sector;
        state.ticker = getSectorStocks(state.sector)[0].ticker;
        state.tab = 'Overall';
        render();
      });
    });

    container.querySelectorAll('[data-action="pick-stock"]').forEach((button) => {
      button.addEventListener('click', () => {
        state.ticker = button.dataset.ticker;
        render();
      });
    });

    container.querySelectorAll('[data-action="pick-tab"]').forEach((button) => {
      button.addEventListener('click', () => {
        state.tab = button.dataset.tab;
        render();
      });
    });
  }

  render();

  return {
    onShow() {},
  };
}
