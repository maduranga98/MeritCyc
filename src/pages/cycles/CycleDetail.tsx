import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { cycleService } from '../../services/cycleService';
import { departmentService } from '../../services/departmentService';
import { salaryBandService } from '../../services/salaryBandService';
import { evaluationService } from '../../services/evaluationService';
import { type Cycle, type CycleStatus } from '../../types/cycle';
import { type Evaluation } from '../../types/evaluation';
import { type Department } from '../../types/department';
import { type SalaryBand } from '../../types/salaryBand';
import { db } from '../../config/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import {
  ArrowLeft, Lock, AlertTriangle, CheckCircle2, XCircle,
  Users, FileText, DollarSign, Calendar, ClipboardList, Loader2,
  Eye,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import CriteriaBuilder from '../../components/cycles/CriteriaBuilder';
import PublishLockModal from '../../components/cycles/PublishLockModal';

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: CycleStatus }) {
  const map: Record<CycleStatus, string> = {
    draft: 'bg-slate-100 text-slate-600',
    active: 'bg-blue-100 text-blue-700',
    locked: 'bg-emerald-100 text-emerald-700',
    completed: 'bg-gray-100 text-gray-600',
    cancelled: 'bg-red-100 text-red-600',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${map[status]}`}>
      {status === 'locked' && <Lock className="w-3.5 h-3.5" />}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Format timestamp helper
// ---------------------------------------------------------------------------

function fmtTs(ts: Cycle['timeline']['startDate'] | undefined, fmt = 'MMM d, yyyy'): string {
  if (!ts) return '—';
  try { return format(ts.toDate(), fmt); } catch { return '—'; }
}

// ---------------------------------------------------------------------------
// TAB 1 — Overview
// ---------------------------------------------------------------------------

function OverviewTab({ cycle }: { cycle: Cycle }) {
  const weightsOk = cycle.criteria.length > 0 && Math.round(cycle.totalWeight) === 100;
  const daysRemaining = cycle.timeline?.endDate
    ? Math.max(0, differenceInDays(cycle.timeline.endDate.toDate(), new Date()))
    : null;

  const checks = [
    { label: 'Basic info complete', pass: !!cycle.name },
    { label: `Criteria added (${cycle.criteria.length} criteria, weights ${cycle.totalWeight}%)`, pass: weightsOk },
    { label: 'Tiers configured', pass: cycle.tiers.length > 0 },
    { label: 'Scope defined', pass: !!(cycle.scope?.allEmployees || cycle.scope?.departmentIds?.length > 0 || cycle.scope?.salaryBandIds?.length > 0) },
    { label: 'Budget set', pass: !!cycle.budget?.type },
  ];

  const tierChartData = cycle.tiers.map((t) => ({
    name: t.name,
    min: t.incrementMin,
    max: t.incrementMax,
    color: t.color,
  }));

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Users className="w-4 h-4" />
            <span className="text-xs font-medium">Employees in Scope</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{cycle.employeeCount}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <FileText className="w-4 h-4" />
            <span className="text-xs font-medium">Total Criteria</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{cycle.criteria.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs font-medium">Budget</span>
          </div>
          <p className="text-sm font-bold text-slate-900">
            {cycle.budget?.type === 'percentage'
              ? `Up to ${cycle.budget.maxPercentage ?? '—'}%`
              : `${cycle.budget?.currency ?? ''} ${cycle.budget?.totalBudget?.toLocaleString() ?? '—'}`}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Calendar className="w-4 h-4" />
            <span className="text-xs font-medium">Days Remaining</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{daysRemaining ?? '—'}</p>
        </div>
      </div>

      {/* Draft checklist */}
      {cycle.status === 'draft' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-900 mb-3">Setup Checklist</h3>
          <div className="space-y-2.5">
            {checks.map((c, i) => (
              <div key={i} className="flex items-center gap-2.5">
                {c.pass
                  ? <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 flex-shrink-0" />
                  : <XCircle className="w-4.5 h-4.5 text-slate-300 flex-shrink-0" />
                }
                <span className={`text-sm ${c.pass ? 'text-slate-700' : 'text-slate-400'}`}>{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tier distribution chart for locked/active */}
      {(cycle.status === 'locked' || cycle.status === 'active') && cycle.tiers.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Tier Increment Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={tierChartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis unit="%" tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Bar dataKey="min" name="Min Increment" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="max" name="Max Increment" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TAB 2 — Criteria (draft = builder, locked = read-only)
// ---------------------------------------------------------------------------

function CriteriaTab({ cycle }: { cycle: Cycle }) {
  const isLocked = cycle.status !== 'draft';
  const dsColors: Record<string, string> = {
    manager: 'bg-blue-100 text-blue-700',
    system: 'bg-emerald-100 text-emerald-700',
    self: 'bg-amber-100 text-amber-700',
  };
  const mtLabel: Record<string, string> = {
    numeric: 'Numeric', boolean: 'Yes/No', rating: 'Rating', percentage: 'Percentage',
  };

  if (!isLocked) {
    return (
      <CriteriaBuilder
        cycleId={cycle.id}
        initialCriteria={cycle.criteria}
        initialTiers={cycle.tiers}
      />
    );
  }

  // Read-only locked view
  return (
    <div className="space-y-4">
      {/* Lock banner */}
      <div className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
        <Lock className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Criteria locked on {fmtTs(cycle.lockedAt)} by {cycle.lockedBy ? 'an admin' : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Criteria cannot be modified. To make changes, cancel this cycle and create a new one.
          </p>
        </div>
      </div>

      {/* Criteria list */}
      <div className="grid gap-3">
        {cycle.criteria.map((c) => (
          <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm">{c.name}</p>
                {c.description && <p className="text-xs text-slate-500 mt-0.5">{c.description}</p>}
                <div className="flex gap-2 mt-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{mtLabel[c.measurementType]}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${dsColors[c.dataSource]}`}>{c.dataSource}</span>
                </div>
              </div>
              <span className="text-lg font-bold text-emerald-600">{c.weight}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tiers section */}
      {cycle.tiers.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-slate-900 mb-3 mt-4">Score Tiers</h3>
          <div className="grid gap-3">
            {[...cycle.tiers].sort((a, b) => a.minScore - b.minScore).map((t) => (
              <div key={t.id} className="bg-white border border-slate-200 rounded-xl p-4"
                style={{ borderLeftColor: t.color, borderLeftWidth: 4 }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                    <p className="font-semibold text-slate-900 text-sm">{t.name}</p>
                  </div>
                </div>
                <div className="flex gap-4 mt-2 text-xs text-slate-500">
                  <span>Score: <strong className="text-slate-700">{t.minScore}%–{t.maxScore}%</strong></span>
                  <span>Increment: <strong className="text-slate-700">{t.incrementMin}%–{t.incrementMax}%</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TAB 3 — Scope & Budget
// ---------------------------------------------------------------------------

function ScopeBudgetTab({
  cycle,
  departments,
  salaryBands,
}: {
  cycle: Cycle;
  departments: Department[];
  salaryBands: SalaryBand[];
}) {
  const isLocked = cycle.status !== 'draft';

  const getDeptName = (id: string) => departments.find((d) => d.id === id)?.name ?? id;
  const getBandName = (id: string) => salaryBands.find((b) => b.id === id)?.name ?? id;

  if (isLocked) {
    return (
      <div className="space-y-5">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-900 mb-3">Scope</h3>
          {cycle.scope?.allEmployees ? (
            <p className="text-sm text-slate-700">All employees ({cycle.employeeCount} total)</p>
          ) : (
            <div className="space-y-2">
              {cycle.scope?.departmentIds?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Departments</p>
                  <div className="flex flex-wrap gap-1.5">
                    {cycle.scope.departmentIds.map((id) => (
                      <span key={id} className="text-xs px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">{getDeptName(id)}</span>
                    ))}
                  </div>
                </div>
              )}
              {cycle.scope?.salaryBandIds?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Salary Bands</p>
                  <div className="flex flex-wrap gap-1.5">
                    {cycle.scope.salaryBandIds.map((id) => (
                      <span key={id} className="text-xs px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full font-medium">{getBandName(id)}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-900 mb-3">Budget</h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Type</span>
              <span className="font-medium text-slate-900">{cycle.budget?.type === 'percentage' ? 'Percentage Based' : 'Fixed Pool'}</span>
            </div>
            {cycle.budget?.type === 'percentage' && (
              <div className="flex justify-between">
                <span className="text-slate-500">Max increment</span>
                <span className="font-medium text-slate-900">{cycle.budget.maxPercentage}%</span>
              </div>
            )}
            {cycle.budget?.type === 'fixed_pool' && (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total budget</span>
                  <span className="font-medium text-slate-900">{cycle.budget.currency} {cycle.budget.totalBudget?.toLocaleString()}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Draft edit mode — read-only display (edits go through wizard / separate flow)
  return (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>To edit scope and budget, use "Edit Details" to open the cycle setup wizard.</span>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Scope</h3>
        {cycle.scope?.allEmployees ? (
          <p className="text-sm text-slate-700">All employees</p>
        ) : (
          <div className="space-y-2">
            {(cycle.scope?.departmentIds?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Departments ({cycle.scope?.departmentIds?.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {cycle.scope?.departmentIds?.map((id) => (
                    <span key={id} className="text-xs px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full">{getDeptName(id)}</span>
                  ))}
                </div>
              </div>
            )}
            {(cycle.scope?.salaryBandIds?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Salary Bands ({cycle.scope?.salaryBandIds?.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {cycle.scope?.salaryBandIds?.map((id) => (
                    <span key={id} className="text-xs px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full">{getBandName(id)}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <p className="text-xs text-slate-500 mt-3">{cycle.employeeCount} employees in scope</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Budget</h3>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Type</span>
            <span className="font-medium text-slate-900">{cycle.budget?.type === 'percentage' ? 'Percentage Based' : 'Fixed Pool'}</span>
          </div>
          {cycle.budget?.type === 'percentage' && (
            <div className="flex justify-between">
              <span className="text-slate-500">Max increment</span>
              <span className="font-medium text-slate-900">{cycle.budget?.maxPercentage ?? '—'}%</span>
            </div>
          )}
          {cycle.budget?.type === 'fixed_pool' && (
            <div className="flex justify-between">
              <span className="text-slate-500">Total budget</span>
              <span className="font-medium text-slate-900">{cycle.budget?.currency} {cycle.budget?.totalBudget?.toLocaleString() ?? '—'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TAB 4 — Timeline
// ---------------------------------------------------------------------------

function TimelineTab({ cycle }: { cycle: Cycle }) {
  const start = cycle.timeline?.startDate?.toDate?.();
  const end = cycle.timeline?.endDate?.toDate?.();
  const now = new Date();

  let progress = 0;
  if (start && end) {
    const total = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    progress = Math.max(0, Math.min(100, (elapsed / total) * 100));
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <p className="text-xs text-slate-500 mb-1">Start Date</p>
            <p className="font-semibold text-slate-900">{fmtTs(cycle.timeline?.startDate)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500 mb-1">Evaluation Deadline</p>
            <p className="font-semibold text-slate-900">{fmtTs(cycle.timeline?.evaluationDeadline)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500 mb-1">End Date</p>
            <p className="font-semibold text-slate-900">{fmtTs(cycle.timeline?.endDate)}</p>
          </div>
        </div>

        {/* Visual timeline */}
        {start && end && (
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1.5">
              <span>Start</span>
              <span>{Math.round(progress)}% elapsed</span>
              <span>End</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden relative">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
              {/* Today marker */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-slate-900"
                style={{ left: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>{fmtTs(cycle.timeline?.startDate, 'MMM d')}</span>
              <span className="font-medium text-slate-700">Today: {format(now, 'MMM d, yyyy')}</span>
              <span>{fmtTs(cycle.timeline?.endDate, 'MMM d')}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TAB 5 — Audit Log
// ---------------------------------------------------------------------------

interface AuditEntry {
  id: string;
  action: string;
  actorEmail: string;
  timestamp: { toDate: () => Date };
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

function AuditLogTab({ cycleId, companyId }: { cycleId: string; companyId: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'auditLogs'),
      where('companyId', '==', companyId),
      where('targetId', '==', cycleId),
      orderBy('timestamp', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditEntry)));
      setLoading(false);
    });
    return () => unsub();
  }, [cycleId, companyId]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }

  if (entries.length === 0) {
    return <p className="text-sm text-slate-500 text-center py-12">No audit entries for this cycle.</p>;
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Timestamp</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actor</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                  {e.timestamp ? format(e.timestamp.toDate(), 'MMM d, yyyy HH:mm') : '—'}
                </td>
                <td className="px-4 py-3 text-slate-700 text-xs">{e.actorEmail || '—'}</td>
                <td className="px-4 py-3">
                  <span className="text-xs font-mono font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                    {e.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs max-w-xs truncate">
                  {e.after ? JSON.stringify(e.after).slice(0, 80) : e.metadata ? JSON.stringify(e.metadata).slice(0, 80) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TAB 6 — Evaluations
// ---------------------------------------------------------------------------

function EvaluationsTab({ cycle, evaluations, onInitialize }: { cycle: Cycle, evaluations: Evaluation[], onInitialize: () => void }) {
  const navigate = useNavigate();
  const [initializing, setInitializing] = useState(false);

  const handleInit = async () => {
     setInitializing(true);
     await onInitialize();
     setInitializing(false);
  };

  const total = evaluations.length;
  const submitted = evaluations.filter(e => e.status === 'submitted' || e.status === 'overridden' || e.status === 'finalized').length;
  const progress = total > 0 ? (submitted / total) * 100 : 0;

  if (cycle.status === 'draft') {
      return (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
              <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-900 mb-1">Evaluations will appear here</h3>
              <p className="text-xs text-slate-500">Publish and lock this cycle to begin the evaluation phase.</p>
          </div>
      );
  }

  if (total === 0 && cycle.status === 'active') {
       return (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm">
              <Users className="w-10 h-10 text-amber-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-900 mb-2">Evaluations not initialized</h3>
              <p className="text-xs text-slate-500 mb-4 max-w-sm mx-auto">
                 The cycle is active but evaluations haven't been assigned to managers yet. Click the button below to assign them.
              </p>
              <button
                  onClick={handleInit}
                  disabled={initializing}
                  className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mx-auto"
              >
                  {initializing ? <Loader2 className="w-4 h-4 animate-spin"/> : <ClipboardList className="w-4 h-4"/>}
                  {initializing ? 'Initializing...' : 'Initialize Evaluations'}
              </button>
          </div>
       );
  }

  return (
      <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                  <div>
                      <h3 className="text-lg font-bold text-slate-900">Evaluation Progress</h3>
                      <p className="text-sm text-slate-500 mt-1">Managers are currently evaluating their teams.</p>
                  </div>
                  <button
                      onClick={() => navigate('/evaluations/review')}
                      className="px-4 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-colors text-sm"
                  >
                      Go to Score Review
                  </button>
              </div>

              <div className="mb-2 flex justify-between text-sm font-medium">
                  <span className="text-slate-600">{submitted} of {total} evaluations completed</span>
                  <span className="text-emerald-600">{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3">
                  <div className="bg-emerald-500 h-3 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
              </div>
          </div>
      </div>
  );
}

// ---------------------------------------------------------------------------
// CycleDetail Page
// ---------------------------------------------------------------------------

type TabId = 'overview' | 'criteria' | 'scope' | 'timeline' | 'evaluations' | 'audit' | 'simulation' | 'budget';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'criteria', label: 'Criteria' },
  { id: 'scope', label: 'Scope & Budget' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'evaluations', label: 'Evaluations' },
  { id: 'audit', label: 'Audit Log' },
];

export default function CycleDetail() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [salaryBands, setSalaryBands] = useState<SalaryBand[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [cancellingReason, setCancellingReason] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!cycleId) return;
    const unsub = cycleService.subscribeToCycle(cycleId, (data) => {
      setCycle(data);
      setLoading(false);
    });
    const unsubEvals = evaluationService.getCycleEvaluations(cycleId, (data) => {
        setEvaluations(data);
    });
    return () => {
        unsub();
        unsubEvals();
    };
  }, [cycleId]);

  useEffect(() => {
    if (!user?.companyId) return;
    departmentService.getDepartments(user.companyId).then(setDepartments).catch(() => {});
    salaryBandService.getSalaryBands(user.companyId).then(setSalaryBands).catch(() => {});
  }, [user?.companyId]);

  const handleCancel = async () => {
    if (!cycle || !cancellingReason.trim()) {
      toast.error('Cancellation reason is required.');
      return;
    }
    setCancelling(true);
    try {
      await cycleService.cancelCycle({ cycleId: cycle.id, reason: cancellingReason });
      toast.success('Cycle cancelled.');
      setShowCancelConfirm(false);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to cancel.';
      toast.error(msg);
    } finally {
      setCancelling(false);
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
        <button onClick={() => navigate('/cycles')} className="mt-4 text-sm text-emerald-600 hover:underline">
          Back to Cycles
        </button>
      </div>
    );
  }

  const isDraft = cycle.status === 'draft';
  const isLocked = cycle.status === 'locked';
  const isActive = cycle.status === 'active';
  const isCancelled = cycle.status === 'cancelled';
  const isCompleted = cycle.status === 'completed';
  const weightsOk = cycle.criteria.length > 0 && Math.round(cycle.totalWeight) === 100;
  const tiersOk = cycle.tiers.length > 0;
  const canPublish = isDraft && weightsOk && tiersOk && cycle.employeeCount > 0;

  const simulationTabs = isDraft
    ? [...TABS, { id: 'simulation' as TabId, label: 'Simulation' }]
    : [...TABS, { id: 'budget' as TabId, label: 'Budget Tracker' }];

  return (
    <div>
      {/* Back nav */}
      <button
        onClick={() => navigate('/cycles')}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Cycles
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">{cycle.name}</h1>
            <StatusBadge status={cycle.status} />
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Last updated: {fmtTs(cycle.updatedAt)}
          </p>
          {cycle.description && (
            <p className="text-sm text-slate-600 mt-1">{cycle.description}</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 flex-shrink-0">
          {isDraft && (
            <>
              {weightsOk && tiersOk && (
                <button
                  onClick={() => navigate(`/cycles/${cycle.id}/simulate`)}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  Run Simulation
                </button>
              )}
              <button
                onClick={() => setActiveTab('criteria')}
                className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <ClipboardList className="w-4 h-4" />
                Build Criteria
              </button>
              <button
                onClick={() => setShowPublishModal(true)}
                disabled={!canPublish}
                title={!canPublish ? 'Complete setup before publishing' : undefined}
                className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Lock className="w-4 h-4" />
                Publish & Lock
              </button>
            </>
          )}

          {(isLocked || isActive) && (
            <>
              <button
                onClick={() => setActiveTab('criteria')}
                className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Eye className="w-4 h-4" />
                View Criteria
              </button>
              {!isCancelled && !isCompleted && (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Cancel Cycle
                </button>
              )}
            </>
          )}

          {isCompleted && (
            <button disabled className="px-3.5 py-2 text-sm font-medium text-slate-400 border border-slate-200 rounded-lg cursor-not-allowed">
              View Report (coming soon)
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-6">
        <div className="flex gap-0 overflow-x-auto">
          {simulationTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                 if (tab.id === 'budget') {
                    navigate(`/cycles/${cycle.id}/budget`);
                 } else if (tab.id === 'simulation') {
                    navigate(`/cycles/${cycle.id}/simulate`);
                 } else {
                    setActiveTab(tab.id as TabId);
                 }
              }}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              {tab.id === 'criteria' && (isLocked || isActive) && <Lock className="w-3.5 h-3.5" />}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab cycle={cycle} />}
      {activeTab === 'criteria' && <CriteriaTab cycle={cycle} />}
      {activeTab === 'scope' && (
        <ScopeBudgetTab cycle={cycle} departments={departments} salaryBands={salaryBands} />
      )}
      {activeTab === 'timeline' && <TimelineTab cycle={cycle} />}
      {activeTab === 'evaluations' && (
        <EvaluationsTab
            cycle={cycle}
            evaluations={evaluations}
            onInitialize={async () => {
                try {
                    await evaluationService.initializeEvaluations(cycle.id);
                    toast.success('Evaluations initialized');
                } catch (error) {
                    const msg = error instanceof Error ? error.message : 'Failed to initialize';
                    toast.error(msg);
                }
            }}
        />
      )}
      {activeTab === 'audit' && (
        <AuditLogTab cycleId={cycle.id} companyId={cycle.companyId} />
      )}

      {/* Publish Modal */}
      {showPublishModal && (
        <PublishLockModal
          cycle={cycle}
          onClose={() => setShowPublishModal(false)}
          onSuccess={() => setShowPublishModal(false)}
        />
      )}

      {/* Cancel Confirm Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 font-brand">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Cancel Cycle</h3>
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to cancel <strong>{cycle.name}</strong>? This will stop all evaluations.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Reason for cancellation</label>
              <textarea
                value={cancellingReason}
                onChange={(e) => setCancellingReason(e.target.value)}
                placeholder="Provide a reason..."
                rows={3}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 py-2.5 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Keep Cycle
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling || !cancellingReason.trim()}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {cancelling ? 'Cancelling…' : 'Cancel Cycle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
