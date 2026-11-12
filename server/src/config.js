require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env'), quiet: true });

const env = process.env;
const isProd = env.NODE_ENV === 'production';

if (isProd && (!env.JWT_SECRET || env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be set to a random string of at least 32 characters in production');
}

module.exports = {
  isProd,
  isTest: env.NODE_ENV === 'test',
  port: Number(env.PORT) || 4000,
  databaseUrl: env.DATABASE_URL || 'postgres://cmk:cmk@localhost:5432/cmk_grievance',
  databaseSsl: env.DATABASE_SSL === 'true',
  jwtSecret: env.JWT_SECRET || 'dev-only-insecure-secret-change-me-please-0000',
  jwtExpiresIn: env.JWT_EXPIRES_IN || '8h',
  corsOrigin: env.CORS_ORIGIN || '',
  seedOnStart: env.SEED_ON_START !== 'false',
  maxUploadBytes: (Number(env.MAX_UPLOAD_MB) || 5) * 1024 * 1024,
  defaultSlaDays: Number(env.DEFAULT_SLA_DAYS) || 15,
  ai: {
    provider: (env.AI_PROVIDER || 'auto').toLowerCase(), // auto | gemini | openai | anthropic | fallback
    timeoutMs: Number(env.AI_TIMEOUT_MS) || 20000,
    geminiKey: env.GEMINI_API_KEY || '',
    geminiModel: env.GEMINI_MODEL || 'gemini-2.5-flash',
    openaiKey: env.OPENAI_API_KEY || '',
    openaiBaseUrl: (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    openaiModel: env.OPENAI_MODEL || 'gpt-4o-mini',
    anthropicKey: env.ANTHROPIC_API_KEY || '',
    anthropicModel: env.ANTHROPIC_MODEL || 'claude-haiku-4-5',
    duplicateThreshold: Number(env.AI_DUPLICATE_THRESHOLD) || 0.42,
  },
};
