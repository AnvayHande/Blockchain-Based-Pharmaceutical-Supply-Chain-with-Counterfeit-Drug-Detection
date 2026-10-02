/**
 * lib/api.js — All backend calls in one place.
 * Uses VITE_BACKEND_URL env variable (defaults to http://localhost:3001).
 * No raw fetch calls should appear in components — use these helpers.
 */

const BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.error || 'Request failed'), { status: res.status });
  }
  return res.json();
}

// ── Metadata ──────────────────────────────────────────────────────

/** Fetch metadata for a batchId. Throws with status 404 if not found. */
export function getMetadata(batchId) {
  return req('GET', `/api/metadata/${encodeURIComponent(batchId)}`);
}

/**
 * Save metadata for a batch.
 * @param {string} batchId
 * @param {object} metadata — all medicine detail fields
 */
export function saveMetadata(batchId, metadata) {
  return req('POST', '/api/metadata', { batchId, ...metadata });
}

// ── Scans ─────────────────────────────────────────────────────────

/** Log a scan event. Returns { totalScans, warning? } */
export function logScan(batchId, verdict) {
  return req('POST', '/api/scans', { batchId, verdict });
}

/** Get scan statistics for a batch. */
export function getScanStats(batchId) {
  return req('GET', `/api/scans/${encodeURIComponent(batchId)}`);
}

// ── Reports ───────────────────────────────────────────────────────

/** Submit a counterfeit report (no wallet). */
export function submitReport(batchId, details, contact) {
  return req('POST', '/api/reports', { batchId, details, contact });
}

/** Get all reports (admin). */
export function getAllReports() {
  return req('GET', '/api/reports');
}

/** Get reports for a specific batch. */
export function getBatchReports(batchId) {
  return req('GET', `/api/reports/${encodeURIComponent(batchId)}`);
}
