// =============================================================================
// MeritCyc ProtectedRoute
// Guards authenticated routes with role-based access control.
//
// Check order:
//   1. loading   → spinner
//   2. !user     → /login
//   3. !approved → /login  (non-platform_admin only)
//   4. role not in allowedRoles / below minimumRole → /unauthorized
// =============================================================================

import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { type RoleCode, hasMinimumRole } from "../types/roles";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Exact roles that may access this route. */
  allowedRoles?: RoleCode[];
  /** Alternatively, require at least this role level (uses hierarchy). */
  minimumRole?: RoleCode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  minimumRole,
}) => {
  const { user, loading } = useAuth();

  // 1. Auth state still resolving → show spinner
  if (loading) {
    return (
      <div className="min-h-screen bg-merit-bg flex items-center justify-center font-brand">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-4 border-merit-emerald border-t-transparent animate-spin" />
          <span className="text-sm text-merit-slate">Loading…</span>
        </div>
      </div>
    );
  }

  // 2. Not authenticated → login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 3. Account not approved → login with message
  //    (platform_admin is always implicitly approved)
  if (!user.approved && user.role !== "platform_admin") {
    return <Navigate to="/pending-approval" replace />;
  }

  // 4a. allowedRoles check (takes priority over minimumRole)
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // 4b. minimumRole hierarchy check
  if (minimumRole && !hasMinimumRole(user.role, minimumRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};
