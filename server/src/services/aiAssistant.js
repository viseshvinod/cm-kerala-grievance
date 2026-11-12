// Orchestrates an AI analysis: model call + duplicate detection + audit log row.
const { query } = require('../db/pool');
const config = require('../config');
const { analyseComplaint, hashInput } = require('./ai');
const { findSimilar } = require('./similarity');

async function getDepartments() {
  const { rows } = await query('SELECT id, code, name, categories, sla_days FROM departments ORDER BY name');
  return rows;
}

async function findDuplicates({ subject, description, district }, excludeId) {
  const { rows } = await query(
    `SELECT id, reference_no, subject, description, district, status
       FROM grievances
      WHERE created_at > now() - interval '180 days'
        AND ($1::int IS NULL OR id <> $1)
      ORDER BY created_at DESC
      LIMIT 500`,
    [excludeId || null],
  );
  return findSimilar(
    `${subject} ${description}`,
    rows.map((r) => ({ ...r, text: `${r.subject} ${r.description}` })),
    { threshold: config.ai.duplicateThreshold, district },
  );
}

/**
 * Runs the assistant and stores an ai_analyses row.
 * @returns analysis payload safe to send to clients.
 */
async function runAnalysis(input, { userId, grievanceId } = {}) {
  const departments = await getDepartments();
  const [ai, duplicates] = await Promise.all([
    analyseComplaint(input, departments),
    findDuplicates(input, grievanceId),
  ]);
  const dept = departments.find((d) => d.code === ai.result.department_code);
  const { rows } = await query(
    `INSERT INTO ai_analyses (requested_by, grievance_id, input_hash, provider, model, is_fallback, result, duplicates, latency_ms, error)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, created_at`,
    [userId || null, grievanceId || null, hashInput(input), ai.provider, ai.model, ai.isFallback,
      ai.result, JSON.stringify(duplicates), ai.latencyMs, ai.error || null],
  );
  return {
    analysisId: rows[0].id,
    provider: ai.provider,
    model: ai.model,
    isFallback: ai.isFallback,
    latencyMs: ai.latencyMs,
    category: ai.result.category,
    priority: ai.result.priority,
    department: dept ? { id: dept.id, code: dept.code, name: dept.name } : null,
    summary: ai.result.summary,
    rationale: ai.result.rationale,
    keywords: ai.result.keywords,
    confidence: ai.result.confidence,
    duplicates,
    createdAt: rows[0].created_at,
  };
}

module.exports = { runAnalysis, getDepartments, findDuplicates };
