import { Router } from 'express';
import { query } from '../db/client.js';
import { sendError } from '../utils/error.js';
import { assertCompanyScope, requireRoles } from '../middleware/auth.js';

const router = Router();
router.use(requireRoles(['company_admin', 'company_staff']));

/**
 * GET /api/zzp-users
 * List all ZZP users ordered by created_at DESC
 * Supports optional query param companyId to filter by company
 */
router.get('/', async (req, res) => {
  try {
    const { companyId } = req.query;
    const targetCompanyId = companyId || req.user.companyId;
    if (!assertCompanyScope(req, res, targetCompanyId)) {
      return;
    }

    let sql = `
      SELECT id, company_id, full_name, email, phone, external_ref, created_at
      FROM zzp_users
    `;
    const params = [];

    // Filter by company if provided
    sql += ' WHERE company_id = $1';
    params.push(targetCompanyId);

    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, params);
    res.json({ items: result.rows });
  } catch (error) {
    console.error('Error fetching ZZP users:', error);
    sendError(res, 500, 'Kon ZZP gebruikers niet ophalen');
  }
});

/**
 * GET /api/zzp-users/:id
 * Get a single ZZP user by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT id, company_id, full_name, email, phone, external_ref, created_at
       FROM zzp_users WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return sendError(res, 404, 'ZZP gebruiker niet gevonden');
    }

    if (!assertCompanyScope(req, res, result.rows[0].company_id)) {
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching ZZP user:', error);
    sendError(res, 500, 'Kon ZZP gebruiker niet ophalen');
  }
});

/**
 * POST /api/zzp-users
 * Create a new ZZP user
 * Body: { companyId, full_name, email, phone, external_ref }
 */
router.post('/', async (req, res) => {
  try {
    const { companyId, full_name, email, phone, external_ref } = req.body;

    // Validate required fields
    const missingFields = [];
    if (!companyId) missingFields.push('companyId');
    if (!full_name) missingFields.push('full_name');

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        missingFields
      });
    }

    if (!assertCompanyScope(req, res, companyId)) {
      return;
    }

    const result = await query(
      `INSERT INTO zzp_users (company_id, full_name, email, phone, external_ref)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, company_id, full_name, email, phone, external_ref, created_at`,
      [companyId, full_name, email || null, phone || null, external_ref || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating ZZP user:', error);

    // Handle foreign key violation
    if (error.code === '23503') {
      return sendError(res, 400, 'Bedrijf bestaat niet');
    }

    sendError(res, 500, 'Kon ZZP gebruiker niet aanmaken');
  }
});

/**
 * PUT /api/zzp-users/:id
 * Update an existing ZZP user
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId, full_name, email, phone, external_ref } = req.body;

    // Validate required fields
    const missingFields = [];
    if (!companyId) missingFields.push('companyId');
    if (!full_name) missingFields.push('full_name');

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        missingFields
      });
    }

    if (!assertCompanyScope(req, res, companyId)) {
      return;
    }

    const result = await query(
      `UPDATE zzp_users
       SET company_id = $1, full_name = $2, email = $3, phone = $4, external_ref = $5
       WHERE id = $6
       RETURNING id, company_id, full_name, email, phone, external_ref, created_at`,
      [companyId, full_name, email || null, phone || null, external_ref || null, id]
    );

    if (result.rows.length === 0) {
      return sendError(res, 404, 'ZZP gebruiker niet gevonden');
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating ZZP user:', error);

    // Handle foreign key violation
    if (error.code === '23503') {
      return sendError(res, 400, 'Bedrijf bestaat niet');
    }

    sendError(res, 500, 'Kon ZZP gebruiker niet bijwerken');
  }
});

/**
 * DELETE /api/zzp-users/:id
 * Delete a ZZP user
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await query('SELECT company_id FROM zzp_users WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return sendError(res, 404, 'ZZP gebruiker niet gevonden');
    }
    if (!assertCompanyScope(req, res, existing.rows[0].company_id)) {
      return;
    }

    await query('DELETE FROM zzp_users WHERE id = $1', [id]);

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting ZZP user:', error);
    sendError(res, 500, 'Kon ZZP gebruiker niet verwijderen');
  }
});

export default router;
