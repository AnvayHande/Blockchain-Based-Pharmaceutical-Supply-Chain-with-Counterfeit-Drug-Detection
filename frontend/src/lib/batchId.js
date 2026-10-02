/**
 * lib/batchId.js — Batch ID generation utilities.
 *
 * Format: PHM-<ORG3>-<MED3>-<YYYYMMDD>-<SEQ>
 * Example: PHM-CIP-PAR-20260929-003
 *
 * <ORG3> = first 3 chars of organizationName, uppercased
 * <MED3> = first 3 chars of medicineName, uppercased
 * <SEQ>  = zero-padded 3-digit sequence number (001, 002, …)
 */

/**
 * Generate a candidate batch ID.
 * @param {string} orgName      e.g. "CiplaPharm"
 * @param {string} medicineName e.g. "Paracetamol"
 * @param {string} datePart     e.g. "20260929"
 * @param {number} seq          sequence number (1-based)
 * @returns {string}
 */
export function generateBatchId(orgName, medicineName, datePart, seq) {
  const orgSlug = orgName.substring(0, 3).toUpperCase();
  const medSlug = medicineName.substring(0, 3).toUpperCase();
  const seqStr  = String(seq).padStart(3, '0');
  return `PHM-${orgSlug}-${medSlug}-${datePart}-${seqStr}`;
}

/**
 * Get today's date as YYYYMMDD string.
 */
export function todayPart() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * Auto-generate a unique batch ID by checking the contract.
 * Increments SEQ until an unused ID is found (max 999 tries).
 *
 * @param {object} contract    — ethers.Contract read instance
 * @param {string} orgName
 * @param {string} medicineName
 * @returns {Promise<string>}  the first unused batch ID
 */
export async function autoGenerateBatchId(contract, orgName, medicineName) {
  const date = todayPart();
  for (let seq = 1; seq <= 999; seq++) {
    const id = generateBatchId(orgName, medicineName, date, seq);
    const batch = await contract.verifyMedicine(id);
    if (!batch.exists) return id;
  }
  throw new Error('Could not find an unused batch ID — too many batches today');
}
