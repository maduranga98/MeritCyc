import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { cycleService } from '../../services/cycleService';
import { departmentService } from '../../services/departmentService';
import { salaryBandService } from '../../services/salaryBandService';
import { type Department } from '../../types/department';
import { type SalaryBand } from '../../types/salaryBand';
import { type Cycle } from '../../types/cycle';

interface CreateCycleWizardProps {
  onClose: () => void;
  onCreated: (cycleId: string) => void;
}

interface WizardData {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  evaluationDeadline: string;
  scope: {
    allEmployees: boolean;
    departmentIds: string[];
    salaryBandIds: string[];
  };
  budget: {
    type: 'percentage' | 'fixed_pool';
    maxPercentage: string;
    totalBudget: string;
    currency: string;
  };
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepDot({ step, current, label }: { step: number; current: number; label: string }) {
  const done = step < current;
  const active = step === current;
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
          done
            ? 'bg-emerald-600 text-white'
            : active
            ? 'bg-slate-900 text-white ring-4 ring-slate-200'
            : 'bg-slate-100 text-slate-400'
        }`}
      >
        {done ? <Check className="w-4 h-4" /> : step}
      </div>
      <span className={`text-xs font-medium ${active ? 'text-slate-900' : 'text-slate-400'}`}>
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Basic Info
// ---------------------------------------------------------------------------

function Step1({
  data,
  onChange,
}: {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Cycle Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={data.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. Q1 2026 Annual Increment"
          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
        <textarea
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Optional — describe the purpose of this cycle"
          rows={3}
          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Start Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={data.startDate}
            onChange={(e) => onChange({ startDate: e.target.value })}
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            End Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={data.endDate}
            onChange={(e) => onChange({ endDate: e.target.value })}
            min={data.startDate}
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Evaluation Deadline <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={data.evaluationDeadline}
          onChange={(e) => onChange({ evaluationDeadline: e.target.value })}
          min={data.startDate}
          max={data.endDate}
          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
        <p className="text-xs text-slate-500 mt-1">Must be between start and end dates</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Scope
// ---------------------------------------------------------------------------

function Step2({
  data,
  onChange,
  departments,
  salaryBands,
}: {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
  departments: Department[];
  salaryBands: SalaryBand[];
}) {
  const toggleDept = (id: string) => {
    const ids = data.scope.departmentIds.includes(id)
      ? data.scope.departmentIds.filter((d) => d !== id)
      : [...data.scope.departmentIds, id];
    onChange({ scope: { ...data.scope, departmentIds: ids } });
  };

  const toggleBand = (id: string) => {
    const ids = data.scope.salaryBandIds.includes(id)
      ? data.scope.salaryBandIds.filter((b) => b !== id)
      : [...data.scope.salaryBandIds, id];
    onChange({ scope: { ...data.scope, salaryBandIds: ids } });
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-slate-700 mb-3">Who does this cycle cover?</p>
        <div className="space-y-2">
          <label className="flex items-center gap-3 p-3.5 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
            <input
              type="radio"
              checked={data.scope.allEmployees}
              onChange={() => onChange({ scope: { ...data.scope, allEmployees: true, departmentIds: [], salaryBandIds: [] } })}
              className="accent-emerald-600"
            />
            <div>
              <p className="text-sm font-semibold text-slate-900">All Employees</p>
              <p className="text-xs text-slate-500">Include everyone in the company</p>
            </div>
          </label>
          <label className="flex items-center gap-3 p-3.5 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
            <input
              type="radio"
              checked={!data.scope.allEmployees}
              onChange={() => onChange({ scope: { ...data.scope, allEmployees: false } })}
              className="accent-emerald-600"
            />
            <div>
              <p className="text-sm font-semibold text-slate-900">Specific Departments / Salary Bands</p>
              <p className="text-xs text-slate-500">Target specific groups</p>
            </div>
          </label>
        </div>
      </div>

      {!data.scope.allEmployees && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Departments</p>
            <div className="border border-slate-200 rounded-lg overflow-auto max-h-48 divide-y divide-slate-100">
              {departments.length === 0 ? (
                <p className="text-xs text-slate-400 p-3">No departments found</p>
              ) : (
                departments.map((dept) => (
                  <label key={dept.id} className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={data.scope.departmentIds.includes(dept.id)}
                      onChange={() => toggleDept(dept.id)}
                      className="accent-emerald-600"
                    />
                    <span className="text-sm text-slate-700">{dept.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Salary Bands</p>
            <div className="border border-slate-200 rounded-lg overflow-auto max-h-48 divide-y divide-slate-100">
              {salaryBands.length === 0 ? (
                <p className="text-xs text-slate-400 p-3">No salary bands found</p>
              ) : (
                salaryBands.map((band) => (
                  <label key={band.id} className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={data.scope.salaryBandIds.includes(band.id)}
                      onChange={() => toggleBand(band.id)}
                      className="accent-emerald-600"
                    />
                    <span className="text-sm text-slate-700">{band.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Budget
// ---------------------------------------------------------------------------

function Step3({
  data,
  onChange,
}: {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-slate-700 mb-3">Budget Type</p>
        <div className="space-y-2">
          <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
            <input
              type="radio"
              checked={data.budget.type === 'percentage'}
              onChange={() => onChange({ budget: { ...data.budget, type: 'percentage' } })}
              className="accent-emerald-600 mt-0.5"
            />
            <div>
              <p className="text-sm font-semibold text-slate-900">Percentage Based</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Set a maximum increment percentage. Each employee's increment is calculated as a percentage of their current salary.
              </p>
            </div>
          </label>
          <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
            <input
              type="radio"
              checked={data.budget.type === 'fixed_pool'}
              onChange={() => onChange({ budget: { ...data.budget, type: 'fixed_pool' } })}
              className="accent-emerald-600 mt-0.5"
            />
            <div>
              <p className="text-sm font-semibold text-slate-900">Fixed Pool</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Set a total budget to be distributed. Allocate a fixed amount across all employees in scope.
              </p>
            </div>
          </label>
        </div>
      </div>

      {data.budget.type === 'percentage' && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Maximum Increment %</label>
          <div className="relative">
            <input
              type="number"
              min={0}
              max={100}
              value={data.budget.maxPercentage}
              onChange={(e) => onChange({ budget: { ...data.budget, maxPercentage: e.target.value } })}
              placeholder="e.g. 15"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-10"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
          </div>
        </div>
      )}

      {data.budget.type === 'fixed_pool' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Total Budget</label>
            <input
              type="number"
              min={0}
              value={data.budget.totalBudget}
              onChange={(e) => onChange({ budget: { ...data.budget, totalBudget: e.target.value } })}
              placeholder="e.g. 500000"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Currency</label>
            <select
              value={data.budget.currency}
              onChange={(e) => onChange({ budget: { ...data.budget, currency: e.target.value } })}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="LKR">LKR</option>
              <option value="INR">INR</option>
              <option value="AUD">AUD</option>
              <option value="SGD">SGD</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Review
// ---------------------------------------------------------------------------

function Step4({ data }: { data: WizardData }) {
  const rows: { label: string; value: string }[] = [
    { label: 'Cycle Name', value: data.name || '—' },
    { label: 'Description', value: data.description || '—' },
    { label: 'Start Date', value: data.startDate || '—' },
    { label: 'End Date', value: data.endDate || '—' },
    { label: 'Evaluation Deadline', value: data.evaluationDeadline || '—' },
    {
      label: 'Scope',
      value: data.scope.allEmployees
        ? 'All Employees'
        : `${data.scope.departmentIds.length} dept(s), ${data.scope.salaryBandIds.length} band(s)`,
    },
    {
      label: 'Budget',
      value:
        data.budget.type === 'percentage'
          ? `Percentage Based (max ${data.budget.maxPercentage || '—'}%)`
          : `Fixed Pool (${data.budget.currency} ${data.budget.totalBudget || '—'})`,
    },
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 mb-4">Review your cycle setup before creating.</p>
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        {rows.map((row, i) => (
          <div
            key={i}
            className={`flex justify-between py-3 px-4 text-sm ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}
          >
            <span className="font-medium text-slate-500">{row.label}</span>
            <span className="text-slate-900 text-right max-w-[60%]">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wizard Shell
// ---------------------------------------------------------------------------

const STEPS = ['Basic Info', 'Scope', 'Budget', 'Review'];

export default function CreateCycleWizard({ onClose, onCreated }: CreateCycleWizardProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [salaryBands, setSalaryBands] = useState<SalaryBand[]>([]);

  const [data, setData] = useState<WizardData>({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    evaluationDeadline: '',
    scope: { allEmployees: true, departmentIds: [], salaryBandIds: [] },
    budget: { type: 'percentage', maxPercentage: '', totalBudget: '', currency: 'USD' },
  });

  useEffect(() => {
    if (!user?.companyId) return;
    departmentService.getDepartments(user.companyId).then(setDepartments).catch((err) => console.error("Load failed:", err));
    salaryBandService.getSalaryBands(user.companyId).then(setSalaryBands).catch((err) => console.error("Load failed:", err));
  }, [user?.companyId]);

  const merge = (partial: Partial<WizardData>) => setData((d) => ({ ...d, ...partial }));

  const validateStep = (): string | null => {
    if (step === 1) {
      if (!data.name.trim()) return 'Cycle name is required.';
      if (!data.startDate) return 'Start date is required.';
      if (!data.endDate) return 'End date is required.';
      if (!data.evaluationDeadline) return 'Evaluation deadline is required.';
      if (data.endDate <= data.startDate) return 'End date must be after start date.';
      if (data.evaluationDeadline > data.endDate) return 'Evaluation deadline must be on or before end date.';
    }
    if (step === 3) {
      if (data.budget.type === 'percentage' && !data.budget.maxPercentage)
        return 'Maximum increment percentage is required.';
      if (data.budget.type === 'fixed_pool' && !data.budget.totalBudget)
        return 'Total budget is required.';
    }
    return null;
  };

  const handleNext = () => {
    const err = validateStep();
    if (err) { toast.error(err); return; }
    setStep((s) => s + 1);
  };

  const handleCreate = async () => {
    const err = validateStep();
    if (err) { toast.error(err); return; }
    setSubmitting(true);
    try {
      const budget: Cycle['budget'] =
        data.budget.type === 'percentage'
          ? { type: 'percentage', maxPercentage: Number(data.budget.maxPercentage), currency: data.budget.currency }
          : { type: 'fixed_pool', totalBudget: Number(data.budget.totalBudget), currency: data.budget.currency };

      const result = await cycleService.createCycle({
        name: data.name.trim(),
        description: data.description.trim() || undefined,
        scope: data.scope,
        budget,
        timeline: {
          startDate: data.startDate,
          endDate: data.endDate,
          evaluationDeadline: data.evaluationDeadline,
        },
      });

      toast.success('Cycle created! Set up criteria to publish.');
      onCreated(result.cycleId);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to create cycle.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg font-brand overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900">New Increment Cycle</h2>
              <p className="text-sm text-slate-500">Step {step} of {STEPS.length}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step dots */}
          <div className="flex justify-center gap-6 px-6 py-4 border-b border-slate-100">
            {STEPS.map((label, i) => (
              <StepDot key={i} step={i + 1} current={step} label={label} />
            ))}
          </div>

          {/* Step content */}
          <div className="px-6 py-5 min-h-[280px]">
            {step === 1 && <Step1 data={data} onChange={merge} />}
            {step === 2 && <Step2 data={data} onChange={merge} departments={departments} salaryBands={salaryBands} />}
            {step === 3 && <Step3 data={data} onChange={merge} />}
            {step === 4 && <Step4 data={data} />}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
            <button
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 1}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            {step < STEPS.length ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-colors"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Create Draft Cycle
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
