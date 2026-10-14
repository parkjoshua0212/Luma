import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../db/pool.js';

afterAll(() => pool.end());

describe('POST /api/auth/register', () => {
  test('creates a user and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@test.com', password: 'longenough', name: 'New User' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('new@test.com');
    expect(typeof res.body.token).toBe('string');
  });

  test('rejects an email that is already registered', async () => {
    const user = { email: 'dupe@test.com', password: 'longenough' };
    await request(app).post('/api/auth/register').send(user);

    const res = await request(app).post('/api/auth/register').send(user);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already registered/);
  });

  test('rejects missing fields', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'nopass@test.com' });

    expect(res.status).toBe(400);
  });

  test('rejects a password that fails the policy', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'short@test.com', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/8 characters/);
  });
});

describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'login@test.com', password: 'correctpassword' });
  });

  test('returns a token for the correct password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'correctpassword' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
  });

  test('rejects a wrong password with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });
});
