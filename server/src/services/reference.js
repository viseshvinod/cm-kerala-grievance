const crypto = require('crypto');
const { districtByName } = require('../constants');

// Crockford-style alphabet: no 0/O/1/I/L to avoid transcription errors when read over the phone.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/**
 * Builds a human-friendly, non-sequential reference such as CMK-26-TVM-7K3F9Q.
 * Random suffix (31^6 ≈ 887M combinations) prevents enumeration of other citizens' grievances;
 * uniqueness is enforced by a DB UNIQUE constraint with retry in the caller.
 */
function generateReference(districtName, date = new Date()) {
  const code = districtByName.get(districtName)?.code || 'KER';
  const yy = String(date.getFullYear()).slice(-2);
  const bytes = crypto.randomBytes(6);
  let suffix = '';
  for (const b of bytes) suffix += ALPHABET[b % ALPHABET.length];
  return `CMK-${yy}-${code}-${suffix}`;
}

const REFERENCE_PATTERN = /^CMK-\d{2}-[A-Z]{3}-[2-9A-Z]{6}$/;

module.exports = { generateReference, REFERENCE_PATTERN };
