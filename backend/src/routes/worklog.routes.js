import { Router } from 'express';
import { query } from '../db/client.js';
import { sendError } from '../utils/error.js';
import { assertCompanyScope, assertZzpScope, requireRoles } from '../middleware/auth.js';

const router = Router();
router.use(requireRoles(['company_admin', 'company_staff', 'zzp_user']));

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
    if (req.user.role === 'zzp_user') {
      return sendError(res, 403, 'Alleen bedrijven kunnen werklogs registreren');
    }
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
      return sendError(res, 400, 'Verplichte velden ontbreken');
    }

    // Validate UUID format
    if (!UUID_REGEX.test(companyId)) {
      return sendError(res, 400, 'Ongeldige bedrijf-ID');
    }
    if (!UUID_REGEX.test(zzpId)) {
      return sendError(res, 400, 'Ongeldige ZZP-ID');
    }

    // Validate tariff type
    if (!VALID_TARIFF_TYPES.includes(tariffType)) {
      return sendError(res, 400, 'Ongeldig tarieftype');
    }

    if (!assertCompanyScope(req, res, companyId)) {
      return;
    }

    // Validate numeric fields
    if (typeof quantity !== 'number' || isNaN(quantity)) {
      return sendError(res, 400, 'Ongeldige hoeveelheid');
    }
    if (typeof unitPrice !== 'number' || isNaN(unitPrice)) {
      return sendError(res, 400, 'Ongeldige eenheidsprijs');
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
        return sendError(res, 400, 'Bedrijf bestaat niet');
      }
      if (error.constraint?.includes('zzp')) {
        return sendError(res, 400, 'ZZP gebruiker bestaat niet');
      }
    }

    sendError(res, 500, 'Kon werklog niet aanmaken');
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
    const companyFilter = companyId || req.user.companyId;
    const zzpFilter = req.user.role === 'zzp_user' ? req.user.profileId : zzpId;

    if (!assertCompanyScope(req, res, companyFilter)) {
      return;
    }

    let sql = `
      SELECT id, company_id, zzp_id, work_date, tariff_type, quantity, unit_price, currency, notes, created_at
      FROM worklogs
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // Apply filters
    sql += ` AND company_id = $${paramIndex++}`;
    params.push(companyFilter);

    if (zzpFilter) {
      sql += ` AND zzp_id = $${paramIndex++}`;
      params.push(zzpFilter);
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
    sendError(res, 500, 'Kon werklogs niet ophalen');
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
      return sendError(res, 404, 'Werklog niet gevonden');
    }

    if (!assertCompanyScope(req, res, result.rows[0].company_id)) {
      return;
    }
    if (req.user.role === 'zzp_user' && !assertZzpScope(req, res, result.rows[0].zzp_id)) {
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching worklog:', error);
    sendError(res, 500, 'Kon werklog niet ophalen');
  }
});

/**
 * DELETE /api/worklogs/:id
 * Delete a worklog
 */
router.delete('/:id', async (req, res) => {
  try {
    if (req.user.role === 'zzp_user') {
      return sendError(res, 403, 'Alleen bedrijven kunnen werklogs verwijderen');
    }
    const { id } = req.params;

    const existing = await query('SELECT company_id FROM worklogs WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return sendError(res, 404, 'Werklog niet gevonden');
    }
    if (!assertCompanyScope(req, res, existing.rows[0].company_id)) {
      return;
    }

    await query(
      'DELETE FROM worklogs WHERE id = $1',
      [id]
    );

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting worklog:', error);
    sendError(res, 500, 'Kon werklog niet verwijderen');
  }
});

export default router;
