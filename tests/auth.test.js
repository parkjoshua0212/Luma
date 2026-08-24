import { jest } from '@jest/globals';
import request from 'supertest';

process.env.JWT_SECRET = 'test-secret-key';

const mockQuery = jest.fn();
jest.unstable_mockModule('../db/pool.js', () => ({
  pool: { query: mockQuery }
}));

const { app } = await import('../app.js');
const bcrypt = (await import('bcrypt')).default;

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  test('rejects missing email or password', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'a@test.com' });
    expect(res.status).toBe(400);
  });

  test('rejects a password under 8 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@test.com', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/8 characters/);
  });

  test('rejects an email that is already registered', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'taken@test.com', password: 'longenough' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already registered/);
  });

  test('creates a user and returns a token on success', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ id: 1, email: 'new@test.com', name: 'New User', created_at: new Date().toISOString() }]
      });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@test.com', password: 'longenough', name: 'New User' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('new@test.com');
    expect(typeof res.body.token).toBe('string');
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  test('rejects missing email or password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@test.com' });
    expect(res.status).toBe(400);
  });

  test('rejects a login for an email that does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'whatever1' });
    expect(res.status).toBe(401);
  });

  test('rejects an incorrect password', async () => {
    const hash = await bcrypt.hash('correctpassword', 4);
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'user@test.com', password_hash: hash, name: 'User' }]
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });

  test('logs in successfully with the correct password', async () => {
    const hash = await bcrypt.hash('correctpassword', 4);
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'user@test.com', password_hash: hash, name: 'User' }]
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com', password: 'correctpassword' });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('user@test.com');
    expect(typeof res.body.token).toBe('string');
  });
});