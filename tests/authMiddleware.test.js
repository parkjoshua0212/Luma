import { jest } from '@jest/globals';

// Replace the real jsonwebtoken module with a fake one we control,
// so we can decide what jwt.verify() returns without needing a real token.
const mockVerify = jest.fn();
jest.unstable_mockModule('jsonwebtoken', () => ({
  default: { verify: mockVerify }
}));

// Must import AFTER the mock is registered
const { requireAuth } = await import('../middleware/authMiddleware.js');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('requireAuth middleware', () => {
  beforeEach(() => {
    mockVerify.mockReset();
  });

  test('rejects requests with no Authorization header', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects a header that is not "Bearer <token>"', () => {
    const req = { headers: { authorization: 'Basic sometoken' } };
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects an invalid or expired token', () => {
    mockVerify.mockImplementation(() => {
      throw new Error('jwt expired');
    });
    const req = { headers: { authorization: 'Bearer badtoken' } };
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('attaches userId to the request and calls next() on a valid token', () => {
    mockVerify.mockReturnValue({ userId: 42 });
    const req = { headers: { authorization: 'Bearer goodtoken' } };
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(req.userId).toBe(42);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});