/* TradeBook - Groups & Leaderboard Module
   Discord-style trading groups with competitive leaderboards */

var groupState = {
  groups: [],
  activeGroup: null,
  leaderboard: [],
  leaderFilter: 'week',
  groupModal: null
};

var LEADER_FILTERS = {
  today: { label: 'Today', fn: function(d) { return d.date === today(); } },
  week: { label: 'This Week', fn: function(d) {
    var now = new Date(); var day = now.getDay(); var diff = now.getDate() - day + (day === 0 ? -6 : 1);
    var monday = new Date(now.setDate(diff)).toISOString().split('T')[0];
    return d.date >= monday;
  }},
  month: { label: 'This Month', fn: function(d) {
    var prefix = new Date().toISOString().slice(0,7);
    return d.date.startsWith(prefix);
  }},
  ytd: { label: 'YTD', fn: function(d) {
    return d.date.startsWith(String(new Date().getFullYear()));
  }},
  all: { label: 'All Time', fn: function() { return true; } },
  best_day: { label: 'Best Day', special: 'best_day' },
  streak: { label: 'Win Streak', special: 'streak' },
  consistency: { label: 'Consistency', special: 'consistency' }
};

function genInviteCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code = '';
  for (var i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

async function loadGroups() {
  if (typeof sb === 'undefined' || !currentUser) return;
  try {
    var memRes = await sb.from('group_members').select('group_id').eq('user_id', currentUser.id);
    if (!memRes.data || memRes.data.length === 0) { groupState.groups = []; return; }
    var gids = memRes.data.map(function(m) { return m.group_id; });
    var grpRes = await sb.from('groups').select('*').in('id', gids);
    groupState.groups = grpRes.data || [];
  } catch(e) { console.warn('Failed to load groups:', e); }
}

async function createGroup(name, description) {
  if (typeof sb === 'undefined' || !currentUser) return;
  var code = genInviteCode();
  var res = await sb.from('groups').insert({ name: name, description: description || '', invite_code: code, owner_id: currentUser.id }).select().single();
  if (res.error) { alert('Error: ' + res.error.message); return; }
  await sb.from('group_members').insert({ group_id: res.data.id, user_id: currentUser.id, role: 'owner' });
  await loadGroups();
  groupState.activeGroup = res.data.id;
  render();
}

async function joinGroup(code) {
  if (typeof sb === 'undefined' || !currentUser) return;
  var res = await sb.rpc('find_group_by_invite', { code: code.toUpperCase().trim() });
  if (!res.data || res.data.length === 0) { alert('Invalid invite code'); return; }
  var group = res.data[0];
  var existing = await sb.from('group_members').select('user_id').eq('group_id', group.id).eq('user_id', currentUser.id);
  if (existing.data && existing.data.length > 0) { alert('You are already in this group!'); return; }
  await sb.from('group_members').insert({ group_id: group.id, user_id: currentUser.id, role: 'member' });
  await loadGroups();
  groupState.activeGroup = group.id;
  render();
}

async function leaveGroup(groupId) {
  if (typeof sb === 'undefined' || !currentUser) return;
  await sb.from('group_members').delete().eq('group_id', groupId).eq('user_id', currentUser.id);
  groupState.activeGroup = null;
  await loadGroups();
  render();
}

async function loadLeaderboard(groupId) {
  if (typeof sb === 'undefined' || !currentUser) return;
  try {
    var memRes = await sb.from('group_members').select('user_id').eq('group_id', groupId);
    if (!memRes.data) return;
    var uids = memRes.data.map(function(m) { return m.user_id; });
    var dailyRes = await sb.from('daily_entries').select('*').in('user_id', uids);
    var profRes = await sb.from('profiles').select('*').in('id', uids);
    var profiles = {};
    (profRes.data || []).forEach(function(p) { profiles[p.id] = p; });
    var filter = LEADER_FILTERS[groupState.leaderFilter];
    var board = [];
    uids.forEach(function(uid) {
      var entries = (dailyRes.data || []).filter(function(d) { return d.user_id === uid; });
      var profile = profiles[uid] || { display_name: 'Trader', avatar_url: '' };
      if (filter && filter.special) {
        if (filter.special === 'best_day') {
          var best = entries.reduce(function(max, d) { return d.pnl > max ? d.pnl : max; }, -Infinity);
          board.push({ uid: uid, name: profile.display_name || 'Trader', value: best === -Infinity ? 0 : best, label: '$', entries: entries });
        } else if (filter.special === 'streak') {
          var sorted = entries.filter(function(d) { return d.pnl > 0; }).sort(function(a,b) { return a.date.localeCompare(b.date); });
          var maxStreak = 0; var curStreak = 0; var prevDate = null;
          sorted.forEach(function(d) {
            var dt = new Date(d.date + 'T12:00:00');
            if (prevDate) {
              var diff = (dt - prevDate) / (1000*60*60*24);
              curStreak = diff <= 1 ? curStreak + 1 : 1;
            } else { curStreak = 1; }
            if (curStreak > maxStreak) maxStreak = curStreak;
            prevDate = dt;
          });
          board.push({ uid: uid, name: profile.display_name || 'Trader', value: maxStreak, label: 'd', entries: entries });
        } else if (filter.special === 'consistency') {
          var green = entries.filter(function(d) { return d.pnl > 0; }).length;
          var pct = entries.length > 0 ? Math.round((green / entries.length) * 100) : 0;
          board.push({ uid: uid, name: profile.display_name || 'Trader', value: pct, label: '%', entries: entries });
        }
      } else {
        var filtered = filter ? entries.filter(filter.fn) : entries;
        var totalPnl = filtered.reduce(function(s, d) { return s + Number(d.pnl); }, 0);
        board.push({ uid: uid, name: profile.display_name || 'Trader', value: totalPnl, label: '$', entries: entries, filtered: filtered });
      }
    });
    board.sort(function(a, b) { return b.value - a.value; });
    groupState.leaderboard = board;
  } catch(e) { console.warn('Leaderboard error:', e); }
}

function renderGroups() {
  if (groupState.activeGroup) return renderGroupDetail();
  return '<div class="stack">' +
    '<div class="row between" style="margin-bottom:8px">' +
    '<p class="label">Your Groups</p>' +
    '<div class="row gap-8">' +
    '<button class="btn btn-secondary" style="padding:6px 12px;font-size:0.6875rem" id="join-group-btn">Join Group</button>' +
    '<button class="btn btn-primary" style="padding:6px 12px;font-size:0.6875rem" id="create-group-btn">Create Group</button>' +
    '</div></div>' +
    (groupState.groups.length === 0 ?
      '<div class="card" style="text-align:center;padding:40px"><p style="font-size:2rem;margin-bottom:8px">\u{1F465}</p><p class="heading-md" style="margin-bottom:4px">No groups yet</p><p class="text-dim" style="font-size:0.75rem">Create a group or join one with an invite code to compete with friends!</p></div>'
      : groupState.groups.map(function(g) {
        return '<div class="card group-card" data-view-group="' + g.id + '" style="cursor:pointer">' +
          '<div class="row between">' +
          '<div><p class="heading-md">' + esc(g.name) + '</p>' +
          (g.description ? '<p class="text-dim" style="font-size:0.6875rem;margin-top:2px">' + esc(g.description) + '</p>' : '') +
          '</div>' +
          '<span style="font-size:1.25rem">\u{1F4CA}</span>' +
          '</div>' +
          '<div class="row gap-8" style="margin-top:8px">' +
          '<span class="pill" style="background:var(--green-dim);color:var(--green)">Code: ' + esc(g.invite_code) + '</span>' +
          '</div></div>';
      }).join('')) +
    (groupState.groupModal === 'create' ? renderCreateModal() : '') +
    (groupState.groupModal === 'join' ? renderJoinModal() : '') +
    '</div>';
}

function renderGroupDetail() {
  var group = groupState.groups.find(function(g) { return g.id === groupState.activeGroup; });
  if (!group) { groupState.activeGroup = null; return renderGroups(); }
  var isOwner = group.owner_id === (currentUser ? currentUser.id : '');
  var filters = Object.keys(LEADER_FILTERS);
  return '<div class="stack">' +
    '<button class="back-btn" id="group-back-btn">\u2190 All Groups</button>' +
    '<div class="row between" style="margin-bottom:4px">' +
    '<div><h2 class="heading-xl">' + esc(group.name) + '</h2>' +
    (group.description ? '<p class="text-dim" style="font-size:0.6875rem;margin-top:2px">' + esc(group.description) + '</p>' : '') +
    '</div>' +
    '</div>' +
    '<div class="row gap-8" style="margin-bottom:12px">' +
    '<span class="pill" style="background:var(--green-dim);color:var(--green)">Invite: ' + esc(group.invite_code) + '</span>' +
    (!isOwner ? '<button class="btn-danger-sm" id="leave-group-btn">Leave Group</button>' : '') +
    '</div>' +
    '<div class="leader-filters" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px">' +
    filters.map(function(k) {
      var f = LEADER_FILTERS[k];
      var active = groupState.leaderFilter === k;
      return '<button class="pill leader-filter-btn' + (active ? ' active' : '') + '" data-filter="' + k + '" style="cursor:pointer;padding:4px 10px;border:1px solid ' + (active ? 'var(--green)' : 'var(--border)') + ';background:' + (active ? 'var(--green-dim)' : 'var(--bg-0)') + ';color:' + (active ? 'var(--green)' : 'var(--text-2)') + '">' + f.label + '</button>';
    }).join('') +
    '</div>' +
    '<div class="card"><p class="label" style="margin-bottom:12px">\u{1F3C6} Leaderboard</p>' +
    (groupState.leaderboard.length === 0 ? '<p class="text-dim" style="text-align:center;padding:20px;font-size:0.8125rem">No data yet</p>' :
    groupState.leaderboard.map(function(entry, i) {
      var medal = i === 0 ? '\u{1F947}' : i === 1 ? '\u{1F948}' : i === 2 ? '\u{1F949}' : (i+1);
      var isMe = entry.uid === (currentUser ? currentUser.id : '');
      var valStr = entry.label === '$' ? fmtK(entry.value) : entry.value + entry.label;
      var totalTrades = entry.entries ? entry.entries.reduce(function(s,d) { return s + (d.trades || 0); }, 0) : 0;
      var greenDays = entry.entries ? entry.entries.filter(function(d) { return d.pnl > 0; }).length : 0;
      return '<div class="leader-row' + (isMe ? ' leader-me' : '') + '" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">' +
        '<span style="font-size:1.125rem;min-width:28px;text-align:center">' + medal + '</span>' +
        '<div style="flex:1"><p style="font-weight:700;font-size:0.8125rem">' + esc(entry.name) + (isMe ? ' <span style="color:var(--green);font-size:0.625rem">(you)</span>' : '') + '</p>' +
        '<p class="text-dim" style="font-size:0.5625rem">' + totalTrades + ' trades \u00B7 ' + greenDays + ' green days</p></div>' +
        '<span class="mono" style="font-size:1rem;font-weight:900;color:' + (entry.value >= 0 ? 'var(--green)' : 'var(--red)') + '">' + valStr + '</span>' +
        '</div>';
    }).join('')) +
    '</div></div>';
}

function renderCreateModal() {
  return '<div class="modal-overlay" id="group-modal-overlay">' +
    '<div class="modal-sheet" id="group-modal-sheet">' +
    '<div class="modal-handle"></div>' +
    '<h3 class="heading-lg" style="margin-bottom:12px">\u{1F465} Create Group</h3>' +
    '<div class="stack gap-12">' +
    '<div class="form-group"><label class="form-label">Group Name</label><input class="input" id="g-name" placeholder="e.g. Day Trading Squad"></div>' +
    '<div class="form-group"><label class="form-label">Description (optional)</label><input class="input" id="g-desc" placeholder="What is this group about?"></div>' +
    '<div class="row gap-8"><button class="btn btn-secondary" style="flex:1" id="g-cancel">Cancel</button><button class="btn btn-primary" style="flex:2" id="g-create-save">Create Group</button></div>' +
    '</div></div></div>';
}

function renderJoinModal() {
  return '<div class="modal-overlay" id="group-modal-overlay">' +
    '<div class="modal-sheet" id="group-modal-sheet">' +
    '<div class="modal-handle"></div>' +
    '<h3 class="heading-lg" style="margin-bottom:12px">\u{1F517} Join Group</h3>' +
    '<div class="stack gap-12">' +
    '<div class="form-group"><label class="form-label">Invite Code</label><input class="input" id="g-code" placeholder="e.g. ABC123" style="text-transform:uppercase;letter-spacing:0.15em;font-weight:700;text-align:center;font-size:1.25rem"></div>' +
    '<div class="row gap-8"><button class="btn btn-secondary" style="flex:1" id="g-cancel">Cancel</button><button class="btn btn-primary" style="flex:2" id="g-join-save">Join Group</button></div>' +
    '</div></div></div>';
}

function bindGroupEvents() {
  var createBtn = document.getElementById('create-group-btn');
  if (createBtn) createBtn.addEventListener('click', function() { groupState.groupModal = 'create'; render(); });
  var joinBtn = document.getElementById('join-group-btn');
  if (joinBtn) joinBtn.addEventListener('click', function() { groupState.groupModal = 'join'; render(); });
  var backBtn = document.getElementById('group-back-btn');
  if (backBtn) backBtn.addEventListener('click', function() { groupState.activeGroup = null; render(); });
  var leaveBtn = document.getElementById('leave-group-btn');
  if (leaveBtn) leaveBtn.addEventListener('click', function() { if (confirm('Leave this group?')) leaveGroup(groupState.activeGroup); });
  document.querySelectorAll('[data-view-group]').forEach(function(el) {
    el.addEventListener('click', function() {
      groupState.activeGroup = el.dataset.viewGroup;
      groupState.leaderFilter = 'week';
      loadLeaderboard(groupState.activeGroup).then(function() { render(); });
    });
  });
  document.querySelectorAll('.leader-filter-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      groupState.leaderFilter = btn.dataset.filter;
      loadLeaderboard(groupState.activeGroup).then(function() { render(); });
    });
  });
  var overlay = document.getElementById('group-modal-overlay');
  if (overlay) overlay.addEventListener('click', function(e) { if (e.target === overlay) { groupState.groupModal = null; render(); } });
  var sheet = document.getElementById('group-modal-sheet');
  if (sheet) sheet.addEventListener('click', function(e) { e.stopPropagation(); });
  var cancelBtn = document.getElementById('g-cancel');
  if (cancelBtn) cancelBtn.addEventListener('click', function() { groupState.groupModal = null; render(); });
  var createSave = document.getElementById('g-create-save');
  if (createSave) createSave.addEventListener('click', function() {
    var name = (document.getElementById('g-name') || {}).value;
    if (!name || !name.trim()) { alert('Enter a group name'); return; }
    groupState.groupModal = null;
    createGroup(name.trim(), (document.getElementById('g-desc') || {}).value || '');
  });
  var joinSave = document.getElementById('g-join-save');
  if (joinSave) joinSave.addEventListener('click', function() {
    var code = (document.getElementById('g-code') || {}).value;
    if (!code || !code.trim()) { alert('Enter an invite code'); return; }
    groupState.groupModal = null;
    joinGroup(code.trim());
  });
}