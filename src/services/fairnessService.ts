import {
  collection,
  getDocs,
  query,
  orderBy,
  limit
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../config/firebase";
import { type FairnessReport } from "../types/fairness";

export const fairnessService = {
  getFairnessReports: async (companyId: string): Promise<FairnessReport[]> => {
    const q = query(
      collection(db, "companies", companyId, "fairnessReports"),
      orderBy("generatedAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    })) as FairnessReport[];
  },

  getLatestFairnessReport: async (companyId: string): Promise<FairnessReport | null> => {
    const q = query(
      collection(db, "companies", companyId, "fairnessReports"),
      orderBy("generatedAt", "desc"),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return { ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as FairnessReport;
  },

  generateReport: async (cycleId?: string): Promise<{ success: boolean; reportId: string; overallFairnessScore: number }> => {
    const fn = httpsCallable(functions, "generateFairnessReport");
    const result = await fn({ cycleId });
    return result.data as { success: boolean; reportId: string; overallFairnessScore: number };
  },

  exportReport: async (reportId: string, format: 'pdf' | 'csv'): Promise<{ success: boolean; downloadUrl?: string; csvData?: string }> => {
    const fn = httpsCallable(functions, "exportFairnessReport");
    const result = await fn({ reportId, format });
    return result.data as { success: boolean; downloadUrl?: string; csvData?: string };
  }
};
