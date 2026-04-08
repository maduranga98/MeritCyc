import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { type Cycle } from '../../types/cycle';
import { type Evaluation } from '../../types/evaluation';
import { evaluationService } from '../../services/evaluationService';
import { AlertCircle, CheckCircle2, Loader2, X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface FinalizeCycleModalProps {
  cycle: Cycle;
  evaluations: Evaluation[];
  onClose: () => void;
  onSuccess: () => void;
}

export const FinalizeCycleModal: React.FC<FinalizeCycleModalProps> = ({
  cycle,
  evaluations,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState(1);
  const [confirmText, setConfirmText] = useState('');
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [acknowledgedIncomplete, setAcknowledgedIncomplete] = useState(false);

  // Stats
  const totalEvals = evaluations.length;
  const submittedEvals = evaluations.filter(e => e.status === 'submitted' || e.status === 'overridden').length;
  const incompleteEvals = evaluations.filter(e => e.status === 'not_started' || e.status === 'draft');
  const hasIncomplete = incompleteEvals.length > 0;

  let totalCommitted = 0;
  let incrementCount = 0;
  const tierCounts: Record<string, number> = {};

  evaluations.forEach(e => {
      if ((e.status === 'submitted' || e.status === 'overridden') && e.incrementAmount && e.incrementAmount > 0) {
          totalCommitted += e.incrementAmount;
          incrementCount++;
      }
      if (e.assignedTierName) {
          tierCounts[e.assignedTierName] = (tierCounts[e.assignedTierName] || 0) + 1;
      }
  });

  const totalPayroll = evaluations.reduce((sum, e) => sum + (e.currentSalary || 50000), 0); // Mocking 50k if missing
  const averageIncrement = incrementCount > 0 ? (totalCommitted / totalPayroll) * 100 : 0;

  let budgetUtilized = 0;
  const maxBudget = cycle.budget?.totalBudget || (cycle.budget?.maxPercentage ? (totalPayroll * cycle.budget.maxPercentage / 100) : 0);
  if (maxBudget > 0) {
      budgetUtilized = (totalCommitted / maxBudget) * 100;
  }

  const handleFinalize = async () => {
    if (confirmText !== 'FINALIZE') return;

    setIsFinalizing(true);
    try {
      await evaluationService.finalizeCycle(cycle.id);
      toast.success('Cycle finalized successfully!');
      onSuccess();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to finalize cycle';
      toast.error(msg);
    } finally {
      setIsFinalizing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 font-brand">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">Finalize Cycle: {cycle.name}</h2>
          {!isFinalizing && (
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
          )}
        </div>

        <div className="p-6 overflow-y-auto">
            {step === 1 && (
                <div className="space-y-6">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 mb-4">Pre-flight Checklist</h3>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                {submittedEvals === totalEvals ? (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                ) : (
                                    <AlertCircle className="w-5 h-5 text-amber-500" />
                                )}
                                <span className="text-slate-700 font-medium">All evaluations submitted: {submittedEvals} of {totalEvals}</span>
                            </div>

                            <div className="flex items-center gap-3">
                                {!hasIncomplete ? (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                ) : (
                                    <AlertTriangle className="w-5 h-5 text-red-500" />
                                )}
                                <span className={`font-medium ${hasIncomplete ? 'text-red-600' : 'text-slate-700'}`}>
                                    No incomplete evaluations: {incompleteEvals.length} incomplete
                                </span>
                            </div>

                            <div className="flex items-center gap-3">
                                {budgetUtilized <= 100 ? (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                ) : (
                                    <AlertTriangle className="w-5 h-5 text-red-500" />
                                )}
                                <span className="text-slate-700 font-medium">Budget within limits: {budgetUtilized.toFixed(1)}% utilized</span>
                            </div>
                        </div>
                    </div>

                    {hasIncomplete && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                            <p className="text-sm text-red-800 font-medium mb-3">
                                {incompleteEvals.length} employees have not been fully evaluated. If you proceed, they will receive a 0% increment.
                            </p>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={acknowledgedIncomplete}
                                    onChange={(e) => setAcknowledgedIncomplete(e.target.checked)}
                                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                                />
                                <span className="text-sm font-medium text-slate-700">
                                    I acknowledge that {incompleteEvals.length} employees will receive no increment.
                                </span>
                            </label>
                        </div>
                    )}

                    <div className="flex justify-end pt-4">
                        <button
                            onClick={() => setStep(2)}
                            disabled={hasIncomplete && !acknowledgedIncomplete}
                            className="px-6 py-2.5 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
                        >
                            Next Step
                        </button>
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="space-y-6">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 mb-4">Finalization Summary</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                                <p className="text-xs text-slate-500 font-medium mb-1">Employees Receiving Increments</p>
                                <p className="text-xl font-bold text-slate-900">{incrementCount}</p>
                            </div>
                            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                                <p className="text-xs text-slate-500 font-medium mb-1">Average Increment</p>
                                <p className="text-xl font-bold text-slate-900">{averageIncrement.toFixed(1)}%</p>
                            </div>
                            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl col-span-2">
                                <p className="text-xs text-slate-500 font-medium mb-1">Total Budget Committed</p>
                                <p className="text-xl font-bold text-emerald-600">{cycle.budget?.currency || 'USD'} {totalCommitted.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                        <h4 className="text-red-800 font-bold mb-2 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5"/>
                            This action is irreversible
                        </h4>
                        <p className="text-sm text-red-700 mb-4">
                            Finalizing the cycle will lock all scores, generate increment letters for all employees, and close the cycle.
                        </p>
                        <label className="block text-sm font-bold text-slate-900 mb-2">
                            Type FINALIZE to confirm:
                        </label>
                        <input
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            placeholder="FINALIZE"
                        />
                    </div>

                    <div className="flex justify-between pt-4">
                        <button
                            onClick={() => setStep(1)}
                            disabled={isFinalizing}
                            className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            Back
                        </button>
                        <button
                            onClick={handleFinalize}
                            disabled={confirmText !== 'FINALIZE' || isFinalizing}
                            className="px-6 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                        >
                            {isFinalizing ? <><Loader2 className="w-4 h-4 animate-spin"/> Finalizing...</> : 'Finalize Cycle'}
                        </button>
                    </div>
                </div>
            )}
        </div>
      </motion.div>
    </div>
  );
};