import React from "react";
import { useLocation } from "react-router-dom";
import { Menu, Bell } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

interface TopNavProps {
  setSidebarOpen: (isOpen: boolean) => void;
}

// Simple helper to convert paths to readable titles
const getPageTitle = (pathname: string): string => {
  if (pathname.startsWith("/dashboard/super-admin")) return "Super Admin Dashboard";
  if (pathname.startsWith("/dashboard/hr-admin")) return "HR Admin Dashboard";
  if (pathname.startsWith("/dashboard/manager")) return "Manager Dashboard";
  if (pathname.startsWith("/dashboard/employee")) return "Employee Dashboard";
  if (pathname.startsWith("/invites")) return "Invite Tracker";
  if (pathname.startsWith("/hr/people/approvals")) return "Pending Approvals";
  if (pathname.startsWith("/settings/profile")) return "Profile Settings";
  if (pathname.startsWith("/people/directory")) return "Employee Directory";
  if (pathname.startsWith("/people")) return "People";
  if (pathname.startsWith("/cycles")) return "Cycles";
  if (pathname.startsWith("/analytics")) return "Analytics";
  if (pathname.startsWith("/team")) return "My Team";
  if (pathname.startsWith("/evaluations")) return "Evaluations";
  if (pathname.startsWith("/career")) return "My Career";
  if (pathname.startsWith("/increments")) return "My Increments";

  return "Dashboard";
};

export const TopNav: React.FC<TopNavProps> = ({ setSidebarOpen }) => {
  const location = useLocation();
  const { user } = useAuth();
  const pageTitle = getPageTitle(location.pathname);

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        {/* Mobile Hamburger Menu */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>

        <h1 className="text-xl font-bold text-merit-navy hidden sm:block">
          {pageTitle}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
          <Bell className="w-5 h-5" />
          {/* Hardcoded 0 for now as per instructions, but styled just in case */}
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white hidden"></span>
        </button>

        {/* User Avatar Circle */}
        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-merit-navy font-bold border border-slate-200 shadow-sm">
          {user?.name?.charAt(0).toUpperCase() || "U"}
        </div>
      </div>
    </header>
  );
};