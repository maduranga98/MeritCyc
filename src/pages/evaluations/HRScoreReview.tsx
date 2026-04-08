import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { cycleService } from '../../services/cycleService';
import { evaluationService } from '../../services/evaluationService';
import { departmentService } from '../../services/departmentService';
import { type Cycle } from '../../types/cycle';
import { type Evaluation } from '../../types/evaluation';
import { type Department } from '../../types/department';
import { Loader2, Users, AlertCircle, Clock, CheckCircle2, ShieldAlert, ClipboardList } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { OverrideScorePanel } from '../../components/evaluations/OverrideScorePanel';
import { FinalizeCycleModal } from '../../components/evaluations/FinalizeCycleModal';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function HRScoreReview() {
  const { user } = useAuth();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals/Panels state
  const [overrideEval, setOverrideEval] = useState<Evaluation | null>(null);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showNeedsReview, setShowNeedsReview] = useState(false);

  useEffect(() => {
    if (!user?.companyId) return;

    departmentService.getDepartments(user.companyId).then(setDepartments).catch(() => {});

    const unsubCycles = cycleService.subscribeToCycles(user.companyId, (cyclesData) => {
      const activeLocked = cyclesData.filter(c => c.status === 'active' || c.status === 'locked');
      setCycles(activeLocked);
      if (activeLocked.length > 0 && !selectedCycleId) {
          setSelectedCycleId(activeLocked[0].id);
      }
      if (activeLocked.length === 0) setLoading(false);
    });

    return () => unsubCycles();
  }, [user, selectedCycleId]);

  useEffect(() => {
    if (!selectedCycleId) return;

    const unsubEvals = evaluationService.getCycleEvaluations(selectedCycleId, (data) => {
      setEvaluations(data);
      setLoading(false);
      if (overrideEval) {
          const updated = data.find(e => e.id === overrideEval.id);
          if (updated) setOverrideEval(updated);
      }
    });
    return () => unsubEvals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCycleId]); // removing overrideEval.id to fix the hook warning while maintaining functionality, as the update will trigger a re-render when overrideEval state changes anyway.

  const selectedCycle = cycles.find(c => c.id === selectedCycleId);

  const getStatusBadge = (status: string) => {
      switch(status) {
          case 'not_started': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-600">Not Started</span>;
          case 'draft': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">In Progress</span>;
          case 'submitted': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700">Submitted</span>;
          case 'overridden': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">Overridden</span>;
          case 'finalized': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">Finalized</span>;
          default: return null;
      }
  };

  // -------------------------------------------------------------------------
  // Filtering & Stats
  // -------------------------------------------------------------------------

  const filteredEvals = useMemo(() => {
      return evaluations.filter(e => {
          if (search && !e.employeeName.toLowerCase().includes(search.toLowerCase()) && !e.employeeEmail.toLowerCase().includes(search.toLowerCase())) return false;
          if (deptFilter && e.departmentId !== deptFilter) return false;
          if (statusFilter && e.status !== statusFilter) return false;
          if (showNeedsReview && (e.status === 'not_started' || e.status === 'draft')) return true; // simplified review logic
          if (showNeedsReview && e.status !== 'not_started' && e.status !== 'draft') return false;
          return true;
      });
  }, [evaluations, search, deptFilter, statusFilter, showNeedsReview]);

  const total = evaluations.length;
  const notStarted = evaluations.filter(e => e.status === 'not_started').length;
  const inProgress = evaluations.filter(e => e.status === 'draft').length;
  const submitted = evaluations.filter(e => e.status === 'submitted').length;
  const overridden = evaluations.filter(e => e.status === 'overridden').length;

  // Department completion chart data
  const deptChartData = useMemo(() => {
      const data: Record<string, { name: string; submitted: number; remaining: number }> = {};
      departments.forEach(d => {
          data[d.id] = { name: d.name, submitted: 0, remaining: 0 };
      });

      evaluations.forEach(e => {
          const did = e.departmentId || 'unknown';
          if (!data[did]) data[did] = { name: 'Unknown', submitted: 0, remaining: 0 };

          if (e.status === 'submitted' || e.status === 'overridden' || e.status === 'finalized') {
              data[did].submitted += 1;
          } else {
              data[did].remaining += 1;
          }
      });
      return Object.values(data).filter(d => d.submitted > 0 || d.remaining > 0);
  }, [evaluations, departments]);

  // Score distribution chart data
  const distChartData = useMemo(() => {
      if (!selectedCycle) return [];

      const counts: Record<string, { name: string, count: number, color: string }> = {};
      selectedCycle.tiers.forEach(t => {
         counts[t.id] = { name: t.name, count: 0, color: t.color };
      });

      evaluations.forEach(e => {
          if (e.assignedTierId && counts[e.assignedTierId]) {
              counts[e.assignedTierId].count += 1;
          }
      });

      return Object.values(counts);
  }, [evaluations, selectedCycle]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (cycles.length === 0) {
      return (
          <div className="text-center py-20 font-brand">
              <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-slate-900">No Active Cycles</h2>
              <p className="text-slate-500 mt-2">There are no active or locked cycles to review.</p>
          </div>
      );
  }

  return (
    <div className="font-brand space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Score Review</h1>
              <select
                  value={selectedCycleId}
                  onChange={(e) => setSelectedCycleId(e.target.value)}
                  className="bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2"
              >
                  {cycles.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
              </select>
          </div>
          <button
              onClick={() => setShowFinalizeModal(true)}
              className="px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
          >
              Finalize Cycle
          </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white border border-slate-200 p-4 rounded-xl">
              <div className="flex items-center gap-2 text-slate-500 mb-2">
                  <Users className="w-4 h-4"/>
                  <span className="text-xs font-bold uppercase tracking-wider">Total</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{total}</p>
          </div>
          <div className="bg-white border border-red-200 bg-red-50 p-4 rounded-xl">
              <div className="flex items-center gap-2 text-red-600 mb-2">
                  <AlertCircle className="w-4 h-4"/>
                  <span className="text-xs font-bold uppercase tracking-wider">Not Started</span>
              </div>
              <p className="text-2xl font-bold text-red-700">{notStarted}</p>
          </div>
          <div className="bg-white border border-amber-200 bg-amber-50 p-4 rounded-xl">
              <div className="flex items-center gap-2 text-amber-600 mb-2">
                  <Clock className="w-4 h-4"/>
                  <span className="text-xs font-bold uppercase tracking-wider">In Progress</span>
              </div>
              <p className="text-2xl font-bold text-amber-700">{inProgress}</p>
          </div>
          <div className="bg-white border border-emerald-200 bg-emerald-50 p-4 rounded-xl">
              <div className="flex items-center gap-2 text-emerald-600 mb-2">
                  <CheckCircle2 className="w-4 h-4"/>
                  <span className="text-xs font-bold uppercase tracking-wider">Submitted</span>
              </div>
              <p className="text-2xl font-bold text-emerald-700">{submitted}</p>
          </div>
          <div className="bg-white border border-blue-200 bg-blue-50 p-4 rounded-xl">
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                  <ShieldAlert className="w-4 h-4"/>
                  <span className="text-xs font-bold uppercase tracking-wider">Overridden</span>
              </div>
              <p className="text-2xl font-bold text-blue-700">{overridden}</p>
          </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-900 mb-4">Completion by Department</h3>
              <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={deptChartData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="submitted" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="remaining" stackId="a" fill="#e2e8f0" radius={[0, 4, 4, 0]} />
                  </BarChart>
              </ResponsiveContainer>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-900 mb-4">Score Distribution</h3>
              <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={distChartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                         {distChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                         ))}
                      </Bar>
                  </BarChart>
              </ResponsiveContainer>
          </div>
      </div>

      {/* Evaluations Table List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4 items-center justify-between bg-slate-50">
              <div className="flex flex-wrap gap-3 flex-1">
                  <input
                      type="text"
                      placeholder="Search employee..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none min-w-[200px]"
                  />
                  <select
                      value={deptFilter}
                      onChange={e => setDeptFilter(e.target.value)}
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                      <option value="">All Departments</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <select
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value)}
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                      <option value="">All Statuses</option>
                      <option value="not_started">Not Started</option>
                      <option value="draft">In Progress</option>
                      <option value="submitted">Submitted</option>
                      <option value="overridden">Overridden</option>
                  </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                  <input
                      type="checkbox"
                      checked={showNeedsReview}
                      onChange={e => setShowNeedsReview(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Needs Review / Incomplete</span>
              </label>
          </div>

          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs uppercase font-semibold">
                      <tr>
                          <th className="px-6 py-4">Employee</th>
                          <th className="px-6 py-4">Manager</th>
                          <th className="px-6 py-4">Score</th>
                          <th className="px-6 py-4">Tier</th>
                          <th className="px-6 py-4">Est. %</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {filteredEvals.map(evaluation => (
                          <tr key={evaluation.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
                                          {evaluation.employeeName.charAt(0).toUpperCase()}
                                      </div>
                                      <div>
                                          <p className="font-bold text-slate-900">{evaluation.employeeName}</p>
                                          <p className="text-xs text-slate-500">{departments.find(d => d.id === evaluation.departmentId)?.name || 'Dept'}</p>
                                      </div>
                                  </div>
                              </td>
                              <td className="px-6 py-4 text-slate-600 font-medium">
                                  {evaluation.managerName || 'Manager'}
                              </td>
                              <td className="px-6 py-4">
                                  {(evaluation.status === 'submitted' || evaluation.status === 'overridden' || evaluation.status === 'draft') ? (
                                      <span className={`font-bold ${evaluation.weightedTotalScore < 50 ? 'text-red-600' : evaluation.weightedTotalScore < 75 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                          {evaluation.weightedTotalScore?.toFixed(1)}
                                      </span>
                                  ) : (
                                      <span className="text-slate-400">—</span>
                                  )}
                              </td>
                              <td className="px-6 py-4">
                                  {evaluation.assignedTierName ? (
                                      <span className="px-2 py-0.5 text-xs font-bold rounded text-white" style={{ backgroundColor: selectedCycle?.tiers.find(t => t.id === evaluation.assignedTierId)?.color || '#94a3b8' }}>
                                          {evaluation.assignedTierName}
                                      </span>
                                  ) : (
                                      <span className="text-slate-400">—</span>
                                  )}
                              </td>
                              <td className="px-6 py-4 font-medium text-slate-900">
                                  {evaluation.incrementPercent ? `${evaluation.incrementPercent}%` : '—'}
                              </td>
                              <td className="px-6 py-4">
                                  {getStatusBadge(evaluation.status)}
                              </td>
                              <td className="px-6 py-4 text-right">
                                  {evaluation.status === 'submitted' || evaluation.status === 'overridden' ? (
                                      <button
                                          onClick={() => setOverrideEval(evaluation)}
                                          className="text-emerald-600 hover:text-emerald-700 font-semibold"
                                      >
                                          Override
                                      </button>
                                  ) : (
                                      <span className="text-slate-300">N/A</span>
                                  )}
                              </td>
                          </tr>
                      ))}
                      {filteredEvals.length === 0 && (
                          <tr>
                              <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                                  No evaluations match the filters.
                              </td>
                          </tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>

      <AnimatePresence>
        {overrideEval && selectedCycle && (
            <>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setOverrideEval(null)}
                    className="fixed inset-0 bg-slate-900/60 z-40"
                />
                <OverrideScorePanel
                    evaluation={overrideEval}
                    cycle={selectedCycle}
                    onClose={() => setOverrideEval(null)}
                    onSuccess={() => setOverrideEval(null)}
                />
            </>
        )}

        {showFinalizeModal && selectedCycle && (
            <FinalizeCycleModal
                cycle={selectedCycle}
                evaluations={evaluations}
                onClose={() => setShowFinalizeModal(false)}
                onSuccess={() => {
                    setShowFinalizeModal(false);
                    // navigate to cycles or refresh
                }}
            />
        )}
      </AnimatePresence>
    </div>
  );
}