import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { cycleService } from '../../services/cycleService';
import { evaluationService } from '../../services/evaluationService';
import { type Cycle } from '../../types/cycle';
import { type Evaluation } from '../../types/evaluation';
import { useNavigate } from 'react-router-dom';
import { Loader2, ClipboardList, Clock, CheckCircle2 } from 'lucide-react';
import { differenceInDays } from 'date-fns';

export default function ManagerEvaluationsHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.companyId) return;

    const unsubCycles = cycleService.subscribeToCycles(user.companyId, (cyclesData) => {
      setCycles(cyclesData);
    });

    return () => unsubCycles();
  }, [user?.companyId]);

  useEffect(() => {
    if (!user?.uid) return;

    const unsubEvals = evaluationService.getManagerEvaluations(user.uid, undefined, (evalsData) => {
      setEvaluations(evalsData);
      setLoading(false);
    });

    return () => unsubEvals();
  }, [user?.uid]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  // Find cycles where manager has evaluations
  const cycleIdsWithEvals = new Set(evaluations.map(e => e.cycleId));
  const relevantCycles = cycles.filter(c => cycleIdsWithEvals.has(c.id));

  const activeCycles = relevantCycles.filter(c => c.status === 'active' || c.status === 'locked');
  const completedCycles = relevantCycles.filter(c => c.status === 'completed');

  const renderActiveCycleCard = (cycle: Cycle) => {
    const cycleEvals = evaluations.filter(e => e.cycleId === cycle.id);
    const total = cycleEvals.length;
    const completed = cycleEvals.filter(e => e.status === 'submitted' || e.status === 'finalized' || e.status === 'overridden').length;
    const progressPercent = total > 0 ? (completed / total) * 100 : 0;

    const daysRemaining = cycle.timeline?.evaluationDeadline
      ? differenceInDays(cycle.timeline.evaluationDeadline.toDate(), new Date())
      : null;

    let deadlineColor = "text-slate-500";
    if (daysRemaining !== null) {
        if (daysRemaining < 3) deadlineColor = "text-red-600 font-bold animate-pulse";
        else if (daysRemaining < 7) deadlineColor = "text-amber-600 font-medium";
    }

    return (
      <div key={cycle.id} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start mb-4">
            <div>
               <h3 className="text-lg font-bold text-slate-900">{cycle.name}</h3>
               <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mt-2 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                  Active
               </span>
            </div>
            {daysRemaining !== null && (
                <div className="text-right">
                    <p className="text-xs text-slate-500 mb-1 flex items-center gap-1 justify-end">
                       <Clock className="w-3.5 h-3.5"/> Deadline
                    </p>
                    <p className={`text-sm ${deadlineColor}`}>
                        {daysRemaining < 0 ? 'Overdue' : `${daysRemaining} days remaining`}
                    </p>
                </div>
            )}
        </div>

        <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-600 font-medium">{completed} of {total} evaluated</span>
                <span className="text-emerald-600 font-bold">{Math.round(progressPercent)}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5">
                <div className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
            </div>
        </div>

        <button
            onClick={() => navigate(`/evaluations/${cycle.id}`)}
            className="w-full py-2.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
        >
            <ClipboardList className="w-4 h-4" />
            {completed === total ? 'View Evaluations' : 'Continue Evaluating'}
        </button>
      </div>
    );
  };

  return (
    <div className="font-brand space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Team Evaluations</h1>
        <p className="text-sm text-slate-500 mt-1">Manage performance evaluations for your direct reports.</p>
      </div>

      <section>
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
             <Clock className="w-5 h-5 text-blue-500"/>
             Active Cycles
          </h2>

          {activeCycles.length === 0 ? (
             <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
                 <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                 <h3 className="text-slate-700 font-medium">No active evaluation cycles assigned to your team</h3>
             </div>
          ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {activeCycles.map(renderActiveCycleCard)}
             </div>
          )}
      </section>

      {completedCycles.length > 0 && (
          <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                 <CheckCircle2 className="w-5 h-5 text-emerald-500"/>
                 Completed Evaluations
              </h2>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  {completedCycles.map(cycle => (
                      <div key={cycle.id} className="border-b border-slate-100 last:border-0 p-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => navigate(`/evaluations/${cycle.id}`)}>
                          <div>
                              <h4 className="font-bold text-slate-900">{cycle.name}</h4>
                              <p className="text-xs text-slate-500 mt-0.5">Completed on {cycle.updatedAt?.toDate().toLocaleDateString()}</p>
                          </div>
                          <div className="text-sm font-medium text-slate-600">
                              {evaluations.filter(e => e.cycleId === cycle.id).length} team members
                          </div>
                      </div>
                  ))}
              </div>
          </section>
      )}
    </div>
  );
}