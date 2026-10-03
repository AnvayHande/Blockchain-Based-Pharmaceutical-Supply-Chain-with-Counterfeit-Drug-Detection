/**
 * AdminPage (/admin) — M8
 * Fixes P2: registerParticipant uses ROLES hash from lib/roles.js (no numeric roles)
 * - Register all 4 roles with ethers.isAddress validation
 * - List all registered participants
 * - Recall batch with confirmation
 * - View counterfeit reports
 */
import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Settings, UserPlus, AlertOctagon, Users, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { useWeb3 } from '../context/Web3Context';
import { ROLES, ROLE_NAMES, getRoleName } from '../lib/roles';
import { getReadContract } from '../lib/contract';
import { getAllReports } from '../lib/api';
import { RoleGuard, PageHeader, StatusBadge, useToast, TxButton, AddressPill, translateError } from '../components/UI';

export default function AdminPage() {
  return (
    <RoleGuard requiredRole={ROLES.ADMIN}>
      <AdminInner />
    </RoleGuard>
  );
}

function AdminInner() {
  const { contract } = useWeb3();
  const { showToast, ToastComponent } = useToast();

  // Register form
  const [wallet,    setWallet]    = useState('');
  const [orgName,   setOrgName]   = useState('');
  const [roleKey,   setRoleKey]   = useState('MANUFACTURER');
  const [regLoading, setRegLoading] = useState(false);
  const [walletErr,  setWalletErr]  = useState('');

  // Recall form
  const [recallId,      setRecallId]      = useState('');
  const [recallLoading, setRecallLoading] = useState(false);

  // Data
  const [participants, setParticipants] = useState([]);
  const [reports,      setReports]      = useState({});
  const [loadingData,  setLoadingData]  = useState(false);

  // ── Load participants ─────────────────────────────────────────
  const loadParticipants = useCallback(async () => {
    if (!contract) return;
    setLoadingData(true);
    try {
      const filter = contract.filters.ParticipantRegistered();
      const events = await contract.queryFilter(filter, 0, 'latest');
      const rc     = getReadContract();
      const list   = [];
      for (const e of events) {
        const addr = e.args[0];
        try {
          const p = await rc.participants(addr);
          list.push({
            address: addr,
            organizationName: p.organizationName,
            role:    p.role,
            authorized: p.authorized,
          });
        } catch (_) {}
      }
      setParticipants(list);
    } catch (err) {
      console.error(err);
    }
    setLoadingData(false);
  }, [contract]);

  // ── Load reports ──────────────────────────────────────────────
  const loadReports = useCallback(async () => {
    try {
      const data = await getAllReports();
      setReports(data);
    } catch (_) {}
  }, []);

  useEffect(() => {
    loadParticipants();
    loadReports();
  }, [loadParticipants, loadReports]);

  // ── Register participant (P2 fix) ─────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    setWalletErr('');
    if (!ethers.isAddress(wallet)) {
      setWalletErr('Invalid Ethereum address');
      return;
    }
    setRegLoading(true);
    try {
      const roleHash = ROLES[roleKey]; // bytes32 from lib/roles.js — NOT parseInt
      const tx = await contract.registerParticipant(wallet, orgName, roleHash);
      showToast('Transaction sent. Waiting for confirmation...', 'info', tx.hash);
      await tx.wait();
      showToast(`${ROLE_NAMES[roleHash]} registered!`, 'success', tx.hash);
      setWallet('');
      setOrgName('');
      loadParticipants();
    } catch (err) {
      showToast(translateError(err), 'error');
    }
    setRegLoading(false);
  };

  // ── Recall batch ──────────────────────────────────────────────
  const handleRecall = async (e) => {
    e.preventDefault();
    if (!recallId) return;
    if (!window.confirm(`Recall batch "${recallId}"? This marks it as unsafe and blocks all transfers.`)) return;
    setRecallLoading(true);
    try {
      const tx = await contract.recallMedicine(recallId);
      showToast('Transaction sent. Waiting for confirmation...', 'info', tx.hash);
      await tx.wait();
      showToast(`Batch ${recallId} recalled.`, 'success', tx.hash);
      setRecallId('');
    } catch (err) {
      showToast(translateError(err), 'error');
    }
    setRecallLoading(false);
  };

  const totalReports = Object.values(reports).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {ToastComponent}
      <PageHeader icon={Settings} title="Admin Dashboard" subtitle="Manage participants and recalls" color="red" />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-10">
        {/* Register participant */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-indigo-500" /> Register Participant
          </h2>
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="admin-wallet">
                Wallet Address *
              </label>
              <input
                id="admin-wallet"
                type="text"
                placeholder="0x…"
                value={wallet}
                onChange={e => { setWallet(e.target.value); setWalletErr(''); }}
                className={`w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none font-mono ${walletErr ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                required
              />
              {walletErr && <p className="text-red-500 text-xs mt-1">{walletErr}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="admin-org">
                Organization Name *
              </label>
              <input
                id="admin-org"
                type="text"
                placeholder="e.g. CiplaPharm Ltd"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="admin-role">
                Role *
              </label>
              <select
                id="admin-role"
                value={roleKey}
                onChange={e => setRoleKey(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
              >
                <option value="MANUFACTURER">Manufacturer</option>
                <option value="DISTRIBUTOR">Distributor</option>
                <option value="WHOLESALER">Wholesaler</option>
                <option value="PHARMACY">Pharmacy</option>
              </select>
            </div>
            <TxButton loading={regLoading} variant="primary" className="w-full justify-center py-3">
              Register Participant
            </TxButton>
          </form>
        </div>

        {/* Recall batch */}
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 border-t-4 border-t-red-500 p-6">
          <h2 className="text-xl font-bold text-red-700 mb-2 flex items-center gap-2">
            <AlertOctagon className="h-5 w-5" /> Recall Medicine Batch
          </h2>
          <p className="text-sm text-gray-500 mb-4">Emergency action. Marks the batch as recalled — all transfers are blocked.</p>
          <form onSubmit={handleRecall} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="recall-id">
                Batch ID
              </label>
              <input
                id="recall-id"
                type="text"
                placeholder="PHM-…"
                value={recallId}
                onChange={e => setRecallId(e.target.value)}
                className="w-full px-3 py-2 border border-red-200 rounded-xl text-sm focus:ring-2 focus:ring-red-400 outline-none"
                required
              />
            </div>
            <TxButton loading={recallLoading} disabled={!recallId} variant="danger" className="w-full justify-center py-3">
              Issue Recall
            </TxButton>
          </form>
        </div>
      </div>

      {/* Participants table */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-indigo-500" /> Registered Participants
          </h2>
          <button
            onClick={loadParticipants}
            disabled={loadingData}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
          >
            {loadingData ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
        </div>

        {loadingData ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-indigo-400" /></div>
        ) : participants.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
            No participants registered yet.
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Organization</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Role</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Address</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {participants.map(p => (
                  <tr key={p.address} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3 font-medium text-gray-900">{p.organizationName}</td>
                    <td className="px-5 py-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
                        {getRoleName(p.role)}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <AddressPill address={p.address} />
                    </td>
                    <td className="px-5 py-3">
                      {p.authorized
                        ? <span className="text-green-600 font-medium">✓ Active</span>
                        : <span className="text-red-600 font-medium">Inactive</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Counterfeit reports */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-5 flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-amber-500" /> Counterfeit Reports
          {totalReports > 0 && (
            <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-bold">{totalReports}</span>
          )}
        </h2>
        {totalReports === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center text-gray-400">
            No counterfeit reports yet.
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(reports).map(([batchId, list]) => (
              <div key={batchId} className="bg-white rounded-2xl shadow-sm border border-amber-100 p-5">
                <p className="font-mono font-bold text-gray-800 mb-3">{batchId}</p>
                <div className="space-y-2">
                  {list.map((r, i) => (
                    <div key={i} className="bg-amber-50 rounded-xl p-3 text-sm">
                      <p className="text-gray-800">{r.details}</p>
                      <p className="text-gray-400 text-xs mt-1">{new Date(r.reportedAt).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

