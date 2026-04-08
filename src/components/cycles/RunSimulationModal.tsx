import { useState } from 'react';
import { type Cycle } from '../../types/cycle';
import { type DistributionType, type SimulationParameters } from '../../types/simulation';
import { simulationService } from '../../services/simulationService';
import { X, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

interface RunSimulationModalProps {
  cycle: Cycle;
  onClose: () => void;
  onSuccess: (simulationId: string) => void;
}

export default function RunSimulationModal({ cycle, onClose, onSuccess }: RunSimulationModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [assumedDistribution, setAssumedDistribution] = useState<DistributionType>('normal');

  const [showWeightsOverride, setShowWeightsOverride] = useState(false);
  const [criteriaWeights, setCriteriaWeights] = useState<Record<string, number>>({});

  const [showTiersOverride, setShowTiersOverride] = useState(false);
  const [tierThresholds, setTierThresholds] = useState<SimulationParameters['tierThresholds']>([]);

  const [budgetCapStr, setBudgetCapStr] = useState('');

  const [running, setRunning] = useState(false);

  // Initialize overrides on open
  useState(() => {
    const initWeights: Record<string, number> = {};
    cycle.criteria.forEach(c => initWeights[c.id] = c.weight);
    setCriteriaWeights(initWeights);

    setTierThresholds(cycle.tiers.map(t => ({
      tierId: t.id,
      minScore: t.minScore,
      maxScore: t.maxScore,
      incrementMin: t.incrementMin,
      incrementMax: t.incrementMax
    })));
  });

  const totalOverrideWeight = Object.values(criteriaWeights).reduce((a, b) => a + b, 0);

  const handleRun = async () => {
    if (!name.trim()) {
      toast.error("Scenario name is required.");
      return;
    }
    if (showWeightsOverride && totalOverrideWeight !== 100) {
      toast.error("Criteria weights must total exactly 100%.");
      return;
    }

    setRunning(true);
    try {
      const parameters: SimulationParameters = {
        assumedDistribution,
        criteriaWeights: showWeightsOverride ? criteriaWeights : {},
        tierThresholds: showTiersOverride ? tierThresholds : [],
      };

      if (budgetCapStr.trim() !== '') {
          const cap = parseFloat(budgetCapStr);
          if (!isNaN(cap) && cap > 0) {
              parameters.budgetCap = cap;
          }
      }

      const result = await simulationService.runSimulation({
        cycleId: cycle.id,
        name: name.trim(),
        description: description.trim() || undefined,
        parameters
      });

      toast.success("Simulation complete.");
      onSuccess(result.simulationId);
    } catch (e: unknown) {
        toast.error((e as Error).message || "Simulation failed.");
        setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col font-brand max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-100 flex-shrink-0">
          <h2 className="text-xl font-bold text-slate-900">Run New Simulation</h2>
          <button onClick={onClose} disabled={running} className="text-slate-400 hover:text-slate-600 disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-8">

          {/* Step 1: Scenario details */}
          <section>
            <h3 className="text-sm font-bold text-slate-900 mb-4">Step 1: Scenario Details</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Scenario Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Optimistic Estimate, Conservative Approach"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Description (Optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What assumptions are made in this scenario?"
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Assumed Score Distribution</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { val: 'normal', label: 'Normal Distribution', desc: 'Bell curve, most score near average (Recommended)' },
                    { val: 'uniform', label: 'Uniform Distribution', desc: 'Scores spread evenly across all ranges' },
                    { val: 'top_heavy', label: 'Top Heavy', desc: 'Assumes higher performance, more in upper tiers' },
                    { val: 'bottom_heavy', label: 'Bottom Heavy', desc: 'Conservative, fewer qualifying for top tiers' }
                  ].map(dist => (
                    <label
                      key={dist.val}
                      className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                        assumedDistribution === dist.val ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="distribution"
                        value={dist.val}
                        checked={assumedDistribution === dist.val}
                        onChange={() => setAssumedDistribution(dist.val as DistributionType)}
                        className="mt-1"
                      />
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{dist.label}</div>
                        <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{dist.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Step 2: Adjust Parameters (Optional) */}
          <section>
            <h3 className="text-sm font-bold text-slate-900 mb-4">Step 2: Adjust Parameters (Optional)</h3>
            <div className="space-y-3">

              {/* Budget Cap Override */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Budget Cap Override (Optional)</label>
                  <div className="relative">
                     <span className="absolute left-3 top-2.5 text-slate-500 text-sm">{cycle.budget.currency}</span>
                     <input
                        type="number"
                        value={budgetCapStr}
                        onChange={(e) => setBudgetCapStr(e.target.value)}
                        placeholder="e.g. 500000"
                        className="w-full pl-12 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                     />
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">Overrides the cycle's default budget just for this calculation.</p>
              </div>

              {/* Criteria Weights Override */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowWeightsOverride(!showWeightsOverride)}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <span className="text-sm font-semibold text-slate-800">Override Criteria Weights</span>
                  {showWeightsOverride ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>
                {showWeightsOverride && (
                  <div className="p-4 bg-white border-t border-slate-200 space-y-4">
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-xs text-slate-500">Criteria</span>
                       <span className={`text-xs font-bold ${totalOverrideWeight === 100 ? 'text-emerald-600' : 'text-red-500'}`}>
                         Total: {totalOverrideWeight}%
                       </span>
                    </div>
                    {cycle.criteria.map(c => (
                      <div key={c.id} className="flex items-center gap-4">
                        <span className="text-sm text-slate-700 w-1/3 truncate" title={c.name}>{c.name}</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={criteriaWeights[c.id] || 0}
                          onChange={(e) => setCriteriaWeights({...criteriaWeights, [c.id]: parseInt(e.target.value)})}
                          className="flex-1 accent-emerald-500"
                        />
                        <span className="text-sm font-medium w-12 text-right">{criteriaWeights[c.id] || 0}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tier Thresholds Override */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowTiersOverride(!showTiersOverride)}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <span className="text-sm font-semibold text-slate-800">Override Tier Thresholds</span>
                  {showTiersOverride ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>
                {showTiersOverride && (
                  <div className="p-4 bg-white border-t border-slate-200 space-y-4">
                    <div className="grid grid-cols-12 gap-2 mb-2 px-2 text-xs font-semibold text-slate-500">
                        <div className="col-span-4">Tier</div>
                        <div className="col-span-4 text-center">Score Range (%)</div>
                        <div className="col-span-4 text-center">Increment (%)</div>
                    </div>
                    {tierThresholds.map((t, idx) => {
                      const cycleTier = cycle.tiers.find(ct => ct.id === t.tierId);
                      return (
                        <div key={t.tierId} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <div className="col-span-4 flex items-center gap-2">
                             <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: cycleTier?.color || '#ccc'}} />
                             <span className="text-sm font-medium text-slate-800 truncate" title={cycleTier?.name}>{cycleTier?.name}</span>
                          </div>
                          <div className="col-span-4 flex items-center gap-1 justify-center">
                             <input type="number" min="0" max="100" className="w-12 text-center text-sm border rounded py-1" value={t.minScore}
                                onChange={(e) => {
                                  const nt = [...tierThresholds];
                                  nt[idx].minScore = parseInt(e.target.value) || 0;
                                  setTierThresholds(nt);
                                }}
                             />
                             <span className="text-slate-400">-</span>
                             <input type="number" min="0" max="100" className="w-12 text-center text-sm border rounded py-1" value={t.maxScore}
                                onChange={(e) => {
                                  const nt = [...tierThresholds];
                                  nt[idx].maxScore = parseInt(e.target.value) || 0;
                                  setTierThresholds(nt);
                                }}
                             />
                          </div>
                          <div className="col-span-4 flex items-center gap-1 justify-center">
                             <input type="number" min="0" max="100" step="0.1" className="w-12 text-center text-sm border rounded py-1" value={t.incrementMin}
                                onChange={(e) => {
                                  const nt = [...tierThresholds];
                                  nt[idx].incrementMin = parseFloat(e.target.value) || 0;
                                  setTierThresholds(nt);
                                }}
                             />
                             <span className="text-slate-400">-</span>
                             <input type="number" min="0" max="100" step="0.1" className="w-12 text-center text-sm border rounded py-1" value={t.incrementMax}
                                onChange={(e) => {
                                  const nt = [...tierThresholds];
                                  nt[idx].incrementMax = parseFloat(e.target.value) || 0;
                                  setTierThresholds(nt);
                                }}
                             />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex justify-end gap-3 flex-shrink-0 bg-slate-50 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={running}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleRun}
            disabled={running || !name.trim() || (showWeightsOverride && totalOverrideWeight !== 100)}
            className="flex items-center justify-center min-w-[140px] px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-colors"
          >
            {running ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Analyzing {cycle.employeeCount}...
              </>
            ) : (
              'Run Simulation'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
