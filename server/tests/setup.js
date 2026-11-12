process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://cmk:cmk@localhost:5432/cmk_test';
process.env.AI_PROVIDER = 'fallback'; // never call a paid/remote model from tests
