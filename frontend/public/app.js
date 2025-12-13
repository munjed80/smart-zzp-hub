const API_BASE = window.API_BASE_URL || '';

const state = {
  token: null,
  user: null,
  statements: [],
  worklogs: [],
  expenses: [],
  invoices: [],
  outbox: []
};

function showToast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3000);
}

function setAuth(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem('authToken', token);
  localStorage.setItem('authUser', JSON.stringify(user));
  document.getElementById('login-section').classList.add('hidden');
  document.getElementById('app-section').classList.remove('hidden');
  document.getElementById('user-info').textContent = `${user.email} • ${user.role}`;
  document.getElementById('settings-role').textContent = user.role;
  document.getElementById('settings-company').textContent = user.companyId || '-';
  document.getElementById('settings-profile').textContent = user.profileId || '-';

  // Hide tabs based on role
  if (user.role === 'zzp_user') {
    document.querySelector('[data-tab="worklogs"]').classList.add('hidden');
    document.getElementById('worklogs').classList.add('hidden');
    document.getElementById('generate-statement').classList.add('hidden');
    document.querySelector('[data-tab="outbox"]').classList.add('hidden');
    document.getElementById('outbox').classList.add('hidden');
  }
}

function clearAuth() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('authToken');
  localStorage.removeItem('authUser');
}

function restoreAuth() {
  const token = localStorage.getItem('authToken');
  const userStr = localStorage.getItem('authUser');
  if (token && userStr) {
    try {
      const user = JSON.parse(userStr);
      setAuth(token, user);
      loadAllData();
      return true;
    } catch {
      clearAuth();
    }
  }
  return false;
}

async function authFetch(path, options = {}) {
  const headers = options.headers ? { ...options.headers } : {};
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (response.status === 401) {
    clearAuth();
    window.location.reload();
  }
  return response;
}

function currency(val) {
  const num = Number(val || 0);
  return num.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' });
}

function statusBadge(status) {
  const labelMap = {
    open: 'Open',
    approved: 'Goedgekeurd',
    invoiced: 'Gefactureerd',
    paid: 'Betaald'
  };
  const classMap = {
    open: 'status-open',
    approved: 'status-approved',
    invoiced: 'status-invoiced',
    paid: 'status-paid'
  };
  return `<span class="status-badge ${classMap[status] || ''}">${labelMap[status] || status}</span>`;
}

async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  errorEl.classList.add('hidden');
  try {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Inloggen mislukt');
    }
    setAuth(data.token, data.user);
    await loadAllData();
    showToast('Ingelogd');
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
}

function showTab(tab) {
  document.querySelectorAll('.tab').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(sec => sec.classList.add('hidden'));
  const btn = document.querySelector(`[data-tab="${tab}"]`);
  const section = document.getElementById(tab);
  if (btn) btn.classList.add('active');
  if (section) section.classList.remove('hidden');
}

async function loadStatements() {
  const res = await authFetch(`/api/statements`);
  const data = await res.json();
  state.statements = data.items || [];
  renderStatements();
  renderDashboard();
  loadInvoices();
}

async function generateStatement() {
  if (state.user.role === 'zzp_user') return;
  await authFetch('/api/statements/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId: state.user.companyId })
  });
  showToast('Overzicht gegenereerd');
  loadStatements();
}

async function exportStatement(id, type) {
  const res = await authFetch(`/api/statements/${id}/export/${type}`);
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `statement-${id}.${type === 'csv' ? 'csv' : 'pdf'}`;
  a.click();
  URL.revokeObjectURL(url);
}

async function generateInvoice(statementId) {
  const res = await authFetch('/api/invoices/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ statementId })
  });
  if (!res.ok) {
    showToast('Kon factuur niet maken');
    return;
  }
  const data = await res.json();
  state.invoices.unshift({
    id: data.invoiceId,
    invoice_number: data.invoiceNumber,
    created_at: data.createdAt
  });
  showToast(`Factuur ${data.invoiceNumber} klaar`);
  renderInvoices();
}

async function sendStatementEmail(id) {
  const res = await authFetch(`/api/statements/${id}/send`, { method: 'POST' });
  if (res.ok) {
    showToast('E-mail toegevoegd aan outbox');
    loadOutbox();
  } else {
    showToast('Kon e-mail niet versturen');
  }
}

async function markStatementStatus(id, status) {
  const res = await authFetch(`/api/statements/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  if (res.ok) {
    showToast('Status bijgewerkt');
    loadStatements();
  }
}

function renderStatements() {
  const list = document.getElementById('statement-list');
  list.innerHTML = '';
  state.statements.forEach((s) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>Week ${s.week_number} ${s.year}</td>
      <td>${s.zzp_name || '-'}</td>
      <td>${currency(s.total_amount)}</td>
      <td>${statusBadge(s.status)}</td>
      <td>
        <button class="btn btn-secondary btn-sm" data-export-csv="${s.id}">CSV</button>
        <button class="btn btn-secondary btn-sm" data-export-pdf="${s.id}">PDF</button>
      </td>
      <td>
        <button class="btn btn-primary btn-sm" data-invoice="${s.id}">Factuur</button>
        <button class="btn btn-secondary btn-sm" data-send="${s.id}">E-mail</button>
        ${s.status !== 'paid' ? `<button class="btn btn-secondary btn-sm" data-paid="${s.id}">Markeer betaald</button>` : `<button class="btn btn-secondary btn-sm" data-open="${s.id}">Markeer open</button>`}
      </td>
    `;
    list.appendChild(tr);
  });
}

function renderDashboard() {
  const openCount = state.statements.filter(s => s.status === 'open').length;
  document.getElementById('stat-open').textContent = openCount;

  const total = state.statements
    .filter(s => s.status !== 'paid')
    .reduce((sum, s) => sum + (parseFloat(s.total_amount) || 0), 0);
  document.getElementById('stat-total').textContent = currency(total);

  const lastInvoice = state.invoices[0];
  document.getElementById('stat-last-invoice').textContent = lastInvoice ? lastInvoice.invoice_number : 'Nog geen';

  const dashList = document.getElementById('dashboard-statements');
  dashList.innerHTML = '';
  state.statements.slice(0, 5).forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>Week ${s.week_number}</td>
      <td>${s.zzp_name || '-'}</td>
      <td>${currency(s.total_amount)}</td>
      <td>${statusBadge(s.status)}</td>
      <td><button class="btn btn-secondary btn-sm" data-export-pdf="${s.id}">PDF</button></td>
    `;
    dashList.appendChild(tr);
  });
}

async function loadWorklogs() {
  const res = await authFetch(`/api/worklogs`);
  const data = await res.json();
  state.worklogs = data.items || [];
  const list = document.getElementById('worklog-list');
  list.innerHTML = '';
  state.worklogs.forEach(w => {
    const total = (parseFloat(w.quantity) || 0) * (parseFloat(w.unit_price) || 0);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${w.work_date}</td>
      <td>${w.tariff_type}</td>
      <td>${w.quantity}</td>
      <td>${currency(w.unit_price)}</td>
      <td>${currency(total)}</td>
    `;
    list.appendChild(tr);
  });
}

async function submitWorklog(event) {
  event.preventDefault();
  const payload = {
    companyId: state.user.companyId,
    zzpId: document.getElementById('worklog-zzp').value,
    workDate: document.getElementById('worklog-date').value,
    tariffType: document.getElementById('worklog-tariff').value,
    quantity: parseFloat(document.getElementById('worklog-qty').value),
    unitPrice: parseFloat(document.getElementById('worklog-price').value),
    notes: document.getElementById('worklog-notes').value
  };
  await authFetch('/api/worklogs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  showToast('Werkbon opgeslagen');
  loadWorklogs();
}

async function loadInvoices() {
  // derive invoices from statements having invoices
  const invoiceRows = [];
  for (const st of state.statements) {
    const res = await authFetch(`/api/invoices/by-statement/${st.id}`);
    if (res.ok) {
      const data = await res.json();
      invoiceRows.push(data);
    }
  }
  state.invoices = invoiceRows;
  renderInvoices();
}

function renderInvoices() {
  const list = document.getElementById('invoice-list');
  list.innerHTML = '';
  state.invoices.forEach(inv => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${inv.statement_id || '-'}</td>
      <td>${inv.invoice_number}</td>
      <td>${new Date(inv.created_at).toLocaleDateString('nl-NL')}</td>
      <td>${inv.file_url ? `<a href="${inv.file_url}">Open</a>` : 'Beschikbaar via API'}</td>
    `;
    list.appendChild(tr);
  });
}

async function loadExpenses() {
  const res = await authFetch('/api/expenses');
  const data = await res.json();
  state.expenses = data.items || [];
  const list = document.getElementById('expense-list');
  list.innerHTML = '';
  let totalExpense = 0;
  state.expenses.forEach(exp => {
    totalExpense += Number(exp.amount || 0);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${exp.expense_date}</td>
      <td>${exp.category || '-'}</td>
      <td>${currency(exp.amount)}</td>
      <td>${exp.notes || ''}</td>
    `;
    list.appendChild(tr);
  });
  document.getElementById('expense-total').textContent = currency(totalExpense);
}

async function submitExpense(event) {
  event.preventDefault();
  if (state.user.role !== 'zzp_user') {
    showToast('Alleen ZZP gebruikers registreren uitgaven');
    return;
  }
  const payload = {
    zzpId: state.user.profileId,
    expenseDate: document.getElementById('expense-date').value,
    category: document.getElementById('expense-category').value,
    amount: parseFloat(document.getElementById('expense-amount').value),
    notes: document.getElementById('expense-notes').value
  };
  await authFetch('/api/expenses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  showToast('Uitgave opgeslagen');
  loadExpenses();
}

async function loadAllData() {
  await Promise.all([
    loadStatements(),
    state.user.role !== 'zzp_user' ? loadWorklogs() : Promise.resolve(),
    loadExpenses()
  ]);
  await loadInvoices();
  if (state.user.role !== 'zzp_user') {
    await loadOutbox();
  }
}

function bindEvents() {
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => showTab(btn.dataset.tab));
  });
  document.getElementById('logout-btn').addEventListener('click', () => { clearAuth(); window.location.reload(); });
  document.getElementById('logout-btn-secondary').addEventListener('click', () => { clearAuth(); window.location.reload(); });
  document.getElementById('worklog-form').addEventListener('submit', submitWorklog);
  document.getElementById('expense-form').addEventListener('submit', submitExpense);
  document.getElementById('refresh-dashboard').addEventListener('click', loadStatements);
  document.getElementById('refresh-worklogs').addEventListener('click', loadWorklogs);
  document.getElementById('refresh-statements').addEventListener('click', loadStatements);
  document.getElementById('refresh-expenses').addEventListener('click', loadExpenses);
  document.getElementById('generate-statement').addEventListener('click', generateStatement);

  document.getElementById('statement-list').addEventListener('click', (e) => {
    const id = e.target.dataset.exportCsv || e.target.dataset.exportPdf || e.target.dataset.invoice || e.target.dataset.send || e.target.dataset.paid || e.target.dataset.open;
    if (!id) return;
    if (e.target.dataset.exportCsv) exportStatement(id, 'csv');
    if (e.target.dataset.exportPdf) exportStatement(id, 'pdf');
    if (e.target.dataset.invoice) generateInvoice(id);
    if (e.target.dataset.send) sendStatementEmail(id);
    if (e.target.dataset.paid) markStatementStatus(id, 'paid');
    if (e.target.dataset.open) markStatementStatus(id, 'open');
  });
  document.getElementById('dashboard-statements').addEventListener('click', (e) => {
    const id = e.target.dataset.exportPdf;
    if (id) exportStatement(id, 'pdf');
  });
}

async function loadOutbox() {
  const res = await authFetch('/api/outbox');
  if (!res.ok) return;
  const data = await res.json();
  state.outbox = data.items || [];
  const list = document.getElementById('outbox-list');
  if (!list) return;
  list.innerHTML = '';
  state.outbox.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.createdAt}</td>
      <td>${item.to}</td>
      <td>${item.subject}</td>
      <td>${item.statementId || ''}</td>
      <td>${item.invoiceNumber || ''}</td>
    `;
    list.appendChild(tr);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  if (!restoreAuth()) {
    showTab('dashboard');
  }
});
