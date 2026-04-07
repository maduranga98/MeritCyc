import { collection, onSnapshot, query, getDocs } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../config/firebase";
import { type SalaryBand } from "../types/salaryBand";

export const salaryBandService = {
  subscribeToSalaryBands: (
    companyId: string,
    callback: (bands: SalaryBand[]) => void
  ) => {
    const q = query(collection(db, "companies", companyId, "salaryBands"));
    return onSnapshot(q, (snapshot) => {
      const bands = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as SalaryBand[];
      callback(bands);
    });
  },

  getSalaryBands: async (companyId: string): Promise<SalaryBand[]> => {
    const q = query(collection(db, "companies", companyId, "salaryBands"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as SalaryBand[];
  },

  createSalaryBand: async (data: {
    name: string;
    level: number;
    minSalary: number;
    maxSalary: number;
    currency?: string;
  }) => {
    const fn = httpsCallable(functions, "createSalaryBand");
    const result = await fn(data);
    return result.data;
  },

  updateSalaryBand: async (data: {
    bandId: string;
    name?: string;
    level?: number;
    minSalary?: number;
    maxSalary?: number;
    currency?: string;
  }) => {
    const fn = httpsCallable(functions, "updateSalaryBand");
    const result = await fn(data);
    return result.data;
  },

  deleteSalaryBand: async (bandId: string) => {
    const fn = httpsCallable(functions, "deleteSalaryBand");
    const result = await fn({ bandId });
    return result.data;
  },
};
