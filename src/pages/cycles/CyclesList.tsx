import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { cycleService } from '../../services/cycleService';
import { type Cycle, type CycleStatus } from '../../types/cycle';
import {
  Plus,
  Users,
  Calendar,
  Lock,
  ChevronRight,
  ClipboardList,
} from 'lucide-react';
import { format } from 'date-fns';
import CreateCycleWizard from '../../components/cycles/CreateCycleWizard';

// ---------------------------------------------------------------------------
// Status badge helper
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
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status]}`}>
      {status === 'locked' && <Lock className="w-3 h-3" />}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Cycle Card
// ---------------------------------------------------------------------------

function CycleCard({ cycle, onClick }: { cycle: Cycle; onClick: () => void }) {
  const criteriaComplete = cycle.criteria.length > 0 && Math.round(cycle.totalWeight) === 100;

  const formatDate = (ts: Cycle['timeline']['startDate'] | undefined) => {
    if (!ts) return '—';
    try {
      return format(ts.toDate(), 'MMM d, yyyy');
    } catch {
      return '—';
    }
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 cursor-pointer hover:shadow-md hover:border-slate-300 transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-slate-900 truncate group-hover:text-emerald-600 transition-colors">
            {cycle.name}
          </h3>
          {cycle.description && (
            <p className="text-sm text-slate-500 mt-0.5 truncate">{cycle.description}</p>
          )}
        </div>
        <div className="ml-3 flex items-center gap-2">
          <StatusBadge status={cycle.status} />
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-slate-500 mb-4">
        <span className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-slate-400" />
          {formatDate(cycle.timeline?.startDate)} – {formatDate(cycle.timeline?.endDate)}
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="w-4 h-4 text-slate-400" />
          {cycle.employeeCount} employees in scope
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
            {cycle.budget?.type === 'fixed_pool' ? 'Fixed Pool' : 'Percentage Based'}
          </span>
          {cycle.criteria.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
              {cycle.criteria.length} criteria
            </span>
          )}
        </div>
        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
      </div>

      {/* Progress bar for active/locked — criteria completeness */}
      {(cycle.status === 'active' || cycle.status === 'locked') && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span>Criteria weight</span>
            <span className={criteriaComplete ? 'text-emerald-600 font-semibold' : 'text-red-500'}>
              {cycle.totalWeight}%
            </span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${criteriaComplete ? 'bg-emerald-500' : 'bg-red-400'}`}
              style={{ width: `${Math.min(cycle.totalWeight, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stats Card
// ---------------------------------------------------------------------------

function StatCard({ label, value, color = 'slate' }: { label: string; value: number; color?: string }) {
  const colorMap: Record<string, string> = {
    slate: 'text-slate-900',
    blue: 'text-blue-600',
    emerald: 'text-emerald-600',
    gray: 'text-gray-500',
  };
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <p className="text-sm text-slate-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${colorMap[color] ?? 'text-slate-900'}`}>{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CyclesList Page
// ---------------------------------------------------------------------------

const STATUS_TABS: (CycleStatus | 'all')[] = ['all', 'draft', 'active', 'locked', 'completed', 'cancelled'];

export default function CyclesList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<CycleStatus | 'all'>('all');
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    if (!user?.companyId) return;

    const unsub = cycleService.subscribeToCycles(user.companyId, (data) => {
      setCycles(data);
      setLoading(false);
    });

    return () => unsub();
  }, [user?.companyId]);

  const filtered = activeTab === 'all' ? cycles : cycles.filter((c) => c.status === activeTab);

  // Stats
  const activeLocked = cycles.filter((c) => c.status === 'active' || c.status === 'locked').length;
  const drafts = cycles.filter((c) => c.status === 'draft').length;
  const completed = cycles.filter((c) => c.status === 'completed').length;
  const totalEmployees = cycles
    .filter((c) => c.status === 'active' || c.status === 'locked')
    .reduce((sum, c) => sum + (c.employeeCount || 0), 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Increment Cycles</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage salary increment evaluation cycles</p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Cycle
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Cycles" value={activeLocked} color="blue" />
        <StatCard label="Draft Cycles" value={drafts} color="slate" />
        <StatCard label="Completed Cycles" value={completed} color="gray" />
        <StatCard label="Employees Covered" value={totalEmployees} color="emerald" />
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 flex-wrap mb-6">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            <span className={`ml-1.5 text-xs ${activeTab === tab ? 'opacity-70' : 'text-slate-400'}`}>
              {tab === 'all' ? cycles.length : cycles.filter((c) => c.status === tab).length}
            </span>
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
            <ClipboardList className="w-7 h-7 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            {activeTab === 'all' ? 'No cycles yet' : `No ${activeTab} cycles`}
          </h3>
          <p className="text-slate-500 text-sm mb-6">
            {activeTab === 'all'
              ? 'Create your first increment cycle to get started.'
              : `No cycles with status "${activeTab}" found.`}
          </p>
          {activeTab === 'all' && (
            <button
              onClick={() => setShowWizard(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create your first increment cycle
            </button>
          )}
        </div>
      )}

      {/* Cycles grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((cycle) => (
            <CycleCard
              key={cycle.id}
              cycle={cycle}
              onClick={() => navigate(`/cycles/${cycle.id}`)}
            />
          ))}
        </div>
      )}

      {/* Create Cycle Wizard */}
      {showWizard && (
        <CreateCycleWizard
          onClose={() => setShowWizard(false)}
          onCreated={(cycleId) => {
            setShowWizard(false);
            navigate(`/cycles/${cycleId}`);
          }}
        />
      )}
    </div>
  );
}
