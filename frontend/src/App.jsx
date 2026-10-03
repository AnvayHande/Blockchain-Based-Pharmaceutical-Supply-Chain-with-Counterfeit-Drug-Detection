import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { Web3Provider, useWeb3 } from './context/Web3Context';
import { Shield, QrCode, LayoutDashboard, Settings } from 'lucide-react';
import { ROLES, getRoleRoute } from './lib/roles';
import { isCorrectNetwork, normalizeChainId } from './lib/network';

// Pages
import VerifyPage         from './pages/VerifyPage';
import ScanPage           from './pages/ScanPage';
import ManufacturerPage   from './pages/ManufacturerPage';
import DistributorPage    from './pages/DistributorPage';
import WholesalerPage     from './pages/WholesalerPage';
import PharmacyPage       from './pages/PharmacyPage';
import AdminPage          from './pages/AdminPage';
import NotFoundPage       from './pages/NotFoundPage';

import './index.css';

function Navbar() {
  const { account, roleName, organizationName, connectWallet, connecting, isConnected, role, balance, chainId, switchNetwork } = useWeb3();
  const location = useLocation();

  const navLink = (to, label, icon) => {
    const active = location.pathname === to;
    return (
      <Link
        to={to}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          active
            ? 'bg-indigo-50 text-indigo-700'
            : 'text-gray-600 hover:text-indigo-600 hover:bg-gray-50'
        }`}
      >
        {icon}
        {label}
      </Link>
    );
  };

  const roleRoute = role ? getRoleRoute(role) : null;

  return (
    <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-indigo-600" />
            <span className="text-xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
              PharmaChain
            </span>
          </Link>

          {/* Nav links */}
          <div className="flex items-center gap-1">
            {navLink('/', 'Verify', null)}
            {navLink('/scan', 'Scan', <QrCode className="h-4 w-4" />)}

            {isConnected && roleRoute && roleRoute !== '/admin' && (
              <Link
                to={roleRoute}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors ml-1"
              >
                <LayoutDashboard className="h-4 w-4" />
                My Dashboard
              </Link>
            )}

            {isConnected && role === ROLES.ADMIN && (
              <Link
                to="/admin"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-100 hover:bg-red-100 transition-colors ml-1"
              >
                <Settings className="h-4 w-4" />
                Admin
              </Link>
            )}
          </div>

          {/* Wallet */}
          <div className="flex items-center gap-3">
            {isConnected && account ? (
              <div className="flex items-center gap-2">
                {organizationName && (
                  <span className="hidden md:block text-sm font-medium text-gray-700">{organizationName}</span>
                )}
                {roleName && (
                  <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold border border-indigo-100">
                    {roleName}
                  </span>
                )}
                {balance && (
                  <div className="hidden sm:block px-2.5 py-1 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-full">
                    {Number(balance).toFixed(4)} ETH
                  </div>
                )}
                <div className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full font-mono text-xs">
                  {account.slice(0, 6)}…{account.slice(-4)}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={connectWallet}
                  disabled={connecting}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-full text-sm font-semibold hover:shadow-lg hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {connecting ? 'Connecting…' : 'Connect MetaMask'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

function DashboardRedirect() {
  const { role, isConnected } = useWeb3();
  if (!isConnected) return <Navigate to="/" replace />;
  const route = getRoleRoute(role);
  return <Navigate to={route} replace />;
}

function GlobalBanners() {
  const { isConnected, chainId, balance, switchNetwork, account } = useWeb3();
  const location = useLocation();
  const targetChainId = Number(import.meta.env.VITE_CHAIN_ID || 11155111);

  if (!isConnected) return null;

  const isWrongNetwork = chainId && !isCorrectNetwork(chainId);
  const isLowBalance = balance && Number(balance) < 0.005;

  return (
    <div className="flex flex-col w-full z-40">
      {isWrongNetwork && (
        <div className="w-full bg-red-600 text-white px-4 py-2.5 flex justify-between items-center text-sm font-medium">
          <span>You are on chain {normalizeChainId(chainId)}. Please switch to Sepolia ({targetChainId}).</span>
          <button onClick={switchNetwork} className="px-3 py-1.5 bg-white text-red-600 rounded-md font-semibold hover:bg-gray-100 transition-colors">
            Switch to Sepolia
          </button>
        </div>
      )}
      {isLowBalance && !isWrongNetwork && location.pathname !== '/' && location.pathname !== '/scan' && (
        <div className="w-full bg-amber-500 text-white px-4 py-2.5 flex justify-between items-center text-sm font-medium">
          <span>Low Sepolia ETH. You need free test ETH to pay gas.</span>
          <button onClick={() => navigator.clipboard.writeText(account)} className="px-3 py-1.5 bg-white text-amber-600 rounded-md font-semibold hover:bg-gray-100 transition-colors">
            Copy my address
          </button>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <Web3Provider>
      <Router>
        <div className="min-h-screen font-sans bg-gray-50 text-gray-900">
          <Navbar />
          <GlobalBanners />
          <Routes>
            <Route path="/"             element={<VerifyPage />} />
            <Route path="/scan"         element={<ScanPage />} />
            <Route path="/manufacturer" element={<ManufacturerPage />} />
            <Route path="/distributor"  element={<DistributorPage />} />
            <Route path="/wholesaler"   element={<WholesalerPage />} />
            <Route path="/pharmacy"     element={<PharmacyPage />} />
            <Route path="/admin"        element={<AdminPage />} />
            <Route path="/dashboard"    element={<DashboardRedirect />} />
            <Route path="*"             element={<NotFoundPage />} />
          </Routes>
        </div>
      </Router>
    </Web3Provider>
  );
}

export default App;
