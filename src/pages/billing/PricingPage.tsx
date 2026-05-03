import { type ElementType } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Zap, Building2, Rocket, Star } from 'lucide-react';
import { PLAN_CONFIGS } from '../../lib/planConfig';
import { type PlanTier } from '../../types/billing';
import { useBilling } from '../../hooks/useBilling';

const PLAN_ICONS: Record<PlanTier, ElementType> = {
  trial: Zap,
  starter: Rocket,
  growth: Star,
  enterprise: Building2,
};

const COMPARISON_ROWS: Array<{ label: string; trial: boolean | string; starter: boolean | string; growth: boolean | string; enterprise: boolean | string }> = [
  { label: 'Max Employees',      trial: '10',        starter: '50',       growth: '500',       enterprise: 'Unlimited' },
  { label: 'Active Cycles',      trial: '1',         starter: '3',        growth: 'Unlimited', enterprise: 'Unlimited' },
  { label: 'Career Paths',       trial: true,        starter: true,       growth: true,        enterprise: true },
  { label: 'Increment Stories',  trial: true,        starter: true,       growth: true,        enterprise: true },
  { label: 'Simulations',        trial: true,        starter: false,      growth: true,        enterprise: true },
  { label: 'Fairness Dashboard', trial: true,        starter: false,      growth: true,        enterprise: true },
  { label: 'Advanced Analytics', trial: true,        starter: false,      growth: true,        enterprise: true },
  { label: 'Audit Trail',        trial: true,        starter: false,      growth: true,        enterprise: true },
  { label: 'Dedicated Support',  trial: false,       starter: false,      growth: false,       enterprise: true },
];

const ORDERED_PLANS: PlanTier[] = ['trial', 'starter', 'growth', 'enterprise'];

export default function PricingPage() {
  const navigate = useNavigate();
  const billing = useBilling();
  const currentPlan = billing?.plan;

  const handleUpgrade = (plan: PlanTier) => {
    if (plan === 'enterprise') {
      window.open('mailto:sales@meritcyc.com?subject=Enterprise Plan Inquiry', '_blank', 'noopener,noreferrer');
    } else {
      navigate('/billing');
    }
  };

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Plans & Pricing</h1>
        <p className="text-sm text-slate-500 mt-1">Simple per-employee pricing. No hidden fees.</p>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {ORDERED_PLANS.map((planId) => {
          const config = PLAN_CONFIGS[planId];
          const Icon = PLAN_ICONS[planId];
          const isCurrent = currentPlan === planId;
          const isPopular = config.badge === 'Most Popular';

          return (
            <div
              key={planId}
              className={`relative bg-white rounded-xl border-2 p-6 flex flex-col ${
                isPopular ? 'border-emerald-500 shadow-lg' : 'border-slate-200'
              } ${isCurrent ? 'ring-2 ring-emerald-400 ring-offset-2' : ''}`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                  Most Popular
                </div>
              )}
              {isCurrent && !isPopular && (
                <div className="absolute -top-3 right-4 bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                  Current Plan
                </div>
              )}

              <div className="flex items-center gap-2 mb-3">
                <Icon className={`w-5 h-5 ${isPopular ? 'text-emerald-500' : 'text-slate-500'}`} />
                <span className="font-bold text-slate-900">{config.name}</span>
              </div>

              <div className="mb-3">
                {config.pricePerEmployee === null ? (
                  <p className="text-2xl font-bold text-slate-900">Custom</p>
                ) : config.pricePerEmployee === 0 ? (
                  <p className="text-2xl font-bold text-slate-900">Free</p>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-slate-900">${config.pricePerEmployee}</p>
                    <p className="text-xs text-slate-500">per employee / month</p>
                  </>
                )}
              </div>

              <p className="text-xs text-slate-500 mb-4 flex-1">{config.tagline}</p>

              <ul className="space-y-2 mb-6">
                {config.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2 text-xs text-slate-700">
                    <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                    {h}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade(planId)}
                disabled={isCurrent}
                className={`w-full py-2 rounded-lg font-medium text-sm transition-colors ${
                  isCurrent
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : isPopular
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                {isCurrent ? 'Current Plan' : planId === 'enterprise' ? 'Contact Sales' : 'Upgrade'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Feature Comparison Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Feature Comparison</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left p-4 text-slate-600 font-medium w-1/3">Feature</th>
                {ORDERED_PLANS.map((p) => (
                  <th key={p} className={`text-center p-4 font-medium ${p === currentPlan ? 'text-emerald-600' : 'text-slate-600'}`}>
                    {PLAN_CONFIGS[p].name}
                    {p === currentPlan && <span className="block text-xs font-normal text-emerald-500">current</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row, idx) => (
                <tr key={row.label} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="p-4 text-slate-700">{row.label}</td>
                  {ORDERED_PLANS.map((p) => {
                    const val = row[p];
                    return (
                      <td key={p} className="p-4 text-center">
                        {typeof val === 'boolean' ? (
                          val ? (
                            <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                          ) : (
                            <span className="text-slate-300 text-lg leading-none">—</span>
                          )
                        ) : (
                          <span className="text-slate-700 font-medium">{val}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
