import { isValidPassword, isValidMode, isValidLength } from '../utils/validators.js';

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

describe('isValidLength', () => {
  test('accepts text within the limit', () => {
    expect(isValidLength('hello', 10)).toBe(true);
  });

  test('accepts text exactly at the limit', () => {
    expect(isValidLength('hello', 5)).toBe(true);
  });

  test('rejects text over the limit', () => {
    expect(isValidLength('hello world', 5)).toBe(false);
  });

  test('rejects empty string', () => {
    expect(isValidLength('', 10)).toBe(false);
  });

  test('rejects a string that is only whitespace', () => {
    expect(isValidLength('    ', 10)).toBe(false);
  });

  test('rejects non-string input', () => {
    expect(isValidLength(12345, 10)).toBe(false);
    expect(isValidLength(undefined, 10)).toBe(false);
    expect(isValidLength(null, 10)).toBe(false);
  });
});