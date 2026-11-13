// Runs the unit and integration suites together so coverage is reported as a
// single combined number. Each project keeps its own setup from its config.
export default {
  projects: ['<rootDir>/jest.config.mjs', '<rootDir>/jest.integration.config.mjs'],
  collectCoverage: true,
  collectCoverageFrom: [
    'app.js',
    'swagger.js',
    '{controllers,db,lib,middleware,routes,utils}/**/*.js',
    '!db/test-connection.js',
  ],
  coverageReporters: ['text', 'text-summary', 'lcov'],
};
