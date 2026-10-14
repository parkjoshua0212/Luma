import request from 'supertest';

// The limiter reads its limit when the app is imported, so set it first.
// Static imports run before this line, hence the dynamic imports below.
process.env.AUTH_RATE_LIMIT_MAX = '3';
const { app } = await import('../../app.js');
const { pool } = await import('../../db/pool.js');

afterAll(() => pool.end());

test('login returns 429 once the attempt limit is exceeded', async () => {
  const attempt = () => request(app)
    .post('/api/auth/login')
    .send({ email: 'attacker@test.com', password: 'wrongpassword' });

  for (let i = 0; i < 3; i++) {
    expect((await attempt()).status).toBe(401);
  }
  expect((await attempt()).status).toBe(429);
});
