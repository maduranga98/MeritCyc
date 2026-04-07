import { collection, onSnapshot, query, where, getDocs } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../config/firebase";
import { type Employee } from "../types/employee";
import { type RoleCode } from "../types/roles";

export const employeeService = {
  subscribeToEmployees: (
    companyId: string,
    callback: (employees: Employee[]) => void
  ) => {
    const q = query(collection(db, "users"), where("companyId", "==", companyId));
    return onSnapshot(q, (snapshot) => {
      const emps = snapshot.docs.map((doc) => ({
        uid: doc.id,
        ...doc.data(),
      })) as Employee[];
      callback(emps);
    });
  },

  getEmployees: async (companyId: string): Promise<Employee[]> => {
    const q = query(collection(db, "users"), where("companyId", "==", companyId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data(),
    })) as Employee[];
  },

  updateEmployeeProfile: async (data: {
    targetUid: string;
    departmentId?: string | null;
    salaryBandId?: string | null;
    jobTitle?: string;
    status?: 'active' | 'inactive' | 'pending';
  }) => {
    const fn = httpsCallable(functions, "updateEmployeeProfile");
    const result = await fn(data);
    return result.data;
  },

  changeEmployeeRole: async (data: { targetUid: string; newRole: RoleCode }) => {
    const fn = httpsCallable(functions, "changeEmployeeRole");
    const result = await fn(data);
    return result.data;
  },

  deactivateEmployee: async (targetUid: string) => {
    const fn = httpsCallable(functions, "deactivateEmployee");
    const result = await fn({ targetUid });
    return result.data;
  },

  reactivateEmployee: async (targetUid: string) => {
    const fn = httpsCallable(functions, "reactivateEmployee");
    const result = await fn({ targetUid });
    return result.data;
  },
};
