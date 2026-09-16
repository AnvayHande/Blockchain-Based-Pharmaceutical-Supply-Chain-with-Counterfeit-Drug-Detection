import { createContext, useContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../contracts/config';

const Web3Context = createContext();

export function Web3Provider({ children }) {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [provider, setProvider] = useState(null);
  const [role, setRole] = useState(null);
  const [error, setError] = useState(null);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const _provider = new ethers.BrowserProvider(window.ethereum);
        setProvider(_provider);

        const accounts = await _provider.send('eth_requestAccounts', []);
        setAccount(accounts[0]);

        const _signer = await _provider.getSigner();
        const _contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, _signer);
        setContract(_contract);

        // Fetch participant details
        try {
          const participant = await _contract.participants(accounts[0]);
          if (participant.authorized) {
            setRole(participant.role);
          }
        } catch (err) {
          console.error("Error fetching participant role", err);
        }
      } catch (err) {
        setError(err.message);
      }
    } else {
      setError("Please install MetaMask!");
    }
  };

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          connectWallet();
        } else {
          setAccount(null);
          setContract(null);
          setRole(null);
        }
      });
    }
  }, []);

  return (
    <Web3Context.Provider value={{ account, contract, provider, role, connectWallet, error }}>
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  return useContext(Web3Context);
}
