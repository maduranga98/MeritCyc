// =============================================================================
// MeritCyc AuthContext
// Thin wrapper around the Zustand authStore.
// Provides <AuthProvider> for initialization and useAuth() for consumption.
// =============================================================================

import React, { useEffect, type ReactNode } from "react";
import { useAuthStore } from "../stores/authStore";
import { type AuthUser } from "../types/user";

// ---------------------------------------------------------------------------
// Public hook — components use this to read auth state
// ---------------------------------------------------------------------------

export interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthContextValue => {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const logout = useAuthStore((s) => s.logout);
  return { user, loading, logout };
};

// ---------------------------------------------------------------------------
// Provider — starts the Firebase listener once, blocks render until resolved
// ---------------------------------------------------------------------------

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const initialize = useAuthStore((s) => s.initialize);
  const loading = useAuthStore((s) => s.loading);

  useEffect(() => {
    const unsubscribe = initialize();
    return unsubscribe;
  }, [initialize]);

  // Block children until the first auth state is resolved to avoid flashes
  if (loading) {
    return (
      <div className="min-h-screen bg-merit-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-4 border-merit-emerald border-t-transparent animate-spin" />
          <span className="text-sm text-merit-slate font-brand">Loading…</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
