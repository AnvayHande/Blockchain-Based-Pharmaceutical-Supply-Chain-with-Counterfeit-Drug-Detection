/**
 * ManufacturerPage (/manufacturer) — M4
 * - Register medicine batches with full form
 * - Auto-generate unique Batch ID (checks chain for collisions)
 * - Show Code 128 barcode + QR after registration
 * - Print/download label
 * - View my batches + transfer to distributor
 * - Recall own batches
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import JsBarcode from 'jsbarcode';
import {
  Factory, Plus, RefreshCw, Printer, Download, Copy,
  AlertCircle, CheckCircle, Loader2, ChevronDown, Package
} from 'lucide-react';
import { useWeb3 } from '../context/Web3Context';
import { ROLES } from '../lib/roles';
import { getReadContract } from '../lib/contract';
import { saveMetadata, getMetadata } from '../lib/api';
import { hashMetadata, pickCanonicalFields } from '../lib/metadata';
import { autoGenerateBatchId } from '../lib/batchId';
import { RoleGuard, PageHeader, StatusBadge, BatchCard, useToast, TxButton, AddressPill, translateError } from '../components/UI';

export default function ManufacturerPage() {
  return (
    <RoleGuard requiredRole={ROLES.MANUFACTURER}>
      <ManufacturerInner />
    </RoleGuard>
  );
}

function ManufacturerInner() {
  const { contract, account, organizationName } = useWeb3();
  const { showToast, ToastComponent } = useToast();

  // Form state
  const [form, setForm] = useState({
    medicineName: '', genericName: '', strength: '', dosageForm: 'tablet',
    quantity: '', unitType: 'strips', manufactureDate: '', expiryDate: '',
    licenceNumber: '', mrp: '', storageInstructions: '', documentCID: '',
  });
  const [batchId,        setBatchId]        = useState('');
  const [generatingId,   setGeneratingId]   = useState(false);
  const [registering,    setRegistering]    = useState(false);
  const [formErrors,     setFormErrors]     = useState({});
  const [labelBatch,     setLabelBatch]     = useState(null);  // show label after success
  const [inventory,      setInventory]      = useState([]);
  const [loadingInv,     setLoadingInv]     = useState(false);
  const [distributors,   setDistributors]   = useState([]);
  const [transferTarget, setTransferTarget] = useState('');
  const [transferBatch,  setTransferBatch]  = useState('');
  const [transferring,   setTransferring]   = useState(false);
  const [recalling,      setRecalling]      = useState('');

  const barcodeRef = useRef(null);
  const labelRef   = useRef(null);

  // ── Generate Batch ID ──────────────────────────────────────────
  const generateId = useCallback(async () => {
    if (!form.medicineName || !organizationName) return;
    setGeneratingId(true);
    try {
      const rc  = getReadContract();
      const id  = await autoGenerateBatchId(rc, organizationName, form.medicineName);
      setBatchId(id);
    } catch (err) {
      showToast(err.message, 'error');
    }
    setGeneratingId(false);
  }, [form.medicineName, organizationName, showToast]);

  useEffect(() => {
    if (form.medicineName && organizationName && !batchId) generateId();
  }, [form.medicineName, organizationName]); // eslint-disable-line

  // ── Load inventory ─────────────────────────────────────────────
  const loadInventory = useCallback(async () => {
    if (!contract || !account) return;
    setLoadingInv(true);
    try {
      const rc = getReadContract();
      const filter = contract.filters.MedicineRegistered(null, null, null, account);
      const events = await contract.queryFilter(filter, 0, 'latest');
      const ids    = [...new Set(events.map(e => e.args[1]))]; // batchId (non-indexed)

      const items = [];
      for (const id of ids) {
        const b = await rc.verifyMedicine(id);
        if (b.exists) items.push(b);
      }
      setInventory(items);
    } catch (err) {
      console.error(err);
    }
    setLoadingInv(false);
  }, [contract, account]);

  // ── Load distributors ──────────────────────────────────────────
  const loadDistributors = useCallback(async () => {
    try {
      const targetContract = contract || getReadContract();
      const filter = targetContract.filters.ParticipantRegistered();
      const events = await targetContract.queryFilter(filter, 0, 'latest');
      const list   = [];
      const seen   = new Set();
      for (const e of events) {
        const addr = e.args[0];
        if (seen.has(addr.toLowerCase())) continue;
        seen.add(addr.toLowerCase());
        try {
          const p = await targetContract.participants(addr);
          if (p.authorized && p.role === ROLES.DISTRIBUTOR) {
            list.push({ address: addr, name: (p.organizationName || e.args[1] || '').trim() });
          }
        } catch (_) {}
      }
      setDistributors(list);
    } catch (err) {
      console.error('Error loading distributors:', err);
    }
  }, [contract]);

  useEffect(() => {
    loadInventory();
    loadDistributors();
  }, [loadInventory, loadDistributors]);

  // ── Draw barcode ───────────────────────────────────────────────
  useEffect(() => {
    if (labelBatch && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, labelBatch.batchId, {
          format:      'CODE128',
          width:       2,
          height:      60,
          displayValue: true,
          fontSize:    12,
          margin:      10,
        });
      } catch (err) {
        console.error('Barcode error', err);
      }
    }
  }, [labelBatch]);

  // ── Validate form ──────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!form.medicineName)    errs.medicineName    = 'Required';
    if (!form.genericName)     errs.genericName     = 'Required';
    if (!form.strength)        errs.strength        = 'Required';
    if (!form.quantity || Number(form.quantity) <= 0) errs.quantity = 'Must be > 0';
    if (!form.manufactureDate) errs.manufactureDate = 'Required';
    if (!form.expiryDate)      errs.expiryDate      = 'Required';
    if (form.expiryDate && form.manufactureDate && form.expiryDate <= form.manufactureDate)
      errs.expiryDate = 'Must be after manufacture date';
    if (!batchId) errs.batchId = 'Generate a Batch ID first';
    return errs;
  };

  // ── Register batch ─────────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setFormErrors(errs); return; }
    setFormErrors({});
    setRegistering(true);

    try {
      const mfgTs = Math.floor(new Date(form.manufactureDate).getTime() / 1000);
      const expTs = Math.floor(new Date(form.expiryDate).getTime() / 1000);
      const qty   = Number(form.quantity);

      // Build canonical metadata
      const metadata = pickCanonicalFields({
        batchId,
        medicineName:        form.medicineName,
        genericName:         form.genericName,
        strength:            form.strength,
        dosageForm:          form.dosageForm,
        quantity:            qty,
        unitType:            form.unitType,
        manufactureDate:     form.manufactureDate,
        expiryDate:          form.expiryDate,
        licenceNumber:       form.licenceNumber,
        mrp:                 form.mrp,
        storageInstructions: form.storageInstructions,
        documentCID:         form.documentCID,
        manufacturerAddress: account,
        createdAt:           new Date().toISOString(),
      });

      const metaHash = hashMetadata(metadata);

      // 1. On-chain tx
      const tx = await contract.registerMedicine(
        batchId,
        form.medicineName,
        mfgTs,
        expTs,
        qty,
        metaHash,
        form.documentCID || ''
      );
      showToast('Transaction sent. Waiting for confirmation...', 'info', tx.hash);
      await tx.wait();

      // 2. Save metadata to backend
      let backendOk = false;
      try {
        await saveMetadata(batchId, metadata);
        backendOk = true;
      } catch (_) {
        showToast('Batch registered on-chain, but metadata could not be saved to backend. Use "Retry" button.', 'warning');
      }

      if (backendOk) showToast('Batch registered successfully!', 'success', tx.hash);

      // Show label
      setLabelBatch({
        batchId,
        medicineName: form.medicineName,
        manufactureDate: form.manufactureDate,
        expiryDate:      form.expiryDate,
        manufacturerName: organizationName,
      });

      // Reset form
      setForm({ medicineName:'', genericName:'', strength:'', dosageForm:'tablet',
        quantity:'', unitType:'strips', manufactureDate:'', expiryDate:'',
        licenceNumber:'', mrp:'', storageInstructions:'', documentCID:'' });
      setBatchId('');

      loadInventory();
    } catch (err) {
      showToast(translateError(err), 'error');
    }
    setRegistering(false);
  };

  // ── Transfer to distributor ────────────────────────────────────
  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!transferBatch || !transferTarget) return;
    setTransferring(true);
    try {
      const tx = await contract.transferMedicine(transferBatch, transferTarget, 'M→D transfer');
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

  // ── Recall own batch ──────────────────────────────────────────
  const handleRecall = async (batch) => {
    if (!window.confirm(`Recall batch ${batch.batchId}? This cannot be undone.`)) return;
    setRecalling(batch.batchId);
    try {
      const tx = await contract.recallMedicine(batch.batchId);
      showToast('Transaction sent. Waiting for confirmation...', 'info', tx.hash);
      await tx.wait();
      showToast(`Batch ${batch.batchId} recalled.`, 'success', tx.hash);
      loadInventory();
    } catch (err) {
      showToast(translateError(err), 'error');
    }
    setRecalling('');
  };

  // ── Print label ───────────────────────────────────────────────
  const handlePrint = () => window.print();

  // ── Download PNG ──────────────────────────────────────────────
  const handleDownload = () => {
    if (!labelRef.current) return;
    const svg = labelRef.current.innerHTML;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href     = url;
    a.download = `label-${labelBatch.batchId}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const field = (key) => ({
    value:    form[key],
    onChange: e => setForm(f => ({ ...f, [key]: e.target.value })),
    className: `w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none ${formErrors[key] ? 'border-red-400 bg-red-50' : 'border-gray-200'}`,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {ToastComponent}
      <PageHeader icon={Factory} title="Manufacturer Dashboard" subtitle={organizationName} color="indigo" />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* ── Registration form ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-5 flex items-center gap-2">
            <Plus className="h-5 w-5 text-indigo-500" /> Register New Batch
          </h2>
          <form onSubmit={handleRegister} className="space-y-4">
            <Row2>
              <Field label="Medicine Name *" error={formErrors.medicineName}>
                <input id="medicine-name" placeholder="e.g. Paracetamol 500mg" {...field('medicineName')} required />
              </Field>
              <Field label="Generic Name *" error={formErrors.genericName}>
                <input id="generic-name" placeholder="e.g. Paracetamol" {...field('genericName')} required />
              </Field>
            </Row2>

            <Row2>
              <Field label="Strength *" error={formErrors.strength}>
                <input id="strength" placeholder="e.g. 500mg" {...field('strength')} required />
              </Field>
              <Field label="Dosage Form">
                <select id="dosage-form" {...field('dosageForm')}>
                  <option value="tablet">Tablet</option>
                  <option value="capsule">Capsule</option>
                  <option value="syrup">Syrup</option>
                  <option value="injection">Injection</option>
                  <option value="other">Other</option>
                </select>
              </Field>
            </Row2>

            <Row2>
              <Field label="Quantity *" error={formErrors.quantity}>
                <input id="quantity" type="number" min="1" placeholder="e.g. 1000" {...field('quantity')} required />
              </Field>
              <Field label="Unit Type">
                <select id="unit-type" {...field('unitType')}>
                  <option value="strips">Strips</option>
                  <option value="bottles">Bottles</option>
                  <option value="vials">Vials</option>
                  <option value="units">Units</option>
                </select>
              </Field>
            </Row2>

            <Row2>
              <Field label="Manufacture Date *" error={formErrors.manufactureDate}>
                <input id="mfg-date" type="date" {...field('manufactureDate')} required />
              </Field>
              <Field label="Expiry Date *" error={formErrors.expiryDate}>
                <input id="exp-date" type="date" {...field('expiryDate')} required />
              </Field>
            </Row2>

            <Row2>
              <Field label="Licence Number">
                <input id="licence" placeholder="e.g. MFG-2026-001" {...field('licenceNumber')} />
              </Field>
              <Field label="MRP (optional)">
                <input id="mrp" placeholder="e.g. ₹45.00" {...field('mrp')} />
              </Field>
            </Row2>

            <Field label="Storage Instructions (optional)">
              <input id="storage" placeholder="e.g. Store below 30°C" {...field('storageInstructions')} />
            </Field>

            <Field label="Certificate/Document URL (optional)">
              <input id="doc-cid" placeholder="https://…" type="url" {...field('documentCID')} />
            </Field>

            {/* Batch ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Batch ID {formErrors.batchId && <span className="text-red-500 text-xs ml-1">{formErrors.batchId}</span>}
              </label>
              <div className="flex gap-2">
                <input
                  id="batch-id"
                  type="text"
                  readOnly
                  value={batchId}
                  placeholder="Auto-generated from medicine + org name"
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono text-gray-700 outline-none"
                />
                <button
                  type="button"
                  onClick={generateId}
                  disabled={generatingId || !form.medicineName}
                  className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-sm font-medium transition flex items-center gap-1 disabled:opacity-50"
                >
                  {generatingId ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Regenerate
                </button>
              </div>
            </div>

            <TxButton
              loading={registering}
              disabled={!batchId}
              variant="primary"
              className="w-full justify-center py-3"
            >
              Register Batch on Blockchain
            </TxButton>
          </form>
        </div>

        {/* ── Right column ── */}
        <div className="space-y-6">
          {/* Label panel */}
          {labelBatch && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6" ref={labelRef}>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Printer className="h-5 w-5 text-indigo-500" /> Batch Label
              </h2>
              <div id="printable-label" className="border border-gray-200 rounded-xl p-5 space-y-4 text-center bg-white">
                {/* Code 128 barcode */}
                <svg ref={barcodeRef} className="w-full" />
                {/* QR code */}
                <div className="flex justify-center mt-3">
                  <QRCodeSVG
                    value={`${window.location.origin}/?batch=${labelBatch.batchId}`}
                    size={140}
                    level="M"
                  />
                </div>
                {/* Text info */}
                <div className="text-xs text-gray-600 space-y-1 mt-3">
                  <p className="text-base font-bold text-gray-900">{labelBatch.medicineName}</p>
                  <p className="font-mono font-semibold">{labelBatch.batchId}</p>
                  <p>Mfg: {labelBatch.manufactureDate} &nbsp;|&nbsp; Exp: {labelBatch.expiryDate}</p>
                  <p className="text-gray-500">{labelBatch.manufacturerName}</p>
                </div>
              </div>
              <div className="flex gap-3 mt-4 flex-wrap">
                <button onClick={handlePrint} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition">
                  <Printer className="h-4 w-4" /> Print Label
                </button>
                <button onClick={handleDownload} className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
                  <Download className="h-4 w-4" /> Download SVG
                </button>
                <button
                  onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/?batch=${labelBatch.batchId}`); showToast('Link copied!', 'success'); }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
                >
                  <Copy className="h-4 w-4" /> Copy Link
                </button>
              </div>
            </div>
          )}

          {/* Transfer panel */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Transfer to Distributor</h2>
            <form onSubmit={handleTransfer} className="space-y-3">
              <Field label="Batch ID">
                <input
                  id="transfer-batch-id"
                  placeholder="PHM-…"
                  value={transferBatch}
                  onChange={e => setTransferBatch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-400 outline-none"
                  required
                />
              </Field>
              <Field label="Select Distributor">
                {distributors.length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">No distributors registered. Ask admin.</p>
                ) : (
                  <select
                    id="distributor-select"
                    value={transferTarget}
                    onChange={e => setTransferTarget(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-400 outline-none"
                    required
                  >
                    <option value="">Choose distributor…</option>
                    {distributors.map(d => (
                      <option key={d.address} value={d.address}>{d.name} ({d.address.slice(0,8)}…)</option>
                    ))}
                  </select>
                )}
              </Field>
              <TxButton loading={transferring} disabled={!transferBatch || !transferTarget} variant="primary" className="w-full justify-center py-3">
                Transfer Custody
              </TxButton>
            </form>
          </div>
        </div>
      </div>

      {/* ── My Batches ── */}
      <div className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Package className="h-6 w-6 text-indigo-500" /> My Batches
        </h2>
        {loadingInv ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-indigo-400" /></div>
        ) : inventory.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
            No batches registered yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {inventory.map(batch => (
              <BatchCard
                key={batch.batchId}
                batch={batch}
                onSelect={b => setTransferBatch(b.batchId)}
                actions={
                  <>
                    {Number(batch.status) !== 6 && (
                      <button
                        onClick={() => handleRecall(batch)}
                        disabled={recalling === batch.batchId}
                        className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-medium transition disabled:opacity-50"
                      >
                        {recalling === batch.batchId ? 'Recalling…' : 'Recall'}
                      </button>
                    )}
                  </>
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Print-only styles */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #printable-label { display: block !important; }
          nav, header, footer { display: none !important; }
        }
      `}</style>
    </div>
  );
}

// ── Form helper components ────────────────────────────────────────
function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {error && <span className="text-red-500 text-xs ml-2">{error}</span>}
      </label>
      {children}
    </div>
  );
}
function Row2({ children }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

