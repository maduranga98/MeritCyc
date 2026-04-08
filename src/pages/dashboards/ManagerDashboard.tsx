import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';

const ManagerDashboard: React.FC = () => {
  const { user } = useAuth();

  const [teamSize, setTeamSize] = useState(0);
  const [openEvals, setOpenEvals] = useState(0);
  const [completedEvals, setCompletedEvals] = useState(0);

  useEffect(() => {
    if (!user || !user.uid) return;

    // Fetch team size directly for now (users where managerId == this manager, or simple query)
    const fetchTeamSize = async () => {
       try {
           const usersSnap = await getDocs(query(collection(db, 'users'), where('managerId', '==', user.uid), where('status', '==', 'active')));
           setTeamSize(usersSnap.size);
       } catch(e) {
           console.error("Failed to fetch team size:", e);
       }
    };
    fetchTeamSize();

    // Fetch eval counts
    const qEvals = query(collection(db, 'evaluations'), where('managerId', '==', user.uid));
    const unsubEvals = onSnapshot(qEvals, snap => {
        let open = 0;
        let completed = 0;
        snap.forEach(doc => {
           const status = doc.data().status;
           if (status === 'not_started' || status === 'draft') open++;
           else if (status === 'submitted' || status === 'overridden' || status === 'finalized') completed++;
        });
        setOpenEvals(open);
        setCompletedEvals(completed);
    });

    return () => unsubEvals();
  }, [user]);

  return (
    <div className="font-brand space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome, {user?.name}!</h1>
        <p className="text-sm text-slate-500 mt-1">Here is a quick overview of your team's evaluation progress.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
             <p className="text-sm text-slate-500 font-medium mb-2">My Team Size</p>
             <p className="text-3xl font-bold text-slate-900">{teamSize}</p>
          </div>
          <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
             <p className="text-sm text-slate-500 font-medium mb-2">Open Evaluations</p>
             <p className={`text-3xl font-bold ${openEvals > 0 ? 'text-red-600' : 'text-slate-900'}`}>{openEvals}</p>
          </div>
          <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
             <p className="text-sm text-slate-500 font-medium mb-2">Completed Evaluations</p>
             <p className="text-3xl font-bold text-emerald-600">{completedEvals}</p>
          </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Quick Actions</h2>
          <div className="flex gap-4">
              <Link
                  to="/evaluations"
                  className="px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
              >
                  Go to Evaluations
              </Link>
          </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;
