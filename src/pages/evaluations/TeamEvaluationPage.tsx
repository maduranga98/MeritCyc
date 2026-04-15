import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { cycleService } from '../../services/cycleService';
import { evaluationService } from '../../services/evaluationService';
import { departmentService } from '../../services/departmentService';
import { type Cycle } from '../../types/cycle';
import { type Evaluation } from '../../types/evaluation';
import { type Department } from '../../types/department';
import { Loader2, ArrowLeft, Clock, Users, Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { DeadlineReminder } from '../../components/evaluations/DeadlineReminder';
import { EvaluationForm } from '../../components/evaluations/EvaluationForm';
import { toast } from 'sonner';

export default function TeamEvaluationPage() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);
  const [isSendingReminder, setIsSendingReminder] = useState(false);

  useEffect(() => {
    if (!user?.companyId || !user?.uid || !cycleId) return;

    const unsubCycle = cycleService.subscribeToCycle(cycleId, (data) => {
      setCycle(data);
      if (!data) setLoading(false);
    });

    const unsubEvals = evaluationService.getManagerEvaluations(user.uid, cycleId, (data) => {
      setEvaluations(data);
      setLoading(false);

      // Update selected evaluation if it's currently open
      if (selectedEvaluation) {
         const updated = data.find(e => e.id === selectedEvaluation.id);
         if (updated) setSelectedEvaluation(updated);
      }
    });

    departmentService.getDepartments(user.companyId).then(setDepartments).catch(() => {});

    return () => {
      unsubCycle();
      unsubEvals();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleId, user]); // removing selectedEvaluation?.id for same reason.

  const handleSendReminder = async () => {
    if (!cycleId) return;
    setIsSendingReminder(true);
    try {
      await evaluationService.requestEvaluationDeadlineReminder(cycleId);
      toast.success('Reminder sent to team members with pending evaluations');
    } catch (err) {
      toast.error('Failed to send reminder');
    } finally {
      setIsSendingReminder(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!cycle) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Cycle not found.</p>
        <button onClick={() => navigate('/evaluations')} className="mt-4 text-sm text-emerald-600 hover:underline">
          Back to Evaluations
        </button>
      </div>
    );
  }

  // Stats
  const total = evaluations.length;
  const notStarted = evaluations.filter(e => e.status === 'not_started').length;
  const inProgress = evaluations.filter(e => e.status === 'draft').length;
  const submitted = evaluations.filter(e => e.status === 'submitted' || e.status === 'overridden' || e.status === 'finalized').length;

  // Sorting: not_started -> draft -> submitted -> overridden -> finalized
  const statusOrder: Record<string, number> = {
      'not_started': 1,
      'draft': 2,
      'submitted': 3,
      'overridden': 4,
      'finalized': 5
  };

  const sortedEvaluations = [...evaluations].sort((a, b) => {
      const orderA = statusOrder[a.status] || 99;
      const orderB = statusOrder[b.status] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.employeeName.localeCompare(b.employeeName);
  });

  const getStatusBadge = (status: string) => {
      switch(status) {
          case 'not_started': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-600">Not Started</span>;
          case 'draft': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">In Progress</span>;
          case 'submitted': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700">Submitted</span>;
          case 'overridden': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">Overridden by HR</span>;
          case 'finalized': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">Finalized</span>;
          default: return null;
      }
  };

  const getDepartmentName = (id: string) => departments.find(d => d.id === id)?.name || 'Unknown Dept';

  return (
    <div className="font-brand space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
          <div>
              <button
                onClick={() => navigate('/evaluations')}
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Hub
              </button>
              <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-slate-900">{cycle.name}</h1>
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">Active</span>
              </div>
          </div>
          <div className="text-right flex items-center gap-6">
              {cycle.timeline?.evaluationDeadline && (
                  <DeadlineReminder
                    deadlineDate={cycle.timeline.evaluationDeadline.toDate()}
                    variant="header"
                    showDate={true}
                  />
              )}
              <button
                  onClick={handleSendReminder}
                  disabled={isSendingReminder || cycle.status === 'completed'}
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                  {isSendingReminder ? <Loader2 className="w-4 h-4 animate-spin"/> : <Mail className="w-4 h-4"/>}
                  Send Reminder
              </button>
          </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 p-5 rounded-xl flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                  <Users className="w-5 h-5"/>
              </div>
              <div>
                  <p className="text-xs text-slate-500 font-medium">Total Team</p>
                  <p className="text-xl font-bold text-slate-900">{total}</p>
              </div>
          </div>
          <div className="bg-white border border-slate-200 p-5 rounded-xl flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-600">
                  <AlertCircle className="w-5 h-5"/>
              </div>
              <div>
                  <p className="text-xs text-slate-500 font-medium">Not Started</p>
                  <p className="text-xl font-bold text-slate-900">{notStarted}</p>
              </div>
          </div>
          <div className="bg-white border border-slate-200 p-5 rounded-xl flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
                  <Clock className="w-5 h-5"/>
              </div>
              <div>
                  <p className="text-xs text-slate-500 font-medium">In Progress</p>
                  <p className="text-xl font-bold text-slate-900">{inProgress}</p>
              </div>
          </div>
          <div className="bg-white border border-slate-200 p-5 rounded-xl flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="w-5 h-5"/>
              </div>
              <div>
                  <p className="text-xs text-slate-500 font-medium">Submitted</p>
                  <p className="text-xl font-bold text-slate-900">{submitted}</p>
              </div>
          </div>
      </div>

      {/* Team List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs uppercase font-semibold">
                  <tr>
                      <th className="px-6 py-4">Employee</th>
                      <th className="px-6 py-4">Department / Band</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Score & Tier</th>
                      <th className="px-6 py-4 text-right">Action</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                  {sortedEvaluations.map(evaluation => (
                      <tr key={evaluation.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold border border-emerald-200">
                                      {evaluation.employeeName.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                      <p className="font-bold text-slate-900">{evaluation.employeeName}</p>
                                      <p className="text-xs text-slate-500">{evaluation.employeeEmail}</p>
                                  </div>
                              </div>
                          </td>
                          <td className="px-6 py-4">
                              <p className="font-medium text-slate-700">{getDepartmentName(evaluation.departmentId)}</p>
                              <p className="text-xs text-slate-500">{evaluation.salaryBandId ? 'Band set' : 'No band'}</p>
                          </td>
                          <td className="px-6 py-4">
                              {getStatusBadge(evaluation.status)}
                          </td>
                          <td className="px-6 py-4">
                              {(evaluation.status === 'draft' || evaluation.status === 'submitted' || evaluation.status === 'overridden' || evaluation.status === 'finalized') ? (
                                  <div>
                                      <p className="font-bold text-slate-900">{evaluation.weightedTotalScore?.toFixed(1)} / 100</p>
                                      {evaluation.assignedTierName && (
                                          <p className="text-xs text-slate-500 font-medium mt-0.5">{evaluation.assignedTierName}</p>
                                      )}
                                  </div>
                              ) : (
                                  <span className="text-slate-400">—</span>
                              )}
                          </td>
                          <td className="px-6 py-4 text-right">
                              {evaluation.status === 'not_started' || evaluation.status === 'draft' ? (
                                  <button
                                      onClick={() => setSelectedEvaluation(evaluation)}
                                      className="px-4 py-2 bg-emerald-50 text-emerald-700 font-semibold rounded-lg hover:bg-emerald-100 transition-colors"
                                  >
                                      Evaluate
                                  </button>
                              ) : (
                                  <button
                                      onClick={() => setSelectedEvaluation(evaluation)}
                                      className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
                                  >
                                      View {evaluation.status === 'submitted' && '/ Edit'}
                                  </button>
                              )}
                          </td>
                      </tr>
                  ))}
                  {sortedEvaluations.length === 0 && (
                      <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                              No team members found for this cycle.
                          </td>
                      </tr>
                  )}
              </tbody>
          </table>
      </div>

      <AnimatePresence>
        {selectedEvaluation && (
            <>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setSelectedEvaluation(null)}
                    className="fixed inset-0 bg-slate-900/60 z-40"
                />
                <EvaluationForm
                    evaluation={selectedEvaluation}
                    cycle={cycle}
                    onClose={() => setSelectedEvaluation(null)}
                    onSuccess={() => setSelectedEvaluation(null)}
                    readOnly={selectedEvaluation.status === 'submitted' || selectedEvaluation.status === 'overridden' || selectedEvaluation.status === 'finalized'}
                />
            </>
        )}
      </AnimatePresence>
    </div>
  );
}