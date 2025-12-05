import { Router } from 'express';
import { query } from '../db/client.js';

const router = Router();

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
      return res.status(400).json({
        error: 'Missing required fields',
        missingFields
      });
    }

    // Validate UUID format
    if (!UUID_REGEX.test(zzpId)) {
      return res.status(400).json({ error: 'Invalid zzpId: must be a valid UUID' });
    }

    // Validate numeric field
    if (typeof amount !== 'number' || isNaN(amount)) {
      return res.status(400).json({ error: 'Invalid amount: must be a number' });
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
        return res.status(400).json({ error: 'Invalid zzpId: ZZP user does not exist' });
      }
    }

    res.status(500).json({ error: 'Failed to create expense' });
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

    let sql = `
      SELECT id, zzp_id, expense_date, category, amount, notes, created_at
      FROM expenses
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // Apply filter
    if (zzpId) {
      sql += ` AND zzp_id = $${paramIndex++}`;
      params.push(zzpId);
    }

    sql += ' ORDER BY expense_date DESC';

    const result = await query(sql, params);
    res.json({ items: result.rows });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

/**
 * DELETE /api/expenses/:id
 * Delete an expense
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM expenses WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

export default router;
