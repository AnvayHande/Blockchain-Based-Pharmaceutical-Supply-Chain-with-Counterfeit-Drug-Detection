import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { Web3Provider, useWeb3 } from './context/Web3Context';
import { 
  Shield, QrCode, LayoutDashboard, Settings, AlertTriangle, 
  AlertOctagon, Loader2, ChevronDown, Building2, Truck, Store, UserCheck, ShieldCheck 
} from 'lucide-react';
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
  const { 
    account, 
    roleName, 
    organizationName, 
    connectWallet, 
    connecting, 
    isConnected, 
    role, 
    balance, 
    chainId 
  } = useWeb3();
  const location = useLocation();
  const [portalsOpen, setPortalsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Dynamic Browser Tab Title based on Route & Role
  useEffect(() => {
    const titles = {
      '/': 'PhC — Verify Medicine',
      '/scan': 'PhC — Scanner',
      '/admin': 'PhC — Admin Console',
      '/manufacturer': 'PhC — Manufacturer Portal',
      '/distributor': 'PhC — Distributor Portal',
      '/wholesaler': 'PhC — Wholesaler Portal',
      '/pharmacy': 'PhC — Pharmacy Portal',
    };
    document.title = titles[location.pathname] || 'PhC — Verify Medicine';
    setPortalsOpen(false); // Close dropdown on route change
  }, [location.pathname]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setPortalsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
            {navLink('/', 'Verify (Public)', <ShieldCheck className="h-4 w-4" />)}
            {navLink('/scan', 'Scan', <QrCode className="h-4 w-4" />)}

            {/* Role Portals Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setPortalsOpen(!portalsOpen)}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  portalsOpen
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:text-indigo-600 hover:bg-gray-50'
                }`}
              >
                <span>Role Portals</span>
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${portalsOpen ? 'rotate-180' : ''}`} />
              </button>

              {portalsOpen && (
                <div className="absolute left-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Supply Chain Portals
                  </div>
                  <Link
                    to="/admin"
                    className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 transition"
                  >
                    <Settings className="h-4 w-4 text-red-500" />
                    <div>
                      <div className="font-medium">Admin Console</div>
                      <div className="text-xs text-gray-400">Manage participants & recalls</div>
                    </div>
                  </Link>
                  <Link
                    to="/manufacturer"
                    className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition"
                  >
                    <Building2 className="h-4 w-4 text-indigo-500" />
                    <div>
                      <div className="font-medium">Manufacturer</div>
                      <div className="text-xs text-gray-400">Create batches & print barcodes</div>
                    </div>
                  </Link>
                  <Link
                    to="/distributor"
                    className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition"
                  >
                    <Truck className="h-4 w-4 text-amber-500" />
                    <div>
                      <div className="font-medium">Distributor</div>
                      <div className="text-xs text-gray-400">Receive & dispatch shipments</div>
                    </div>
                  </Link>
                  <Link
                    to="/pharmacy"
                    className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition"
                  >
                    <Store className="h-4 w-4 text-teal-500" />
                    <div>
                      <div className="font-medium">Pharmacy</div>
                      <div className="text-xs text-gray-400">Inventory & sell to customers</div>
                    </div>
                  </Link>
                  <div className="border-t border-gray-100 my-1"></div>
                  <Link
                    to="/"
                    className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                  >
                    <UserCheck className="h-4 w-4 text-gray-500" />
                    <div>
                      <div className="font-medium">Public Consumer</div>
                      <div className="text-xs text-gray-400">Verify genuine medicines</div>
                    </div>
                  </Link>
                </div>
              )}
            </div>

            {/* My Dashboard button for the connected role */}
            {isConnected && roleRoute && (
              <Link
                to={roleRoute}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm hover:opacity-95 transition-all ml-1"
              >
                <LayoutDashboard className="h-4 w-4" />
                My Dashboard
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
                {roleName ? (
                  <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold border border-indigo-100">
                    {roleName}
                  </span>
                ) : (
                  <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-semibold border border-amber-200" title="Account not registered with a role yet">
                    Unregistered
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
                  className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-full text-sm font-semibold hover:shadow-lg hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {connecting && <Loader2 className="h-4 w-4 animate-spin" />}
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
  const { isConnected, chainId, switchNetwork, error, clearError } = useWeb3();
  const targetChainId = Number(import.meta.env.VITE_CHAIN_ID || 11155111);

  const isWrongNetwork = isConnected && chainId && !isCorrectNetwork(chainId);

  return (
    <div className="flex flex-col w-full z-40">
      {error && (
        <div className="w-full bg-red-600 text-white px-4 py-2.5 flex justify-between items-center text-sm font-medium shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertOctagon className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button 
            onClick={clearError}
            className="px-2.5 py-0.5 bg-white/20 hover:bg-white/30 rounded text-xs transition"
          >
            Dismiss
          </button>
        </div>
      )}
      {isWrongNetwork && (
        <div className="w-full bg-amber-500 text-white px-4 py-2.5 flex justify-between items-center text-sm font-medium shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Connected to Chain ID {chainId}. Please switch to {targetChainId === 31337 ? 'Hardhat Localhost (31337)' : `Chain ID ${targetChainId}`}.
            </span>
          </div>
          <button 
            onClick={switchNetwork} 
            className="px-3 py-1 bg-white text-amber-800 rounded-md font-semibold text-xs hover:bg-amber-50 transition shadow-sm"
          >
            Switch Network
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
