import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { db } from '../../config/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const HRAdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!user || !user.companyId) return;

    const q = query(
      collection(db, 'companies', user.companyId, 'pendingRegistrations'),
      where('status', 'in', ['pending_approval', 'info_requested'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendingCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <div className="p-8 font-brand">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-merit-navy">HR Admin Dashboard</h1>
        <button onClick={logout} className="bg-red-500 text-white px-4 py-2 rounded">Logout</button>
      </div>
      <p>Welcome, {user?.name}!</p>

      <div className="mt-6 bg-white p-6 rounded shadow flex flex-col gap-4">
        <h2 className="text-xl font-bold mb-2">Actions</h2>

        <Link
          to="/hr/people/approvals"
          className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <span className="font-semibold text-slate-800">Pending Approvals</span>
          {pendingCount > 0 && (
            <span className="flex items-center justify-center w-6 h-6 bg-emerald-500 text-white text-xs font-bold rounded-full">
              {pendingCount}
            </span>
          )}
        </Link>

        <ul className="list-disc pl-5 mt-2">
          <li>Define criteria</li>
          <li>Run simulations</li>
          <li>Manage increment cycles</li>
        </ul>
      </div>
    </div>
  );
};

export default HRAdminDashboard;
