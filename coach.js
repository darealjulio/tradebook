/* ═══════════════════════════════════════════════════
   TradeBook — AI Trade Coach Module
   Uses Claude API to analyze trading patterns
   ═══════════════════════════════════════════════════ */

window.TradeBookCoach = (function() {
  'use strict';

  var coachState = {
    apiKey: null,
    analysis: null,
    loading: false,
    error: null,
  };

  function getApiKey() {
    return localStorage.getItem('tb_claude_api_key') || '';
  }
  function saveApiKey(key) {
    localStorage.setItem('tb_claude_api_key', key.trim());
    coachState.apiKey = key.trim();
  }

  function buildContext(daily, trades, journal) {
    var recentDaily = (daily || []).slice().sort(function(a,b){ return b.date.localeCompare(a.date); }).slice(0, 30);
    var recentTrades = (trades || []).slice().sort(function(a,b){ return b.date.localeCompare(a.date); }).slice(0, 50);
    var recentJournal = (journal || []).slice().sort(function(a,b){ return b.date.localeCompare(a.date); }).slice(0, 20);

    var totalPnl = recentDaily.reduce(function(s,d){ return s + d.pnl; }, 0);
    var wins = recentDaily.reduce(function(s,d){ return s + d.wins; }, 0);
    var losses = recentDaily.reduce(function(s,d){ return s + d.losses; }, 0);
    var totalTrades = wins + losses;
    var winRate = totalTrades > 0 ? Math.round((wins/totalTrades)*100) : 0;
    var greenDays = recentDaily.filter(function(d){ return d.pnl > 0; }).length;
    var redDays = recentDaily.filter(function(d){ return d.pnl < 0; }).length;

    var stratMap = {};
    recentTrades.forEach(function(t) {
      var s = t.strategy || 'Unknown';
      if (!stratMap[s]) stratMap[s] = { pnl: 0, count: 0, wins: 0 };
      stratMap[s].pnl += t.pnl || 0;
      stratMap[s].count++;
      if (t.pnl > 0) stratMap[s].wins++;
    });
    var stratLines = Object.entries(stratMap).sort(function(a,b){ return b[1].pnl - a[1].pnl; }).map(function(pair) {
      var wr = pair[1].count > 0 ? Math.round((pair[1].wins/pair[1].count)*100) : 0;
      return pair[0] + ': P&L $' + Math.round(pair[1].pnl) + ', ' + pair[1].count + ' trades, ' + wr + '% WR';
    }).join('\n');

    var emotionMap = {};
    recentTrades.forEach(function(t) {
      var e = t.emotions || 'unknown';
      if (!emotionMap[e]) emotionMap[e] = { pnl: 0, count: 0 };
      emotionMap[e].pnl += t.pnl || 0;
      emotionMap[e].count++;
    });
    var emotionLines = Object.entries(emotionMap).map(function(pair) {
      return pair[0] + ': ' + pair[1].count + ' trades, avg P&L $' + Math.round(pair[1].pnl / pair[1].count);
    }).join('\n');

    var journalText = recentJournal.map(function(j) {
      return '[' + j.date + '] ' + (j.category||'') + ': ' + (j.body||'').substring(0, 200);
    }).join('\n---\n');

    var badDays = recentDaily.filter(function(d){ return d.rating === 'bad'; }).slice(0, 5);
    var badDayNotes = badDays.map(function(d) {
      return d.date + ': P&L $' + Math.round(d.pnl) + (d.postMarket ? ' -- "' + d.postMarket.substring(0,100) + '"' : '');
    }).join('\n');

    return 'You are an elite trading coach analyzing a trader journal. Be direct, specific, actionable. Use their actual numbers.\n\nSTATS (last 30 days):\n- Net P&L: $' + Math.round(totalPnl) + '\n- Win Rate: ' + winRate + '% (' + wins + 'W / ' + losses + 'L)\n- Green Days: ' + greenDays + ' | Red Days: ' + redDays + '\n- Total Trades: ' + totalTrades + '\n\nSTRATEGY BREAKDOWN:\n' + (stratLines || 'No trade data') + '\n\nEMOTION/P&L CORRELATION:\n' + (emotionLines || 'No emotion data') + '\n\nRECENT BAD DAYS:\n' + (badDayNotes || 'None in last 30 days') + '\n\nRECENT JOURNAL ENTRIES:\n' + (journalText || 'No journal entries');
  }

  async function callClaude(prompt, daily, trades, journal) {
    var key = getApiKey();
    if (!key) throw new Error('No API key. Click the key icon to add your Claude API key.');
    var context = buildContext(daily, trades, journal);
    var response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        messages: [{ role: 'user', content: context + '\n\n---\n\nQuestion: ' + prompt }],
      }),
    });
    if (!response.ok) {
      var err = await response.json().catch(function(){ return {}; });
      throw new Error(err.error && err.error.message ? err.error.message : 'API error ' + response.status);
    }
    var data = await response.json();
    return data.content && data.content[0] ? data.content[0].text : 'No response received.';
  }

  function esc(s) {
    var el = document.createElement('span');
    el.textContent = String(s);
    return el.innerHTML;
  }

  function renderCoachCard() {
    var hasKey = !!getApiKey();
    var quickTaps = [
      { emoji: '💪', text: "What's my biggest edge?" },
      { emoji: '🔴', text: "What are my worst habits?" },
      { emoji: '📋', text: "Rules for this week" },
      { emoji: '🧘', text: "Emotional patterns" },
      { emoji: '📊', text: "Strategy review" },
      { emoji: '🏆', text: "Best vs worst days" },
    ];
    var responseHtml = '';
    if (coachState.loading) {
      responseHtml = '<div style="display:flex;align-items:center;gap:8px;padding:12px 0"><div class="coach-spinner"></div><p class="text-dim" style="font-size:0.75rem">Analyzing your trading data...</p></div>';
    } else if (coachState.error) {
      responseHtml = '<div style="padding:10px;background:#7f1d1d22;border-radius:8px;border:1px solid #ef444433;margin-top:8px"><p style="color:#fca5a5;font-size:0.75rem">' + esc(coachState.error) + '</p></div>';
    } else if (coachState.analysis) {
      responseHtml = '<div id="coach-response" style="margin-top:10px"><div style="padding:12px;background:var(--bg-0);border-radius:10px;border:1px solid var(--border)"><p style="font-size:0.8125rem;line-height:1.7;color:var(--text-1);white-space:pre-wrap">' + esc(coachState.analysis) + '</p></div><button class="btn btn-secondary" id="coach-clear-btn" style="margin-top:8px;font-size:0.625rem;padding:4px 10px">Clear</button></div>';
    }
    return '<div class="card" id="coach-card" style="border:1px solid rgba(99,102,241,0.3)">' +
      '<div class="row between" style="margin-bottom:10px">' +
      '<div class="row gap-8"><span style="font-size:1.125rem">🧠</span><p class="label">AI Trade Coach</p></div>' +
      '<button id="coach-key-btn" style="background:transparent;border:1px solid var(--border);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:0.625rem;color:var(--text-3);font-family:var(--font)">🔑 ' + (hasKey ? 'Key Set ✓' : 'Add Key') + '</button>' +
      '</div>' +
      (!hasKey ? '<div style="padding:8px;background:rgba(99,102,241,0.08);border-radius:8px;border:1px solid rgba(99,102,241,0.2);margin-bottom:10px"><p class="text-dim" style="font-size:0.6875rem">Add your Claude API key to unlock AI coaching. Get one free at console.anthropic.com</p></div>' : '') +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">' +
      quickTaps.map(function(q) {
        return '<button class="coach-tap-btn" data-q="' + q.text.replace(/"/g,'&quot;') + '" style="background:var(--bg-0);border:1px solid var(--border);border-radius:20px;padding:5px 10px;font-size:0.625rem;cursor:pointer;color:var(--text-2);font-family:var(--font);white-space:nowrap">' + q.emoji + ' ' + q.text + '</button>';
      }).join('') +
      '</div>' +
      '<div class="row gap-8">' +
      '<input class="input" id="coach-input" placeholder="Ask about your trading..." style="flex:1;font-size:0.75rem">' +
      '<button class="btn btn-primary" id="coach-ask-btn" style="padding:8px 14px;font-size:0.75rem;white-space:nowrap">Ask</button>' +
      '</div>' +
      '<div id="coach-container">' + responseHtml + '</div>' +
      '</div>';
  }

  function reRenderCoach(daily, trades, journal) {
    var card = document.getElementById('coach-card');
    if (card) {
      card.outerHTML = renderCoachCard();
      bindCoachEvents(daily, trades, journal);
    }
  }

  async function runAnalysis(question, daily, trades, journal) {
    coachState.loading = true;
    coachState.error = null;
    coachState.analysis = null;
    reRenderCoach(daily, trades, journal);
    try {
      coachState.analysis = await callClaude(question, daily, trades, journal);
    } catch(e) {
      coachState.error = e.message || 'Something went wrong. Check your API key.';
    }
    coachState.loading = false;
    reRenderCoach(daily, trades, journal);
  }

  function bindCoachEvents(daily, trades, journal) {
    var keyBtn = document.getElementById('coach-key-btn');
    if (keyBtn) {
      keyBtn.addEventListener('click', function() {
        var current = getApiKey();
        var newKey = prompt('Enter your Claude API key (sk-ant-...):', current ? '(current key is set)' : '');
        if (newKey && newKey.trim()) {
          saveApiKey(newKey.trim());
          reRenderCoach(daily, trades, journal);
        }
      });
    }
    document.querySelectorAll('.coach-tap-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        runAnalysis(btn.getAttribute('data-q'), daily, trades, journal);
      });
    });
    var askBtn = document.getElementById('coach-ask-btn');
    var inputEl = document.getElementById('coach-input');
    if (askBtn && inputEl) {
      askBtn.addEventListener('click', function() {
        var q = inputEl.value.trim();
        if (q) { inputEl.value = ''; runAnalysis(q, daily, trades, journal); }
      });
      inputEl.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          var q = inputEl.value.trim();
          if (q) { inputEl.value = ''; runAnalysis(q, daily, trades, journal); }
        }
      });
    }
    var clearBtn = document.getElementById('coach-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', function() {
        coachState.analysis = null;
        coachState.error = null;
        reRenderCoach(daily, trades, journal);
      });
    }
  }

  function initCoach() {
    coachState.apiKey = getApiKey();
    if (!document.getElementById('coach-styles')) {
      var style = document.createElement('style');
      style.id = 'coach-styles';
      style.textContent = '.coach-spinner{width:16px;height:16px;border:2px solid var(--border);border-top-color:#6366f1;border-radius:50%;animation:coach-spin 0.7s linear infinite;flex-shrink:0}@keyframes coach-spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(style);
    }
  }

  return { initCoach: initCoach, renderCoachCard: renderCoachCard, bindCoachEvents: bindCoachEvents };
})();
