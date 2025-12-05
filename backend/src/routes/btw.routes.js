import { Router } from 'express';
import { query } from '../db/client.js';

const router = Router();

// UUID regex pattern for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// BTW rate in the Netherlands
const BTW_RATE = 0.21;

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

    // Validate required fields
    if (!companyId) {
      return res.status(400).json({ error: 'Missing required field: companyId' });
    }

    if (!UUID_REGEX.test(companyId)) {
      return res.status(400).json({ error: 'Invalid companyId: must be a valid UUID' });
    }

    if (!period || !['month', 'quarter', 'year'].includes(period)) {
      return res.status(400).json({ error: 'Invalid period: must be month, quarter, or year' });
    }

    const yearNum = parseInt(year);
    if (!year || isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
      return res.status(400).json({ error: 'Invalid year: must be a valid year between 2000 and 2100' });
    }

    // Calculate date range
    const dateRange = calculateDateRange(period, yearNum, value);
    if (dateRange.error) {
      return res.status(400).json({ error: dateRange.error });
    }
    const { startDate, endDate } = dateRange;

    // Query worklogs to calculate total revenue
    const result = await query(
      `SELECT COALESCE(SUM(quantity * unit_price), 0) as total
       FROM worklogs
       WHERE company_id = $1
         AND work_date >= $2
         AND work_date <= $3`,
      [companyId, startDate, endDate]
    );

    const subtotal = parseFloat(result.rows[0].total) || 0;
    const btw = subtotal * BTW_RATE;
    const net = subtotal + btw;

    res.json({
      subtotal: Math.round(subtotal * 100) / 100,
      btw: Math.round(btw * 100) / 100,
      net: Math.round(net * 100) / 100,
      period,
      year: yearNum,
      value: period === 'year' ? null : parseInt(value),
      startDate,
      endDate
    });
  } catch (error) {
    console.error('Error calculating BTW overview:', error);
    res.status(500).json({ error: 'Failed to calculate BTW overview' });
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
      return res.status(400).json({ error: 'Invalid scope: must be zzp or company' });
    }

    // Validate ID based on scope
    if (scope === 'zzp') {
      if (!zzpId) {
        return res.status(400).json({ error: 'Missing required field: zzpId (required for scope=zzp)' });
      }
      if (!UUID_REGEX.test(zzpId)) {
        return res.status(400).json({ error: 'Invalid zzpId: must be a valid UUID' });
      }
    } else if (scope === 'company') {
      if (!companyId) {
        return res.status(400).json({ error: 'Missing required field: companyId (required for scope=company)' });
      }
      if (!UUID_REGEX.test(companyId)) {
        return res.status(400).json({ error: 'Invalid companyId: must be a valid UUID' });
      }
    }

    // Validate period
    if (!period || !['month', 'quarter', 'year'].includes(period)) {
      return res.status(400).json({ error: 'Invalid period: must be month, quarter, or year' });
    }

    // Validate year
    const yearNum = parseInt(year);
    if (!year || isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
      return res.status(400).json({ error: 'Invalid year: must be a valid year between 2000 and 2100' });
    }

    // Calculate date range
    const dateRange = calculateDateRange(period, yearNum, value);
    if (dateRange.error) {
      return res.status(400).json({ error: dateRange.error });
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
      worklogsParams = [companyId, startDate, endDate];
    } else {
      worklogsQuery = `
        SELECT work_date, tariff_type, quantity, unit_price, notes
        FROM worklogs
        WHERE zzp_id = $1
          AND work_date >= $2
          AND work_date <= $3
        ORDER BY work_date ASC
      `;
      worklogsParams = [zzpId, startDate, endDate];
    }

    const worklogsResult = await query(worklogsQuery, worklogsParams);

    // Add worklogs to rows
    for (const row of worklogsResult.rows) {
      const quantity = parseFloat(row.quantity) || 0;
      const unitPrice = parseFloat(row.unit_price) || 0;
      const lineTotal = quantity * unitPrice;
      const btwAmount = lineTotal * BTW_RATE;
      rows.push({
        date: row.work_date,
        type: row.tariff_type,
        quantity: quantity,
        unitPrice: unitPrice,
        lineTotal: Math.round(lineTotal * 100) / 100,
        btwAmount: Math.round(btwAmount * 100) / 100,
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
        const amount = parseFloat(row.amount) || 0;
        const btwAmount = amount * BTW_RATE;
        rows.push({
          date: row.expense_date,
          type: 'expense',
          quantity: 1,
          unitPrice: amount,
          lineTotal: amount,
          btwAmount: Math.round(btwAmount * 100) / 100,
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
    res.status(500).json({ error: 'Failed to export BTW data' });
  }
});

export default router;
