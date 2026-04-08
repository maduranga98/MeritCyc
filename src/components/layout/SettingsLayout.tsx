import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  Building2,
  QrCode,
  Bell,
  Shield,
  Database,
  User,
} from "lucide-react";

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export const SettingsLayout: React.FC<SettingsLayoutProps> = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();

  const navItems = [
    {
      name: "General",
      href: "/settings/general",
      icon: Building2,
      roles: ["super_admin"],
    },
    {
      name: "Registration",
      href: "/settings/registration",
      icon: QrCode,
      roles: ["super_admin", "hr_admin"],
    },
    {
      name: "Notifications",
      href: "/settings/notifications",
      icon: Bell,
      roles: ["super_admin", "hr_admin"],
    },
    {
      name: "Security",
      href: "/settings/security",
      icon: Shield,
      roles: ["super_admin"],
    },
    {
      name: "Data & Privacy",
      href: "/settings/data",
      icon: Database,
      roles: ["super_admin"],
    },
    {
      name: "Profile",
      href: "/settings/profile",
      icon: User,
      roles: ["super_admin", "hr_admin", "manager", "employee"],
    },
  ];

  const filteredNavItems = navItems.filter(item =>
    user?.role && item.roles.includes(user.role)
  );

  return (
    <div className="flex h-full min-h-[calc(100vh-8rem)]">
      {/* Settings Sidebar */}
      <div className="w-56 bg-white border-r border-slate-200 h-full flex-shrink-0">
        <div className="p-4">
          <h2 className="text-sm font-bold text-slate-900 mb-4 px-2 uppercase tracking-wider">Settings</h2>
          <nav className="space-y-1">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                    isActive
                      ? "bg-slate-100 text-slate-900 font-medium"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Settings Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-4xl mx-auto space-y-6">
          {children}
        </div>
      </div>
    </div>
  );
};
