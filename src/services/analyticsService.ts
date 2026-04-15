import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../config/firebase";
import { type GeneratedReport, type CompanyKPIs, type IncrementTrendPoint, type DepartmentPerformance, type YoYTierData } from "../types/analytics";

export const analyticsService = {
  // Aggregate from Firestore reads
  getCompanyKPIs: async (companyId: string, _dateRange: string): Promise<CompanyKPIs> => {
    // In a real app this would query specific dates. For now returning mock/aggregated data
    const usersSnap = await getDocs(query(collection(db, "users"), where("companyId", "==", companyId), where("status", "==", "active")));
    const cyclesSnap = await getDocs(query(collection(db, "cycles"), where("companyId", "==", companyId)));

    const totalEmployees = usersSnap.size;

    let activeCycles = 0;
    let completedCycles = 0;
    cyclesSnap.forEach(c => {
       if (c.data().status === 'active') activeCycles++;
       if (c.data().status === 'completed') completedCycles++;
    });

    return {
      totalEmployees,
      activeCycles,
      completedCycles,
      totalSalaryIncrementsAwarded: 500000, // mock
      averageIncrementPercent: 12.5, // mock
      fairnessScore: 85, // mock
      currency: 'USD'
    };
  },

  getIncrementTrends: async (_companyId: string, _dateRange: string): Promise<IncrementTrendPoint[]> => {
    // Mock trends
    return [
       { cycleId: "1", cycleName: "2022 H1", date: "2022-06", averageIncrement: 8, totalEmployees: 100, totalCost: 400000, budgetUtilization: 95 },
       { cycleId: "2", cycleName: "2022 H2", date: "2022-12", averageIncrement: 9, totalEmployees: 110, totalCost: 450000, budgetUtilization: 98 },
       { cycleId: "3", cycleName: "2023 H1", date: "2023-06", averageIncrement: 11, totalEmployees: 120, totalCost: 500000, budgetUtilization: 92 },
    ];
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
        const tierKey = `tier${tier + 1}` as keyof typeof yoyMap.get(cycleYear)!;
        if (tierKey in yoyMap.get(cycleYear)!) {
          yoyMap.get(cycleYear)![tierKey]++;
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
