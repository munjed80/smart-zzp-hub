import { Router } from 'express';
import { requireRoles } from '../middleware/auth.js';
import { listOutbox } from '../utils/outbox.js';

const router = Router();

router.use(requireRoles(['company_admin', 'company_staff']));

router.get('/', async (_req, res) => {
  const items = listOutbox();
  res.json({ items });
});

export default router;
