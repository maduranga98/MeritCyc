import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { type RoleCode, hasMinimumRole } from "../types/roles";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Exact roles that can access this route. */
  allowedRoles?: RoleCode[];
  /** Alternatively, require at least this role level (uses hierarchy). */
  minimumRole?: RoleCode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  minimumRole,
}) => {
  const { user } = useAuth();

  // 1. Not logged in → login page
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // 2. Account not approved → pending page
  //    (platform_admin is always approved, no companyId needed)
  if (!user.approved && user.role !== "platform_admin") {
    return <Navigate to="/pending-approval" replace />;
  }

  // 3. Role check — allowedRoles takes priority over minimumRole
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  if (minimumRole && !hasMinimumRole(user.role, minimumRole)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
