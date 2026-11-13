import { jest } from '@jest/globals';

// Replace the Gemini SDK entirely: no client is constructed against the real
// API and every generateContent call goes to this mock.
const mockGenerate = jest.fn();
jest.unstable_mockModule('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerate }
  }))
}));

const { getChatReply, getGrammarCorrection } = await import('../lib/gemini.js');

function apiError(status, message = `HTTP ${status}`) {
  const err = new Error(message);
  err.status = status;
  return err;
}

beforeEach(() => {
  mockGenerate.mockReset();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('retry behaviour (via getChatReply)', () => {
  beforeEach(() => jest.useFakeTimers());

  test('retries a 503 after 1s, then after 2s, and succeeds on the third attempt', async () => {
    mockGenerate
      .mockRejectedValueOnce(apiError(503))
      .mockRejectedValueOnce(apiError(503))
      .mockResolvedValueOnce({ text: 'Hello again!' });

    const promise = getChatReply('casual', [], 'hi');

    await jest.advanceTimersByTimeAsync(0);
    expect(mockGenerate).toHaveBeenCalledTimes(1);

    // First backoff is 1000ms: nothing happens a tick early.
    await jest.advanceTimersByTimeAsync(999);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(mockGenerate).toHaveBeenCalledTimes(2);

    // Second backoff is 2000ms.
    await jest.advanceTimersByTimeAsync(1999);
    expect(mockGenerate).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(1);
    expect(mockGenerate).toHaveBeenCalledTimes(3);

    await expect(promise).resolves.toBe('Hello again!');
  });

  test('gives up after two retries if Gemini stays at 503', async () => {
    const lastErr = apiError(503, 'still overloaded');
    mockGenerate
      .mockRejectedValueOnce(apiError(503))
      .mockRejectedValueOnce(apiError(503))
      .mockRejectedValueOnce(lastErr);

    const promise = getChatReply('casual', [], 'hi');
    const assertion = expect(promise).rejects.toBe(lastErr);

    await jest.advanceTimersByTimeAsync(3000);
    await assertion;
    expect(mockGenerate).toHaveBeenCalledTimes(3);
  });

  test('fails fast on 429 and marks the error as a quota error', async () => {
    mockGenerate.mockRejectedValueOnce(apiError(429));

    const promise = getChatReply('casual', [], 'hi');
    const assertion = expect(promise).rejects.toMatchObject({ status: 429, isQuotaError: true });

    await jest.advanceTimersByTimeAsync(5000);
    await assertion;
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  test('does not retry other errors', async () => {
    mockGenerate.mockRejectedValueOnce(apiError(400));

    const promise = getChatReply('casual', [], 'hi');
    const assertion = expect(promise).rejects.toMatchObject({ status: 400 });

    await jest.advanceTimersByTimeAsync(5000);
    await assertion;
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  test('reads the status from err.code', async () => {
    const err = new Error('quota');
    err.code = 429;
    mockGenerate.mockRejectedValueOnce(err);

    await expect(getChatReply('casual', [], 'hi')).rejects.toMatchObject({ isQuotaError: true });
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  test('reads the status from a JSON error message', async () => {
    mockGenerate
      .mockRejectedValueOnce(new Error(JSON.stringify({ error: { code: 503, message: 'overloaded' } })))
      .mockResolvedValueOnce({ text: 'ok' });

    const promise = getChatReply('casual', [], 'hi');
    await jest.advanceTimersByTimeAsync(1000);

    await expect(promise).resolves.toBe('ok');
    expect(mockGenerate).toHaveBeenCalledTimes(2);
  });

  test('treats an error with no recognisable status as non-retryable', async () => {
    mockGenerate.mockRejectedValueOnce(new Error('socket hang up'));

    await expect(getChatReply('casual', [], 'hi')).rejects.toThrow('socket hang up');
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });
});

describe('getChatReply', () => {
  test('sends the history and new message with the mode-specific system prompt', async () => {
    mockGenerate.mockResolvedValueOnce({ text: 'Good afternoon.' });

    const history = [
      { sender: 'user', content: 'Hello' },
      { sender: 'ai', content: 'Hi there' }
    ];
    const reply = await getChatReply('formal', history, 'How are you?');

    expect(reply).toBe('Good afternoon.');
    const params = mockGenerate.mock.calls[0][0];
    expect(params.contents).toBe(
      'Conversation so far:\nUser: Hello\nAI: Hi there\n\nUser: How are you?\nAI:'
    );
    expect(params.config.systemInstruction).toMatch(/professional language conversation partner/);
  });

  test('falls back to the casual prompt for an unknown mode', async () => {
    mockGenerate.mockResolvedValueOnce({ text: 'hey' });

    await getChatReply('pirate', [], 'yo');

    expect(mockGenerate.mock.calls[0][0].config.systemInstruction).toMatch(/friendly conversation partner/);
  });
});

describe('getGrammarCorrection', () => {
  const correction = {
    original: 'I goes home',
    corrected: 'I go home',
    explanation: 'Subject-verb agreement'
  };

  test('parses a plain JSON response', async () => {
    mockGenerate.mockResolvedValueOnce({ text: JSON.stringify(correction) });

    await expect(getGrammarCorrection('I goes home')).resolves.toEqual(correction);
    expect(mockGenerate.mock.calls[0][0].contents).toBe('I goes home');
  });

  test('strips markdown code fences before parsing', async () => {
    mockGenerate.mockResolvedValueOnce({ text: '```json\n' + JSON.stringify(correction) + '\n```' });

    await expect(getGrammarCorrection('I goes home')).resolves.toEqual(correction);
  });

  test('throws a clear error when the response is not JSON', async () => {
    mockGenerate.mockResolvedValueOnce({ text: 'Sure! Here is the correction: I go home' });

    await expect(getGrammarCorrection('I goes home')).rejects.toThrow('AI returned an unparseable response');
  });

  test('propagates quota errors without retrying', async () => {
    mockGenerate.mockRejectedValueOnce(apiError(429));

    await expect(getGrammarCorrection('I goes home')).rejects.toMatchObject({ isQuotaError: true });
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });
});
