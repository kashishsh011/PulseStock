export function formatSigned(value, digits = 2) {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${Math.abs(value).toFixed(digits)}`;
}

export function scoreToTone(score) {
  if (score >= 0.2) return 'positive';
  if (score <= -0.1) return 'negative';
  return 'neutral';
}

export function labelToTone(label = '') {
  const normalized = label.toUpperCase();
  if (normalized.includes('BULLISH')) return 'positive';
  if (normalized.includes('BEARISH')) return 'negative';
  if (normalized.includes('CONFLICTED')) return 'warning';
  return 'neutral';
}

export function sentimentToTone(sentiment = '') {
  const normalized = sentiment.toUpperCase();
  if (normalized === 'POSITIVE') return 'positive';
  if (normalized === 'NEGATIVE') return 'negative';
  return 'neutral';
}

export function severityToTone(severity = '') {
  const normalized = severity.toLowerCase();
  if (normalized === 'critical') return 'negative';
  if (normalized === 'high') return 'warning';
  return 'positive';
}

export function buildBipolarBar({ label, value }) {
  const width = Math.min(50, Math.abs(value) * 50);
  const left = value >= 0 ? 50 : 50 - width;
  const tone = scoreToTone(value);
  const display = formatSigned(value, 2);

  return `
    <div class="bipolar-row">
      <div class="bipolar-head">
        <span>${label}</span>
        <span class="bipolar-value tone-${tone}">${display}</span>
      </div>
      <div class="bipolar-track">
        <div class="bipolar-center"></div>
        <div class="bipolar-fill tone-${tone}" style="width:${width}%; left:${left}%;"></div>
      </div>
      <div class="bipolar-scale">
        <span>-1</span>
        <span>0</span>
        <span>+1</span>
      </div>
    </div>
  `;
}

export function buildNewsRow(item) {
  return `
    <article class="news-list-item tone-${sentimentToTone(item.sentiment)}">
      <div class="news-list-head">
        <span class="tone-pill tone-${sentimentToTone(item.sentiment)}">${item.sentiment}</span>
        <span class="subtle-copy">${item.source} / ${item.time}</span>
      </div>
      <p>${item.headline}</p>
    </article>
  `;
}
