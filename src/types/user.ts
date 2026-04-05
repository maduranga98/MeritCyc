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
  status: "active" | "inactive" | "pending";
  createdAt: number;
  updatedAt?: number;
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
