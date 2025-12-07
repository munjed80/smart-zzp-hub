import { Router } from 'express';
import { sendError } from '../utils/error.js';
import { query } from '../db/client.js';
import { getCurrentISOWeekInfo, getWeekDateRange } from '../utils/week.js';

const router = Router();

/**
 * POST /api/statements/generate
 * Generate a weekly statement for a company/ZZP
 * Body: { companyId (required), zzpId (optional), year (optional), weekNumber (optional) }
 */
router.post('/generate', async (req, res) => {
  try {
    const { companyId, zzpId } = req.body;
    let { year, weekNumber } = req.body;

    // Validate required fields
    if (!companyId) {
      return sendError(res, 400, 'Bedrijf-ID is verplicht');
    }

    // Default to current ISO week if not provided
    if (!year || !weekNumber) {
      const currentWeek = getCurrentISOWeekInfo();
      year = year || currentWeek.year;
      weekNumber = weekNumber || currentWeek.weekNumber;
    }

    // Get date range for the week
    const { startDate, endDate } = getWeekDateRange(year, weekNumber);

    // Build query to calculate total from worklogs
    let worklogSql = `
      SELECT 
        company_id,
        zzp_id,
        COALESCE(SUM(quantity * unit_price), 0) as total_amount,
        MAX(currency) as currency
      FROM worklogs
      WHERE company_id = $1
        AND work_date >= $2
        AND work_date <= $3
    `;
    const worklogParams = [companyId, startDate, endDate];
    let paramIndex = 4;

    if (zzpId) {
      worklogSql += ` AND zzp_id = $${paramIndex++}`;
      worklogParams.push(zzpId);
    }

    worklogSql += ' GROUP BY company_id, zzp_id';

    const worklogResult = await query(worklogSql, worklogParams);

    if (worklogResult.rows.length === 0) {
      // No worklogs found, but we can still create an empty statement if zzpId is provided
      if (zzpId) {
        // Check if a statement already exists
        const existingResult = await query(
          `SELECT id FROM statements WHERE company_id = $1 AND zzp_id = $2 AND year = $3 AND week_number = $4`,
          [companyId, zzpId, year, weekNumber]
        );

        if (existingResult.rows.length > 0) {
          // Update existing statement
          const updateResult = await query(
            `UPDATE statements
             SET total_amount = 0, status = 'open'
             WHERE company_id = $1 AND zzp_id = $2 AND year = $3 AND week_number = $4
             RETURNING id, company_id, zzp_id, year, week_number, total_amount, currency, status, created_at`,
            [companyId, zzpId, year, weekNumber]
          );
          return res.json(updateResult.rows[0]);
        } else {
          // Insert new empty statement
          const insertResult = await query(
            `INSERT INTO statements (company_id, zzp_id, year, week_number, total_amount, currency, status)
             VALUES ($1, $2, $3, $4, 0, 'EUR', 'open')
             RETURNING id, company_id, zzp_id, year, week_number, total_amount, currency, status, created_at`,
            [companyId, zzpId, year, weekNumber]
          );
          return res.status(201).json(insertResult.rows[0]);
        }
      }
      return res.json({ 
        message: 'No worklogs found for the specified period',
        statements: []
      });
    }

    // Process each ZZP's worklogs and create/update statements
    const statements = [];

    for (const row of worklogResult.rows) {
      const zzpIdForStatement = row.zzp_id;
      const totalAmount = parseFloat(row.total_amount);
      const currency = row.currency || 'EUR';

      // Check if statement already exists
      const existingResult = await query(
        `SELECT id FROM statements WHERE company_id = $1 AND zzp_id = $2 AND year = $3 AND week_number = $4`,
        [companyId, zzpIdForStatement, year, weekNumber]
      );

      let statementResult;

      if (existingResult.rows.length > 0) {
        // Update existing statement
        statementResult = await query(
          `UPDATE statements
           SET total_amount = $1, currency = $2, status = 'open'
           WHERE company_id = $3 AND zzp_id = $4 AND year = $5 AND week_number = $6
           RETURNING id, company_id, zzp_id, year, week_number, total_amount, currency, status, created_at`,
          [totalAmount, currency, companyId, zzpIdForStatement, year, weekNumber]
        );
      } else {
        // Insert new statement
        statementResult = await query(
          `INSERT INTO statements (company_id, zzp_id, year, week_number, total_amount, currency, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'open')
           RETURNING id, company_id, zzp_id, year, week_number, total_amount, currency, status, created_at`,
          [companyId, zzpIdForStatement, year, weekNumber, totalAmount, currency]
        );
      }

      statements.push(statementResult.rows[0]);
    }

    // Return single statement or array based on request
    if (zzpId && statements.length === 1) {
      res.status(201).json(statements[0]);
    } else {
      res.status(201).json({ statements });
    }
  } catch (error) {
    console.error('Error generating statement:', error);

    // Handle foreign key violations
    if (error.code === '23503') {
      if (error.constraint?.includes('company')) {
        return sendError(res, 400, 'Bedrijf bestaat niet');
      }
      if (error.constraint?.includes('zzp')) {
        return sendError(res, 400, 'ZZP gebruiker bestaat niet');
      }
    }

    sendError(res, 500, 'Kon overzicht niet genereren');
  }
});

/**
 * GET /api/statements
 * List statements with optional filters
 * Query params: companyId, zzpId, status, year, weekNumber
 */
router.get('/', async (req, res) => {
  try {
    const { companyId, zzpId, status, year, weekNumber } = req.query;

    let sql = `
      SELECT 
        s.id,
        s.company_id,
        s.zzp_id,
        s.year,
        s.week_number,
        s.total_amount,
        s.currency,
        s.status,
        s.created_at,
        c.name as company_name,
        z.full_name as zzp_name,
        z.email as zzp_email
      FROM statements s
      JOIN companies c ON s.company_id = c.id
      JOIN zzp_users z ON s.zzp_id = z.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (companyId) {
      sql += ` AND s.company_id = $${paramIndex++}`;
      params.push(companyId);
    }

    if (zzpId) {
      sql += ` AND s.zzp_id = $${paramIndex++}`;
      params.push(zzpId);
    }

    if (status) {
      sql += ` AND s.status = $${paramIndex++}`;
      params.push(status);
    }

    if (year) {
      sql += ` AND s.year = $${paramIndex++}`;
      params.push(parseInt(year, 10));
    }

    if (weekNumber) {
      sql += ` AND s.week_number = $${paramIndex++}`;
      params.push(parseInt(weekNumber, 10));
    }

    sql += ' ORDER BY s.created_at DESC';

    const result = await query(sql, params);
    res.json({ items: result.rows });
  } catch (error) {
    console.error('Error fetching statements:', error);
    sendError(res, 500, 'Kon overzichten niet ophalen');
  }
});

/**
 * GET /api/statements/:id
 * Get a single statement by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT 
        s.id,
        s.company_id,
        s.zzp_id,
        s.year,
        s.week_number,
        s.total_amount,
        s.currency,
        s.status,
        s.created_at,
        c.name as company_name,
        z.full_name as zzp_name,
        z.email as zzp_email
      FROM statements s
      JOIN companies c ON s.company_id = c.id
      JOIN zzp_users z ON s.zzp_id = z.id
      WHERE s.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return sendError(res, 404, 'Overzicht niet gevonden');
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching statement:', error);
    sendError(res, 500, 'Kon overzicht niet ophalen');
  }
});

/**
 * PATCH /api/statements/:id
 * Update statement status
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return sendError(res, 400, 'Status is verplicht');
    }

    const validStatuses = ['open', 'approved', 'invoiced', 'paid'];
    if (!validStatuses.includes(status)) {
      return sendError(res, 400, 'Ongeldige status');
    }

    const result = await query(
      `UPDATE statements
       SET status = $1
       WHERE id = $2
       RETURNING id, company_id, zzp_id, year, week_number, total_amount, currency, status, created_at`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return sendError(res, 404, 'Overzicht niet gevonden');
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating statement:', error);
    sendError(res, 500, 'Kon overzicht niet bijwerken');
  }
});

/**
 * DELETE /api/statements/:id
 * Delete a statement
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM statements WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return sendError(res, 404, 'Overzicht niet gevonden');
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting statement:', error);
    sendError(res, 500, 'Kon overzicht niet verwijderen');
  }
});

export default router;
