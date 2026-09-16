import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Web3Provider, useWeb3 } from './context/Web3Context';
import { Shield, Activity, Search } from 'lucide-react';
import './index.css';

function Navbar() {
  const { account, connectWallet } = useWeb3();

  return (
    <nav className="bg-white/70 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Shield className="h-8 w-8 text-indigo-600" />
            <span className="ml-2 text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
              PharmaChain
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/" className="text-gray-600 hover:text-indigo-600 px-3 py-2 rounded-md font-medium transition-colors">
              Verify
            </Link>
            <Link to="/dashboard" className="text-gray-600 hover:text-indigo-600 px-3 py-2 rounded-md font-medium transition-colors">
              Dashboard
            </Link>
            {account ? (
              <div className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full font-medium text-sm border border-indigo-100">
                {account.substring(0, 6)}...{account.substring(account.length - 4)}
              </div>
            ) : (
              <button
                onClick={connectWallet}
                className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-full font-medium hover:shadow-lg hover:opacity-90 transition-all duration-200"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

function Home() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-4 relative overflow-hidden bg-gray-50">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-200/50 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-violet-200/50 blur-[100px]" />
      </div>
      
      <div className="text-center max-w-2xl mx-auto mb-12 animate-fade-in-up">
        <div className="inline-flex items-center justify-center p-3 bg-indigo-100 rounded-2xl mb-6">
          <Activity className="h-8 w-8 text-indigo-600" />
        </div>
        <h1 className="text-5xl font-extrabold text-gray-900 tracking-tight mb-6">
          Verify Medicine <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Authenticity</span>
        </h1>
        <p className="text-xl text-gray-600">
          Trace your pharmaceutical products from manufacturer to pharmacy on an immutable blockchain ledger.
        </p>
      </div>

      <div className="w-full max-w-md">
        <div className="bg-white p-2 rounded-full shadow-lg flex items-center border border-gray-100 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
          <div className="pl-4">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input 
            type="text" 
            placeholder="Enter Batch ID (e.g. BATCH001)" 
            className="w-full px-4 py-3 outline-none text-gray-700 bg-transparent"
          />
          <button className="px-6 py-3 bg-indigo-600 text-white rounded-full font-medium hover:bg-indigo-700 transition-colors shrink-0">
            Verify
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Web3Provider>
      <Router>
        <div className="min-h-screen font-sans bg-gray-50 text-gray-900">
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<div className="p-8 text-center text-gray-500">Dashboard Coming Soon</div>} />
          </Routes>
        </div>
      </Router>
    </Web3Provider>
  );
}

export default App;
