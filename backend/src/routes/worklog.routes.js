import { Router } from 'express';
import crypto from 'crypto';

const router = Router();

/**
 * POST /api/worklogs
 * Create a new worklog entry
 */
router.post('/', (req, res) => {
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

  // TODO: Persist in PostgreSQL database

  // For now, echo back the payload with a generated id
  const worklog = {
    id: crypto.randomUUID(),
    companyId,
    zzpId,
    workDate,
    tariffType,
    quantity,
    unitPrice,
    currency,
    notes
  };

  res.status(201).json(worklog);
});

/**
 * GET /api/worklogs
 * List all worklogs (placeholder)
 */
router.get('/', (req, res) => {
  // TODO: Connect to PostgreSQL and retrieve worklogs
  res.json({
    items: [],
    message: 'Worklog listing is not yet connected to a database.'
  });
});

export default router;
