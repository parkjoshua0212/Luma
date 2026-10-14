import { jest } from '@jest/globals';
import request from 'supertest';

// Created outside the factory: Jest can run the factory more than once when
// several modules import gemini.js, and every copy must share these mocks.
const getChatReply = jest.fn();
const getGrammarCorrection = jest.fn();
jest.unstable_mockModule('../../lib/gemini.js', () => ({ getChatReply, getGrammarCorrection }));

const { app } = await import('../../app.js');
const { pool } = await import('../../db/pool.js');

let aliceAuth, bobAuth, conversationId;

async function registerAndGetAuth(email) {
  const res = await request(app).post('/api/auth/register').send({ email, password: 'longenough' });
  return { Authorization: `Bearer ${res.body.token}` };
}

beforeAll(async () => {
  aliceAuth = await registerAndGetAuth('alice@test.com');
  bobAuth = await registerAndGetAuth('bob@test.com');

  const res = await request(app).post('/api/conversations/start').set(aliceAuth).send({ mode: 'casual' });
  conversationId = res.body.conversation.id;
});

afterAll(() => pool.end());

describe("IDOR: another user cannot touch Alice's conversation", () => {
  test('GET returns 404', async () => {
    const res = await request(app).get(`/api/conversations/${conversationId}`).set(bobAuth);

    expect(res.status).toBe(404);
  });

  test('POST /:id/message returns 404 and never calls Gemini', async () => {
    const res = await request(app)
      .post(`/api/conversations/${conversationId}/message`)
      .set(bobAuth)
      .send({ content: 'hello' });

    expect(res.status).toBe(404);
    expect(getChatReply).not.toHaveBeenCalled();
  });

  test('DELETE returns 404 and the conversation survives', async () => {
    const res = await request(app).delete(`/api/conversations/${conversationId}`).set(bobAuth);
    expect(res.status).toBe(404);

    const stillThere = await request(app).get(`/api/conversations/${conversationId}`).set(aliceAuth);
    expect(stillThere.status).toBe(200);
  });
});

test('sending a message saves it and the mocked AI reply', async () => {
  getChatReply.mockResolvedValue('Hi! How are you?');
  getGrammarCorrection.mockResolvedValue({
    original: 'hello', corrected: 'Hello!', explanation: 'Capitalized the greeting.'
  });

  const res = await request(app)
    .post(`/api/conversations/${conversationId}/message`)
    .set(aliceAuth)
    .send({ content: 'hello' });

  expect(res.status).toBe(201);
  expect(res.body.reply.content).toBe('Hi! How are you?');

  const saved = await pool.query(
    'SELECT sender, content, corrected_content FROM messages WHERE conversation_id = $1 ORDER BY id',
    [conversationId]
  );
  expect(saved.rows).toEqual([
    { sender: 'user', content: 'hello', corrected_content: 'Hello!' },
    { sender: 'ai', content: 'Hi! How are you?', corrected_content: null }
  ]);
});
