import { useNavigate } from 'react-router-dom';
import { CreditCard, Users, RefreshCw, Zap, ArrowRight } from 'lucide-react';
import { useBilling } from '../../hooks/useBilling';
import { PLAN_CONFIGS } from '../../lib/planConfig';
import { type GatedFeature } from '../../types/billing';

const FEATURE_ROWS: Array<{ key: GatedFeature; label: string }> = [
  { key: 'hasAuditTrail',          label: 'Audit Trail' },
  { key: 'hasSimulations',         label: 'Run Simulations' },
  { key: 'hasFairnessDashboard',   label: 'Fairness Dashboard' },
  { key: 'hasAdvancedAnalytics',   label: 'Advanced Analytics' },
  { key: 'hasCareerPaths',         label: 'Career Paths' },
];

export default function BillingDashboard() {
  const billing = useBilling();
  const navigate = useNavigate();

  if (!billing) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const plan = PLAN_CONFIGS[billing.plan];
  const isEnterprise = billing.plan === 'enterprise';

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Billing</h1>
        <button
          onClick={() => navigate('/pricing')}
          className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium hover:text-emerald-700"
        >
          View all plans <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Trial Notice */}
      {billing.isTrialActive && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-4">
          <Zap className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900">
              Trial ends in {billing.daysLeftInTrial} day{billing.daysLeftInTrial === 1 ? '' : 's'}
            </p>
            <p className="text-sm text-amber-700 mt-1">
              You have access to all Growth plan features. No credit card required during trial.
            </p>
          </div>
        </div>
      )}

      {/* Current Plan */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Current Plan</p>
            <h2 className="text-xl font-bold text-slate-900 mt-1">{plan.name}</h2>
            <p className="text-sm text-slate-500 mt-1">{plan.tagline}</p>
          </div>
          {!isEnterprise && billing.plan !== 'trial' && billing.monthlyTotal !== null && (
            <div className="text-right flex-shrink-0">
              <p className="text-2xl font-bold text-slate-900">${billing.monthlyTotal.toLocaleString()}</p>
              <p className="text-xs text-slate-400">/ month</p>
            </div>
          )}
        </div>

        {!isEnterprise && billing.plan !== 'trial' && plan.pricePerEmployee !== null && (
          <div className="pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-500 mb-1">Billing breakdown</p>
            <p className="text-sm text-slate-700">
              {billing.employeeCount} employees × ${plan.pricePerEmployee}/mo ={' '}
              <strong>${billing.monthlyTotal?.toLocaleString()}</strong>/mo
            </p>
          </div>
        )}

        {isEnterprise && (
          <div className="pt-4 border-t border-slate-100">
            <p className="text-sm text-slate-600">Contact your account manager for billing details.</p>
          </div>
        )}
      </div>

      {/* Usage */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-slate-700">Employees</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{billing.employeeCount}</p>
          <p className="text-xs text-slate-500 mt-1">
            {billing.limits.maxEmployees ? `of ${billing.limits.maxEmployees} allowed` : 'unlimited'}
          </p>
          {billing.limits.maxEmployees && (
            <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (billing.employeeCount / billing.limits.maxEmployees) * 100)}%`,
                }}
              />
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-sm font-medium text-slate-700">Cycle Limit</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {billing.limits.maxActiveCycles ?? '∞'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {billing.limits.maxActiveCycles ? 'active cycles maximum' : 'unlimited cycles'}
          </p>
        </div>
      </div>

      {/* Upgrade CTA */}
      {!isEnterprise && (
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 flex items-center justify-between gap-4">
          <div>
            <p className="font-bold text-white">
              {billing.plan === 'growth' ? 'Need more capacity?' : 'Unlock the full MeritCyc experience'}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {billing.plan === 'growth'
                ? 'Contact us for Enterprise — unlimited employees and dedicated support.'
                : 'Upgrade to Growth for simulations, audit trail, and advanced analytics.'}
            </p>
          </div>
          <button
            onClick={() => billing.plan === 'growth'
              ? window.open('mailto:sales@meritcyc.com', '_blank', 'noopener,noreferrer')
              : navigate('/pricing')
            }
            className="flex-shrink-0 px-4 py-2 bg-emerald-500 text-white font-medium rounded-lg hover:bg-emerald-400 transition-colors text-sm whitespace-nowrap"
          >
            {billing.plan === 'growth' ? 'Contact Sales' : 'Upgrade Plan'}
          </button>
        </div>
      )}

      {/* Feature Access */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-slate-600" />
          Feature Access
        </h2>
        <div className="space-y-0">
          {FEATURE_ROWS.map(({ key, label }) => (
            <div
              key={key}
              className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0"
            >
              <span className="text-sm text-slate-700">{label}</span>
              {billing.limits[key] ? (
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  Enabled
                </span>
              ) : (
                <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  Not available
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
