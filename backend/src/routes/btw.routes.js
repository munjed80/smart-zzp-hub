import { Router } from 'express';
import { sendError } from '../utils/error.js';
import { calcLineTotal, calcBTW } from '../utils/calc.js';
import { query } from '../db/client.js';
import { assertCompanyScope, assertZzpScope, requireRoles } from '../middleware/auth.js';

const router = Router();
router.use(requireRoles(['company_admin', 'company_staff', 'zzp_user']));

// UUID regex pattern for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Calculate date range based on period type
 * @param {string} period - Period type (month, quarter, year)
 * @param {number} yearNum - Year number
 * @param {number|null} value - Period value (month 1-12, quarter 1-4)
 * @returns {Object} - { startDate, endDate } or { error }
 */
function calculateDateRange(period, yearNum, value) {
  let startDate, endDate;

  if (period === 'year') {
    startDate = `${yearNum}-01-01`;
    endDate = `${yearNum}-12-31`;
  } else if (period === 'quarter') {
    const quarterNum = parseInt(value);
    if (!value || isNaN(quarterNum) || quarterNum < 1 || quarterNum > 4) {
      return { error: 'Invalid value: for quarter, must be 1-4' };
    }
    const startMonth = (quarterNum - 1) * 3 + 1;
    const endMonth = quarterNum * 3;
    startDate = `${yearNum}-${String(startMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(yearNum, endMonth, 0).getDate();
    endDate = `${yearNum}-${String(endMonth).padStart(2, '0')}-${lastDay}`;
  } else if (period === 'month') {
    const monthNum = parseInt(value);
    if (!value || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return { error: 'Invalid value: for month, must be 1-12' };
    }
    startDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`;
    const lastDay = new Date(yearNum, monthNum, 0).getDate();
    endDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-${lastDay}`;
  } else {
    return { error: 'Invalid period: must be month, quarter, or year' };
  }

  return { startDate, endDate };
}

/**
 * Escape a value for CSV (handle commas, quotes, newlines)
 * @param {any} val - Value to escape
 * @returns {string} - Escaped CSV value
 */
function escapeCsvValue(val) {
  if (val === null || val === undefined) {
    return '';
  }
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * GET /api/btw/overview
 * Get BTW overview for a company for a specific period
 * Query params: companyId, period (month|quarter|year), year, value (period number)
 */
router.get('/overview', async (req, res) => {
  try {
    const { companyId, period, year, value } = req.query;
    if (req.user.role === 'zzp_user') {
      return sendError(res, 403, 'BTW overzicht is beschikbaar voor bedrijven');
    }

    const targetCompanyId = companyId || req.user.companyId;
    if (!assertCompanyScope(req, res, targetCompanyId)) {
      return;
    }

    // Validate required fields
    if (!targetCompanyId) {
      return sendError(res, 400, 'Bedrijf-ID is verplicht');
    }

    if (!UUID_REGEX.test(targetCompanyId)) {
      return sendError(res, 400, 'Ongeldige bedrijf-ID');
    }

    if (!period || !['month', 'quarter', 'year'].includes(period)) {
      return sendError(res, 400, 'Ongeldige periode');
    }

    const yearNum = parseInt(year);
    if (!year || isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
      return sendError(res, 400, 'Ongeldig jaar');
    }

    // Calculate date range
    const dateRange = calculateDateRange(period, yearNum, value);
    if (dateRange.error) {
      return sendError(res, 400, 'Ongeldige datumbereik');
    }
    const { startDate, endDate } = dateRange;

    // Query worklogs to calculate total revenue
    const result = await query(
      `SELECT COALESCE(SUM(quantity * unit_price), 0) as total
       FROM worklogs
       WHERE company_id = $1
         AND work_date >= $2
         AND work_date <= $3`,
      [targetCompanyId, startDate, endDate]
    );

    const subtotal = Number((parseFloat(result.rows[0].total) || 0).toFixed(2));
    const btw = calcBTW(subtotal);
    const net = Number((subtotal + btw).toFixed(2));

    res.json({
      subtotal,
      btw,
      net,
      period,
      year: yearNum,
      value: period === 'year' ? null : parseInt(value),
      startDate,
      endDate
    });
  } catch (error) {
    console.error('Error calculating BTW overview:', error);
    sendError(res, 500, 'Kon BTW overzicht niet berekenen');
  }
});

/**
 * GET /api/btw/export
 * Export BTW data as CSV for a ZZP user or company
 * Query params:
 *   - scope: "zzp" | "company" (required)
 *   - zzpId: UUID (required when scope=zzp)
 *   - companyId: UUID (required when scope=company)
 *   - period: "month" | "quarter" | "year" (required)
 *   - year: YYYY (required)
 *   - value: period number (month 1-12 or quarter 1-4, optional for year)
 */
router.get('/export', async (req, res) => {
  try {
    const { scope, zzpId, companyId, period, year, value } = req.query;

    // Validate scope
    if (!scope || !['zzp', 'company'].includes(scope)) {
      return sendError(res, 400, 'Ongeldige scope');
    }

    let targetCompanyId = companyId || null;
    let targetZzpId = zzpId || null;

    if (scope === 'company') {
      if (req.user.role === 'zzp_user') {
        return sendError(res, 403, 'Geen toegang tot bedrijfs BTW export');
      }
      targetCompanyId = targetCompanyId || req.user.companyId;
      if (!UUID_REGEX.test(targetCompanyId || '')) {
        return sendError(res, 400, 'Ongeldige bedrijf-ID');
      }
      if (!assertCompanyScope(req, res, targetCompanyId)) {
        return;
      }
    } else {
      targetZzpId = req.user.role === 'zzp_user' ? req.user.profileId : targetZzpId;
      if (!targetZzpId) {
        return sendError(res, 400, 'ZZP-ID is verplicht');
      }
      if (!UUID_REGEX.test(targetZzpId)) {
        return sendError(res, 400, 'Ongeldige ZZP-ID');
      }
      if (req.user.role === 'zzp_user' && !assertZzpScope(req, res, targetZzpId)) {
        return;
      }
      if (req.user.role !== 'zzp_user') {
        const zzpCheck = await query('SELECT company_id FROM zzp_users WHERE id = $1', [targetZzpId]);
        if (zzpCheck.rows.length === 0) {
          return sendError(res, 400, 'ZZP gebruiker bestaat niet');
        }
        if (!assertCompanyScope(req, res, zzpCheck.rows[0].company_id)) {
          return;
        }
      }
    }

    // Validate period
    if (!period || !['month', 'quarter', 'year'].includes(period)) {
      return sendError(res, 400, 'Ongeldige periode');
    }

    // Validate year
    const yearNum = parseInt(year);
    if (!year || isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
      return sendError(res, 400, 'Ongeldig jaar');
    }

    // Calculate date range
    const dateRange = calculateDateRange(period, yearNum, value);
    if (dateRange.error) {
      return sendError(res, 400, 'Ongeldige datumbereik');
    }
    const { startDate, endDate } = dateRange;

    // Collect data rows
    const rows = [];

    // Fetch worklogs
    let worklogsQuery;
    let worklogsParams;

    if (scope === 'company') {
      worklogsQuery = `
        SELECT work_date, tariff_type, quantity, unit_price, notes
        FROM worklogs
        WHERE company_id = $1
          AND work_date >= $2
          AND work_date <= $3
        ORDER BY work_date ASC
      `;
      worklogsParams = [targetCompanyId, startDate, endDate];
    } else {
      worklogsQuery = `
        SELECT work_date, tariff_type, quantity, unit_price, notes
        FROM worklogs
        WHERE zzp_id = $1
          AND work_date >= $2
          AND work_date <= $3
        ORDER BY work_date ASC
      `;
      worklogsParams = [targetZzpId, startDate, endDate];
    }

    const worklogsResult = await query(worklogsQuery, worklogsParams);

    // Add worklogs to rows
    for (const row of worklogsResult.rows) {
      const quantity = parseFloat(row.quantity) || 0;
      const unitPrice = parseFloat(row.unit_price) || 0;
      const lineTotal = calcLineTotal(quantity, unitPrice);
      const btwAmount = calcBTW(lineTotal);
      rows.push({
        date: row.work_date,
        type: row.tariff_type,
        quantity: quantity,
        unitPrice: unitPrice,
        lineTotal,
        btwAmount,
        category: '',
        source: 'worklog'
      });
    }

    // For ZZP scope, also fetch expenses
    if (scope === 'zzp') {
      const expensesResult = await query(
        `SELECT expense_date, amount, category, notes
         FROM expenses
         WHERE zzp_id = $1
           AND expense_date >= $2
           AND expense_date <= $3
         ORDER BY expense_date ASC`,
        [zzpId, startDate, endDate]
      );

      // Add expenses to rows (positive values representing deductible expenses)
      for (const row of expensesResult.rows) {
        const amount = Number((parseFloat(row.amount) || 0).toFixed(2));
        const btwAmount = calcBTW(amount);
        rows.push({
          date: row.expense_date,
          type: 'expense',
          quantity: 1,
          unitPrice: amount,
          lineTotal: amount,
          btwAmount,
          category: row.category || '',
          source: 'expense'
        });
      }

      // Sort all rows by date
      rows.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    // Generate CSV
    const headers = ['date', 'type', 'quantity', 'unitPrice', 'lineTotal', 'btwAmount', 'category', 'source'];
    const csvLines = [headers.join(',')];

    for (const row of rows) {
      const line = headers.map(header => escapeCsvValue(row[header])).join(',');
      csvLines.push(line);
    }

    const csvContent = csvLines.join('\n');

    // Determine filename
    const valueStr = value ? `-${value}` : '';
    const filename = `btw-export-${scope}-${yearNum}-${period}${valueStr}.csv`;

    // Set response headers
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Send CSV
    res.send(csvContent);
  } catch (error) {
    console.error('Error exporting BTW data:', error);
    sendError(res, 500, 'Kon BTW data niet exporteren');
  }
});

/**
 * GET /api/btw/transactions
 * Get detailed BTW transactions for a ZZP user or company
 * Query params:
 *   - scope: "zzp" | "company" (required)
 *   - zzpId: UUID (required when scope=zzp)
 *   - companyId: UUID (required when scope=company)
 *   - period: "month" | "quarter" | "year" (required)
 *   - year: YYYY (required)
 *   - value: period number (month 1-12 or quarter 1-4, optional for year)
 */
router.get('/transactions', async (req, res) => {
  try {
    const { scope, zzpId, companyId, period, year, value } = req.query;

    // Validate scope
    if (!scope || !['zzp', 'company'].includes(scope)) {
      return sendError(res, 400, 'Ongeldige scope');
    }

    // Validate ID based on scope
    if (scope === 'zzp') {
      if (!zzpId) {
        return sendError(res, 400, 'ZZP-ID is verplicht');
      }
      if (!UUID_REGEX.test(zzpId)) {
        return sendError(res, 400, 'Ongeldige ZZP-ID');
      }
    } else if (scope === 'company') {
      if (!companyId) {
        return sendError(res, 400, 'Bedrijf-ID is verplicht');
      }
      if (!UUID_REGEX.test(companyId)) {
        return sendError(res, 400, 'Ongeldige bedrijf-ID');
      }
    }

    // Validate period
    if (!period || !['month', 'quarter', 'year'].includes(period)) {
      return sendError(res, 400, 'Ongeldige periode');
    }

    // Validate year
    const yearNum = parseInt(year);
    if (!year || isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
      return sendError(res, 400, 'Ongeldig jaar');
    }

    // Calculate date range
    const dateRange = calculateDateRange(period, yearNum, value);
    if (dateRange.error) {
      return sendError(res, 400, 'Ongeldige datumbereik');
    }
    const { startDate, endDate } = dateRange;

    // Collect transactions
    const transactions = [];

    // Fetch worklogs
    let worklogsQuery;
    let worklogsParams;

    if (scope === 'company') {
      worklogsQuery = `
        SELECT id, work_date, tariff_type, quantity, unit_price, notes
        FROM worklogs
        WHERE company_id = $1
          AND work_date >= $2
          AND work_date <= $3
        ORDER BY work_date DESC
      `;
      worklogsParams = [companyId, startDate, endDate];
    } else {
      worklogsQuery = `
        SELECT id, work_date, tariff_type, quantity, unit_price, notes
        FROM worklogs
        WHERE zzp_id = $1
          AND work_date >= $2
          AND work_date <= $3
        ORDER BY work_date DESC
      `;
      worklogsParams = [zzpId, startDate, endDate];
    }

    const worklogsResult = await query(worklogsQuery, worklogsParams);

    // Add worklogs to transactions
    for (const row of worklogsResult.rows) {
      const quantity = parseFloat(row.quantity) || 0;
      const unitPrice = parseFloat(row.unit_price) || 0;
      const lineTotal = calcLineTotal(quantity, unitPrice);
      const btwAmount = calcBTW(lineTotal);
      transactions.push({
        id: row.id,
        date: row.work_date,
        type: 'income',
        description: row.tariff_type,
        category: row.tariff_type,
        quantity: quantity,
        unitPrice: unitPrice,
        amount: lineTotal,
        btwAmount,
        notes: row.notes || '',
        source: 'worklog'
      });
    }

    // For ZZP scope, also fetch expenses
    if (scope === 'zzp') {
      const expensesResult = await query(
        `SELECT id, expense_date, amount, category, notes
         FROM expenses
         WHERE zzp_id = $1
           AND expense_date >= $2
           AND expense_date <= $3
         ORDER BY expense_date DESC`,
        [zzpId, startDate, endDate]
      );

      // Add expenses to transactions
      for (const row of expensesResult.rows) {
        const amount = Number((parseFloat(row.amount) || 0).toFixed(2));
        const btwAmount = calcBTW(amount);
        transactions.push({
          id: row.id,
          date: row.expense_date,
          type: 'expense',
          description: row.category || 'Uitgave',
          category: row.category || 'Overig',
          quantity: 1,
          unitPrice: amount,
          amount,
          btwAmount,
          notes: row.notes || '',
          source: 'expense'
        });
      }

      // Sort all transactions by date descending
      transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    // Calculate totals
    let totalIncome = 0;
    let totalExpenses = 0;
    let btwReceived = 0;
    let btwPaid = 0;
    const categoryTotals = {};

    for (const tx of transactions) {
      if (tx.type === 'income') {
        totalIncome += tx.amount;
        btwReceived += tx.btwAmount;
      } else {
        totalExpenses += tx.amount;
        btwPaid += tx.btwAmount;
      }

      // Aggregate by category
      if (!categoryTotals[tx.category]) {
        categoryTotals[tx.category] = { income: 0, expenses: 0, btwReceived: 0, btwPaid: 0 };
      }
      if (tx.type === 'income') {
        categoryTotals[tx.category].income += tx.amount;
        categoryTotals[tx.category].btwReceived += tx.btwAmount;
      } else {
        categoryTotals[tx.category].expenses += tx.amount;
        categoryTotals[tx.category].btwPaid += tx.btwAmount;
      }
    }

    // Round totals
    totalIncome = Number(totalIncome.toFixed(2));
    totalExpenses = Number(totalExpenses.toFixed(2));
    btwReceived = Number(btwReceived.toFixed(2));
    btwPaid = Number(btwPaid.toFixed(2));

    // Round category totals
    for (const cat of Object.keys(categoryTotals)) {
      categoryTotals[cat].income = Number(categoryTotals[cat].income.toFixed(2));
      categoryTotals[cat].expenses = Number(categoryTotals[cat].expenses.toFixed(2));
      categoryTotals[cat].btwReceived = Number(categoryTotals[cat].btwReceived.toFixed(2));
      categoryTotals[cat].btwPaid = Number(categoryTotals[cat].btwPaid.toFixed(2));
    }

    res.json({
      transactions,
      summary: {
        totalIncome,
        totalExpenses,
        netIncome: Number((totalIncome - totalExpenses).toFixed(2)),
        btwReceived,
        btwPaid,
        btwBalance: Number((btwReceived - btwPaid).toFixed(2))
      },
      categoryTotals,
      period,
      year: yearNum,
      value: period === 'year' ? null : parseInt(value),
      startDate,
      endDate
    });
  } catch (error) {
    console.error('Error fetching BTW transactions:', error);
    sendError(res, 500, 'Kon BTW transacties niet ophalen');
  }
});

export default router;
