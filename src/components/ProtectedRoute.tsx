import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, type Role } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: Role[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user } = useAuth();

  if (!user) {
    // Not logged in, redirect to login page
    return <Navigate to="/" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    // Logged in but doesn't have the correct role
    // You might want to redirect to a generic 'unauthorized' page or their specific dashboard
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
