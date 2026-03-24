// i18n + cycleLang + updateLangCycleBtn are loaded from lang.js

// ==================== Premium system ====================
const FREE_PACKS = ['couples', 'bestfriends', 'attachment', 'lovelang'];
let isPremium = localStorage.getItem('bs-premium') === 'true';

function isPackFree(key) {
  return FREE_PACKS.includes(key);
}

function mockPurchasePremium() {
  isPremium = true;
  localStorage.setItem('bs-premium', 'true');
  localStorage.setItem('bs-premium-date', new Date().toISOString());
  closePremiumModal();
  renderPacksGrid();
  if (currentScreen === 'profile') renderProfile();
}

function cancelPremium() {
  if (!confirm(i18n.t('profile_cancel_confirm'))) return;
  isPremium = false;
  localStorage.removeItem('bs-premium');
  localStorage.removeItem('bs-premium-date');
  renderProfile();
  renderPacksGrid();
}

function showPremiumModal(packKey) {
  const modal = document.getElementById('premiumModal');
  if (!modal) return;
  // Update dynamic content
  const packDef = packDefs.find(p => p.key === packKey);
  const banner = modal.querySelector('.premium-pack-banner');
  if (banner && packDef) {
    banner.innerHTML = `<span class="premium-pack-emoji">${packDef.emoji}</span> <span>${i18n.t(packDef.nameKey)}</span> <span class="premium-pack-badge">${i18n.t('premium_lock_label')}</span>`;
    banner.style.display = '';
  } else if (banner) {
    banner.style.display = 'none';
  }
  // Update i18n texts (safe — skip if element missing)
  const _t = (sel, key) => { const el = modal.querySelector(sel); if (el) el.textContent = i18n.t(key); };
  _t('.premium-modal-title', 'premium_title');
  _t('.premium-modal-subtitle', 'premium_subtitle');
  _t('.premium-price-current', 'premium_price');
  _t('.premium-price-period', 'premium_period');
  _t('.premium-price-was', 'premium_was_price');
  _t('.premium-limited-tag', 'premium_limited');
  _t('.premium-cta-btn', 'premium_cta');
  _t('.premium-trial-note', 'premium_trial_note');
  _t('.premium-social-proof', 'premium_social_proof');
  _t('.premium-guarantee', 'premium_guarantee');
  _t('.premium-restore-btn', 'premium_restore');
  const features = modal.querySelectorAll('.premium-feature-text');
  const featureKeys = ['premium_feature_packs', 'premium_feature_insights', 'premium_feature_advisor', 'premium_feature_unlimited'];
  features.forEach((el, i) => { if (featureKeys[i]) el.textContent = i18n.t(featureKeys[i]); });

  modal.classList.add('show');
}

function closePremiumModal() {
  document.getElementById('premiumModal')?.classList.remove('show');
}

// ==================== Theme system ====================
let currentThemeMode = localStorage.getItem('bs-theme') || 'light';
let currentAccent = localStorage.getItem('bs-accent') || 'sunset';

function initTheme() {
  setTheme(currentThemeMode, true);
  setAccent(currentAccent, true);
}

function toggleTheme() {
  setTheme(currentThemeMode === 'dark' ? 'light' : 'dark');
}

function setTheme(mode, silent) {
  currentThemeMode = mode;
  document.documentElement.setAttribute('data-theme', mode);
  localStorage.setItem('bs-theme', mode);
  document.querySelectorAll('.theme-mode-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('modeBtn-' + mode);
  if (btn) btn.classList.add('active');
}

function setAccent(name, silent) {
  currentAccent = name;
  document.documentElement.setAttribute('data-accent', name);
  localStorage.setItem('bs-accent', name);
  document.querySelectorAll('.accent-swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.accent === name);
  });
}

function toggleSettings() {
  const panel = document.getElementById('settingsPanel');
  const backdrop = document.getElementById('settingsBackdrop');
  const isOpen = panel.classList.contains('open');
  panel.classList.toggle('open', !isOpen);
  backdrop.classList.toggle('open', !isOpen);
}

initTheme();
i18n.init();

// ==================== API MODULE ====================
const API_URL = 'https://api.rome.markets';

const blindApi = {
  _userId() { return localStorage.getItem('bs-user-id') || ''; },

  async _fetch(path, options = {}) {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': this._userId(),
        ...options.headers
      }
    });
    return res.json();
  },

  auth(username, password) {
    return this._fetch('/api/blind/auth', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  },

  checkUsername(username) {
    return this._fetch('/api/blind/auth/check', {
      method: 'POST',
      body: JSON.stringify({ username })
    });
  },

  guestAuth(displayName) {
    return this._fetch('/api/blind/auth/guest', {
      method: 'POST',
      body: JSON.stringify({ displayName })
    });
  },

  upgradeGuest(password) {
    return this._fetch('/api/blind/auth/upgrade', {
      method: 'POST',
      body: JSON.stringify({ password })
    });
  },

  createSession(pack_key, lang) {
    return this._fetch('/api/blind/sessions', {
      method: 'POST',
      body: JSON.stringify({ pack_key, lang })
    });
  },

  getSession(code) {
    return this._fetch(`/api/blind/sessions/${code}`);
  },

  joinSession(code) {
    return this._fetch(`/api/blind/sessions/${code}/join`, { method: 'POST' });
  },

  submitAnswers(code, answers) {
    return this._fetch(`/api/blind/sessions/${code}/answers`, {
      method: 'POST',
      body: JSON.stringify({ answers })
    });
  },

  getResults(code) {
    return this._fetch(`/api/blind/sessions/${code}/results`);
  },

  getUserSessions() {
    return this._fetch('/api/blind/sessions/user');
  },

  deleteSession(code) {
    return this._fetch(`/api/blind/sessions/${code}`, { method: 'DELETE' });
  }
};

// ==================== STATE ====================
let currentScreen = 'splash';
let currentQuestion = 0;
let selectedAnswers = {};
let selectedPackKey = 'couples';
let currentUser = JSON.parse(localStorage.getItem('bs-user') || 'null');
let currentSession = null;
let pollTimer = null;
let afterAuthTarget = 'home';
let joinCode = null; // set when joining via URL
let isGuest = JSON.parse(localStorage.getItem('bs-guest') || 'false');
let pendingAuthUsername = null; // holds username between auth step 1 and step 2


// Alias map for legacy pack keys from API → current keys
const PACK_KEY_ALIASES = { whathehides: 'whattheyhide', hisarchetype: 'partnertype' };
const resolvePackKey = (key) => PACK_KEY_ALIASES[key] || key;

// packDefs loaded from packs.js, questions fetched on demand via loadQuestions()

// Check if a pack is solo (no partner needed)
function isSoloPack(key) {
  const def = packDefs.find(p => p.key === key);
  return def && def.solo === true;
}

// Get current language questions for a pack, sorted so swipe-format questions come last
async function getQuestions(packKey) {
  const lang = i18n.current;
  const pack = await loadQuestions(packKey, lang);
  const mapped = pack.map(q => ({
    q: q.q,
    options: q.options,
    partnerAnswerIndex: q.pi,
    traits: q.traits || null,
    format: q.format || null
  }));
  // Sort: non-swipe first, swipe last
  const normal = mapped.filter(q => q.format !== 'swipe');
  const swipe = mapped.filter(q => q.format === 'swipe');
  return [...normal, ...swipe];
}

// Check if a question index has a valid answer (handles both single and multi-select)
function hasAnswer(qi) {
  const a = selectedAnswers[qi];
  if (Array.isArray(a)) return a.length > 0;
  // Blind guess: need both own and guess
  if (a && typeof a === 'object' && 'own' in a) {
    return a.own !== undefined && a.guess !== undefined;
  }
  return a !== undefined && a !== null;
}

// Get display text for an answer (handles both single index and array of indices)
function getAnswerText(qi, q) {
  const a = selectedAnswers[qi];
  if (a == null) return '—';
  if (Array.isArray(a)) return a.map(idx => q.options[idx]).join(', ');
  // Blind guess: return own answer text
  if (typeof a === 'object' && 'own' in a) return q.options[a.own] || '—';
  return q.options[a] || '—';
}

// Check if a multi-select answer includes the partner's pick
function answerMatches(qi, partnerIdx) {
  const a = selectedAnswers[qi];
  if (Array.isArray(a)) return a.includes(partnerIdx);
  // Blind guess: match on own answer
  if (a && typeof a === 'object' && 'own' in a) return a.own === partnerIdx;
  return a === partnerIdx;
}

let questions = [];

// ==================== AUTH FLOW ====================
function showAuth(target) {
  afterAuthTarget = target;
  if (currentUser) {
    goTo(afterAuthTarget);
    return;
  }
  // If joining via invite, show guest auth
  if (joinCode) {
    goTo('guestAuth');
    setTimeout(() => document.getElementById('guestName')?.focus(), 300);
    return;
  }
  goTo('auth');
  resetAuthSteps();
  setTimeout(() => document.getElementById('authUsername')?.focus(), 300);
}

function resetAuthSteps() {
  document.getElementById('authStep1').style.display = '';
  document.getElementById('authStep2Login').style.display = 'none';
  document.getElementById('authStep2Signup').style.display = 'none';
  document.getElementById('authError').textContent = '';
  document.getElementById('loginError').textContent = '';
  document.getElementById('signupError').textContent = '';
  const pwFields = document.querySelectorAll('#auth input[type="password"]');
  pwFields.forEach(f => f.value = '');
  pendingAuthUsername = null;
}

// Step 1: Check if username exists
async function doAuthStep1() {
  const input = document.getElementById('authUsername');
  const err = document.getElementById('authError');
  const btn = document.getElementById('authBtn');
  const username = input.value.trim();

  if (username.length < 2) {
    err.textContent = i18n.t('guest_error_min_chars');
    return;
  }

  btn.disabled = true;
  btn.textContent = '...';
  err.textContent = '';

  try {
    const check = await blindApi.checkUsername(username);
    if (check.error) { err.textContent = check.error; return; }

    pendingAuthUsername = username;
    document.getElementById('authStep1').style.display = 'none';

    if (check.exists) {
      document.getElementById('loginGreeting').innerHTML = i18n.t('auth_signing_in').replace('{name}', `<strong>${username}</strong>`);
      document.getElementById('authStep2Login').style.display = '';
      setTimeout(() => document.getElementById('loginPassword')?.focus(), 200);

      // If user has no password (legacy), skip password step
      if (!check.has_password) {
        const data = await blindApi.auth(username);
        if (data.user) { finishAuth(data.user); return; }
      }
    } else {
      document.getElementById('signupGreeting').innerHTML = i18n.t('auth_nice_to_meet').replace('{name}', `<strong>${username}</strong>`);
      document.getElementById('authStep2Signup').style.display = '';
      setTimeout(() => document.getElementById('signupPassword')?.focus(), 200);
    }
  } catch (e) {
    err.textContent = i18n.t('guest_error_connection');
  } finally {
    btn.disabled = false;
    btn.textContent = i18n.t('auth_continue');
  }
}

// Step 2a: Login with password
async function doLogin() {
  const password = document.getElementById('loginPassword').value;
  const err = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');

  if (!password) { err.textContent = i18n.t('auth_enter_password'); return; }

  btn.disabled = true;
  btn.textContent = '...';
  err.textContent = '';

  try {
    const data = await blindApi.auth(pendingAuthUsername, password);
    if (data.error) { err.textContent = data.error; return; }

    finishAuth(data.user);
  } catch (e) {
    err.textContent = i18n.t('guest_error_connection');
  } finally {
    btn.disabled = false;
    btn.textContent = i18n.t('auth_sign_in');
  }
}

// Step 2b: Signup with password
async function doSignup() {
  const password = document.getElementById('signupPassword').value;
  const confirm = document.getElementById('signupPasswordConfirm').value;
  const err = document.getElementById('signupError');
  const btn = document.getElementById('signupBtn');

  if (password.length < 4) { err.textContent = i18n.t('auth_password_min_chars'); return; }
  if (password !== confirm) { err.textContent = i18n.t('auth_passwords_no_match'); return; }

  btn.disabled = true;
  btn.textContent = '...';
  err.textContent = '';

  try {
    const data = await blindApi.auth(pendingAuthUsername, password);
    if (data.error) { err.textContent = data.error; return; }

    finishAuth(data.user);
  } catch (e) {
    err.textContent = i18n.t('guest_error_connection');
  } finally {
    btn.disabled = false;
    btn.textContent = i18n.t('auth_create_account');
  }
}

function authGoBack() {
  document.getElementById('authStep2Login').style.display = 'none';
  document.getElementById('authStep2Signup').style.display = 'none';
  document.getElementById('authStep1').style.display = '';
  document.getElementById('loginError').textContent = '';
  document.getElementById('signupError').textContent = '';
  const pwFields = document.querySelectorAll('#auth input[type="password"]');
  pwFields.forEach(f => f.value = '');
  setTimeout(() => document.getElementById('authUsername')?.focus(), 200);
}

// Shared: finish auth and proceed
function finishAuth(user) {
  currentUser = user;
  localStorage.setItem('bs-user', JSON.stringify(currentUser));
  localStorage.setItem('bs-user-id', currentUser.id);
  localStorage.removeItem('bs-guest');
  isGuest = false;

  if (joinCode) {
    handleJoinCode(joinCode);
    joinCode = null;
    return;
  }

  goTo(afterAuthTarget);
}

// Guest auth (join via invite link without account)
async function doGuestAuth() {
  const input = document.getElementById('guestName');
  const err = document.getElementById('guestAuthError');
  const btn = document.getElementById('guestAuthBtn');
  const displayName = input.value.trim();

  if (displayName.length < 2) {
    err.textContent = i18n.t('guest_error_min_chars');
    return;
  }

  btn.disabled = true;
  btn.textContent = '...';
  err.textContent = '';

  try {
    const data = await blindApi.guestAuth(displayName);
    if (data.error) { err.textContent = data.error; return; }

    currentUser = data.user;
    localStorage.setItem('bs-user', JSON.stringify(currentUser));
    localStorage.setItem('bs-user-id', currentUser.id);
    localStorage.setItem('bs-guest', 'true');
    isGuest = true;

    if (joinCode) {
      await handleJoinCode(joinCode);
      joinCode = null;
      return;
    }
    goTo('home');
  } catch (e) {
    err.textContent = i18n.t('guest_error_connection');
  } finally {
    btn.disabled = false;
    btn.textContent = i18n.t('guest_play');
  }
}

function guestToFullAuth() {
  goTo('auth');
  resetAuthSteps();
  setTimeout(() => document.getElementById('authUsername')?.focus(), 300);
}

// Enter key handlers
document.getElementById('authUsername')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') doAuthStep1();
});
document.getElementById('loginPassword')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});
document.getElementById('signupPasswordConfirm')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') doSignup();
});
document.getElementById('signupPassword')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('signupPasswordConfirm')?.focus();
});
document.getElementById('guestName')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') doGuestAuth();
});

// Save guest account (after session)
async function saveGuestAccount() {
  const password = document.getElementById('saveAccPassword').value;
  const confirm = document.getElementById('saveAccPasswordConfirm').value;
  const err = document.getElementById('saveAccError');

  if (password.length < 4) { err.textContent = i18n.t('auth_password_min_chars'); return; }
  if (password !== confirm) { err.textContent = i18n.t('auth_passwords_no_match'); return; }

  err.textContent = '';

  try {
    const data = await blindApi.upgradeGuest(password);
    if (data.error) { err.textContent = data.error; return; }

    localStorage.removeItem('bs-guest');
    isGuest = false;
    closeSaveAccountModal();

    // Update user if returned
    if (data.user) {
      currentUser = data.user;
      localStorage.setItem('bs-user', JSON.stringify(currentUser));
    }
  } catch (e) {
    err.textContent = i18n.t('guest_error_connection');
  }
}

function showSaveAccountModal() {
  if (sessionStorage.getItem('bs-save-prompt-dismissed')) return;
  document.getElementById('saveAccPassword').value = '';
  document.getElementById('saveAccPasswordConfirm').value = '';
  document.getElementById('saveAccError').textContent = '';
  document.getElementById('saveAccountModal').classList.add('show');
}

function closeSaveAccountModal() {
  document.getElementById('saveAccountModal').classList.remove('show');
  sessionStorage.setItem('bs-save-prompt-dismissed', 'true');
}

function switchUser() {
  currentUser = null;
  currentSession = null;
  isGuest = false;
  localStorage.removeItem('bs-user');
  localStorage.removeItem('bs-user-id');
  localStorage.removeItem('bs-guest');
  stopPolling();
  document.getElementById('authUsername').value = '';
  resetAuthSteps();
  afterAuthTarget = 'home';
  goTo('auth');
  setTimeout(() => document.getElementById('authUsername')?.focus(), 300);
}

// ==================== HOME SESSIONS ====================
let _cachedSessions = null;
let _homeFilter = 'all';
const HOME_PAGE_SIZE = 5;
let _activePageCount = 1;
let _donePageCount = 1;

function setHomeFilter(filter) {
  _homeFilter = filter;
  _activePageCount = 1;
  _donePageCount = 1;
  document.querySelectorAll('.home-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  renderHomeSessions();
}

function showMoreActive() {
  _activePageCount++;
  renderHomeSessions();
}

function showMoreDone() {
  _donePageCount++;
  renderHomeSessions();
}

function renderHomeSessions() {
  const container = document.getElementById('homeSessions');
  if (!container) return;
  if (_cachedSessions === null) {
    container.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-dim)">${i18n.t('home_loading')}</div>`;
    return;
  }
  const hidden = getHiddenSessions();
  const sessions = _cachedSessions.filter(s => !hidden.includes(s.code));

  if (sessions.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:40px 20px;color:var(--text-dim)">
        <div style="font-size:36px;margin-bottom:12px">🫣</div>
        <p>${i18n.t('home_no_sessions')}</p>
      </div>`;
    return;
  }

  const packEmojis = { couples: '💕', bestfriends: '👯', deeptalk: '🌊', coworkers: '💼', '36questions': '❤️‍🔥', hottakes: '🌶️', redflags: '🚩', chaotic: '🎲', fungames: '🎉', worldtaste: '🌍', ethics: '⚖️', situations: '😱', livingtogether: '🏠', soulspirit: '🕊️', attachment: '🔗', innermirror: '🪞', stresstype: '🧊', lovelang: '💌', shadow: '🌑', emotionalage: '🎭', boundaries: '🚧', selfsabotage: '🪤', partnertype: '🐕', partnerera: '👑', couplestory: '📖', whattheyhide: '🎭', flirtguess: '😏', desirematch: '🔥' };
  let html = '';
  const active = sessions.filter(s => s.status !== 'complete');
  const done = sessions.filter(s => s.status === 'complete');

  const showActive = _homeFilter === 'all' || _homeFilter === 'active';
  const showDone = _homeFilter === 'all' || _homeFilter === 'completed';

  if (showActive && active.length) {
    if (_homeFilter === 'all') html += `<div class="section-label">${i18n.t('home_active')}</div>`;
    const activeLimit = _activePageCount * HOME_PAGE_SIZE;
    const visibleActive = active.slice(0, activeLimit);
    visibleActive.forEach(s => {
      const partner = s.creator_id === currentUser.id ? s.partner_username : s.creator_username;
      const pk = resolvePackKey(s.pack_key);
      const emoji = packEmojis[pk] || '📦';
      const packName = i18n.t('pack_' + pk) || s.pack_key;
      let badge = '';
      if (s.status === 'waiting') badge = `<div class="s-badge badge-waiting">${i18n.t('badge_waiting')}</div>`;
      else if (s.status === 'active') badge = `<div class="s-badge badge-progress">${i18n.t('badge_progress')}</div>`;

      html += `<div class="session-card-wrap" data-code="${s.code}">
        <div class="session-card glass" onclick="resumeSession('${s.code}')">
          <div class="s-icon" style="background:rgba(124,58,237,0.1)">${emoji}</div>
          <div class="s-info">
            <div class="s-title">${packName}</div>
            <div class="s-sub">${partner ? i18n.t('home_with') + ' ' + partner : i18n.t('home_waiting_partner')} · ${s.code}</div>
          </div>
          ${badge}
        </div>
        <button class="delete-btn" onclick="openDeleteModal('${s.code}')">${i18n.t('delete_label')}</button>
      </div>`;
    });
    if (active.length > activeLimit) {
      html += `<button class="show-more-btn" onclick="showMoreActive()">${i18n.t('home_show_more')} (${active.length - activeLimit})</button>`;
    }
  }

  if (showDone && done.length) {
    if (_homeFilter === 'all') html += `<div class="section-label">${i18n.t('home_completed')}</div>`;
    const doneLimit = _donePageCount * HOME_PAGE_SIZE;
    const visibleDone = done.slice(0, doneLimit);
    visibleDone.forEach(s => {
      const partner = s.creator_id === currentUser.id ? s.partner_username : s.creator_username;
      const pk = resolvePackKey(s.pack_key);
      const emoji = packEmojis[pk] || '📦';
      const packName = i18n.t('pack_' + pk) || s.pack_key;
      html += `<div class="session-card-wrap" data-code="${s.code}">
        <div class="session-card glass" onclick="viewResults('${s.code}')">
          <div class="s-icon" style="background:var(--surface)">${emoji}</div>
          <div class="s-info">
            <div class="s-title">${packName}</div>
            <div class="s-sub">${i18n.t('home_with')} ${partner || '?'}</div>
          </div>
          <div class="s-badge badge-done">${i18n.t('home_done')}</div>
        </div>
        <button class="delete-btn" onclick="openDeleteModal('${s.code}')">${i18n.t('delete_label')}</button>
      </div>`;
    });
    if (done.length > doneLimit) {
      html += `<button class="show-more-btn" onclick="showMoreDone()">${i18n.t('home_show_more')} (${done.length - doneLimit})</button>`;
    }
  }

  if (!html) {
    const emptyKey = _homeFilter === 'active' ? 'home_active' : _homeFilter === 'completed' ? 'home_completed' : '';
    html = `<div style="text-align:center;padding:40px 20px;color:var(--text-dim)">
      <div style="font-size:36px;margin-bottom:12px">🫣</div>
      <p>${i18n.t('home_no_sessions')}</p>
    </div>`;
  }

  container.innerHTML = html;
  initSwipeToDelete();
}

async function loadHomeSessions() {
  const usernameEl = document.getElementById('homeUsername');
  if (currentUser) usernameEl.textContent = '@' + currentUser.username;
  if (_cachedSessions === null) renderHomeSessions();
  try {
    const data = await blindApi.getUserSessions();
    _cachedSessions = data.sessions || [];
    renderHomeSessions();
  } catch (e) {
    const container = document.getElementById('homeSessions');
    if (container) container.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-dim)">${i18n.t('home_load_error')}</div>`;
  }
}

async function resumeSession(code) {
  try {
    const data = await blindApi.getSession(code);
    const s = data.session;
    currentSession = s;
    selectedPackKey = resolvePackKey(s.pack_key);
    questions = await getQuestions(selectedPackKey);

    if (s.status === 'complete') {
      viewResults(code);
      return;
    }

    if (s.user_submitted) {
      // Already submitted, go to waiting
      goTo('waiting');
      document.getElementById('waitingCode').textContent = s.code;
      const pName = s.creator_id === currentUser?.id ? s.partner_username : s.creator_username;
      if (pName) {
        document.getElementById('waitingDesc').innerHTML =
          `waiting for <strong style="color:var(--text)">${pName}</strong> to finish answering...`;
      }
      startPolling();
      return;
    }

    // Start/continue quiz
    currentQuestion = 0;
    selectedAnswers = {};
    eliminatedSets = {};
    questionModes = [];
    goTo('quiz');
  } catch (e) {
    alert('Could not load session');
  }
}

async function viewResults(code) {
  try {
    currentSession = (await blindApi.getSession(code)).session;
    selectedPackKey = resolvePackKey(currentSession.pack_key);
    questions = await getQuestions(selectedPackKey);
    goTo('results');
    await buildReceiptFromApi(code);
  } catch (e) {
    alert('Could not load results');
  }
}

// ==================== SESSION CREATION ====================
function getInviteUrl() {
  if (!currentSession) return '';
  const base = window.location.origin + window.location.pathname;
  return base + '?join=' + currentSession.code;
}

function copyInviteLink(btn) {
  const url = getInviteUrl();
  navigator.clipboard.writeText(url).catch(() => {});
  const orig = btn.textContent;
  btn.textContent = i18n.t('feedback_copied');
  btn.style.background = 'var(--lime)';
  btn.style.color = '#000';
  setTimeout(() => {
    btn.textContent = orig;
    btn.style.background = '';
    btn.style.color = '';
  }, 2000);
}

function shareInvite(method) {
  const url = getInviteUrl();
  const text = 'take this blind quiz with me!';
  if (method === 'share' && navigator.share) {
    navigator.share({ title: 'blindside.', text, url }).catch(() => {});
  } else if (method === 'whatsapp') {
    window.open('https://wa.me/?text=' + encodeURIComponent(text + ' ' + url));
  } else if (method === 'sms') {
    window.open('sms:?body=' + encodeURIComponent(text + ' ' + url));
  }
}

// ==================== JOIN VIA URL ====================
async function handleJoinCode(code) {
  try {
    // First check session status
    const check = await blindApi.getSession(code);
    if (check.error) { alert('Session not found'); goTo('home'); return; }

    const session = check.session;

    // If already complete, just show results
    if (session.status === 'complete') {
      viewResults(code);
      return;
    }

    // If user already submitted for this session, go to waiting
    if (session.user_submitted) {
      currentSession = session;
      selectedPackKey = resolvePackKey(session.pack_key);
      questions = await getQuestions(selectedPackKey);
      goTo('waiting');
      document.getElementById('waitingCode').textContent = session.code;
      const pName = session.creator_id === currentUser?.id ? session.partner_username : session.creator_username;
      if (pName) {
        document.getElementById('waitingDesc').innerHTML =
          `waiting for <strong style="color:var(--text)">${pName}</strong> to finish answering...`;
      }
      startPolling();
      return;
    }

    // Join the session
    const data = await blindApi.joinSession(code);
    if (data.error) { alert(data.error); goTo('home'); return; }

    currentSession = data.session;
    selectedPackKey = resolvePackKey(currentSession.pack_key);
    questions = await getQuestions(selectedPackKey);

    currentQuestion = 0;
    selectedAnswers = {};
    eliminatedSets = {};
    questionModes = [];
    goTo('quiz');
  } catch (e) {
    alert('Could not join session');
    goTo('home');
  }
}

// Pack mode: 'partner' (duo) or 'self' (solo)
let activePackMode = 'partner';

function setPackMode(mode) {
  activePackMode = mode;
  document.querySelectorAll('.mode-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  renderPacksFeatured();
  renderCollections();
  renderPacksGridCards();
}

// Render featured carousel
function renderPacksFeatured() {
  const el = document.getElementById('packsFeatured');
  if (!el) return;
  const isSelf = activePackMode === 'self';
  const featured = packDefs.filter(p => p.featured && (isSelf ? p.solo : !p.solo));
  const featuredSection = document.getElementById('packsFeaturedSection');
  if (featuredSection) featuredSection.style.display = featured.length ? '' : 'none';
  el.innerHTML = featured.map((p, idx) => {
    const locked = !isPremium && !isPackFree(p.key);
    const badgeHtml = locked
      ? `<span class="lock-pill"></span>`
      : `<div class="featured-badge ${p.featuredBadge}">${i18n.t('badge_' + p.featuredBadge)}</div>`;
    return `<div class="featured-card ${locked ? 'pack-locked' : ''}" style="animation-delay:${idx * 0.1}s" onclick="selectPack('${p.key}')">
      ${badgeHtml}
      <div class="featured-emoji">${p.emoji}</div>
      <div class="featured-title">${i18n.t(p.nameKey)}</div>
      <div class="featured-desc">${i18n.t(p.descKey)}</div>
      <div class="featured-meta">
        <span class="meta-plays">${p.plays} ${i18n.t('packs_played')}</span>
      </div>
    </div>`;
  }).join('');
}

// Render collection cards
function renderCollections() {
  const grid = document.getElementById('collectionsGrid');
  if (!grid) return;
  const isSelf = activePackMode === 'self';
  const collections = packCollections.filter(c => isSelf ? c.mode === 'self' : c.mode === 'partner');
  grid.innerHTML = collections.map((c, idx) => {
    const deckCount = c.packs.length;
    const totalPlays = c.packs.reduce((sum, key) => {
      const def = packDefs.find(p => p.key === key);
      if (!def) return sum;
      const num = parseFloat(def.plays.replace('k', ''));
      return sum + num;
    }, 0);
    const badgeHtml = c.badge
      ? `<span class="coll-badge badge-${c.badge}">${i18n.t('badge_' + c.badge)}</span>`
      : '';
    const emojiPreview = c.packs.slice(0, 3).map(key => {
      const def = packDefs.find(p => p.key === key);
      return def ? def.emoji : '';
    }).join('');
    const collAllLocked = !isPremium && c.packs.every(k => !isPackFree(k));
    return `<div class="collection-card ${collAllLocked ? 'pack-locked' : ''}" style="animation-delay:${idx * 0.06}s" onclick="openCollection('${c.key}')">
      <div class="coll-card-bg" style="background:linear-gradient(135deg,${c.gradient[0]},${c.gradient[1]})"></div>
      <div class="coll-card-content">
        <div class="coll-card-top">
          <span class="coll-emoji">${c.emoji}</span>
          ${collAllLocked ? `<span class="lock-pill"></span>` : badgeHtml}
        </div>
        <div class="coll-card-title">${i18n.t(c.nameKey)}</div>
        <div class="coll-card-desc">${i18n.t(c.descKey)}</div>
        <div class="coll-card-footer">
          <span class="coll-deck-count">${deckCount} ${i18n.t('coll_decks')}</span>
          <span class="coll-preview-emojis">${emojiPreview}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

// Open a collection detail screen
let currentCollectionKey = null;
function openCollection(key) {
  currentCollectionKey = key;
  const coll = packCollections.find(c => c.key === key);
  if (!coll) return;
  goTo('collectionDetail');
}

function renderCollectionDetail() {
  const coll = packCollections.find(c => c.key === currentCollectionKey);
  if (!coll) return;

  const header = document.getElementById('collDetailHeader');
  const grid = document.getElementById('collDetailGrid');

  header.innerHTML = `
    <div class="coll-detail-hero" style="--coll-g1:${coll.gradient[0]};--coll-g2:${coll.gradient[1]}">
      <button class="btn-icon coll-back-btn" onclick="goTo('packs')">←</button>
      <div class="coll-hero-icon-wrap">
        <div class="coll-hero-icon-glow"></div>
        <div class="coll-hero-icon">${coll.emoji}</div>
      </div>
      <h2 class="coll-hero-title">${i18n.t(coll.nameKey)}</h2>
      <p class="coll-hero-desc">${i18n.t(coll.descKey)}</p>
      <div class="coll-hero-chips">
        <span class="coll-chip">${coll.packs.length} ${i18n.t('coll_decks')}</span>
      </div>
    </div>
  `;

  const packs = coll.packs.map(key => packDefs.find(p => p.key === key)).filter(Boolean);
  grid.innerHTML = packs.map((p, idx) => {
    const locked = !isPremium && !isPackFree(p.key);
    const badgeHtml = locked ? '' : (p.badge
      ? `<span class="pack-badge badge-${p.badge}">${i18n.t('badge_' + p.badge)}</span>`
      : '');
    return `<div class="pack-card glass ${locked ? 'pack-locked' : ''}" style="animation-delay:${idx * 0.04}s" onclick="selectPack('${p.key}')">
      <div class="pack-emoji">${p.emoji}</div>
      <div class="pack-info">
        <div class="pack-title">${i18n.t(p.nameKey)}</div>
        <div class="pack-meta-row">
          <span class="pack-plays">${p.plays} ${i18n.t('packs_played')}</span>
          <span class="pack-count">${i18n.t(p.countKey)}</span>
          ${badgeHtml}
        </div>
      </div>
      ${locked ? `<span class="lock-pill"></span>` : `<span class="pack-arrow">›</span>`}
    </div>`;
  }).join('');
}

// Render all packs list (below collections)
function renderPacksGridCards() {
  const grid = document.getElementById('packsGrid');
  if (!grid) return;
  const isSelf = activePackMode === 'self';
  let filtered = packDefs.filter(p => isSelf ? p.solo : !p.solo);
  grid.innerHTML = filtered.map((p, idx) => {
    const locked = !isPremium && !isPackFree(p.key);
    const badgeHtml = locked ? '' : (p.badge
      ? `<span class="pack-badge badge-${p.badge}">${i18n.t('badge_' + p.badge)}</span>`
      : '');
    return `<div class="pack-card glass ${locked ? 'pack-locked' : ''}" style="animation-delay:${idx * 0.04}s" onclick="selectPack('${p.key}')">
      <div class="pack-emoji">${p.emoji}</div>
      <div class="pack-info">
        <div class="pack-title">${i18n.t(p.nameKey)}</div>
        <div class="pack-meta-row">
          <span class="pack-plays">${p.plays} ${i18n.t('packs_played')}</span>
          <span class="pack-count">${i18n.t(p.countKey)}</span>
          ${badgeHtml}
        </div>
      </div>
      ${locked ? `<span class="lock-pill"></span>` : `<span class="pack-arrow">›</span>`}
    </div>`;
  }).join('');
}

// Full packs render
function renderPacksGrid() {
  renderPacksFeatured();
  renderCollections();
  renderPacksGridCards();
}
loadPackMeta().then(() => renderPacksGrid());

// Navigation
function goTo(screenId) {
  const prev = document.getElementById(currentScreen);
  const next = document.getElementById(screenId);
  if (!next) return;
  if (currentScreen === screenId) {
    // Allow re-triggering side effects for home
    if (screenId === 'home') { stopPolling(); loadHomeSessions(); }
    return;
  }

  // Hide SEO landing content once user navigates away from splash
  const seo = document.getElementById('seoContent');
  if (seo && screenId !== 'splash') seo.style.display = 'none';

  prev.classList.remove('active');
  prev.classList.add('slide-out');

  setTimeout(() => {
    prev.classList.remove('slide-out');
    next.classList.add('active');
    currentScreen = screenId;

    if (screenId === 'quiz') renderQuestion();
    if (screenId === 'results') { /* receipt built by caller */ }
    if (screenId === 'home') { updateNav('home'); stopPolling(); loadHomeSessions(); }
    if (screenId === 'packs') { updateNav('packs'); renderPacksGrid(); }
    if (screenId === 'collectionDetail') { updateNav('packs'); renderCollectionDetail(); }
    if (screenId === 'profile') { updateNav('profile'); renderProfile(); }
  }, 200);
}

function updateNav(active) {
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.nav === active);
  });
}

// ==================== Profile screen ====================
function goToProfile() {
  renderProfile();
  goTo('profile');
}

function renderProfile() {
  const container = document.getElementById('profileContent');
  if (!container) return;

  const username = currentUser ? currentUser.username : 'guest';
  const initial = username.charAt(0).toUpperCase();
  const sessionCount = _cachedSessions ? _cachedSessions.length : 0;
  const completedCount = _cachedSessions ? _cachedSessions.filter(s => s.status === 'complete').length : 0;
  const packsPlayed = _cachedSessions ? [...new Set(_cachedSessions.map(s => s.pack_key))].length : 0;

  // Premium start date (mock — stored when purchased)
  const premiumStart = localStorage.getItem('bs-premium-date') || '';
  const renewDate = premiumStart ? new Date(new Date(premiumStart).getTime() + 30 * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

  const premiumSection = isPremium ? `
    <div class="profile-plan-card profile-plan-active">
      <div class="profile-plan-top">
        <div class="profile-plan-icon">+</div>
        <div>
          <div class="profile-plan-name">blindside+</div>
          <div class="profile-plan-badge">${i18n.t('profile_plan_active')}</div>
        </div>
      </div>
      <div class="profile-billing-rows">
        <div class="profile-billing-row">
          <span class="profile-billing-label">${i18n.t('profile_plan_label')}</span>
          <span class="profile-billing-value">${i18n.t('premium_price')}${i18n.t('premium_period')}</span>
        </div>
        <div class="profile-billing-row">
          <span class="profile-billing-label">${i18n.t('profile_next_billing')}</span>
          <span class="profile-billing-value">${renewDate || '—'}</span>
        </div>
        <div class="profile-billing-row">
          <span class="profile-billing-label">${i18n.t('profile_payment')}</span>
          <span class="profile-billing-value">•••• 4242</span>
        </div>
      </div>
      <div class="profile-plan-actions">
        <button class="profile-plan-action-btn" onclick="alert('${i18n.t('profile_manage_info')}')">${i18n.t('profile_manage')}</button>
        <button class="profile-plan-action-btn profile-plan-cancel" onclick="cancelPremium()">${i18n.t('profile_cancel')}</button>
      </div>
    </div>
  ` : `
    <div class="profile-upgrade-card" onclick="showPremiumModal('')">
      <div class="profile-upgrade-top">
        <div class="profile-upgrade-icon">+</div>
        <div class="profile-upgrade-info">
          <div class="profile-upgrade-title">${i18n.t('premium_title')}</div>
          <div class="profile-upgrade-desc">${i18n.t('premium_subtitle')}</div>
        </div>
      </div>
      <div class="profile-upgrade-features">
        <span>${i18n.t('profile_feat_packs')}</span>
        <span>${i18n.t('profile_feat_insights')}</span>
        <span>${i18n.t('profile_feat_advisor')}</span>
      </div>
      <div class="profile-upgrade-bottom">
        <div class="profile-upgrade-price">
          <span class="profile-price-was">${i18n.t('premium_was_price')}</span>
          <span class="profile-price-now">${i18n.t('premium_price')}${i18n.t('premium_period')}</span>
        </div>
        <div class="profile-upgrade-cta">${i18n.t('premium_cta')}</div>
      </div>
      <div class="profile-upgrade-note">${i18n.t('premium_trial_note')}</div>
    </div>
  `;

  container.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar">${initial}</div>
      <div class="profile-name">@${username}</div>
      ${isGuest ? `<div class="profile-guest-tag">guest</div>` : ''}
    </div>

    <div class="profile-stats">
      <div class="profile-stat">
        <div class="profile-stat-val">${sessionCount}</div>
        <div class="profile-stat-lbl">${i18n.t('profile_sessions')}</div>
      </div>
      <div class="profile-stat">
        <div class="profile-stat-val">${completedCount}</div>
        <div class="profile-stat-lbl">${i18n.t('profile_completed')}</div>
      </div>
      <div class="profile-stat">
        <div class="profile-stat-val">${packsPlayed}</div>
        <div class="profile-stat-lbl">${i18n.t('profile_packs_tried')}</div>
      </div>
    </div>

    ${premiumSection}

    <div class="profile-section-label">${i18n.t('profile_settings')}</div>
    <div class="profile-menu">
      <button class="profile-menu-item" onclick="toggleSettings()">
        <span class="profile-menu-icon">🎨</span>
        <span>${i18n.t('profile_theme')}</span>
        <span class="profile-menu-arrow">›</span>
      </button>
      <button class="profile-menu-item" onclick="cycleLang()">
        <span class="profile-menu-icon">🌐</span>
        <span>${i18n.t('profile_language')}</span>
        <span class="profile-menu-arrow">›</span>
      </button>
    </div>

    <div class="profile-section-label">${i18n.t('profile_account')}</div>
    <div class="profile-menu">
      ${isGuest ? `<button class="profile-menu-item" onclick="showSaveAccountModal()">
        <span class="profile-menu-icon">💾</span>
        <span>${i18n.t('profile_save_account')}</span>
        <span class="profile-menu-arrow">›</span>
      </button>` : ''}
      <button class="profile-menu-item profile-menu-danger" onclick="switchUser()">
        <span class="profile-menu-icon">👋</span>
        <span>${i18n.t('profile_logout')}</span>
        <span class="profile-menu-arrow">›</span>
      </button>
    </div>
  `;
}

// Pack selection
async function selectPack(key) {
  // Premium gate
  if (!isPremium && !isPackFree(key)) {
    showPremiumModal(key);
    return;
  }
  selectedPackKey = key;
  const def = packDefs.find(p => p.key === key);
  questions = await getQuestions(key);

  // Solo packs skip invite — go straight to quiz
  if (def.solo) {
    currentSession = null;
    currentQuestion = 0;
    selectedAnswers = {};
    eliminatedSets = {};
    questionModes = [];
    goTo('quiz');
    return;
  }

  document.getElementById('invitePackName').textContent = i18n.t(def.nameKey);

  // Create session via API
  try {
    const data = await blindApi.createSession(key, i18n.current);
    if (data.error) { alert(data.error); return; }
    currentSession = data.session;
    document.getElementById('inviteLink').textContent = getInviteUrl();
    goTo('invite');
  } catch (e) {
    alert('Could not create session');
  }
}

function startQuizAsCreator() {
  currentQuestion = 0;
  selectedAnswers = {};
  questionModes = [];
  goTo('quiz');
}

// Quiz — Mini-game modes
const QUIZ_MODES = ['classic', 'thisOrThat', 'bubblePop', 'blitz', 'swipe', 'blindGuess', 'eliminate'];
const FORMAT_TO_MODE = { vs: 'thisOrThat', bubble: 'bubblePop', swipe: 'swipe', blindguess: 'blindGuess', eliminate: 'eliminate' };
const MODE_LABELS = { classic: '✏️', thisOrThat: '⚔️ This or That', bubblePop: '🫧 Bubble Pop', blitz: '⚡ Blitz', swipe: '👆 Swipe Pick', blindGuess: '🔮 Blind Guess', eliminate: '🗑️ Last One Standing' };
let questionModes = [];
let blindGuessPhase = 'own'; // 'own' or 'guess'
let eliminatedSets = {};
let blitzInterval = null;

function assignQuestionModes() {
  questionModes = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    // If question has explicit format, use it
    if (q.format && FORMAT_TO_MODE[q.format]) {
      questionModes.push(FORMAT_TO_MODE[q.format]);
      continue;
    }
    // Otherwise alternate between classic and blitz, no repeats
    if (i === 0 || questionModes.length === 0) { questionModes.push('classic'); continue; }
    const last = questionModes[questionModes.length - 1];
    const available = ['classic', 'blitz'].filter(m => m !== last);
    questionModes.push(available[Math.floor(Math.random() * available.length)]);
  }
}

function renderQuestion() {
  blindGuessPhase = 'own'; // reset phase on question change
  if (!questionModes.length) assignQuestionModes();
  const q = questions[currentQuestion];
  const total = questions.length;
  const progress = ((currentQuestion) / total) * 100;
  const mode = questionModes[currentQuestion];

  document.getElementById('quizProgress').style.width = progress + '%';
  document.getElementById('quizCount').textContent = `${currentQuestion + 1} / ${total}`;

  const isLast = currentQuestion === total - 1;
  const nextBtn = document.getElementById('quizNextBtn');
  nextBtn.textContent = isLast ? i18n.t('quiz_submit') : i18n.t('quiz_next');
  nextBtn.disabled = !hasAnswer(currentQuestion);
  document.getElementById('quizBackBtn').style.display = currentQuestion > 0 ? '' : 'none';

  if (blitzInterval) { clearInterval(blitzInterval); blitzInterval = null; }
  const body = document.getElementById('quizBody');

  switch (mode) {
    case 'thisOrThat': renderThisOrThat(body, q); break;
    case 'bubblePop': renderBubblePop(body, q); break;
    case 'blitz': renderBlitz(body, q); break;
    case 'swipe': renderSwipe(body, q); break;
    case 'blindGuess': renderBlindGuess(body, q); break;
    case 'eliminate': renderEliminate(body, q); break;
    default: renderClassic(body, q);
  }
}

// --- CLASSIC ---
function renderClassic(body, q) {
  body.innerHTML = `
    <div class="question-card" key="${currentQuestion}">
      <div class="question-label">${i18n.t('quiz_question')} ${currentQuestion + 1}</div>
      <div class="question-text">${q.q}</div>
      <div class="answer-options">
        ${q.options.map((opt, oi) => `
          <button class="answer-opt ${selectedAnswers[currentQuestion] === oi ? 'selected' : ''}"
                  onclick="selectAnswer(${currentQuestion}, ${oi}, this)">
            ${opt}
          </button>
        `).join('')}
      </div>
    </div>`;
}

// --- THIS OR THAT (2-option VS) ---
function renderThisOrThat(body, q) {
  const opts = q.options.slice(0, 2); // VS always uses first 2 options
  const s = selectedAnswers[currentQuestion];
  body.innerHTML = `
    <div class="tot-layout" key="${currentQuestion}">
      <div class="question-text" style="font-size:19px">${q.q}</div>
      <div class="tot-matchup tot-single">
        ${opts.map((opt, i) =>
          `<div class="tot-side ${s === i ? 'selected' : (s !== undefined && s !== i ? 'dimmed' : '')}"
                onclick="selectTot(${currentQuestion}, ${i})">${opt}</div>`
        ).join('<div class="tot-vs">VS</div>')}
      </div>
    </div>`;
}
function selectTot(qi, ans) {
  selectedAnswers[qi] = ans;
  document.getElementById('quizNextBtn').disabled = false;
  document.querySelectorAll('.tot-side').forEach((el, i) => {
    el.classList.remove('selected', 'dimmed');
    if (i === ans) el.classList.add('selected');
    else el.classList.add('dimmed');
  });
}

// --- BUBBLE POP (multi-select) ---
function renderBubblePop(body, q) {
  const pos = [
    { top: '5%', left: '8%', size: 120 },
    { top: '2%', left: '55%', size: 110 },
    { top: '50%', left: '5%', size: 115 },
    { top: '48%', left: '52%', size: 125 },
    { top: '28%', left: '30%', size: 105 }
  ];
  const sel = Array.isArray(selectedAnswers[currentQuestion]) ? selectedAnswers[currentQuestion] : [];
  body.innerHTML = `
    <div class="question-card" key="${currentQuestion}">
      <div class="mode-badge">${MODE_LABELS.bubblePop}</div>
      <div class="question-text" style="font-size:19px">${q.q}</div>
      <div class="bubble-hint">${i18n.t('bubble_hint') || 'tap all that apply'}</div>
      <div class="bubble-field">
        ${q.options.map((opt, oi) => {
          const p = pos[oi];
          return `<div class="bubble ${sel.includes(oi) ? 'selected' : ''}"
                       style="top:${p.top};left:${p.left};width:${p.size}px;height:${p.size}px"
                       onclick="selectBubble(${currentQuestion}, ${oi})">${opt}</div>`;
        }).join('')}
      </div>
    </div>`;
}
function selectBubble(qi, ans) {
  if (!Array.isArray(selectedAnswers[qi])) selectedAnswers[qi] = [];
  const arr = selectedAnswers[qi];
  const idx = arr.indexOf(ans);
  if (idx >= 0) arr.splice(idx, 1);
  else arr.push(ans);
  document.getElementById('quizNextBtn').disabled = arr.length === 0;
  document.querySelectorAll('.bubble').forEach((el, i) => {
    el.classList.remove('selected');
    if (arr.includes(i)) el.classList.add('selected');
  });
}

// --- BLITZ ---
function renderBlitz(body, q) {
  const BT = 10;
  body.innerHTML = `
    <div class="question-card" key="${currentQuestion}">
      <div class="mode-badge">${MODE_LABELS.blitz}</div>
      <div class="blitz-label" id="blitzCount">${BT}</div>
      <div class="blitz-timer-bar"><div class="blitz-timer-fill" id="blitzFill"></div></div>
      <div class="question-text" style="font-size:19px">${q.q}</div>
      <div class="answer-options blitz-mode">
        ${q.options.map((opt, oi) => `
          <button class="answer-opt ${selectedAnswers[currentQuestion] === oi ? 'selected' : ''}"
                  onclick="selectAnswer(${currentQuestion}, ${oi}, this)">
            ${opt}
          </button>
        `).join('')}
      </div>
    </div>`;
  if (selectedAnswers[currentQuestion] !== undefined) return;
  let rem = BT * 10;
  const fill = document.getElementById('blitzFill'), label = document.getElementById('blitzCount');
  blitzInterval = setInterval(() => {
    rem--;
    const pct = (rem / (BT * 10)) * 100;
    if (fill) fill.style.width = pct + '%';
    if (label) label.textContent = Math.ceil(rem / 10);
    if (rem <= 30) {
      if (fill) fill.classList.add('urgent');
      if (label) label.classList.add('urgent');
    }
    if (rem <= 0) {
      clearInterval(blitzInterval); blitzInterval = null;
      if (selectedAnswers[currentQuestion] === undefined) {
        const ri = Math.floor(Math.random() * q.options.length);
        selectedAnswers[currentQuestion] = ri;
        document.getElementById('quizNextBtn').disabled = false;
        const btns = document.querySelectorAll('.blitz-mode .answer-opt');
        if (btns[ri]) btns[ri].classList.add('selected');
        if (label) { label.textContent = '\u23F0'; label.style.fontSize = '36px'; }
      }
    }
  }, 100);
}

// --- SWIPE PICK (full-card multi-select list) ---
function renderSwipe(body, q) {
  const sel = Array.isArray(selectedAnswers[currentQuestion]) ? selectedAnswers[currentQuestion] : [];
  body.innerHTML = `
    <div class="question-card swipe-card-question" key="${currentQuestion}">
      <div class="mode-badge">${MODE_LABELS.swipe}</div>
      <div class="question-text" style="font-size:19px">${q.q}</div>
      <div class="swipe-hint">${i18n.t('swipe_hint') || 'pick all that fit'}</div>
      <div class="swipe-list" id="swipeList">
        ${q.options.map((opt, oi) => `
          <div class="swipe-list-card ${sel.includes(oi) ? 'selected' : ''}"
               onclick="toggleSwipeCard(${currentQuestion}, ${oi})" data-idx="${oi}">
            <span class="swipe-list-text">${opt}</span>
            <span class="swipe-list-check">${sel.includes(oi) ? '✓' : ''}</span>
          </div>
        `).join('')}
      </div>
    </div>`;
}

function toggleSwipeCard(qi, ans) {
  if (!Array.isArray(selectedAnswers[qi])) selectedAnswers[qi] = [];
  const arr = selectedAnswers[qi];
  const idx = arr.indexOf(ans);
  if (idx >= 0) arr.splice(idx, 1);
  else arr.push(ans);
  document.getElementById('quizNextBtn').disabled = arr.length === 0;
  document.querySelectorAll('.swipe-list-card').forEach(el => {
    const i = parseInt(el.dataset.idx);
    const isSelected = arr.includes(i);
    el.classList.toggle('selected', isSelected);
    el.querySelector('.swipe-list-check').textContent = isSelected ? '✓' : '';
  });
}

// --- BLIND GUESS (answer + predict partner) ---
function renderBlindGuess(body, q) {
  const ans = selectedAnswers[currentQuestion];
  const isObj = ans && typeof ans === 'object' && !Array.isArray(ans);
  const ownAnswer = isObj ? ans.own : undefined;
  const guessAnswer = isObj ? ans.guess : undefined;

  // Determine phase
  if (ownAnswer === undefined) {
    blindGuessPhase = 'own';
  } else if (guessAnswer === undefined) {
    blindGuessPhase = 'guess';
  }

  const isGuessPhase = blindGuessPhase === 'guess';
  const selected = isGuessPhase ? guessAnswer : ownAnswer;
  const phaseLabel = isGuessPhase
    ? (i18n.t('blindguess_guess_label') || 'now guess their answer')
    : (i18n.t('blindguess_own_label') || 'your answer');
  const phaseIcon = isGuessPhase ? '🔮' : '💬';
  const phaseClass = isGuessPhase ? 'bg-phase-guess' : 'bg-phase-own';

  body.innerHTML = `
    <div class="question-card bg-card ${phaseClass}" key="${currentQuestion}-${blindGuessPhase}">
      <div class="mode-badge">${MODE_LABELS.blindGuess}</div>
      <div class="bg-phase-indicator">
        <div class="bg-phase-dot ${!isGuessPhase ? 'active' : 'done clickable'}" ${isGuessPhase ? `onclick="revertBlindGuessOwn(${currentQuestion})"` : ''}>1</div>
        <div class="bg-phase-line ${isGuessPhase ? 'filled' : ''}"></div>
        <div class="bg-phase-dot ${isGuessPhase ? 'active' : ''}">2</div>
      </div>
      <div class="bg-phase-label">${phaseIcon} ${phaseLabel}</div>
      <div class="question-text" style="font-size:19px">${q.q}</div>
      <div class="answer-options">
        ${q.options.map((opt, oi) => {
          const isOwnPick = isGuessPhase && ownAnswer === oi;
          return `<button class="answer-opt ${selected === oi ? 'selected' : ''} ${isOwnPick ? 'bg-own-pick' : ''}"
                  onclick="selectBlindGuess(${currentQuestion}, ${oi})">
            ${isOwnPick ? '<span class="bg-your-badge">' + (i18n.t('blindguess_yours') || 'yours') + '</span>' : ''}${opt}
          </button>`;
        }).join('')}
      </div>
    </div>`;
}

function selectBlindGuess(qi, ans) {
  const existing = selectedAnswers[qi];
  const isObj = existing && typeof existing === 'object' && !Array.isArray(existing);

  if (blindGuessPhase === 'own') {
    selectedAnswers[qi] = { own: ans, guess: undefined };
    // Immediately transition to guess phase
    blindGuessPhase = 'guess';
    const body = document.getElementById('quizBody');
    renderBlindGuess(body, questions[qi]);
    document.getElementById('quizNextBtn').disabled = true;
    return;
  }

  // Guess phase
  if (isObj) {
    selectedAnswers[qi] = { own: existing.own, guess: ans };
  }
  document.getElementById('quizNextBtn').disabled = false;
  const btns = document.querySelectorAll('.bg-card .answer-opt');
  btns.forEach((btn, i) => {
    btn.classList.toggle('selected', i === ans);
  });
}

function revertBlindGuessOwn(qi) {
  selectedAnswers[qi] = undefined;
  blindGuessPhase = 'own';
  const body = document.getElementById('quizBody');
  renderBlindGuess(body, questions[qi]);
  document.getElementById('quizNextBtn').disabled = true;
}

function selectAnswer(qIndex, answer, el) {
  selectedAnswers[qIndex] = answer;
  if (el && el.parentElement) {
    el.parentElement.querySelectorAll('.answer-opt').forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');
  }
  document.getElementById('quizNextBtn').disabled = false;
  if (blitzInterval) { clearInterval(blitzInterval); blitzInterval = null; }
}

// --- ELIMINATE (last one standing) ---
function renderEliminate(body, q) {
  if (!eliminatedSets[currentQuestion]) {
    if (selectedAnswers[currentQuestion] !== undefined) {
      eliminatedSets[currentQuestion] = new Set(
        q.options.map((_, i) => i).filter(i => i !== selectedAnswers[currentQuestion])
      );
    } else {
      eliminatedSets[currentQuestion] = new Set();
    }
  }
  const elim = eliminatedSets[currentQuestion];
  const isSolved = q.options.length - elim.size === 1;

  body.innerHTML = `
    <div class="question-card eliminate-card" key="${currentQuestion}">
      <div class="mode-badge">${MODE_LABELS.eliminate}</div>
      <div class="question-text" style="font-size:19px">${q.q}</div>
      <div class="eliminate-hint">${i18n.t('eliminate_hint') || 'tap to eliminate \u2014 last one wins'}</div>
      <div class="eliminate-grid">
        ${q.options.map((opt, oi) => {
          const isElim = elim.has(oi);
          const isSurvivor = isSolved && !isElim;
          return `<div class="eliminate-item ${isElim ? 'eliminated' : ''} ${isSurvivor ? 'survivor' : ''}"
                       onclick="toggleEliminate(${currentQuestion}, ${oi})" data-idx="${oi}">
            <span class="eliminate-text">${opt}</span>
            ${isElim ? '<span class="eliminate-x">\u2715</span>' : ''}
          </div>`;
        }).join('')}
      </div>
      <div class="eliminate-count" id="eliminateCount">${elim.size} / ${q.options.length - 1}</div>
    </div>`;
}

function toggleEliminate(qi, idx) {
  const q = questions[qi];
  const elim = eliminatedSets[qi];

  if (elim.has(idx)) {
    elim.delete(idx);
    delete selectedAnswers[qi];
    document.getElementById('quizNextBtn').disabled = true;
  } else {
    if (q.options.length - elim.size <= 1) return;
    elim.add(idx);
    if (q.options.length - elim.size === 1) {
      const survivorIdx = q.options.findIndex((_, i) => !elim.has(i));
      selectedAnswers[qi] = survivorIdx;
      document.getElementById('quizNextBtn').disabled = false;
    }
  }

  document.querySelectorAll('.eliminate-item').forEach(el => {
    const i = parseInt(el.dataset.idx);
    const isElim = elim.has(i);
    const isSurvivor = q.options.length - elim.size === 1 && !isElim;
    el.classList.toggle('eliminated', isElim);
    el.classList.toggle('survivor', isSurvivor);
    const xSpan = el.querySelector('.eliminate-x');
    if (isElim && !xSpan) {
      el.insertAdjacentHTML('beforeend', '<span class="eliminate-x">\u2715</span>');
    } else if (!isElim && xSpan) {
      xSpan.remove();
    }
  });

  document.getElementById('eliminateCount').textContent =
    `${elim.size} / ${q.options.length - 1}`;
}

function nextQuestion() {
  // For blind guess, if still on own phase, don't advance
  if (questionModes[currentQuestion] === 'blindGuess') {
    const ans = selectedAnswers[currentQuestion];
    const isObj = ans && typeof ans === 'object' && !Array.isArray(ans);
    if (!isObj || ans.guess === undefined) return;
  }
  if (!hasAnswer(currentQuestion)) return;

  if (currentQuestion === questions.length - 1) {
    // Solo packs skip the confirmation modal — submit directly
    if (isSoloPack(selectedPackKey)) {
      submitAnswers();
      return;
    }
    document.getElementById('submitModal').classList.add('show');
    return;
  }

  currentQuestion++;
  renderQuestion();
}

function prevQuestion() {
  if (currentQuestion > 0) {
    currentQuestion--;
    renderQuestion();
  }
}

function confirmQuit() {
  goTo('home');
}

function closeModal() {
  document.getElementById('submitModal').classList.remove('show');
}

// Session delete
let pendingDeleteCode = null;

function initSwipeToDelete() {
  document.querySelectorAll('.session-card-wrap').forEach(wrap => {
    const card = wrap.querySelector('.session-card');
    let startX = 0, currentX = 0, dragging = false;

    card.addEventListener('touchstart', e => {
      startX = e.touches[0].clientX;
      currentX = startX;
      dragging = true;
      card.style.transition = 'none';
    }, { passive: true });

    card.addEventListener('touchmove', e => {
      if (!dragging) return;
      currentX = e.touches[0].clientX;
      const dx = Math.min(0, currentX - startX);
      if (dx < -10) {
        card.style.transform = `translateX(${Math.max(dx, -80)}px)`;
      }
    }, { passive: true });

    card.addEventListener('touchend', () => {
      dragging = false;
      card.style.transition = '';
      const dx = currentX - startX;
      if (dx < -40) {
        wrap.classList.add('swiped');
        card.style.transform = '';
        closeSiblingSwipes(wrap);
      } else {
        wrap.classList.remove('swiped');
        card.style.transform = '';
      }
    });
  });

  // Click outside to close any swiped card
  document.addEventListener('click', e => {
    if (!e.target.closest('.session-card-wrap')) {
      document.querySelectorAll('.session-card-wrap.swiped').forEach(w => w.classList.remove('swiped'));
    }
  });
}

function closeSiblingSwipes(except) {
  document.querySelectorAll('.session-card-wrap.swiped').forEach(w => {
    if (w !== except) w.classList.remove('swiped');
  });
}

function openDeleteModal(code) {
  pendingDeleteCode = code;
  document.getElementById('deleteModal').classList.add('show');
}

function closeDeleteModal() {
  document.getElementById('deleteModal').classList.remove('show');
  pendingDeleteCode = null;
}

function getHiddenSessions() {
  try { return JSON.parse(localStorage.getItem('bs-hidden-sessions') || '[]'); } catch { return []; }
}

function hideSession(code) {
  const hidden = getHiddenSessions();
  if (!hidden.includes(code)) {
    hidden.push(code);
    localStorage.setItem('bs-hidden-sessions', JSON.stringify(hidden));
  }
}

function confirmDeleteSession() {
  if (!pendingDeleteCode) return;
  const code = pendingDeleteCode;
  closeDeleteModal();

  // Delete on server
  blindApi.deleteSession(code).catch(() => {});

  // Persist in localStorage as fallback
  hideSession(code);

  const wrap = document.querySelector(`.session-card-wrap[data-code="${code}"]`);
  if (wrap) {
    wrap.classList.add('removing');
    wrap.addEventListener('animationend', () => wrap.remove());
  }

  // Remove from cached sessions
  if (_cachedSessions) {
    _cachedSessions = _cachedSessions.filter(s => s.code !== code);
  }

  // Re-render if all sessions removed
  if (_cachedSessions && _cachedSessions.length === 0) {
    renderHomeSessions();
  }
}

async function submitAnswers() {
  closeModal();
  document.getElementById('quizProgress').style.width = '100%';

  // Solo packs — skip API, go straight to solo results
  if (isSoloPack(selectedPackKey)) {
    goTo('results');
    await buildSoloReceipt();
    return;
  }

  if (currentSession) {
    try {
      const data = await blindApi.submitAnswers(currentSession.code, selectedAnswers);
      if (data.error) {
        alert('Failed to submit: ' + data.error);
        return;
      }
      if (data.both_done) {
        goTo('reveal');
        runCountdown();
        return;
      }
    } catch (e) {
      alert(i18n.t('waiting_submit_error'));
      return;
    }
  }

  // Go to waiting screen
  goTo('waiting');
  if (currentSession) {
    document.getElementById('waitingCode').textContent = currentSession.code;
    // Set avatar initials
    const myName = currentUser?.username || '?';
    document.getElementById('waitingAvatarYou').textContent = myName.charAt(0).toUpperCase();
    const partner = currentSession.creator_id === currentUser?.id
      ? currentSession.partner_username
      : currentSession.creator_username;
    const themCircle = document.querySelector('.duo-circle.them');
    if (partner) {
      document.getElementById('waitingAvatarThem').textContent = partner.charAt(0).toUpperCase();
      themCircle.classList.add('active');
    } else {
      document.getElementById('waitingAvatarThem').textContent = '?';
      themCircle.classList.remove('active');
    }
    document.getElementById('waitingDesc').innerHTML = partner
      ? i18n.t('waiting_for_partner_named').replace('{name}', `<strong style="color:var(--text)">${partner}</strong>`)
      : i18n.t('waiting_for_partner_join');
    startPolling();
  }
}

function startPolling() {
  stopPolling();
  document.getElementById('waitingStatus').textContent = i18n.t('waiting_checking');

  pollTimer = setInterval(async () => {
    if (!currentSession) return;
    try {
      const data = await blindApi.getSession(currentSession.code);
      const s = data.session;
      currentSession = s;

      if (s.status === 'complete' || (s.user_submitted && s.partner_submitted)) {
        stopPolling();
        document.getElementById('waitingStatus').textContent = i18n.t('waiting_both_done');
        setTimeout(() => {
          goTo('reveal');
          runCountdown();
        }, 500);
      } else if (s.partner_submitted) {
        document.getElementById('waitingStatus').textContent = i18n.t('waiting_partner_done');
      } else if (s.partner_id) {
        const pName = s.creator_id === currentUser?.id ? s.partner_username : s.creator_username;
        document.getElementById('waitingStatus').textContent = i18n.t('waiting_answering').replace('{name}', pName || i18n.t('waiting_partner'));
        document.getElementById('waitingDesc').innerHTML =
          i18n.t('waiting_for_partner_named').replace('{name}', `<strong style="color:var(--text)">${pName || i18n.t('waiting_partner')}</strong>`);
        // Activate partner circle
        const themCircle = document.querySelector('.duo-circle.them');
        if (themCircle && !themCircle.classList.contains('active')) {
          document.getElementById('waitingAvatarThem').textContent = (pName || '?').charAt(0).toUpperCase();
          themCircle.classList.add('active');
        }
      } else {
        document.getElementById('waitingStatus').textContent = i18n.t('waiting_for_partner_join');
      }
    } catch (e) { /* silent */ }
  }, 3000);
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

// Reveal
function startReveal() {
  goTo('reveal');
  runCountdown();
}

function runCountdown() {
  const container = document.getElementById('revealCountdown');
  let count = 3;
  container.classList.remove('hidden');

  function showNum() {
    if (count > 0) {
      container.innerHTML = `
        <div class="countdown-num" key="${count}">${count}</div>
        <div class="countdown-label">${i18n.t('reveal_get_ready')}</div>
      `;
      count--;
      setTimeout(showNum, 800);
    } else {
      // Skip per-card reveal, go straight to receipt
      if (currentSession) {
        goTo('results');
        buildReceiptFromApi(currentSession.code);
      } else {
        goTo('results');
        buildReceipt();
      }
    }
  }
  showNum();
}

// Per-question reveal flow
let revealIndex = 0;
let revealData = [];

const matchReactions = [
  { emoji: '🔥', text: 'same wavelength!' },
  { emoji: '🧠', text: 'telepathic!' },
  { emoji: '💫', text: 'in sync!' },
  { emoji: '🎯', text: 'bullseye!' },
  { emoji: '⚡', text: 'connected!' },
];
const diffReactions = [
  { emoji: '👀', text: 'plot twist' },
  { emoji: '😏', text: 'interesting...' },
  { emoji: '🌀', text: 'different worlds' },
  { emoji: '🤷', text: 'agree to disagree' },
  { emoji: '💭', text: 'now you know' },
];

function showRevealCards() {
  revealIndex = 0;
  revealData = questions.map((q, i) => {
    const raw = selectedAnswers[i];
    const partnerIdx = q.partnerAnswerIndex;
    let userAns, matched;
    if (Array.isArray(raw)) {
      userAns = raw.map(idx => q.options[idx]).join(', ');
      matched = raw.includes(partnerIdx);
    } else {
      const userIdx = raw != null ? raw : 0;
      userAns = q.options[userIdx];
      matched = userIdx === partnerIdx;
    }
    return { q: q.q, userAns, partnerAns: q.options[partnerIdx], matched };
  });
  showRevealCard(0);
}

function showRevealCard(idx) {
  if (idx >= revealData.length) {
    goTo('results');
    setTimeout(buildReceipt, 300);
    return;
  }

  const container = document.getElementById('revealCardsContainer');
  const d = revealData[idx];
  const reaction = d.matched
    ? matchReactions[idx % matchReactions.length]
    : diffReactions[idx % diffReactions.length];

  // Remove old card
  const old = container.querySelector('.reveal-fullscreen.active');
  if (old) {
    old.classList.remove('active');
    old.classList.add('exit');
    setTimeout(() => old.remove(), 400);
  }

  const card = document.createElement('div');
  card.className = 'reveal-fullscreen';
  card.innerHTML = `
    <div class="reveal-q-num">${i18n.t('reveal_question_of').replace('{n}', idx + 1).replace('{total}', revealData.length)}</div>
    <div class="reveal-question">${d.q}</div>
    <div class="reveal-vs-block">
      <div class="reveal-vs-card you-card">
        <div class="rv-label">${i18n.t('reveal_you')}</div>
        <div class="rv-answer rv-answer-hidden" id="revYou${idx}">• • •</div>
      </div>
      <div class="reveal-vs-card them-card">
        <div class="rv-label">Alex</div>
        <div class="rv-answer rv-answer-hidden" id="revThem${idx}">• • •</div>
      </div>
    </div>
    <div class="reveal-reaction" id="revReaction${idx}">
      <span class="reaction-emoji">${reaction.emoji}</span>
      <div class="reaction-text ${d.matched ? 'matched-text' : 'diff-text'}">${reaction.text}</div>
    </div>
    <div class="reveal-tap-hint" id="revHint${idx}">${i18n.t('reveal_tap_reveal')}</div>
    ${d.matched ? '<div class="card-confetti" id="revConfetti' + idx + '"></div>' : ''}
  `;
  container.appendChild(card);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => card.classList.add('active'));
  });

  let tapState = 0; // 0=show answers, 1=next
  card.onclick = () => {
    if (tapState === 0) {
      // Reveal answers
      const youEl = document.getElementById(`revYou${idx}`);
      const themEl = document.getElementById(`revThem${idx}`);
      const hintEl = document.getElementById(`revHint${idx}`);
      youEl.textContent = d.userAns;
      youEl.classList.remove('rv-answer-hidden');
      themEl.textContent = d.partnerAns;
      themEl.classList.remove('rv-answer-hidden');
      youEl.style.animation = 'countPop 0.35s ease';
      themEl.style.animation = 'countPop 0.35s ease 0.1s both';

      // Show reaction
      setTimeout(() => {
        const reactionEl = document.getElementById(`revReaction${idx}`);
        if (reactionEl) reactionEl.classList.add('pop');
        if (d.matched) {
          burstCardConfetti(`revConfetti${idx}`);
        }
      }, 300);

      hintEl.textContent = i18n.t('reveal_tap_continue');
      tapState = 1;
    } else {
      revealIndex++;
      showRevealCard(revealIndex);
    }
  };
}

function burstCardConfetti(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const colors = ['#7C3AED', '#EC4899', '#84CC16', '#F97316', '#06B6D4'];
  for (let i = 0; i < 24; i++) {
    const p = document.createElement('div');
    p.className = 'card-confetti-piece';
    const size = 4 + Math.random() * 5;
    const angle = (Math.PI * 2 * i) / 24;
    const dist = 60 + Math.random() * 80;
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist;
    p.style.cssText = `
      width:${size}px;height:${size}px;
      background:${colors[i % colors.length]};
      left:50%;top:50%;
      transform:translate(-50%,-50%);
      animation: cardConfettiBurst 0.8s ease-out forwards;
    `;
    // Override animation with custom end position
    p.animate([
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0)`, opacity: 0 }
    ], { duration: 600 + Math.random() * 400, easing: 'cubic-bezier(0,0.5,0.5,1)', fill: 'forwards' });
    el.appendChild(p);
  }
}

// Confetti
function spawnConfetti() {
  const container = document.getElementById('confetti');
  const colors = ['#7C3AED', '#EC4899', '#84CC16', '#F97316', '#06B6D4', '#fff'];

  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = (1.5 + Math.random() * 2) + 's';
    piece.style.animationDelay = Math.random() * 0.5 + 's';
    piece.style.width = (5 + Math.random() * 6) + 'px';
    piece.style.height = (8 + Math.random() * 10) + 'px';
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    container.appendChild(piece);
  }
  setTimeout(() => { container.innerHTML = ''; }, 4000);
}

// Vibe Receipt builder

// ==================== AI VIBE REPORT ====================
function getVibeReportLoadingHtml() {
  return `
    <div class="vibe-report">
      <div class="vibe-report-inner vibe-report-loading">
        <div class="vibe-skel vibe-skel-badge"></div>
        <div class="vibe-skel vibe-skel-title"></div>
        <div class="vibe-skel vibe-skel-line"></div>
        <div class="vibe-skel vibe-skel-line"></div>
        <div class="vibe-skel vibe-skel-line short"></div>
        <div style="height:12px"></div>
        <div class="vibe-skel vibe-skel-award"></div>
        <div class="vibe-skel vibe-skel-award"></div>
        <div class="vibe-skel vibe-skel-award"></div>
        <div style="height:12px"></div>
        <div class="vibe-skel vibe-skel-metaphor"></div>
        <div class="vibe-loading-hint">ai is reading your vibes...</div>
      </div>
    </div>
  `;
}

function renderVibeReport(report) {
  const awardsHtml = (report.superlatives || []).map(s => `
    <div class="vibe-award">
      <div class="vibe-award-icon">${s.icon}</div>
      <div class="vibe-award-content">
        <div class="vibe-award-label">${s.label}</div>
        <div class="vibe-award-text">${s.text}</div>
      </div>
    </div>
  `).join('');

  return `
    <div class="vibe-report" id="vibeReportCard">
      <div class="vibe-report-inner">
        <div class="vibe-report-badge">AI Vibe Report</div>
        <div class="vibe-report-headline">${report.headline}</div>
        <div class="vibe-report-narrative">${report.narrative}</div>
        <div class="vibe-superlatives">${awardsHtml}</div>
        <div class="vibe-metaphor">
          <div class="vibe-metaphor-label">${report.metaphor_label || 'Your Duo Archetype'}</div>
          <div class="vibe-metaphor-text">${report.metaphor}</div>
          <div class="vibe-metaphor-desc">${report.metaphor_desc}</div>
        </div>
      </div>
    </div>
  `;
}

async function generateVibeReport(data, partnerName, pct, packKey) {
  const lang = localStorage.getItem('bs-lang') || 'en';
  const langNames = { en: 'English', tr: 'Turkish', th: 'Thai' };

  const qaList = data.map((d, i) =>
    `Q${i+1}: "${d.q}" — You: "${d.userAns}", ${partnerName}: "${d.partnerAns}" [${d.matched ? 'MATCH' : 'DIFFERENT'}]`
  ).join('\n');

  const prompt = `You are a witty, warm, Gen-Z-friendly personality analyst for a blind compatibility quiz app called "blindside."

Two people answered the same questions without seeing each other's answers. Here are the results:

Players: "You" & "${partnerName}"
Pack: ${packKey || 'general'}
Match rate: ${pct}%
Questions & Answers:
${qaList}

Generate a fun, creative, shareable "Vibe Report" in JSON format. Respond in ${langNames[lang] || 'English'}.

Requirements:
- "headline": A punchy, creative 4-8 word title for their dynamic (not generic — reference specific answers if possible)
- "narrative": 2-3 sentences. Be specific about their actual answers. Use <strong> tags for emphasis on key phrases. Be warm but funny. Reference actual surprising matches or funny differences.
- "superlatives": Array of exactly 3 fun awards. Each has:
  - "icon": a single emoji
  - "label": short award category (e.g. "Most Aligned On", "Biggest Plot Twist", "The One That Hurt")
  - "text": 1 short sentence referencing actual Q&A
- "metaphor": A creative duo archetype/metaphor (e.g. "The Jazz Duo", "Chaotic Roommates", "The Brain Cell Sharers")
- "metaphor_label": Short label like "Your Duo Archetype" (translated)
- "metaphor_desc": 1 sentence explaining the metaphor, tied to their actual answers

Be creative, funny, specific. Do NOT be generic. Reference their actual answers. Keep it light and shareable.
Return ONLY valid JSON, no markdown fences.`;

  try {
    const res = await fetch(`${API_URL}/claude?nocache=1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': 'blindside-vibes' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const result = await res.json();
    const text = result?.content?.[0]?.text;
    if (!text) return null;
    // Parse JSON — handle potential markdown fences
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('AI vibe report failed:', e);
    return null;
  }
}

async function loadVibeReport(data, partnerName, pct, packKey) {
  const container = document.getElementById('vibeReportSlot');
  if (!container) return;
  const report = await generateVibeReport(data, partnerName, pct, packKey);
  if (report && report.headline) {
    container.innerHTML = renderVibeReport(report);
  } else {
    // Remove the loading skeleton on failure
    container.innerHTML = '';
  }
}

async function buildReceiptFromApi(code) {
  const scroll = document.getElementById('storyScroll');
  scroll.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--text-dim)"><div class="dot-pulse" style="margin:0 auto"></div><p style="margin-top:16px">${i18n.t('results_loading')}</p></div>`;

  try {
    const result = await blindApi.getResults(code);
    if (result.error) {
      scroll.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--text-dim)"><p>${i18n.t('results_load_error')}</p><button class="btn btn-ghost" onclick="goTo('home')">${i18n.t('results_back_home')}</button></div>`;
      return;
    }

    const s = result.session;
    const answers = result.answers;
    const isCreator = currentUser && s.creator_id === currentUser.id;
    const myId = currentUser?.id;
    const partnerId = isCreator ? s.partner_id : s.creator_id;
    const partnerName = isCreator ? s.partner_username : s.creator_username;

    // Build reveal data from real answers — compare by index, display in viewer's language
    // Helper: parse answer — handles single index, array of indices, or string
    function toIdx(raw) {
      if (typeof raw === 'number') return Math.round(raw);
      if (typeof raw === 'string' && /^\d+(\.\d+)?$/.test(raw.trim())) return Math.round(parseFloat(raw));
      return null;
    }
    function resolveAnswer(raw, q) {
      // Blind guess format: {own, guess}
      if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'own' in raw) {
        const ownIdx = toIdx(raw.own);
        const guessIdx = toIdx(raw.guess);
        return {
          text: ownIdx != null && q.options[ownIdx] ? q.options[ownIdx] : String(raw.own),
          indices: ownIdx != null ? [ownIdx] : [],
          guessText: guessIdx != null && q.options[guessIdx] ? q.options[guessIdx] : String(raw.guess),
          guessIdx: guessIdx
        };
      }
      if (Array.isArray(raw)) {
        const texts = raw.map(r => {
          const idx = toIdx(r);
          return idx != null && q.options[idx] ? q.options[idx] : String(r);
        });
        return { text: texts.join(', '), indices: raw.map(r => toIdx(r)) };
      }
      const idx = toIdx(raw);
      const text = idx != null && q.options[idx] ? q.options[idx] : String(raw);
      return { text, indices: idx != null ? [idx] : [] };
    }
    revealData = questions.map((q, i) => {
      const qAnswers = answers[i] || {};
      const rawUser = qAnswers[myId] != null ? qAnswers[myId] : (selectedAnswers[i] != null ? selectedAnswers[i] : '?');
      const rawPartner = qAnswers[partnerId] != null ? qAnswers[partnerId] : '?';
      const user = resolveAnswer(rawUser, q);
      const partner = resolveAnswer(rawPartner, q);
      // Match: any overlap between user's and partner's selected indices
      const matched = user.indices.length && partner.indices.length
        ? user.indices.some(idx => partner.indices.includes(idx))
        : user.text === partner.text;
      const entry = { q: q.q, userAns: user.text, partnerAns: partner.text, matched };
      // Blind guess extras
      if (user.guessText !== undefined) {
        entry.userGuess = user.guessText;
        entry.guessCorrect = partner.indices.length ? partner.indices.includes(user.guessIdx) : user.guessText === partner.text;
      }
      if (partner.guessText !== undefined) {
        entry.partnerGuess = partner.guessText;
        entry.partnerGuessCorrect = user.indices.length ? user.indices.includes(partner.guessIdx) : partner.guessText === user.text;
      }
      return entry;
    });

    buildReceiptWithName(partnerName || 'partner');
  } catch (e) {
    console.error('Failed to load results:', e);
    scroll.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--text-dim)"><p>${i18n.t('results_load_error')}</p><button class="btn btn-ghost" onclick="goTo('home')">${i18n.t('results_back_home')}</button></div>`;
  }
}

function getVibeLabels() {
  return [
    { min: 0,  emoji: '🫠', title: i18n.t('vibe_0_title'), desc: i18n.t('vibe_0_desc'), intro: i18n.t('vibe_0_intro') },
    { min: 20, emoji: '🌀', title: i18n.t('vibe_20_title'), desc: i18n.t('vibe_20_desc'), intro: i18n.t('vibe_20_intro') },
    { min: 40, emoji: '🤝', title: i18n.t('vibe_40_title'), desc: i18n.t('vibe_40_desc'), intro: i18n.t('vibe_40_intro') },
    { min: 60, emoji: '💜', title: i18n.t('vibe_60_title'), desc: i18n.t('vibe_60_desc'), intro: i18n.t('vibe_60_intro') },
    { min: 80, emoji: '🔮', title: i18n.t('vibe_80_title'), desc: i18n.t('vibe_80_desc'), intro: i18n.t('vibe_80_intro') },
    { min: 100, emoji: '👽', title: i18n.t('vibe_100_title'), desc: i18n.t('vibe_100_desc'), intro: i18n.t('vibe_100_intro') },
  ];
}

function buildReceiptWithName(partnerName) {
  const data = revealData;
  const matches = data.filter(d => d.matched).length;
  const total = data.length;
  const pct = Math.round((matches / total) * 100);
  const vibeLabels = getVibeLabels();
  const vibe = [...vibeLabels].reverse().find(v => pct >= v.min);
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  let chaptersHtml = '';
  const userGuessResults = data.filter(d => d.userGuess !== undefined);
  const partnerGuessResults = data.filter(d => d.partnerGuess !== undefined);
  const apiHasGuesses = userGuessResults.length > 0 || partnerGuessResults.length > 0;
  const apiGuessCorrectCount = data.filter(d => d.guessCorrect).length;
  const apiPartnerGuessCorrectCount = data.filter(d => d.partnerGuessCorrect).length;

  data.forEach((d, i) => {
    let guessHtml = '';
    if (d.userGuess !== undefined) {
      guessHtml += `<div class="ch-guess ${d.guessCorrect ? 'correct' : 'wrong'}">
        <div class="ch-guess-label">${d.guessCorrect ? '🎯' : '😅'} ${i18n.t('blindguess_you_guessed_them') || 'you guessed for'} ${partnerName}</div>
        <div class="ch-guess-text">${d.userGuess}</div>
        <div class="ch-guess-actual">${d.guessCorrect ? '' : `${i18n.t('blindguess_actual') || 'actual'}: ${d.partnerAns}`}</div>
      </div>`;
    }
    if (d.partnerGuess !== undefined) {
      guessHtml += `<div class="ch-guess ${d.partnerGuessCorrect ? 'correct' : 'wrong'}">
        <div class="ch-guess-label">${d.partnerGuessCorrect ? '🎯' : '😅'} ${partnerName} ${i18n.t('blindguess_guessed_for_you') || 'guessed for you'}</div>
        <div class="ch-guess-text">${d.partnerGuess}</div>
        <div class="ch-guess-actual">${d.partnerGuessCorrect ? '' : `${i18n.t('blindguess_actual') || 'actual'}: ${d.userAns}`}</div>
      </div>`;
    }
    const guessRow = guessHtml ? `<div class="ch-guess-row">${guessHtml}</div>` : '';

    chaptersHtml += `
      <div class="story-chapter">
        <div class="ch-num">${i + 1} ${i18n.t('results_of')} ${total}</div>
        <div class="ch-question">${d.q}</div>
        <div class="ch-answers">
          <div class="ch-ans ch-you">
            <div class="ch-label">${i18n.t('results_you')}</div>
            <div class="ch-text">${d.userAns}</div>
          </div>
          <div class="ch-ans ch-them">
            <div class="ch-label">${partnerName}</div>
            <div class="ch-text">${d.partnerAns}</div>
          </div>
        </div>
        ${guessRow}
      </div>
    `;
  });

  const scroll = document.getElementById('storyScroll');
  scroll.innerHTML = `
    <div class="story-hero">
      <div class="story-hero-top">
        <div class="story-hero-emoji">${vibe.emoji}</div>
        <div class="story-hero-score">${pct}%</div>
      </div>
      <div class="story-hero-vibe">${vibe.title}</div>
      <div class="story-hero-sub">${vibe.desc}</div>
      <div class="story-hero-names">${i18n.t('results_you')} & ${partnerName}</div>
    </div>
    <div class="story-intro"><p>${vibe.intro}</p></div>
    <!-- <div id="vibeReportSlot">${getVibeReportLoadingHtml()}</div> -->
    ${chaptersHtml}
    <div class="story-outro">
      <div class="story-stats">
        <div><div class="story-stat-val">${matches}</div><div class="story-stat-lbl">${i18n.t('results_matches')}</div></div>
        <div><div class="story-stat-val">${total - matches}</div><div class="story-stat-lbl">${i18n.t('results_plot_twists')}</div></div>
        <div><div class="story-stat-val">${pct}%</div><div class="story-stat-lbl">${i18n.t('results_sync_rate')}</div></div>
        ${userGuessResults.length > 0 ? `<div><div class="story-stat-val">${apiGuessCorrectCount}/${userGuessResults.length}</div><div class="story-stat-lbl">${i18n.t('blindguess_you_read_them') || 'you read them'}</div></div>` : ''}
        ${partnerGuessResults.length > 0 ? `<div><div class="story-stat-val">${apiPartnerGuessCorrectCount}/${partnerGuessResults.length}</div><div class="story-stat-lbl">${i18n.t('blindguess_they_read_you') || 'they read you'}</div></div>` : ''}
      </div>
      <div class="story-brand">blindside.</div>
      <div class="story-date">${dateStr}</div>
    </div>
    <div class="story-actions">
      <button class="btn-share" onclick="shareReceipt()">${i18n.t('results_share')}</button>
      <button class="btn btn-primary" style="width:100%" onclick="goTo('packs')">${i18n.t('results_play_another')}</button>
      <button class="btn btn-ghost" onclick="goTo('home');loadHomeSessions()">${i18n.t('results_back_home')}</button>
    </div>
  `;
  scroll.scrollTop = 0;
  spawnConfetti();
  // AI vibe report disabled for now
  // loadVibeReport(data, partnerName, pct, selectedPackKey);

  // Prompt guests to save their account
  if (isGuest) setTimeout(showSaveAccountModal, 2000);
}

// ==================== SOLO RESULT DEFINITIONS (loaded from /data/{lang}/results/) ====================
async function buildSoloReceipt() {
  // Load translated result definitions
  const packResult = await loadResults(selectedPackKey, i18n.current);
  if (!packResult) { buildReceipt(); return; }

  // Tally trait scores
  const scores = {};
  questions.forEach((q, i) => {
    const raw = selectedAnswers[i];
    if (raw == null || !q.traits) return;
    const indices = Array.isArray(raw) ? raw : [raw];
    indices.forEach(ansIdx => {
      const traitMap = q.traits[ansIdx];
      if (!traitMap) return;
      Object.entries(traitMap).forEach(([trait, val]) => {
        scores[trait] = (scores[trait] || 0) + val;
      });
    });
  });

  // Find dominant trait
  const sortedTraits = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const dominantKey = sortedTraits[0]?.[0] || packResult.traits[0];
  const result = packResult.results[dominantKey];
  const totalScore = sortedTraits.reduce((sum, [, v]) => sum + v, 0) || 1;

  // Build trait breakdown bars
  let breakdownHtml = '';
  sortedTraits.forEach(([trait, val]) => {
    const pct = Math.round((val / totalScore) * 100);
    const r = packResult.results[trait];
    if (!r) return;
    breakdownHtml += `
      <div class="solo-trait-bar">
        <div class="solo-trait-header">
          <span class="solo-trait-emoji">${r.emoji}</span>
          <span class="solo-trait-name">${r.title}</span>
          <span class="solo-trait-pct">${pct}%</span>
        </div>
        <div class="solo-bar-track">
          <div class="solo-bar-fill" style="width:${pct}%"></div>
        </div>
      </div>
    `;
  });

  // Build answer review
  let answersHtml = '';
  questions.forEach((q, i) => {
    const raw = selectedAnswers[i];
    const ansText = raw != null ? (Array.isArray(raw) ? raw.map(idx => q.options[idx]).join(', ') : q.options[raw]) : '—';
    answersHtml += `
      <div class="story-chapter">
        <div class="ch-num">${i + 1} ${i18n.t('results_of')} ${questions.length}</div>
        <div class="ch-question">${q.q}</div>
        <div class="ch-answers">
          <div class="ch-ans ch-you" style="flex:1">
            <div class="ch-label">${i18n.t('results_you')}</div>
            <div class="ch-text">${ansText}</div>
          </div>
        </div>
      </div>
    `;
  });

  // "You probably" list (if available)
  let youProbablyHtml = '';
  if (result.youProbably && result.youProbably.length) {
    youProbablyHtml = `
      <div class="solo-youprobably glass">
        <div class="solo-youprobably-title">${i18n.t('solo_you_probably')}</div>
        ${result.youProbably.map(item => `<div class="solo-yp-item"><span class="solo-yp-dot"></span>${item}</div>`).join('')}
      </div>
    `;
  }

  const packDef = packDefs.find(p => p.key === selectedPackKey);
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const taglineHtml = result.tagline ? `<div class="solo-tagline">${result.tagline}</div>` : '';

  const scroll = document.getElementById('storyScroll');
  scroll.innerHTML = `
    <div class="story-hero">
      <div class="story-hero-top">
        <div class="story-hero-emoji">${result.emoji}</div>
      </div>
      <div class="story-hero-vibe">${result.title}</div>
      ${taglineHtml}
      <div class="story-hero-sub">${i18n.t(packDef.nameKey)}</div>
      <div class="story-hero-names"><span class="solo-badge-tag">${i18n.t('solo_badge')}</span></div>
    </div>
    <div class="story-intro"><p>${result.desc}</p></div>
    ${youProbablyHtml}
    <div class="solo-advice-card glass">
      <div class="solo-advice-label">${i18n.t('solo_note_to_self')}</div>
      <div class="solo-advice-text">${result.advice}</div>
    </div>
    <div class="solo-breakdown-section">
      <div class="solo-breakdown-title">${i18n.t('solo_breakdown')}</div>
      ${breakdownHtml}
    </div>
    ${answersHtml}
    <div class="story-outro">
      <div class="story-brand">blindside.</div>
      <div class="story-date">${dateStr}</div>
    </div>
    <div class="story-actions">
      <button class="btn-share" onclick="shareReceipt()">${i18n.t('results_share')}</button>
      <button class="btn btn-primary" style="width:100%" onclick="goTo('packs')">${i18n.t('solo_take_another')}</button>
      <button class="btn btn-ghost" onclick="goTo('home')">${i18n.t('results_back_home')}</button>
    </div>
  `;
  scroll.scrollTop = 0;
  spawnConfetti();
}
function buildReceipt() {
  const data = revealData.length ? revealData : questions.map((q, i) => {
    const raw = selectedAnswers[i];
    const partnerIdx = q.partnerAnswerIndex;
    let userAns, matched, userGuess, guessCorrect;
    // Blind guess: {own, guess}
    if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'own' in raw) {
      userAns = q.options[raw.own];
      matched = raw.own === partnerIdx;
      userGuess = q.options[raw.guess];
      guessCorrect = raw.guess === partnerIdx;
    } else if (Array.isArray(raw)) {
      userAns = raw.map(idx => q.options[idx]).join(', ');
      matched = raw.includes(partnerIdx);
    } else {
      const userIdx = raw != null ? raw : 0;
      userAns = q.options[userIdx];
      matched = userIdx === partnerIdx;
    }
    return { q: q.q, userAns, partnerAns: q.options[partnerIdx], matched, userGuess, guessCorrect };
  });

  const matches = data.filter(d => d.matched).length;
  const total = data.length;
  const pct = Math.round((matches / total) * 100);

  const vibeLabels = getVibeLabels();
  const vibe = [...vibeLabels].reverse().find(v => pct >= v.min);

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Build chapters
  let chaptersHtml = '';
  const guessResults = data.filter(d => d.userGuess !== undefined);
  const hasGuesses = guessResults.length > 0;
  const guessCorrectCount = guessResults.filter(d => d.guessCorrect).length;

  data.forEach((d, i) => {
    const guessHtml = d.userGuess !== undefined ? `
      <div class="ch-guess-row">
        <div class="ch-guess ${d.guessCorrect ? 'correct' : 'wrong'}">
          <div class="ch-guess-label">${d.guessCorrect ? '🎯' : '😅'} ${i18n.t('blindguess_you_guessed') || 'you guessed'}</div>
          <div class="ch-guess-text">${d.userGuess}</div>
        </div>
      </div>` : '';

    chaptersHtml += `
      <div class="story-chapter">
        <div class="ch-num">${i + 1} ${i18n.t('results_of')} ${total}</div>
        <div class="ch-question">${d.q}</div>
        <div class="ch-answers">
          <div class="ch-ans ch-you">
            <div class="ch-label">${i18n.t('results_you')}</div>
            <div class="ch-text">${d.userAns}</div>
          </div>
          <div class="ch-ans ch-them">
            <div class="ch-label">alex</div>
            <div class="ch-text">${d.partnerAns}</div>
          </div>
        </div>
        ${guessHtml}
      </div>
    `;
  });

  const scroll = document.getElementById('storyScroll');
  scroll.innerHTML = `
    <div class="story-hero">
      <div class="story-hero-top">
        <div class="story-hero-emoji">${vibe.emoji}</div>
        <div class="story-hero-score">${pct}%</div>
      </div>
      <div class="story-hero-vibe">${vibe.title}</div>
      <div class="story-hero-sub">${vibe.desc}</div>
      <div class="story-hero-names">${i18n.t('results_you')} & Alex</div>
    </div>

    <div class="story-intro">
      <p>${vibe.intro}</p>
    </div>

    <!-- <div id="vibeReportSlot">${getVibeReportLoadingHtml()}</div> -->

    ${chaptersHtml}

    <div class="story-outro">
      <div class="story-stats">
        <div>
          <div class="story-stat-val">${matches}</div>
          <div class="story-stat-lbl">${i18n.t('results_matches')}</div>
        </div>
        <div>
          <div class="story-stat-val">${total - matches}</div>
          <div class="story-stat-lbl">${i18n.t('results_plot_twists')}</div>
        </div>
        <div>
          <div class="story-stat-val">${pct}%</div>
          <div class="story-stat-lbl">${i18n.t('results_sync_rate')}</div>
        </div>
        ${hasGuesses ? `<div>
          <div class="story-stat-val">${guessCorrectCount}/${guessResults.length}</div>
          <div class="story-stat-lbl">${i18n.t('blindguess_read_score') || 'read them right'}</div>
        </div>` : ''}
      </div>
      <div class="story-brand">blindside.</div>
      <div class="story-date">${dateStr}</div>
    </div>

    <div class="story-actions">
      <button class="btn-share" onclick="shareReceipt()">${i18n.t('results_share')}</button>
      <button class="btn btn-primary" style="width:100%" onclick="goTo('packs')">${i18n.t('results_play_another')}</button>
      <button class="btn btn-ghost" onclick="goTo('home')">${i18n.t('results_back_home')}</button>
    </div>
  `;

  scroll.scrollTop = 0;
  spawnConfetti();
  // AI vibe report disabled for now
  // loadVibeReport(data, 'Alex', pct, selectedPackKey);
}

function shareReceipt() {
  if (navigator.share) {
    navigator.share({
      title: 'blindside. vibe check',
      text: 'We just did a blind reveal — check our results!',
    }).catch(() => {});
  } else {
    const btn = event.target;
    btn.textContent = i18n.t('feedback_link_copied');
    setTimeout(() => { btn.innerHTML = i18n.t('results_share'); }, 2000);
  }
}

// Keep animateResults as alias for backward compat
function animateResults() { buildReceipt(); }

// ==================== INIT: URL JOIN + AUTO-LOGIN ====================
(function init() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('join');

  if (code) {
    joinCode = code;
    if (currentUser) {
      // Already logged in, join directly
      handleJoinCode(code);
      joinCode = null;
    } else {
      // Show guest-friendly auth for invite links
      goTo('guestAuth');
      setTimeout(() => document.getElementById('guestName')?.focus(), 300);
    }
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
  } else if (currentUser) {
    // Auto-login: skip splash, go to home
    goTo('home');
  }
})();
