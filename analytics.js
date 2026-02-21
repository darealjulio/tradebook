/* ═══════════════════════════════════════════════════
   TradeBook Advanced Analytics
   Drawdown · Day-of-Week · Distribution · Risk Metrics
   Rolling Performance · Trade Size Analysis
   ═══════════════════════════════════════════════════ */

// ——— Helpers ———
function fmtDateShort(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ——— Drawdown Tracking ———
function computeDrawdown(dailyEntries) {
  const sorted = [...dailyEntries].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return { maxDrawdown: 0, currentDrawdown: 0, daysInDD: 0, data: [] };

  let cumPnl = 0, peak = 0, maxDD = 0, currentDD = 0;
  let daysInDD = 0, ddStart = null;
  const data = [];

  sorted.forEach(d => {
    cumPnl += d.pnl;
    if (cumPnl > peak) {
      peak = cumPnl;
      ddStart = null;
    }
    const dd = peak - cumPnl;
    if (dd > 0 && !ddStart) ddStart = d.date;
    if (dd > maxDD) maxDD = dd;
    if (dd > 0) daysInDD++;
    currentDD = dd;
    data.push({ date: d.date, label: fmtDateShort(d.date), cumPnl, dd: -dd });
  });

  return { maxDrawdown: maxDD, currentDrawdown: currentDD, daysInDD, data };
}

function renderDrawdownCard(dailyEntries) {
  if (dailyEntries.length < 3) return '';
  const dd = computeDrawdown(dailyEntries);
  const fmt = (v) => {
    const abs = Math.abs(v);
    return (v >= 0 ? '+$' : '-$') + (abs >= 1000 ? (abs/1000).toFixed(1)+'K' : abs.toLocaleString());
  };
  const ddColor = dd.currentDrawdown > 0 ? 'var(--red)' : 'var(--green)';
  return '<div class="card" id="drawdown-card">' +
    '<p class="label" style="margin-bottom:10px">\uD83D\uDCC9 Drawdown Analysis</p>' +
    '<div class="grid-3" style="margin-bottom:12px">' +
    '<div class="detail-stat"><p class="label" style="font-size:0.5rem">Max DD</p><p class="mono" style="font-size:0.9375rem;font-weight:900;color:var(--red);margin-top:2px">-$' + Math.round(dd.maxDrawdown).toLocaleString() + '</p></div>' +
    '<div class="detail-stat"><p class="label" style="font-size:0.5rem">Current DD</p><p class="mono" style="font-size:0.9375rem;font-weight:900;color:' + ddColor + ';margin-top:2px">' + (dd.currentDrawdown > 0 ? '-$' + Math.round(dd.currentDrawdown).toLocaleString() : '\u2705 None') + '</p></div>' +
    '<div class="detail-stat"><p class="label" style="font-size:0.5rem">Days in DD</p><p style="font-size:0.9375rem;font-weight:900;color:var(--amber);margin-top:2px">' + dd.daysInDD + '</p></div>' +
    '</div>' +
    '<div class="chart-wrap"><canvas id="drawdown-chart" height="100"></canvas></div>' +
    '</div>';
}

function initDrawdownChart(dailyEntries) {
  if (typeof Chart === 'undefined' || dailyEntries.length < 3) return;
  const dd = computeDrawdown(dailyEntries);
  const ctx = document.getElementById('drawdown-chart');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: dd.data.map(d => d.label),
      datasets: [{
        data: dd.data.map(d => d.dd),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239,68,68,0.15)',
        fill: true,
        tension: 0.3,
        borderWidth: 1.5,
        pointRadius: 0,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: {
        backgroundColor: '#1f2937', borderColor: '#374151', borderWidth: 1,
        titleColor: '#9ca3af', bodyColor: '#fff', cornerRadius: 8, padding: 8,
        callbacks: { label: c => '$' + Math.abs(c.raw).toLocaleString() + ' drawdown' }
      }},
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 8 }, maxTicksLimit: 8 }, border: { display: false } },
        y: { grid: { color: 'rgba(31,41,55,0.5)' }, ticks: { font: { size: 8 }, callback: v => '-$' + Math.abs(v/1000).toFixed(0) + 'k' }, border: { display: false } }
      }
    }
  });
}

// ——— Day-of-Week Performance ———
function computeDayOfWeek(dailyEntries) {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const map = {};
  days.forEach(d => { map[d] = { pnl: 0, wins: 0, losses: 0, count: 0 }; });

  dailyEntries.forEach(entry => {
    const dow = days[new Date(entry.date + 'T12:00:00').getDay()];
    map[dow].pnl += entry.pnl;
    map[dow].count++;
    if (entry.pnl > 0) map[dow].wins++;
    else if (entry.pnl < 0) map[dow].losses++;
  });

  return days.map(d => ({ day: d, ...map[d], avgPnl: map[d].count > 0 ? map[d].pnl / map[d].count : 0, winRate: map[d].count > 0 ? Math.round((map[d].wins / map[d].count) * 100) : 0 }));
}

function renderDayOfWeekCard(dailyEntries) {
  if (dailyEntries.length < 5) return '';
  const dow = computeDayOfWeek(dailyEntries).filter(d => d.count > 0);
  const tradingDays = dow.filter(d => ['Mon','Tue','Wed','Thu','Fri'].includes(d.day));
  if (tradingDays.length === 0) return '';
  const best = [...tradingDays].sort((a,b) => b.avgPnl - a.avgPnl)[0];
  const worst = [...tradingDays].sort((a,b) => a.avgPnl - b.avgPnl)[0];

  return '<div class="card" id="dow-card">' +
    '<p class="label" style="margin-bottom:6px">\uD83D\uDCC6 Day-of-Week Performance</p>' +
    '<div style="display:flex;gap:8px;margin-bottom:8px">' +
    '<span style="font-size:0.625rem;color:var(--green)">\uD83C\uDFC6 Best: ' + best.day + ' (avg $' + Math.round(best.avgPnl) + ')</span>' +
    '<span style="font-size:0.625rem;color:var(--red)">\uD83D\uDCA9 Worst: ' + worst.day + ' (avg $' + Math.round(worst.avgPnl) + ')</span>' +
    '</div>' +
    '<div class="chart-wrap"><canvas id="dow-chart" height="110"></canvas></div>' +
    '<div style="display:flex;gap:4px;margin-top:8px;justify-content:space-around">' +
    tradingDays.map(d => '<div style="text-align:center"><p class="text-dim" style="font-size:0.5rem">' + d.day + '</p><p style="font-size:0.5625rem;font-weight:700;color:' + (d.winRate >= 50 ? 'var(--green)' : 'var(--red)') + '">' + d.winRate + '%</p></div>').join('') +
    '</div>' +
    '</div>';
}

function initDayOfWeekChart(dailyEntries) {
  if (typeof Chart === 'undefined' || dailyEntries.length < 5) return;
  const dow = computeDayOfWeek(dailyEntries);
  const trading = dow.filter(d => ['Mon','Tue','Wed','Thu','Fri'].includes(d.day));
  const ctx = document.getElementById('dow-chart');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: trading.map(d => d.day),
      datasets: [
        { label: 'Avg P&L', data: trading.map(d => Math.round(d.avgPnl)), backgroundColor: trading.map(d => d.avgPnl >= 0 ? 'rgba(16,185,129,0.75)' : 'rgba(239,68,68,0.75)'), borderRadius: 4, barThickness: 22 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: {
        backgroundColor: '#1f2937', borderColor: '#374151', borderWidth: 1,
        titleColor: '#9ca3af', bodyColor: '#fff', cornerRadius: 8, padding: 8,
        callbacks: { label: c => 'Avg: $' + c.raw + ' (' + (trading[c.dataIndex].count) + ' days)' }
      }},
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 9 } }, border: { display: false } },
        y: { grid: { color: 'rgba(31,41,55,0.5)' }, ticks: { font: { size: 8 }, callback: v => '$' + v }, border: { display: false } }
      }
    }
  });
}

// ——— P&L Distribution ———
function computeDistribution(dailyEntries) {
  if (dailyEntries.length === 0) return { buckets: [], mean: 0, median: 0, stdDev: 0, skew: 'N/A' };

  const pnls = dailyEntries.map(d => d.pnl).sort((a, b) => a - b);
  const mean = pnls.reduce((s, v) => s + v, 0) / pnls.length;
  const median = pnls.length % 2 === 0 ? (pnls[pnls.length/2-1] + pnls[pnls.length/2]) / 2 : pnls[Math.floor(pnls.length/2)];
  const variance = pnls.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / pnls.length;
  const stdDev = Math.sqrt(variance);

  const min = pnls[0], max = pnls[pnls.length-1];
  const range = max - min || 1;
  const numBuckets = Math.min(10, pnls.length);
  const bucketSize = range / numBuckets;
  const buckets = Array.from({ length: numBuckets }, (_, i) => ({
    label: '$' + Math.round(min + i * bucketSize),
    count: 0,
    isPositive: (min + i * bucketSize) >= 0,
  }));
  pnls.forEach(p => {
    const idx = Math.min(Math.floor((p - min) / bucketSize), numBuckets - 1);
    buckets[idx].count++;
  });

  const skew = mean > median ? 'Positive (right tail)' : mean < median ? 'Negative (left tail)' : 'Symmetric';
  return { buckets, mean, median, stdDev, skew };
}

function renderDistributionCard(dailyEntries) {
  if (dailyEntries.length < 5) return '';
  const dist = computeDistribution(dailyEntries);
  const fmt = v => (v >= 0 ? '+$' : '-$') + Math.abs(Math.round(v)).toLocaleString();
  return '<div class="card" id="dist-card">' +
    '<p class="label" style="margin-bottom:8px">\uD83D\uDCF6 P&L Distribution</p>' +
    '<div class="grid-3" style="margin-bottom:10px">' +
    '<div class="detail-stat"><p class="label" style="font-size:0.5rem">Mean</p><p class="mono" style="font-size:0.875rem;font-weight:900;color:' + (dist.mean>=0?'var(--green)':'var(--red)') + ';margin-top:2px">' + fmt(dist.mean) + '</p></div>' +
    '<div class="detail-stat"><p class="label" style="font-size:0.5rem">Median</p><p class="mono" style="font-size:0.875rem;font-weight:900;color:' + (dist.median>=0?'var(--green)':'var(--red)') + ';margin-top:2px">' + fmt(dist.median) + '</p></div>' +
    '<div class="detail-stat"><p class="label" style="font-size:0.5rem">Std Dev</p><p class="mono" style="font-size:0.875rem;font-weight:900;color:var(--amber);margin-top:2px">$' + Math.round(dist.stdDev).toLocaleString() + '</p></div>' +
    '</div>' +
    '<div class="chart-wrap"><canvas id="dist-chart" height="90"></canvas></div>' +
    '<p class="text-dim" style="font-size:0.5rem;margin-top:6px;text-align:center">Distribution: ' + dist.skew + '</p>' +
    '</div>';
}

function initDistributionChart(dailyEntries) {
  if (typeof Chart === 'undefined' || dailyEntries.length < 5) return;
  const dist = computeDistribution(dailyEntries);
  const ctx = document.getElementById('dist-chart');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dist.buckets.map(b => b.label),
      datasets: [{ data: dist.buckets.map(b => b.count), backgroundColor: dist.buckets.map(b => b.isPositive ? 'rgba(16,185,129,0.75)' : 'rgba(239,68,68,0.75)'), borderRadius: 3, barPercentage: 0.9 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: {
        backgroundColor: '#1f2937', borderColor: '#374151', borderWidth: 1,
        titleColor: '#9ca3af', bodyColor: '#fff', cornerRadius: 8, padding: 8,
        callbacks: { label: c => c.raw + ' days' }
      }},
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 7 }, maxRotation: 0 }, border: { display: false } },
        y: { grid: { color: 'rgba(31,41,55,0.5)' }, ticks: { font: { size: 8 }, stepSize: 1 }, border: { display: false } }
      }
    }
  });
}

// ——— Risk Metrics ———
function computeRiskMetrics(dailyEntries) {
  if (dailyEntries.length < 5) return null;
  const pnls = dailyEntries.map(d => d.pnl);
  const mean = pnls.reduce((s, v) => s + v, 0) / pnls.length;
  const stdDev = Math.sqrt(pnls.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / pnls.length);

  // Sharpe ratio (annualized, assume 252 trading days, risk-free ~0)
  const sharpe = stdDev > 0 ? (mean / stdDev) * Math.sqrt(252) : 0;

  // Sortino ratio (downside deviation only)
  const downsidePnls = pnls.filter(v => v < 0);
  const downsideDev = downsidePnls.length > 0 ? Math.sqrt(downsidePnls.reduce((s, v) => s + v*v, 0) / downsidePnls.length) : 0;
  const sortino = downsideDev > 0 ? (mean / downsideDev) * Math.sqrt(252) : 0;

  // Expectancy per trade
  const wins = dailyEntries.filter(d => d.pnl > 0);
  const losses = dailyEntries.filter(d => d.pnl < 0);
  const avgWin = wins.length > 0 ? wins.reduce((s, d) => s + d.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, d) => s + d.pnl, 0) / losses.length) : 0;
  const winRate = dailyEntries.length > 0 ? wins.length / dailyEntries.length : 0;
  const expectancy = (winRate * avgWin) - ((1 - winRate) * avgLoss);

  // Payoff ratio
  const payoff = avgLoss > 0 ? avgWin / avgLoss : 0;

  // Daily volatility
  const volatility = stdDev;

  return { sharpe, sortino, expectancy, payoff, volatility, avgWin, avgLoss, winRate };
}

function metricColor(val, thresholds) {
  if (val >= thresholds[1]) return 'var(--green)';
  if (val >= thresholds[0]) return 'var(--amber)';
  return 'var(--red)';
}

function renderRiskMetricsCard(dailyEntries) {
  if (dailyEntries.length < 5) return '';
  const m = computeRiskMetrics(dailyEntries);
  if (!m) return '';

  const row = (label, val, color, target) =>
    '<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--border)">' +
    '<span class="text-dim" style="font-size:0.625rem">' + label + '</span>' +
    '<div class="row gap-8"><span class="mono" style="font-size:0.75rem;font-weight:800;color:' + color + '">' + val + '</span>' +
    '<span class="text-dim" style="font-size:0.5rem">target ' + target + '</span></div>' +
    '</div>';

  return '<div class="card" id="risk-card">' +
    '<p class="label" style="margin-bottom:8px">\uD83C\uDFAF Risk Metrics</p>' +
    row('Sharpe Ratio', m.sharpe.toFixed(2), metricColor(m.sharpe, [0.5, 1.0]), '>1.0') +
    row('Sortino Ratio', m.sortino.toFixed(2), metricColor(m.sortino, [1.0, 2.0]), '>2.0') +
    row('Expectancy/Day', (m.expectancy >= 0 ? '+$' : '-$') + Math.abs(Math.round(m.expectancy)).toLocaleString(), m.expectancy >= 0 ? 'var(--green)' : 'var(--red)', '>$0') +
    row('Payoff Ratio', m.payoff.toFixed(2) + ':1', metricColor(m.payoff, [1.0, 1.5]), '>1.5') +
    row('Win Rate', Math.round(m.winRate*100) + '%', metricColor(m.winRate, [0.4, 0.55]), '>55%') +
    row('Daily Volatility', '$' + Math.round(m.volatility).toLocaleString(), 'var(--text-1)', 'lower=better') +
    '</div>';
}

// ——— Rolling Performance (5-day) ———
function computeRolling(dailyEntries, windowDays) {
  const sorted = [...dailyEntries].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < windowDays) return [];

  const results = [];
  for (let i = windowDays - 1; i < sorted.length; i++) {
    const window = sorted.slice(i - windowDays + 1, i + 1);
    const pnl = window.reduce((s, d) => s + d.pnl, 0);
    const wins = window.filter(d => d.pnl > 0).length;
    const totalTrades = window.reduce((s, d) => s + d.trades, 0);
    const totalWins = window.reduce((s, d) => s + d.wins, 0);
    results.push({
      date: sorted[i].date,
      label: fmtDateShort(sorted[i].date),
      pnl,
      winRate: totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0,
      greenDayPct: (wins / windowDays) * 100,
    });
  }
  return results;
}

function renderRollingCard(dailyEntries) {
  if (dailyEntries.length < 5) return '';
  const windowSize = Math.min(5, dailyEntries.length);
  const rolling = computeRolling(dailyEntries, windowSize);
  if (rolling.length < 2) return '';

  const last = rolling[rolling.length - 1];
  const prev = rolling[rolling.length - 2];
  const trend = last.pnl > prev.pnl ? '\u2197 Improving' : '\u2198 Declining';
  const trendColor = last.pnl > prev.pnl ? 'var(--green)' : 'var(--red)';

  return '<div class="card" id="rolling-card">' +
    '<div class="row between" style="margin-bottom:8px">' +
    '<p class="label">\uD83D\uDCDF Rolling ' + windowSize + '-Day P&L</p>' +
    '<span style="font-size:0.625rem;color:' + trendColor + '">' + trend + '</span>' +
    '</div>' +
    '<div class="chart-wrap"><canvas id="rolling-chart" height="100"></canvas></div>' +
    '</div>';
}

function initRollingChart(dailyEntries) {
  if (typeof Chart === 'undefined' || dailyEntries.length < 5) return;
  const windowSize = Math.min(5, dailyEntries.length);
  const rolling = computeRolling(dailyEntries, windowSize);
  const ctx = document.getElementById('rolling-chart');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: rolling.map(d => d.label),
      datasets: [{
        data: rolling.map(d => Math.round(d.pnl)),
        borderColor: rolling.map((d, i) => d.pnl >= 0 ? '#10b981' : '#ef4444'),
        segment: { borderColor: ctx2 => ctx2.p0.parsed.y >= 0 && ctx2.p1.parsed.y >= 0 ? '#10b981' : ctx2.p0.parsed.y < 0 && ctx2.p1.parsed.y < 0 ? '#ef4444' : '#f59e0b' },
        backgroundColor: 'transparent',
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: rolling.map(d => d.pnl >= 0 ? '#10b981' : '#ef4444'),
        pointBorderColor: '#070b14',
        pointBorderWidth: 2,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: {
        backgroundColor: '#1f2937', borderColor: '#374151', borderWidth: 1,
        titleColor: '#9ca3af', bodyColor: '#fff', cornerRadius: 8, padding: 8,
        callbacks: { label: c => windowSize + '-day P&L: $' + c.raw.toLocaleString() }
      }},
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 8 }, maxTicksLimit: 8 }, border: { display: false } },
        y: { grid: { color: 'rgba(31,41,55,0.5)' }, ticks: { font: { size: 8 }, callback: v => '$' + (v/1000).toFixed(0) + 'k' }, border: { display: false } }
      }
    }
  });
}

// ——— Trade Count vs P&L ———
function computeTradeSizeCorrelation(dailyEntries) {
  if (dailyEntries.length < 5) return null;
  const n = dailyEntries.length;
  const xs = dailyEntries.map(d => d.trades);
  const ys = dailyEntries.map(d => d.pnl);
  const xBar = xs.reduce((s,v) => s+v, 0) / n;
  const yBar = ys.reduce((s,v) => s+v, 0) / n;
  const cov = xs.reduce((s,v,i) => s + (v-xBar)*(ys[i]-yBar), 0) / n;
  const xStd = Math.sqrt(xs.reduce((s,v) => s+Math.pow(v-xBar,2), 0) / n);
  const yStd = Math.sqrt(ys.reduce((s,v) => s+Math.pow(v-yBar,2), 0) / n);
  const r = (xStd > 0 && yStd > 0) ? cov / (xStd * yStd) : 0;

  const greenAvg = dailyEntries.filter(d => d.pnl > 0).reduce((s,d) => s+d.trades, 0) / (dailyEntries.filter(d=>d.pnl>0).length || 1);
  const redAvg = dailyEntries.filter(d => d.pnl < 0).reduce((s,d) => s+d.trades, 0) / (dailyEntries.filter(d=>d.pnl<0).length || 1);

  let interpretation = '';
  if (r < -0.3) interpretation = 'More trades = worse results. You overtrade.';
  else if (r > 0.3) interpretation = 'More trades correlates with better results.';
  else interpretation = 'Trade count has little correlation with P&L.';

  return { r, greenAvg, redAvg, interpretation };
}

function renderTradeSizeCard(dailyEntries) {
  if (dailyEntries.length < 5) return '';
  const corr = computeTradeSizeCorrelation(dailyEntries);
  if (!corr) return '';

  const corrColor = corr.r < -0.2 ? 'var(--red)' : corr.r > 0.2 ? 'var(--green)' : 'var(--amber)';

  return '<div class="card" id="tradesize-card">' +
    '<p class="label" style="margin-bottom:10px">\uD83D\uDD22 Trade Count vs P&L</p>' +
    '<div class="grid-3" style="margin-bottom:10px">' +
    '<div class="detail-stat"><p class="label" style="font-size:0.5rem">Correlation</p><p class="mono" style="font-size:0.9375rem;font-weight:900;color:' + corrColor + ';margin-top:2px">' + corr.r.toFixed(2) + '</p></div>' +
    '<div class="detail-stat"><p class="label" style="font-size:0.5rem">Green Day Avg</p><p style="font-size:0.9375rem;font-weight:900;color:var(--green);margin-top:2px">' + corr.greenAvg.toFixed(1) + 't</p></div>' +
    '<div class="detail-stat"><p class="label" style="font-size:0.5rem">Red Day Avg</p><p style="font-size:0.9375rem;font-weight:900;color:var(--red);margin-top:2px">' + corr.redAvg.toFixed(1) + 't</p></div>' +
    '</div>' +
    '<div style="padding:10px;background:var(--bg-0);border-radius:8px;border:1px solid var(--border)">' +
    '<p style="font-size:0.75rem;color:' + corrColor + ';font-weight:700">' + corr.interpretation + '</p>' +
    (corr.r < -0.2 ? '<p class="text-dim" style="font-size:0.625rem;margin-top:4px">Consider limiting max daily trades to reduce overtrading.</p>' : '') +
    '</div>' +
    '</div>';
}

// ——— Public API ———
window.TradeBookAnalytics = {
  // Drawdown
  renderDrawdownCard,
  initDrawdownChart,
  // Day of Week
  renderDayOfWeekCard,
  initDayOfWeekChart,
  // Distribution
  renderDistributionCard,
  initDistributionChart,
  // Risk Metrics
  renderRiskMetricsCard,
  // Rolling
  renderRollingCard,
  initRollingChart,
  // Trade Size
  renderTradeSizeCard,
  // Render all cards (returns HTML string)
  renderAll: function(dailyEntries) {
    return renderDrawdownCard(dailyEntries) +
      renderDayOfWeekCard(dailyEntries) +
      renderDistributionCard(dailyEntries) +
      renderRiskMetricsCard(dailyEntries) +
      renderRollingCard(dailyEntries) +
      renderTradeSizeCard(dailyEntries);
  },
  // Initialize all charts (call after HTML is in DOM)
  initAll: function(dailyEntries) {
    initDrawdownChart(dailyEntries);
    initDayOfWeekChart(dailyEntries);
    initDistributionChart(dailyEntries);
    initRollingChart(dailyEntries);
  },
};
