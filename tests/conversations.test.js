import { jest } from '@jest/globals';
import request from 'supertest';

process.env.JWT_SECRET = 'test-secret-key';

const mockQuery = jest.fn();
jest.unstable_mockModule('../db/pool.js', () => ({
  pool: { query: mockQuery }
}));

const { app } = await import('../app.js');
const jwt = (await import('jsonwebtoken')).default;

const token = jwt.sign({ userId: 1 }, process.env.JWT_SECRET);
const authHeader = { Authorization: `Bearer ${token}` };

describe('Conversation routes require auth', () => {
  test('rejects requests with no token', async () => {
    const res = await request(app).get('/api/conversations');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/conversations/start', () => {
  beforeEach(() => mockQuery.mockReset());

  test('rejects an invalid mode', async () => {
    const res = await request(app)
      .post('/api/conversations/start')
      .set(authHeader)
      .send({ mode: 'sarcastic' });
    expect(res.status).toBe(400);
  });

  test('creates a conversation with a valid mode', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 10, user_id: 1, mode: 'casual', started_at: new Date().toISOString() }]
    });

    const res = await request(app)
      .post('/api/conversations/start')
      .set(authHeader)
      .send({ mode: 'casual' });

    expect(res.status).toBe(201);
    expect(res.body.conversation.mode).toBe('casual');
  });
});

describe('GET /api/conversations', () => {
  beforeEach(() => mockQuery.mockReset());

  test('returns the list of conversations', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, mode: 'formal', started_at: new Date().toISOString(), ended_at: null }]
    });

    const res = await request(app).get('/api/conversations').set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body.conversations).toHaveLength(1);
  });
});

describe('GET /api/conversations/:id', () => {
  beforeEach(() => mockQuery.mockReset());

  test('returns 404 for a conversation that is not found or not owned by this user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/conversations/999').set(authHeader);

    expect(res.status).toBe(404);
  });

  test('returns the conversation and its messages when found', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 5, mode: 'formal', started_at: new Date().toISOString(), ended_at: null }]
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 1, sender: 'user', content: 'hi',
          corrected_content: null, correction_explanation: null,
          created_at: new Date().toISOString()
        }]
      });

    const res = await request(app).get('/api/conversations/5').set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body.conversation.id).toBe(5);
    expect(res.body.messages).toHaveLength(1);
  });

  test('scopes the ownership check to the token\'s user id (IDOR protection)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await request(app).get('/api/conversations/5').set(authHeader);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('user_id'),
      ['5', 1]
    );
  });
});

describe('DELETE /api/conversations/:id', () => {
  beforeEach(() => mockQuery.mockReset());

  test('returns 404 if the conversation does not belong to this user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).delete('/api/conversations/999').set(authHeader);

    expect(res.status).toBe(404);
  });

  test('deletes successfully when found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 5 }] });

    const res = await request(app).delete('/api/conversations/5').set(authHeader);

    expect(res.status).toBe(200);
  });
});