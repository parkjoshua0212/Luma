export function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 8;
}

export function isValidMode(mode) {
  return mode === 'formal' || mode === 'casual';
}