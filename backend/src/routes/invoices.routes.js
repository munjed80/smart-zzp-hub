import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { query } from '../db/client.js';
import { getWeekDateRange } from '../utils/week.js';

const router = Router();

// BTW rate for Netherlands (21%)
const BTW_RATE = 0.21;

// PDF layout constants
const DESCRIPTION_MAX_LENGTH = 40;
const PAGE_BREAK_THRESHOLD = 700;
const FOOTER_POSITION = 750;

/**
 * Generate a legal Dutch invoice number
 * Format: FACT-{year}-{sequence padded 4 digits}
 * Example: FACT-2025-0007
 * @param {number} year - Year
 * @param {number} sequence - Sequential number for the year
 * @returns {string} - Invoice number
 */
function generateLegalInvoiceNumber(year, sequence) {
  const paddedSequence = String(sequence).padStart(4, '0');
  return `FACT-${year}-${paddedSequence}`;
}

/**
 * Get next invoice sequence number for the year
 * @param {number} year - Year to get sequence for
 * @returns {Promise<number>} - Next sequence number
 */
async function getNextInvoiceSequence(year) {
  const result = await query(
    `SELECT invoice_number 
     FROM invoices 
     WHERE invoice_number LIKE $1
     ORDER BY invoice_number DESC 
     LIMIT 1`,
    [`FACT-${year}-%`]
  );

  if (result.rows.length === 0) {
    return 1;
  }

  // Extract sequence from invoice number (FACT-2025-0007 -> 0007 -> 7)
  const lastInvoiceNumber = result.rows[0].invoice_number;
  const parts = lastInvoiceNumber.split('-');
  const lastSequence = parseInt(parts[2]) || 0;
  
  return lastSequence + 1;
}

/**
 * Format currency amount in Dutch format
 * @param {number} amount - Amount to format
 * @returns {string} - Formatted amount
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
}

/**
 * Format date in Dutch format
 * @param {Date|string} date - Date to format
 * @returns {string} - Formatted date
 */
function formatDate(date) {
  return new Intl.DateTimeFormat('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(date));
}

/**
 * Generate a PDF invoice document
 * @param {Object} data - Invoice data
 * @returns {Promise<Buffer>} - PDF buffer
 */
async function generateInvoicePDF(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const { invoiceNumber, company, zzpUser, statement, worklogs, subtotal, btw, total, weekDateRange } = data;

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('FACTUUR', { align: 'right' });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica').text(`Factuurnummer: ${invoiceNumber}`, { align: 'right' });
    doc.text(`Factuurdatum: ${formatDate(new Date())}`, { align: 'right' });
    doc.moveDown(2);

    // Company info (From)
    doc.fontSize(10).font('Helvetica-Bold').text('Van:');
    doc.font('Helvetica').text(company.name);
    if (company.kvk_number) doc.text(`KVK: ${company.kvk_number}`);
    if (company.btw_number) doc.text(`BTW: ${company.btw_number}`);
    if (company.email) doc.text(`E-mail: ${company.email}`);
    if (company.phone) doc.text(`Telefoon: ${company.phone}`);
    doc.moveDown();

    // ZZP user info (To)
    doc.font('Helvetica-Bold').text('Aan:');
    doc.font('Helvetica').text(zzpUser.full_name);
    if (zzpUser.email) doc.text(`E-mail: ${zzpUser.email}`);
    if (zzpUser.phone) doc.text(`Telefoon: ${zzpUser.phone}`);
    if (zzpUser.external_ref) doc.text(`Referentie: ${zzpUser.external_ref}`);
    doc.moveDown(2);

    // Statement period
    doc.font('Helvetica-Bold').text('Periode:');
    doc.font('Helvetica').text(`Week ${statement.week_number}, ${statement.year}`);
    doc.text(`${formatDate(weekDateRange.startDate)} - ${formatDate(weekDateRange.endDate)}`);
    doc.moveDown(2);

    // Table header
    const tableTop = doc.y;
    const tableLeft = 50;
    const colWidths = [200, 80, 80, 80, 80];
    
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('Omschrijving', tableLeft, tableTop);
    doc.text('Type', tableLeft + colWidths[0], tableTop);
    doc.text('Aantal', tableLeft + colWidths[0] + colWidths[1], tableTop);
    doc.text('Prijs', tableLeft + colWidths[0] + colWidths[1] + colWidths[2], tableTop);
    doc.text('Totaal', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], tableTop);

    // Horizontal line
    doc.moveTo(tableLeft, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    // Table rows
    let y = tableTop + 25;
    doc.font('Helvetica').fontSize(9);

    for (const worklog of worklogs) {
      const quantity = parseFloat(worklog.quantity) || 0;
      const unitPrice = parseFloat(worklog.unit_price) || 0;
      const lineTotal = quantity * unitPrice;
      const description = worklog.notes || `Werk ${formatDate(worklog.work_date)}`;
      
      doc.text(description.substring(0, DESCRIPTION_MAX_LENGTH), tableLeft, y);
      doc.text(worklog.tariff_type, tableLeft + colWidths[0], y);
      doc.text(worklog.quantity.toString(), tableLeft + colWidths[0] + colWidths[1], y);
      doc.text(formatCurrency(worklog.unit_price), tableLeft + colWidths[0] + colWidths[1] + colWidths[2], y);
      doc.text(formatCurrency(lineTotal), tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], y);
      
      y += 20;
      
      // Page break if needed
      if (y > PAGE_BREAK_THRESHOLD) {
        doc.addPage();
        y = 50;
      }
    }

    // Totals section
    doc.moveDown(2);
    const totalsX = 400;
    y = doc.y + 20;

    doc.moveTo(tableLeft, y - 10).lineTo(550, y - 10).stroke();

    doc.font('Helvetica').fontSize(10);
    doc.text('Subtotaal:', totalsX, y);
    doc.text(formatCurrency(subtotal), totalsX + 80, y);

    y += 20;
    doc.text('BTW (21%):', totalsX, y);
    doc.text(formatCurrency(btw), totalsX + 80, y);

    y += 20;
    doc.moveTo(totalsX, y - 5).lineTo(550, y - 5).stroke();
    doc.font('Helvetica-Bold');
    doc.text('Totaal:', totalsX, y);
    doc.text(formatCurrency(total), totalsX + 80, y);

    // Footer
    doc.font('Helvetica').fontSize(8);
    doc.text('Dit is een automatisch gegenereerde factuur.', 50, FOOTER_POSITION, { align: 'center' });

    doc.end();
  });
}

/**
 * POST /api/invoices/generate
 * Generate an invoice from a statement
 * Body: { statementId }
 */
router.post('/generate', async (req, res) => {
  try {
    const { statementId } = req.body;

    // Validate required fields
    if (!statementId) {
      return res.status(400).json({ error: 'Missing required field: statementId' });
    }

    // Check if an invoice already exists for this statement
    const existingInvoiceResult = await query(
      `SELECT id, invoice_number, file_url, created_at
       FROM invoices
       WHERE statement_id = $1`,
      [statementId]
    );

    if (existingInvoiceResult.rows.length > 0) {
      // Invoice already exists, return existing invoice metadata
      const existingInvoice = existingInvoiceResult.rows[0];
      
      // Fetch statement details to get additional info
      const statementResult = await query(
        `SELECT year, week_number, total_amount, currency
         FROM statements
         WHERE id = $1`,
        [statementId]
      );
      
      const statement = statementResult.rows[0];
      
      // Return existing invoice metadata (without regenerating PDF)
      return res.status(200).json({
        invoiceId: existingInvoice.id,
        invoiceNumber: existingInvoice.invoice_number,
        statementId: statementId,
        year: statement.year,
        weekNumber: statement.week_number,
        total: statement.total_amount,
        currency: statement.currency || 'EUR',
        createdAt: existingInvoice.created_at,
        fileUrl: existingInvoice.file_url,
        isExisting: true
      });
    }

    // Fetch statement with company and ZZP user info
    const statementResult = await query(
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
        c.id as company_id,
        c.name as company_name,
        c.kvk_number,
        c.btw_number,
        c.email as company_email,
        c.phone as company_phone,
        z.id as zzp_user_id,
        z.full_name as zzp_name,
        z.email as zzp_email,
        z.phone as zzp_phone,
        z.external_ref as zzp_external_ref
      FROM statements s
      JOIN companies c ON s.company_id = c.id
      JOIN zzp_users z ON s.zzp_id = z.id
      WHERE s.id = $1`,
      [statementId]
    );

    if (statementResult.rows.length === 0) {
      return res.status(404).json({ error: 'Statement not found' });
    }

    const statement = statementResult.rows[0];

    // Get week date range
    const weekDateRange = getWeekDateRange(statement.year, statement.week_number);

    // Fetch worklogs for this statement period
    const worklogsResult = await query(
      `SELECT 
        id, work_date, tariff_type, quantity, unit_price, currency, notes
      FROM worklogs
      WHERE company_id = $1 
        AND zzp_id = $2
        AND work_date >= $3
        AND work_date <= $4
      ORDER BY work_date ASC`,
      [statement.company_id, statement.zzp_id, weekDateRange.startDate, weekDateRange.endDate]
    );

    const worklogs = worklogsResult.rows;

    // Calculate amounts with validation for numeric values
    const subtotal = worklogs.reduce((sum, w) => {
      const quantity = parseFloat(w.quantity) || 0;
      const unitPrice = parseFloat(w.unit_price) || 0;
      return sum + (quantity * unitPrice);
    }, 0);
    const btw = subtotal * BTW_RATE;
    const total = subtotal + btw;

    // Generate invoice number using legal Dutch format
    const currentYear = new Date().getFullYear();
    const sequence = await getNextInvoiceSequence(currentYear);
    const invoiceNumber = generateLegalInvoiceNumber(currentYear, sequence);

    // Prepare data for PDF
    const pdfData = {
      invoiceNumber,
      company: {
        name: statement.company_name,
        kvk_number: statement.kvk_number,
        btw_number: statement.btw_number,
        email: statement.company_email,
        phone: statement.company_phone
      },
      zzpUser: {
        full_name: statement.zzp_name,
        email: statement.zzp_email,
        phone: statement.zzp_phone,
        external_ref: statement.zzp_external_ref
      },
      statement: {
        year: statement.year,
        week_number: statement.week_number,
        status: statement.status
      },
      worklogs,
      subtotal,
      btw,
      total,
      weekDateRange
    };

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(pdfData);
    const pdfBase64 = pdfBuffer.toString('base64');

    // Store invoice in database
    const insertResult = await query(
      `INSERT INTO invoices (statement_id, invoice_number, file_url)
       VALUES ($1, $2, $3)
       RETURNING id, created_at`,
      [statementId, invoiceNumber, null] // file_url is null for now (could be S3 URL in production)
    );

    const invoiceId = insertResult.rows[0].id;
    const createdAt = insertResult.rows[0].created_at;

    // Return invoice metadata and PDF
    res.status(201).json({
      invoiceId,
      invoiceNumber,
      statementId: statement.id,
      companyId: statement.company_id,
      zzpId: statement.zzp_id,
      year: statement.year,
      weekNumber: statement.week_number,
      subtotal: parseFloat(subtotal.toFixed(2)),
      btw: parseFloat(btw.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      currency: statement.currency || 'EUR',
      worklogCount: worklogs.length,
      createdAt: createdAt,
      pdf: pdfBase64,
      isExisting: false
    });
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({ error: 'Failed to generate invoice' });
  }
});

/**
 * GET /api/invoices/by-statement/:statementId
 * Get invoice information for a statement
 */
router.get('/by-statement/:statementId', async (req, res) => {
  try {
    const { statementId } = req.params;

    const result = await query(
      `SELECT id, invoice_number, file_url, created_at
       FROM invoices
       WHERE statement_id = $1`,
      [statementId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found for this statement' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

export default router;
