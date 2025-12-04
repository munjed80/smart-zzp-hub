import { Router } from 'express';
import { query } from '../db/client.js';

const router = Router();

// Valid tariff types
const VALID_TARIFF_TYPES = ['stop', 'hour', 'location', 'point', 'project'];

// UUID regex pattern for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/worklogs
 * Create a new worklog entry and persist to database
 */
router.post('/', async (req, res) => {
  try {
    const {
      companyId,
      zzpId,
      workDate,
      tariffType,
      quantity,
      unitPrice,
      currency = 'EUR',
      notes
    } = req.body;

    // Validate required fields
    const missingFields = [];
    if (!companyId) missingFields.push('companyId');
    if (!zzpId) missingFields.push('zzpId');
    if (!workDate) missingFields.push('workDate');
    if (!tariffType) missingFields.push('tariffType');
    if (quantity === undefined || quantity === null) missingFields.push('quantity');
    if (unitPrice === undefined || unitPrice === null) missingFields.push('unitPrice');

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        missingFields
      });
    }

    // Validate UUID format
    if (!UUID_REGEX.test(companyId)) {
      return res.status(400).json({ error: 'Invalid companyId: must be a valid UUID' });
    }
    if (!UUID_REGEX.test(zzpId)) {
      return res.status(400).json({ error: 'Invalid zzpId: must be a valid UUID' });
    }

    // Validate tariff type
    if (!VALID_TARIFF_TYPES.includes(tariffType)) {
      return res.status(400).json({
        error: `Invalid tariffType: must be one of ${VALID_TARIFF_TYPES.join(', ')}`
      });
    }

    // Validate numeric fields
    if (typeof quantity !== 'number' || isNaN(quantity)) {
      return res.status(400).json({ error: 'Invalid quantity: must be a number' });
    }
    if (typeof unitPrice !== 'number' || isNaN(unitPrice)) {
      return res.status(400).json({ error: 'Invalid unitPrice: must be a number' });
    }

    // Insert into database
    const result = await query(
      `INSERT INTO worklogs (company_id, zzp_id, work_date, tariff_type, quantity, unit_price, currency, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, company_id, zzp_id, work_date, tariff_type, quantity, unit_price, currency, notes, created_at`,
      [companyId, zzpId, workDate, tariffType, quantity, unitPrice, currency, notes || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating worklog:', error);

    // Handle foreign key violations
    if (error.code === '23503') {
      if (error.constraint?.includes('company')) {
        return res.status(400).json({ error: 'Invalid companyId: company does not exist' });
      }
      if (error.constraint?.includes('zzp')) {
        return res.status(400).json({ error: 'Invalid zzpId: ZZP user does not exist' });
      }
    }

    res.status(500).json({ error: 'Failed to create worklog' });
  }
});

/**
 * GET /api/worklogs
 * List worklogs with optional filters
 * Query params: companyId, zzpId, fromDate, toDate
 */
router.get('/', async (req, res) => {
  try {
    const { companyId, zzpId, fromDate, toDate } = req.query;

    let sql = `
      SELECT id, company_id, zzp_id, work_date, tariff_type, quantity, unit_price, currency, notes, created_at
      FROM worklogs
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // Apply filters
    if (companyId) {
      sql += ` AND company_id = $${paramIndex++}`;
      params.push(companyId);
    }

    if (zzpId) {
      sql += ` AND zzp_id = $${paramIndex++}`;
      params.push(zzpId);
    }

    if (fromDate) {
      sql += ` AND work_date >= $${paramIndex++}`;
      params.push(fromDate);
    }

    if (toDate) {
      sql += ` AND work_date <= $${paramIndex++}`;
      params.push(toDate);
    }

    sql += ' ORDER BY work_date DESC';

    const result = await query(sql, params);
    res.json({ items: result.rows });
  } catch (error) {
    console.error('Error fetching worklogs:', error);
    res.status(500).json({ error: 'Failed to fetch worklogs' });
  }
});

/**
 * GET /api/worklogs/:id
 * Get a single worklog by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT id, company_id, zzp_id, work_date, tariff_type, quantity, unit_price, currency, notes, created_at
       FROM worklogs WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Worklog not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching worklog:', error);
    res.status(500).json({ error: 'Failed to fetch worklog' });
  }
});

/**
 * DELETE /api/worklogs/:id
 * Delete a worklog
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM worklogs WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Worklog not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting worklog:', error);
    res.status(500).json({ error: 'Failed to delete worklog' });
  }
});

export default router;
