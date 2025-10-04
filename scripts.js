// scripts.js — demo frontend logic (mock auth & local storage demo)
// Replace mock parts with real API calls to Odoo backend when integrating.

const REST_COUNTRIES = 'https://restcountries.com/v3.1/all?fields=name,currencies';
const EXCHANGE_API = 'https://api.exchangerate-api.com/v4/latest/'; // append base

/* -------------------------
   Authentication (demo)
   ------------------------- */
function ensureAuth() {
  const user = getCurrentUser();
  if (!user) {
    window.location = 'login.html';
    return false;
  }
  return true;
}
function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('demo_user')); } catch(e) { return null; }
}
function setCurrentUser(u) { localStorage.setItem('demo_user', JSON.stringify(u)); }
function logout(){ localStorage.removeItem('demo_user'); window.location='login.html'; }

/* -------------------------
   Login / Signup logic
   ------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  // login/signup toggle
  const showSignup = document.getElementById('show-signup');
  if (showSignup) showSignup.addEventListener('click', (e) => {
    e.preventDefault(); document.getElementById('login-form').classList.add('hidden');
    document.getElementById('signup-form').classList.remove('hidden');
  });
  const back = document.getElementById('back-to-login');
  if (back) back.addEventListener('click', () => {
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('signup-form').classList.add('hidden');
  });

  // load countries for signup
  const select = document.getElementById('signup-country');
  if (select) loadCountries(select);

  const loginForm = document.getElementById('login-form');
  if (loginForm) loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-password').value;
    const users = JSON.parse(localStorage.getItem('demo_users') || '[]');
    const u = users.find(x => x.email === email && x.password === pass);
    if (!u) { document.getElementById('auth-message').textContent = 'Invalid credentials (demo).'; return; }
    setCurrentUser({ name: u.name, email: u.email, role: u.role, company: u.company || null });
    window.location='dashboard.html';
  });

  const signupForm = document.getElementById('signup-form');
  if (signupForm) signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const country = document.getElementById('signup-country').value;
    const companyName = document.getElementById('signup-company').value.trim() || (country + ' Company');

    // get currency for country using provided API
    const resp = await fetch(REST_COUNTRIES);
    const data = await resp.json();
    let currency = 'USD';
    for (const c of data) {
      const common = (c.name && c.name.common) ? c.name.common : '';
      if (common.toLowerCase().includes(country.toLowerCase())) {
        currency = Object.keys(c.currencies || {})[0] || currency;
        break;
      }
    }

    // store demo user
    const users = JSON.parse(localStorage.getItem('demo_users') || '[]');
    users.push({ name, email, password, role: 'admin', company: { name: companyName, country, currency } });
    localStorage.setItem('demo_users', JSON.stringify(users));
    setCurrentUser({ name, email, role: 'admin', company: { name: companyName, country, currency } });
    window.location='dashboard.html';
  });
});

/* -------------------------
   Countries load helper
   ------------------------- */
async function loadCountries(selectEl) {
  try {
    const res = await fetch(REST_COUNTRIES);
    const data = await res.json();
    data.sort((a,b)=> (a.name.common > b.name.common)?1:-1);
    selectEl.innerHTML = '';
    data.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name.common;
      opt.textContent = c.name.common;
      selectEl.appendChild(opt);
    });
  } catch (e) {
    selectEl.innerHTML = '<option>Unable to load</option>';
  }
}

/* -------------------------
   Expense submission (demo store)
   ------------------------- */
function renderRecentExpenses() {
  const rows = JSON.parse(localStorage.getItem('demo_expenses') || '[]');
  const tbody = document.querySelector('#recent-expenses tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  rows.slice().reverse().forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.ref}</td><td>${r.date}</td><td>${r.amount}</td><td>${r.currency}</td><td>${r.companyAmount||''}</td><td>${r.state}</td>`;
    tbody.appendChild(tr);
  });
}

async function onExpenseSubmit(e) {
  e.preventDefault();
  const amount = parseFloat(document.getElementById('expense-amount').value || 0);
  const currency = document.getElementById('expense-currency').value.trim().toUpperCase();
  const date = document.getElementById('expense-date').value;
  const category = document.getElementById('expense-category').value;
  const desc = document.getElementById('expense-desc').value;
  const user = getCurrentUser();
  const ref = 'EXP/' + Math.floor(Math.random()*9000+1000);
  // Convert to company currency using provided exchangerate API
  const companyCurrency = user.company.currency || 'USD';
  let companyAmount = null;
  try {
    if (currency && currency !== companyCurrency) {
      const resp = await fetch(EXCHANGE_API + currency);
      const d = await resp.json();
      const rate = d.rates[companyCurrency];
      if (rate) companyAmount = (amount * rate).toFixed(2);
    } else {
      companyAmount = amount.toFixed(2);
    }
  } catch (err) { console.warn('convert error', err) }

  const expenses = JSON.parse(localStorage.getItem('demo_expenses') || '[]');
  expenses.push({
    ref, date, amount: amount.toFixed(2), currency, companyAmount, category, desc, employee: user.email, state: 'pending'
  });
  localStorage.setItem('demo_expenses', JSON.stringify(expenses));
  alert('Expense submitted (demo). It will appear in Approvals.');
  window.location='dashboard.html';
}

/* -------------------------
   Company info & conversion
   ------------------------- */
function loadCompanyInfo() {
  const user = getCurrentUser();
  const el = document.getElementById('company-info');
  if (!el) return;
  el.innerHTML = `<strong>${user.company.name}</strong><div class="muted">${user.company.country} • Currency: ${user.company.currency}</div>`;
  document.getElementById('expense-currency').value = user.company.currency;
}

async function convertToCompanyCurrency() {
  const amount = parseFloat(document.getElementById('expense-amount').value || 0);
  const base = document.getElementById('expense-currency').value.trim().toUpperCase();
  const user = getCurrentUser();
  const target = user.company.currency;
  if (!base || !target) { alert('set currency'); return; }
  try {
    const resp = await fetch(EXCHANGE_API + base);
    const d = await resp.json();
    const rate = d.rates[target];
    if (!rate) { document.getElementById('convert-result').textContent = 'Rate not found'; return; }
    const conv = (amount * rate).toFixed(2);
    document.getElementById('convert-result').textContent = `${amount} ${base} ≈ ${conv} ${target} (rate ${rate})`;
  } catch (e) {
    document.getElementById('convert-result').textContent = 'Conversion failed';
  }
}

/* -------------------------
   Approvals (demo)
   ------------------------- */
function renderPendingApprovals() {
  const all = JSON.parse(localStorage.getItem('demo_expenses') || '[]');
  const user = getCurrentUser();
  // show all pending (in real app, show where user is approver)
  const pend = all.filter(x => x.state === 'pending');
  const tbody = document.querySelector('#pending-table tbody');
  tbody.innerHTML = '';
  pend.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.ref}</td><td>${p.employee}</td><td>${p.amount}</td><td>${p.currency}</td><td>${p.companyAmount||''}</td>
      <td>
        <button class="btn small" onclick="demoApprove('${p.ref}')">Approve</button>
        <button class="btn small ghost" onclick="demoReject('${p.ref}')">Reject</button>
      </td>`;
    tbody.appendChild(tr);
  });
}
function demoApprove(ref) {
  changeExpenseState(ref, 'approved');
  alert('Approved (demo)');
  renderPendingApprovals();
}
function demoReject(ref) {
  changeExpenseState(ref, 'rejected');
  alert('Rejected (demo)');
  renderPendingApprovals();
}
function changeExpenseState(ref, state) {
  const arr = JSON.parse(localStorage.getItem('demo_expenses') || '[]');
  for (const e of arr) if (e.ref === ref) e.state = state;
  localStorage.setItem('demo_expenses', JSON.stringify(arr));
}

/* -------------------------
   Admin demo lists
   ------------------------- */
function renderDemoUsers() {
  const users = JSON.parse(localStorage.getItem('demo_users') || '[]');
  const el = document.getElementById('users-list');
  el.innerHTML = users.map(u => `<div class="muted small">${u.name} — ${u.email} — ${u.role}</div>`).join('');
}
function createDemoUser() {
  const name = document.getElementById('admin-user-name').value;
  const email = document.getElementById('admin-user-email').value;
  const role = document.getElementById('admin-user-role').value;
  const users = JSON.parse(localStorage.getItem('demo_users') || '[]');
  users.push({ name, email, password: 'demo', role, company: getCurrentUser().company });
  localStorage.setItem('demo_users', JSON.stringify(users));
  renderDemoUsers();
}

function renderDemoRules() {
  const rules = JSON.parse(localStorage.getItem('demo_rules') || '[]');
  const el = document.getElementById('rules-list'); el.innerHTML = rules.map(r => `<div class="muted small">${r.name} — ${r.type} — ${r.threshold||''}</div>`).join('');
}
function createDemoRule() {
  const name = document.getElementById('rule-name').value;
  const type = document.getElementById('rule-type').value;
  const threshold = document.getElementById('rule-threshold').value;
  const rules = JSON.parse(localStorage.getItem('demo_rules') || '[]');
  rules.push({ name, type, threshold });
  localStorage.setItem('demo_rules', JSON.stringify(rules));
  renderDemoRules();
}
