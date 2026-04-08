import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { type Evaluation, type CriteriaScore } from '../../types/evaluation';
import { type Cycle, type CriteriaItem } from '../../types/cycle';
import { evaluationService } from '../../services/evaluationService';
import { normalizeScore, findTierForScore } from '../../lib/scoreCalculator';
import { AlertTriangle, Loader2, X, Star } from 'lucide-react';
import { toast } from 'sonner';

interface OverrideScorePanelProps {
  evaluation: Evaluation;
  cycle: Cycle;
  onClose: () => void;
  onSuccess: () => void;
}

export const OverrideScorePanel: React.FC<OverrideScorePanelProps> = ({
  evaluation,
  cycle,
  onClose,
  onSuccess,
}) => {
  const [overrideScores, setOverrideScores] = useState<Record<string, CriteriaScore>>(evaluation.scores || {});
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const criteriaList = useMemo(() => {
    return [...cycle.criteria].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [cycle.criteria]);

  // Derived state for live score
  const liveTotalScore = useMemo(() => {
    return Object.values(overrideScores).reduce((sum, score) => sum + score.weightedScore, 0);
  }, [overrideScores]);

  const liveTier = useMemo(() => {
    return findTierForScore(liveTotalScore, cycle.tiers);
  }, [liveTotalScore, cycle.tiers]);

  const handleScoreChange = (criteria: CriteriaItem, rawValue: number) => {
    const normalized = normalizeScore(rawValue, criteria.measurementType, criteria.minValue, criteria.maxValue);
    const weighted = (normalized * criteria.weight) / 100;

    setOverrideScores(prev => ({
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
  };

  const handleSubmit = async () => {
    if (reason.length < 10) {
       toast.error('Reason must be at least 10 characters.');
       return;
    }

    if (!window.confirm(`Override ${evaluation.employeeName}'s evaluation? Reason will be logged and visible in audit trail.`)) {
        return;
    }

    setIsSubmitting(true);
    try {
      await evaluationService.overrideScore(evaluation.id, overrideScores, reason);
      toast.success('Evaluation overridden successfully');
      onSuccess();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to override evaluation';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderInput = (c: CriteriaItem) => {
     const val = overrideScores[c.id]?.rawScore;

     if (c.measurementType === 'boolean') {
         return (
             <div className="flex items-center gap-4 mt-3">
                <button
                   onClick={() => handleScoreChange(c, 1)}
                   className={`px-4 py-2 rounded-lg border font-medium text-sm transition-colors ${val === 1 ? 'bg-emerald-100 border-emerald-500 text-emerald-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >Yes</button>
                <button
                   onClick={() => handleScoreChange(c, 0)}
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
                        className="focus:outline-none hover:scale-110 transition-transform"
                     >
                         <Star className={`w-8 h-8 transition-transform ${val && val >= star ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />
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
                     className="flex-1 accent-emerald-500"
                 />
                 <div className="flex items-center gap-1">
                     <input
                         type="number"
                         min="0"
                         max="100"
                         value={val ?? ''}
                         onChange={(e) => handleScoreChange(c, Number(e.target.value))}
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
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg border border-blue-200">
            {evaluation.employeeName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Override: {evaluation.employeeName}</h2>
            <p className="text-sm text-slate-500">{cycle.name}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
        </button>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Warning Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            <strong>⚠️ Warning:</strong> Overriding scores bypasses manager evaluation. This action is fully audit-logged.
          </p>
        </div>

        {/* Original Scores Summary */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
           <h3 className="text-sm font-bold text-slate-900 mb-3">Original Evaluation (Submitted by {evaluation.managerName || 'Manager'})</h3>
           <div className="grid grid-cols-2 gap-4 mb-4">
               <div>
                   <p className="text-xs text-slate-500 mb-1">Total Score</p>
                   <p className="text-lg font-bold text-slate-900">{evaluation.weightedTotalScore?.toFixed(1)} / 100</p>
               </div>
               <div>
                   <p className="text-xs text-slate-500 mb-1">Assigned Tier</p>
                   <p className="text-sm font-bold text-slate-900">{evaluation.assignedTierName || 'N/A'}</p>
               </div>
           </div>
           <div className="space-y-2">
               {criteriaList.map(c => (
                   <div key={c.id} className="flex justify-between text-sm py-1 border-b border-slate-50 last:border-0">
                       <span className="text-slate-600">{c.name}</span>
                       <span className="font-medium text-slate-900">
                           {evaluation.scores[c.id]?.rawScore ?? 'N/A'}
                           <span className="text-slate-400 font-normal ml-2">({evaluation.scores[c.id]?.weightedScore?.toFixed(1)} pts)</span>
                       </span>
                   </div>
               ))}
           </div>
        </div>

        {/* Override Form */}
        <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Override Scores</h3>
            {criteriaList.map(c => (
                <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="flex items-start justify-between">
                        <div>
                            <h4 className="font-bold text-slate-900">{c.name}</h4>
                        </div>
                        <span className="text-xs font-bold px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg">{c.weight}%</span>
                    </div>
                    {renderInput(c)}
                </div>
            ))}
        </div>

        {/* Reason Field */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
            <label className="block text-sm font-bold text-slate-900 mb-2">
                Reason for override (required)
            </label>
            <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Explain why this score is being overridden..."
            />
            <p className="text-xs text-slate-500 mt-2 flex justify-between">
                <span>Minimum 10 characters</span>
                <span className={reason.length >= 10 ? 'text-emerald-600' : 'text-amber-600'}>{reason.length} / 10</span>
            </p>
        </div>
      </div>

      {/* LIVE SCORE SUMMARY & ACTIONS */}
      <div className="bg-white border-t border-slate-200 p-4 sticky bottom-0 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] flex-shrink-0">
         <div className="flex items-center justify-between mb-4">
             <div>
                 <p className="text-sm text-slate-500 font-medium mb-1">New Total Score: <strong className="text-slate-900 text-lg">{liveTotalScore.toFixed(1)} / 100</strong></p>
                 <div className="flex items-center gap-2">
                     {liveTier ? (
                         <span className="px-2 py-0.5 text-xs font-bold rounded-full text-white shadow-sm" style={{ backgroundColor: liveTier.color }}>
                            {liveTier.name}
                         </span>
                     ) : (
                         <span className="text-xs text-slate-400">No Tier</span>
                     )}
                 </div>
             </div>
         </div>

         <div className="flex gap-3">
             <button
                onClick={onClose}
                className="flex-1 py-2.5 bg-white border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
             >
                 Cancel
             </button>
             <button
                onClick={handleSubmit}
                disabled={isSubmitting || reason.length < 10}
                className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
             >
                 {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Apply Override'}
             </button>
         </div>
      </div>
    </motion.div>
  );
};