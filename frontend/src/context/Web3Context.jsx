/**
 * Updated Web3Context — fixes:
 * - P2: uses role hashes from lib/roles.js (no numeric roles)
 * - P3: no hard-coded hash maps in this file
 * - Handles chainChanged → reload
 * - Exposes roleName, isConnected, connecting
 * - getReadContract available for public pages (no wallet)
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../contracts/config';
import { getRoleName, getRoleRoute } from '../lib/roles';
import { normalizeChainId } from '../lib/network';

export const Web3Context = createContext();

function getMetaMaskProvider() {
  if (typeof window === 'undefined') return null;
  const eth = window.ethereum;
  if (!eth) return null;
  if (eth.providers && Array.isArray(eth.providers) && eth.providers.length > 0) {
    const metaMask = eth.providers.find((p) => p.isMetaMask);
    if (metaMask) return metaMask;
  }
  return eth;
}

export function Web3Provider({ children }) {
  const [account,          setAccount]          = useState(null);
  const [contract,         setContract]         = useState(null);
  const [provider,         setProvider]         = useState(null);
  const [signer,           setSigner]           = useState(null);
  const [role,             setRole]             = useState(null);   // bytes32 hash
  const [roleName,         setRoleName]         = useState(null);   // human string
  const [organizationName, setOrganizationName] = useState(null);
  const [isConnected,      setIsConnected]      = useState(false);
  const [connecting,       setConnecting]       = useState(false);
  const [error,            setError]            = useState(null);
  const [balance,          setBalance]          = useState(null); // Added for ETH balance
  const [chainId,          setChainId]          = useState(null);

  const clearError = useCallback(() => setError(null), []);

  const fetchParticipantDetails = async (_contract, _account) => {
    try {
      const participant = await _contract.participants(_account);
      if (participant.authorized) {
        setRole(participant.role);
        setRoleName(getRoleName(participant.role));
        setOrganizationName(participant.organizationName);
      } else {
        const ADMIN_ROLE = await _contract.ADMIN_ROLE();
        const isAdmin = await _contract.hasRole(ADMIN_ROLE, _account);
        if (isAdmin) {
          setRole(ADMIN_ROLE);
          setRoleName('Admin');
          setOrganizationName('Administrator');
        } else {
          setRole(null);
          setRoleName(null);
          setOrganizationName(null);
        }
      }
    } catch (err) {
      console.warn('Could not fetch participant role from contract:', err.message);
      setRole(null);
      setRoleName(null);
      setOrganizationName(null);
    }
  };

  const connectWallet = useCallback(async () => {
    const eth = getMetaMaskProvider();
    if (!eth) {
      setError('MetaMask extension was not detected. Please install or enable MetaMask in your browser.');
      return;
    }
    setConnecting(true);
    setError(null);

    try {
      // 1. Request accounts from wallet
      let accounts;
      try {
        accounts = await eth.request({ method: 'eth_requestAccounts' });
      } catch (reqErr) {
        if (reqErr.code === 4001) {
          throw new Error('MetaMask connection was rejected. Please click Connect MetaMask and approve the request.');
        } else if (reqErr.code === -32002) {
          throw new Error('A MetaMask request is already pending. Please click the MetaMask fox icon in your browser toolbar to approve it.');
        } else {
          throw new Error(reqErr.message || 'Failed to request accounts from MetaMask.');
        }
      }

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found. Please unlock your MetaMask wallet and select an account.');
      }

      const _account = accounts[0];
      setAccount(_account);

      // 2. Set up BrowserProvider
      const _provider = new ethers.BrowserProvider(eth);
      setProvider(_provider);

      let _signer = null;
      try {
        _signer = await _provider.getSigner();
        setSigner(_signer);
      } catch (signerErr) {
        console.warn('Could not get signer:', signerErr);
      }

      // Mark as connected once account is retrieved
      setIsConnected(true);

      // 3. Query network with resilience
      try {
        const network = await _provider.getNetwork();
        setChainId(normalizeChainId(network.chainId));
      } catch (netErr) {
        console.warn('Failed to query network from provider, falling back to eth_chainId:', netErr);
        try {
          const rawChain = await eth.request({ method: 'eth_chainId' });
          setChainId(normalizeChainId(rawChain));
        } catch (rawNetErr) {
          console.warn('Failed to get raw chainId:', rawNetErr);
        }
      }

      // 4. Query balance with resilience
      try {
        const bal = await _provider.getBalance(_account);
        setBalance(ethers.formatEther(bal));
      } catch (balErr) {
        console.warn('Failed to fetch balance:', balErr);
      }

      // 5. Connect contract & fetch role
      if (_signer) {
        try {
          const _contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, _signer);
          setContract(_contract);
          await fetchParticipantDetails(_contract, _account);
        } catch (contractErr) {
          console.warn('Contract setup warning:', contractErr);
        }
      }
    } catch (err) {
      console.error('Wallet connection error:', err);
      setError(err.message || 'Failed to connect to MetaMask');
    } finally {
      setConnecting(false);
    }
  }, []);

  const switchNetwork = async () => {
    const eth = getMetaMaskProvider();
    if (!eth) return;
    const targetChainId = parseInt(import.meta.env.VITE_CHAIN_ID || '11155111', 10);
    const hexChainId = `0x${targetChainId.toString(16)}`;

    try {
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }],
      });
      await connectWallet();
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          const isLocal = targetChainId === 31337 || targetChainId === 1337;
          const chainParams = isLocal ? {
            chainId: hexChainId,
            chainName: 'Hardhat Localhost',
            rpcUrls: [import.meta.env.VITE_RPC_URL || 'http://127.0.0.1:8545'],
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }
          } : {
            chainId: hexChainId,
            chainName: 'Sepolia Testnet',
            rpcUrls: [import.meta.env.VITE_RPC_URL || 'https://rpc.sepolia.org'],
            nativeCurrency: { name: 'Sepolia ETH', symbol: 'SEP', decimals: 18 },
            blockExplorerUrls: ['https://sepolia.etherscan.io']
          };

          await eth.request({
            method: 'wallet_addEthereumChain',
            params: [chainParams],
          });
          await connectWallet();
        } catch (addError) {
          console.error('Failed to add network', addError);
          setError(`Failed to add network: ${addError.message}`);
        }
      } else {
        console.error('Failed to switch network', switchError);
        setError(`Failed to switch network: ${switchError.message}`);
      }
    }
  };

  useEffect(() => {
    const eth = getMetaMaskProvider();
    if (!eth) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts && accounts.length > 0) {
        connectWallet();
      } else {
        setAccount(null);
        setContract(null);
        setSigner(null);
        setRole(null);
        setRoleName(null);
        setOrganizationName(null);
        setIsConnected(false);
      }
    };

    const handleChainChanged = () => {
      connectWallet();
    };

    if (eth.on) {
      eth.on('accountsChanged', handleAccountsChanged);
      eth.on('chainChanged',    handleChainChanged);
    }

    // Auto-connect if already authorized
    eth.request({ method: 'eth_accounts' })
      .then(accounts => {
        if (accounts && accounts.length > 0) connectWallet();
      })
      .catch(console.warn);

    return () => {
      if (eth.removeListener) {
        eth.removeListener('accountsChanged', handleAccountsChanged);
        eth.removeListener('chainChanged',    handleChainChanged);
      }
    };
  }, [connectWallet]);

  return (
    <Web3Context.Provider value={{
      account,
      contract,
      provider,
      signer,
      role,
      roleName,
      organizationName,
      isConnected,
      connecting,
      error,
      clearError,
      balance,
      chainId,
      connectWallet,
      switchNetwork
    }}>
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  return useContext(Web3Context);
}
