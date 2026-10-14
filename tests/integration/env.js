// Hardcoded on purpose: overrides anything in the shell, so these tests can
// never reach the real Neon database or the real Gemini API.
process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/luma_test';
process.env.DB_SSL = 'false';
process.env.JWT_SECRET = 'test-secret';
process.env.GEMINI_API_KEY = 'unused';
process.env.AUTH_RATE_LIMIT_MAX = '1000';
