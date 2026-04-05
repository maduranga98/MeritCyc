// =============================================================================
// MeritCyc RBAC Types
//
// 5 roles total:
//   platform_admin — Lumora Ventures only, manages the entire platform
//   super_admin    — Company owner/founder (blueprint SA)
//   hr_admin       — HR Director/People Ops (blueprint HR)
//   manager        — Department Head (blueprint MGR)
//   employee       — All staff (blueprint EMP)
//
// platform_admin has NO companyId — they operate across all companies.
// All other roles are scoped to a single companyId.
// =============================================================================

export type RoleCode =
  | "platform_admin"
  | "super_admin"
  | "hr_admin"
  | "manager"
  | "employee";

/** Roles that exist within a company (have companyId). */
export type CompanyRoleCode = Exclude<RoleCode, "platform_admin">;

export interface RoleConfig {
  code: RoleCode;
  label: string;
  description: string;
  hierarchy: number; // lower = more access
  isCompanyScoped: boolean;
}

export const ROLES: Record<RoleCode, RoleConfig> = {
  platform_admin: {
    code: "platform_admin",
    label: "Platform Admin",
    description: "Lumora Ventures — platform management, company registration",
    hierarchy: 0,
    isCompanyScoped: false,
  },
  super_admin: {
    code: "super_admin",
    label: "Super Admin",
    description: "Company owner/founder — full access including billing",
    hierarchy: 1,
    isCompanyScoped: true,
  },
  hr_admin: {
    code: "hr_admin",
    label: "HR Admin",
    description:
      "HR Director/People Ops — employee management, cycles, criteria",
    hierarchy: 2,
    isCompanyScoped: true,
  },
  manager: {
    code: "manager",
    label: "Manager",
    description: "Department Head — team evaluations, department analytics",
    hierarchy: 3,
    isCompanyScoped: true,
  },
  employee: {
    code: "employee",
    label: "Employee",
    description: "All staff — own career map, progress, increment stories",
    hierarchy: 4,
    isCompanyScoped: true,
  },
};

/**
 * Get the dashboard route path for a given role.
 */
export function getDashboardPath(role: RoleCode): string {
  const paths: Record<RoleCode, string> = {
    platform_admin: "/platform/dashboard",
    super_admin: "/dashboard/super-admin",
    hr_admin: "/dashboard/hr-admin",
    manager: "/dashboard/manager",
    employee: "/dashboard/employee",
  };
  return paths[role] ?? "/";
}

/**
 * Check if roleA has equal or higher access than roleB.
 */
export function hasMinimumRole(
  userRole: RoleCode,
  requiredRole: RoleCode,
): boolean {
  return ROLES[userRole].hierarchy <= ROLES[requiredRole].hierarchy;
}

/**
 * Check if a role is company-scoped (requires companyId).
 */
export function isCompanyScoped(role: RoleCode): boolean {
  return ROLES[role].isCompanyScoped;
}
