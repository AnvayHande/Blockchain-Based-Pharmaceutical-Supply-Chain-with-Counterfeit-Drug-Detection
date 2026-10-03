/**
 * PharmacyPage (/pharmacy) — M6
 * - Inventory of received batches with expiry warnings
 * - Inline verify (authenticity check)
 * - Sell to customer (sellMedicine) with confirm dialog
 * - Sold history
 * - Scan to select batch
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Store, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { useWeb3 } from '../context/Web3Context';
import { ROLES } from '../lib/roles';
import { getReadContract } from '../lib/contract';
import { computeVerdict } from '../lib/verdict';
import { getMetadata } from '../lib/api';
import { hashMetadata, pickCanonicalFields } from '../lib/metadata';
import {
  RoleGuard, PageHeader, BatchCard, useToast, TxButton, VerdictBanner, translateError
} from '../components/UI';

export default function PharmacyPage() {
  return (
    <RoleGuard requiredRole={ROLES.PHARMACY}>
      <PharmacyInner />
    </RoleGuard>
  );
}

function PharmacyInner() {
  const { contract, account, organizationName } = useWeb3();
  const { showToast, ToastComponent } = useToast();

  const [inventory,     setInventory]     = useState([]);
  const [soldHistory,   setSoldHistory]   = useState([]);
  const [loadingInv,    setLoadingInv]    = useState(false);
  const [sellBatchId,   setSellBatchId]   = useState('');
  const [selling,       setSelling]       = useState(false);
  const [inlineVerdict, setInlineVerdict] = useState(null);

  // ── Load inventory and sold history ───────────────────────────
  const loadData = useCallback(async () => {
    if (!contract || !account) return;
    setLoadingInv(true);
    try {
      const rc = getReadContract();

      // Batches transferred to this pharmacy
      const inFilter  = contract.filters.MedicineTransferred(null, null, null, account);
      const inEvents  = await contract.queryFilter(inFilter, 0, 'latest');
      const ids = [...new Set(inEvents.map(e => e.args[1]))];

      const active = [];
      const sold   = [];

      for (const id of ids) {
        const b = await rc.verifyMedicine(id);
        if (!b.exists) continue;
        if (Number(b.status) === 5) {
          // SOLD — only show if this pharmacy was the one who sold
          if (b.currentOwner.toLowerCase() === account.toLowerCase() ||
              inEvents.some(e => e.args[1] === id)) {
            sold.push(b);
          }
        } else if (Number(b.status) !== 6 &&  // not recalled
                   b.currentOwner.toLowerCase() === account.toLowerCase()) {
          active.push(b);
        }
      }

      setInventory(active);
      setSoldHistory(sold);
    } catch (err) {
      console.error(err);
    }
    setLoadingInv(false);
  }, [contract, account]);

  useEffect(() => { loadData(); }, [loadData]);

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

  // ── Sell ──────────────────────────────────────────────────────
  const handleSell = async (e) => {
    e.preventDefault();
    if (!sellBatchId) return;

    if (!window.confirm(
      `Sell batch "${sellBatchId}" to customer?\n\n` +
      'This marks the batch as sold. It can NO LONGER be transferred.'
    )) return;

    setSelling(true);
    try {
      const tx = await contract.sellMedicine(sellBatchId);
      showToast('Transaction sent. Waiting for confirmation...', 'info', tx.hash);
      await tx.wait();
      showToast(`Batch ${sellBatchId} marked as sold!`, 'success', tx.hash);
      setSellBatchId('');
      loadData();
    } catch (err) {
      showToast(translateError(err), 'error');
    }
    setSelling(false);
  };

  const expiryWarning = (batch) => {
    const daysLeft = Math.floor((Number(batch.expiryDate) - Date.now() / 1000) / 86400);
    if (daysLeft < 0)  return 'expired';
    if (daysLeft < 90) return 'warning';
    return 'ok';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {ToastComponent}
      <PageHeader icon={Store} title="Pharmacy Dashboard" subtitle={organizationName} color="teal" />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-10">
        {/* Sell panel */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" /> Sell to Customer
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            This marks the batch/unit as sold and it can no longer be transferred.
          </p>
          <form onSubmit={handleSell} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="sell-batch-id">
                Batch ID
              </label>
              <input
                id="sell-batch-id"
                type="text"
                placeholder="PHM-… or scan to fill"
                value={sellBatchId}
                onChange={e => setSellBatchId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-300 outline-none"
                required
              />
            </div>
            <TxButton loading={selling} disabled={!sellBatchId} variant="success" className="w-full justify-center py-3">
              Complete Sale
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
            <button onClick={() => setInlineVerdict(null)} className="mt-3 text-sm text-gray-400 hover:text-gray-600 underline">
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Inventory */}
      <h2 className="text-2xl font-bold text-gray-900 mb-6">My Inventory</h2>
      {loadingInv ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-teal-400" /></div>
      ) : inventory.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
          No batches in your custody yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
          {inventory.map(batch => {
            const warn    = expiryWarning(batch);
            const blocked = warn === 'expired' || Number(batch.status) === 6;
            return (
              <div key={batch.batchId} className={`rounded-2xl overflow-hidden border ${warn === 'expired' ? 'border-red-200' : warn === 'warning' ? 'border-amber-200' : 'border-gray-100'}`}>
                <BatchCard
                  batch={batch}
                  onSelect={!blocked ? b => setSellBatchId(b.batchId) : undefined}
                  actions={
                    <button
                      onClick={() => verifyBatch(batch)}
                      className="px-3 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg text-xs font-medium transition"
                    >
                      Verify
                    </button>
                  }
                />
                {warn === 'expired' && (
                  <div className="bg-red-50 px-4 py-2 text-xs text-red-700 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" /> Expired — sale blocked
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

      {/* Sold history */}
      {soldHistory.length > 0 && (
        <>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Sold History</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {soldHistory.map(batch => (
              <BatchCard key={batch.batchId} batch={batch} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

