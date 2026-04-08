import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { type Evaluation, type CriteriaScore } from '../../types/evaluation';
import { type Cycle, type CriteriaItem } from '../../types/cycle';
import { evaluationService } from '../../services/evaluationService';
import { normalizeScore, findTierForScore } from '../../lib/scoreCalculator';
import { Lock, Loader2, AlertCircle, CheckCircle2, Save, X, Star } from 'lucide-react';
import { toast } from 'sonner';

interface EvaluationFormProps {
  evaluation: Evaluation;
  cycle: Cycle;
  onClose: () => void;
  onSuccess: () => void;
  readOnly?: boolean;
}

export const EvaluationForm: React.FC<EvaluationFormProps> = ({
  evaluation,
  cycle,
  onClose,
  onSuccess,
  readOnly = false,
}) => {
  const [scores, setScores] = useState<Record<string, CriteriaScore>>(evaluation.scores || {});
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPristine, setIsPristine] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [missingCriteria, setMissingCriteria] = useState<Set<string>>(new Set());

  const criteriaList = useMemo(() => {
    return [...cycle.criteria].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [cycle.criteria]);

  // Derived state for live score
  const liveTotalScore = useMemo(() => {
    return Object.values(scores).reduce((sum, score) => sum + score.weightedScore, 0);
  }, [scores]);

  const liveTier = useMemo(() => {
    return findTierForScore(liveTotalScore, cycle.tiers);
  }, [liveTotalScore, cycle.tiers]);

  const filledCount = Object.keys(scores).length;

  // Handle score change
  const handleScoreChange = useCallback((criteria: CriteriaItem, rawValue: number) => {
    if (readOnly) return;

    const normalized = normalizeScore(rawValue, criteria.measurementType, criteria.minValue, criteria.maxValue);
    const weighted = (normalized * criteria.weight) / 100;

    setScores(prev => ({
      ...prev,
      [criteria.id]: {
        criteriaId: criteria.id,
        criteriaName: criteria.name,
        rawScore: rawValue,
        normalizedScore: normalized,
        weight: criteria.weight,
        weightedScore: weighted
      }
    }));

    setIsPristine(false);
    setMissingCriteria(prev => {
      const next = new Set(prev);
      next.delete(criteria.id);
      return next;
    });
  }, [readOnly]);

  // Auto-save logic
  useEffect(() => {
    if (isPristine || readOnly) return;

    const timeoutId = setTimeout(async () => {
      setIsSaving(true);
      try {
        await evaluationService.saveDraft(evaluation.id, scores);
        setLastSaved(new Date());
      } catch (err) {
         console.error('Auto-save failed:', err);
      } finally {
        setIsSaving(false);
      }
    }, 30000); // 30 seconds

    return () => clearTimeout(timeoutId);
  }, [scores, isPristine, readOnly, evaluation.id]);

  const handleSaveDraft = async () => {
    if (readOnly) return;
    setIsSaving(true);
    try {
      await evaluationService.saveDraft(evaluation.id, scores);
      setLastSaved(new Date());
      setIsPristine(true);
      toast.success('Draft saved successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save draft');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (readOnly) return;

    // Validate
    const missing = new Set<string>();
    for (const c of criteriaList) {
       if (!scores[c.id]) missing.add(c.id);
    }

    if (missing.size > 0) {
       setMissingCriteria(missing);
       toast.error(`Please complete all criteria (${missing.size} missing).`);
       return;
    }

    if (!window.confirm(`Submit evaluation for ${evaluation.employeeName}? This will notify them that their evaluation is complete.`)) {
        return;
    }

    setIsSubmitting(true);
    try {
      await evaluationService.submitEvaluation(evaluation.id, scores);
      toast.success('Evaluation submitted successfully');
      onSuccess();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to submit evaluation';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderInput = (c: CriteriaItem) => {
     const val = scores[c.id]?.rawScore;

     if (c.measurementType === 'boolean') {
         return (
             <div className="flex items-center gap-4 mt-3">
                <button
                   onClick={() => handleScoreChange(c, 1)}
                   disabled={readOnly}
                   className={`px-4 py-2 rounded-lg border font-medium text-sm transition-colors ${val === 1 ? 'bg-emerald-100 border-emerald-500 text-emerald-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >Yes</button>
                <button
                   onClick={() => handleScoreChange(c, 0)}
                   disabled={readOnly}
                   className={`px-4 py-2 rounded-lg border font-medium text-sm transition-colors ${val === 0 ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >No</button>
             </div>
         );
     }
     if (c.measurementType === 'rating') {
         return (
             <div className="flex items-center gap-2 mt-3">
                 {[1, 2, 3, 4, 5].map(star => (
                     <button
                        key={star}
                        onClick={() => handleScoreChange(c, star)}
                        disabled={readOnly}
                        className="focus:outline-none"
                     >
                         <Star className={`w-8 h-8 transition-transform ${!readOnly && 'hover:scale-110'} ${val && val >= star ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />
                     </button>
                 ))}
             </div>
         );
     }
     if (c.measurementType === 'percentage') {
         return (
             <div className="mt-3 flex items-center gap-4">
                 <input
                     type="range"
                     min="0"
                     max="100"
                     value={val ?? 0}
                     onChange={(e) => handleScoreChange(c, Number(e.target.value))}
                     disabled={readOnly}
                     className="flex-1 accent-emerald-500"
                 />
                 <div className="flex items-center gap-1">
                     <input
                         type="number"
                         min="0"
                         max="100"
                         value={val ?? ''}
                         onChange={(e) => handleScoreChange(c, Number(e.target.value))}
                         disabled={readOnly}
                         className="w-16 px-2 py-1 border border-slate-300 rounded text-center text-sm"
                     />
                     <span className="text-slate-500 font-medium">%</span>
                 </div>
             </div>
         );
     }
     if (c.measurementType === 'numeric') {
         return (
             <div className="mt-3">
                 <input
                     type="number"
                     min={c.minValue}
                     max={c.maxValue}
                     value={val ?? ''}
                     onChange={(e) => handleScoreChange(c, Number(e.target.value))}
                     disabled={readOnly}
                     placeholder={`Score (min: ${c.minValue}, max: ${c.maxValue})`}
                     className="w-full max-w-xs px-3 py-2 border border-slate-300 rounded-lg text-sm"
                 />
             </div>
         );
     }
     return null;
  };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-y-0 right-0 w-full max-w-2xl bg-slate-50 shadow-2xl flex flex-col z-50 font-brand"
    >
      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-lg border border-emerald-200">
            {evaluation.employeeName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{evaluation.employeeName}</h2>
            <p className="text-sm text-slate-500">{cycle.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                evaluation.status === 'submitted' ? 'bg-emerald-100 text-emerald-700' :
                evaluation.status === 'draft' ? 'bg-amber-100 text-amber-700' :
                evaluation.status === 'not_started' ? 'bg-slate-100 text-slate-600' :
                'bg-gray-100 text-gray-600'
            }`}>
                {evaluation.status === 'not_started' ? 'Not Started' :
                 evaluation.status === 'draft' ? 'Draft' :
                 evaluation.status.charAt(0).toUpperCase() + evaluation.status.slice(1)}
            </span>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
            </button>
        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <Lock className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            Criteria locked on {cycle.lockedAt ? cycle.lockedAt.toDate().toLocaleDateString() : 'N/A'}. These criteria cannot be changed.
          </p>
        </div>

        <div className="space-y-4">
            {criteriaList.map(c => {
                const isFilled = scores[c.id] !== undefined;
                const isMissing = missingCriteria.has(c.id);

                return (
                    <div key={c.id} className={`bg-white rounded-xl p-5 transition-colors ${
                        isMissing ? 'border-2 border-red-400 bg-red-50/20' :
                        isFilled ? 'border-2 border-emerald-200 bg-emerald-50/30' :
                        'border border-slate-200'
                    }`}>
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="font-bold text-slate-900">{c.name}</h3>
                                {c.description && <p className="text-xs text-slate-500 mt-1">{c.description}</p>}
                            </div>
                            <div className="flex gap-2">
                                <span className="text-xs font-semibold px-2 py-1 bg-slate-100 text-slate-600 rounded-lg">{c.dataSource}</span>
                                <span className="text-xs font-bold px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg">{c.weight}%</span>
                            </div>
                        </div>

                        {renderInput(c)}

                        <div className="mt-3 text-xs font-medium text-slate-500">
                             Contribution to total: <span className="text-slate-700">{scores[c.id]?.weightedScore?.toFixed(2) || '0.00'} pts</span>
                        </div>
                        {isMissing && <p className="text-xs text-red-600 mt-2 font-medium flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5"/> Required</p>}
                    </div>
                );
            })}
        </div>
      </div>

      {/* LIVE SCORE SUMMARY & ACTIONS */}
      <div className="bg-white border-t border-slate-200 p-4 sticky bottom-0 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] flex-shrink-0">
         <div className="flex items-center justify-between mb-4">
             <div>
                 <p className="text-sm text-slate-500 font-medium mb-1">Total Score: <strong className="text-slate-900 text-lg">{liveTotalScore.toFixed(1)} / 100</strong></p>
                 <div className="flex items-center gap-2">
                     {liveTier ? (
                         <span className="px-2 py-0.5 text-xs font-bold rounded-full text-white shadow-sm" style={{ backgroundColor: liveTier.color }}>
                            {liveTier.name}
                         </span>
                     ) : (
                         <span className="text-xs text-slate-400">No Tier</span>
                     )}
                     <span className="text-xs text-slate-500">
                         Est. increment: {liveTier ? `${liveTier.incrementMin}% – ${liveTier.incrementMax}%` : '0%'}
                     </span>
                 </div>
             </div>
             <div className="text-right">
                 <p className="text-sm font-medium text-slate-700">{filledCount} / {criteriaList.length} filled</p>
                 <div className="flex items-center justify-end gap-1 text-xs text-slate-400 mt-1 h-4">
                    {isSaving ? (
                        <><Loader2 className="w-3 h-3 animate-spin"/> Saving...</>
                    ) : lastSaved ? (
                        <><CheckCircle2 className="w-3 h-3 text-emerald-500"/> Saved {lastSaved.toLocaleTimeString()}</>
                    ) : null}
                 </div>
             </div>
         </div>

         {!readOnly && (
             <div className="flex gap-3">
                 <button
                    onClick={handleSaveDraft}
                    disabled={isSaving || isSubmitting || isPristine}
                    className="flex-1 py-2.5 bg-white border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                 >
                     <Save className="w-4 h-4"/>
                     Save Draft
                 </button>
                 <button
                    onClick={handleSubmit}
                    disabled={isSaving || isSubmitting}
                    className="flex-1 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center"
                 >
                     {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit Evaluation'}
                 </button>
             </div>
         )}
         {readOnly && evaluation.status === 'submitted' && (
             <button
                onClick={() => toast.error('Edit flow to be implemented')} // Typically sets status back to draft, or opens locally
                className="w-full py-2.5 bg-white border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
             >
                Edit Evaluation
             </button>
         )}
      </div>
    </motion.div>
  );
};