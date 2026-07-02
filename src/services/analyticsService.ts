import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../config/firebase";
import { type GeneratedReport, type CompanyKPIs, type IncrementTrendPoint, type DepartmentPerformance, type YoYTierData, type YoYMetricsPoint, type ReportType } from "../types/analytics";
import { fairnessService } from "./fairnessService";

// An evaluation only counts toward analytics once it has a finalized outcome.
const COUNTED_STATUSES = ['submitted', 'finalized', 'overridden'];

// Translate a UI date-range selection into a cutoff Date. null = no lower bound.
const dateRangeToCutoff = (dateRange: string): Date | null => {
  const now = new Date();
  switch (dateRange) {
    case '6m': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 6);
      return d;
    }
    case '12m': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 12);
      return d;
    }
    case 'ytd':
      return new Date(now.getFullYear(), 0, 1);
    default:
      return null;
  }
};

// Whether a Firestore document's createdAt falls on/after the cutoff.
const withinRange = (createdAt: { toDate?: () => Date } | undefined, cutoff: Date | null): boolean => {
  if (!cutoff) return true;
  const d = createdAt?.toDate?.();
  if (!d) return true; // keep records with no timestamp rather than silently dropping them
  return d >= cutoff;
};

// Resolve the salary increase amount for an evaluation, preferring the
// precomputed incrementAmount and falling back to currentSalary * percent.
const resolveIncrementAmount = (ev: { incrementAmount?: number; incrementPercent?: number; currentSalary?: number }): number => {
  if (typeof ev.incrementAmount === 'number') return ev.incrementAmount;
  const pct = ev.incrementPercent || 0;
  const salary = ev.currentSalary || 0;
  return salary * (pct / 100);
};

export const analyticsService = {
  // Aggregate from Firestore reads
  getCompanyKPIs: async (companyId: string, dateRange: string): Promise<CompanyKPIs> => {
    const cutoff = dateRangeToCutoff(dateRange);
    const usersSnap = await getDocs(query(collection(db, "users"), where("companyId", "==", companyId), where("status", "==", "active")));
    const cyclesSnap = await getDocs(query(collection(db, "cycles"), where("companyId", "==", companyId)));
    const evals = await getDocs(query(collection(db, "evaluations"), where("companyId", "==", companyId)));

    // Current active headcount is a point-in-time figure, not date-range scoped.
    const totalEmployees = usersSnap.size;

    let activeCycles = 0;
    let completedCycles = 0;
    cyclesSnap.forEach(c => {
       const data = c.data();
       if (!withinRange(data.createdAt, cutoff)) return;
       if (data.status === 'active') activeCycles++;
       if (data.status === 'completed') completedCycles++;
    });

    let totalSalaryIncrementsAwarded = 0;
    const incrementsList: number[] = [];

    evals.forEach(evalDoc => {
      const eval_ = evalDoc.data();
      if (COUNTED_STATUSES.includes(eval_.status) && withinRange(eval_.createdAt, cutoff)) {
        const increment = eval_.incrementPercent || 0;
        totalSalaryIncrementsAwarded += resolveIncrementAmount(eval_);
        if (increment > 0) incrementsList.push(increment);
      }
    });

    const averageIncrementPercent = incrementsList.length > 0
      ? Math.round((incrementsList.reduce((a, b) => a + b, 0) / incrementsList.length) * 10) / 10
      : 0;

    // Fairness score comes from the latest persisted fairness report rather than
    // a per-evaluation field (evaluations carry no fairness score). 0 = not yet generated.
    let fairnessScore = 0;
    try {
      const latestFairness = await fairnessService.getLatestFairnessReport(companyId);
      if (latestFairness?.overallFairnessScore !== undefined) {
        fairnessScore = Math.round(latestFairness.overallFairnessScore);
      }
    } catch {
      fairnessScore = 0;
    }

    return {
      totalEmployees,
      activeCycles,
      completedCycles,
      totalSalaryIncrementsAwarded: Math.round(totalSalaryIncrementsAwarded),
      averageIncrementPercent,
      fairnessScore,
      currency: 'USD'
    };
  },

  getIncrementTrends: async (companyId: string, dateRange: string): Promise<IncrementTrendPoint[]> => {
    const cutoff = dateRangeToCutoff(dateRange);
    const cyclesSnap = await getDocs(query(collection(db, "cycles"), where("companyId", "==", companyId), where("status", "==", "completed")));
    const trends: IncrementTrendPoint[] = [];

    for (const cycleDoc of cyclesSnap.docs) {
      const cycle = cycleDoc.data();
      if (!withinRange(cycle.createdAt, cutoff)) continue;
      const cycleName = cycle.name || `Cycle ${cycleDoc.id.slice(0, 8)}`;
      const date = cycle.createdAt?.toDate().toISOString().split('T')[0] || '';
      const budget = cycle.budget?.totalBudget || 0;

      const evals = await getDocs(
        query(collection(db, "evaluations"), where("cycleId", "==", cycleDoc.id))
      );

      let totalCost = 0;
      const increments: number[] = [];
      const employees = new Set<string>();

      evals.forEach(evalDoc => {
        const eval_ = evalDoc.data();
        if (COUNTED_STATUSES.includes(eval_.status)) {
          const increment = eval_.incrementPercent || 0;
          totalCost += resolveIncrementAmount(eval_);
          increments.push(increment);
          employees.add(eval_.employeeUid);
        }
      });

      const averageIncrement = increments.length > 0
        ? Math.round((increments.reduce((a, b) => a + b, 0) / increments.length) * 10) / 10
        : 0;

      const budgetUtilization = budget > 0 ? Math.round((totalCost / budget) * 100) : 0;

      trends.push({
        cycleId: cycleDoc.id,
        cycleName,
        date,
        averageIncrement,
        totalEmployees: employees.size,
        totalCost: Math.round(totalCost),
        budgetUtilization: Math.min(budgetUtilization, 100),
      });
    }

    return trends.sort((a, b) => a.date.localeCompare(b.date));
  },

  getDepartmentPerformance: async (companyId: string, dateRange: string = 'all'): Promise<DepartmentPerformance[]> => {
    const cutoff = dateRangeToCutoff(dateRange);
    const [evaluationsSnap, departmentsSnap] = await Promise.all([
      getDocs(query(collection(db, "evaluations"), where("companyId", "==", companyId))),
      getDocs(query(collection(db, "departments"), where("companyId", "==", companyId))),
    ]);

    // Department names live on the departments collection, not on evaluations.
    const deptNames = new Map<string, string>();
    departmentsSnap.forEach(d => deptNames.set(d.id, d.data().name || 'Unknown'));

    const deptMap = new Map<string, { scores: number[]; increments: number[]; employees: Set<string>; name: string }>();

    evaluationsSnap.forEach(doc => {
      const eval_ = doc.data();
      if (!COUNTED_STATUSES.includes(eval_.status) || !withinRange(eval_.createdAt, cutoff)) return;

      const deptId = eval_.departmentId || 'unknown';
      const deptName = deptNames.get(deptId) || 'Unknown';

      if (!deptMap.has(deptId)) {
        deptMap.set(deptId, { scores: [], increments: [], employees: new Set(), name: deptName });
      }

      const dept = deptMap.get(deptId)!;
      const score = eval_.weightedTotalScore || 0;
      const increment = eval_.incrementPercent || 0;

      dept.scores.push(score);
      dept.increments.push(increment);
      dept.employees.add(eval_.employeeUid);
    });

    return Array.from(deptMap.entries()).map(([deptId, data]) => ({
      departmentId: deptId,
      departmentName: data.name,
      averageScore: data.scores.length > 0 ? Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 10) / 10 : 0,
      averageIncrement: data.increments.length > 0 ? Math.round((data.increments.reduce((a, b) => a + b, 0) / data.increments.length) * 10) / 10 : 0,
      employeeCount: data.employees.size,
    })).sort((a, b) => b.averageScore - a.averageScore);
  },

  getYoYComparison: async (companyId: string): Promise<YoYTierData[]> => {
    const cyclesSnap = await getDocs(
      query(collection(db, "cycles"), where("companyId", "==", companyId), where("status", "==", "completed"))
    );

    const yoyMap = new Map<string, { tier1: number; tier2: number; tier3: number; tier4: number; tier5: number }>();

    for (const cycleDoc of cyclesSnap.docs) {
      const cycle = cycleDoc.data();
      const cycleYear = cycle.createdAt?.toDate().getFullYear().toString() || 'Unknown';

      if (!yoyMap.has(cycleYear)) {
        yoyMap.set(cycleYear, { tier1: 0, tier2: 0, tier3: 0, tier4: 0, tier5: 0 });
      }

      // Map each evaluation's assignedTierId to its ordinal position in the cycle's tier config.
      const tierOrder: string[] = (cycle.tiers || []).map((t: { id: string }) => t.id);

      const evals = await getDocs(
        query(collection(db, "evaluations"), where("cycleId", "==", cycleDoc.id))
      );

      evals.forEach(evalDoc => {
        const eval_ = evalDoc.data();
        if (!COUNTED_STATUSES.includes(eval_.status)) return;
        const tier = eval_.assignedTierId ? tierOrder.indexOf(eval_.assignedTierId) : -1;
        if (tier < 0) return;
        const tierKey = `tier${tier + 1}` as 'tier1' | 'tier2' | 'tier3' | 'tier4' | 'tier5';
        const tierData = yoyMap.get(cycleYear);
        if (tierData && tierKey in tierData) {
          tierData[tierKey]++;
        }
      });
    }

    const result = Array.from(yoyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([year, data]) => ({
        year,
        'Tier 1': data.tier1,
        'Tier 2': data.tier2,
        'Tier 3': data.tier3,
        'Tier 4': data.tier4,
        'Tier 5': data.tier5,
      }));

    // If only one year of data exists, add a projected year for visual comparison
    if (result.length === 1) {
      const current = result[0];
      const projectedYear = (parseInt(current.year) + 1).toString();
      result.push({
        year: `${projectedYear} (Proj.)`,
        'Tier 1': Math.round(current['Tier 1'] * 1.05),
        'Tier 2': Math.round(current['Tier 2'] * 1.05),
        'Tier 3': Math.round(current['Tier 3'] * 1.05),
        'Tier 4': Math.round(current['Tier 4'] * 1.05),
        'Tier 5': Math.round(current['Tier 5'] * 1.05),
      });
    }

    return result;
  },

  getYoYMetrics: async (companyId: string): Promise<YoYMetricsPoint[]> => {
    const cyclesSnap = await getDocs(
      query(
        collection(db, "cycles"),
        where("companyId", "==", companyId),
        where("status", "==", "completed"),
        orderBy("createdAt", "asc")
      )
    );

    const yoyMap = new Map<string, {
      cyclesRun: number;
      employeesReviewed: Set<string>;
      increments: number[];
      totalSpend: number;
    }>();

    for (const cycleDoc of cyclesSnap.docs) {
      const cycle = cycleDoc.data();
      const cycleYear = cycle.createdAt?.toDate().getFullYear().toString() ?? 'Unknown';

      if (!yoyMap.has(cycleYear)) {
        yoyMap.set(cycleYear, { cyclesRun: 0, employeesReviewed: new Set(), increments: [], totalSpend: 0 });
      }
      const yearData = yoyMap.get(cycleYear)!;
      yearData.cyclesRun++;

      const evals = await getDocs(
        query(collection(db, "evaluations"), where("cycleId", "==", cycleDoc.id))
      );

      evals.forEach(evalDoc => {
        const ev = evalDoc.data();
        if (!COUNTED_STATUSES.includes(ev.status)) return;
        const increment = ev.incrementPercent ?? 0;
        yearData.employeesReviewed.add(ev.employeeUid);
        yearData.increments.push(increment);
        yearData.totalSpend += resolveIncrementAmount(ev);
      });
    }

    return Array.from(yoyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([year, data]) => ({
        year,
        cyclesRun: data.cyclesRun,
        employeesReviewed: data.employeesReviewed.size,
        avgIncrement:
          data.increments.length > 0
            ? Math.round((data.increments.reduce((a, b) => a + b, 0) / data.increments.length) * 10) / 10
            : 0,
        totalSpend: Math.round(data.totalSpend),
      }));
  },

  generateReport: async (params: { reportType: ReportType; cycleId?: string; format?: string }): Promise<{ success: boolean; reportId?: string }> => {
    if (params.reportType === 'cycle_summary') {
        const fn = httpsCallable(functions, "generateCycleSummaryReport");
        const res = await fn({ cycleId: params.cycleId });
        return res.data as { success: boolean, reportId: string };
    } else {
        const fn = httpsCallable(functions, "generateCompanyReport");
        const res = await fn(params);
        return res.data as { success: boolean, reportId: string };
    }
  },

  getGeneratedReports: async (companyId: string): Promise<GeneratedReport[]> => {
    const q = query(
      collection(db, "companies", companyId, "reports"),
      orderBy("generatedAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    })) as GeneratedReport[];
  }
};
