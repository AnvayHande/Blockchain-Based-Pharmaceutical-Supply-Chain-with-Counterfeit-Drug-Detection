import React, { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';

export default function QRScanner() {
  const [scanResult, setScanResult] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let isScannerCleared = false;
    
    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    function onScanSuccess(decodedText, decodedResult) {
      if (isScannerCleared) return;
      
      setScanResult(decodedText);
      
      // Clear scanner once
      isScannerCleared = true;
      scanner.clear().catch(e => console.error("Error clearing scanner on success", e));
      
      try {
        const url = new URL(decodedText);
        if (url.searchParams.has('batch')) {
          navigate(`/?batch=${url.searchParams.get('batch')}`);
        } else {
           navigate(`/?batch=${decodedText}`);
        }
      } catch (e) {
         // Not a URL, maybe just raw batch ID
         navigate(`/?batch=${decodedText}`);
      }
    }

    function onScanFailure(error) {
      // Ignoring typical failures
    }

    scanner.render(onScanSuccess, onScanFailure);

    return () => {
      if (!isScannerCleared) {
        isScannerCleared = true;
        scanner.clear().catch(error => {
          console.error("Failed to clear html5QrcodeScanner on unmount. ", error);
        });
      }
    };
  }, [navigate]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col items-center">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Scan QR Code</h1>
      <p className="text-gray-600 mb-8 text-center max-w-lg">
        Point your camera at the pharmaceutical QR code to verify its authenticity and supply chain history.
      </p>
      
      <div className="w-full max-w-md bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div id="reader" className="w-full"></div>
      </div>
      
      {scanResult && (
        <div className="mt-6 p-4 bg-green-50 text-green-700 rounded-lg">
          <p>Scan successful! Redirecting...</p>
        </div>
      )}
    </div>
  );
}
