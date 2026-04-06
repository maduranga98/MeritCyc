import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { auth } from "../config/firebase";
import { getDashboardPath } from "../types/roles";

interface OnboardingRouteProps {
  children: React.ReactNode;
}

export const OnboardingRoute: React.FC<OnboardingRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const [isEmailVerified, setIsEmailVerified] = useState<boolean | null>(null);

  useEffect(() => {
    if (auth.currentUser) {
      auth.currentUser.reload().then(() => {
        setIsEmailVerified(auth.currentUser?.emailVerified || false);
      });
    } else {
      const timeout = setTimeout(() => setIsEmailVerified(false), 0);
      return () => clearTimeout(timeout);
    }
  }, []);

  if (loading || isEmailVerified === null) {
    return <div className="min-h-screen flex items-center justify-center font-brand">Loading...</div>;
  }

  if (!user || !auth.currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (!isEmailVerified) {
    return <Navigate to="/verify-email" replace />;
  }

  if (user.companyId) {
    return <Navigate to={getDashboardPath(user.role)} replace />;
  }

  return <>{children}</>;
};
