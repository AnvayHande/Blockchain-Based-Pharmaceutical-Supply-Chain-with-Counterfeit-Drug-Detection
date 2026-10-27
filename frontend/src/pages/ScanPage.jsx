/**
 * ScanPage — barcode/QR scanner that works on camera.
 * Extended from the existing QRScanner to support:
 * - QR_CODE and CODE_128 formats
 * - Back camera default on mobile
 * - Camera permission denied handling
 * - URL (?batch=) and raw batch ID extraction
 */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, CameraOff, QrCode, Loader2 } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

export default function ScanPage() {
  const scannerRef  = useRef(null);
  const mountedRef  = useRef(true);
  const [scanning,  setScanning]  = useState(false);
  const [error,     setError]     = useState(null);
  const [detected,  setDetected]  = useState(null);
  const navigate    = useNavigate();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Stop any running scanner on unmount
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const startScan = async () => {
    setError(null);
    setDetected(null);
    setScanning(true);

    const formats = [
      Html5QrcodeSupportedFormats.QR_CODE,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
    ];

    try {
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras || cameras.length === 0) {
        setError('No camera found on this device.');
        setScanning(false);
        return;
      }
      // Prefer back camera on phones
      const backCamera = cameras.find(c =>
        c.label.toLowerCase().includes('back') ||
        c.label.toLowerCase().includes('rear') ||
        c.label.toLowerCase().includes('environment')
      );
      const cameraId = backCamera?.id || cameras[cameras.length - 1].id;

      const html5Qr = new Html5Qrcode('qr-reader', { formatsToSupport: formats, verbose: false });
      scannerRef.current = html5Qr;

      await html5Qr.start(
        cameraId,
        { fps: 10, qrbox: { width: 280, height: 200 } },
        (decodedText) => {
          if (!mountedRef.current) return;
          // Extract batch ID from URL or treat raw text as batch ID
          let batchId = decodedText.trim();
          try {
            const url = new URL(decodedText);
            const param = url.searchParams.get('batch');
            if (param) batchId = param;
          } catch (_) {
            // Not a URL — use raw text as batch ID
          }

          setDetected(batchId);
          html5Qr.stop().catch(() => {}).finally(() => {
            if (mountedRef.current) setScanning(false);
          });
        },
        () => {} // ignore per-frame errors
      );
    } catch (err) {
      if (!mountedRef.current) return;
      if (err.name === 'NotAllowedError' || String(err).toLowerCase().includes('permission')) {
        setError('Camera permission denied. Please allow camera access in your browser settings and try again.');
      } else {
        setError(`Camera error: ${err.message || err}`);
      }
      setScanning(false);
    }
  };

  const stopScan = () => {
    scannerRef.current?.stop().catch(() => {});
    setScanning(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setDetected(null);
    
    if (scanning) {
      stopScan();
    }

    try {
      const html5Qr = new Html5Qrcode('qr-reader');
      const decodedText = await html5Qr.scanFile(file, true);
      
      let batchId = decodedText.trim();
      try {
        const url = new URL(decodedText);
        const param = url.searchParams.get('batch');
        if (param) batchId = param;
      } catch (_) {}
      
      setDetected(batchId);
    } catch (err) {
      setError("Could not find a valid QR code in the image. Please try another one.");
    }
    
    // Clear input
    e.target.value = '';
  };

  const goVerify = () => {
    if (detected) navigate(`/?batch=${encodeURIComponent(detected)}`);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 flex flex-col items-center justify-start px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 mb-4 shadow-lg">
            <QrCode className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Scan Label</h1>
          <p className="text-gray-500">
            Scan the QR code or barcode printed on the medicine pack to instantly verify it.
            Supports QR and Code 128.
          </p>
        </div>

        {/* Scanner viewport */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-6">
          <div
            id="qr-reader"
            className={`w-full transition-all duration-300 ${scanning ? 'min-h-[280px]' : 'min-h-[120px]'} bg-black`}
          />
          {!scanning && !detected && (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Camera className="h-8 w-8 mr-2 opacity-40" />
              <span className="text-sm">Camera not active</span>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-5 text-sm text-red-700">
            <CameraOff className="h-5 w-5 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* Detected */}
        {detected && !scanning && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-5 text-center">
            <p className="text-sm text-green-700 font-medium mb-1">✅ Code detected!</p>
            <p className="text-lg font-bold text-gray-900 font-mono break-all">{detected}</p>
            <button
              onClick={goVerify}
              className="mt-4 w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:opacity-90 transition"
            >
              Verify this batch →
            </button>
            <button
              onClick={() => { setDetected(null); startScan(); }}
              className="mt-2 w-full py-2 text-gray-600 text-sm hover:underline"
            >
              Scan another
            </button>
          </div>
        )}

        {/* Controls */}
        {!detected && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              {!scanning ? (
                <button
                  onClick={startScan}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-semibold shadow-lg hover:opacity-90 transition"
                >
                  <Camera className="h-5 w-5" /> Start Camera
                </button>
              ) : (
                <button
                  onClick={stopScan}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-red-600 text-white rounded-2xl font-semibold shadow-lg hover:bg-red-700 transition"
                >
                  <Loader2 className="h-5 w-5 animate-spin" /> Stop Scanning
                </button>
              )}
            </div>
            
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                title="Upload Image"
              />
              <div className="flex items-center justify-center gap-2 py-3.5 bg-white text-indigo-600 border-2 border-indigo-100 rounded-2xl font-semibold shadow-sm hover:bg-indigo-50 transition pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload Image
              </div>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center mt-6">
          Camera scanning requires HTTPS or localhost. On a phone, ensure the browser has camera permission.
        </p>
      </div>
    </div>
  );
}
