import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useWeb3 } from '../context/Web3Context';
import { QRCodeSVG } from 'qrcode.react';

export default function Dashboard() {
  const { account, contract, role, organizationName } = useWeb3();
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form states
  const [batchId, setBatchId] = useState('');
  const [medicineName, setMedicineName] = useState('');
  const [expiryDays, setExpiryDays] = useState(30);
  const [toAddress, setToAddress] = useState('');
  
  const ROLES = {
    "0x0000000000000000000000000000000000000000000000000000000000000000": "Admin",
    "0x708cb58043003a3d537f81ecbe0188ef63a0bb227915570bbd260fbebb4fc9dc": "Manufacturer",
    "0x5db1401311deff6c125d8f6d729cffc548df479f67825d19c3b88b02da76b4fb": "Distributor",
    "0x8929cc6f131a9ef75783305417863bf4bb48b9c6565158abed43953612509b55": "Wholesaler",
    "0x70903332eb7fde617c0da9efcf6c5dd455e90d79d74ce20412dbf551c9d81d29": "Pharmacy"
  };

  const getRoleName = (roleHash) => {
    return ROLES[roleHash] || "Unknown";
  };

  useEffect(() => {
    if (getRoleName(role) === "Manufacturer" && medicineName) {
      const datePart = new Date().toISOString().slice(0,10).replace(/-/g, '');
      let namePart = "UNK";
      if (medicineName.length >= 3) {
        namePart = medicineName.substring(0, 3).toUpperCase();
      } else {
        namePart = medicineName.toUpperCase();
      }
      
      let orgPart = "ORG";
      if (organizationName && organizationName.length >= 3) {
        orgPart = organizationName.substring(0, 3).toUpperCase();
      } else if (organizationName) {
        orgPart = organizationName.toUpperCase();
      }

      setBatchId(`${orgPart}-${namePart}-${datePart}-01`);
    } else if (getRoleName(role) === "Manufacturer" && !medicineName) {
      setBatchId('');
    }
  }, [medicineName, organizationName, role]);

  useEffect(() => {
    const fetchInventory = async () => {
      if (!contract || !account) return;
      try {
        const registeredFilter = contract.filters.MedicineRegistered(null, null, account);
        const registeredEvents = await contract.queryFilter(registeredFilter, 0, "latest");
        
        const transferredFilter = contract.filters.MedicineTransferred(null, null, account);
        const transferredEvents = await contract.queryFilter(transferredFilter, 0, "latest");

        const batchIds = new Set([
          ...registeredEvents.map(e => e.args[0]),
          ...transferredEvents.map(e => e.args[0])
        ]);

        const myItems = [];
        for (const bId of batchIds) {
          const data = await contract.verifyMedicine(bId);
          if (data.currentOwner.toLowerCase() === account.toLowerCase() && data.status !== 5n && data.status !== 6n) {
            myItems.push(data);
          }
        }
        setInventory(myItems);
      } catch (err) {
        console.error("Error fetching inventory:", err);
      }
    };
    fetchInventory();
  }, [contract, account, loading]); // reload inventory when loading state changes (after tx)

  const handleRegisterBatch = async (e) => {
    e.preventDefault();
    if (!contract) return;
    setLoading(true);
    setError(null);
    try {
      const now = Math.floor(Date.now() / 1000);
      const expiry = now + (expiryDays * 24 * 60 * 60);
      const tx = await contract.registerMedicine(batchId, medicineName, now, expiry, "QMDummyHash");
      await tx.wait();
      
      // Save metadata to backend
      await fetch('http://localhost:3001/api/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId,
          additionalInfo: `Registered by ${account}`,
          documents: "QMDummyHash"
        })
      });

      alert("Batch registered successfully!");
      setBatchId('');
      setMedicineName('');
    } catch (err) {
      console.error(err);
      setError(err.reason || err.message);
    }
    setLoading(false);
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!contract) return;
    setLoading(true);
    setError(null);
    try {
      const tx = await contract.transferMedicine(batchId, toAddress, "Transfer TX");
      await tx.wait();
      alert("Batch transferred successfully!");
      setBatchId('');
      setToAddress('');
    } catch (err) {
      console.error(err);
      setError(err.reason || err.message);
    }
    setLoading(false);
  };

  const handleSell = async (e) => {
    e.preventDefault();
    if (!contract) return;
    setLoading(true);
    setError(null);
    try {
      const tx = await contract.sellMedicine(batchId);
      await tx.wait();
      alert("Medicine sold to customer successfully!");
      setBatchId('');
    } catch (err) {
      console.error(err);
      setError(err.reason || err.message);
    }
    setLoading(false);
  };

  if (!account) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
        <h2 className="text-2xl font-bold text-gray-700">Please connect your wallet to view the dashboard.</h2>
      </div>
    );
  }

  const roleName = getRoleName(role);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-lg text-gray-600 mt-2">
          Logged in as: <span className="font-semibold text-indigo-600">{roleName}</span>
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 border border-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Registration Panel (Manufacturer Only) */}
        {roleName === "Manufacturer" && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Register New Batch</h2>
            <form onSubmit={handleRegisterBatch} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Batch ID</label>
                <input 
                  type="text" 
                  value={batchId}
                  onChange={e => setBatchId(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Auto-generated, but editable (e.g., ORG-MED-YYYYMMDD-01)"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Medicine Name</label>
                <input 
                  type="text" 
                  value={medicineName}
                  onChange={e => setMedicineName(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry (Days)</label>
                <input 
                  type="number" 
                  value={expiryDays}
                  onChange={e => setExpiryDays(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Register Batch'}
              </button>
            </form>
          </div>
        )}

        {/* Transfer Panel (All supply chain actors) */}
        {["Manufacturer", "Distributor", "Wholesaler"].includes(roleName) && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Transfer Custody</h2>
            <form onSubmit={handleTransfer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Batch ID</label>
                <input 
                  type="text" 
                  value={batchId}
                  onChange={e => setBatchId(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Receiver Address</label>
                <input 
                  type="text" 
                  value={toAddress}
                  onChange={e => setToAddress(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-2 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 transition disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Transfer'}
              </button>
            </form>
          </div>
        )}

        {/* Sell Panel (Pharmacy Only) */}
        {roleName === "Pharmacy" && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-green-500">
            <h2 className="text-xl font-bold mb-4 text-green-700">Sell to Customer</h2>
            <p className="text-sm text-gray-600 mb-4">Mark a batch as sold. It will no longer be transferable.</p>
            <form onSubmit={handleSell} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Batch ID</label>
                <input 
                  type="text" 
                  value={batchId}
                  onChange={e => setBatchId(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Complete Sale'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Inventory Section */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">My Inventory</h2>
        {inventory.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
            <p className="text-gray-500">You do not have custody of any medicine batches right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {inventory.map((item, idx) => (
              <div key={idx} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition">
                <div className="p-5 border-b border-gray-50 bg-gradient-to-r from-gray-50 to-white">
                  <h3 className="font-bold text-lg text-gray-800">{item.medicineName}</h3>
                  <p className="text-xs font-mono text-gray-500 mt-1">{item.batchId}</p>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Status</span>
                    <span className="font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                      {["REGISTERED", "IN TRANSIT", "AT DISTRIBUTOR", "AT WHOLESALER", "AT PHARMACY", "SOLD", "RECALLED", "EXPIRED"][Number(item.status)]}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Manufactured</span>
                    <span className="font-medium text-gray-800">{new Date(Number(item.manufactureDate) * 1000).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Expiry</span>
                    <span className="font-medium text-gray-800">{new Date(Number(item.expiryDate) * 1000).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="px-5 py-3 bg-gray-50 flex gap-2">
                  <button 
                    onClick={() => {
                      setBatchId(item.batchId);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex-1 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
                  >
                    Select {roleName === "Pharmacy" ? "to Sell" : "for Transfer"}
                  </button>
                  <Link 
                    to={`/?batch=${item.batchId}`}
                    className="flex-1 py-2 bg-indigo-600 text-white text-center rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
                  >
                    Track
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* QR Code Generator */}
      <div className="mt-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
           <h2 className="text-xl font-bold mb-4 text-gray-800 w-full text-left">Generate QR</h2>
           <div className="w-full mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Batch ID for QR</label>
              <input 
                type="text" 
                value={batchId}
                onChange={e => setBatchId(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Enter Batch ID..."
              />
            </div>
           {batchId ? (
             <div className="p-4 bg-white border rounded-xl shadow-inner">
               <QRCodeSVG value={`http://localhost:5173/?batch=${batchId}`} size={200} />
             </div>
           ) : (
             <div className="h-[200px] w-[200px] bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 border-2 border-dashed">
                Enter Batch ID
             </div>
           )}
        </div>
    </div>
  );
}
