import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { cycleService } from '../../services/cycleService';
import { simulationService } from '../../services/simulationService';
import { type Cycle } from '../../types/cycle';
import { type Simulation, type WhatIfParams, type WhatIfResults, type DistributionType } from '../../types/simulation';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  BarChart2,
  TrendingUp,
  DollarSign,
  Users,
  ChevronDown,
  ChevronUp,
  Zap,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import RunSimulationModal from '../../components/cycles/RunSimulationModal';

const formatCurrency = (amount: number, currency: string = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

function generateScores(count: number, distribution: DistributionType): number[] {
  const scores: number[] = [];
  for (let i = 0; i < count; i++) {
    let score: number;
    switch (distribution) {
      case 'uniform':
        score = Math.random() * 100;
        break;
      case 'top_heavy':
        score = 100 - Math.pow(Math.random(), 0.5) * 100;
        break;
      case 'bottom_heavy':
        score = Math.pow(Math.random(), 0.5) * 100;
        break;
      case 'normal':
      default: {
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
        score = Math.max(0, Math.min(100, 50 + z * 20));
        break;
      }
    }
    scores.push(score);
  }
  return scores;
}

function calculateWhatIfResults(
  params: WhatIfParams,
  baseline: Simulation,
  cycle: Cycle
): WhatIfResults {
  const employeeCount = cycle.employeeCount || Math.max(baseline.results.qualifyingEmployees, 10);
  const scores = generateScores(employeeCount, params.distribution);
  const qualifying = scores.filter(s => s >= params.scoreThreshold);

  // Derive implied average salary from baseline simulation data
  const avgSalary =
    baseline.results.averageIncrement > 0 && baseline.results.qualifyingEmployees > 0
      ? (baseline.results.totalProjectedCost / baseline.results.qualifyingEmployees) /
        (baseline.results.averageIncrement / 100)
      : 50000;

  let totalCost = 0;
  const increments: number[] = [];

  qualifying.forEach(score => {
    const tier = cycle.tiers.find(t => score >= t.minScore && score <= t.maxScore);
    if (tier) {
      const mid = (tier.incrementMin + tier.incrementMax) / 2;
      increments.push(mid);
      totalCost += avgSalary * (mid / 100);
    }
  });

  const configuredBudget =
    cycle.budget.type === 'fixed_pool' && cycle.budget.totalBudget
      ? cycle.budget.totalBudget * params.budgetCapMultiplier
      : baseline.results.totalProjectedCost * params.budgetCapMultiplier;

  const budgetUtilization =
    configuredBudget > 0 ? Math.min((totalCost / configuredBudget) * 100, 200) : 0;

  const avgIncrement =
    increments.length > 0
      ? increments.reduce((a, b) => a + b, 0) / increments.length
      : 0;

  return {
    qualifyingEmployees: qualifying.length,
    totalProjectedCost: Math.round(totalCost),
    averageIncrement: Math.round(avgIncrement * 10) / 10,
    budgetUtilization: Math.round(budgetUtilization * 10) / 10,
    qualifyingDelta: qualifying.length - baseline.results.qualifyingEmployees,
    costDelta: Math.round(totalCost - baseline.results.totalProjectedCost),
    avgIncrementDelta: Math.round((avgIncrement - baseline.results.averageIncrement) * 10) / 10,
  };
}

export default function SimulationDashboard() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const navigate = useNavigate();
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [selectedSimId, setSelectedSimId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [applying, setApplying] = useState(false);

  // What-If Explorer state
  const [whatIfOpen, setWhatIfOpen] = useState(false);
  const [whatIfParams, setWhatIfParams] = useState<WhatIfParams>({
    scoreThreshold: 60,
    budgetCapMultiplier: 1.0,
    distribution: 'normal',
  });
  const [whatIfResults, setWhatIfResults] = useState<WhatIfResults | null>(null);
  const [savingWhatIf, setSavingWhatIf] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!cycleId) return;

    const unsubCycle = cycleService.subscribeToCycle(cycleId, (data) => {
      setCycle(data);
      if (data && data.status !== 'draft') {
        toast.error("Simulations are only available for draft cycles.");
        navigate(`/cycles/${cycleId}`);
      }
    });

    const unsubSims = simulationService.getSimulations(cycleId, (data) => {
      setSimulations(data);
      if (data.length > 0 && !selectedSimId) {
         // Auto-select the applied one or the first one
         const applied = data.find(s => s.isApplied);
         setSelectedSimId(applied ? applied.id : data[0].id);
      } else if (data.length === 0) {
          setSelectedSimId(null);
      }
      setLoading(false);
    });

    return () => {
      unsubCycle();
      unsubSims();
    };
  }, [cycleId, navigate, selectedSimId]);

  const recalculateWhatIf = useCallback(
    (params: WhatIfParams) => {
      const baseline = simulations.find(s => s.id === selectedSimId);
      if (!cycle || !baseline) return;
      const results = calculateWhatIfResults(params, baseline, cycle);
      setWhatIfResults(results);
    },
    [cycle, simulations, selectedSimId]
  );

  useEffect(() => {
    if (!whatIfOpen) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => recalculateWhatIf(whatIfParams), 200);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [whatIfParams, whatIfOpen, recalculateWhatIf]);

  const handleSaveWhatIf = async () => {
    if (!cycle || !whatIfResults) return;
    setSavingWhatIf(true);
    try {
      await simulationService.runSimulation({
        cycleId: cycle.id,
        name: `What-If (threshold ${whatIfParams.scoreThreshold}%, cap ${Math.round(whatIfParams.budgetCapMultiplier * 100)}%)`,
        parameters: {
          criteriaWeights: {},
          tierThresholds: [],
          budgetCap: whatIfParams.budgetCapMultiplier,
          assumedDistribution: whatIfParams.distribution,
        },
      });
      toast.success('What-If scenario saved.');
      setWhatIfOpen(false);
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to save scenario.');
    } finally {
      setSavingWhatIf(false);
    }
  };

  const handleDelete = async (sim: Simulation) => {
    if (sim.isApplied) {
      toast.error('Cannot delete an applied scenario.');
      return;
    }
    if (window.confirm(`Are you sure you want to delete "${sim.name}"?`)) {
      try {
        await simulationService.deleteSimulation({ cycleId: cycle!.id, simulationId: sim.id });
        toast.success('Simulation deleted.');
        if (selectedSimId === sim.id) {
          setSelectedSimId(simulations.length > 1 ? simulations.find(s => s.id !== sim.id)!.id : null);
        }
      } catch (e: unknown) {
        toast.error((e as Error).message || 'Failed to delete simulation.');
      }
    }
  };

  const handleApply = async (simId: string) => {
    if (!cycle || cycle.status !== 'draft') return;
    setApplying(true);
    try {
      await simulationService.applyScenario({ cycleId: cycle.id, simulationId: simId });
      toast.success('Scenario applied to cycle successfully.');
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to apply scenario.');
    } finally {
      setApplying(false);
    }
  };

  if (loading || !cycle) {
    return (
      <div className="flex justify-center items-center h-full py-20">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  const selectedSim = simulations.find(s => s.id === selectedSimId);

  return (
    <div className="h-full flex flex-col font-brand">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button
            onClick={() => navigate(`/cycles/${cycle.id}`)}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Cycle
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Budget Simulation</h1>
          <p className="text-slate-500 text-sm mt-1">{cycle.name}</p>
        </div>

        <div className="flex flex-col items-end">
          <button
            onClick={() => setShowModal(true)}
            disabled={simulations.length >= 5}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-4 h-4" />
            Run New Simulation
          </button>
          <span className="text-xs font-medium text-slate-500 mt-2">
            {simulations.length}/5 scenarios used
          </span>
        </div>
      </div>

      <div className="flex flex-1 gap-6 min-h-0">
        {/* Left Sidebar: Scenarios List */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-3 overflow-y-auto pr-2 pb-4">
          {simulations.map(sim => (
            <div
              key={sim.id}
              onClick={() => setSelectedSimId(sim.id)}
              className={`bg-white rounded-xl border p-4 cursor-pointer transition-all ${
                selectedSimId === sim.id
                  ? 'border-emerald-500 shadow-md ring-1 ring-emerald-500'
                  : 'border-slate-200 hover:border-slate-300 shadow-sm'
              } ${sim.isApplied ? 'border-l-4 border-l-emerald-500' : ''}`}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-slate-900 text-sm truncate pr-2">{sim.name}</h3>
                {sim.isApplied && (
                   <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                     Applied
                   </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mb-3 truncate">
                {new Date(sim.createdAt.toDate()).toLocaleDateString()}
              </p>

              <div className="flex items-center justify-between mt-auto">
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(sim); }}
                  disabled={sim.isApplied}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
                  title="Delete Scenario"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <button
                  onClick={(e) => { e.stopPropagation(); handleApply(sim.id); }}
                  disabled={sim.isApplied || applying}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                    sim.isApplied
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                  }`}
                >
                  {sim.isApplied ? 'Applied' : 'Apply to Cycle'}
                </button>
              </div>
            </div>
          ))}

          {simulations.length === 0 && (
            <div className="bg-slate-50 rounded-xl border border-slate-200 border-dashed p-6 text-center">
              <p className="text-sm text-slate-500">No saved scenarios.</p>
            </div>
          )}
        </div>

        {/* Right Area: Results */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto">
          {!selectedSim ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
              <BarChart2 className="w-16 h-16 mb-4 text-slate-300" />
              <h2 className="text-lg font-semibold text-slate-700 mb-2">No Simulation Selected</h2>
              <p className="text-sm text-center max-w-sm">
                Run your first simulation to see budget projections, employee distributions, and sensitivity analysis.
              </p>
            </div>
          ) : (
            <div className="p-6 space-y-8">
              {/* Top Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">Projected Total Cost</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {formatCurrency(selectedSim.results.totalProjectedCost, cycle.budget.currency)}
                  </p>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <Users className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">Qualifying Employees</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {selectedSim.results.qualifyingEmployees}
                    <span className="text-sm font-normal text-slate-500 ml-1">of {cycle.employeeCount}</span>
                  </p>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">Average Increment</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {selectedSim.results.averageIncrement.toFixed(1)}%
                  </p>
                </div>

                <div className={`rounded-xl p-4 border ${
                  selectedSim.results.budgetUtilization >= 95 ? 'bg-red-50 border-red-100' :
                  selectedSim.results.budgetUtilization >= 80 ? 'bg-amber-50 border-amber-100' :
                  'bg-emerald-50 border-emerald-100'
                }`}>
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <BarChart2 className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">Budget Utilization</span>
                  </div>
                  <p className={`text-2xl font-bold ${
                    selectedSim.results.budgetUtilization >= 95 ? 'text-red-700' :
                    selectedSim.results.budgetUtilization >= 80 ? 'text-amber-700' :
                    'text-emerald-700'
                  }`}>
                    {selectedSim.results.budgetUtilization.toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Distribution Chart */}
                <div className="min-h-[350px]">
                  <h3 className="text-base font-bold text-slate-900 mb-4">Employee Distribution by Tier</h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer>
                      <BarChart data={selectedSim.results.distributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="tierName" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v, cycle.budget.currency)} />
                        <Tooltip
                          cursor={{fill: '#f8fafc'}}
                          contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                        />
                        <Legend wrapperStyle={{fontSize: '12px', paddingTop: '10px'}} />
                        <Bar
                          yAxisId="left"
                          dataKey="employeeCount"
                          name="Employees"
                          radius={[4,4,0,0]}
                          maxBarSize={50}
                        >
                          {
                            selectedSim.results.distributionData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.tierColor || '#10B981'} />
                            ))
                          }
                        </Bar>
                        <Line yAxisId="right" type="monotone" dataKey="projectedCost" name="Projected Cost" stroke="#3B82F6" strokeWidth={2} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Sensitivity Chart */}
                <div className="min-h-[350px]">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Sensitivity Analysis</h3>
                    <p className="text-xs text-slate-500 mb-4">Shows projected cost vs qualifying employees at different top-score thresholds</p>
                  </div>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer>
                      <LineChart data={selectedSim.results.sensitivityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="threshold" tickFormatter={(v) => `${v}%`} tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v, cycle.budget.currency).replace(/\D00(?=\D*$)/, '')} />
                        <Tooltip
                          contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                          labelFormatter={(v) => `Threshold: ${v}%`}
                        />
                        <Legend wrapperStyle={{fontSize: '12px', paddingTop: '10px'}} />
                        <Line yAxisId="left" type="monotone" dataKey="qualifyingCount" name="Qualifying Employees" stroke="#10B981" strokeWidth={2} dot={false} activeDot={{r: 6}} />
                        <Line yAxisId="right" type="monotone" dataKey="projectedCost" name="Projected Cost" stroke="#3B82F6" strokeWidth={2} dot={false} activeDot={{r: 6}} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* What-If Explorer */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => {
                    const next = !whatIfOpen;
                    setWhatIfOpen(next);
                    if (next) recalculateWhatIf(whatIfParams);
                  }}
                  className="w-full flex items-center justify-between px-6 py-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span className="font-semibold text-slate-900">What-If Explorer</span>
                    <span className="text-xs text-slate-500 font-normal">Adjust parameters and see live results — no Cloud Function call</span>
                  </div>
                  {whatIfOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>

                {whatIfOpen && (
                  <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                      {/* Controls */}
                      <div className="space-y-6">
                        {/* Score Threshold */}
                        <div>
                          <div className="flex justify-between mb-2">
                            <label className="text-sm font-medium text-slate-700">Minimum Qualifying Score</label>
                            <span className="text-sm font-bold text-emerald-600">{whatIfParams.scoreThreshold}%</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={1}
                            value={whatIfParams.scoreThreshold}
                            onChange={e =>
                              setWhatIfParams(p => ({ ...p, scoreThreshold: Number(e.target.value) }))
                            }
                            className="w-full accent-emerald-500"
                          />
                          <div className="flex justify-between text-xs text-slate-400 mt-1">
                            <span>0%</span><span>50%</span><span>100%</span>
                          </div>
                        </div>

                        {/* Budget Cap */}
                        <div>
                          <div className="flex justify-between mb-2">
                            <label className="text-sm font-medium text-slate-700">Budget Cap</label>
                            <span className="text-sm font-bold text-emerald-600">
                              {Math.round(whatIfParams.budgetCapMultiplier * 100)}% of baseline
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0.5}
                            max={2.0}
                            step={0.05}
                            value={whatIfParams.budgetCapMultiplier}
                            onChange={e =>
                              setWhatIfParams(p => ({ ...p, budgetCapMultiplier: Number(e.target.value) }))
                            }
                            className="w-full accent-emerald-500"
                          />
                          <div className="flex justify-between text-xs text-slate-400 mt-1">
                            <span>50%</span><span>100%</span><span>200%</span>
                          </div>
                        </div>

                        {/* Score Distribution */}
                        <div>
                          <label className="text-sm font-medium text-slate-700 block mb-2">Score Distribution</label>
                          <div className="grid grid-cols-2 gap-2">
                            {(['normal', 'top_heavy', 'bottom_heavy', 'uniform'] as DistributionType[]).map(dist => (
                              <label
                                key={dist}
                                className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                                  whatIfParams.distribution === dist
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="distribution"
                                  value={dist}
                                  checked={whatIfParams.distribution === dist}
                                  onChange={() =>
                                    setWhatIfParams(p => ({ ...p, distribution: dist }))
                                  }
                                  className="accent-emerald-500"
                                />
                                <span className="text-sm font-medium capitalize">
                                  {dist.replace('_', ' ')}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Results panel */}
                      <div className="space-y-4">
                        {whatIfResults ? (
                          <>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Live Results</p>
                            <div className="grid grid-cols-2 gap-3">
                              {[
                                {
                                  label: 'Qualifying Employees',
                                  value: whatIfResults.qualifyingEmployees.toString(),
                                  delta: whatIfResults.qualifyingDelta,
                                  icon: <Users className="w-4 h-4" />,
                                },
                                {
                                  label: 'Avg Increment',
                                  value: `${whatIfResults.averageIncrement}%`,
                                  delta: whatIfResults.avgIncrementDelta,
                                  icon: <TrendingUp className="w-4 h-4" />,
                                },
                                {
                                  label: 'Projected Cost',
                                  value: formatCurrency(whatIfResults.totalProjectedCost, cycle.budget.currency),
                                  delta: whatIfResults.costDelta,
                                  deltaPrefix: whatIfResults.costDelta >= 0 ? '+' : '',
                                  deltaFormatted: formatCurrency(Math.abs(whatIfResults.costDelta), cycle.budget.currency),
                                  icon: <DollarSign className="w-4 h-4" />,
                                },
                                {
                                  label: 'Budget Utilization',
                                  value: `${whatIfResults.budgetUtilization}%`,
                                  delta: null,
                                  icon: <BarChart2 className="w-4 h-4" />,
                                  utilization: whatIfResults.budgetUtilization,
                                },
                              ].map(card => (
                                <div
                                  key={card.label}
                                  className={`p-4 rounded-xl border ${
                                    'utilization' in card
                                      ? card.utilization! >= 95
                                        ? 'bg-red-50 border-red-100'
                                        : card.utilization! >= 80
                                        ? 'bg-amber-50 border-amber-100'
                                        : 'bg-emerald-50 border-emerald-100'
                                      : 'bg-slate-50 border-slate-100'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                                    {card.icon}
                                    <span className="text-xs font-medium">{card.label}</span>
                                  </div>
                                  <p className="text-xl font-bold text-slate-900">{card.value}</p>
                                  {card.delta !== null && (
                                    <p className={`text-xs mt-1 font-medium ${card.delta > 0 ? 'text-emerald-600' : card.delta < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                      {card.delta > 0 ? '▲' : card.delta < 0 ? '▼' : '—'}{' '}
                                      {'deltaFormatted' in card && card.deltaFormatted
                                        ? `${card.deltaPrefix ?? ''}${card.deltaFormatted}`
                                        : `${card.delta > 0 ? '+' : ''}${card.delta}`}{' '}
                                      from baseline
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>

                            <button
                              onClick={handleSaveWhatIf}
                              disabled={savingWhatIf || simulations.length >= 5}
                              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {savingWhatIf ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Save className="w-4 h-4" />
                              )}
                              {savingWhatIf ? 'Saving...' : 'Save as Scenario'}
                            </button>
                            {simulations.length >= 5 && (
                              <p className="text-xs text-center text-slate-400">Maximum 5 scenarios reached.</p>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                            Adjust a parameter to see live results
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Comparison Table (if multiple simulations) */}
              {simulations.length > 1 && (
                <div className="mt-8 space-y-8">
                  <h3 className="text-base font-bold text-slate-900 mb-4">Scenario Comparison</h3>

                  {/* Visual Side-by-Side Chart */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    <div className="min-h-[350px]">
                      <h4 className="text-sm font-semibold text-slate-700 mb-3">Key Metrics by Scenario</h4>
                      <div className="h-[300px] w-full">
                        <ResponsiveContainer>
                          <BarChart
                            data={simulations.map(sim => ({
                              name: sim.name,
                              'Total Cost (k)': Math.round(sim.results.totalProjectedCost / 1000),
                              'Qualifying Employees': sim.results.qualifyingEmployees,
                              'Avg Increment %': Math.round(sim.results.averageIncrement * 10) / 10,
                              isApplied: sim.isApplied,
                            }))}
                            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="left" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                            <Tooltip
                              cursor={{fill: '#f8fafc'}}
                              contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                            />
                            <Legend wrapperStyle={{fontSize: '12px', paddingTop: '10px'}} />
                            <Bar yAxisId="left" dataKey="Total Cost (k)" fill="#3B82F6" radius={[4,4,0,0]} maxBarSize={40} />
                            <Bar yAxisId="right" dataKey="Qualifying Employees" fill="#10B981" radius={[4,4,0,0]} maxBarSize={40} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="min-h-[350px]">
                      <h4 className="text-sm font-semibold text-slate-700 mb-3">Scenario Profile Radar</h4>
                      <div className="h-[300px] w-full">
                        <ResponsiveContainer>
                          <RadarChart
                            data={[
                              { metric: 'Budget Utilization', ...Object.fromEntries(simulations.map(s => [s.name, s.results.budgetUtilization])) },
                              { metric: 'Avg Increment', ...Object.fromEntries(simulations.map(s => [s.name, s.results.averageIncrement * 10])) },
                              { metric: 'Qualifying %', ...Object.fromEntries(simulations.map(s => [s.name, (s.results.qualifyingEmployees / (cycle.employeeCount || 1)) * 100])) },
                              { metric: 'Cost Efficiency', ...Object.fromEntries(simulations.map(s => [s.name, 100 - s.results.budgetUtilization])) },
                            ]}
                          >
                            <PolarGrid stroke="#E2E8F0" />
                            <PolarAngleAxis dataKey="metric" tick={{ fill: '#64748B', fontSize: 11 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                            {simulations.map((sim, idx) => (
                              <Radar
                                key={sim.id}
                                name={sim.name}
                                dataKey={sim.name}
                                stroke={sim.isApplied ? '#10B981' : ['#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'][idx % 4]}
                                fill={sim.isApplied ? '#10B981' : ['#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'][idx % 4]}
                                fillOpacity={0.1}
                              />
                            ))}
                            <Legend wrapperStyle={{fontSize: '12px', paddingTop: '10px'}} />
                            <Tooltip
                              contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold">
                        <tr>
                          <th className="px-4 py-3 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">Metric</th>
                          {simulations.map(sim => (
                            <th key={sim.id} className={`px-4 py-3 min-w-[140px] ${sim.isApplied ? 'bg-emerald-50 text-emerald-800' : ''}`}>
                              {sim.name}
                              {sim.isApplied && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-emerald-500"></span>}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        <tr className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900 sticky left-0 bg-white z-10 border-r border-slate-200">Total Cost</td>
                          {simulations.map(sim => (
                            <td key={sim.id} className={`px-4 py-3 ${sim.isApplied ? 'bg-emerald-50/30' : ''}`}>
                              {formatCurrency(sim.results.totalProjectedCost, cycle.budget.currency)}
                            </td>
                          ))}
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900 sticky left-0 bg-white z-10 border-r border-slate-200">Avg Increment</td>
                          {simulations.map(sim => (
                            <td key={sim.id} className={`px-4 py-3 ${sim.isApplied ? 'bg-emerald-50/30' : ''}`}>
                              {sim.results.averageIncrement.toFixed(1)}%
                            </td>
                          ))}
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900 sticky left-0 bg-white z-10 border-r border-slate-200">Qualifying</td>
                          {simulations.map(sim => (
                            <td key={sim.id} className={`px-4 py-3 ${sim.isApplied ? 'bg-emerald-50/30' : ''}`}>
                              {sim.results.qualifyingEmployees}
                            </td>
                          ))}
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900 sticky left-0 bg-white z-10 border-r border-slate-200">Budget Utilization</td>
                          {simulations.map(sim => (
                            <td key={sim.id} className={`px-4 py-3 ${sim.isApplied ? 'bg-emerald-50/30' : ''}`}>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                sim.results.budgetUtilization >= 95 ? 'bg-red-100 text-red-700' :
                                sim.results.budgetUtilization >= 80 ? 'bg-amber-100 text-amber-700' :
                                'bg-emerald-100 text-emerald-700'
                              }`}>
                                {sim.results.budgetUtilization.toFixed(1)}%
                              </span>
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <RunSimulationModal
          cycle={cycle}
          onClose={() => setShowModal(false)}
          onSuccess={(newSimId) => {
            setShowModal(false);
            setSelectedSimId(newSimId);
          }}
        />
      )}
    </div>
  );
}
