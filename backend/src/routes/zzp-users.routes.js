import { Router } from 'express';
import { query } from '../db/client.js';

const router = Router();

/**
 * GET /api/zzp-users
 * List all ZZP users ordered by created_at DESC
 * Supports optional query param companyId to filter by company
 */
router.get('/', async (req, res) => {
  try {
    const { companyId } = req.query;

    let sql = `
      SELECT id, company_id, full_name, email, phone, external_ref, created_at
      FROM zzp_users
    `;
    const params = [];

    // Filter by company if provided
    if (companyId) {
      sql += ' WHERE company_id = $1';
      params.push(companyId);
    }

    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, params);
    res.json({ items: result.rows });
  } catch (error) {
    console.error('Error fetching ZZP users:', error);
    res.status(500).json({ error: 'Failed to fetch ZZP users' });
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
      return res.status(404).json({ error: 'ZZP user not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching ZZP user:', error);
    res.status(500).json({ error: 'Failed to fetch ZZP user' });
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
      return res.status(400).json({ error: 'Invalid companyId: company does not exist' });
    }

    res.status(500).json({ error: 'Failed to create ZZP user' });
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

    const result = await query(
      `UPDATE zzp_users
       SET company_id = $1, full_name = $2, email = $3, phone = $4, external_ref = $5
       WHERE id = $6
       RETURNING id, company_id, full_name, email, phone, external_ref, created_at`,
      [companyId, full_name, email || null, phone || null, external_ref || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ZZP user not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating ZZP user:', error);

    // Handle foreign key violation
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Invalid companyId: company does not exist' });
    }

    res.status(500).json({ error: 'Failed to update ZZP user' });
  }
});

/**
 * DELETE /api/zzp-users/:id
 * Delete a ZZP user
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM zzp_users WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ZZP user not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting ZZP user:', error);
    res.status(500).json({ error: 'Failed to delete ZZP user' });
  }
});

export default router;
