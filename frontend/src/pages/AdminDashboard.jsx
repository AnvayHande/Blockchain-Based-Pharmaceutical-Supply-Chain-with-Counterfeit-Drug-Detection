import React, { useState } from 'react';
import { useWeb3 } from '../context/Web3Context';

export default function AdminDashboard() {
  const { account, contract, role } = useWeb3();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Participant form
  const [walletAddress, setWalletAddress] = useState('');
  const [orgName, setOrgName] = useState('');
  const [participantRole, setParticipantRole] = useState('1'); // Default to Manufacturer

  // Recall form
  const [recallBatchId, setRecallBatchId] = useState('');

  const ROLES = {
    "0x0000000000000000000000000000000000000000000000000000000000000000": "Admin",
  };

  const isAdmin = ROLES[role] === "Admin";

  const handleRegisterParticipant = async (e) => {
    e.preventDefault();
    if (!contract) return;
    setLoading(true);
    setError(null);
    try {
      // 1=Manufacturer, 2=Distributor, 3=Wholesaler, 4=Pharmacy
      const tx = await contract.registerParticipant(walletAddress, orgName, parseInt(participantRole));
      await tx.wait();
      alert("Participant registered successfully!");
      setWalletAddress('');
      setOrgName('');
    } catch (err) {
      console.error(err);
      setError(err.reason || err.message);
    }
    setLoading(false);
  };

  const handleRecallMedicine = async (e) => {
    e.preventDefault();
    if (!contract) return;
    setLoading(true);
    setError(null);
    try {
      const tx = await contract.recallMedicine(recallBatchId);
      await tx.wait();
      alert("Medicine batch recalled successfully!");
      setRecallBatchId('');
    } catch (err) {
      console.error(err);
      setError(err.reason || err.message);
    }
    setLoading(false);
  };

  if (!account || !isAdmin) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
        <h2 className="text-2xl font-bold text-gray-700">Access Denied. Admin privileges required.</h2>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin/Regulator Dashboard</h1>
        <p className="text-lg text-gray-600 mt-2">Manage participants and oversee recalls.</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 border border-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold mb-4 text-gray-800">Register Supply Chain Participant</h2>
          <form onSubmit={handleRegisterParticipant} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Wallet Address</label>
              <input 
                type="text" 
                value={walletAddress}
                onChange={e => setWalletAddress(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
              <input 
                type="text" 
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select 
                value={participantRole}
                onChange={e => setParticipantRole(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="1">Manufacturer</option>
                <option value="2">Distributor</option>
                <option value="3">Wholesaler</option>
                <option value="4">Pharmacy</option>
              </select>
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Register Participant'}
            </button>
          </form>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100 border-t-4 border-t-red-500">
          <h2 className="text-xl font-bold mb-4 text-red-600">Recall Medicine Batch</h2>
          <p className="text-sm text-gray-600 mb-4">Emergency action to mark a batch as unsafe.</p>
          <form onSubmit={handleRecallMedicine} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Batch ID</label>
              <input 
                type="text" 
                value={recallBatchId}
                onChange={e => setRecallBatchId(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                required
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Issue Recall'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
