import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useBilling } from '../../hooks/useBilling';

export default function TrialBanner() {
  const { user } = useAuth();
  const billing = useBilling();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (user?.role !== 'super_admin') return null;
  if (!billing?.isTrialActive) return null;
  if (dismissed) return null;

  const days = billing.daysLeftInTrial ?? 0;
  const urgencyClass = days <= 3 ? 'bg-red-600' : days <= 7 ? 'bg-amber-500' : 'bg-emerald-600';

  return (
    <div className={`${urgencyClass} text-white text-sm px-4 py-2 flex items-center justify-between gap-4 flex-shrink-0`}>
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 flex-shrink-0" />
        <span>
          {days === 0
            ? 'Your free trial has ended. Upgrade to keep full access.'
            : `Your free trial ends in ${days} day${days === 1 ? '' : 's'}.`}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/billing')}
          className="bg-white/20 hover:bg-white/30 transition-colors px-3 py-1 rounded font-medium text-xs whitespace-nowrap"
        >
          Upgrade Now
        </button>
        <button onClick={() => setDismissed(true)} className="text-white/70 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
