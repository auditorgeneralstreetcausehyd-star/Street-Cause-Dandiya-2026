'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface PassRecord {
  id: string;
  order_id: string;
  code: string;
  name: string;
  email: string;
  phone: string;
  item_name: string;
  item_quantity: number;
  item_payment_amount: number;
  payment_status: string;
  divisions: string;
  l2: string;
  attendance_status: 'PENDING' | 'PRESENT' | 'CANCELLED';
  checked_in_at?: string | null;
}

function VerifyContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code') || '';

  const [passcode, setPasscode] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [record, setRecord] = useState<PassRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  // Check saved admin passcode in localStorage
  useEffect(() => {
    const savedCode = localStorage.getItem('sc_admin_passcode');
    if (savedCode) {
      setPasscode(savedCode);
      setIsAuthenticated(true);
    }
  }, []);

  // Fetch record when authenticated and code is present
  useEffect(() => {
    if (isAuthenticated && code) {
      fetchPassRecord();
    }
  }, [isAuthenticated, code]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setError('Please enter the Admin Passcode');
      return;
    }
    localStorage.setItem('sc_admin_passcode', passcode.trim());
    setIsAuthenticated(true);
    setError(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('sc_admin_passcode');
    setIsAuthenticated(false);
    setRecord(null);
    setPasscode('');
  };

  const fetchPassRecord = async () => {
    if (!code) return;
    setLoading(true);
    setError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/verify?code=${encodeURIComponent(code)}`, {
        headers: {
          'x-admin-passcode': passcode || localStorage.getItem('sc_admin_passcode') || '',
        },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.isAuthError) {
          setIsAuthenticated(false);
          localStorage.removeItem('sc_admin_passcode');
          setError('Invalid Admin Passcode. Access denied.');
        } else {
          setError(data.error || 'Pass details not found.');
        }
        setRecord(null);
      } else {
        setRecord(data.record);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect to verification server.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: 'PRESENT' | 'CANCELLED') => {
    if (!code || updating) return;
    setUpdating(true);
    setError(null);
    setActionSuccess(null);

    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-passcode': passcode || localStorage.getItem('sc_admin_passcode') || '',
        },
        body: JSON.stringify({
          code,
          status: newStatus,
          passcode: passcode || localStorage.getItem('sc_admin_passcode') || '',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.isAuthError) {
          setIsAuthenticated(false);
          localStorage.removeItem('sc_admin_passcode');
          setError('Invalid Admin Passcode. Access denied.');
        } else {
          setError(data.error || 'Failed to update attendance status.');
        }
      } else {
        setActionSuccess(data.message || `Pass marked as ${newStatus}!`);
        if (record) {
          setRecord({ ...record, attendance_status: newStatus });
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process request.');
    } finally {
      setUpdating(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 002-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Organiser Login</h1>
            <p className="text-sm text-slate-400 mt-2">Enter the Admin Passcode to verify attendee passes</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm font-medium text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Admin Passcode
              </label>
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter admin passcode"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white font-semibold rounded-xl shadow-lg transition duration-200"
            >
              Authenticate & Verify
            </button>
          </form>

          <div className="mt-8 text-center text-xs text-slate-500">
            Street Cause Hyderabad • SC Dandiya 2026
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-2xl mx-auto">

        {/* Top Navigation / Header */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-800">
          <div>
            <span className="text-xs uppercase tracking-widest text-amber-500 font-bold">SC Dandiya 2026</span>
            <h1 className="text-2xl font-black text-white">Pass Verification Portal</h1>
          </div>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-medium text-slate-300 transition"
          >
            Logout
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm font-medium">
            ⚠️ {error}
          </div>
        )}

        {actionSuccess && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm font-medium">
            ✅ {actionSuccess}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
            <div className="inline-block animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full mb-4"></div>
            <p className="text-slate-400 font-medium">Retrieving pass details...</p>
          </div>
        )}

        {/* No Code Provided */}
        {!loading && !code && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
            <svg className="w-12 h-12 text-slate-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <p className="text-slate-300 font-semibold text-lg">No Pass Code Scanned</p>
            <p className="text-slate-500 text-sm mt-1">Please scan a valid event pass QR code using your mobile camera.</p>
          </div>
        )}

        {/* Pass Details View */}
        {!loading && record && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-amber-500 to-rose-600 p-6 text-white flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase font-bold tracking-wider opacity-90">Garba Groove 2026 Pass</div>
                <div className="text-2xl font-black mt-0.5">{record.name}</div>
                <div className="text-xs font-mono opacity-90 mt-1">CODE: {record.code}</div>
              </div>

              {/* Status Badge */}
              <div className="px-4 py-2 rounded-xl font-bold uppercase tracking-wider text-xs shadow-md bg-white/20 backdrop-blur-md text-white border border-white/30">
                {record.attendance_status === 'PRESENT' && '🟢 PRESENT (Checked-In)'}
                {record.attendance_status === 'CANCELLED' && '🔴 CANCELLED'}
                {(!record.attendance_status || record.attendance_status === 'PENDING') && '🟡 PENDING'}
              </div>
            </div>

            {/* Grid Information */}
            <div className="p-6 md:p-8 space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                
                <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
                  <span className="text-xs uppercase font-bold text-slate-400 block mb-1">Attendee Name</span>
                  <span className="text-white font-semibold text-base">{record.name}</span>
                </div>

                <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
                  <span className="text-xs uppercase font-bold text-slate-400 block mb-1">Pass Code / Order ID</span>
                  <span className="text-amber-400 font-mono font-bold text-base">{record.code}</span>
                </div>

                <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
                  <span className="text-xs uppercase font-bold text-slate-400 block mb-1">Mobile Number</span>
                  <span className="text-white font-medium">{record.phone || 'N/A'}</span>
                </div>

                <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
                  <span className="text-xs uppercase font-bold text-slate-400 block mb-1">Email Address</span>
                  <span className="text-white font-medium">{record.email || 'N/A'}</span>
                </div>

                <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
                  <span className="text-xs uppercase font-bold text-slate-400 block mb-1">Admits (Quantity)</span>
                  <span className="text-white font-bold text-lg">{record.item_quantity} Person(s)</span>
                </div>

                <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
                  <span className="text-xs uppercase font-bold text-slate-400 block mb-1">Amount Paid</span>
                  <span className="text-emerald-400 font-bold text-lg">₹{record.item_payment_amount}/-</span>
                </div>

                <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
                  <span className="text-xs uppercase font-bold text-slate-400 block mb-1">Date & Venue</span>
                  <span className="text-white font-medium">10 Oct 2026 • Telangana Gardens, New Bowenpally</span>
                </div>

                <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
                  <span className="text-xs uppercase font-bold text-slate-400 block mb-1">L1 & L2 Volunteers</span>
                  <span className="text-white font-medium">L1: {record.divisions || 'N/A'} • L2: {record.l2 || 'N/A'}</span>
                </div>

              </div>

              {/* Action Buttons for Organisers */}
              <div className="pt-6 border-t border-slate-800">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
                  Organiser Actions
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  <button
                    onClick={() => handleUpdateStatus('PRESENT')}
                    disabled={updating}
                    className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition text-base"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                    Mark Present
                  </button>

                  <button
                    onClick={() => handleUpdateStatus('CANCELLED')}
                    disabled={updating}
                    className="w-full py-4 px-6 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition text-base"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancel Pass
                  </button>

                </div>
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-400">Loading page...</p>
        </div>
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}
