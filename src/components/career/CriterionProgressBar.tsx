import React from 'react';
import { type CriteriaProgress } from '../../types/careerPath';

export const CriterionProgressBar: React.FC<{ item: CriteriaProgress }> = ({ item }) => (
  <div className="space-y-1">
    <div className="flex justify-between text-sm">
      <span className="font-medium text-slate-700">{item.name}</span>
      <span className={item.met ? 'text-emerald-600 font-semibold' : 'text-slate-500'}>{item.score.toFixed(1)} / {item.threshold}</span>
    </div>
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-2 ${item.met ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.min((item.score / 100) * 100, 100)}%` }} />
    </div>
  </div>
);
