/** TradingView Lightweight Charts candlestick mount (same options as geo sidebar). */

const lwInstances = new Map();

/**
 * @param {string} canvasId - Initial <canvas> id (removed after first mount)
 * @param {Array} candles - { open, high, low, close, time } (time ms)
 * @param {string} lwDivId - Stable container id for the chart div
 */
export function mountLightweightCandlestickFromCanvas(canvasId, candles, lwDivId) {
  if (!candles?.length) return candles;

  const oldCanvas = document.getElementById(canvasId);
  let container = null;
  if (oldCanvas) {
    container = oldCanvas.parentElement;
    if (!container) return candles;
    oldCanvas.remove();
  } else {
    const existingDiv = document.getElementById(lwDivId);
    if (!existingDiv?.parentElement) return candles;
    container = existingDiv.parentElement;
  }

  let chartDiv = document.getElementById(lwDivId);
  if (!chartDiv) {
    chartDiv = document.createElement('div');
    chartDiv.id = lwDivId;
  }
  chartDiv.style.cssText = `
      width: 100%;
      height: 220px;
      border-radius: 8px;
      overflow: hidden;
      background: rgba(0,0,0,0.2);
      border: 1px solid rgba(255,255,255,0.08);
    `;
  if (chartDiv.parentElement !== container) {
    container.insertBefore(chartDiv, container.firstChild);
  }

  if (chartDiv._lwResizeObserver) {
    chartDiv._lwResizeObserver.disconnect();
    chartDiv._lwResizeObserver = null;
  }

  const prev = lwInstances.get(lwDivId);
  if (prev?.chart) {
    prev.chart.remove();
    lwInstances.delete(lwDivId);
  }

  if (typeof LightweightCharts === 'undefined' || !LightweightCharts.createChart) return candles;

  const lwChart = LightweightCharts.createChart(chartDiv, {
    width: chartDiv.offsetWidth || 480,
    height: 220,
    layout: {
      background: { type: 'solid', color: 'rgba(0,0,0,0)' },
      textColor: '#aab4c8',
      fontSize: 10,
      fontFamily: 'monospace',
    },
    grid: {
      vertLines: { color: 'rgba(255,255,255,0.04)' },
      horzLines: { color: 'rgba(255,255,255,0.04)' },
    },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
      vertLine: {
        color: 'rgba(255,255,255,0.3)',
        labelBackgroundColor: '#1e293b',
      },
      horzLine: {
        color: 'rgba(255,255,255,0.3)',
        labelBackgroundColor: '#1e293b',
      },
    },
    rightPriceScale: {
      borderColor: 'rgba(255,255,255,0.08)',
      textColor: '#aab4c8',
      scaleMargins: { top: 0.1, bottom: 0.1 },
    },
    timeScale: {
      borderColor: 'rgba(255,255,255,0.08)',
      timeVisible: true,
      secondsVisible: false,
      tickMarkFormatter: (time) => {
        const d = new Date(time * 1000);
        return d.getHours().toString().padStart(2, '0') + ':' +
          d.getMinutes().toString().padStart(2, '0');
      },
    },
    handleScroll: true,
    handleScale: true,
  });

  const lwSeries = lwChart.addCandlestickSeries({
    upColor: '#22c55e',
    downColor: '#ef4444',
    borderUpColor: '#22c55e',
    borderDownColor: '#ef4444',
    wickUpColor: '#22c55e',
    wickDownColor: '#ef4444',
  });

  lwInstances.set(lwDivId, { chart: lwChart, series: lwSeries });

  const lwData = candles.map((c) => ({
    time: Math.floor(c.time / 1000),
    open: parseFloat(c.open.toFixed(4)),
    high: parseFloat(c.high.toFixed(4)),
    low: parseFloat(c.low.toFixed(4)),
    close: parseFloat(c.close.toFixed(4)),
  }));

  lwData.sort((a, b) => a.time - b.time);
  lwSeries.setData(lwData);
  lwChart.timeScale().fitContent();

  if (window.ResizeObserver) {
    chartDiv._lwResizeObserver = new ResizeObserver(() => {
      const inst = lwInstances.get(lwDivId);
      if (inst?.chart && chartDiv.offsetWidth > 0) {
        inst.chart.applyOptions({ width: chartDiv.offsetWidth });
      }
    });
    chartDiv._lwResizeObserver.observe(chartDiv);
  }

  return candles;
}
