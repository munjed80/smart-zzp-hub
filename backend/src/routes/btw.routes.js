import { Router } from 'express';
import { query } from '../db/client.js';

const router = Router();

// UUID regex pattern for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// BTW rate in the Netherlands
const BTW_RATE = 0.21;

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

    // Build date range based on period
    let startDate, endDate;

    if (period === 'year') {
      startDate = `${yearNum}-01-01`;
      endDate = `${yearNum}-12-31`;
    } else if (period === 'quarter') {
      const quarterNum = parseInt(value);
      if (!value || isNaN(quarterNum) || quarterNum < 1 || quarterNum > 4) {
        return res.status(400).json({ error: 'Invalid value: for quarter, must be 1-4' });
      }
      const startMonth = (quarterNum - 1) * 3 + 1;
      const endMonth = quarterNum * 3;
      startDate = `${yearNum}-${String(startMonth).padStart(2, '0')}-01`;
      // Calculate last day of end month
      const lastDay = new Date(yearNum, endMonth, 0).getDate();
      endDate = `${yearNum}-${String(endMonth).padStart(2, '0')}-${lastDay}`;
    } else if (period === 'month') {
      const monthNum = parseInt(value);
      if (!value || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        return res.status(400).json({ error: 'Invalid value: for month, must be 1-12' });
      }
      startDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`;
      // Calculate last day of month
      const lastDay = new Date(yearNum, monthNum, 0).getDate();
      endDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-${lastDay}`;
    }

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

export default router;
