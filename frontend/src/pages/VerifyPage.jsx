/**
 * VerifyPage — Public customer verification page (/ and /?batch=...)
 * Works WITHOUT MetaMask. Uses getReadContract() with JsonRpcProvider.
 * This is the most important page (M7).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, QrCode, AlertCircle, Loader2, Share2, ExternalLink } from 'lucide-react';
import { getReadContract } from '../lib/contract';
import { getMetadata, logScan, submitReport } from '../lib/api';
import { hashMetadata, pickCanonicalFields } from '../lib/metadata';
import { computeVerdict } from '../lib/verdict';
import { getRoleName } from '../lib/roles';
import { VerdictBanner, AddressPill, Timeline, StatusBadge } from '../components/UI';

export default function VerifyPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [batchId,        setBatchId]        = useState(searchParams.get('batch') || '');
  const [result,         setResult]         = useState(null);   // { verdict, batch, metadata, history, scanStats }
  const [loading,        setLoading]        = useState(false);
  const [reportDetails,  setReportDetails]  = useState('');
  const [reportContact,  setReportContact]  = useState('');
  const [reportStatus,   setReportStatus]   = useState(null);   // 'submitting'|'done'|'error'
  const [copyDone,       setCopyDone]       = useState(false);
  const [participants,   setParticipants]   = useState({});

  const verify = useCallback(async (id) => {
    const bid = id?.trim() || batchId.trim();
    if (!bid) return;
    setLoading(true);
    setResult(null);

    try {
      const contract = getReadContract();

      // Get batch from chain
      let batch;
      try {
        batch = await contract.verifyMedicine(bid);
      } catch (rpcErr) {
        console.error('RPC error', rpcErr);
        setResult({ verdict: computeVerdict(null, null) });
        setLoading(false);
        return;
      }

      // Get transfer history
      let history = [];
      if (batch.exists) {
        try {
          history = Array.from(await contract.getTransferHistory(bid));
        } catch (_) {}
      }

      // Build participants lookup for timeline org names
      const pMap = {};
      const addrs = new Set([batch.manufacturer, batch.currentOwner, ...history.flatMap(h => [h.from, h.to])].filter(Boolean));
      for (const addr of addrs) {
        try {
          const p = await contract.participants(addr);
          if (p.authorized) pMap[addr.toLowerCase()] = p;
        } catch (_) {}
      }
      setParticipants(pMap);

      // Check metadata
      let metadata     = null;
      let metadataCheck = null; // 'ok' | 'missing' | 'tampered'

      if (batch.exists) {
        try {
          metadata = await getMetadata(bid);
          // Re-compute hash from backend data and compare with on-chain hash
          const canonical = pickCanonicalFields(metadata);
          const recomputed = hashMetadata(canonical);
          const onChainHash = batch.metadataHash;
          if (recomputed === onChainHash) {
            metadataCheck = 'ok';
          } else {
            metadataCheck = 'tampered';
            console.warn('Hash mismatch:', { recomputed, onChainHash });
          }
        } catch (e) {
          if (e.status === 404) {
            metadataCheck = 'missing';
          } else {
            metadataCheck = 'missing'; // treat other errors as missing
          }
        }
      }

      const now     = Math.floor(Date.now() / 1000);
      const verdict = computeVerdict(batch, metadataCheck, now);

      // Log the scan (no personal data)
      let scanStats = null;
      try {
        scanStats = await logScan(bid, verdict.verdict);
      } catch (_) {}

      setResult({ verdict, batch, metadata, history, scanStats, metadataCheck });

      // Update URL
      setSearchParams({ batch: bid }, { replace: true });

    } catch (err) {
      console.error(err);
      setResult({ verdict: computeVerdict(null, null) });
    }
    setLoading(false);
  }, [batchId, setSearchParams]);

  // Auto-verify if ?batch= in URL on mount
  useEffect(() => {
    const id = searchParams.get('batch');
    if (id) {
      setBatchId(id);
      verify(id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (batchId.trim()) verify(batchId.trim());
  };

  const handleReport = async (e) => {
    e.preventDefault();
    if (!reportDetails.trim()) return;
    setReportStatus('submitting');
    try {
      await submitReport(batchId.trim(), reportDetails.trim(), reportContact.trim() || undefined);
      setReportStatus('done');
      setReportDetails('');
      setReportContact('');
    } catch (_) {
      setReportStatus('error');
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}/?batch=${batchId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 1500);
    });
  };

  const { verdict, batch, metadata, history, scanStats } = result || {};

  const lookup = (addr) => {
    if (!addr) return addr;
    const p = participants[addr.toLowerCase()];
    return p?.organizationName ? `${p.organizationName}` : `${addr.slice(0,6)}…${addr.slice(-4)}`;
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden -z-10 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-indigo-200/40 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-violet-200/40 blur-[120px]" />
      </div>

      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 mb-5 shadow-lg">
            <Search className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-3">
            Verify Medicine{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
              Authenticity
            </span>
          </h1>
          <p className="text-gray-500 text-lg max-w-lg mx-auto">
            Instantly check if your medicine is genuine using blockchain records — no app or account needed.
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex gap-2 bg-white p-2 rounded-2xl shadow-lg border border-gray-100">
            <div className="flex items-center pl-3 text-gray-400">
              <Search className="h-5 w-5" />
            </div>
            <input
              id="batch-id-input"
              type="text"
              value={batchId}
              onChange={e => setBatchId(e.target.value)}
              placeholder="Enter Batch ID (e.g. PHM-CIP-PAR-20260929-001)"
              className="flex-1 px-3 py-3 outline-none text-gray-700 bg-transparent text-sm"
              aria-label="Batch ID"
            />
            <div className="flex gap-1.5">
              <Link
                to="/scan"
                className="flex items-center gap-1.5 px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium transition"
                aria-label="Scan barcode or QR"
              >
                <QrCode className="h-4 w-4" /> Scan
              </Link>
              <button
                type="submit"
                disabled={loading || !batchId.trim()}
                className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'Checking…' : 'Verify'}
              </button>
            </div>
          </div>
        </form>

        {/* Result */}
        {result && (
          <div className="space-y-5 animate-fade-in">
            {/* Verdict banner */}
            <VerdictBanner
              color={verdict.color}
              title={verdict.title}
              message={verdict.message}
            />

            {/* Scan count warning */}
            {scanStats?.warning && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-amber-800">{scanStats.warning}</p>
              </div>
            )}

            {/* Medicine details (if batch exists) */}
            {batch?.exists && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-50 flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {metadata?.medicineName || batch.medicineName}
                    </h2>
                    {metadata?.genericName && (
                      <p className="text-sm text-gray-500">{metadata.genericName}</p>
                    )}
                  </div>
                  <StatusBadge status={batch.status} />
                </div>

                <div className="px-6 py-5 grid grid-cols-2 gap-4 text-sm">
                  <DetailRow label="Batch ID"    value={<span className="font-mono text-xs">{batch.batchId}</span>} />
                  <DetailRow label="Manufacturer" value={lookup(batch.manufacturer)} />
                  <DetailRow label="Manufacture Date" value={fmtDate(batch.manufactureDate)} />
                  <DetailRow label="Expiry Date"      value={fmtDate(batch.expiryDate)} />
                  {metadata?.strength    && <DetailRow label="Strength"    value={metadata.strength} />}
                  {metadata?.dosageForm  && <DetailRow label="Form"        value={metadata.dosageForm} />}
                  {metadata?.quantity    && <DetailRow label="Quantity"    value={`${metadata.quantity} ${metadata.unitType || 'units'}`} />}
                  <DetailRow label="Current Holder" value={
                    <span className="flex items-center gap-2">
                      <span>{lookup(batch.currentOwner)}</span>
                      <AddressPill address={batch.currentOwner} />
                    </span>
                  } />
                  {metadata?.storageInstructions && (
                    <DetailRow label="Storage" value={metadata.storageInstructions} />
                  )}
                </div>

                {/* Metadata tamper note */}
                {result.metadataCheck === 'tampered' && (
                  <div className="mx-6 mb-5 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                    ⚠️ The displayed details did not match the blockchain record. Treat them with caution.
                  </div>
                )}

                {/* Timeline */}
                <div className="px-6 pb-6">
                  <h3 className="text-base font-bold text-gray-800 mb-4">Supply Chain History</h3>
                  <Timeline batch={batch} history={history} participants={participants} />
                </div>
              </div>
            )}

            {/* Share + Report */}
            {batch?.exists && (
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={copyLink}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition shadow-sm"
                >
                  <Share2 className="h-4 w-4" />
                  {copyDone ? 'Copied!' : 'Share link'}
                </button>
                {metadata?.documentCID && (
                  <a
                    href={metadata.documentCID}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition shadow-sm"
                  >
                    <ExternalLink className="h-4 w-4" /> Certificate
                  </a>
                )}
              </div>
            )}

            {/* Report counterfeit */}
            <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
              <h3 className="text-red-700 font-bold mb-3 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" /> Report Suspected Issue
              </h3>
              {reportStatus === 'done' ? (
                <p className="text-green-700 text-sm font-medium">✅ Report submitted. Thank you.</p>
              ) : (
                <form onSubmit={handleReport} className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1" htmlFor="report-details">
                      Describe the issue <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="report-details"
                      value={reportDetails}
                      onChange={e => setReportDetails(e.target.value)}
                      placeholder="e.g. Packaging colour mismatch, seal was broken, tablet looks different…"
                      maxLength={280}
                      rows={3}
                      className="w-full px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-red-300 outline-none resize-none"
                      required
                    />
                    <p className="text-xs text-gray-400 mt-1">{reportDetails.length}/280</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1" htmlFor="report-contact">
                      Contact (optional, for follow-up)
                    </label>
                    <input
                      id="report-contact"
                      type="text"
                      value={reportContact}
                      onChange={e => setReportContact(e.target.value)}
                      placeholder="Your email or phone (not shared publicly)"
                      className="w-full px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-red-300 outline-none"
                    />
                  </div>
                  {reportStatus === 'error' && (
                    <p className="text-red-600 text-sm">Failed to submit. Please try again.</p>
                  )}
                  <button
                    type="submit"
                    disabled={reportStatus === 'submitting' || !reportDetails.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50"
                  >
                    {reportStatus === 'submitting' && <Loader2 className="h-4 w-4 animate-spin" />}
                    Submit Report
                  </button>
                </form>
              )}
            </div>

            {/* Known limitation notice */}
            <p className="text-xs text-gray-400 text-center leading-relaxed">
              ℹ️ A barcode can be photographed and reprinted. This system cannot guarantee the physical pack is genuine —
              it proves the batch was registered by an authorized manufacturer. Repeated scanning of a sold batch may indicate label copying.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div>
      <p className="text-gray-400 text-xs mb-0.5">{label}</p>
      <p className="font-medium text-gray-800 text-sm">{value}</p>
    </div>
  );
}

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(Number(ts) * 1000).toLocaleDateString();
}
