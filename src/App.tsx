import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import PlatformDashboard from "./pages/platform/PlatformDashboard";
import SuperAdminDashboard from "./pages/dashboards/SuperAdminDashboard";
import HRAdminDashboard from "./pages/dashboards/HRAdminDashboard";
import ManagerDashboard from "./pages/dashboards/ManagerDashboard";
import EmployeeDashboard from "./pages/dashboards/EmployeeDashboard";

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LoginPage />} />
      <Route path="/login" element={<Navigate to="/" replace />} />

      {/* Pending approval placeholder (feature 1.5) */}
      <Route
        path="/pending-approval"
        element={
          <div className="min-h-screen flex items-center justify-center font-brand">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-merit-navy mb-2">
                Pending Approval
              </h1>
              <p className="text-merit-slate">
                Your account is awaiting HR approval.
              </p>
            </div>
          </div>
        }
      />

      {/* ============================================================= */}
      {/* PLATFORM-LEVEL (Lumora Ventures only — no companyId)           */}
      {/* ============================================================= */}
      <Route
        path="/platform/dashboard"
        element={
          <ProtectedRoute allowedRoles={["platform_admin"]}>
            <PlatformDashboard />
          </ProtectedRoute>
        }
      />

      {/* ============================================================= */}
      {/* COMPANY-LEVEL (scoped to companyId)                            */}
      {/* ============================================================= */}
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
    </Routes>
  );
}

export default App;
