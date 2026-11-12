const { ZodError } = require('zod');
const config = require('../config');

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const notFound = (req, res) => res.status(404).json({ error: 'Not found' });

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `File too large (max ${config.maxUploadBytes / 1048576} MB)` });
  }
  if (err.code === '23505') return res.status(409).json({ error: 'Duplicate record' });
  const status = err.status || 500;
  if (status >= 500 && !config.isTest) console.error(err);
  res.status(status).json({
    error: status >= 500 ? 'Internal server error' : err.message,
    ...(err.details ? { details: err.details } : {}),
  });
}

/** Wrap async route handlers so rejected promises reach the error handler. */
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { HttpError, notFound, errorHandler, ah };
