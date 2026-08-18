import { jest } from '@jest/globals';
import request from 'supertest';

// Replace the real DB pool with a fake one so this test never touches
// your actual Postgres database.
const mockQuery = jest.fn();
jest.unstable_mockModule('../db/pool.js', () => ({
  pool: { query: mockQuery }
}));

// Must import AFTER the mock is registered
const { app } = await import('../app.js');

describe('GET /health', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  test('returns 200 and "connected" when the DB responds', async () => {
    mockQuery.mockResolvedValue({ rows: [{ '?column?': 1 }] });

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe('connected');
  });

  test('returns 500 and "disconnected" when the DB call fails', async () => {
    mockQuery.mockRejectedValue(new Error('connection refused'));

    const res = await request(app).get('/health');

    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
    expect(res.body.db).toBe('disconnected');
  });
});