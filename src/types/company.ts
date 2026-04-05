// =============================================================================
// MeritCyc Company Types
// Maps to /companies/{id} Firestore collection
// =============================================================================

export type PlanTier = "trial" | "starter" | "growth" | "enterprise";

export interface Company {
  id: string;
  name: string;
  email: string;
  address?: string;
  mobileNumber?: string;
  timezone?: string;
  currency?: string;
  logoUrl?: string;
  plan: PlanTier;
  status: "active" | "inactive" | "suspended";
  trialEndsAt?: number;
  employeeCount: number;
  createdBy: string; // UID of the Super Admin who owns it
  createdAt: number;
  updatedAt?: number;
}

/**
 * Data sent to the createCompanyWithAdmin Cloud Function.
 */
export interface CreateCompanyRequest {
  companyName: string;
  address: string;
  mobileNumber: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

/**
 * Response from createCompanyWithAdmin.
 */
export interface CreateCompanyResponse {
  success: boolean;
  companyId: string;
  uid: string;
  message: string;
}
