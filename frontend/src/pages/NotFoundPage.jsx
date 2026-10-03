import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-6 text-center px-4">
      <div className="bg-gray-100 p-5 rounded-2xl">
        <ShieldOff className="h-14 w-14 text-gray-400 mx-auto" />
      </div>
      <div>
        <h1 className="text-4xl font-extrabold text-gray-900 mb-2">404 — Not Found</h1>
        <p className="text-gray-500">This page doesn't exist.</p>
      </div>
      <Link
        to="/"
        className="px-6 py-3 bg-indigo-600 text-white rounded-full font-semibold hover:bg-indigo-700 transition"
      >
        Go to Verify page
      </Link>
    </div>
  );
}
