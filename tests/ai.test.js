import { jest } from '@jest/globals';
import request from 'supertest';

process.env.JWT_SECRET = 'test-secret-key';

// Mock the Gemini wrapper (no network) and the DB pool.
const mockGetChatReply = jest.fn();
const mockGetGrammarCorrection = jest.fn();
jest.unstable_mockModule('../lib/gemini.js', () => ({
  getChatReply: mockGetChatReply,
  getGrammarCorrection: mockGetGrammarCorrection
}));

const mockQuery = jest.fn();
jest.unstable_mockModule('../db/pool.js', () => ({
  pool: { query: mockQuery }
}));

const { app } = await import('../app.js');
const jwt = (await import('jsonwebtoken')).default;

const authHeader = { Authorization: `Bearer ${jwt.sign({ userId: 1 }, process.env.JWT_SECRET)}` };

function quotaError() {
  const err = new Error('RESOURCE_EXHAUSTED');
  err.status = 429;
  err.isQuotaError = true;
  return err;
}

beforeEach(() => {
  mockGetChatReply.mockReset();
  mockGetGrammarCorrection.mockReset();
  mockQuery.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('POST /api/ai/correct', () => {
  const post = (body) => request(app).post('/api/ai/correct').set(authHeader).send(body);

  test('requires auth', async () => {
    const res = await request(app).post('/api/ai/correct').send({ sentence: 'hi' });
    expect(res.status).toBe(401);
    expect(mockGetGrammarCorrection).not.toHaveBeenCalled();
  });

  test('returns the correction (happy path)', async () => {
    const correction = { original: 'I goes', corrected: 'I go', explanation: 'Agreement' };
    mockGetGrammarCorrection.mockResolvedValueOnce(correction);

    const res = await post({ sentence: 'I goes' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(correction);
    expect(mockGetGrammarCorrection).toHaveBeenCalledWith('I goes');
  });

  test('rejects a missing or non-string sentence', async () => {
    expect((await post({})).status).toBe(400);
    expect((await post({ sentence: 42 })).status).toBe(400);
    expect(mockGetGrammarCorrection).not.toHaveBeenCalled();
  });

  test('rejects a sentence over 500 characters', async () => {
    const res = await post({ sentence: 'a'.repeat(501) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/500 characters/);
  });

  test('returns 429 when Gemini reports a quota error', async () => {
    mockGetGrammarCorrection.mockRejectedValueOnce(quotaError());

    const res = await post({ sentence: 'I goes' });

    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/usage limit/);
  });

  test('returns 500 on any other Gemini failure', async () => {
    mockGetGrammarCorrection.mockRejectedValueOnce(new Error('AI returned an unparseable response'));

    const res = await post({ sentence: 'I goes' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to correct grammar');
  });
});

describe('POST /api/conversations/:id/message', () => {
  const post = (body) => request(app).post('/api/conversations/7/message').set(authHeader).send(body);

  const history = [{ sender: 'user', content: 'Hello' }, { sender: 'ai', content: 'Hi!' }];

  // The controller always runs these two lookups first.
  function mockConversationLookup() {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 7, mode: 'casual' }] })
      .mockResolvedValueOnce({ rows: history });
  }

  // Echo INSERTs back as saved rows so the response reflects what was written.
  function mockInsertsEcho() {
    let nextId = 100;
    mockQuery.mockImplementation(async (sql, params) => {
      if (!sql.includes('INSERT INTO messages')) throw new Error(`unexpected query: ${sql}`);
      const isUser = sql.includes("'user'");
      return {
        rows: [{
          id: nextId++,
          sender: isUser ? 'user' : 'ai',
          content: params[1],
          corrected_content: isUser ? params[2] : null,
          correction_explanation: isUser ? params[3] : null,
          created_at: '2026-11-13T00:00:00.000Z'
        }]
      };
    });
  }

  const insertCalls = () => mockQuery.mock.calls.filter(([sql]) => sql.includes('INSERT INTO messages'));

  test('saves both messages and returns the reply with the correction (happy path)', async () => {
    mockConversationLookup();
    mockInsertsEcho();
    mockGetChatReply.mockResolvedValueOnce('Nice! Where did you go?');
    mockGetGrammarCorrection.mockResolvedValueOnce({
      original: 'I goes to the park',
      corrected: 'I went to the park',
      explanation: 'Use past tense'
    });

    const res = await post({ content: 'I goes to the park' });

    expect(res.status).toBe(201);
    expect(mockGetChatReply).toHaveBeenCalledWith('casual', history, 'I goes to the park');
    expect(res.body.userMessage).toMatchObject({
      sender: 'user',
      content: 'I goes to the park',
      corrected_content: 'I went to the park',
      correction_explanation: 'Use past tense'
    });
    expect(res.body.reply).toMatchObject({ sender: 'ai', content: 'Nice! Where did you go?' });
    expect(insertCalls()).toHaveLength(2);
  });

  test('stores no correction when the grammar check finds no errors', async () => {
    mockConversationLookup();
    mockInsertsEcho();
    mockGetChatReply.mockResolvedValueOnce('Cool!');
    mockGetGrammarCorrection.mockResolvedValueOnce({
      original: 'I went home',
      corrected: 'I went home',
      explanation: 'No errors found'
    });

    const res = await post({ content: 'I went home' });

    expect(res.status).toBe(201);
    expect(res.body.userMessage.corrected_content).toBeNull();
    expect(res.body.userMessage.correction_explanation).toBeNull();
  });

  test('a failed grammar check does not block the message', async () => {
    mockConversationLookup();
    mockInsertsEcho();
    mockGetChatReply.mockResolvedValueOnce('Sounds fun!');
    mockGetGrammarCorrection.mockRejectedValueOnce(new Error('AI returned an unparseable response'));

    const res = await post({ content: 'I goes to the park' });

    expect(res.status).toBe(201);
    expect(res.body.userMessage).toMatchObject({
      content: 'I goes to the park',
      corrected_content: null,
      correction_explanation: null
    });
    expect(res.body.reply.content).toBe('Sounds fun!');
  });

  test('a failed chat reply still saves the user message and returns 502 with it', async () => {
    mockConversationLookup();
    mockInsertsEcho();
    mockGetChatReply.mockRejectedValueOnce(Object.assign(new Error('overloaded'), { status: 503 }));
    mockGetGrammarCorrection.mockResolvedValueOnce({
      original: 'I goes to the park',
      corrected: 'I went to the park',
      explanation: 'Use past tense'
    });

    const res = await post({ content: 'I goes to the park' });

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/message was saved/);
    // The grammar result that succeeded is kept, not thrown away.
    expect(res.body.userMessage).toMatchObject({
      sender: 'user',
      content: 'I goes to the park',
      corrected_content: 'I went to the park'
    });
    expect(res.body.reply).toBeUndefined();
    // Only the user message is written; no AI message.
    expect(insertCalls()).toHaveLength(1);
    expect(insertCalls()[0][0]).toContain("'user'");
  });

  test('a quota error on the chat reply saves the user message and returns 429', async () => {
    mockConversationLookup();
    mockInsertsEcho();
    mockGetChatReply.mockRejectedValueOnce(quotaError());
    mockGetGrammarCorrection.mockRejectedValueOnce(quotaError());

    const res = await post({ content: 'Hello there' });

    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/usage limit/);
    expect(res.body.userMessage).toMatchObject({ content: 'Hello there', corrected_content: null });
    expect(insertCalls()).toHaveLength(1);
  });

  test('returns 404 and never calls Gemini for an unknown conversation', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await post({ content: 'hi' });

    expect(res.status).toBe(404);
    expect(mockGetChatReply).not.toHaveBeenCalled();
    expect(mockGetGrammarCorrection).not.toHaveBeenCalled();
  });

  test('returns 500 if saving the message fails', async () => {
    mockConversationLookup();
    mockQuery.mockRejectedValueOnce(new Error('db down'));
    mockGetChatReply.mockResolvedValueOnce('hi');
    mockGetGrammarCorrection.mockResolvedValueOnce({ corrected: 'hi', explanation: 'No errors found' });

    const res = await post({ content: 'hi' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to send message');
  });
});
