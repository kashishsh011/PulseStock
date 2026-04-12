import * as d3 from 'd3';
import { feature as topoFeature } from 'topojson-client';
import { CandlestickSeries, ColorType, CrosshairMode, createChart } from 'lightweight-charts';
import worldAtlas from 'world-atlas/countries-110m.json';
import {
  geoAssets,
  geoNewsFeed,
  getCountryProfile,
  getDefaultGeoState,
  getGeoAssetKeyForCountry,
  getSectorStocks,
  getTensionColor,
  getTensionTier,
  macroStats,
  trendHistory,
} from '../data/appData.js';
import { buildBipolarBar, buildNewsRow, labelToTone, severityToTone } from '../utils/viewHelpers.js';

const MAP_WIDTH = 1120;
const MAP_HEIGHT = 720;

function getFeatureName(mapFeature) {
  return mapFeature?.properties?.name || mapFeature?.properties?.NAME || mapFeature?.properties?.ADMIN || 'Unknown';
}

function getFeatureIso(mapFeature) {
  const iso = mapFeature?.properties?.iso_a3 || mapFeature?.properties?.ISO_A3 || mapFeature?.properties?.adm0_a3;
  return iso && iso !== '-99' ? iso : String(mapFeature?.id || 'UNK');
}

function getFeatureRegion(mapFeature) {
  return mapFeature?.properties?.region_wb || mapFeature?.properties?.continent || mapFeature?.properties?.CONTINENT || 'Global';
}

function buildBottomBarMarkup() {
  return `
    <div class="trend-cluster">
      <div class="trend-copy">
        <span class="eyebrow">GTI Trend</span>
        <strong>${macroStats.gti}</strong>
      </div>
      <div class="trend-bar-row">
        ${trendHistory
          .map((value, index) => {
            const tone = value >= 70 ? 'negative' : value >= 58 ? 'warning' : 'positive';
            return `<span class="trend-square tone-${tone}" style="height:${Math.max(16, value * 0.42)}px" aria-hidden="true"></span>`;
          })
          .join('')}
      </div>
    </div>
    <div class="news-pill-row">
      ${geoNewsFeed
        .map((item) => {
          return `
            <article class="news-pill-card tone-${severityToTone(item.severity)}">
              <span class="news-pill-marker"></span>
              <div>
                <strong>${item.headline}</strong>
                <small>${item.time} · ${item.region} · ${item.severity.toUpperCase()}</small>
              </div>
            </article>
          `;
        })
        .join('')}
    </div>
  `;
}

function buildFilterPanelMarkup(isOpen) {
  return `
    <div class="filter-panel-header">
      <span class="eyebrow">Market Impact Map</span>
      <button class="filter-toggle-button" data-action="toggle-filters">
        <span>Filters</span>
        <span class="live-badge">Live</span>
      </button>
    </div>
    ${isOpen ? `
      <div class="filter-panel-body">
        <div class="legend-stack">
          <div class="legend-row"><span class="legend-dot tone-negative"></span><span>Critical &gt;80</span></div>
          <div class="legend-row"><span class="legend-dot tone-info"></span><span>Medium &gt;35</span></div>
          <div class="legend-row"><span class="legend-dot tone-positive"></span><span>Low &lt;35</span></div>
        </div>
        <p class="filter-note">Drag the map to move across continents and click any country to focus the side panel.</p>
        <span class="status-pill">Pan Enabled</span>
      </div>
    ` : ''}
  `;
}

function buildCountryCard(country) {
  return `
    <section class="geo-country-card">
      <div class="geo-country-copy">
        <div>
          <h2>${country.name}</h2>
          <p>${country.region}</p>
        </div>
        <span class="tension-badge tone-${getTensionTier(country.score) === 'critical' ? 'negative' : getTensionTier(country.score) === 'medium' ? 'warning' : 'positive'}">
          Tension ${country.score}/100
        </span>
      </div>
      <div class="tag-row">
        ${country.commodities.map((commodity) => `<span class="soft-pill">${commodity}</span>`).join('')}
      </div>
    </section>
  `;
}

function buildAssetGrid(selectedAssetKey) {
  return `
    <section class="geo-asset-grid">
      ${Object.values(geoAssets)
        .map((asset) => {
          return `
            <button class="geo-asset-card ${asset.key === selectedAssetKey ? 'is-active' : ''}" data-action="pick-asset" data-asset="${asset.key}">
              <span>${asset.key}</span>
              <strong>${asset.priceLabel}</strong>
              <small class="tone-${asset.tone}">${asset.changeLabel}</small>
            </button>
          `;
        })
        .join('')}
    </section>
  `;
}

function buildWatchlistMarkup(stocks) {
  return `
    <section class="watchlist-card">
      <div class="watchlist-header">
        <span class="eyebrow">Related Equities</span>
        <strong>${stocks.length} tracked names</strong>
      </div>
      <div class="watchlist-list">
        ${stocks
          .map((stock) => {
            return `
              <button class="watchlist-row" data-action="pick-stock" data-ticker="${stock.ticker}">
                <span>
                  <strong>${stock.name}</strong>
                  <small>${stock.ticker}</small>
                </span>
                <span class="tone-pill tone-${labelToTone(stock.label)}">${stock.label}</span>
              </button>
            `;
          })
          .join('')}
      </div>
    </section>
  `;
}

function buildStockDetailMarkup(stock) {
  return `
    <section class="stock-focus-card">
      <div class="stock-focus-head">
        <button class="icon-button" data-action="show-watchlist" aria-label="Back to stock list">←</button>
        <strong>${stock.name}</strong>
        <span class="tone-pill tone-${labelToTone(stock.label)}">${stock.label}</span>
      </div>
      ${buildBipolarBar({ label: 'Fusion Score', value: stock.score })}
      ${buildBipolarBar({ label: 'Fundamental', value: stock.breakdown.F })}
      ${buildBipolarBar({ label: 'Technical', value: stock.breakdown.T })}
      ${buildBipolarBar({ label: 'News', value: stock.breakdown.N })}
      ${buildBipolarBar({ label: 'Global', value: stock.breakdown.G })}
    </section>
  `;
}

function buildChartCard(asset) {
  return `
    <section class="geo-chart-card">
      <div class="chart-title-row">
        <div>
          <span class="eyebrow">${asset.context}</span>
          <h3>${asset.name} <small>/ ${asset.symbol}</small></h3>
        </div>
        <strong class="tone-${asset.tone}">${asset.changeLabel}</strong>
      </div>
      <div class="geo-chart-root" data-geo-chart></div>
      <div class="ohlc-grid">
        <div class="metric-card"><span>Open</span><strong>${asset.stats.open.toFixed(asset.digits ?? 2)}</strong></div>
        <div class="metric-card"><span>High</span><strong>${asset.stats.high.toFixed(asset.digits ?? 2)}</strong></div>
        <div class="metric-card"><span>Low</span><strong>${asset.stats.low.toFixed(asset.digits ?? 2)}</strong></div>
        <div class="metric-card"><span>Close</span><strong>${asset.stats.close.toFixed(asset.digits ?? 2)}</strong></div>
      </div>
      <div class="detail-block">
        <span class="eyebrow">Sector Exposure</span>
        ${asset.exposures
          .map((exposure) => {
            return `
              <div class="exposure-row">
                <span>${exposure.label}</span>
                <div class="exposure-track"><div class="exposure-fill" style="width:${exposure.value}%"></div></div>
                <strong>${exposure.value}%</strong>
              </div>
            `;
          })
          .join('')}
      </div>
    </section>
  `;
}

function buildTabBar(activeTab) {
  return ['Overall', 'Fundamental', 'Technical', 'News AI']
    .map((tab) => {
      return `
        <button class="analysis-tab ${tab === activeTab ? 'is-active' : ''}" data-action="pick-tab" data-tab="${tab}">
          ${tab}
        </button>
      `;
    })
    .join('');
}

function buildTabContent(stock, asset, country, activeTab) {
  if (activeTab === 'Fundamental') {
    return `
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
    return `
      <div class="metric-grid">
        <div class="metric-card"><span>RSI</span><strong>${stock.technical.rsi}</strong></div>
        <div class="metric-card"><span>Price vs WMA</span><strong>${stock.technical.priceVsWMA}%</strong></div>
        <div class="metric-card"><span>MACD</span><strong>${stock.technical.macd}</strong></div>
        <div class="metric-card"><span>Volume</span><strong>${stock.technical.volumeTrend}</strong></div>
        <div class="metric-card"><span>Support</span><strong>${stock.technical.support}</strong></div>
        <div class="metric-card"><span>Resistance</span><strong>${stock.technical.resistance}</strong></div>
      </div>
    `;
  }

  if (activeTab === 'News AI') {
    return `<div class="news-list">${stock.news.map(buildNewsRow).join('')}</div>`;
  }

  return `
    <div class="detail-block">
      <p>${country.name} is currently routing risk through <strong>${asset.name}</strong>, while <strong>${stock.name}</strong> remains the primary equity lens for the side panel.</p>
      <p class="subtle-copy">${asset.insight}</p>
      <p class="subtle-copy">${stock.overview}</p>
    </div>
  `;
}

function createGeoChart(root, asset) {
  const width = Math.max(root.clientWidth, 320);
  const height = Math.max(root.clientHeight, 260);

  const chart = createChart(root, {
    width,
    height,
    layout: {
      background: { type: ColorType.Solid, color: '#0f131e' },
      textColor: '#94a3b8',
      attributionLogo: false,
    },
    grid: {
      vertLines: { color: 'rgba(148, 163, 184, 0.08)' },
      horzLines: { color: 'rgba(148, 163, 184, 0.08)' },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: { color: 'rgba(56, 189, 248, 0.3)', width: 1 },
      horzLine: { color: 'rgba(56, 189, 248, 0.18)', width: 1 },
    },
    rightPriceScale: {
      borderColor: 'rgba(148, 163, 184, 0.16)',
    },
    timeScale: {
      borderColor: 'rgba(148, 163, 184, 0.16)',
      timeVisible: true,
      secondsVisible: false,
    },
    handleScroll: {
      vertTouchDrag: false,
    },
    handleScale: {
      axisDoubleClickReset: false,
    },
  });

  const series = chart.addSeries(CandlestickSeries, {
    upColor: '#22c55e',
    downColor: '#ef4444',
    wickUpColor: '#22c55e',
    wickDownColor: '#ef4444',
    borderVisible: false,
  });

  series.setData(asset.candles);
  chart.timeScale().fitContent();

  return chart;
}

export function mount(container) {
  const defaults = getDefaultGeoState();
  const state = {
    country: defaults.country,
    assetKey: defaults.assetKey,
    sector: defaults.sector,
    ticker: defaults.ticker,
    tab: 'Overall',
    panelMode: 'detail',
    filtersOpen: true,
    hoveredIso: null,
  };

  let mapSelection;
  let geoTooltip;
  let chart;
  let chartResizeObserver;

  container.innerHTML = `
    <div class="geo-view-shell">
      <div class="geo-map-shell">
        <div class="geo-map-stage" data-geo-map></div>
        <div class="geo-tooltip" data-geo-tooltip hidden></div>
        <aside class="geo-floating-panel" data-geo-filter></aside>
      </div>
      <aside class="app-panel geo-analysis-panel" data-geo-panel></aside>
      <div class="app-panel geo-bottom-bar" data-geo-bottom></div>
    </div>
  `;

  const mapRoot = container.querySelector('[data-geo-map]');
  const filterRoot = container.querySelector('[data-geo-filter]');
  const panelRoot = container.querySelector('[data-geo-panel]');
  const bottomRoot = container.querySelector('[data-geo-bottom]');
  geoTooltip = container.querySelector('[data-geo-tooltip]');

  bottomRoot.innerHTML = buildBottomBarMarkup();

  function renderFilterPanel() {
    filterRoot.innerHTML = buildFilterPanelMarkup(state.filtersOpen);
    filterRoot.querySelector('[data-action="toggle-filters"]')?.addEventListener('click', () => {
      state.filtersOpen = !state.filtersOpen;
      renderFilterPanel();
    });
  }

  function renderPanel() {
    const stocks = getSectorStocks(state.sector);
    const activeStock = stocks.find((stock) => stock.ticker === state.ticker) || stocks[0];
    const activeAsset = geoAssets[state.assetKey];

    panelRoot.innerHTML = `
      ${buildCountryCard(state.country)}
      ${buildAssetGrid(state.assetKey)}
      ${state.panelMode === 'list' ? buildWatchlistMarkup(stocks) : buildStockDetailMarkup(activeStock)}
      ${buildChartCard(activeAsset)}
      <section class="detail-block geo-tabs-section">
        <div class="analysis-tabs">${buildTabBar(state.tab)}</div>
        ${buildTabContent(activeStock, activeAsset, state.country, state.tab)}
      </section>
    `;

    panelRoot.querySelectorAll('[data-action="pick-asset"]').forEach((button) => {
      button.addEventListener('click', () => {
        state.assetKey = button.dataset.asset;
        renderPanel();
      });
    });

    panelRoot.querySelectorAll('[data-action="show-watchlist"]').forEach((button) => {
      button.addEventListener('click', () => {
        state.panelMode = 'list';
        renderPanel();
      });
    });

    panelRoot.querySelectorAll('[data-action="pick-stock"]').forEach((button) => {
      button.addEventListener('click', () => {
        state.ticker = button.dataset.ticker;
        state.panelMode = 'detail';
        renderPanel();
      });
    });

    panelRoot.querySelectorAll('[data-action="pick-tab"]').forEach((button) => {
      button.addEventListener('click', () => {
        state.tab = button.dataset.tab;
        renderPanel();
      });
    });

    chartResizeObserver?.disconnect();
    chart?.remove();

    const chartRoot = panelRoot.querySelector('[data-geo-chart]');
    chart = createGeoChart(chartRoot, activeAsset);
    chartResizeObserver = new ResizeObserver(() => {
      chart.applyOptions({
        width: Math.max(chartRoot.clientWidth, 320),
        height: Math.max(chartRoot.clientHeight, 260),
      });
      chart.timeScale().fitContent();
    });
    chartResizeObserver.observe(chartRoot);
  }

  function updateMapStyling() {
    if (!mapSelection) return;

    mapSelection
      .attr('fill', (mapFeature) => {
        const country = getCountryProfile({
          name: getFeatureName(mapFeature),
          iso: getFeatureIso(mapFeature),
          region: getFeatureRegion(mapFeature),
        });
        return getTensionColor(country.score);
      })
      .attr('opacity', (mapFeature) => {
        const iso = getFeatureIso(mapFeature);
        if (state.hoveredIso && state.hoveredIso !== iso) return 0.72;
        return 1;
      })
      .classed('is-selected', (mapFeature) => {
        const country = getCountryProfile({
          name: getFeatureName(mapFeature),
          iso: getFeatureIso(mapFeature),
          region: getFeatureRegion(mapFeature),
        });
        return country.name === state.country.name;
      })
      .classed('is-hovered', (mapFeature) => getFeatureIso(mapFeature) === state.hoveredIso);
  }

  function createMap() {
    const mapFeatures = topoFeature(worldAtlas, worldAtlas.objects.countries).features;
    const projection = d3.geoNaturalEarth1().fitExtent(
      [[32, 40], [MAP_WIDTH - 28, MAP_HEIGHT - 26]],
      { type: 'Sphere' },
    );
    const path = d3.geoPath(projection);
    const graticule = d3.geoGraticule10();

    const svg = d3
      .select(mapRoot)
      .append('svg')
      .attr('class', 'geo-map-svg')
      .attr('viewBox', `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    const mapGroup = svg.append('g');

    mapGroup
      .append('path')
      .datum({ type: 'Sphere' })
      .attr('class', 'geo-sphere')
      .attr('d', path);

    mapGroup
      .append('path')
      .datum(graticule)
      .attr('class', 'geo-graticule')
      .attr('d', path);

    mapSelection = mapGroup
      .selectAll('.geo-country-shape')
      .data(mapFeatures)
      .join('path')
      .attr('class', 'geo-country-shape')
      .attr('d', path)
      .on('mouseenter', (_, mapFeature) => {
        state.hoveredIso = getFeatureIso(mapFeature);
        const country = getCountryProfile({
          name: getFeatureName(mapFeature),
          iso: getFeatureIso(mapFeature),
          region: getFeatureRegion(mapFeature),
        });
        geoTooltip.hidden = false;
        geoTooltip.innerHTML = `
          <strong>${country.name}</strong>
          <span>${country.region}</span>
          <small>Tension ${country.score}/100</small>
        `;
        updateMapStyling();
      })
      .on('mousemove', (event) => {
        const [x, y] = d3.pointer(event, mapRoot);
        geoTooltip.style.left = `${x + 18}px`;
        geoTooltip.style.top = `${y + 18}px`;
      })
      .on('mouseleave', () => {
        state.hoveredIso = null;
        geoTooltip.hidden = true;
        updateMapStyling();
      })
      .on('click', (_, mapFeature) => {
        state.country = getCountryProfile({
          name: getFeatureName(mapFeature),
          iso: getFeatureIso(mapFeature),
          region: getFeatureRegion(mapFeature),
        });
        state.assetKey = getGeoAssetKeyForCountry(state.country);
        state.panelMode = 'detail';
        updateMapStyling();
        renderPanel();
        panelRoot.scrollTo({ top: 0, behavior: 'smooth' });
      });

    const zoomBehavior = d3
      .zoom()
      .scaleExtent([1, 6])
      .translateExtent([[-MAP_WIDTH, -MAP_HEIGHT], [MAP_WIDTH * 2, MAP_HEIGHT * 2]])
      .on('zoom', (event) => {
        mapGroup.attr('transform', event.transform);
      });

    svg.call(zoomBehavior).call(zoomBehavior.transform, d3.zoomIdentity.translate(34, 10).scale(1.16));
    svg.on('dblclick.zoom', null);

    updateMapStyling();
  }

  renderFilterPanel();
  renderPanel();
  createMap();

  return {
    onShow() {
      const chartRoot = panelRoot.querySelector('[data-geo-chart]');
      if (chart && chartRoot) {
        chart.applyOptions({
          width: Math.max(chartRoot.clientWidth, 320),
          height: Math.max(chartRoot.clientHeight, 260),
        });
        chart.timeScale().fitContent();
      }
    },
    destroy() {
      chartResizeObserver?.disconnect();
      chart?.remove();
    },
  };
}
