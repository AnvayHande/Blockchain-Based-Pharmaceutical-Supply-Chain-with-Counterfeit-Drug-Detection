export function isCorrectNetwork(chainId) {
  if (chainId === null || chainId === undefined) return false;
  const target = Number(import.meta.env.VITE_CHAIN_ID || 11155111);
  let current;
  if (typeof chainId === 'string' && chainId.startsWith('0x')) {
    current = parseInt(chainId, 16);
  } else {
    current = Number(chainId);
  }
  return current === target;
}

export function normalizeChainId(chainId) {
  if (chainId === null || chainId === undefined) return null;
  if (typeof chainId === 'string' && chainId.startsWith('0x')) {
    return parseInt(chainId, 16);
  }
  return Number(chainId);
}
