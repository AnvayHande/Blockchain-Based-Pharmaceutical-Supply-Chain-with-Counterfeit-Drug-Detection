/**
 * Frontend unit tests — run with: npx vitest run
 *
 * Covers:
 * - computeVerdict: all 8 rows of the verdict table
 * - canonicalize/hashMetadata: determinism
 * - Batch ID generation: sequencing
 */
import { describe, it, expect } from 'vitest';
import { computeVerdict, VERDICT, STATUS } from '../verdict.js';
import { canonicalize, hashMetadata } from '../metadata.js';
import { generateBatchId } from '../batchId.js';

// ── Helpers ───────────────────────────────────────────────────────
const NOW = 1_700_000_000; // fixed timestamp for determinism
const FUTURE = NOW + 86400 * 365;
const PAST   = NOW - 86400;

function makeBatch(overrides = {}) {
  return {
    batchId:         'TEST-001',
    medicineName:    'Paracetamol',
    manufacturer:    '0xABC',
    manufactureDate: BigInt(NOW - 86400 * 10),
    expiryDate:      BigInt(FUTURE),
    quantity:        100n,
    metadataHash:    '0x' + '0'.repeat(64),
    currentOwner:    '0xDEF',
    status:          BigInt(STATUS.REGISTERED),
    documentCID:     '',
    exists:          true,
    ...overrides,
  };
}

// ── computeVerdict tests ──────────────────────────────────────────
describe('computeVerdict', () => {
  it('returns ERROR when batch is null (RPC error)', () => {
    const r = computeVerdict(null, null, NOW);
    expect(r.verdict).toBe(VERDICT.ERROR);
    expect(r.color).toBe('grey');
    expect(r.isGenuine).toBe(false);
    // Must NOT say "fake" on a network error
    expect(r.message.toLowerCase()).not.toContain('fake');
  });

  it('returns FAKE when exists is false', () => {
    const r = computeVerdict({ exists: false }, null, NOW);
    expect(r.verdict).toBe(VERDICT.FAKE);
    expect(r.color).toBe('red');
    expect(r.isGenuine).toBe(false);
  });

  it('returns RECALLED for recalled batch', () => {
    const r = computeVerdict(makeBatch({ status: BigInt(STATUS.RECALLED) }), 'ok', NOW);
    expect(r.verdict).toBe(VERDICT.RECALLED);
    expect(r.color).toBe('red');
    expect(r.isGenuine).toBe(false);
  });

  it('returns EXPIRED when now > expiryDate', () => {
    const r = computeVerdict(
      makeBatch({ expiryDate: BigInt(PAST) }),
      'ok',
      NOW
    );
    expect(r.verdict).toBe(VERDICT.EXPIRED);
    expect(r.color).toBe('orange');
    expect(r.isGenuine).toBe(false);
  });

  it('RECALLED takes priority over EXPIRED', () => {
    const r = computeVerdict(
      makeBatch({ status: BigInt(STATUS.RECALLED), expiryDate: BigInt(PAST) }),
      'ok',
      NOW
    );
    expect(r.verdict).toBe(VERDICT.RECALLED);
  });

  it('returns VERIFIED_NO_DETAILS when metadata is missing', () => {
    const r = computeVerdict(makeBatch(), 'missing', NOW);
    expect(r.verdict).toBe(VERDICT.VERIFIED_NO_DETAILS);
    expect(r.color).toBe('yellow');
    expect(r.isGenuine).toBe(true);
  });

  it('returns TAMPERED when metadata hash does not match', () => {
    const r = computeVerdict(makeBatch(), 'tampered', NOW);
    expect(r.verdict).toBe(VERDICT.TAMPERED);
    expect(r.color).toBe('red');
    expect(r.isGenuine).toBe(false);
  });

  it('returns GENUINE_SOLD for a sold batch with matching metadata', () => {
    const r = computeVerdict(
      makeBatch({ status: BigInt(STATUS.SOLD) }),
      'ok',
      NOW
    );
    expect(r.verdict).toBe(VERDICT.GENUINE_SOLD);
    expect(r.color).toBe('blue');
    expect(r.isGenuine).toBe(true);
    expect(r.message).toContain('copied');
  });

  it('returns GENUINE for a valid batch with matching metadata', () => {
    const r = computeVerdict(makeBatch(), 'ok', NOW);
    expect(r.verdict).toBe(VERDICT.GENUINE);
    expect(r.color).toBe('green');
    expect(r.isGenuine).toBe(true);
  });

  it('does not return FAKE on a network error (critical safety rule)', () => {
    const r = computeVerdict(undefined, null, NOW);
    expect(r.verdict).not.toBe(VERDICT.FAKE);
    expect(r.verdict).toBe(VERDICT.ERROR);
  });
});

// ── canonicalize / hashMetadata tests ────────────────────────────
describe('canonicalize', () => {
  it('sorts keys alphabetically', () => {
    const result = canonicalize({ z: 1, a: 2, m: 3 });
    const parsed = JSON.parse(result);
    expect(Object.keys(parsed)).toEqual(['a', 'm', 'z']);
  });

  it('produces the same string regardless of insertion order', () => {
    const a = canonicalize({ batchId: 'B1', name: 'X', qty: 10 });
    const b = canonicalize({ qty: 10, name: 'X', batchId: 'B1' });
    expect(a).toBe(b);
  });
});

describe('hashMetadata', () => {
  it('is deterministic — same input → same hash', () => {
    const meta = { batchId: 'PHM-001', medicineName: 'Paracetamol', quantity: 100 };
    expect(hashMetadata(meta)).toBe(hashMetadata(meta));
  });

  it('different key order does NOT change the hash', () => {
    const h1 = hashMetadata({ batchId: 'B', name: 'X' });
    const h2 = hashMetadata({ name: 'X', batchId: 'B' });
    expect(h1).toBe(h2);
  });

  it('different values produce different hashes', () => {
    const h1 = hashMetadata({ batchId: 'B1' });
    const h2 = hashMetadata({ batchId: 'B2' });
    expect(h1).not.toBe(h2);
  });

  it('returns a 0x-prefixed 66-char hex string (bytes32)', () => {
    const h = hashMetadata({ batchId: 'TEST' });
    expect(h).toMatch(/^0x[0-9a-f]{64}$/i);
  });
});

// ── Batch ID generation tests ─────────────────────────────────────
describe('generateBatchId', () => {
  it('follows the PHM-ORG3-MED3-YYYYMMDD-SEQ format', () => {
    const id = generateBatchId('CiplaPharm', 'Paracetamol', '20260929', 1);
    expect(id).toBe('PHM-CIP-PAR-20260929-001');
  });

  it('pads sequence number to 3 digits', () => {
    expect(generateBatchId('A', 'B', '20260101', 7)).toBe('PHM-A-B-20260101-007');
    expect(generateBatchId('A', 'B', '20260101', 42)).toBe('PHM-A-B-20260101-042');
    expect(generateBatchId('A', 'B', '20260101', 999)).toBe('PHM-A-B-20260101-999');
  });

  it('uppercases org and medicine slugs', () => {
    const id = generateBatchId('cipla', 'paracetamol', '20260929', 1);
    expect(id).toMatch(/PHM-CIP-PAR-/);
  });

  it('truncates to 3 chars for org and medicine', () => {
    const id = generateBatchId('CiplaPharmaceuticals', 'ParacetamolExtra', '20260929', 1);
    expect(id).toBe('PHM-CIP-PAR-20260929-001');
  });

  it('handles short org/medicine names', () => {
    const id = generateBatchId('AB', 'XY', '20260929', 1);
    expect(id).toBe('PHM-AB-XY-20260929-001');
  });
});
