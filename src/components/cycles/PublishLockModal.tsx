import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, XCircle, AlertTriangle, Lock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { type Cycle } from '../../types/cycle';
import { cycleService } from '../../services/cycleService';

interface PublishLockModalProps {
  cycle: Cycle;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 1 | 2 | 3;

interface PreflightCheck {
  label: string;
  pass: boolean;
  detail: string;
}

export default function PublishLockModal({ cycle, onClose, onSuccess }: PublishLockModalProps) {
  const [step, setStep] = useState<Step>(1);
  const [understood, setUnderstood] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const totalWeight = cycle.criteria.reduce((s, c) => s + c.weight, 0);
  const weightsOk = cycle.criteria.length > 0 && Math.round(totalWeight) === 100;

  const checks: PreflightCheck[] = [
    {
      label: 'Criteria added',
      pass: cycle.criteria.length > 0,
      detail: cycle.criteria.length > 0 ? `${cycle.criteria.length} criteria` : 'No criteria configured',
    },
    {
      label: 'Weights sum to 100%',
      pass: weightsOk,
      detail: weightsOk ? `${totalWeight}% ✓` : `Currently at ${totalWeight}% — must equal 100%`,
    },
    {
      label: 'Tiers configured',
      pass: cycle.tiers.length > 0,
      detail: cycle.tiers.length > 0 ? `${cycle.tiers.length} tiers` : 'No tiers configured',
    },
    {
      label: 'Employees in scope',
      pass: cycle.employeeCount > 0,
      detail: cycle.employeeCount > 0 ? `${cycle.employeeCount} employees` : 'No employees in scope',
    },
    {
      label: 'Evaluation deadline set',
      pass: !!cycle.timeline?.evaluationDeadline,
      detail: cycle.timeline?.evaluationDeadline ? 'Set ✓' : 'No evaluation deadline',
    },
  ];

  const allChecksPass = checks.every((c) => c.pass);
  const nameMatches = confirmName === cycle.name;

  const handlePublish = async () => {
    if (!nameMatches) {
      toast.error('Cycle name does not match.');
      return;
    }
    setSubmitting(true);
    try {
      await cycleService.publishAndLockCycle({ cycleId: cycle.id, confirmationCode: confirmName });
      toast.success(`Cycle "${cycle.name}" published and locked successfully.`);
      onSuccess();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to publish cycle.';
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
        className="fixed inset-0 bg-slate-900/70 z-50 flex items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg font-brand overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
                <Lock className="w-4.5 h-4.5 text-red-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Publish & Lock Cycle</h2>
                <p className="text-xs text-slate-500">Step {step} of 3</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step 1 — Pre-flight checks */}
          {step === 1 && (
            <div className="px-6 py-5">
              <p className="text-sm text-slate-600 mb-4">
                Before locking, we'll verify everything is ready:
              </p>
              <div className="space-y-2.5">
                {checks.map((check, i) => (
                  <div key={i} className={`flex items-start gap-3 p-3.5 rounded-xl border ${check.pass ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                    {check.pass
                      ? <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      : <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    }
                    <div>
                      <p className={`text-sm font-semibold ${check.pass ? 'text-emerald-800' : 'text-red-800'}`}>{check.label}</p>
                      <p className={`text-xs mt-0.5 ${check.pass ? 'text-emerald-600' : 'text-red-600'}`}>{check.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 — Consequences warning */}
          {step === 2 && (
            <div className="px-6 py-5 space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-amber-900 mb-2">This action is permanent and cannot be undone.</p>
                    <ul className="text-sm text-amber-800 space-y-1.5">
                      <li>• All criteria will be locked immediately</li>
                      <li>• <strong>{cycle.employeeCount}</strong> employees will be notified</li>
                      <li>• Criteria cannot be edited after locking</li>
                      <li>• To make changes, you must cancel this cycle and create a new one</li>
                    </ul>
                  </div>
                </div>
              </div>

              <label className="flex items-start gap-3 cursor-pointer select-none">
                <div className="relative mt-0.5">
                  <input
                    type="checkbox"
                    checked={understood}
                    onChange={(e) => setUnderstood(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${understood ? 'bg-slate-900 border-slate-900' : 'border-slate-300'}`}>
                    {understood && <Check className="w-3 h-3 text-white" />}
                  </div>
                </div>
                <span className="text-sm text-slate-700 font-medium">
                  I understand this action is irreversible and I am ready to lock this cycle.
                </span>
              </label>
            </div>
          )}

          {/* Step 3 — Confirmation */}
          {step === 3 && (
            <div className="px-6 py-5 space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-800 font-semibold mb-1">Final confirmation required</p>
                <p className="text-sm text-red-700">
                  Type the cycle name exactly as shown to confirm locking:
                </p>
                <p className="mt-2 text-sm font-mono font-bold text-red-900 bg-white border border-red-200 px-3 py-2 rounded-lg">
                  {cycle.name}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Type cycle name to confirm:
                </label>
                <input
                  type="text"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder={cycle.name}
                  autoFocus
                  className={`w-full px-3.5 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors ${
                    confirmName.length > 0
                      ? nameMatches
                        ? 'border-emerald-400 focus:ring-emerald-500 bg-emerald-50/30'
                        : 'border-red-300 focus:ring-red-500'
                      : 'border-slate-300 focus:ring-emerald-500'
                  }`}
                />
                {confirmName.length > 0 && !nameMatches && (
                  <p className="text-xs text-red-500 mt-1">Doesn't match. Check for typos.</p>
                )}
                {nameMatches && (
                  <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Name matches
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              {step > 1 && (
                <button
                  onClick={() => setStep((s) => (s - 1) as Step)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  Back
                </button>
              )}

              {step === 1 && (
                allChecksPass ? (
                  <button
                    onClick={() => setStep(2)}
                    className="px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    onClick={onClose}
                    className="px-5 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Fix Issues
                  </button>
                )
              )}

              {step === 2 && (
                <button
                  onClick={() => setStep(3)}
                  disabled={!understood}
                  className="px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  I understand, continue
                </button>
              )}

              {step === 3 && (
                <button
                  onClick={handlePublish}
                  disabled={!nameMatches || submitting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Publishing…
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Publish & Lock Cycle
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Micro-component used inside modal (can't import from lucide without re-export)
function Check({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
