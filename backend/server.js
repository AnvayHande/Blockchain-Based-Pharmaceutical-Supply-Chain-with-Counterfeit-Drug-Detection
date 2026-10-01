/**
 * PharmaChain Backend — Express API
 *
 * IMPORTANT: This backend stores DESCRIPTIVE metadata only.
 * The smart contract is the single source of truth for ownership,
 * status, and authenticity. Backend data is NOT authoritative.
 * Integrity is proven by comparing metadataHash (on-chain) with
 * a keccak256 hash recomputed from backend data.
 */

import express  from 'express';
import cors     from 'cors';
import fs       from 'fs';
import path     from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Config ────────────────────────────────────────────────────────
const PORT             = parseInt(process.env.PORT || '3001', 10);
const FRONTEND_ORIGIN  = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const SCAN_THRESHOLD   = parseInt(process.env.SCAN_WARNING_THRESHOLD || '50', 10);

// ── File paths ────────────────────────────────────────────────────
const PHARMA_FILE  = path.join(__dirname, 'pharma.json');
const SCANS_FILE   = path.join(__dirname, 'scans.json');
const REPORTS_FILE = path.join(__dirname, 'reports.json');

// ── Atomic file helpers ───────────────────────────────────────────
function readJson(filePath, defaultVal = {}) {
  try {
    if (!fs.existsSync(filePath)) return defaultVal;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return defaultVal;
  }
}

function writeJson(filePath, data) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, filePath);   // atomic on same filesystem
}

// ── Ensure data files exist ───────────────────────────────────────
[PHARMA_FILE, SCANS_FILE, REPORTS_FILE].forEach(f => {
  if (!fs.existsSync(f)) writeJson(f, {});
});

// ── Simple in-memory rate limiter ─────────────────────────────────
const rateLimitMap = new Map(); // ip → { count, resetAt }
const RATE_LIMIT = 60;          // requests per window
const RATE_WINDOW = 60_000;     // 1 minute

function rateLimit(req, res, next) {
  const ip  = req.ip || 'unknown';
  const now = Date.now();
  let entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_WINDOW };
    rateLimitMap.set(ip, entry);
  }
  entry.count++;
  if (entry.count > RATE_LIMIT) {
    return res.status(429).json({ error: 'Too many requests — please wait a minute' });
  }
  next();
}

// ── Allowed metadata fields (whitelist) ───────────────────────────
const ALLOWED_METADATA_FIELDS = new Set([
  'batchId', 'medicineName', 'genericName', 'strength', 'dosageForm',
  'quantity', 'unitType', 'manufactureDate', 'expiryDate',
  'licenceNumber', 'mrp', 'storageInstructions', 'documentCID',
  'manufacturerAddress', 'createdAt',
]);

// ── App setup ─────────────────────────────────────────────────────
const app = express();

app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json({ limit: '64kb' }));

// ── Health ────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Metadata ─────────────────────────────────────────────────────

/**
 * GET /api/metadata/:batchId
 * Returns the stored metadata object or 404.
 */
app.get('/api/metadata/:batchId', (req, res) => {
  const { batchId } = req.params;
  const db = readJson(PHARMA_FILE);
  const record = db[batchId];
  if (!record) {
    return res.status(404).json({ error: 'Metadata not found for this batch ID' });
  }
  res.json(record);
});

/**
 * POST /api/metadata
 * Save medicine metadata. batchId is required. Only whitelisted fields stored.
 * The canonical JSON is stored exactly as hashed by the frontend.
 */
app.post('/api/metadata', rateLimit, (req, res) => {
  const body = req.body;

  if (!body || !body.batchId) {
    return res.status(400).json({ error: 'batchId is required' });
  }

  // Strip unknown fields
  const cleaned = {};
  for (const key of ALLOWED_METADATA_FIELDS) {
    if (body[key] !== undefined) cleaned[key] = body[key];
  }
  cleaned.batchId = body.batchId; // ensure batchId is always there

  // Store in canonical (sorted) key order so hash is deterministic
  const canonical = {};
  Object.keys(cleaned).sort().forEach(k => { canonical[k] = cleaned[k]; });

  const db = readJson(PHARMA_FILE);
  db[body.batchId] = canonical;
  writeJson(PHARMA_FILE, db);

  res.json({ success: true, batchId: body.batchId });
});

// ── Scan log ──────────────────────────────────────────────────────

/**
 * POST /api/scans
 * Log a verification scan. No personal data / no IP stored.
 * Returns { totalScans, warning? }
 */
app.post('/api/scans', rateLimit, (req, res) => {
  const { batchId, verdict } = req.body || {};
  if (!batchId) {
    return res.status(400).json({ error: 'batchId is required' });
  }

  const db     = readJson(SCANS_FILE);
  const entry  = db[batchId] || { totalScans: 0, lastScanAt: null };
  entry.totalScans++;
  entry.lastScanAt = new Date().toISOString();
  if (verdict) entry.lastVerdict = verdict;
  db[batchId] = entry;
  writeJson(SCANS_FILE, db);

  const response = { totalScans: entry.totalScans };
  if (entry.totalScans > SCAN_THRESHOLD) {
    response.warning = `This batch has been scanned ${entry.totalScans} times — the label may have been copied.`;
  }
  res.json(response);
});

/**
 * GET /api/scans/:batchId
 * Returns scan statistics for a batch.
 */
app.get('/api/scans/:batchId', (req, res) => {
  const { batchId } = req.params;
  const db    = readJson(SCANS_FILE);
  const entry = db[batchId] || { totalScans: 0, lastScanAt: null };
  res.json(entry);
});

// ── Reports ───────────────────────────────────────────────────────

/**
 * POST /api/reports
 * Submit a counterfeit report (for users without a wallet).
 * Does NOT store IP or personal identification.
 */
app.post('/api/reports', rateLimit, (req, res) => {
  const { batchId, details, contact } = req.body || {};
  if (!batchId || !details) {
    return res.status(400).json({ error: 'batchId and details are required' });
  }
  if (details.length > 280) {
    return res.status(400).json({ error: 'Details must be 280 characters or fewer' });
  }

  const db     = readJson(REPORTS_FILE);
  const list   = db[batchId] || [];
  list.push({
    batchId,
    details,
    contact: contact || null,  // optional, user-supplied
    reportedAt: new Date().toISOString(),
  });
  db[batchId] = list;
  writeJson(REPORTS_FILE, db);

  res.json({ success: true, message: 'Report received' });
});

/**
 * GET /api/reports
 * Admin use — list all counterfeit reports.
 */
app.get('/api/reports', (_req, res) => {
  const db = readJson(REPORTS_FILE);
  res.json(db);
});

/**
 * GET /api/reports/:batchId
 * Reports for a specific batch.
 */
app.get('/api/reports/:batchId', (req, res) => {
  const { batchId } = req.params;
  const db   = readJson(REPORTS_FILE);
  const list = db[batchId] || [];
  res.json(list);
});

// ── 404 fallback ─────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Error handler ─────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`PharmaChain backend running on http://localhost:${PORT}`);
  console.log(`CORS allowed origin: ${FRONTEND_ORIGIN}`);
  console.log(`Scan warning threshold: ${SCAN_THRESHOLD}`);
});
