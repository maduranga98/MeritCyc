import { collection, onSnapshot, query, getDocs } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../config/firebase";
import { type Department } from "../types/department";

export const departmentService = {
  subscribeToDepartments: (
    companyId: string,
    callback: (departments: Department[]) => void
  ) => {
    const q = query(collection(db, "companies", companyId, "departments"));
    return onSnapshot(q, (snapshot) => {
      const depts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Department[];
      callback(depts);
    });
  },

  getDepartments: async (companyId: string): Promise<Department[]> => {
    const q = query(collection(db, "companies", companyId, "departments"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Department[];
  },

  createDepartment: async (data: { name: string; managerId?: string }) => {
    const fn = httpsCallable(functions, "createDepartment");
    const result = await fn(data);
    return result.data;
  },

  updateDepartment: async (data: {
    departmentId: string;
    name?: string;
    managerId?: string;
  }) => {
    const fn = httpsCallable(functions, "updateDepartment");
    const result = await fn(data);
    return result.data;
  },

  deleteDepartment: async (departmentId: string) => {
    const fn = httpsCallable(functions, "deleteDepartment");
    const result = await fn({ departmentId });
    return result.data;
  },
};
