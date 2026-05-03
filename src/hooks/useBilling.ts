import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { type BillingState, type PlanTier } from '../types/billing';
import { calculateMonthlyBill, getPlanLimits } from '../lib/planConfig';

export function useBilling(): BillingState | null {
  const { user } = useAuth();
  const [state, setState] = useState<BillingState | null>(null);

  useEffect(() => {
    if (!user?.companyId) return;

    const unsub = onSnapshot(doc(db, 'companies', user.companyId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const plan: PlanTier = data.plan ?? 'trial';
      const employeeCount: number = data.employeeCount ?? 0;
      const trialEndsAt: number | undefined = data.trialEndsAt;

      const now = Date.now();
      const isTrialActive = plan === 'trial' && !!trialEndsAt && trialEndsAt > now;
      const daysLeftInTrial = isTrialActive
        ? Math.max(0, Math.ceil((trialEndsAt! - now) / (1000 * 60 * 60 * 24)))
        : null;

      setState({
        plan,
        employeeCount,
        trialEndsAt,
        isTrialActive,
        daysLeftInTrial,
        monthlyTotal: calculateMonthlyBill(plan, employeeCount),
        limits: getPlanLimits(plan),
      });
    });

    return () => unsub();
  }, [user?.companyId]);

  return state;
}
