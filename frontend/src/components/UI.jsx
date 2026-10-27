/**
 * Shared UI Components — used across all role pages.
 * Keep all generic, reusable pieces here to avoid duplication.
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle, XCircle, AlertTriangle, AlertOctagon, Info,
  Loader2, Copy, Check, Clock, ChevronRight
} from 'lucide-react';
import { STATUS_LABELS, getRoleRoute } from '../lib/roles';
import { Web3Context } from '../context/Web3Context';

// ── StatusBadge ───────────────────────────────────────────────────
const STATUS_STYLES = {
  REGISTERED:     'bg-blue-50   text-blue-700   border-blue-200',
  'IN TRANSIT':   'bg-yellow-50 text-yellow-700 border-yellow-200',
  'AT DISTRIBUTOR':'bg-indigo-50 text-indigo-700 border-indigo-200',
  'AT WHOLESALER':'bg-purple-50 text-purple-700 border-purple-200',
  'AT PHARMACY':  'bg-teal-50   text-teal-700   border-teal-200',
  SOLD:           'bg-green-50  text-green-700  border-green-200',
  RECALLED:       'bg-red-50    text-red-700    border-red-200',
  EXPIRED:        'bg-orange-50 text-orange-700 border-orange-200',
};

export function StatusBadge({ status }) {
  const label = typeof status === 'number' || typeof status === 'bigint'
    ? STATUS_LABELS[Number(status)]
    : (status || 'UNKNOWN');
  const cls = STATUS_STYLES[label] || 'bg-gray-50 text-gray-700 border-gray-200';
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${cls}`}>
      {label}
    </span>
  );
}

// ── VerdictBanner ─────────────────────────────────────────────────
const VERDICT_STYLES = {
  green:  { bg: 'from-green-50  to-emerald-50',  border: 'border-green-200',  icon: CheckCircle,    iconColor: 'text-green-600'  },
  red:    { bg: 'from-red-50    to-rose-50',      border: 'border-red-200',    icon: XCircle,        iconColor: 'text-red-600'    },
  orange: { bg: 'from-orange-50 to-amber-50',     border: 'border-orange-200', icon: AlertTriangle,  iconColor: 'text-orange-600' },
  yellow: { bg: 'from-yellow-50 to-amber-50',     border: 'border-yellow-200', icon: AlertTriangle,  iconColor: 'text-yellow-600' },
  grey:   { bg: 'from-gray-50   to-slate-50',     border: 'border-gray-200',   icon: Info,           iconColor: 'text-gray-500'   },
  blue:   { bg: 'from-blue-50   to-sky-50',       border: 'border-blue-200',   icon: CheckCircle,    iconColor: 'text-blue-600'   },
};

export function VerdictBanner({ color, title, message }) {
  const style = VERDICT_STYLES[color] || VERDICT_STYLES.grey;
  const Icon  = style.icon;
  return (
    <div className={`bg-gradient-to-br ${style.bg} border ${style.border} rounded-2xl p-5 flex gap-4`}>
      <div className="shrink-0 mt-0.5">
        <Icon className={`h-7 w-7 ${style.iconColor}`} />
      </div>
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">{title}</h2>
        <p className="text-gray-700 text-sm leading-relaxed">{message}</p>
      </div>
    </div>
  );
}

// ── AddressPill ───────────────────────────────────────────────────
export function AddressPill({ address, label }) {
  const [copied, setCopied] = useState(false);
  if (!address) return null;
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;

  const copy = () => {
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-mono">
      {label && <span className="text-gray-500 not-italic">{label}</span>}
      <span title={address}>{short}</span>
      <button onClick={copy} className="text-gray-400 hover:text-gray-600 transition" aria-label="Copy address">
        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      </button>
    </span>
  );
}

// ── TxButton ──────────────────────────────────────────────────────
export function TxButton({ onClick, loading, disabled, children, variant = 'primary', className = '' }) {
  const variants = {
    primary:   'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-sm',
    success:   'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-sm',
    danger:    'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-sm',
    secondary: 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

// ── Toast ─────────────────────────────────────────────────────────
export function Toast({ message, type = 'info', txHash, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, txHash ? 12000 : 4000);
    return () => clearTimeout(t);
  }, [onClose, txHash]);

  const styles = {
    success: 'bg-green-600  text-white',
    error:   'bg-red-600    text-white',
    info:    'bg-indigo-600 text-white',
    warning: 'bg-amber-500  text-white',
  };
  return (
    <div className={`fixed bottom-6 right-6 z-[999] px-5 py-3 rounded-xl shadow-xl text-sm font-medium flex items-center gap-3 max-w-sm ${styles[type]}`}>
      <span>
        {message}
        {txHash && (
           <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer" className="underline ml-2 text-indigo-100 hover:text-white inline-block">
             View on Etherscan
           </a>
        )}
      </span>
      <button onClick={onClose} className="ml-auto opacity-70 hover:opacity-100 text-lg leading-none">&times;</button>
    </div>
  );
}

// useToast hook
export function useToast() {
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'info', txHash = null) => setToast({ message, type, txHash });
  const hideToast = () => setToast(null);
  const ToastComponent = toast
    ? <Toast message={toast.message} type={toast.type} txHash={toast.txHash} onClose={hideToast} />
    : null;
  return { showToast, ToastComponent };
}

// ── Error Translator ──────────────────────────────────────────────
export function translateError(err) {
  const msg = err?.reason || err?.message || '';
  if (msg.includes('user rejected'))                 return 'Transaction was rejected by the user.';
  if (msg.includes('insufficient funds'))            return 'Insufficient funds for gas. You need Sepolia ETH.';
  if (msg.includes('wrong network'))                 return 'Wrong network. Please switch to Sepolia.';
  if (msg.includes('not the current owner'))         return 'You are not the current owner of this batch.';
  if (msg.includes('already registered'))            return 'This batch ID is already registered.';
  if (msg.includes('Invalid supply chain'))          return 'This transfer is not a valid supply chain step.';
  if (msg.includes('recalled'))                      return 'This batch has been recalled.';
  if (msg.includes('sold'))                          return 'This batch has already been sold.';
  if (msg.includes('expired'))                       return 'This batch has expired.';
  if (msg.includes('Participant already'))           return 'This address is already registered.';
  if (msg.includes('Invalid role'))                  return 'Invalid role hash.';
  if (msg.includes('unauthorized') || msg.includes('Missing or invalid role') || msg.includes('AccessControl')) return 'Wrong role for this action.';
  return msg || 'Transaction failed. Check console for details.';
}

// ── PageHeader ────────────────────────────────────────────────────
export function PageHeader({ icon: Icon, title, subtitle, color = 'indigo' }) {
  const colors = {
    indigo: 'from-indigo-500 to-violet-500',
    green:  'from-green-500 to-emerald-500',
    blue:   'from-blue-500 to-cyan-500',
    teal:   'from-teal-500 to-cyan-500',
    red:    'from-red-500 to-rose-500',
  };
  return (
    <div className="mb-8">
      <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br ${colors[color] || colors.indigo} mb-4`}>
        {Icon && <Icon className="h-6 w-6 text-white" />}
      </div>
      <h1 className="text-3xl font-extrabold text-gray-900">{title}</h1>
      {subtitle && <p className="text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

// ── BatchCard ─────────────────────────────────────────────────────
export function BatchCard({ batch, onSelect, actions }) {
  if (!batch) return null;
  const expiry    = new Date(Number(batch.expiryDate) * 1000);
  const daysLeft  = Math.floor((expiry - Date.now()) / 86400000);
  const isExpired = daysLeft < 0;
  const isWarning = !isExpired && daysLeft < 90;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-5 border-b border-gray-50 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex justify-between items-start gap-2">
          <div>
            <h3 className="font-bold text-gray-900">{batch.medicineName}</h3>
            <p className="text-xs font-mono text-gray-400 mt-0.5">{batch.batchId}</p>
          </div>
          <StatusBadge status={batch.status} />
        </div>
      </div>
      <div className="p-5 space-y-2 text-sm">
        <Row label="Qty"     value={`${batch.quantity?.toString() || '—'} units`} />
        <Row label="Mfg"     value={fmtDate(batch.manufactureDate)} />
        <Row label="Expiry"  value={
          <span className={isExpired ? 'text-red-600 font-semibold' : isWarning ? 'text-amber-600 font-semibold' : ''}>
            {fmtDate(batch.expiryDate)}
            {!isExpired && ` (${daysLeft}d)`}
            {isExpired && ' — EXPIRED'}
          </span>
        } />
      </div>
      {(onSelect || actions) && (
        <div className="px-5 pb-4 flex gap-2 flex-wrap">
          {onSelect && (
            <button
              onClick={() => onSelect(batch)}
              className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium transition"
            >
              Select
            </button>
          )}
          {actions}
          <Link
            to={`/?batch=${batch.batchId}`}
            className="px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg text-sm font-medium transition"
          >
            Track
          </Link>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  );
}

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(Number(ts) * 1000).toLocaleDateString();
}

// ── Timeline ──────────────────────────────────────────────────────
export function Timeline({ batch, history, participants }) {
  const lookupOrg = (addr) => {
    if (!addr) return addr;
    const p = participants?.[addr?.toLowerCase?.()];
    return p?.organizationName || addr;
  };

  return (
    <div className="relative border-l-2 border-indigo-100 ml-4 space-y-6 py-2">
      {/* Registration */}
      <TimelineItem
        color="bg-indigo-500"
        date={fmtDate(batch?.manufactureDate)}
        title="Batch Registered"
        detail={`By ${lookupOrg(batch?.manufacturer)}`}
      />
      {/* Transfers */}
      {(history || []).map((tx, i) => (
        <TimelineItem
          key={i}
          color="bg-violet-500"
          date={new Date(Number(tx.timestamp) * 1000).toLocaleString()}
          title="Custody Transferred"
          detail={`${lookupOrg(tx.from)} → ${lookupOrg(tx.to)}`}
          sub={tx.transactionRef}
        />
      ))}
      {/* Sold */}
      {Number(batch?.status) === 5 && (
        <TimelineItem
          color="bg-green-500"
          date=""
          title="Sold to Customer"
          detail="Dispensed by pharmacy"
        />
      )}
      {/* Recalled */}
      {Number(batch?.status) === 6 && (
        <TimelineItem
          color="bg-red-500"
          date=""
          title="Recalled ⛔"
          detail="This batch was recalled"
        />
      )}
    </div>
  );
}

function TimelineItem({ color, date, title, detail, sub }) {
  return (
    <div className="relative pl-8">
      <div className={`absolute w-3.5 h-3.5 ${color} rounded-full -left-[7px] top-1 border-2 border-white shadow`} />
      {date && <p className="text-xs text-gray-400 font-medium">{date}</p>}
      <p className="font-semibold text-gray-800 text-sm">{title}</p>
      {detail && <p className="text-sm text-gray-500">{detail}</p>}
      {sub && <p className="text-xs text-gray-400 mt-0.5">Ref: {sub}</p>}
    </div>
  );
}

// ── RoleGuard ─────────────────────────────────────────────────────
export function RoleGuard({ requiredRole, children }) {
  const { account, connecting, role, roleName, connectWallet, isConnected, error } = React.useContext(Web3Context);

  if (connecting) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
        <p className="text-gray-500 font-medium">Connecting to MetaMask...</p>
      </div>
    );
  }

  if (!isConnected || !account) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-6 p-8 text-center">
        <div className="bg-indigo-50 p-4 rounded-2xl">
          <AlertOctagon className="h-12 w-12 text-indigo-500 mx-auto" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Wallet Required</h2>
          <p className="text-gray-500 max-w-md">Connect your MetaMask wallet to access this role page.</p>
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm max-w-md text-left">
            <span className="font-semibold">Notice:</span> {error}
          </div>
        )}
        <button
          onClick={connectWallet}
          className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-full font-semibold shadow-lg hover:shadow-xl hover:opacity-90 transition-all"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  if (role !== requiredRole) {
    const correctRoute = getRoleRoute(role);
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-6 p-8 text-center">
        <div className="bg-amber-50 p-4 rounded-2xl">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Wrong Role</h2>
          <p className="text-gray-500 max-w-md">
            Your wallet is registered as <strong>{roleName || 'not registered / unknown'}</strong>.
            {roleName && ` This page is for a different role.`}
          </p>
        </div>
        {roleName && correctRoute !== '/' && (
          <Link
            to={correctRoute}
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-full font-semibold hover:bg-indigo-700 transition"
          >
            Go to my {roleName} page <ChevronRight className="h-4 w-4" />
          </Link>
        )}
        {!roleName && (
          <p className="text-sm text-gray-400">Ask an admin to register your wallet address.</p>
        )}
      </div>
    );
  }

  return children;
}
