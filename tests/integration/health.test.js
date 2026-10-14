import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../db/pool.js';

afterAll(() => pool.end());

test('GET /health reports the database as connected', async () => {
  const res = await request(app).get('/health');

  expect(res.status).toBe(200);
  expect(res.body.db).toBe('connected');
});
