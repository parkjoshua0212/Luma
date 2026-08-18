import { isValidPassword, isValidMode } from '../utils/validators.js';

describe('isValidPassword', () => {
  test('rejects passwords under 8 characters', () => {
    expect(isValidPassword('short')).toBe(false);
  });

  test('accepts passwords 8 characters or longer', () => {
    expect(isValidPassword('longenough')).toBe(true);
  });

  test('rejects non-string input', () => {
    expect(isValidPassword(12345678)).toBe(false);
  });

  test('rejects undefined', () => {
    expect(isValidPassword(undefined)).toBe(false);
  });
});

describe('isValidMode', () => {
  test('accepts "formal"', () => {
    expect(isValidMode('formal')).toBe(true);
  });

  test('accepts "casual"', () => {
    expect(isValidMode('casual')).toBe(true);
  });

  test('rejects anything else', () => {
    expect(isValidMode('sarcastic')).toBe(false);
    expect(isValidMode('')).toBe(false);
    expect(isValidMode(undefined)).toBe(false);
  });
});