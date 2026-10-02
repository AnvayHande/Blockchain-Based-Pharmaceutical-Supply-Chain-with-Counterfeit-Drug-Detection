/**
 * lib/verdict.js — Pure, unit-testable verdict computation.
 *
 * computeVerdict(batch, metadataCheck, now) → verdict object
 *
 * The verdict is determined by checking conditions in a fixed priority order
 * as defined in the task specification (M7).
 *
 * This module has NO side effects and NO imports — safe to test in Node.js.
 */

/** Verdict types */
export const VERDICT = {
  ERROR:                 'ERROR',
  FAKE:                  'FAKE',
  RECALLED:              'RECALLED',
  EXPIRED:               'EXPIRED',
  VERIFIED_NO_DETAILS:   'VERIFIED_NO_DETAILS',
  TAMPERED:              'TAMPERED',
  GENUINE_SOLD:          'GENUINE_SOLD',
  GENUINE:               'GENUINE',
};

/** MedicineStatus enum values (must match Solidity enum order) */
export const STATUS = {
  REGISTERED:     0,
  IN_TRANSIT:     1,
  AT_DISTRIBUTOR: 2,
  AT_WHOLESALER:  3,
  AT_PHARMACY:    4,
  SOLD:           5,
  RECALLED:       6,
  EXPIRED:        7,
};

/**
 * @typedef {object} VerdictResult
 * @property {string}  verdict    — one of VERDICT.*
 * @property {string}  color      — CSS colour class: green | red | orange | yellow | grey | blue
 * @property {string}  title      — Short bold headline
 * @property {string}  message    — Longer explanation shown to the user
 * @property {boolean} isGenuine  — true only for GENUINE or GENUINE_SOLD
 */

/**
 * Compute the authenticity verdict.
 *
 * @param {object|null} batch        — MedicineBatch struct from the contract, or null on RPC error
 * @param {'ok'|'missing'|'tampered'|null} metadataCheck — result of metadata hash comparison
 * @param {number}      now          — current Unix timestamp (seconds), default Date.now()/1000
 * @returns {VerdictResult}
 */
export function computeVerdict(batch, metadataCheck, now = Math.floor(Date.now() / 1000)) {
  // 1. Chain unreachable / RPC error
  if (batch === null || batch === undefined) {
    return {
      verdict:   VERDICT.ERROR,
      color:     'grey',
      title:     'Blockchain Unreachable',
      message:   'Could not reach the blockchain. This result is inconclusive — please retry. Do NOT conclude anything about authenticity from this.',
      isGenuine: false,
    };
  }

  // 2. Batch not found
  if (!batch.exists) {
    return {
      verdict:   VERDICT.FAKE,
      color:     'red',
      title:     'Unregistered / Fake',
      message:   'No manufacturer registered this batch ID. Do not use this medicine. Report it.',
      isGenuine: false,
    };
  }

  const statusNum = Number(batch.status);
  const expiryTs  = Number(batch.expiryDate);

  // 3. Recalled
  if (statusNum === STATUS.RECALLED) {
    return {
      verdict:   VERDICT.RECALLED,
      color:     'red',
      title:     'Recalled ⛔',
      message:   'The manufacturer/authority recalled this batch. Do not use.',
      isGenuine: false,
    };
  }

  // 4. Expired
  if (now > expiryTs) {
    return {
      verdict:   VERDICT.EXPIRED,
      color:     'orange',
      title:     'Expired ⚠️',
      message:   'This batch is past its expiry date. Do not use.',
      isGenuine: false,
    };
  }

  // 5. Metadata missing
  if (metadataCheck === 'missing') {
    return {
      verdict:   VERDICT.VERIFIED_NO_DETAILS,
      color:     'yellow',
      title:     'Verified On-Chain (Details Unavailable)',
      message:   'The batch is recorded on the blockchain but descriptive details are not available from the server.',
      isGenuine: true,
    };
  }

  // 6. Metadata tampered
  if (metadataCheck === 'tampered') {
    return {
      verdict:   VERDICT.TAMPERED,
      color:     'red',
      title:     'Details Tampered ❌',
      message:   'Displayed details do not match the blockchain record. The off-chain data may have been altered.',
      isGenuine: false,
    };
  }

  // 7. Sold
  if (statusNum === STATUS.SOLD) {
    return {
      verdict:   VERDICT.GENUINE_SOLD,
      color:     'blue',
      title:     'Genuine — Already Sold ✅',
      message:   'Registered and genuine. It was already sold by a pharmacy; if you are seeing this on a pack you have NOT bought yet, be careful — the label may have been copied.',
      isGenuine: true,
    };
  }

  // 8. Genuine
  return {
    verdict:   VERDICT.GENUINE,
    color:     'green',
    title:     'Genuine ✅',
    message:   'This batch is registered by a verified manufacturer and its details match the blockchain record.',
    isGenuine: true,
  };
}
