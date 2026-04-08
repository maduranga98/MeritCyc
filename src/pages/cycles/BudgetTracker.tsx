import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { cycleService } from '../../services/cycleService';
import { simulationService } from '../../services/simulationService';
import { departmentService } from '../../services/departmentService';
import { type Cycle } from '../../types/cycle';
import { type BudgetTracking } from '../../types/budgetTracking';
import { type Department } from '../../types/department';
import {
  ArrowLeft,
  Loader2,
  DollarSign,
  PieChart,
  Activity,
  AlertTriangle,
  Building2,
  List,
  CheckCircle2
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar
} from 'recharts';

const formatCurrency = (amount: number, currency: string = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

export default function BudgetTracker() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [budgetData, setBudgetData] = useState<BudgetTracking | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingCycle, setLoadingCycle] = useState(true);
  const [loadingBudget, setLoadingBudget] = useState(true);

  useEffect(() => {
    if (!cycleId) return;

    const unsubCycle = cycleService.subscribeToCycle(cycleId, (data) => {
      setCycle(data);
      if (data && data.status === 'draft') {
         navigate(`/cycles/${cycleId}`); // redirect if draft
      }
      setLoadingCycle(false);
    });

    const unsubBudget = simulationService.getBudgetTracking(cycleId, (data) => {
      setBudgetData(data);
      setLoadingBudget(false);
    });

    return () => {
      unsubCycle();
      unsubBudget();
    };
  }, [cycleId, navigate]);

  useEffect(() => {
    if (user?.companyId) {
       departmentService.getDepartments(user.companyId).then(setDepartments).catch(() => {});
    }
  }, [user?.companyId]);

  if (loadingCycle || loadingBudget) {
    return (
      <div className="flex justify-center items-center h-full py-20">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!cycle) return <div>Cycle not found.</div>;

  const getDeptName = (id: string) => departments.find(d => d.id === id)?.name || id;

  // Fallback data if no budget tracking data yet (e.g. cycle just locked, no evals)
  const dataToUse = budgetData || {
    totalBudget: cycle.budget.type === 'fixed_pool' ? (cycle.budget.totalBudget || 0) : 0, // In reality, we approximate if percentage
    currency: cycle.budget.currency || 'USD',
    committed: 0,
    projected: 0,
    remaining: cycle.budget.type === 'fixed_pool' ? (cycle.budget.totalBudget || 0) : 0,
    utilizationPercent: 0,
    byDepartment: {},
    byTier: {},
    burnRateData: []
  };

  const utilizationColors = {
      safe: { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', fill: '#10B981' },
      warn: { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', fill: '#F59E0B' },
      danger: { text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', fill: '#EF4444' }
  };

  const status = dataToUse.utilizationPercent >= 95 ? 'danger' : (dataToUse.utilizationPercent >= 80 ? 'warn' : 'safe');
  const colorSet = utilizationColors[status];

  // Process department data for table
  const deptTableData = Object.entries(dataToUse.byDepartment).map(([id, stats]) => {
      const totalUsed = stats.committed + stats.projected;
      // If we don't have department-level budgets, we just show usage.
      // If we do, we calculate util %. For now, assume we just show usage if no budget.
      const utilPct = stats.budget > 0 ? (totalUsed / stats.budget) * 100 : 0;
      return {
          id,
          name: getDeptName(id),
          ...stats,
          utilizationPercent: utilPct
      };
  }).sort((a, b) => (b.committed + b.projected) - (a.committed + a.projected)); // sort by usage

  return (
    <div className="font-brand space-y-6 max-w-6xl mx-auto pb-10">

      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`/cycles/${cycle.id}`)}
          className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Real-Time Budget Tracker</h1>
          <p className="text-slate-500 text-sm mt-0.5">{cycle.name}</p>
        </div>
      </div>

      {/* Alert Banners */}
      {status === 'warn' && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-start gap-3 shadow-sm">
           <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-500" />
           <div>
              <h4 className="font-bold text-sm">Budget is {dataToUse.utilizationPercent.toFixed(1)}% utilized</h4>
              <p className="text-sm mt-0.5 opacity-90">Review remaining evaluations to ensure they fit within the remaining budget.</p>
           </div>
        </div>
      )}
      {status === 'danger' && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-start gap-3 shadow-sm">
           <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
           <div>
              <h4 className="font-bold text-sm flex items-center gap-2">⚠️ Critical — Budget nearly exhausted</h4>
              <p className="text-sm mt-0.5 opacity-90">You have utilized {dataToUse.utilizationPercent.toFixed(1)}% of the total budget. Further approvals may exceed the cap.</p>
           </div>
        </div>
      )}

      {/* Section 1 & 2: Gauge & Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Gauge Chart */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col items-center justify-center lg:col-span-1">
           <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 self-start w-full text-center">Budget Utilization</h3>
           <div className="relative w-[200px] h-[200px]">
             <ResponsiveContainer width="100%" height="100%">
               <RadialBarChart
                 cx="50%" cy="50%"
                 innerRadius="70%" outerRadius="100%"
                 barSize={20}
                 data={[{name: 'Utilized', value: dataToUse.utilizationPercent, fill: colorSet.fill}]}
                 startAngle={180} endAngle={0}
               >
                 <RadialBar background={{ fill: '#f1f5f9' }} dataKey="value" cornerRadius={10} />
               </RadialBarChart>
             </ResponsiveContainer>
             <div className="absolute inset-0 flex flex-col items-center justify-center pt-8">
                <span className={`text-4xl font-bold ${colorSet.text}`}>{dataToUse.utilizationPercent.toFixed(0)}%</span>
                <span className="text-xs text-slate-500 font-medium">Used</span>
             </div>
           </div>
           <p className="text-sm text-slate-600 mt-[-20px] text-center px-4">
              <strong>{formatCurrency(dataToUse.committed, dataToUse.currency)}</strong> committed of <br/> {formatCurrency(dataToUse.totalBudget, dataToUse.currency)} total
           </p>
        </div>

        {/* Summary Cards */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
           <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col justify-center">
              <div className="flex items-center gap-2 text-slate-500 mb-2">
                 <DollarSign className="w-4 h-4" />
                 <span className="text-xs font-semibold uppercase tracking-wider">Total Budget</span>
              </div>
              <p className="text-3xl font-bold text-slate-900">{formatCurrency(dataToUse.totalBudget, dataToUse.currency)}</p>
           </div>
           <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col justify-center">
              <div className="flex items-center gap-2 text-slate-500 mb-2">
                 <Activity className="w-4 h-4 text-blue-500" />
                 <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">Projected (In-Progress)</span>
              </div>
              <p className="text-3xl font-bold text-blue-700">{formatCurrency(dataToUse.projected, dataToUse.currency)}</p>
           </div>
           <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col justify-center">
              <div className="flex items-center gap-2 text-slate-500 mb-2">
                 <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                 <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Committed (Final)</span>
              </div>
              <p className="text-3xl font-bold text-emerald-700">{formatCurrency(dataToUse.committed, dataToUse.currency)}</p>
           </div>
           <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col justify-center">
              <div className="flex items-center gap-2 text-slate-500 mb-2">
                 <PieChart className="w-4 h-4" />
                 <span className="text-xs font-semibold uppercase tracking-wider">Remaining</span>
              </div>
              <p className="text-3xl font-bold text-slate-900">{formatCurrency(dataToUse.remaining, dataToUse.currency)}</p>
           </div>
        </div>
      </div>

      {/* Section 3: Burn Rate Chart */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
         <h3 className="text-base font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-slate-500" />
            Budget Burn Rate
         </h3>
         <div className="h-[300px] w-full">
            {dataToUse.burnRateData.length > 0 ? (
                <ResponsiveContainer>
                    <AreaChart data={dataToUse.burnRateData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={(v) => formatCurrency(v, dataToUse.currency).replace(/\D00(?=\D*$)/, '')} tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                        <RechartsTooltip
                            formatter={(value: unknown) => formatCurrency(value as number, dataToUse.currency)}
                            contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                        />
                        <Legend wrapperStyle={{fontSize: '12px', paddingTop: '10px'}} />
                        <Area type="monotone" dataKey="projected" name="Projected (Estimated)" stroke="#3B82F6" strokeWidth={2} strokeDasharray="5 5" fill="#3B82F6" fillOpacity={0.1} />
                        <Area type="monotone" dataKey="committed" name="Committed (Final)" stroke="#10B981" strokeWidth={2} fill="#10B981" fillOpacity={0.15} />
                    </AreaChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                    No burn rate data available yet.
                </div>
            )}
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Section 4: Department Breakdown */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-slate-500" />
                      Department Breakdown
                  </h3>
              </div>
              <div className="overflow-x-auto flex-1">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                          <tr>
                              <th className="px-5 py-3">Department</th>
                              <th className="px-5 py-3 text-right">Committed</th>
                              <th className="px-5 py-3 text-right">Projected</th>
                              <th className="px-5 py-3 text-right">Total Used</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {deptTableData.length > 0 ? deptTableData.map(dept => (
                              <tr key={dept.id} className="hover:bg-slate-50/50">
                                  <td className="px-5 py-3 font-medium text-slate-900">{dept.name}</td>
                                  <td className="px-5 py-3 text-right text-emerald-600 font-medium">{formatCurrency(dept.committed, dataToUse.currency)}</td>
                                  <td className="px-5 py-3 text-right text-blue-600">{formatCurrency(dept.projected, dataToUse.currency)}</td>
                                  <td className="px-5 py-3 text-right font-bold text-slate-700">{formatCurrency(dept.committed + dept.projected, dataToUse.currency)}</td>
                              </tr>
                          )) : (
                              <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-500">No department data.</td></tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>

          {/* Section 5: Tier Breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
              <div className="p-5 border-b border-slate-100">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <List className="w-5 h-5 text-slate-500" />
                      Tier Breakdown
                  </h3>
              </div>
              <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                  {cycle.tiers.length > 0 ? cycle.tiers.map(tier => {
                      const stats = (dataToUse.byTier as Record<string, { count: number; totalAmount: number }>)[tier.id] || { count: 0, totalAmount: 0 };
                      const avg = stats.count > 0 ? stats.totalAmount / stats.count : 0;
                      return (
                          <div key={tier.id} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                              <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                      <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: tier.color}} />
                                      <span className="font-semibold text-slate-900 text-sm">{tier.name}</span>
                                  </div>
                                  <span className="text-xs font-medium bg-white px-2 py-0.5 rounded border text-slate-500 shadow-sm">
                                      {stats.count} Emp
                                  </span>
                              </div>
                              <div className="flex justify-between items-end mt-3">
                                  <div>
                                      <p className="text-xs text-slate-500 mb-0.5">Total Amount</p>
                                      <p className="font-bold text-slate-900">{formatCurrency(stats.totalAmount, dataToUse.currency)}</p>
                                  </div>
                                  <div className="text-right">
                                      <p className="text-xs text-slate-500 mb-0.5">Average</p>
                                      <p className="font-medium text-slate-700">{formatCurrency(avg, dataToUse.currency)}</p>
                                  </div>
                              </div>
                          </div>
                      );
                  }) : (
                      <p className="text-center text-slate-500 text-sm py-4">No tiers configured.</p>
                  )}
              </div>
          </div>
      </div>

    </div>
  );
}
