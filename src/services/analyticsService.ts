import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../config/firebase";
import { type GeneratedReport, type CompanyKPIs, type IncrementTrendPoint, type DepartmentPerformance, type YoYTierData } from "../types/analytics";

export const analyticsService = {
  // Aggregate from Firestore reads
  getCompanyKPIs: async (companyId: string, _dateRange: string): Promise<CompanyKPIs> => {
    const usersSnap = await getDocs(query(collection(db, "users"), where("companyId", "==", companyId), where("status", "==", "active")));
    const cyclesSnap = await getDocs(query(collection(db, "cycles"), where("companyId", "==", companyId)));
    const evals = await getDocs(query(collection(db, "evaluations"), where("companyId", "==", companyId)));

    const totalEmployees = usersSnap.size;

    let activeCycles = 0;
    let completedCycles = 0;
    cyclesSnap.forEach(c => {
       if (c.data().status === 'active') activeCycles++;
       if (c.data().status === 'completed') completedCycles++;
    });

    let totalSalaryIncrementsAwarded = 0;
    const incrementsList: number[] = [];
    let fairnessScores: number[] = [];

    evals.forEach(evalDoc => {
      const eval_ = evalDoc.data();
      if (eval_.status === 'submitted' || eval_.status === 'finalized' || eval_.status === 'overridden') {
        const increment = eval_.recommendedIncrement || 0;
        const baseSalary = eval_.baseSalary || 0;
        const incrementAmount = baseSalary * (increment / 100);
        totalSalaryIncrementsAwarded += incrementAmount;
        if (increment > 0) incrementsList.push(increment);
        if (eval_.fairnessScore !== undefined) fairnessScores.push(eval_.fairnessScore);
      }
    });

    const averageIncrementPercent = incrementsList.length > 0
      ? Math.round((incrementsList.reduce((a, b) => a + b, 0) / incrementsList.length) * 10) / 10
      : 0;

    const fairnessScore = fairnessScores.length > 0
      ? Math.round((fairnessScores.reduce((a, b) => a + b, 0) / fairnessScores.length))
      : 75;

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

  getIncrementTrends: async (companyId: string, _dateRange: string): Promise<IncrementTrendPoint[]> => {
    const cyclesSnap = await getDocs(query(collection(db, "cycles"), where("companyId", "==", companyId), where("status", "==", "completed")));
    const trends: IncrementTrendPoint[] = [];

    for (const cycleDoc of cyclesSnap.docs) {
      const cycle = cycleDoc.data();
      const cycleName = cycle.name || `Cycle ${cycleDoc.id.slice(0, 8)}`;
      const date = cycle.createdAt?.toDate().toISOString().split('T')[0] || '';
      const budget = cycle.budget || 0;

      const evals = await getDocs(
        query(collection(db, "evaluations"), where("cycleId", "==", cycleDoc.id))
      );

      let totalCost = 0;
      const increments: number[] = [];
      const employees = new Set<string>();

      evals.forEach(evalDoc => {
        const eval_ = evalDoc.data();
        if (eval_.status === 'submitted' || eval_.status === 'finalized' || eval_.status === 'overridden') {
          const increment = eval_.recommendedIncrement || 0;
          const baseSalary = eval_.baseSalary || 0;
          totalCost += baseSalary * (increment / 100);
          increments.push(increment);
          employees.add(eval_.employeeId);
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

  getDepartmentPerformance: async (companyId: string): Promise<DepartmentPerformance[]> => {
    const evaluationsSnap = await getDocs(
      query(collection(db, "evaluations"), where("companyId", "==", companyId))
    );

    const deptMap = new Map<string, { scores: number[]; increments: number[]; employees: Set<string>; name: string }>();

    evaluationsSnap.forEach(doc => {
      const eval_ = doc.data();
      if (eval_.status !== 'submitted' && eval_.status !== 'finalized' && eval_.status !== 'overridden') return;

      const deptId = eval_.departmentId || 'unknown';
      const deptName = eval_.departmentName || 'Unknown';

      if (!deptMap.has(deptId)) {
        deptMap.set(deptId, { scores: [], increments: [], employees: new Set(), name: deptName });
      }

      const dept = deptMap.get(deptId)!;
      const score = eval_.weightedTotalScore || 0;
      const increment = eval_.recommendedIncrement || 0;

      dept.scores.push(score);
      dept.increments.push(increment);
      dept.employees.add(eval_.employeeId);
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

      const evals = await getDocs(
        query(collection(db, "evaluations"), where("cycleId", "==", cycleDoc.id))
      );

      evals.forEach(evalDoc => {
        const eval_ = evalDoc.data();
        const tier = eval_.assignedTierIndex ?? 0;
        const tierKey = `tier${tier + 1}` as 'tier1' | 'tier2' | 'tier3' | 'tier4' | 'tier5';
        const tierData = yoyMap.get(cycleYear);
        if (tierData && tierKey in tierData) {
          tierData[tierKey]++;
        }
      });
    }

    return Array.from(yoyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([year, data]) => ({
        year,
        'Tier 1': data.tier1,
        'Tier 2': data.tier2,
        'Tier 3': data.tier3,
        'Tier 4': data.tier4,
        'Tier 5': data.tier5,
      }));
  },

  generateReport: async (params: any): Promise<{ success: boolean; reportId?: string }> => {
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
