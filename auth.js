/*
  TradeBook â Supabase Auth Module
  Handles signup, login, logout, and session persistence.
  Loaded before app.js in index.html.
*/

var SUPABASE_URL = 'https://kdeaulglvhqqgboeggsl.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkZWF1bGdsdmhxcWdib2VnZ3NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMTE5MzQsImV4cCI6MjA4Njc4NzkzNH0.6uyJa6O-H49M36pOohxJpoXdE0RGEeOLI41sTARURmY';

// Initialize Supabase client (loaded via CDN in index.html)
var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Current user reference
let currentUser = null;

// â Auth UI â

function renderAuthScreen() {
  const app = document.getElementById('app');
  app.innerHTML = '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px">'
    + '<div style="width:100%;max-width:360px">'
    + '<h1 class="heading-xl" style="text-align:center;margin-bottom:4px">TradeBook</h1>'
    + '<p class="label" style="text-align:center;margin-bottom:24px;opacity:0.6">Trading Journal</p>'
    + '<div id="auth-error" style="color:#ff6b6b;font-size:13px;text-align:center;margin-bottom:12px;display:none"></div>'
    + '<form id="auth-form" autocomplete="off">'
    + '<input id="auth-email" type="email" placeholder="Email" required style="width:100%;padding:12px;margin-bottom:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:var(--bg-1);color:var(--text-1);font-size:14px;box-sizing:border-box">'
    + '<input id="auth-pass" type="password" placeholder="Password" required minlength="6" style="width:100%;padding:12px;margin-bottom:16px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:var(--bg-1);color:var(--text-1);font-size:14px;box-sizing:border-box">'
    + '<button id="auth-submit" type="submit" style="width:100%;padding:13px;border-radius:10px;border:none;background:#22c55e;color:#000;font-weight:600;font-size:14px;cursor:pointer;font-family:var(--font)">Sign In</button>'
    + '</form>'
    + '<p id="auth-toggle" style="text-align:center;margin-top:16px;font-size:13px;color:var(--text-3);cursor:pointer">Don\'t have an account? <span style="color:#22c55e;font-weight:600">Sign Up</span></p>'
    + '</div></div>';

  let isLogin = true;
  var toggle = document.getElementById('auth-toggle');
  var submitBtn = document.getElementById('auth-submit');

  toggle.addEventListener('click', function() {
    isLogin = !isLogin;
    submitBtn.textContent = isLogin ? 'Sign In' : 'Sign Up';
    toggle.innerHTML = isLogin
      ? 'Don\'t have an account? <span style="color:#22c55e;font-weight:600">Sign Up</span>'
      : 'Already have an account? <span style="color:#22c55e;font-weight:600">Sign In</span>';
  });

  var form = document.getElementById('auth-form');
  var errorEl = document.getElementById('auth-error');

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    var email = document.getElementById('auth-email').value.trim();
    var pass = document.getElementById('auth-pass').value;
    errorEl.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = isLogin ? 'Signing in...' : 'Signing up...';

    try {
      var result;
      if (isLogin) {
        result = await sb.auth.signInWithPassword({ email: email, password: pass });
      } else {
        result = await sb.auth.signUp({ email: email, password: pass });
      }
      if (result.error) throw result.error;
      if (!isLogin && !result.data.session) {
        errorEl.style.display = 'block';
        errorEl.style.color = '#22c55e';
        errorEl.textContent = 'Check your email to confirm your account!';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign Up';
        return;
      }
    } catch (err) {
      errorEl.style.display = 'block';
      errorEl.style.color = '#ff6b6b';
      errorEl.textContent = err.message || 'Authentication failed';
      submitBtn.disabled = false;
      submitBtn.textContent = isLogin ? 'Sign In' : 'Sign Up';
    }
  });
}

// â Session Management â

async function handleAuthChange(event, session) {
  if (session && session.user) {
    currentUser = session.user;
    sb.from('profiles').upsert({ id: session.user.id, display_name: (session.user.email || '').split('@')[0] }, { onConflict: 'id' });
    if (typeof init === 'function') init();
  } else {
    currentUser = null;
    renderAuthScreen();
  }
}

// â Logout (call from app.js) â

async function logout() {
  await sb.auth.signOut();
  currentUser = null;
  renderAuthScreen();
}

// â Boot auth â

(async function bootAuth() {
  sb.auth.onAuthStateChange(handleAuthChange);
  var sess = await sb.auth.getSession();
  if (sess.data.session && sess.data.session.user) {
    currentUser = sess.data.session.user;
    if (typeof init === 'function') init();
  } else {
    renderAuthScreen();
  }
})();

