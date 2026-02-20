/* ═══════════════════════════════════════════════════
   TradeBook — Features Module
   Streak Tracker · Strategy Breakdown · Monthly Recap
   CSV Export · Custom Strategies · Rule Violations
   ═══════════════════════════════════════════════════ */

// ——— Custom Strategies (persisted in localStorage) ———
function getCustomStrategies() {
  try { return JSON.parse(localStorage.getItem('tb_custom_strategies') || '[]'); }
  catch(e) { return []; }
}

function addCustomStrategy(name) {
  if (!name || !name.trim()) return;
  var list = getCustomStrategies();
  var trimmed = name.trim();
  if (list.indexOf(trimmed) === -1) {
    list.push(trimmed);
    localStorage.setItem('tb_custom_strategies', JSON.stringify(list));
  }
}

function removeCustomStrategy(name) {
  var list = getCustomStrategies().filter(function(s) { return s !== name; });
  localStorage.setItem('tb_custom_strategies', JSON.stringify(list));
}

function getAllStrategies() {
  var defaults = ['ORB Breakout', 'EMA Tap', 'Supply Reject', 'Demand Bounce', 'Reversal'];
  return defaults.concat(getCustomStrategies());
}

// ——— Streak Tracker ———
function computeStreaks(daily, journal) {
  var sorted = (daily || []).slice().sort(function(a,b) { return b.date.localeCompare(a.date); });
  var greenStreak = 0;
  for (var i = 0; i < sorted.length; i++) {
    if (sorted[i].pnl > 0) greenStreak++;
    else break;
  }
  var jDates = {};
  (journal || []).forEach(function(j) { jDates[j.date] = true; });
  var journalStreak = 0;
  var d = new Date();
  for (var i = 0; i < 365; i++) {
    var ds = d.toISOString().split('T')[0];
    if (jDates[ds]) { journalStreak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  var allSorted = (daily || []).slice().sort(function(a,b) { return a.date.localeCompare(b.date); });
  var bestStreak = 0, cur = 0;
  allSorted.forEach(function(d) {
    if (d.pnl > 0) { cur++; if (cur > bestStreak) bestStreak = cur; }
    else cur = 0;
  });
  return { greenStreak: greenStreak, journalStreak: journalStreak, bestStreak: bestStreak };
}

function renderStreakCard(daily, journal) {
  var s = computeStreaks(daily, journal);
  var fire = function(n) {
    if (n >= 10) return '\u{1F525}\u{1F525}\u{1F525}';
    if (n >= 5) return '\u{1F525}\u{1F525}';
    if (n >= 1) return '\u{1F525}';
    return '\u26AA';
  };
  return '<div class="card card-amber">' +
    '<p class="label" style="margin-bottom:8px">\u{1F525} Streaks</p>' +
    '<div class="grid-3">' +
    '<div style="text-align:center"><p style="font-size:1.5rem;font-weight:900;color:var(--green)">' + s.greenStreak + '</p><p class="text-dim" style="font-size:0.5625rem">' + fire(s.greenStreak) + ' Green Days</p></div>' +
    '<div style="text-align:center"><p style="font-size:1.5rem;font-weight:900;color:var(--amber)">' + s.journalStreak + '</p><p class="text-dim" style="font-size:0.5625rem">\u270D\uFE0F Journal</p></div>' +
    '<div style="text-align:center"><p style="font-size:1.5rem;font-weight:900;color:var(--violet)">' + s.bestStreak + '</p><p class="text-dim" style="font-size:0.5625rem">\u{1F3C6} Best Ever</p></div>' +
    '</div></div>';
}

// ——— Rule Violations ———
function checkRules(daily) {
  var violations = [];
  var sorted = (daily || []).slice().sort(function(a,b) { return b.date.localeCompare(a.date); }).slice(0, 10);
  sorted.forEach(function(d) {
    if (d.trades > 5) {
      violations.push({ date: d.date, rule: 'Over-trading', detail: d.trades + ' trades (max 5)', severity: 'high' });
    }
    if (d.losses >= 3 && d.trades > d.losses) {
      violations.push({ date: d.date, rule: 'Revenge Trading', detail: d.losses + ' losses, kept trading', severity: 'high' });
    }
    if (d.rating === 'bad' && d.trades > 3) {
      violations.push({ date: d.date, rule: 'Emotional Trading', detail: 'Bad day, ' + d.trades + ' trades', severity: 'medium' });
    }
  });
  return violations.slice(0, 5);
}

function renderRuleViolations(daily) {
  var violations = checkRules(daily);
  if (violations.length === 0) {
    return '<div class="card card-green" style="text-align:center;padding:16px">' +
      '<p style="font-size:1.5rem;margin-bottom:4px">\u2705</p>' +
      '<p class="heading-md" style="color:var(--green)">Clean Record</p>' +
      '<p class="text-dim" style="font-size:0.6875rem">No rule violations in recent days!</p></div>';
  }
  return '<div class="card card-red">' +
    '<p class="label" style="margin-bottom:8px">\u26A0\uFE0F Rule Violations</p>' +
    violations.map(function(v) {
      var color = v.severity === 'high' ? 'var(--red)' : 'var(--amber)';
      return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">' +
        '<span style="color:' + color + ';font-size:0.75rem;font-weight:800">' + (v.severity === 'high' ? '\u{1F534}' : '\u{1F7E1}') + '</span>' +
        '<div style="flex:1"><p style="font-size:0.75rem;font-weight:700">' + v.rule + '</p>' +
        '<p class="text-dim" style="font-size:0.5625rem">' + v.detail + '</p></div>' +
        '<span class="text-dim" style="font-size:0.5625rem">' + fmtDate(v.date) + '</span></div>';
    }).join('') +
    '</div>';
}

// ——— Strategy Breakdown ———
function getStrategyBreakdown(trades) {
  var map = {};
  (trades || []).forEach(function(t) {
    var s = t.strategy || 'Unknown';
    if (!map[s]) map[s] = { name: s, totalPnl: 0, wins: 0, losses: 0, count: 0 };
    map[s].totalPnl += t.pnl;
    map[s].count++;
    if (t.pnl >= 0) map[s].wins++;
    else map[s].losses++;
  });
  return Object.values(map).sort(function(a,b) { return b.totalPnl - a.totalPnl; });
}

function renderStrategyBreakdown(trades) {
  var strats = getStrategyBreakdown(trades);
  if (strats.length === 0) return '';
  var maxPnl = Math.max.apply(null, strats.map(function(x) { return Math.abs(x.totalPnl) || 1; }));
  return '<div class="card">' +
    '<p class="label" style="margin-bottom:10px">\u{1F4CA} Strategy Performance</p>' +
    strats.map(function(s, i) {
      var wr = s.count > 0 ? Math.round((s.wins / s.count) * 100) : 0;
      var barW = Math.min(100, Math.abs(s.totalPnl) / maxPnl * 100);
      return '<div style="padding:8px 0;border-bottom:1px solid var(--border)">' +
        '<div class="row between" style="margin-bottom:4px">' +
        '<div class="row gap-6"><span class="text-dim" style="font-size:0.625rem;min-width:16px">#' + (i+1) + '</span><span style="font-size:0.75rem;font-weight:700">' + esc(s.name) + '</span></div>' +
        '<span class="mono" style="font-size:0.75rem;font-weight:900;color:' + (s.totalPnl >= 0 ? 'var(--green)' : 'var(--red)') + '">' + fmt(s.totalPnl) + '</span>' +
        '</div>' +
        '<div class="row between">' +
        '<div style="flex:1;height:4px;background:var(--bg-0);border-radius:2px;margin-right:8px"><div style="height:100%;width:' + barW + '%;background:' + (s.totalPnl >= 0 ? 'var(--green)' : 'var(--red)') + ';border-radius:2px"></div></div>' +
        '<span class="text-dim" style="font-size:0.5625rem;white-space:nowrap">' + s.count + 't \u00B7 ' + wr + '% WR</span>' +
        '</div></div>';
    }).join('') +
    '</div>';
}

// ——— Monthly Recap ———
function computeMonthlyRecap(daily, trades, journal) {
  var now = new Date();
  var y = now.getFullYear(), m = now.getMonth();
  var prefix = y + '-' + String(m+1).padStart(2,'0');
  var monthDaily = (daily || []).filter(function(d) { return d.date.startsWith(prefix); });
  var monthTrades = (trades || []).filter(function(t) { return t.date.startsWith(prefix); });
  var monthJournal = (journal || []).filter(function(j) { return j.date.startsWith(prefix); });
  var totalPnl = monthDaily.reduce(function(s,d) { return s + d.pnl; }, 0);
  var greenDays = monthDaily.filter(function(d) { return d.pnl > 0; }).length;
  var redDays = monthDaily.filter(function(d) { return d.pnl < 0; }).length;
  var bestDay = monthDaily.reduce(function(max,d) { return d.pnl > max.pnl ? d : max; }, { pnl: -Infinity, date: '' });
  var worstDay = monthDaily.reduce(function(min,d) { return d.pnl < min.pnl ? d : min; }, { pnl: Infinity, date: '' });
  var avgPnl = monthDaily.length > 0 ? totalPnl / monthDaily.length : 0;
  var totalTrades = monthDaily.reduce(function(s,d) { return s + d.trades; }, 0);
  var totalWins = monthDaily.reduce(function(s,d) { return s + d.wins; }, 0);
  var winRate = totalTrades > 0 ? Math.round((totalWins / totalTrades) * 100) : 0;
  var weeks = {};
  monthDaily.forEach(function(d) {
    var dt = new Date(d.date + 'T12:00:00');
    var wk = Math.ceil(dt.getDate() / 7);
    if (!weeks[wk]) weeks[wk] = { pnl: 0, days: 0 };
    weeks[wk].pnl += d.pnl;
    weeks[wk].days++;
  });
  var weekArr = Object.entries(weeks).map(function(pair) { return { label: 'Wk ' + pair[0], pnl: pair[1].pnl, days: pair[1].days }; });
  var stratBreakdown = getStrategyBreakdown(monthTrades);
  return {
    monthName: MONTH_NAMES[now.getMonth()] + ' ' + y,
    totalPnl: totalPnl, greenDays: greenDays, redDays: redDays,
    bestDay: bestDay.pnl === -Infinity ? null : bestDay,
    worstDay: worstDay.pnl === Infinity ? null : worstDay,
    avgPnl: avgPnl, totalTrades: totalTrades, winRate: winRate,
    journalCount: monthJournal.length, tradingDays: monthDaily.length,
    weeks: weekArr, stratBreakdown: stratBreakdown
  };
}

function renderMonthlyRecap(daily, trades, journal) {
  var recap = computeMonthlyRecap(daily, trades, journal);
  if (recap.tradingDays === 0) {
    return '<div class="card" style="text-align:center;padding:30px">' +
      '<p style="font-size:2rem;margin-bottom:8px">\u{1F4CB}</p>' +
      '<p class="heading-md">No data this month</p>' +
      '<p class="text-dim" style="font-size:0.75rem;margin-top:4px">Start logging trades to see your monthly recap!</p></div>';
  }
  return '<div class="stack">' +
    '<div class="card">' +
    '<h3 class="heading-lg" style="margin-bottom:12px">\u{1F4CB} ' + recap.monthName + ' Recap</h3>' +
    '<div class="grid-2" style="margin-bottom:12px">' +
    '<div class="detail-stat"><p class="label" style="font-size:0.5rem">Net P&L</p><p class="mono" style="font-size:1.125rem;font-weight:900;color:' + (recap.totalPnl >= 0 ? 'var(--green)' : 'var(--red)') + ';margin-top:2px">' + fmtK(recap.totalPnl) + '</p></div>' +
    '<div class="detail-stat"><p class="label" style="font-size:0.5rem">Win Rate</p><p style="font-size:1.125rem;font-weight:900;color:var(--amber);margin-top:2px">' + recap.winRate + '%</p></div>' +
    '<div class="detail-stat"><p class="label" style="font-size:0.5rem">Green / Red</p><p style="font-size:1.125rem;font-weight:900;margin-top:2px"><span style="color:var(--green)">' + recap.greenDays + 'G</span> / <span style="color:var(--red)">' + recap.redDays + 'R</span></p></div>' +
    '<div class="detail-stat"><p class="label" style="font-size:0.5rem">Avg Daily</p><p class="mono" style="font-size:1.125rem;font-weight:900;color:' + (recap.avgPnl >= 0 ? 'var(--green)' : 'var(--red)') + ';margin-top:2px">' + fmt(Math.round(recap.avgPnl)) + '</p></div>' +
    '</div>' +
    (recap.bestDay ? '<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--border)"><span class="text-dim" style="font-size:0.625rem">\u{1F3C6} Best Day</span><span class="mono" style="color:var(--green);font-size:0.75rem;font-weight:800">' + fmtDate(recap.bestDay.date) + ' ' + fmt(recap.bestDay.pnl) + '</span></div>' : '') +
    (recap.worstDay ? '<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--border)"><span class="text-dim" style="font-size:0.625rem">\u{1F4A9} Worst Day</span><span class="mono" style="color:var(--red);font-size:0.75rem;font-weight:800">' + fmtDate(recap.worstDay.date) + ' ' + fmt(recap.worstDay.pnl) + '</span></div>' : '') +
    '<div class="row between" style="padding:6px 0"><span class="text-dim" style="font-size:0.625rem">\u270D\uFE0F Journal Entries</span><span style="font-weight:700">' + recap.journalCount + '</span></div>' +
    '</div>' +
    (recap.weeks.length > 0 ? '<div class="card"><p class="label" style="margin-bottom:8px">Weekly Breakdown</p><div style="display:flex;gap:6px">' +
    recap.weeks.map(function(w) {
      return '<div style="flex:1;background:var(--bg-0);border-radius:8px;padding:8px 4px;text-align:center;border:1px solid var(--border)">' +
        '<p class="text-dim" style="font-size:0.5625rem">' + w.label + '</p>' +
        '<p class="mono" style="color:' + (w.pnl >= 0 ? 'var(--green)' : 'var(--red)') + ';font-weight:900;font-size:0.75rem;margin-top:2px">' + fmtK(w.pnl) + '</p>' +
        '<p class="text-dim" style="font-size:0.5rem">' + w.days + 'd</p></div>';
    }).join('') + '</div></div>' : '') +
    '</div>';
}

// ——— CSV Export ———
function exportDailyCSV(daily) {
  var rows = [['Date','P&L','Trades','Wins','Losses','Rating','Pre-Market','Post-Market']];
  (daily || []).sort(function(a,b) { return a.date.localeCompare(b.date); }).forEach(function(d) {
    rows.push([d.date, d.pnl, d.trades, d.wins, d.losses, d.rating, '"' + (d.preMarket || '').replace(/"/g,'""') + '"', '"' + (d.postMarket || '').replace(/"/g,'""') + '"']);
  });
  downloadCSV(rows, 'tradebook-daily.csv');
}

function exportTradesCSV(trades) {
  var rows = [['Date','Symbol','Side','Strategy','P&L','Volume','Entry','Exit','Emotions','Rating']];
  (trades || []).sort(function(a,b) { return a.date.localeCompare(b.date); }).forEach(function(t) {
    rows.push([t.date, t.symbol, t.side, t.strategy, t.pnl, t.volume, t.entry, t.exit, t.emotions, t.rating]);
  });
  downloadCSV(rows, 'tradebook-trades.csv');
}

function exportJournalCSV(journal) {
  var rows = [['Date','Title','Category','Mood','Body']];
  (journal || []).sort(function(a,b) { return a.date.localeCompare(b.date); }).forEach(function(j) {
    rows.push([j.date, '"' + (j.title || '').replace(/"/g,'""') + '"', j.category, j.mood, '"' + (j.body || '').replace(/"/g,'""') + '"']);
  });
  downloadCSV(rows, 'tradebook-journal.csv');
}

function downloadCSV(rows, filename) {
  var csv = rows.map(function(r) { return r.join(','); }).join('\n');
  var blob = new Blob([csv], { type: 'text/csv' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function renderExportSection() {
  return '<div class="card">' +
    '<p class="label" style="margin-bottom:10px">\u2B07\uFE0F Export Data</p>' +
    '<div class="grid-2" style="gap:6px">' +
    '<button class="btn btn-secondary" style="font-size:0.6875rem;padding:10px" id="export-daily-btn">\u{1F4C5} Daily P&L</button>' +
    '<button class="btn btn-secondary" style="font-size:0.6875rem;padding:10px" id="export-trades-btn">\u{1F4C8} Trades</button>' +
    '<button class="btn btn-secondary" style="font-size:0.6875rem;padding:10px" id="export-journal-btn">\u270D\uFE0F Journal</button>' +
    '<button class="btn btn-primary" style="font-size:0.6875rem;padding:10px" id="export-all-btn">\u{1F4E6} Export All</button>' +
    '</div></div>';
}

function bindExportButtons() {
  var eb1 = document.getElementById('export-daily-btn');
  if (eb1) eb1.addEventListener('click', function() { exportDailyCSV(state.daily); });
  var eb2 = document.getElementById('export-trades-btn');
  if (eb2) eb2.addEventListener('click', function() { exportTradesCSV(state.trades); });
  var eb3 = document.getElementById('export-journal-btn');
  if (eb3) eb3.addEventListener('click', function() { exportJournalCSV(state.journal); });
  var eb4 = document.getElementById('export-all-btn');
  if (eb4) eb4.addEventListener('click', function() {
    exportDailyCSV(state.daily);
    setTimeout(function() { exportTradesCSV(state.trades); }, 300);
    setTimeout(function() { exportJournalCSV(state.journal); }, 600);
  });
}

// ——— Strategy select with custom option ———
function renderStrategySelect(id, selected) {
  var strategies = getAllStrategies();
  var options = strategies.map(function(s) {
    return '<option' + (s === selected ? ' selected' : '') + '>' + esc(s) + '</option>';
  }).join('');
  return '<select class="select" id="' + id + '">' + options +
    '<option value="__custom__">+ Add new...</option></select>';
}

function bindStrategySelect(selectId) {
  var sel = document.getElementById(selectId);
  if (!sel) return;
  sel.addEventListener('change', function() {
    if (sel.value === '__custom__') {
      var name = prompt('Enter new strategy name:');
      if (name && name.trim()) {
        addCustomStrategy(name.trim());
        var parent = sel.parentNode;
        parent.innerHTML = '<label class="form-label">Strategy</label>' + renderStrategySelect(selectId, name.trim());
        bindStrategySelect(selectId);
      } else {
        sel.selectedIndex = 0;
      }
    }
  });
}


// ——— P&L Goal Tracker ———
function getPnlGoals() {
  try { return JSON.parse(localStorage.getItem('tb_pnl_goals') || '{}'); }
  catch(e) { return {}; }
}
function savePnlGoals(goals) {
  localStorage.setItem('tb_pnl_goals', JSON.stringify(goals));
}
function renderPnlGoals(daily) {
  var goals = getPnlGoals();
  var dailyGoal = parseFloat(goals.daily) || 0;
  var monthlyGoal = parseFloat(goals.monthly) || 0;

  // Today's P&L
  var todayStr = new Date().toISOString().split('T')[0];
  var todayEntry = (daily || []).find(function(d) { return d.date === todayStr; });
  var todayPnl = todayEntry ? todayEntry.pnl : 0;

  // This month's P&L
  var monthPrefix = todayStr.slice(0, 7);
  var monthPnl = (daily || [])
    .filter(function(d) { return d.date.startsWith(monthPrefix); })
    .reduce(function(s, d) { return s + d.pnl; }, 0);

  var dayPct = dailyGoal > 0 ? Math.min(100, Math.round((todayPnl / dailyGoal) * 100)) : null;
  var monPct = monthlyGoal > 0 ? Math.min(100, Math.round((monthPnl / monthlyGoal) * 100)) : null;

  var fmt2 = function(v) {
    var abs = Math.abs(v);
    var s = abs >= 1000 ? (abs / 1000).toFixed(1) + 'K' : abs.toLocaleString(undefined, { minimumFractionDigits: 0 });
    return (v >= 0 ? '+$' : '-$') + s;
  };

  var goalBar = function(pct, color) {
    var safe = Math.max(0, Math.min(100, pct));
    return '<div style="height:6px;background:var(--bg-0);border-radius:3px;margin-top:6px"><div style="height:100%;width:' + safe + '%;background:' + color + ';border-radius:3px;transition:width 0.3s"></div></div>';
  };

  var editId = 'goals-edit-btn';
  var formId = 'goals-form';
  var saveId = 'goals-save-btn';

  return '<div class="card" id="pnl-goals-card">' +
    '<div class="row between" style="margin-bottom:10px">' +
    '<p class="label">\uD83C\uDFAF P&L Goals</p>' +
    '<button class="btn btn-secondary" id="' + editId + '" style="font-size:0.625rem;padding:4px 10px">Edit</button>' +
    '</div>' +
    '<div id="' + formId + '" style="display:none;margin-bottom:10px">' +
    '<div class="grid-2" style="gap:6px;margin-bottom:6px">' +
    '<div class="form-group"><label class="form-label">Daily Goal ($)</label>' +
    '<input type="number" class="input mono" id="goal-daily-input" value="' + (dailyGoal || '') + '" placeholder="500"></div>' +
    '<div class="form-group"><label class="form-label">Monthly Goal ($)</label>' +
    '<input type="number" class="input mono" id="goal-monthly-input" value="' + (monthlyGoal || '') + '" placeholder="5000"></div>' +
    '</div>' +
    '<button class="btn btn-primary" id="' + saveId + '" style="width:100%;font-size:0.75rem">Save Goals</button>' +
    '</div>' +
    '<div class="grid-2">' +
    // Daily
    '<div style="background:var(--bg-0);border-radius:8px;padding:10px;border:1px solid var(--border)">' +
    '<p class="text-dim" style="font-size:0.5625rem;margin-bottom:2px">Today</p>' +
    '<p class="mono" style="font-size:0.9375rem;font-weight:900;color:' + (todayPnl >= 0 ? 'var(--green)' : 'var(--red)') + '">' + fmt2(todayPnl) + '</p>' +
    (dailyGoal > 0 ?
      '<p class="text-dim" style="font-size:0.5625rem;margin-top:2px">Goal: $' + dailyGoal.toLocaleString() + '</p>' +
      goalBar(dayPct, dayPct >= 100 ? '#10b981' : dayPct >= 50 ? '#f59e0b' : '#3b82f6') +
      '<p class="text-dim" style="font-size:0.5rem;margin-top:3px">' + dayPct + '% of goal</p>'
    : '<p class="text-dim" style="font-size:0.5625rem;margin-top:4px">No goal set</p>') +
    '</div>' +
    // Monthly
    '<div style="background:var(--bg-0);border-radius:8px;padding:10px;border:1px solid var(--border)">' +
    '<p class="text-dim" style="font-size:0.5625rem;margin-bottom:2px">This Month</p>' +
    '<p class="mono" style="font-size:0.9375rem;font-weight:900;color:' + (monthPnl >= 0 ? 'var(--green)' : 'var(--red)') + '">' + fmt2(monthPnl) + '</p>' +
    (monthlyGoal > 0 ?
      '<p class="text-dim" style="font-size:0.5625rem;margin-top:2px">Goal: $' + monthlyGoal.toLocaleString() + '</p>' +
      goalBar(monPct, monPct >= 100 ? '#10b981' : monPct >= 50 ? '#f59e0b' : '#3b82f6') +
      '<p class="text-dim" style="font-size:0.5rem;margin-top:3px">' + monPct + '% of goal</p>'
    : '<p class="text-dim" style="font-size:0.5625rem;margin-top:4px">No goal set</p>') +
    '</div>' +
    '</div></div>';
}
function bindPnlGoals() {
  var editBtn = document.getElementById('goals-edit-btn');
  var form = document.getElementById('goals-form');
  var saveBtn = document.getElementById('goals-save-btn');
  if (editBtn && form) {
    editBtn.addEventListener('click', function() {
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
      editBtn.textContent = form.style.display === 'none' ? 'Edit' : 'Cancel';
    });
  }
  if (saveBtn) {
    saveBtn.addEventListener('click', function() {
      var dv = parseFloat(document.getElementById('goal-daily-input').value) || 0;
      var mv = parseFloat(document.getElementById('goal-monthly-input').value) || 0;
      savePnlGoals({ daily: dv, monthly: mv });
      // Re-render just this card
      var card = document.getElementById('pnl-goals-card');
      if (card && typeof state !== 'undefined') {
        card.outerHTML = renderPnlGoals(state.daily);
        bindPnlGoals();
      }
    });
  }
}
