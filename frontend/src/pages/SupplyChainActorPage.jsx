/**
 * SupplyChainActorPage — shared component for Distributor and Wholesaler pages.
 * Configured via props to avoid code duplication.
 *
 * M5: Distributor page (/distributor) and Wholesaler page (/wholesaler)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Truck, Loader2, AlertTriangle } from 'lucide-react';
import { useWeb3 } from '../context/Web3Context';
import { ROLES, getRoleName } from '../lib/roles';
import { getReadContract } from '../lib/contract';
import { computeVerdict } from '../lib/verdict';
import { getMetadata } from '../lib/api';
import { hashMetadata, pickCanonicalFields } from '../lib/metadata';
import {
  Timeline, useToast, TxButton, VerdictBanner, translateError,
  RoleGuard, PageHeader, BatchCard
} from '../components/UI';

// ── DistributorPage ───────────────────────────────────────────────
export function DistributorPage() {
  return (
    <RoleGuard requiredRole={ROLES.DISTRIBUTOR}>
      <SupplyChainActorInner
        roleName="Distributor"
        allowedTargetRoles={[ROLES.WHOLESALER, ROLES.PHARMACY]}
        targetLabel="Wholesaler or Pharmacy"
        pageColor="blue"
      />
    </RoleGuard>
  );
}

// ── WholesalerPage ────────────────────────────────────────────────
export function WholesalerPage() {
  return (
    <RoleGuard requiredRole={ROLES.WHOLESALER}>
      <SupplyChainActorInner
        roleName="Wholesaler"
        allowedTargetRoles={[ROLES.PHARMACY]}
        targetLabel="Pharmacy"
        pageColor="teal"
      />
    </RoleGuard>
  );
}

// ── Shared Inner component ────────────────────────────────────────
function SupplyChainActorInner({ roleName, allowedTargetRoles, targetLabel, pageColor }) {
  const { contract, account, organizationName } = useWeb3();
  const { showToast, ToastComponent } = useToast();

  const [inventory,      setInventory]      = useState([]);
  const [loadingInv,     setLoadingInv]     = useState(false);
  const [targets,        setTargets]        = useState([]);  // valid next-hop participants
  const [transferBatch,  setTransferBatch]  = useState('');
  const [transferTarget, setTransferTarget] = useState('');
  const [transferring,   setTransferring]   = useState(false);
  const [inlineVerdict,  setInlineVerdict]  = useState(null);  // { batchId, result }

  // ── Load inventory ─────────────────────────────────────────────
  const loadInventory = useCallback(async () => {
    if (!contract || !account) return;
    setLoadingInv(true);
    try {
      const rc = getReadContract();
      // Find batches transferred TO this account
      const filter = contract.filters.MedicineTransferred(null, null, null, account);
      const events = await contract.queryFilter(filter, 0, 'latest');
      const ids    = [...new Set(events.map(e => e.args[1]))];

      const items = [];
      for (const id of ids) {
        const b = await rc.verifyMedicine(id);
        if (b.exists && b.currentOwner.toLowerCase() === account.toLowerCase()) {
          if (Number(b.status) !== 5 && Number(b.status) !== 6) { // not SOLD/RECALLED
            items.push(b);
          }
        }
      }
      setInventory(items);
    } catch (err) {
      console.error(err);
    }
    setLoadingInv(false);
  }, [contract, account]);

  // ── Load target participants ───────────────────────────────────
  const loadTargets = useCallback(async () => {
    try {
      const targetContract = contract || getReadContract();
      const filter = targetContract.filters.ParticipantRegistered();
      const events = await targetContract.queryFilter(filter, 0, 'latest');
      const all = [];
      const seen = new Set();
      for (const e of events) {
        const addr = e.args[0];
        if (seen.has(addr.toLowerCase())) continue;
        seen.add(addr.toLowerCase());
        try {
          const p = await targetContract.participants(addr);
          if (p.authorized && allowedTargetRoles.includes(p.role)) {
            all.push({
              address:  addr,
              name:     (p.organizationName || e.args[1] || '').trim(),
              roleName: getRoleName(p.role),
            });
          }
        } catch (_) {}
      }
      setTargets(all);
    } catch (err) {
      console.error('Error loading targets:', err);
    }
  }, [contract, allowedTargetRoles]);

  useEffect(() => {
    loadInventory();
    loadTargets();
  }, [loadInventory, loadTargets]);

  // ── Inline verify ──────────────────────────────────────────────
  const verifyBatch = async (batch) => {
    try {
      const rc = getReadContract();
      const chainBatch = await rc.verifyMedicine(batch.batchId);
      let metadataCheck = 'missing';
      try {
        const metadata   = await getMetadata(batch.batchId);
        const recomputed = hashMetadata(pickCanonicalFields(metadata));
        metadataCheck    = recomputed === chainBatch.metadataHash ? 'ok' : 'tampered';
      } catch (_) {}
      const verdict = computeVerdict(chainBatch, metadataCheck);
      setInlineVerdict({ batchId: batch.batchId, verdict });
    } catch (err) {
      setInlineVerdict({ batchId: batch.batchId, verdict: computeVerdict(null, null) });
    }
  };

  // ── Transfer ───────────────────────────────────────────────────
  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!transferBatch || !transferTarget) return;
    setTransferring(true);
    try {
      const tx = await contract.transferMedicine(transferBatch, transferTarget, `${roleName} transfer`);
      showToast('Transaction sent. Waiting for confirmation...', 'info', tx.hash);
      await tx.wait();
      showToast(`Batch ${transferBatch} transferred!`, 'success', tx.hash);
      setTransferBatch('');
      setTransferTarget('');
      loadInventory();
    } catch (err) {
      showToast(translateError(err), 'error');
    }
    setTransferring(false);
  };

  const expiryWarning = (batch) => {
    const daysLeft = Math.floor((Number(batch.expiryDate) - Date.now() / 1000) / 86400);
    if (daysLeft < 0)  return 'expired';
    if (daysLeft < 90) return 'warning';
    return 'ok';
  };

  const pageIcon = roleName === 'Distributor' ? Truck : Truck;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {ToastComponent}
      <PageHeader
        icon={pageIcon}
        title={`${roleName} Dashboard`}
        subtitle={organizationName}
        color={pageColor}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-10">
        {/* Transfer panel */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Transfer Batch</h2>
          <form onSubmit={handleTransfer} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="actor-batch-id">Batch ID</label>
              <input
                id="actor-batch-id"
                type="text"
                placeholder="PHM-…"
                value={transferBatch}
                onChange={e => setTransferBatch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-300 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="actor-target">
                Transfer to ({targetLabel})
              </label>
              {targets.length === 0 ? (
                <p className="text-sm text-gray-400 py-2">No {targetLabel} registered. Ask admin.</p>
              ) : (
                <select
                  id="actor-target"
                  value={transferTarget}
                  onChange={e => setTransferTarget(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-300 outline-none"
                  required
                >
                  <option value="">Choose target…</option>
                  {targets.map(t => (
                    <option key={t.address} value={t.address}>
                      [{t.roleName}] {t.name} ({t.address.slice(0,8)}…)
                    </option>
                  ))}
                </select>
              )}
            </div>
            <TxButton loading={transferring} disabled={!transferBatch || !transferTarget} variant="primary" className="w-full justify-center py-3">
              Transfer Custody
            </TxButton>
          </form>
        </div>

        {/* Inline verify result */}
        {inlineVerdict && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Verification: <span className="font-mono text-sm text-gray-500">{inlineVerdict.batchId}</span>
            </h2>
            <VerdictBanner
              color={inlineVerdict.verdict.color}
              title={inlineVerdict.verdict.title}
              message={inlineVerdict.verdict.message}
            />
            <button
              onClick={() => setInlineVerdict(null)}
              className="mt-3 text-sm text-gray-400 hover:text-gray-600 underline"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Inventory */}
      <h2 className="text-2xl font-bold text-gray-900 mb-6">My Inventory</h2>
      {loadingInv ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-400" /></div>
      ) : inventory.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
          No batches in your custody yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {inventory.map(batch => {
            const warn = expiryWarning(batch);
            return (
              <div key={batch.batchId} className={`rounded-2xl shadow-sm border overflow-hidden ${warn === 'expired' ? 'border-red-200' : warn === 'warning' ? 'border-amber-200' : 'border-gray-100'}`}>
                <BatchCard
                  batch={batch}
                  onSelect={b => setTransferBatch(b.batchId)}
                  actions={
                    <button
                      onClick={() => verifyBatch(batch)}
                      className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium transition"
                    >
                      Verify
                    </button>
                  }
                />
                {warn === 'expired' && (
                  <div className="bg-red-50 px-4 py-2 text-xs text-red-700 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" /> Expired — transfer blocked
                  </div>
                )}
                {warn === 'warning' && (
                  <div className="bg-amber-50 px-4 py-2 text-xs text-amber-700 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" /> Expiring within 90 days
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

