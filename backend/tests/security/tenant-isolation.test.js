import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';

process.env.JWT_SECRET = 'test-secret';

const companyA = 'comp-A';
const companyB = 'comp-B';
const zzpA = 'zzp-A';
const zzpB = 'zzp-B';

jest.unstable_mockModule('../../src/db/client.js', () => {
  const query = jest.fn(async (sql, params) => {
    const text = sql.toString();
    if (text.includes('FROM worklogs WHERE id')) {
      return { rows: [{ company_id: companyA, zzp_id: zzpA }] };
    }
    if (text.includes('FROM worklogs')) {
      // listing
      return { rows: [{ company_id: params[0], zzp_id: zzpA }] };
    }
    if (text.includes('FROM statements s') && text.includes('WHERE s.id')) {
      return { rows: [{ id: 'stmt1', company_id: companyA, zzp_id: zzpA, week_number: 1, year: 2025 }] };
    }
    if (text.includes('FROM statements s') && text.includes('JOIN companies')) {
      return { rows: [{ id: 'stmt1', company_id: companyA, zzp_id: zzpA, week_number: 1, year: 2025 }] };
    }
    return { rows: [] };
  });
  return { query, pool: {} };
});

const worklogRoutes = (await import('../../src/routes/worklog.routes.js')).default;
const statementsRouter = (await import('../../src/routes/statements.routes.js')).default;
const { authenticate } = await import('../../src/middleware/auth.js');

function appWithRoutes() {
  const app = express();
  app.use(express.json());
  app.use(authenticate);
  app.use('/api/worklogs', worklogRoutes);
  app.use('/api/statements', statementsRouter);
  return app;
}

describe('Security: tenant isolation and role enforcement', () => {
  const app = appWithRoutes();

  const tokenAdminA = jwt.sign(
    { userId: 'userA', email: 'a@test.com', role: 'company_admin', companyId: companyA },
    process.env.JWT_SECRET
  );
  const tokenAdminA_wrongScope = jwt.sign(
    { userId: 'userA', email: 'a@test.com', role: 'company_admin', companyId: companyA },
    process.env.JWT_SECRET
  );
  const tokenZzpWrong = jwt.sign(
    { userId: 'userZ', email: 'z@test.com', role: 'zzp_user', companyId: companyA, profileId: zzpB },
    process.env.JWT_SECRET
  );

  test('company admin cannot list another tenant worklogs', async () => {
    await request(app)
      .get('/api/worklogs?companyId=comp-B')
      .set('Authorization', `Bearer ${tokenAdminA_wrongScope}`)
      .expect(403);
  });

  test('zzp cannot access other zzp statement', async () => {
    await request(app)
      .get('/api/statements/stmt1')
      .set('Authorization', `Bearer ${tokenZzpWrong}`)
      .expect(403);
  });

  test('missing token is unauthorized', async () => {
    await request(app).get('/api/worklogs').expect(401);
  });
});
