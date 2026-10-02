/**
 * lib/metadata.js — Canonical JSON serialization and metadata hashing.
 *
 * The manufacturer page uses hashMetadata() to compute the hash stored on-chain.
 * The verify page re-computes the same hash from backend data to detect tampering.
 * Both MUST use identical canonicalization — sorted keys, no extra whitespace.
 */
import { ethers } from 'ethers';

/**
 * Serializes an object with keys sorted alphabetically.
 * This ensures the hash is deterministic regardless of key insertion order.
 * @param {object} obj
 * @returns {string} canonical JSON string
 */
export function canonicalize(obj) {
  const sorted = {};
  Object.keys(obj).sort().forEach(k => { sorted[k] = obj[k]; });
  return JSON.stringify(sorted);
}

/**
 * Computes keccak256 of the canonical JSON of the metadata object.
 * @param {object} metadata
 * @returns {string} bytes32 hex string (0x...)
 */
export function hashMetadata(metadata) {
  return ethers.keccak256(ethers.toUtf8Bytes(canonicalize(metadata)));
}

/**
 * Returns the set of fields that should be included in the metadata hash.
 * This list must match what the seed script uses.
 */
export const METADATA_FIELDS = [
  'batchId',
  'medicineName',
  'genericName',
  'strength',
  'dosageForm',
  'quantity',
  'unitType',
  'manufactureDate',
  'expiryDate',
  'licenceNumber',
  'mrp',
  'storageInstructions',
  'documentCID',
  'manufacturerAddress',
  'createdAt',
];

/**
 * Pick only the canonical fields from a metadata object.
 * Used before hashing to ensure consistency.
 */
export function pickCanonicalFields(obj) {
  const picked = {};
  for (const field of METADATA_FIELDS) {
    if (obj[field] !== undefined) picked[field] = obj[field];
  }
  return picked;
}
