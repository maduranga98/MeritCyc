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
import CareerMap from "./pages/career/CareerMap";
import IncrementStories from "./pages/increments/IncrementStories";
import IncrementStoryDetail from "./pages/increments/IncrementStoryDetail";
import NotificationsPage from "./pages/notifications/NotificationsPage";
import SuperAdminDashboard from "./pages/dashboards/SuperAdminDashboard";
import HRAdminDashboard from "./pages/dashboards/HRAdminDashboard";
import ManagerDashboard from "./pages/dashboards/ManagerDashboard";
import EmployeeDashboard from "./pages/dashboards/EmployeeDashboard";
import AcceptInvite from "./pages/auth/AcceptInvite";
import InviteTracker from "./pages/people/InviteTracker";
import PendingApprovals from "./pages/people/PendingApprovals";
import DepartmentManagement from "./pages/people/DepartmentManagement";
import SalaryBandManagement from "./pages/people/SalaryBandManagement";
import EmployeeDirectory from "./pages/people/EmployeeDirectory";
import ProfilePage from "./pages/settings/Profile";
import CyclesList from "./pages/cycles/CyclesList";
import CycleDetail from "./pages/cycles/CycleDetail";
import SimulationDashboard from "./pages/cycles/SimulationDashboard";
import BudgetTracker from "./pages/cycles/BudgetTracker";
import ManagerEvaluationsHub from "./pages/evaluations/ManagerEvaluationsHub";
import TeamEvaluationPage from "./pages/evaluations/TeamEvaluationPage";
import HRScoreReview from "./pages/evaluations/HRScoreReview";

// Join / self-registration pages (public)
import ManualJoin from "./pages/join/ManualJoin";
import QRLanding from "./pages/join/QRLanding";
import OTPVerification from "./pages/join/OTPVerification";

// Layout
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayout } from "./components/layout/AppLayout";
import { SettingsLayout } from "./components/layout/SettingsLayout";

// Analytics & Fairness
import FairnessDashboard from "./pages/analytics/FairnessDashboard";
import ExecutiveDashboard from "./pages/analytics/ExecutiveDashboard";
import ReportsGenerator from "./pages/analytics/ReportsGenerator";

// Settings
import GeneralSettings from "./pages/settings/GeneralSettings";
import RegistrationSettings from "./pages/settings/RegistrationSettings";
import NotificationSettings from "./pages/settings/NotificationSettings";
import SecuritySettings from "./pages/settings/SecuritySettings";
import DataPrivacySettings from "./pages/settings/DataPrivacySettings";

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
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />

        {/* ----------------------------------------------------------------- */}
        {/* Employee self-registration (Features 1.3 + 1.4)                   */}
        {/* ORDER MATTERS: /join/verify must come BEFORE /join/:companyCode    */}
        {/* so React Router doesn't treat the literal "verify" as a param.     */}
        {/* ----------------------------------------------------------------- */}
        <Route path="/join" element={<ManualJoin />} />
        <Route path="/join/verify" element={<OTPVerification />} />
        <Route path="/join/:companyCode" element={<QRLanding />} />

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
              <AppLayout>
                <SuperAdminDashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/hr-admin"
          element={
            <ProtectedRoute allowedRoles={["hr_admin"]}>
              <AppLayout>
                <HRAdminDashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/manager"
          element={
            <ProtectedRoute allowedRoles={["manager"]}>
              <AppLayout>
                <ManagerDashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/employee"
          element={
            <ProtectedRoute allowedRoles={["employee"]}>
              <AppLayout>
                <EmployeeDashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cycles/:cycleId/simulate"
          element={
            <ProtectedRoute allowedRoles={["hr_admin", "super_admin"]}>
              <AppLayout>
                <SimulationDashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cycles/:cycleId/budget"
          element={
            <ProtectedRoute allowedRoles={["hr_admin", "super_admin"]}>
              <AppLayout>
                <BudgetTracker />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* ================================================================= */}
        {/* Module 2 — Company & People Management                             */}
        {/* ================================================================= */}
        <Route
          path="/people/directory"
          element={
            <ProtectedRoute allowedRoles={["hr_admin", "super_admin"]}>
              <AppLayout>
                <EmployeeDirectory />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/people/departments"
          element={
            <ProtectedRoute allowedRoles={["hr_admin", "super_admin"]}>
              <AppLayout>
                <DepartmentManagement />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/people/salary-bands"
          element={
            <ProtectedRoute allowedRoles={["hr_admin", "super_admin"]}>
              <AppLayout>
                <SalaryBandManagement />
              </AppLayout>
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
              <AppLayout>
                <InviteTracker />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* ================================================================= */}
        {/* Settings — accessible to all authenticated, approved users         */}
        {/* ================================================================= */}
        <Route
           path="/settings"
           element={
               <ProtectedRoute minimumRole="employee">
                   {user?.role === 'super_admin' ? <Navigate to="/settings/general" replace /> : <Navigate to="/settings/profile" replace />}
               </ProtectedRoute>
           }
        />
        <Route
          path="/settings/profile"
          element={
            <ProtectedRoute minimumRole="employee">
              <AppLayout>
                <SettingsLayout>
                  <ProfilePage />
                </SettingsLayout>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/general"
          element={
            <ProtectedRoute allowedRoles={["super_admin"]}>
              <AppLayout>
                <SettingsLayout>
                  <GeneralSettings />
                </SettingsLayout>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/registration"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "hr_admin"]}>
              <AppLayout>
                <SettingsLayout>
                  <RegistrationSettings />
                </SettingsLayout>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/notifications"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "hr_admin"]}>
              <AppLayout>
                <SettingsLayout>
                  <NotificationSettings />
                </SettingsLayout>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/security"
          element={
            <ProtectedRoute allowedRoles={["super_admin"]}>
              <AppLayout>
                <SettingsLayout>
                  <SecuritySettings />
                </SettingsLayout>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/data"
          element={
            <ProtectedRoute allowedRoles={["super_admin"]}>
              <AppLayout>
                <SettingsLayout>
                  <DataPrivacySettings />
                </SettingsLayout>
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* ================================================================= */}
        {/* Analytics & Fairness                                               */}
        {/* ================================================================= */}
        <Route
          path="/analytics"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "hr_admin"]}>
              <AppLayout>
                <ExecutiveDashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics/reports"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "hr_admin"]}>
              <AppLayout>
                <ReportsGenerator />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/fairness"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "hr_admin"]}>
              <AppLayout>
                <FairnessDashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Feature 1.5 HR Approval System */}
        <Route
          path="/hr/people/approvals"
          element={
            <ProtectedRoute allowedRoles={["hr_admin", "super_admin"]}>
              <AppLayout>
                <PendingApprovals />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* ================================================================= */}
        {/* Module 3 — Increment Cycle Engine                                  */}
        {/* ================================================================= */}
        <Route
          path="/cycles"
          element={
            <ProtectedRoute allowedRoles={["hr_admin", "super_admin"]}>
              <AppLayout>
                <CyclesList />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cycles/:cycleId"
          element={
            <ProtectedRoute allowedRoles={["hr_admin", "super_admin"]}>
              <AppLayout>
                <CycleDetail />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* ================================================================= */}
        {/* Module 6 — Employee Experience Portal                              */}
        {/* ================================================================= */}
        <Route
          path="/career"
          element={
            <ProtectedRoute allowedRoles={["employee"]}>
              <AppLayout>
                <CareerMap />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/increments"
          element={
            <ProtectedRoute allowedRoles={["employee"]}>
              <AppLayout>
                <IncrementStories />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/increments/:cycleId"
          element={
            <ProtectedRoute allowedRoles={["employee"]}>
              <AppLayout>
                <IncrementStoryDetail />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Notifications (All authenticated company roles) */}
        <Route
          path="/notifications"
          element={
            <ProtectedRoute minimumRole="employee">
              <AppLayout>
                <NotificationsPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* ================================================================= */}
        {/* Module 5 — Evaluation & Scoring                                    */}
        {/* ================================================================= */}
        <Route
          path="/evaluations"
          element={
            <ProtectedRoute allowedRoles={["manager"]}>
              <AppLayout>
                <ManagerEvaluationsHub />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/evaluations/review"
          element={
            <ProtectedRoute allowedRoles={["hr_admin", "super_admin"]}>
              <AppLayout>
                <HRScoreReview />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/evaluations/:cycleId"
          element={
            <ProtectedRoute allowedRoles={["manager"]}>
              <AppLayout>
                <TeamEvaluationPage />
              </AppLayout>
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
