import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';

process.env.JWT_SECRET = 'test-secret';

// bcrypt hash for "test123"
const PASSWORD_HASH = '$2b$10$VsgEgXIUpdPnL71nINi3Q.YvDImHJyoE02d/rJJJNuROPsQa3AZAq';
const COMPANY_ID = 'comp-1';

jest.unstable_mockModule('../src/db/client.js', () => {
  const query = jest.fn(async (sql, params) => {
    const text = sql.toString();

    if (text.includes('FROM users WHERE email')) {
      return {
        rows: [
          {
            id: 'user-1',
            email: params[0],
            password_hash: PASSWORD_HASH,
            full_name: 'Admin',
            user_type: 'company',
            role: 'company_admin',
            company_id: COMPANY_ID
          }
        ]
      };
    }

    if (text.includes('FROM companies WHERE user_id')) {
      return { rows: [{ id: COMPANY_ID }] };
    }

    if (text.includes('FROM companies WHERE id = $1')) {
      return {
        rows: [
          {
            id: params[0],
            name: 'Test Company',
            kvk_number: null,
            btw_number: null,
            email: 'c@test.com',
            phone: null,
            created_at: new Date().toISOString()
          }
        ]
      };
    }

    return { rows: [] };
  });

  return { query, pool: {} };
});

const authRouter = (await import('../src/routes/auth.routes.js')).default;
const worklogRoutes = (await import('../src/routes/worklog.routes.js')).default;
const companiesRouter = (await import('../src/routes/companies.routes.js')).default;
const { authenticate } = await import('../src/middleware/auth.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use(authenticate);
  app.use('/api/worklogs', worklogRoutes);
  app.use('/api/companies', companiesRouter);
  return app;
}

describe('Auth and tenant isolation', () => {
  const app = buildApp();

  test('login returns JWT with role and company', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'test123' })
      .expect(200);

    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('company_admin');
    expect(res.body.user.companyId).toBe(COMPANY_ID);
  });

  test('company admin blocked from accessing other company worklogs', async () => {
    const token = jwt.sign(
      { userId: 'user-1', email: 'admin@test.com', role: 'company_admin', companyId: COMPANY_ID },
      process.env.JWT_SECRET
    );

    const res = await request(app)
      .get('/api/worklogs?companyId=other-company')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(res.body.error).toBeDefined();
  });

  test('company list returns only scoped company', async () => {
    const token = jwt.sign(
      { userId: 'user-1', email: 'admin@test.com', role: 'company_admin', companyId: COMPANY_ID },
      process.env.JWT_SECRET
    );

    const res = await request(app)
      .get('/api/companies')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].id).toBe(COMPANY_ID);
  });
});
