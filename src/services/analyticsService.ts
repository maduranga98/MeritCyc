import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../config/firebase";
import { type GeneratedReport, type CompanyKPIs, type IncrementTrendPoint } from "../types/analytics";

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
