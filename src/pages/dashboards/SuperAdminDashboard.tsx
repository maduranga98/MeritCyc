import React from "react";
import { useAuth } from "../../context/AuthContext";

const SuperAdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div className="p-8 font-brand">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-merit-navy">
            Company Dashboard
          </h1>
          <p className="text-xs text-merit-slate mt-1 uppercase tracking-wider">
            Super Admin — Company Owner
          </p>
        </div>
        <button
          onClick={logout}
          className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-medium hover:bg-red-100 transition"
        >
          Logout
        </button>
      </div>
      <p className="text-merit-slate">Welcome, {user?.name}!</p>
      <div className="mt-6 bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-merit-navy mb-4">Coming soon</h2>
        <p className="text-merit-slate text-sm">
          Company onboarding wizard, department management, salary bands, and
          employee invites will be built here as part of Modules 1-2.
        </p>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
