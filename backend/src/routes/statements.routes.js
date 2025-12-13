import { Router } from 'express';
import { sendError } from '../utils/error.js';
import { query } from '../db/client.js';
import { getCurrentISOWeekInfo, getWeekDateRange } from '../utils/week.js';
import { assertCompanyScope, assertZzpScope, requireRoles } from '../middleware/auth.js';
import PDFDocument from 'pdfkit';
import { calcTotals } from '../utils/calc.js';

const router = Router();
router.use(requireRoles(['company_admin', 'company_staff', 'zzp_user']));

/**
 * POST /api/statements/generate
 * Generate a weekly statement for a company/ZZP
 * Body: { companyId (required), zzpId (optional), year (optional), weekNumber (optional) }
 */
router.post('/generate', async (req, res) => {
  try {
    if (req.user.role === 'zzp_user') {
      return sendError(res, 403, 'Alleen bedrijven kunnen overzichten genereren');
    }
    const { companyId, zzpId } = req.body;
    let { year, weekNumber } = req.body;

    // Validate required fields
    const targetCompanyId = companyId || req.user.companyId;
    if (!assertCompanyScope(req, res, targetCompanyId)) {
      return;
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
    const worklogParams = [targetCompanyId, startDate, endDate];
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
        [targetCompanyId, zzpId, year, weekNumber]
      );

        if (existingResult.rows.length > 0) {
          // Update existing statement
          const updateResult = await query(
            `UPDATE statements
             SET total_amount = 0, status = 'open'
             WHERE company_id = $1 AND zzp_id = $2 AND year = $3 AND week_number = $4
             RETURNING id, company_id, zzp_id, year, week_number, total_amount, currency, status, created_at`,
            [targetCompanyId, zzpId, year, weekNumber]
          );
          return res.json(updateResult.rows[0]);
        } else {
          // Insert new empty statement
          const insertResult = await query(
            `INSERT INTO statements (company_id, zzp_id, year, week_number, total_amount, currency, status)
             VALUES ($1, $2, $3, $4, 0, 'EUR', 'open')
             RETURNING id, company_id, zzp_id, year, week_number, total_amount, currency, status, created_at`,
            [targetCompanyId, zzpId, year, weekNumber]
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
          [targetCompanyId, zzpIdForStatement, year, weekNumber]
        );

      let statementResult;

      if (existingResult.rows.length > 0) {
        // Update existing statement
        statementResult = await query(
          `UPDATE statements
           SET total_amount = $1, currency = $2, status = 'open'
            WHERE company_id = $3 AND zzp_id = $4 AND year = $5 AND week_number = $6
            RETURNING id, company_id, zzp_id, year, week_number, total_amount, currency, status, created_at`,
          [totalAmount, currency, targetCompanyId, zzpIdForStatement, year, weekNumber]
        );
      } else {
        // Insert new statement
        statementResult = await query(
          `INSERT INTO statements (company_id, zzp_id, year, week_number, total_amount, currency, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'open')
           RETURNING id, company_id, zzp_id, year, week_number, total_amount, currency, status, created_at`,
          [targetCompanyId, zzpIdForStatement, year, weekNumber, totalAmount, currency]
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
    const companyFilter = companyId || req.user.companyId;
    if (!assertCompanyScope(req, res, companyFilter)) {
      return;
    }
    const zzpFilter = req.user.role === 'zzp_user' ? req.user.profileId : zzpId;

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

    sql += ` AND s.company_id = $${paramIndex++}`;
    params.push(companyFilter);

    if (zzpFilter) {
      sql += ` AND s.zzp_id = $${paramIndex++}`;
      params.push(zzpFilter);
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
 * GET /api/statements/:id/export/csv
 * Export a statement as CSV
 */
router.get('/:id/export/csv', async (req, res) => {
  try {
    const { id } = req.params;
    const statementResult = await query(
      `SELECT s.id, s.company_id, s.zzp_id, s.year, s.week_number, s.total_amount, s.currency,
              c.name as company_name, z.full_name as zzp_name
       FROM statements s
       JOIN companies c ON s.company_id = c.id
       JOIN zzp_users z ON s.zzp_id = z.id
       WHERE s.id = $1`,
      [id]
    );

    if (statementResult.rows.length === 0) {
      return sendError(res, 404, 'Overzicht niet gevonden');
    }

    const statement = statementResult.rows[0];
    if (!assertCompanyScope(req, res, statement.company_id)) {
      return;
    }
    if (req.user.role === 'zzp_user' && !assertZzpScope(req, res, statement.zzp_id)) {
      return;
    }

    const { startDate, endDate } = getWeekDateRange(statement.year, statement.week_number);
    const worklogsResult = await query(
      `SELECT work_date, tariff_type, quantity, unit_price, currency, notes
       FROM worklogs
       WHERE company_id = $1 AND zzp_id = $2 AND work_date >= $3 AND work_date <= $4
       ORDER BY work_date ASC`,
      [statement.company_id, statement.zzp_id, startDate, endDate]
    );

    const rows = [
      ['Datum', 'Type', 'Aantal', 'Prijs', 'Totaal', 'Notities'],
      ...worklogsResult.rows.map(w => {
        const total = (parseFloat(w.quantity) || 0) * (parseFloat(w.unit_price) || 0);
        return [
          w.work_date,
          w.tariff_type,
          w.quantity,
          w.unit_price,
          total.toFixed(2),
          (w.notes || '').replace(/"/g, '""')
        ];
      })
    ];

    const csv = rows.map(row => row.map(val => {
      const str = val === null || val === undefined ? '' : String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=statement-${statement.year}-w${statement.week_number}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting statement csv:', error);
    sendError(res, 500, 'Kon overzicht niet exporteren');
  }
});

/**
 * GET /api/statements/:id/export/pdf
 * Export a statement as PDF
 */
router.get('/:id/export/pdf', async (req, res) => {
  try {
    const { id } = req.params;
    const statementResult = await query(
      `SELECT s.id, s.company_id, s.zzp_id, s.year, s.week_number, s.total_amount, s.currency,
              c.name as company_name, z.full_name as zzp_name
       FROM statements s
       JOIN companies c ON s.company_id = c.id
       JOIN zzp_users z ON s.zzp_id = z.id
       WHERE s.id = $1`,
      [id]
    );

    if (statementResult.rows.length === 0) {
      return sendError(res, 404, 'Overzicht niet gevonden');
    }

    const statement = statementResult.rows[0];
    if (!assertCompanyScope(req, res, statement.company_id)) {
      return;
    }
    if (req.user.role === 'zzp_user' && !assertZzpScope(req, res, statement.zzp_id)) {
      return;
    }

    const { startDate, endDate } = getWeekDateRange(statement.year, statement.week_number);
    const worklogsResult = await query(
      `SELECT work_date, tariff_type, quantity, unit_price, currency, notes
       FROM worklogs
       WHERE company_id = $1 AND zzp_id = $2 AND work_date >= $3 AND work_date <= $4
       ORDER BY work_date ASC`,
      [statement.company_id, statement.zzp_id, startDate, endDate]
    );

    const worklogItems = worklogsResult.rows.map(w => ({
      quantity: parseFloat(w.quantity) || 0,
      unitPrice: parseFloat(w.unit_price) || 0
    }));
    const totals = calcTotals(worklogItems);

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=statement-${statement.year}-w${statement.week_number}.pdf`);
      res.send(buffer);
    });

    doc.fontSize(18).text('Weekoverzicht', { align: 'left' });
    doc.moveDown();
    doc.fontSize(12).text(`Bedrijf: ${statement.company_name}`);
    doc.text(`ZZP: ${statement.zzp_name}`);
    doc.text(`Periode: Week ${statement.week_number} (${startDate} - ${endDate})`);
    doc.moveDown();

    doc.fontSize(11).text('Werkregels', { underline: true });
    doc.moveDown(0.5);
    worklogsResult.rows.forEach((w) => {
      const lineTotal = (parseFloat(w.quantity) || 0) * (parseFloat(w.unit_price) || 0);
      doc.text(`${w.work_date} | ${w.tariff_type} | ${w.quantity} x €${w.unit_price} = €${lineTotal.toFixed(2)}`);
      if (w.notes) {
        doc.fontSize(10).text(w.notes, { indent: 10 });
        doc.fontSize(11);
      }
      doc.moveDown(0.2);
    });

    doc.moveDown();
    doc.fontSize(12).text(`Subtotaal: €${totals.subtotal.toFixed(2)}`);
    doc.text(`BTW (21%): €${totals.btw.toFixed(2)}`);
    doc.font('Helvetica-Bold').text(`Totaal: €${totals.total.toFixed(2)}`);

    doc.end();
  } catch (error) {
    console.error('Error exporting statement pdf:', error);
    sendError(res, 500, 'Kon overzicht niet exporteren');
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

    if (!assertCompanyScope(req, res, result.rows[0].company_id)) {
      return;
    }
    if (req.user.role === 'zzp_user' && !assertZzpScope(req, res, result.rows[0].zzp_id)) {
      return;
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
    if (req.user.role === 'zzp_user') {
      return sendError(res, 403, 'Alleen bedrijven kunnen statussen wijzigen');
    }
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return sendError(res, 400, 'Status is verplicht');
    }

    const validStatuses = ['open', 'approved', 'invoiced', 'paid'];
    if (!validStatuses.includes(status)) {
      return sendError(res, 400, 'Ongeldige status');
    }

    const existing = await query('SELECT company_id FROM statements WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return sendError(res, 404, 'Overzicht niet gevonden');
    }
    if (!assertCompanyScope(req, res, existing.rows[0].company_id)) {
      return;
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
    if (req.user.role === 'zzp_user') {
      return sendError(res, 403, 'Alleen bedrijven kunnen overzichten verwijderen');
    }
    const { id } = req.params;

    const existing = await query('SELECT company_id FROM statements WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return sendError(res, 404, 'Overzicht niet gevonden');
    }
    if (!assertCompanyScope(req, res, existing.rows[0].company_id)) {
      return;
    }

    await query(
      'DELETE FROM statements WHERE id = $1',
      [id]
    );

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting statement:', error);
    sendError(res, 500, 'Kon overzicht niet verwijderen');
  }
});

export default router;
