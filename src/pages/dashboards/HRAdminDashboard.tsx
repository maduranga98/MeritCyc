import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { db } from '../../config/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const HRAdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [evalSubmitted, setEvalSubmitted] = useState(0);
  const [evalPending, setEvalPending] = useState(0);

  useEffect(() => {
    if (!user || !user.companyId) return;

    const q = query(
      collection(db, 'companies', user.companyId, 'pendingRegistrations'),
      where('status', 'in', ['pending_approval', 'info_requested'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendingCount(snapshot.size);
    });

    const qEvals = query(collection(db, 'evaluations'), where('companyId', '==', user.companyId));
    const unsubEvals = onSnapshot(qEvals, snap => {
        let submitted = 0;
        let pending = 0;
        snap.forEach(doc => {
            const status = doc.data().status;
            if (status === 'submitted' || status === 'overridden') submitted++;
            else if (status === 'not_started' || status === 'draft') pending++;
        });
        setEvalSubmitted(submitted);
        setEvalPending(pending);
    });

    return () => {
        unsubscribe();
        unsubEvals();
    };
  }, [user]);

  return (
    <div className="font-brand space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-slate-900">Welcome, {user?.name}!</h1>
            <p className="text-sm text-slate-500 mt-1">Here is a quick overview of your HR operations.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
             <p className="text-sm text-slate-500 font-medium mb-2">Pending Approvals</p>
             <p className={`text-3xl font-bold ${pendingCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{pendingCount}</p>
          </div>
          <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
             <p className="text-sm text-slate-500 font-medium mb-2">Evaluations Submitted</p>
             <p className="text-3xl font-bold text-emerald-600">{evalSubmitted}</p>
          </div>
          <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
             <p className="text-sm text-slate-500 font-medium mb-2">Pending Submission</p>
             <p className={`text-3xl font-bold ${evalPending > 0 ? 'text-red-600' : 'text-slate-900'}`}>{evalPending}</p>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Quick Actions</h2>
              <div className="flex flex-col gap-3">
                  <Link
                    to="/hr/people/approvals"
                    className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <span className="font-semibold text-slate-800">Review Pending Approvals</span>
                  </Link>
                  <Link
                    to="/evaluations/review"
                    className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                  >
                    <span className="font-semibold text-emerald-800">Review Scores</span>
                  </Link>
                  <Link
                    to="/cycles"
                    className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <span className="font-semibold text-slate-800">Manage Cycles</span>
                  </Link>
              </div>
          </div>
      </div>
    </div>
  );
};

export default HRAdminDashboard;
