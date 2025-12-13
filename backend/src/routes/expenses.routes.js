import { Router } from 'express';
import { query } from '../db/client.js';
import { sendError } from '../utils/error.js';
import { assertZzpScope, requireRoles } from '../middleware/auth.js';

const router = Router();
router.use(requireRoles(['company_admin', 'company_staff', 'zzp_user']));

// UUID regex pattern for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/expenses
 * Create a new expense entry and persist to database
 */
router.post('/', async (req, res) => {
  try {
    const {
      zzpId,
      expenseDate,
      category,
      amount,
      notes
    } = req.body;

    // Validate required fields
    const missingFields = [];
    if (!zzpId) missingFields.push('zzpId');
    if (!expenseDate) missingFields.push('expenseDate');
    if (amount === undefined || amount === null) missingFields.push('amount');

    if (missingFields.length > 0) {
      return sendError(res, 400, 'Verplichte velden ontbreken');
    }

    // Validate UUID format
    if (!UUID_REGEX.test(zzpId)) {
      return sendError(res, 400, 'Ongeldige ZZP-ID');
    }

    // Validate numeric field
    if (typeof amount !== 'number' || isNaN(amount)) {
      return sendError(res, 400, 'Ongeldig bedrag');
    }

    if (req.user.role === 'zzp_user' && !assertZzpScope(req, res, zzpId)) {
      return;
    }

    if (req.user.role !== 'zzp_user') {
      const zzpCheck = await query('SELECT company_id FROM zzp_users WHERE id = $1', [zzpId]);
      if (zzpCheck.rows.length === 0) {
        return sendError(res, 400, 'ZZP gebruiker bestaat niet');
      }
      if (zzpCheck.rows[0].company_id !== req.user.companyId) {
        return sendError(res, 403, 'Geen toegang tot deze ZZP gebruiker');
      }
    }

    // Insert into database
    const result = await query(
      `INSERT INTO expenses (zzp_id, expense_date, category, amount, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, zzp_id, expense_date, category, amount, notes, created_at`,
      [zzpId, expenseDate, category || null, amount, notes || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating expense:', error);

    // Handle foreign key violations
    if (error.code === '23503') {
      if (error.constraint?.includes('zzp')) {
        return sendError(res, 400, 'ZZP gebruiker bestaat niet');
      }
    }

    sendError(res, 500, 'Kon uitgave niet aanmaken');
  }
});

/**
 * GET /api/expenses
 * List expenses with optional zzpId filter
 * Query params: zzpId
 */
router.get('/', async (req, res) => {
  try {
    const { zzpId } = req.query;
    const zzpFilter = req.user.role === 'zzp_user' ? req.user.profileId : zzpId;

    let sql = `
      SELECT e.id, e.zzp_id, e.expense_date, e.category, e.amount, e.notes, e.created_at
      FROM expenses e
      JOIN zzp_users z ON e.zzp_id = z.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (req.user.role !== 'zzp_user') {
      sql += ` AND z.company_id = $${paramIndex++}`;
      params.push(req.user.companyId);
    }

    // Apply filter with UUID validation
    if (zzpFilter) {
      if (!UUID_REGEX.test(zzpFilter)) {
        return sendError(res, 400, 'Ongeldige ZZP-ID');
      }
      sql += ` AND e.zzp_id = $${paramIndex++}`;
      params.push(zzpFilter);
    }

    sql += ' ORDER BY expense_date DESC';

    const result = await query(sql, params);
    res.json({ items: result.rows });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    sendError(res, 500, 'Kon uitgaven niet ophalen');
  }
});

/**
 * DELETE /api/expenses/:id
 * Delete an expense
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      return sendError(res, 400, 'Ongeldige ID');
    }

    const existing = await query(
      `SELECT e.id, e.zzp_id, z.company_id 
       FROM expenses e 
       JOIN zzp_users z ON e.zzp_id = z.id
       WHERE e.id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return sendError(res, 404, 'Uitgave niet gevonden');
    }

    if (req.user.role === 'zzp_user' && !assertZzpScope(req, res, existing.rows[0].zzp_id)) {
      return;
    }
    if (req.user.role !== 'zzp_user' && existing.rows[0].company_id !== req.user.companyId) {
      return sendError(res, 403, 'Geen toegang tot deze uitgave');
    }

    await query('DELETE FROM expenses WHERE id = $1', [id]);

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting expense:', error);
    sendError(res, 500, 'Kon uitgave niet verwijderen');
  }
});

export default router;
