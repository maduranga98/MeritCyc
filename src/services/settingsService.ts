import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../config/firebase";
import { type CompanySettings, type NotificationSettings, type SecuritySettings } from "../types/settings";

export const settingsService = {
  getCompanySettings: async (companyId: string): Promise<CompanySettings | null> => {
    const docSnap = await getDoc(doc(db, "companies", companyId));
    if (!docSnap.exists()) return null;
    return docSnap.data() as CompanySettings;
  },

  getNotificationSettings: async (companyId: string): Promise<NotificationSettings | null> => {
    const docSnap = await getDoc(doc(db, "companies", companyId, "settings", "notifications"));
    if (!docSnap.exists()) return null;
    return docSnap.data() as NotificationSettings;
  },

  getSecuritySettings: async (companyId: string): Promise<SecuritySettings | null> => {
    const docSnap = await getDoc(doc(db, "companies", companyId, "settings", "security"));
    if (!docSnap.exists()) return null;
    return docSnap.data() as SecuritySettings;
  },

  updateCompanySettings: async (settings: Partial<CompanySettings>): Promise<{ success: boolean }> => {
    const fn = httpsCallable(functions, "updateCompanySettings");
    const result = await fn({ settings });
    return result.data as { success: boolean };
  },

  updateNotificationSettings: async (settings: Partial<NotificationSettings>): Promise<{ success: boolean }> => {
    const fn = httpsCallable(functions, "updateNotificationSettings");
    const result = await fn({ settings });
    return result.data as { success: boolean };
  },

  updateSecuritySettings: async (settings: Partial<SecuritySettings>): Promise<{ success: boolean }> => {
    const fn = httpsCallable(functions, "updateSecuritySettings");
    const result = await fn({ settings });
    return result.data as { success: boolean };
  },

  exportCompanyData: async (): Promise<{ success: boolean; downloadUrl?: string }> => {
    const fn = httpsCallable(functions, "exportCompanyData");
    const result = await fn();
    return result.data as { success: boolean; downloadUrl?: string };
  },

  scheduleCompanyDeletion: async (): Promise<{ success: boolean; deletionDate?: number }> => {
    const fn = httpsCallable(functions, "scheduleCompanyDeletion");
    const result = await fn();
    return result.data as { success: boolean; deletionDate?: number };
  },

  cancelCompanyDeletion: async (): Promise<{ success: boolean }> => {
    const fn = httpsCallable(functions, "cancelCompanyDeletion");
    const result = await fn();
    return result.data as { success: boolean };
  }
};
