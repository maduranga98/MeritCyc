import React from 'react';
import { type CareerProgressResult } from '../../types/careerPath';

export const CareerProgressCard: React.FC<{ progress: CareerProgressResult }> = ({ progress }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-lg font-bold text-merit-navy">Career Progress</h3>
      <span className="text-emerald-600 font-bold">{progress.weightedProgress.toFixed(1)}%</span>
    </div>
    <p className="text-sm text-slate-500 mb-4">{progress.currentLevel} → {progress.nextLevel}</p>
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className="h-2 bg-emerald-500" style={{ width: `${Math.min(progress.weightedProgress, 100)}%` }} />
    </div>
    <p className={`mt-4 text-sm font-semibold ${progress.eligibleForPromotion ? 'text-emerald-600' : 'text-amber-600'}`}>
      {progress.eligibleForPromotion ? 'Eligible for promotion in this cycle' : 'Not yet promotion-eligible'}
    </p>
  </div>
);
