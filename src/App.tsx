// =============================================================================
// MeritCyc App — Route Configuration
// =============================================================================

import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// Auth pages
import LoginPage from "./pages/auth/Login";
import ForgotPasswordPage from "./pages/auth/ForgotPassword";
import ResetPasswordPage from "./pages/auth/ResetPassword";

// Protected pages
import PlatformDashboard from "./pages/platform/PlatformDashboard";
import SuperAdminDashboard from "./pages/dashboards/SuperAdminDashboard";
import HRAdminDashboard from "./pages/dashboards/HRAdminDashboard";
import ManagerDashboard from "./pages/dashboards/ManagerDashboard";
import EmployeeDashboard from "./pages/dashboards/EmployeeDashboard";
import AcceptInvite from "./pages/auth/AcceptInvite";
import InviteTracker from "./pages/people/InviteTracker";
import ProfilePage from "./pages/settings/Profile";

// Join / self-registration pages (public)
import ManualJoin from "./pages/join/ManualJoin";
import QRLanding from "./pages/join/QRLanding";
import OTPVerification from "./pages/join/OTPVerification";

// Layout
import { ProtectedRoute } from "./components/ProtectedRoute";

// Session management (idle timeout — only active for logged-in users)
import { useIdleTimeout } from "./hooks/useIdleTimeout";
import { useAuth } from "./context/AuthContext";

// ---------------------------------------------------------------------------
// SessionManager — mounts idle timeout only when authenticated
// ---------------------------------------------------------------------------

const SessionManager: React.FC = () => {
  useIdleTimeout(); // default 30 min
  return null;
};

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

function App() {
  const { user } = useAuth();

  return (
    <>
      {/* Mount idle-timeout tracker only when a user is signed in */}
      {user && <SessionManager />}

      <Routes>
        {/* ================================================================= */}
        {/* Public routes                                                       */}
        {/* ================================================================= */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />

        {/* ----------------------------------------------------------------- */}
        {/* Employee self-registration (Features 1.3 + 1.4)                   */}
        {/* IMPORTANT: /join/verify must be declared BEFORE /join/:code        */}
        {/* so React Router doesn't treat "verify" as a :code param.           */}
        {/* ----------------------------------------------------------------- */}
        <Route path="/join" element={<ManualJoin />} />
        <Route path="/join/verify" element={<OTPVerification />} />
        <Route path="/join/:code" element={<QRLanding />} />

        {/* ================================================================= */}
        {/* Pending approval                                                    */}
        {/* ================================================================= */}
        <Route
          path="/pending-approval"
          element={
            <div className="min-h-screen bg-merit-bg flex items-center justify-center font-brand px-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-10 max-w-md w-full text-center shadow-sm">
                <div className="mx-auto mb-5 w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <h1 className="text-xl font-bold text-merit-navy mb-2">
                  Pending Approval
                </h1>
                <p className="text-merit-slate text-sm leading-relaxed">
                  Your account is awaiting HR approval. You will receive an
                  email once your account has been activated.
                </p>
                <a
                  href="/login"
                  className="inline-block mt-6 text-sm text-merit-emerald font-bold hover:underline"
                >
                  Back to Sign In
                </a>
              </div>
            </div>
          }
        />

        {/* Unauthorized */}
        <Route
          path="/unauthorized"
          element={
            <div className="min-h-screen bg-merit-bg flex items-center justify-center font-brand px-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-10 max-w-md w-full text-center shadow-sm">
                <div className="mx-auto mb-5 w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#EF4444"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                  </svg>
                </div>
                <h1 className="text-xl font-bold text-merit-navy mb-2">
                  Access Denied
                </h1>
                <p className="text-merit-slate text-sm leading-relaxed">
                  You don't have permission to access this page. Contact your
                  administrator if you think this is an error.
                </p>
                <a
                  href="/login"
                  className="inline-block mt-6 text-sm text-merit-emerald font-bold hover:underline"
                >
                  Back to Sign In
                </a>
              </div>
            </div>
          }
        />

        {/* ================================================================= */}
        {/* Platform-level (Lumora Ventures only — no companyId)               */}
        {/* ================================================================= */}
        <Route
          path="/platform/dashboard"
          element={
            <ProtectedRoute allowedRoles={["platform_admin"]}>
              <PlatformDashboard />
            </ProtectedRoute>
          }
        />

        {/* ================================================================= */}
        {/* Company-level (scoped to companyId)                                */}
        {/* ================================================================= */}
        <Route
          path="/dashboard/super-admin"
          element={
            <ProtectedRoute allowedRoles={["super_admin"]}>
              <SuperAdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/hr-admin"
          element={
            <ProtectedRoute allowedRoles={["hr_admin"]}>
              <HRAdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/manager"
          element={
            <ProtectedRoute allowedRoles={["manager"]}>
              <ManagerDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/employee"
          element={
            <ProtectedRoute allowedRoles={["employee"]}>
              <EmployeeDashboard />
            </ProtectedRoute>
          }
        />

        {/* ================================================================= */}
        {/* Feature 1.2 — HR Invite Tracker                                    */}
        {/* ================================================================= */}
        <Route
          path="/invites"
          element={
            <ProtectedRoute allowedRoles={["hr_admin", "super_admin"]}>
              <InviteTracker />
            </ProtectedRoute>
          }
        />

        {/* ================================================================= */}
        {/* Settings — accessible to all authenticated, approved users         */}
        {/* ================================================================= */}
        <Route
          path="/settings/profile"
          element={
            <ProtectedRoute
              minimumRole="employee" // any company role
            >
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        {/* ================================================================= */}
        {/* 404 catch-all                                                       */}
        {/* ================================================================= */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}

export default App;
