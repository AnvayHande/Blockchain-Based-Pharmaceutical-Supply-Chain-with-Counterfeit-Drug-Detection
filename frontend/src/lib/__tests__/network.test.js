import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isCorrectNetwork, normalizeChainId } from '../network';

describe('network utility', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_CHAIN_ID', '11155111');
  });

  it('normalizes hex strings correctly', () => {
    expect(normalizeChainId('0xaa36a7')).toBe(11155111);
  });

  it('isCorrectNetwork handles number inputs', () => {
    expect(isCorrectNetwork(11155111)).toBe(true);
    expect(isCorrectNetwork(1)).toBe(false);
  });

  it('isCorrectNetwork handles string inputs', () => {
    expect(isCorrectNetwork('11155111')).toBe(true);
    expect(isCorrectNetwork('1')).toBe(false);
  });

  it('isCorrectNetwork handles hex inputs', () => {
    expect(isCorrectNetwork('0xaa36a7')).toBe(true);
    expect(isCorrectNetwork('0x1')).toBe(false);
  });

  it('isCorrectNetwork handles bigint inputs', () => {
    expect(isCorrectNetwork(11155111n)).toBe(true);
    expect(isCorrectNetwork(1n)).toBe(false);
  });
});
