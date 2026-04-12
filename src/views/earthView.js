import { earthPulseHotspots, geoNewsFeed, getSectorStocks, macroStats, regionFilters } from '../data/appData.js';
import { buildBipolarBar, buildNewsRow, labelToTone } from '../utils/viewHelpers.js';

function buildStockListMarkup(stocks, activeTicker) {
  return stocks
    .map((stock) => {
      return `
        <button class="stock-list-item ${stock.ticker === activeTicker ? 'is-active' : ''}" data-action="pick-stock" data-ticker="${stock.ticker}">
          <span>
            <strong>${stock.name}</strong>
            <small>${stock.ticker}</small>
          </span>
          <span class="tone-pill tone-${labelToTone(stock.label)}">${stock.label}</span>
        </button>
      `;
    })
    .join('');
}

function buildRegionMarkup(activeRegion) {
  return regionFilters
    .map((region) => {
      const slug = region.toLowerCase();
      return `
        <button class="chip-button ${slug === activeRegion ? 'is-active' : ''}" data-action="pick-region" data-region="${slug}">
          ${region}
        </button>
      `;
    })
    .join('');
}

function buildScenarioRow(label, value, inputName) {
  return `
    <label class="scenario-row">
      <div class="scenario-copy">
        <span>${label}</span>
        <strong>${value}%</strong>
      </div>
      <input type="range" min="0" max="100" value="${value}" data-action="adjust-scenario" data-scenario="${inputName}">
    </label>
  `;
}

function buildRightPanel(stock, activeTab) {
  const tabs = ['Overall', 'Fundamental', 'Technical', 'News AI'];
  const tabMarkup = tabs
    .map((tab) => {
      return `
        <button class="analysis-tab ${tab === activeTab ? 'is-active' : ''}" data-action="pick-tab" data-tab="${tab}">
          ${tab}
        </button>
      `;
    })
    .join('');

  let detailMarkup = `
    <div class="detail-block">
      <p>${stock.overview}</p>
    </div>
  `;

  if (activeTab === 'Fundamental') {
    detailMarkup = `
      <div class="metric-grid">
        <div class="metric-card"><span>P/E</span><strong>${stock.fundamental.pe}</strong></div>
        <div class="metric-card"><span>Sector P/E</span><strong>${stock.fundamental.sectorPE}</strong></div>
        <div class="metric-card"><span>ROE</span><strong>${stock.fundamental.roe}%</strong></div>
        <div class="metric-card"><span>NPA</span><strong>${stock.fundamental.npa}%</strong></div>
        <div class="metric-card"><span>Growth</span><strong>${stock.fundamental.revenueGrowth}%</strong></div>
        <div class="metric-card"><span>Promoter</span><strong>${stock.fundamental.promoterHolding}%</strong></div>
      </div>
    `;
  }

  if (activeTab === 'Technical') {
    detailMarkup = `
      <div class="metric-grid">
        <div class="metric-card"><span>RSI 14</span><strong>${stock.technical.rsi}</strong></div>
        <div class="metric-card"><span>Price vs WMA</span><strong>${stock.technical.priceVsWMA}%</strong></div>
        <div class="metric-card"><span>MACD</span><strong>${stock.technical.macd}</strong></div>
        <div class="metric-card"><span>Volume</span><strong>${stock.technical.volumeTrend}</strong></div>
        <div class="metric-card"><span>Support</span><strong>${stock.technical.support}</strong></div>
        <div class="metric-card"><span>Resistance</span><strong>${stock.technical.resistance}</strong></div>
      </div>
    `;
  }

  if (activeTab === 'News AI') {
    detailMarkup = `<div class="news-list">${stock.news.map(buildNewsRow).join('')}</div>`;
  }

  return `
    <div class="analysis-head">
      <div>
        <span class="eyebrow">AI Signals Engine</span>
        <h2>${stock.name}</h2>
      </div>
      <span class="tone-pill tone-${labelToTone(stock.label)}">${stock.label}</span>
    </div>
    <div class="detail-block">
      <span class="eyebrow">Fusion Score</span>
      ${buildBipolarBar({ label: 'Composite', value: stock.score })}
    </div>
    <div class="detail-block">
      ${buildBipolarBar({ label: 'Fundamental', value: stock.breakdown.F })}
      ${buildBipolarBar({ label: 'Technical', value: stock.breakdown.T })}
      ${buildBipolarBar({ label: 'News', value: stock.breakdown.N })}
      ${buildBipolarBar({ label: 'Global', value: stock.breakdown.G })}
    </div>
    <div class="analysis-tabs">${tabMarkup}</div>
    ${detailMarkup}
  `;
}

export function mount(container) {
  const state = {
    sector: 'Banking',
    ticker: 'AXISBANK',
    region: 'all',
    tab: 'Overall',
    scenarios: {
      oil: 18,
      geo: 71,
      rates: 32,
    },
  };

  function render() {
    const stocks = getSectorStocks(state.sector);
    const activeStock = stocks.find((stock) => stock.ticker === state.ticker) || stocks[0];
    const filteredHotspots = state.region === 'all'
      ? earthPulseHotspots
      : earthPulseHotspots.filter((spot) => spot.region.toLowerCase() === state.region);

    container.innerHTML = `
      <div class="earth-view-shell">
        <aside class="app-panel earth-sidebar" id="left-filter-panel">
          <div class="gti-card">
            <span class="eyebrow">Global Tension Index</span>
            <strong>${macroStats.gti}</strong>
            <div class="gti-meta">
              <span>${macroStats.delta} today</span>
              <span class="tone-pill tone-warning">${macroStats.regime}</span>
            </div>
          </div>

          <div class="panel-section">
            <span class="eyebrow">Filter By Region</span>
            <div class="chip-grid">${buildRegionMarkup(state.region)}</div>
          </div>

          <div class="panel-section">
            <span class="eyebrow">Select Sector</span>
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
            <span class="eyebrow">Tracked Stocks</span>
            <div class="stock-list">${buildStockListMarkup(stocks, activeStock.ticker)}</div>
          </div>

          <div class="panel-section">
            <span class="eyebrow">What-if Scenarios</span>
            ${buildScenarioRow('Oil Shock', state.scenarios.oil, 'oil')}
            ${buildScenarioRow('Geo Escalation', state.scenarios.geo, 'geo')}
            ${buildScenarioRow('Rate Change', state.scenarios.rates, 'rates')}
          </div>
        </aside>

        <section class="app-panel earth-stage">
          <div class="stage-hero">
            <div>
              <span class="eyebrow">Earth Pulse</span>
              <h1>Live macro pressure map without the heavy globe renderer.</h1>
              <p>High-friction regions now ride on the same dark animated gradient background as the rest of the app, so the dashboard stays responsive while the signal layer remains intact.</p>
            </div>
            <div class="stage-stat-grid">
              <article class="stage-stat-card">
                <span>Regime</span>
                <strong>${macroStats.regime}</strong>
              </article>
              <article class="stage-stat-card">
                <span>VIX</span>
                <strong>${macroStats.vix}</strong>
              </article>
              <article class="stage-stat-card">
                <span>Crude</span>
                <strong>$${macroStats.crude}</strong>
              </article>
              <article class="stage-stat-card">
                <span>USDINR</span>
                <strong>${macroStats.usdInr}</strong>
              </article>
            </div>
          </div>

          <div class="hotspot-grid">
            ${filteredHotspots
              .map((spot) => {
                return `
                  <article class="hotspot-card">
                    <div class="hotspot-head">
                      <div>
                        <span class="eyebrow">${spot.region}</span>
                        <h3>${spot.title}</h3>
                      </div>
                      <span class="hotspot-score">${spot.score}</span>
                    </div>
                    <p>${spot.copy}</p>
                  </article>
                `;
              })
              .join('')}
          </div>
        </section>

        <aside class="app-panel earth-analysis-panel">
          ${buildRightPanel(activeStock, state.tab)}
        </aside>

        <footer class="app-panel earth-footer">
          <div class="earth-feed-label">Geo Pulse</div>
          <div class="earth-feed-track">
            ${geoNewsFeed
              .map((item) => `<span>${item.headline} · ${item.region} · ${item.severity.toUpperCase()}</span>`)
              .join('')}
          </div>
        </footer>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    container.querySelectorAll('[data-action="pick-stock"]').forEach((button) => {
      button.addEventListener('click', () => {
        state.ticker = button.dataset.ticker;
        render();
      });
    });

    container.querySelectorAll('[data-action="pick-sector"]').forEach((button) => {
      button.addEventListener('click', () => {
        state.sector = button.dataset.sector;
        state.ticker = getSectorStocks(state.sector)[0].ticker;
        state.tab = 'Overall';
        render();
      });
    });

    container.querySelectorAll('[data-action="pick-region"]').forEach((button) => {
      button.addEventListener('click', () => {
        state.region = button.dataset.region;
        render();
      });
    });

    container.querySelectorAll('[data-action="adjust-scenario"]').forEach((input) => {
      input.addEventListener('input', () => {
        state.scenarios[input.dataset.scenario] = Number(input.value);
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
