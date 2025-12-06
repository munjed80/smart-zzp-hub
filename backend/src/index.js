import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import authRouter from './routes/auth.routes.js';
import worklogRoutes from './routes/worklog.routes.js';
import companiesRouter from './routes/companies.routes.js';
import zzpUsersRouter from './routes/zzp-users.routes.js';
import statementsRouter from './routes/statements.routes.js';
import invoicesRouter from './routes/invoices.routes.js';
import expensesRouter from './routes/expenses.routes.js';
import btwRouter from './routes/btw.routes.js';

dotenv.config();

// Check for DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.warn('WARNING: DATABASE_URL is not set. Database operations will fail.');
}

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'smart-zzp-hub-backend' });
});

// Mount routes
app.use('/api/auth', authRouter);
app.use('/api/worklogs', worklogRoutes);
app.use('/api/companies', companiesRouter);
app.use('/api/zzp-users', zzpUsersRouter);
app.use('/api/statements', statementsRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/btw', btwRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
