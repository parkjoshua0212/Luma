export default {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/integration/env.js'],
  globalSetup: '<rootDir>/tests/integration/globalSetup.js',
};
