/**
 * lib/contract.js — Contract helpers.
 *
 * getReadContract()       → read-only contract (JsonRpcProvider, no wallet required)
 * getWriteContract(signer) → writable contract (for role pages)
 *
 * This separation ensures the public Verify page never requires MetaMask.
 */
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../contracts/config';

const RPC_URL = import.meta.env.VITE_RPC_URL || 'http://127.0.0.1:8545';

let _readProvider = null;

/** Returns a read-only ethers.Contract backed by JsonRpcProvider (no wallet). */
export function getReadContract() {
  if (!_readProvider) {
    _readProvider = new ethers.JsonRpcProvider(RPC_URL);
  }
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, _readProvider);
}

/** Returns a writable ethers.Contract backed by the given signer (MetaMask). */
export function getWriteContract(signer) {
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
}
