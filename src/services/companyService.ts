// =============================================================================
// Company Service — blueprint rule #1
// READ: direct Firestore (allowed)
// WRITE: via Cloud Functions only
// =============================================================================

import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../config/firebase";
import {
  type Company,
  type CreateCompanyRequest,
  type CreateCompanyResponse,
} from "../types/company";

// ---------------------------------------------------------------------------
// Helper: map Firestore doc → Company type
// ---------------------------------------------------------------------------

function mapDocToCompany(
  docId: string,
  data: Record<string, unknown>,
): Company {
  return {
    id: docId,
    name: (data.name as string) ?? "",
    email: (data.email as string) ?? "",
    address: data.address as string | undefined,
    mobileNumber: data.mobileNumber as string | undefined,
    timezone: data.timezone as string | undefined,
    currency: data.currency as string | undefined,
    logoUrl: data.logoUrl as string | undefined,
    plan: (data.plan as Company["plan"]) ?? "trial",
    status: (data.status as Company["status"]) ?? "active",
    trialEndsAt: data.trialEndsAt as number | undefined,
    employeeCount: (data.employeeCount as number) ?? 0,
    createdBy: (data.createdBy as string) ?? (data.adminUid as string) ?? "",
    createdAt: data.createdAt
      ? typeof data.createdAt === "object" &&
        "toMillis" in (data.createdAt as object)
        ? (data.createdAt as { toMillis: () => number }).toMillis()
        : (data.createdAt as number)
      : Date.now(),
    updatedAt: data.updatedAt as number | undefined,
  };
}

// ---------------------------------------------------------------------------
// READ operations (direct Firestore — allowed)
// ---------------------------------------------------------------------------

export const companyService = {
  getCompanies: async (): Promise<Company[]> => {
    const q = query(collection(db, "companies"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) =>
      mapDocToCompany(docSnap.id, docSnap.data()),
    );
  },

  getCompany: async (companyId: string): Promise<Company | null> => {
    const docSnap = await getDoc(doc(db, "companies", companyId));
    if (!docSnap.exists()) return null;
    return mapDocToCompany(docSnap.id, docSnap.data());
  },

  // -------------------------------------------------------------------------
  // WRITE operations (via Cloud Functions — blueprint rule #1)
  // -------------------------------------------------------------------------

  createCompany: async (
    data: CreateCompanyRequest,
  ): Promise<CreateCompanyResponse> => {
    const fn = httpsCallable<CreateCompanyRequest, CreateCompanyResponse>(
      functions,
      "createCompanyWithAdmin",
    );
    const result = await fn(data);
    return result.data;
  },

  toggleCompanyStatus: async (
    companyId: string,
    currentStatus: "active" | "inactive",
  ): Promise<void> => {
    const fn = httpsCallable(functions, "toggleCompanyStatus");
    await fn({ companyId, currentStatus });
  },

  deleteCompany: async (companyId: string): Promise<void> => {
    const fn = httpsCallable(functions, "deleteCompany");
    await fn({ companyId });
  },
};
