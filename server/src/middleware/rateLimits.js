const rateLimit = require('express-rate-limit');
const config = require('../config');

const make = (windowMs, limit) =>
  rateLimit({
    windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false,
    skip: () => config.isTest,
    message: { error: 'Too many requests, please try again later.' },
  });

module.exports = {
  authLimiter: make(15 * 60 * 1000, 30),
  aiLimiter: make(60 * 1000, 12),
  contactLimiter: make(60 * 60 * 1000, 10),
  apiLimiter: make(60 * 1000, 300),
};
