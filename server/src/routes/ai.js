const express = require('express');
const { z } = require('zod');
const { ah } = require('../middleware/errors');
const { requireRole } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimits');
const { DISTRICTS } = require('../constants');
const { runAnalysis } = require('../services/aiAssistant');
const { providerStatus } = require('../services/ai');

const router = express.Router();

const schema = z.object({
  subject: z.string().trim().max(200).default(''),
  description: z.string().trim().min(20, 'Describe the issue in at least 20 characters for AI analysis').max(5000),
  district: z.enum(DISTRICTS.map((d) => d.name)).optional(),
});

/** AI Grievance Assistant — returns suggestions only; nothing is changed on any grievance. */
router.post('/analyze', requireRole('citizen', 'cmo_admin'), aiLimiter, ah(async (req, res) => {
  const input = schema.parse(req.body);
  const analysis = await runAnalysis(input, { userId: req.user.id });
  res.json({ analysis });
}));

router.get('/status', (req, res) => res.json(providerStatus()));

module.exports = router;
