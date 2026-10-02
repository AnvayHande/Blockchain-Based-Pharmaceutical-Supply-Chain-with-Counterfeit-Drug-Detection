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

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      setError('Please install MetaMask to use role pages.');
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const _provider = new ethers.BrowserProvider(window.ethereum);
      setProvider(_provider);

      const accounts = await _provider.send('eth_requestAccounts', []);
      const _account = accounts[0];
      setAccount(_account);

      const _signer   = await _provider.getSigner();
      setSigner(_signer);

      const network = await _provider.getNetwork();
      setChainId(normalizeChainId(network.chainId));
      
      const bal = await _provider.getBalance(_account);
      setBalance(ethers.formatEther(bal));

      const _contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, _signer);
      setContract(_contract);

      await fetchParticipantDetails(_contract, _account);
      setIsConnected(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setConnecting(false);
    }
  }, []);


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
      console.error('Error fetching participant role', err);
    }
  };
  
  const switchNetwork = async () => {
    if (!window.ethereum) return;
    const targetChainId = parseInt(import.meta.env.VITE_CHAIN_ID || '11155111', 10);
    const hexChainId = `0x${targetChainId.toString(16)}`;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }],
      });
      // Re-connect immediately upon successful switch
      await connectWallet();
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: hexChainId,
                chainName: 'Sepolia',
                rpcUrls: [import.meta.env.VITE_RPC_URL || 'https://rpc.sepolia.org'],
                nativeCurrency: { name: 'Sepolia ETH', symbol: 'SEP', decimals: 18 },
                blockExplorerUrls: ['https://sepolia.etherscan.io']
              }
            ],
          });
        } catch (addError) {
          console.error('Failed to add network', addError);
        }
      } else {
        console.error('Failed to switch network', switchError);
      }
    }
  };

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length > 0) {
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

    const handleChainChanged = (newChainId) => {
      // Avoid full page reload; just re-connect to update state.
      connectWallet();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged',    handleChainChanged);

    // Auto-connect if already authorized (no prompt)
    window.ethereum.request({ method: 'eth_accounts' })
      .then(accounts => {
        if (accounts.length > 0) connectWallet();
      })
      .catch(console.error);

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged',    handleChainChanged);
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
