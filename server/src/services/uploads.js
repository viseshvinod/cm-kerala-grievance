const crypto = require('crypto');
const multer = require('multer');
const config = require('../config');
const { HttpError } = require('../middleware/errors');

const ALLOWED = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (b) => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP',
  'application/pdf': (b) => b.slice(0, 5).toString() === '%PDF-',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 3 },
  fileFilter: (req, file, cb) =>
    ALLOWED[file.mimetype] ? cb(null, true) : cb(new HttpError(415, 'Only JPG, PNG, WEBP images or PDF documents are allowed')),
});

/** Verifies the file's magic bytes match its declared type (defends against renamed executables). */
function verifyFile(file) {
  const check = ALLOWED[file.mimetype];
  if (!check || !check(file.buffer)) throw new HttpError(415, `File "${file.originalname}" content does not match its type`);
}

async function saveAttachment(client, { grievanceId, userId, kind, file }) {
  verifyFile(file);
  const safeName = file.originalname.replace(/[^\w.\- ()]/g, '_').slice(0, 200);
  const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
  const { rows } = await client.query(
    `INSERT INTO attachments (grievance_id, uploaded_by, kind, original_name, mime_type, size_bytes, sha256, data)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, kind, original_name, mime_type, size_bytes, created_at`,
    [grievanceId, userId, kind, safeName, file.mimetype, file.size, sha256, file.buffer],
  );
  return rows[0];
}

module.exports = { upload, saveAttachment, verifyFile };
