import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../config/firebase";
import { type GeneratedReport, type CompanyKPIs, type IncrementTrendPoint } from "../types/analytics";

export interface DepartmentPerformance {
  departmentName: string;
  averageScore: number;
  averageIncrement: number;
}

export interface YoyDataPoint {
  year: string;
  [tierName: string]: string | number;
}

export const analyticsService = {
  getCompanyKPIs: async (companyId: string, _dateRange: string): Promise<CompanyKPIs> => {
    const [usersSnap, cyclesSnap, evalsSnap, fairnessSnap] = await Promise.all([
      getDocs(query(collection(db, "users"), where("companyId", "==", companyId), where("status", "==", "active"))),
      getDocs(query(collection(db, "cycles"), where("companyId", "==", companyId))),
      getDocs(query(collection(db, "evaluations"), where("companyId", "==", companyId), where("status", "==", "finalized"))),
      getDocs(query(collection(db, "companies", companyId, "fairnessReports"), orderBy("generatedAt", "desc"), limit(1))),
    ]);

    const totalEmployees = usersSnap.size;

    let activeCycles = 0;
    let completedCycles = 0;
    let currency = 'USD';
    cyclesSnap.forEach(c => {
      const data = c.data();
      if (data.status === 'active') activeCycles++;
      if (data.status === 'completed') completedCycles++;
      if (data.budget?.currency) currency = data.budget.currency;
    });

    let totalSalaryIncrementsAwarded = 0;
    let totalIncrementPercent = 0;
    let evalCount = 0;
    evalsSnap.forEach(e => {
      const data = e.data();
      totalSalaryIncrementsAwarded += data.incrementAmount || 0;
      totalIncrementPercent += data.incrementPercent || 0;
      evalCount++;
    });

    const averageIncrementPercent =
      evalCount > 0 ? Math.round((totalIncrementPercent / evalCount) * 10) / 10 : 0;

    const fairnessScore = fairnessSnap.empty
      ? 0
      : (fairnessSnap.docs[0].data().overallFairnessScore || 0);

    return {
      totalEmployees,
      activeCycles,
      completedCycles,
      totalSalaryIncrementsAwarded,
      averageIncrementPercent,
      fairnessScore,
      currency,
    };
  },

  getIncrementTrends: async (companyId: string, _dateRange: string): Promise<IncrementTrendPoint[]> => {
    const [cyclesSnap, evalsSnap] = await Promise.all([
      getDocs(query(
        collection(db, "cycles"),
        where("companyId", "==", companyId),
        where("status", "==", "completed"),
        orderBy("timeline.endDate", "asc"),
      )),
      getDocs(query(
        collection(db, "evaluations"),
        where("companyId", "==", companyId),
        where("status", "==", "finalized"),
      )),
    ]);

    const evalsByCycle: Record<string, Array<{ incrementPercent: number; incrementAmount: number }>> = {};
    evalsSnap.forEach(e => {
      const data = e.data();
      if (!evalsByCycle[data.cycleId]) evalsByCycle[data.cycleId] = [];
      evalsByCycle[data.cycleId].push({
        incrementPercent: data.incrementPercent || 0,
        incrementAmount: data.incrementAmount || 0,
      });
    });

    const trends: IncrementTrendPoint[] = [];
    cyclesSnap.forEach(cycleDoc => {
      const cycle = cycleDoc.data();
      const evals = evalsByCycle[cycleDoc.id] || [];
      if (evals.length === 0) return;

      const totalCost = evals.reduce((sum, e) => sum + e.incrementAmount, 0);
      const avgIncrement = evals.reduce((sum, e) => sum + e.incrementPercent, 0) / evals.length;
      const totalBudget = cycle.budget?.totalBudget || 0;
      const budgetUtilization = totalBudget > 0 ? (totalCost / totalBudget) * 100 : 0;

      trends.push({
        cycleId: cycleDoc.id,
        cycleName: cycle.name,
        date: cycle.timeline?.endDate?.toDate?.()?.toISOString?.()?.slice(0, 7) || '',
        averageIncrement: Math.round(avgIncrement * 10) / 10,
        totalEmployees: evals.length,
        totalCost,
        budgetUtilization: Math.round(budgetUtilization * 10) / 10,
      });
    });

    return trends;
  },

  getDepartmentPerformance: async (companyId: string): Promise<DepartmentPerformance[]> => {
    const [usersSnap, evalsSnap] = await Promise.all([
      getDocs(query(collection(db, "users"), where("companyId", "==", companyId), where("status", "==", "active"))),
      getDocs(query(collection(db, "evaluations"), where("companyId", "==", companyId), where("status", "==", "finalized"))),
    ]);

    const deptNames: Record<string, string> = {};
    usersSnap.forEach(doc => {
      const u = doc.data();
      if (u.departmentId && u.departmentName) {
        deptNames[u.departmentId] = u.departmentName;
      }
    });

    const deptMap: Record<string, { totalScore: number; totalIncrement: number; count: number }> = {};
    evalsSnap.forEach(doc => {
      const e = doc.data();
      if (!e.departmentId) return;
      if (!deptMap[e.departmentId]) deptMap[e.departmentId] = { totalScore: 0, totalIncrement: 0, count: 0 };
      deptMap[e.departmentId].totalScore += e.weightedTotalScore || 0;
      deptMap[e.departmentId].totalIncrement += e.incrementPercent || 0;
      deptMap[e.departmentId].count++;
    });

    return Object.entries(deptMap).map(([deptId, stats]) => ({
      departmentName: deptNames[deptId] || deptId,
      averageScore: Math.round(stats.totalScore / stats.count),
      averageIncrement: Math.round((stats.totalIncrement / stats.count) * 10) / 10,
    }));
  },

  getYoyData: async (companyId: string): Promise<YoyDataPoint[]> => {
    const [cyclesSnap, evalsSnap] = await Promise.all([
      getDocs(query(collection(db, "cycles"), where("companyId", "==", companyId), where("status", "==", "completed"))),
      getDocs(query(collection(db, "evaluations"), where("companyId", "==", companyId), where("status", "==", "finalized"))),
    ]);

    const cycleYears: Record<string, number> = {};
    cyclesSnap.forEach(doc => {
      const c = doc.data();
      const year =
        c.timeline?.endDate?.toDate?.()?.getFullYear() ||
        c.createdAt?.toDate?.()?.getFullYear();
      if (year) cycleYears[doc.id] = year;
    });

    const yearTierMap: Record<number, Record<string, { total: number; count: number }>> = {};
    evalsSnap.forEach(doc => {
      const e = doc.data();
      const year = cycleYears[e.cycleId];
      if (!year) return;
      const tier = e.assignedTierName || 'Other';
      if (!yearTierMap[year]) yearTierMap[year] = {};
      if (!yearTierMap[year][tier]) yearTierMap[year][tier] = { total: 0, count: 0 };
      yearTierMap[year][tier].total += e.incrementPercent || 0;
      yearTierMap[year][tier].count++;
    });

    return Object.entries(yearTierMap)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([year, tiers]) => ({
        year,
        ...Object.fromEntries(
          Object.entries(tiers).map(([tier, stats]) => [
            tier,
            Math.round((stats.total / stats.count) * 10) / 10,
          ])
        ),
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
