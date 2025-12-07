import { Router } from 'express';
import { query } from '../db/client.js';
import { sendError } from '../utils/error.js';

const router = Router();

/**
 * GET /api/companies
 * List all companies ordered by created_at DESC
 */
router.get('/', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, name, kvk_number, btw_number, email, phone, created_at FROM companies ORDER BY created_at DESC'
    );
    res.json({ items: result.rows });
  } catch (error) {
    console.error('Error fetching companies:', error);
    sendError(res, 500, 'Kon bedrijven niet ophalen');
  }
});

/**
 * GET /api/companies/:id
 * Get a single company by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      'SELECT id, name, kvk_number, btw_number, email, phone, created_at FROM companies WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return sendError(res, 404, 'Bedrijf niet gevonden');
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching company:', error);
    sendError(res, 500, 'Kon bedrijf niet ophalen');
  }
});

/**
 * POST /api/companies
 * Create a new company
 * Body: { name, kvk_number, btw_number, email, phone }
 */
router.post('/', async (req, res) => {
  try {
    const { name, kvk_number, btw_number, email, phone } = req.body;

    // Validate required fields
    if (!name) {
      return sendError(res, 400, 'Naam is verplicht');
    }

    const result = await query(
      `INSERT INTO companies (name, kvk_number, btw_number, email, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, kvk_number, btw_number, email, phone, created_at`,
      [name, kvk_number || null, btw_number || null, email || null, phone || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating company:', error);
    sendError(res, 500, 'Kon bedrijf niet aanmaken');
  }
});

/**
 * PUT /api/companies/:id
 * Update an existing company
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, kvk_number, btw_number, email, phone } = req.body;

    // Validate required fields
    if (!name) {
      return sendError(res, 400, 'Naam is verplicht');
    }

    const result = await query(
      `UPDATE companies
       SET name = $1, kvk_number = $2, btw_number = $3, email = $4, phone = $5
       WHERE id = $6
       RETURNING id, name, kvk_number, btw_number, email, phone, created_at`,
      [name, kvk_number || null, btw_number || null, email || null, phone || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating company:', error);
    sendError(res, 500, 'Kon bedrijf niet bijwerken');
  }
});

/**
 * DELETE /api/companies/:id
 * Delete a company
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM companies WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return sendError(res, 404, 'Bedrijf niet gevonden');
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting company:', error);
    sendError(res, 500, 'Kon bedrijf niet verwijderen');
  }
});

export default router;
