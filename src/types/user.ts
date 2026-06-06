// =============================================================================
// MeritCyc User Types
// Maps to /users/{uid} Firestore collection
// Custom Claims: { role, companyId?, approved }
//   - platform_admin: no companyId (operates across all companies)
//   - all other roles: companyId is required
// =============================================================================

import { type RoleCode } from "./roles";

/**
 * Core user interface matching Firestore /users/{uid} document.
 */
export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: RoleCode;
  companyId: string; // empty string for platform_admin
  approved: boolean;
  departmentId?: string;
  salaryBandId?: string;
  careerPathId?: string;
  currentLevel?: string;
  jobTitle?: string;
  photoURL?: string;
  status: "active" | "inactive" | "pending";
  createdAt: number;
  updatedAt?: number;
  registrationMethod?: string;
  lastActiveAt?: number;
}

/**
 * What the AuthContext exposes after login.
 */
export interface AuthUser {
  uid: string;
  email: string;
  name: string;
  role: RoleCode;
  companyId: string; // empty string for platform_admin
  approved: boolean;
  /**
   * True when the token carries a company-scoped role but no companyId claim
   * (claims desync). Company-scoped Firestore reads cannot succeed in this
   * state, so the UI should route the user to a "finish setup" screen rather
   * than let every listener fail with permission-denied.
   */
  setupRequired?: boolean;
}

/**
 * Firebase Auth Custom Claims shape.
 * Set by Cloud Functions via admin.auth().setCustomUserClaims().
 */
export interface CustomClaims {
  role: RoleCode;
  companyId?: string; // absent for platform_admin
  approved: boolean;
}
