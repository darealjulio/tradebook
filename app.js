/* ═══════════════════════════════════════════
   TradeBook — Trading Journal PWA
   Vanilla JS · IndexedDB · Chart.js
   ═══════════════════════════════════════════ */

// ─── IndexedDB Storage ───
const DB_NAME = 'tradebook';
const DB_VERSION = 1;
const STORES = ['daily', 'trades', 'journal'];

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      STORES.forEach(s => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' }); });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGetAll(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(store, item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbDelete(store, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbPutMany(store, items) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    items.forEach(i => os.put(i));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Helpers ───
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => new Date().toISOString().split('T')[0];
const fmtDate = (iso) => {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
const fmtDateLong = (iso) => {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};
const dayNum = (iso) => new Date(iso + 'T12:00:00').getDate();
const fmt = (v) => {
  const abs = Math.abs(v);
  const s = abs.toLocaleString(undefined, { minimumFractionDigits: v % 1 !== 0 ? 2 : 0 });
  return v >= 0 ? `+$${s}` : `-$${s}`;
};
const fmtK = (v) => Math.abs(v) >= 1000
  ? `${v >= 0 ? '+' : '-'}$${(Math.abs(v)/1000).toFixed(1)}K`
  : fmt(v);
const esc = (s) => {
  const el = document.createElement('span');
  el.textContent = s;
  return el.innerHTML;
};

// ─── Seed Data ───
const CAT = {
  mindset: { emoji:'🧠', color:'#60a5fa', label:'Mindset' },
  lesson: { emoji:'📝', color:'#10b981', label:'Lesson' },
  strategy: { emoji:'💡', color:'#f59e0b', label:'Strategy' },
  frustration: { emoji:'😤', color:'#ef4444', label:'Vent' },
  goals: { emoji:'🎯', color:'#a78bfa', label:'Goals' },
  freewrite: { emoji:'📖', color:'#64748b', label:'Free Write' },
};
const MOOD = {
  locked: { emoji:'🔥', label:'Locked In' },
  calm: { emoji:'😌', label:'Calm' },
  neutral: { emoji:'😐', label:'Neutral' },
  frustrated: { emoji:'😣', label:'Frustrated' },
  anxious: { emoji:'😰', label:'Anxious' },
};
const RATING_EMOJI = { great:'🟢', okay:'🟡', bad:'🔴' };

// ─── State ───
let state = {
  tab: 'overview',       // overview | calendar | journal
  daily: [],
  trades: [],
  journal: [],
  loaded: false,
  modal: null,            // null | 'picker' | 'daily' | 'trade' | 'journal'
  viewing: null,          // null | { entry, type }
  charts: {},
};

// ─── Render Engine ───
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function render() {
  const app = $('#app');
  if (!state.loaded) {
    app.innerHTML = `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center"><p class="text-dim">Loading…</p></div>`;
    return;
  }
  if (state.viewing) {
    renderDetail();
    return;
  }
  const stats = computeStats();

  app.innerHTML = `
    <div class="app-shell">
      <div class="app-content">
        <!-- Header -->
        <div class="row between" style="margin-bottom:16px">
          <div>
            <p class="label" style="margin-bottom:2px">Trading Journal</p>
            <h1 class="heading-xl">TradeBook</h1>
          </div>
          <div class="tab-bar">
            ${['overview','calendar','journal'].map(t => `
              <button class="tab-btn ${state.tab===t?'active':''}" data-tab="${t}">
                ${{overview:'📊 Stats',calendar:'📅 Cal',journal:'✍️ Write'}[t]}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Tab Content -->
        <div id="tab-content">${
          state.tab === 'overview' ? renderOverview(stats) :
          state.tab === 'calendar' ? renderCalendar() :
          renderJournal()
        }</div>
      </div>

      <!-- FAB -->
      <button class="fab" id="fab-btn">+</button>

      <!-- Modal -->
      ${state.modal ? renderModal() : ''}
    </div>
  `;

  bindEvents();
  if (state.tab === 'overview') initCharts(stats);
}

function computeStats() {
  const d = state.daily;
  const totalTrades = d.reduce((s,x) => s+x.trades, 0);
  const totalWins = d.reduce((s,x) => s+x.wins, 0);
  const totalLosses = d.reduce((s,x) => s+x.losses, 0);
  const netPnl = d.reduce((s,x) => s+x.pnl, 0);
  const winRate = totalTrades > 0 ? (totalWins/totalTrades)*100 : 0;
  const greenDays = d.filter(x => x.pnl > 0).length;
  const redDays = d.filter(x => x.pnl < 0).length;
  const totalWin$ = d.reduce((s,x) => s + Math.max(0,x.pnl), 0);
  const totalLoss$ = d.reduce((s,x) => s + Math.abs(Math.min(0,x.pnl)), 0);
  const pf = totalLoss$ > 0 ? (totalWin$/totalLoss$).toFixed(2) : '∞';
  let cum = 0;
  const sorted = [...d].sort((a,b) => a.date.localeCompare(b.date));
  const chartData = sorted.map(x => { cum += x.pnl; return { ...x, cumPnl: cum, label: fmtDate(x.date) }; });
  return { totalTrades, totalWins, totalLosses, netPnl, winRate, greenDays, redDays, pf, chartData, days: d.length };
}

// ─── Overview Tab ───
function renderOverview(s) {
  const ringR = 34, circ = 2*Math.PI*ringR, filled = (s.winRate/100)*circ;
  return `
    <div class="stack">
      <!-- Stat Cards -->
      <div class="grid-2">
        <div class="card card-green">
          <p class="label" style="margin-bottom:6px">Net P&L</p>
          <p class="mono text-green" style="font-size:1.375rem;font-weight:900">${fmtK(s.netPnl)}</p>
          <p class="text-dim" style="font-size:0.625rem;margin-top:4px">${s.totalTrades} trades · ${s.days} days</p>
        </div>
        <div class="card">
          <p class="label" style="margin-bottom:8px">Win Rate</p>
          <div class="row gap-12">
            <div class="ring-wrap">
              <svg viewBox="0 0 80 80" width="68" height="68">
                <circle cx="40" cy="40" r="${ringR}" fill="none" stroke="var(--border)" stroke-width="5"/>
                <circle cx="40" cy="40" r="${ringR}" fill="none" stroke="var(--green)" stroke-width="5" stroke-linecap="round"
                  stroke-dasharray="${filled} ${circ}" stroke-dashoffset="${circ*0.25}"
                  style="transform:rotate(-90deg);transform-origin:center"/>
              </svg>
              <div class="ring-label"><span style="color:#fff;font-size:1rem;font-weight:900">${s.winRate.toFixed(0)}%</span></div>
            </div>
            <div style="display:flex;flex-direction:column;gap:4px">
              <div class="row gap-6"><div class="daily-dot" style="background:var(--green)"></div><span class="text-muted" style="font-size:0.6875rem">${s.totalWins}W</span></div>
              <div class="row gap-6"><div class="daily-dot" style="background:var(--red)"></div><span class="text-muted" style="font-size:0.6875rem">${s.totalLosses}L</span></div>
            </div>
          </div>
        </div>
        <div class="card card-amber">
          <p class="label" style="margin-bottom:6px">Green / Red</p>
          <p class="text-amber" style="font-size:1.375rem;font-weight:900">${s.greenDays}G / ${s.redDays}R</p>
          <p class="text-dim" style="font-size:0.625rem;margin-top:4px">${s.days>0?((s.greenDays/s.days)*100).toFixed(0):0}% green days</p>
        </div>
        <div class="card card-violet">
          <p class="label" style="margin-bottom:6px">Profit Factor</p>
          <p class="text-violet mono" style="font-size:1.375rem;font-weight:900">${s.pf}</p>
          <p class="text-dim" style="font-size:0.625rem;margin-top:4px">Target: >2.0</p>
        </div>
      </div>

      <!-- Equity Curve -->
      <div class="card">
        <div class="row between" style="margin-bottom:10px">
          <div>
            <p class="label">Equity Curve</p>
            <p class="mono text-green" style="font-size:1.25rem;font-weight:900;margin-top:4px">${fmtK(s.netPnl)}</p>
          </div>
        </div>
        <div class="chart-wrap"><canvas id="equity-chart" height="140"></canvas></div>
      </div>

      <!-- Daily Bar + List -->
      <div class="card">
        <p class="label" style="margin-bottom:10px">Daily P&L</p>
        <div class="chart-wrap"><canvas id="daily-chart" height="110"></canvas></div>
        <div style="margin-top:8px">
          ${[...state.daily].sort((a,b) => b.date.localeCompare(a.date)).map(d => `
            <div class="daily-row" data-view-daily="${d.id}">
              <div class="row gap-6">
                <div class="daily-dot" style="background:${d.pnl>=0?'var(--green)':'var(--red)'}"></div>
                <span class="text-muted" style="font-size:0.6875rem">${fmtDate(d.date)}</span>
              </div>
              <div class="row gap-8">
                <span class="text-dim" style="font-size:0.625rem">${d.trades}t ${d.wins}W ${d.losses}L</span>
                <span class="mono" style="font-size:0.6875rem;font-weight:800;color:${d.pnl>=0?'var(--green)':'var(--red)'};min-width:60px;text-align:right">${fmt(d.pnl)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// ─── Calendar Tab ───
function renderCalendar() {
  const data = state.daily;
  const allDays = [];
  for (let i = 1; i <= 28; i++) {
    const dow = new Date(2026, 1, i).getDay();
    const entry = data.find(d => dayNum(d.date) === i);
    allDays.push({ day:i, dow, pnl: entry?entry.pnl:null, trades: entry?entry.trades:0 });
  }
  const getColor = (pnl) => {
    if (pnl === null) return { bg:'rgba(17,24,39,0.4)', text:'', border:'transparent' };
    if (pnl > 3000) return { bg:'#065f46', text:'#6ee7b7', border:'rgba(16,185,129,0.12)' };
    if (pnl > 0) return { bg:'#064e3b', text:'#a7f3d0', border:'rgba(16,185,129,0.12)' };
    if (pnl < -1000) return { bg:'#7f1d1d', text:'#fca5a5', border:'rgba(239,68,68,0.12)' };
    if (pnl < 0) return { bg:'#991b1b', text:'#fecaca', border:'rgba(239,68,68,0.12)' };
    return { bg:'#374151', text:'#d1d5db', border:'transparent' };
  };
  const monthTotal = data.reduce((s,d) => s+d.pnl, 0);

  // weekly agg
  const weeks = {};
  data.forEach(d => {
    const dt = new Date(d.date+'T12:00:00');
    const mon = new Date(dt); mon.setDate(dt.getDate() - dt.getDay() + 1);
    const key = `${mon.getMonth()+1}/${mon.getDate()}`;
    if (!weeks[key]) weeks[key] = { pnl:0, days:0 };
    weeks[key].pnl += d.pnl; weeks[key].days++;
  });
  const weekArr = Object.entries(weeks).map(([k,v],i) => ({ label:`Wk ${i+1}`, ...v }));

  const dayHeaders = ['S','M','T','W','T','F','S'].map(d => `<div class="cal-header">${d}</div>`).join('');
  const cells = allDays.map(({ day, dow, pnl, trades }) => {
    const c = getColor(pnl);
    const gs = day === 1 ? `grid-column-start:${dow+1};` : '';
    return `<div class="cal-cell" style="${gs}background:${c.bg};border:1px solid ${c.border}">
      <span class="cal-day-num">${day}</span>
      ${pnl !== null ? `<span class="cal-pnl" style="color:${c.text}">${fmtK(pnl)}</span><span class="cal-trades">${trades}t</span>` : ''}
    </div>`;
  }).join('');

  return `
    <div class="card">
      <div class="row between" style="margin-bottom:16px">
        <div>
          <h3 class="heading-lg">February 2026</h3>
          <p class="text-muted" style="font-size:0.625rem;margin-top:2px">${data.length} trading days</p>
        </div>
        <span class="pill" style="background:${monthTotal>=0?'#065f46':'#7f1d1d'};color:${monthTotal>=0?'#6ee7b7':'#fca5a5'};font-weight:700">${fmtK(monthTotal)} MTD</span>
      </div>
      <div class="cal-grid">${dayHeaders}${cells}</div>
      ${weekArr.length > 0 ? `
        <div class="week-row">
          ${weekArr.map(w => `
            <div class="week-pill">
              <p class="text-dim" style="font-size:0.625rem">${w.label}</p>
              <p class="mono" style="color:${w.pnl>=0?'var(--green)':'var(--red)'};font-weight:900;font-size:0.875rem;margin-top:2px">${fmtK(w.pnl)}</p>
              <p class="text-dim" style="font-size:0.5625rem">${w.days}d</p>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

// ─── Journal Tab ───
function renderJournal() {
  const entries = [...state.journal].sort((a,b) => b.date.localeCompare(a.date));
  return `
    <div class="stack">
      <p class="label" style="margin-bottom:4px">Writing Journal</p>
      ${entries.length === 0 ? '<p class="text-dim" style="text-align:center;padding:40px;font-size:0.8125rem">No entries yet. Tap + to start writing.</p>' : ''}
      ${entries.map(e => {
        const cat = CAT[e.category] || CAT.freewrite;
        const mood = MOOD[e.mood] || MOOD.neutral;
        return `
          <div class="journal-card" data-view-journal="${e.id}">
            <div class="row between" style="margin-bottom:6px">
              <div class="row gap-6">
                <span style="font-size:1rem">${cat.emoji}</span>
                <span class="heading-md" style="font-size:0.8125rem">${esc(e.title)}</span>
              </div>
              <span style="font-size:1rem">${mood.emoji}</span>
            </div>
            <p class="journal-body-preview">${esc(e.body)}</p>
            <div class="row gap-8" style="margin-top:8px">
              <span class="pill" style="color:${cat.color};background:${cat.color}15">${cat.label}</span>
              <span class="text-dim" style="font-size:0.625rem">${fmtDate(e.date)}</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ─── Detail View ───
function renderDetail() {
  const { entry: e, type } = state.viewing;
  const app = $('#app');

  if (type === 'journal') {
    const cat = CAT[e.category] || CAT.freewrite;
    const mood = MOOD[e.mood] || MOOD.neutral;
    app.innerHTML = `
      <div class="app-shell"><div class="app-content" style="padding-bottom:40px">
        <button class="back-btn" id="back-btn">← Back</button>
        <div class="row gap-8" style="margin-bottom:4px">
          <span style="font-size:1.375rem">${cat.emoji}</span>
          <h2 class="heading-xl">${esc(e.title)}</h2>
        </div>
        <div class="row gap-8" style="margin-bottom:20px">
          <span class="pill" style="color:${cat.color};background:${cat.color}15">${cat.label}</span>
          <span class="text-muted" style="font-size:0.6875rem">${fmtDateLong(e.date)}</span>
          <span class="text-muted" style="font-size:0.6875rem">· ${mood.emoji} ${mood.label}</span>
        </div>
        <p style="color:var(--text-1);font-size:0.875rem;line-height:1.8;white-space:pre-wrap">${esc(e.body)}</p>
        <button class="btn-danger" style="margin-top:24px" id="delete-btn">Delete entry</button>
      </div></div>
    `;
  } else if (type === 'daily') {
    app.innerHTML = `
      <div class="app-shell"><div class="app-content" style="padding-bottom:40px">
        <button class="back-btn" id="back-btn">← Back</button>
        <div class="row between" style="margin-bottom:16px">
          <h2 class="heading-xl">${fmtDate(e.date)}</h2>
          <span class="mono" style="font-size:1.375rem;font-weight:900;color:${e.pnl>=0?'var(--green)':'var(--red)'}">${fmt(e.pnl)}</span>
        </div>
        <div class="grid-3" style="margin-bottom:16px">
          ${[['Trades',e.trades],['Wins',e.wins],['Losses',e.losses]].map(([l,v]) => `
            <div class="detail-stat">
              <p class="label" style="font-size:0.5625rem">${l}</p>
              <p style="font-size:1.125rem;font-weight:900;margin-top:2px">${v}</p>
            </div>
          `).join('')}
        </div>
        <div class="row gap-8" style="margin-bottom:16px">
          <span class="pill" style="background:${RATING_EMOJI[e.rating]==='🟢'?'#065f46':RATING_EMOJI[e.rating]==='🟡'?'#78350f':'#7f1d1d'};color:${RATING_EMOJI[e.rating]==='🟢'?'#6ee7b7':RATING_EMOJI[e.rating]==='🟡'?'#fde68a':'#fca5a5'}">${RATING_EMOJI[e.rating] || '⚪'} ${e.rating}</span>
          <span class="text-muted" style="font-size:0.6875rem">${e.session || ''}</span>
          ${e.reviewed ? '<span class="pill" style="background:#065f46;color:#6ee7b7">✓ Reviewed</span>' : ''}
        </div>
        ${e.preMarket ? `
          <div class="detail-section">
            <p style="color:var(--amber);font-size:0.625rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">📋 Pre-Market</p>
            <p style="color:var(--text-1);font-size:0.8125rem;line-height:1.6;white-space:pre-wrap">${esc(e.preMarket)}</p>
          </div>
        ` : ''}
        ${e.postMarket ? `
          <div class="detail-section">
            <p style="color:var(--green);font-size:0.625rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">📝 Post-Market</p>
            <p style="color:var(--text-1);font-size:0.8125rem;line-height:1.6;white-space:pre-wrap">${esc(e.postMarket)}</p>
          </div>
        ` : ''}
        <button class="btn-danger" style="margin-top:16px" id="delete-btn">Delete entry</button>
      </div></div>
    `;
  }

  // bind detail events
  const backBtn = $('#back-btn');
  if (backBtn) backBtn.addEventListener('click', () => { state.viewing = null; render(); });
  const delBtn = $('#delete-btn');
  if (delBtn) delBtn.addEventListener('click', async () => {
    if (type === 'daily') {
      state.daily = state.daily.filter(x => x.id !== e.id);
      await dbDelete('daily', e.id);
    } else if (type === 'journal') {
      state.journal = state.journal.filter(x => x.id !== e.id);
      await dbDelete('journal', e.id);
    }
    state.viewing = null;
    render();
  });
}

// ─── Modal ───
function renderModal() {
  let content = '';
  if (state.modal === 'picker') {
    content = `
      <h3 class="heading-lg" style="text-align:center;margin-bottom:16px">Quick Add</h3>
      <div class="stack">
        <button class="picker-btn" data-pick="daily"><span style="font-size:1.75rem">📅</span><div><p style="font-weight:700;font-size:0.875rem">Daily Review</p><p class="text-muted" style="font-size:0.6875rem">Log today's P&L and notes</p></div></button>
        <button class="picker-btn" data-pick="trade"><span style="font-size:1.75rem">📈</span><div><p style="font-weight:700;font-size:0.875rem">Trade Entry</p><p class="text-muted" style="font-size:0.6875rem">Log an individual trade</p></div></button>
        <button class="picker-btn" data-pick="journal"><span style="font-size:1.75rem">✍️</span><div><p style="font-weight:700;font-size:0.875rem">Journal Entry</p><p class="text-muted" style="font-size:0.6875rem">Write a reflection</p></div></button>
      </div>
    `;
  } else if (state.modal === 'daily') {
    content = `
      <h3 class="heading-lg" style="margin-bottom:12px">📅 Daily Review</h3>
      <div class="stack gap-12">
        <div class="form-group"><label class="form-label">Date</label><input type="date" class="input" id="m-date" value="${today()}"></div>
        <div class="grid-3">
          <div class="form-group"><label class="form-label">Day P&L</label><input type="number" step="0.01" class="input mono" id="m-pnl" placeholder="$0.00"></div>
          <div class="form-group"><label class="form-label">Wins</label><input type="number" class="input" id="m-wins" placeholder="0"></div>
          <div class="form-group"><label class="form-label">Losses</label><input type="number" class="input" id="m-losses" placeholder="0"></div>
        </div>
        <div class="grid-2">
          <div class="form-group"><label class="form-label">Total Trades</label><input type="number" class="input" id="m-trades" placeholder="0"></div>
          <div class="form-group"><label class="form-label">Rating</label><select class="select" id="m-rating"><option value="great">🟢 Great</option><option value="okay">🟡 Okay</option><option value="bad">🔴 Bad</option></select></div>
        </div>
        <div class="form-group"><label class="form-label">Pre-Market Notes</label><textarea class="textarea" id="m-pre" rows="3" placeholder="Events, bias, watchlist..."></textarea></div>
        <div class="form-group"><label class="form-label">Post-Market Review</label><textarea class="textarea" id="m-post" rows="3" placeholder="What went well, what to improve..."></textarea></div>
        <div class="row gap-8">
          <button class="btn btn-secondary" style="flex:1" id="m-back">Back</button>
          <button class="btn btn-primary" style="flex:2" id="m-save">Save Entry</button>
        </div>
      </div>
    `;
  } else if (state.modal === 'trade') {
    content = `
      <h3 class="heading-lg" style="margin-bottom:12px">📈 Trade Entry</h3>
      <div class="stack gap-12">
        <div class="grid-2">
          <div class="form-group"><label class="form-label">Date</label><input type="date" class="input" id="m-date" value="${today()}"></div>
          <div class="form-group"><label class="form-label">Symbol</label><input class="input" id="m-symbol" value="MNQ"></div>
        </div>
        <div class="grid-3">
          <div class="form-group"><label class="form-label">Side</label><select class="select" id="m-side"><option>Long</option><option>Short</option></select></div>
          <div class="form-group"><label class="form-label">Strategy</label><select class="select" id="m-strategy"><option>ORB Breakout</option><option>EMA Tap</option><option>Supply Reject</option><option>Demand Bounce</option><option>Reversal</option></select></div>
          <div class="form-group"><label class="form-label">Volume</label><input type="number" class="input" id="m-volume" value="2"></div>
        </div>
        <div class="grid-3">
          <div class="form-group"><label class="form-label">Net P&L</label><input type="number" step="0.01" class="input mono" id="m-pnl" placeholder="$0.00"></div>
          <div class="form-group"><label class="form-label">Entry</label><input type="number" step="0.01" class="input mono" id="m-entry" placeholder="0"></div>
          <div class="form-group"><label class="form-label">Exit</label><input type="number" step="0.01" class="input mono" id="m-exit" placeholder="0"></div>
        </div>
        <div class="grid-2">
          <div class="form-group"><label class="form-label">Emotions</label><select class="select" id="m-emotions"><option value="calm">😌 Calm</option><option value="confident">💪 Confident</option><option value="patient">🧘 Patient</option><option value="FOMO">😱 FOMO</option><option value="frustration">😤 Frustration</option><option value="revenge">🔥 Revenge</option></select></div>
          <div class="form-group"><label class="form-label">Rating</label>
            <div class="row gap-4" id="m-stars" style="margin-top:4px">
              ${[1,2,3,4,5].map(n => `<button class="star-btn" data-star="${n}" style="width:32px;height:32px;border-radius:8px;border:1px solid var(--border);background:${n<=4?'var(--amber)':'var(--bg-0)'};color:${n<=4?'#000':'var(--text-3)'};font-weight:800;font-size:0.75rem;cursor:pointer;font-family:var(--font)">★</button>`).join('')}
            </div>
          </div>
        </div>
        <div class="row gap-8">
          <button class="btn btn-secondary" style="flex:1" id="m-back">Back</button>
          <button class="btn btn-primary" style="flex:2" id="m-save">Save Trade</button>
        </div>
      </div>
    `;
  } else if (state.modal === 'journal') {
    content = `
      <h3 class="heading-lg" style="margin-bottom:12px">✍️ Journal Entry</h3>
      <div class="stack gap-12">
        <div class="form-group"><label class="form-label">Title</label><input class="input" id="m-title" placeholder="What's on your mind?"></div>
        <div class="grid-3">
          <div class="form-group"><label class="form-label">Date</label><input type="date" class="input" id="m-date" value="${today()}"></div>
          <div class="form-group"><label class="form-label">Category</label><select class="select" id="m-cat"><option value="mindset">🧠 Mindset</option><option value="lesson">📝 Lesson</option><option value="strategy">💡 Strategy</option><option value="frustration">😤 Vent</option><option value="goals">🎯 Goals</option><option value="freewrite">📖 Free Write</option></select></div>
          <div class="form-group"><label class="form-label">Mood</label><select class="select" id="m-mood"><option value="locked">🔥 Locked In</option><option value="calm">😌 Calm</option><option value="neutral">😐 Neutral</option><option value="frustrated">😣 Frustrated</option><option value="anxious">😰 Anxious</option></select></div>
        </div>
        <div class="form-group"><label class="form-label">Write</label><textarea class="textarea" id="m-body" rows="6" placeholder="Let it out..."></textarea></div>
        <div class="row gap-8">
          <button class="btn btn-secondary" style="flex:1" id="m-back">Back</button>
          <button class="btn btn-primary" style="flex:2" id="m-save">Save Entry</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal-sheet" id="modal-sheet">
        <div class="modal-handle"></div>
        ${content}
      </div>
    </div>
  `;
}

// ─── Charts (Chart.js) ───
function initCharts(stats) {
  if (typeof Chart === 'undefined' || stats.chartData.length === 0) return;

  Chart.defaults.font.family = "'DM Sans', sans-serif";
  Chart.defaults.color = '#374151';

  // Equity curve
  const eqCtx = document.getElementById('equity-chart');
  if (eqCtx) {
    new Chart(eqCtx, {
      type: 'line',
      data: {
        labels: stats.chartData.map(d => d.label),
        datasets: [{
          data: stats.chartData.map(d => d.cumPnl),
          borderColor: '#10b981',
          backgroundColor: (ctx) => {
            const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 140);
            g.addColorStop(0, 'rgba(16,185,129,0.2)');
            g.addColorStop(1, 'rgba(16,185,129,0)');
            return g;
          },
          fill: true,
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#070b14',
          pointBorderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: {
          backgroundColor: '#1f2937', borderColor: '#374151', borderWidth: 1,
          titleColor: '#9ca3af', bodyColor: '#fff', cornerRadius: 10, padding: 10,
          callbacks: { label: (c) => `$${c.raw.toLocaleString()}` }
        }},
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 9 } }, border: { display: false } },
          y: { grid: { color: 'rgba(31,41,55,0.5)' }, ticks: { font: { size: 9 }, callback: v => `$${(v/1000).toFixed(0)}k` }, border: { display: false } },
        }
      }
    });
  }

  // Daily bars
  const barCtx = document.getElementById('daily-chart');
  if (barCtx) {
    new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: stats.chartData.map(d => d.label),
        datasets: [{
          data: stats.chartData.map(d => d.pnl),
          backgroundColor: stats.chartData.map(d => d.pnl >= 0 ? 'rgba(16,185,129,0.75)' : 'rgba(239,68,68,0.75)'),
          borderRadius: 4,
          barThickness: 16,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: {
          backgroundColor: '#1f2937', borderColor: '#374151', borderWidth: 1,
          titleColor: '#9ca3af', bodyColor: '#fff', cornerRadius: 10, padding: 10,
          callbacks: { label: (c) => fmt(c.raw) }
        }},
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 9 } }, border: { display: false } },
          y: { grid: { color: 'rgba(31,41,55,0.5)' }, ticks: { font: { size: 9 }, callback: v => `$${(v/1000).toFixed(0)}k` }, border: { display: false } },
        }
      }
    });
  }
}

// ─── Events ───
function bindEvents() {
  // tabs
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.tab = btn.dataset.tab;
      render();
    });
  });

  // FAB
  const fab = $('#fab-btn');
  if (fab) fab.addEventListener('click', () => { state.modal = 'picker'; render(); });

  // modal overlay close
  const overlay = $('#modal-overlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { state.modal = null; render(); }
    });
    // prevent sheet clicks from closing
    const sheet = $('#modal-sheet');
    if (sheet) sheet.addEventListener('click', e => e.stopPropagation());
  }

  // picker buttons
  $$('[data-pick]').forEach(btn => {
    btn.addEventListener('click', () => { state.modal = btn.dataset.pick; render(); });
  });

  // modal back
  const mBack = $('#m-back');
  if (mBack) mBack.addEventListener('click', () => { state.modal = 'picker'; render(); });

  // star buttons
  $$('.star-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = parseInt(btn.dataset.star);
      $$('.star-btn').forEach(b => {
        const n = parseInt(b.dataset.star);
        b.style.background = n <= val ? 'var(--amber)' : 'var(--bg-0)';
        b.style.color = n <= val ? '#000' : 'var(--text-3)';
      });
      btn.closest('.form-group')?.setAttribute('data-rating', val);
    });
  });

  // save
  const mSave = $('#m-save');
  if (mSave) mSave.addEventListener('click', handleSave);

  // view daily entries
  $$('[data-view-daily]').forEach(el => {
    el.addEventListener('click', () => {
      const entry = state.daily.find(d => d.id === el.dataset.viewDaily);
      if (entry) { state.viewing = { entry, type: 'daily' }; render(); }
    });
  });

  // view journal entries
  $$('[data-view-journal]').forEach(el => {
    el.addEventListener('click', () => {
      const entry = state.journal.find(j => j.id === el.dataset.viewJournal);
      if (entry) { state.viewing = { entry, type: 'journal' }; render(); }
    });
  });
}

async function handleSave() {
  const mode = state.modal;
  if (mode === 'daily') {
    const entry = {
      id: uid(),
      date: $('#m-date')?.value || today(),
      pnl: parseFloat($('#m-pnl')?.value) || 0,
      trades: parseInt($('#m-trades')?.value) || 0,
      wins: parseInt($('#m-wins')?.value) || 0,
      losses: parseInt($('#m-losses')?.value) || 0,
      rating: $('#m-rating')?.value || 'okay',
      session: 'New York',
      preMarket: $('#m-pre')?.value || '',
      postMarket: $('#m-post')?.value || '',
      reviewed: false,
    };
    state.daily.push(entry);
    await dbPut('daily', entry);
  } else if (mode === 'trade') {
    const ratingEl = document.querySelector('[data-rating]');
    const entry = {
      id: uid(),
      date: $('#m-date')?.value || today(),
      symbol: $('#m-symbol')?.value || 'MNQ',
      side: $('#m-side')?.value || 'Long',
      strategy: $('#m-strategy')?.value || 'ORB Breakout',
      pnl: parseFloat($('#m-pnl')?.value) || 0,
      volume: parseInt($('#m-volume')?.value) || 1,
      entry: parseFloat($('#m-entry')?.value) || 0,
      exit: parseFloat($('#m-exit')?.value) || 0,
      emotions: $('#m-emotions')?.value || 'calm',
      rating: ratingEl ? parseInt(ratingEl.dataset.rating) : 4,
    };
    state.trades.push(entry);
    await dbPut('trades', entry);
  } else if (mode === 'journal') {
    const entry = {
      id: uid(),
      date: $('#m-date')?.value || today(),
      title: $('#m-title')?.value || 'Untitled',
      category: $('#m-cat')?.value || 'freewrite',
      mood: $('#m-mood')?.value || 'neutral',
      body: $('#m-body')?.value || '',
    };
    state.journal.push(entry);
    await dbPut('journal', entry);
  }
  state.modal = null;
  render();
}

// ─── Init ───
async function init() {
  // Load data
  let [daily, trades, journal] = await Promise.all([
    dbGetAll('daily'), dbGetAll('trades'), dbGetAll('journal')
  ]);

  state.daily = daily;
  state.trades = trades;
  state.journal = journal;
  state.loaded = true;

  render();
}

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// Boot
document.addEventListener('DOMContentLoaded', init);
