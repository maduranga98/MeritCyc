import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useBilling } from '../../hooks/useBilling';
import { type GatedFeature } from '../../types/billing';

const FEATURE_LABELS: Record<GatedFeature, string> = {
  hasAuditTrail: 'Audit Trail',
  hasSimulations: 'Run Simulation',
  hasFairnessDashboard: 'Fairness Dashboard',
  hasAdvancedAnalytics: 'Advanced Analytics',
  hasCareerPaths: 'Career Paths',
};

function LockedPlaceholder({ feature }: { feature: GatedFeature }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <Lock className="w-6 h-6 text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-800 mb-1">
        {FEATURE_LABELS[feature]} is not available on your current plan
      </h3>
      <p className="text-sm text-slate-500 mb-6 max-w-xs">
        Upgrade to the Growth or Enterprise plan to unlock this feature.
      </p>
      <button
        onClick={() => navigate('/billing')}
        className="px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors text-sm"
      >
        View Plans
      </button>
    </div>
  );
}

interface PlanGateProps {
  feature: GatedFeature;
  children: ReactNode;
  fallback?: ReactNode;
}

export default function PlanGate({ feature, children, fallback }: PlanGateProps) {
  const billing = useBilling();

  if (!billing) return null;

  if (!billing.limits[feature]) {
    return <>{fallback ?? <LockedPlaceholder feature={feature} />}</>;
  }

  return <>{children}</>;
}
