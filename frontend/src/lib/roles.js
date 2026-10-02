/**
 * lib/roles.js — Single source of truth for role hashes.
 * All role hashes are computed with ethers.id() (keccak256 of the string).
 * Never hard-code hex hash strings in components — import from here instead.
 */
import { ethers } from 'ethers';

export const ROLES = {
  ADMIN:        '0x0000000000000000000000000000000000000000000000000000000000000000',
  MANUFACTURER: ethers.id('MANUFACTURER_ROLE'),
  DISTRIBUTOR:  ethers.id('DISTRIBUTOR_ROLE'),
  WHOLESALER:   ethers.id('WHOLESALER_ROLE'),
  PHARMACY:     ethers.id('PHARMACY_ROLE'),
};

/** Map from role hash → human-readable name */
export const ROLE_NAMES = {
  [ROLES.ADMIN]:        'Admin',
  [ROLES.MANUFACTURER]: 'Manufacturer',
  [ROLES.DISTRIBUTOR]:  'Distributor',
  [ROLES.WHOLESALER]:   'Wholesaler',
  [ROLES.PHARMACY]:     'Pharmacy',
};

/** Map from role hash → route path */
export const ROLE_ROUTES = {
  [ROLES.ADMIN]:        '/admin',
  [ROLES.MANUFACTURER]: '/manufacturer',
  [ROLES.DISTRIBUTOR]:  '/distributor',
  [ROLES.WHOLESALER]:   '/wholesaler',
  [ROLES.PHARMACY]:     '/pharmacy',
};

/** Medicine status index → label */
export const STATUS_LABELS = [
  'REGISTERED',     // 0
  'IN TRANSIT',     // 1
  'AT DISTRIBUTOR', // 2
  'AT WHOLESALER',  // 3
  'AT PHARMACY',    // 4
  'SOLD',           // 5
  'RECALLED',       // 6
  'EXPIRED',        // 7
];

/** Get role name from hash (safe fallback) */
export function getRoleName(roleHash) {
  return ROLE_NAMES[roleHash] ?? 'Unknown';
}

/** Get route from role hash (safe fallback) */
export function getRoleRoute(roleHash) {
  return ROLE_ROUTES[roleHash] ?? '/';
}

/** Get status label from numeric index */
export function getStatusLabel(statusIndex) {
  return STATUS_LABELS[Number(statusIndex)] ?? 'UNKNOWN';
}
