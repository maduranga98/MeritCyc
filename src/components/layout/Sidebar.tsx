import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../config/firebase";
import { collection, query, where, onSnapshot, doc } from "firebase/firestore";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  RefreshCw,
  BarChart2,
  Settings,
  ClipboardList,
  TrendingUp,
  DollarSign,
  LogOut,
  Scale,
  X,
  Bell,
  CheckSquare,
  ShieldCheck,
} from "lucide-react";
import { type RoleCode } from "../../types/roles";
import { useNotificationStore } from "../../stores/notificationStore";

// --- Custom Logo for Dark Background ---
const SidebarLogo: React.FC = () => {
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-7 w-7 flex items-end gap-[3px]">
        <div className="w-[6px] h-3 bg-slate-400 rounded-sm opacity-60"></div>
        <div className="w-[6px] h-5 bg-slate-400 rounded-sm opacity-80"></div>
        <div className="w-[6px] h-full bg-merit-emerald rounded-sm"></div>
        <div className="absolute top-[-3px] left-0 w-full h-full border-t-[3px] border-l-[3px] border-merit-emerald rounded-full opacity-40 transform -rotate-12"></div>
      </div>
      <h1 className="text-3xl font-brand text-white">
        Merit<span className="font-regular text-merit-emerald">Cyc</span>
      </h1>
    </div>
  );
};

// --- Navigation Config ---
interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  exact?: boolean;
  isBadge?: boolean;
  isEvalBadge?: boolean;
  isReviewBadge?: boolean;
  isNotificationBadge?: boolean;
  isFairnessBadge?: boolean;
  subItems?: NavItem[];
}

const getNavItems = (role?: RoleCode): NavItem[] => {
  if (!role) return [];

  switch (role) {
    case "super_admin":
      return [
        { name: "Dashboard", href: "/dashboard/super-admin", icon: LayoutDashboard },
        {
          name: "People",
          href: "/people",
          icon: Users,
          subItems: [
            { name: "Employee Directory", href: "/people/directory", icon: Users },
            { name: "Departments", href: "/people/departments", icon: Users },
            { name: "Salary Bands", href: "/people/salary-bands", icon: Users },
            { name: "Pending Approvals", href: "/hr/people/approvals", icon: Users, isBadge: true },
            { name: "Invite Tracker", href: "/invites", icon: Users },
          ],
        },
        {
          name: "Cycles",
          href: "/cycles",
          icon: RefreshCw,
          subItems: [
            { name: "All Cycles", href: "/cycles", icon: RefreshCw, exact: true },
            { name: "Score Review", href: "/evaluations/review", icon: CheckSquare, isReviewBadge: true },
          ]
        },
        { name: "Career Paths", href: "/career-paths", icon: TrendingUp },
        {
          name: "Analytics",
          href: "/analytics",
          icon: BarChart2,
          subItems: [
            { name: "Executive Dashboard", href: "/analytics", icon: BarChart2, exact: true },
            { name: "Reports", href: "/analytics/reports", icon: BarChart2 },
            { name: "Fairness", href: "/fairness", icon: Scale, isFairnessBadge: true },
            { name: "Audit Trail", href: "/audit-trail", icon: ShieldCheck },
          ],
        },
        { name: "Notifications", href: "/notifications", icon: Bell, isNotificationBadge: true },
        { name: "Settings", href: "/settings/general", icon: Settings },
      ];
    case "hr_admin":
      return [
        { name: "Dashboard", href: "/dashboard/hr-admin", icon: LayoutDashboard },
        {
          name: "People",
          href: "/people",
          icon: Users,
          subItems: [
            { name: "Employee Directory", href: "/people/directory", icon: Users },
            { name: "Departments", href: "/people/departments", icon: Users },
            { name: "Salary Bands", href: "/people/salary-bands", icon: Users },
            { name: "Pending Approvals", href: "/hr/people/approvals", icon: Users, isBadge: true },
            { name: "Invite Tracker", href: "/invites", icon: Users },
          ],
        },
        {
          name: "Cycles",
          href: "/cycles",
          icon: RefreshCw,
          subItems: [
            { name: "All Cycles", href: "/cycles", icon: RefreshCw, exact: true },
            { name: "Score Review", href: "/evaluations/review", icon: CheckSquare, isReviewBadge: true },
          ]
        },
        { name: "Career Paths", href: "/career-paths", icon: TrendingUp },
        {
          name: "Analytics",
          href: "/analytics",
          icon: BarChart2,
          subItems: [
            { name: "Executive Dashboard", href: "/analytics", icon: BarChart2, exact: true },
            { name: "Reports", href: "/analytics/reports", icon: BarChart2 },
            { name: "Fairness", href: "/fairness", icon: Scale, isFairnessBadge: true },
            { name: "Audit Trail", href: "/audit-trail", icon: ShieldCheck },
          ],
        },
        { name: "Notifications", href: "/notifications", icon: Bell, isNotificationBadge: true },
        { name: "Settings", href: "/settings/notifications", icon: Settings },
      ];
    case "manager":
      return [
        { name: "Dashboard", href: "/dashboard/manager", icon: LayoutDashboard },
        { name: "Evaluations", href: "/evaluations", icon: ClipboardList, isEvalBadge: true },
        { name: "Notifications", href: "/notifications", icon: Bell, isNotificationBadge: true },
        { name: "Settings", href: "/settings/profile", icon: Settings },
      ];
    case "employee":
      return [
        { name: "Dashboard", href: "/dashboard/employee", icon: LayoutDashboard },
        { name: "My Career", href: "/career", icon: TrendingUp },
        { name: "My Increments", href: "/increments", icon: DollarSign },
        { name: "Notifications", href: "/notifications", icon: Bell, isNotificationBadge: true },
        { name: "Settings", href: "/settings/profile", icon: Settings },
      ];
    default:
      return [];
  }
};

// --- Sidebar Component ---
interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navItems = getNavItems(user?.role);
  const [pendingCount, setPendingCount] = useState(0);
  const [evalCount, setEvalCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [fairnessScore, setFairnessScore] = useState<number | null>(null);
  const unreadCount = useNotificationStore((state) => state.unreadCount);

  // Fetch pending count for hr_admin
  useEffect(() => {
    if ((user?.role !== "hr_admin" && user?.role !== "super_admin") || !user?.companyId) return;

    const q = query(
      collection(db, "companies", user.companyId, "pendingRegistrations"),
      where("status", "in", ["pending_approval", "info_requested"])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendingCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch fairness score for super/hr admin
  useEffect(() => {
    if ((user?.role !== "hr_admin" && user?.role !== "super_admin") || !user?.companyId) return;

    const unsubscribe = onSnapshot(doc(db, "companies", user.companyId), (docSnap) => {
      if (docSnap.exists() && docSnap.data().fairnessScore !== undefined) {
        setFairnessScore(docSnap.data().fairnessScore);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch evaluations count for manager
  useEffect(() => {
    if (user?.role !== "manager" || !user?.uid) return;

    const q = query(
      collection(db, "evaluations"),
      where("managerId", "==", user.uid),
      where("status", "==", "not_started")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEvalCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch review count for HR
  useEffect(() => {
    if ((user?.role !== "hr_admin" && user?.role !== "super_admin") || !user?.companyId) return;

    // A simpler query since we can't reliably join on active cycle without complex setup
    // For now we'll just count submitted and draft for active cycles implicitly if we track state
    // To keep it simple based on requirements, let's just count 'unsubmitted' as draft + not_started
    // However, since we can't do OR in onSnapshot easily without index, we just fetch all
    const q = query(
      collection(db, "evaluations"),
      where("companyId", "==", user.companyId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let count = 0;
      snapshot.forEach(doc => {
         const status = doc.data().status;
         if (status === 'not_started' || status === 'draft') count++;
      });
      setReviewCount(count);
    });

    return () => unsubscribe();
  }, [user]);

  const isActive = (href: string, exact = false) => {
    if (exact) {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  const renderNavItem = (item: NavItem, isSubItem = false) => {
    const active = isActive(item.href, item.exact);
    const Icon = item.icon;

    return (
      <Link
        key={item.href}
        to={item.href}
        onClick={() => setIsOpen(false)} // Close on mobile after click
        className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
          isSubItem ? "pl-11 text-sm" : "rounded-lg"
        } ${
          active
            ? "bg-emerald-500/20 text-emerald-400 border-l-2 border-emerald-400"
            : "text-slate-400 hover:bg-slate-800 hover:text-white border-l-2 border-transparent"
        }`}
      >
        {!isSubItem && <Icon className="w-5 h-5" />}
        <span className="flex-1">{item.name}</span>
        {item.isBadge && pendingCount > 0 && (
          <span className="bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {pendingCount}
          </span>
        )}
        {item.isEvalBadge && evalCount > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {evalCount}
          </span>
        )}
        {item.isReviewBadge && reviewCount > 0 && (
          <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {reviewCount}
          </span>
        )}
        {item.isNotificationBadge && unreadCount > 0 && (
          <span className="bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {unreadCount}
          </span>
        )}
        {item.isFairnessBadge && fairnessScore !== null && fairnessScore < 75 && (
          <span className={`text-white text-xs font-bold px-2 py-0.5 rounded-full ${fairnessScore < 60 ? 'bg-red-500' : 'bg-amber-500'}`}>
            !
          </span>
        )}
      </Link>
    );
  };

  const sidebarContent = (
    <div className="h-full flex flex-col bg-slate-900 text-slate-300 w-64 overflow-y-auto">
      {/* Logo Area */}
      <div className="p-6 flex items-center justify-between">
        <Link to="/" onClick={() => setIsOpen(false)}>
          <SidebarLogo />
        </Link>
        {/* Mobile Close Button */}
        <button
          onClick={() => setIsOpen(false)}
          className="md:hidden p-1 text-slate-400 hover:text-white"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => (
          <div key={item.name}>
            {renderNavItem(item)}
            {item.subItems && (
              <div className="mt-1 space-y-1">
                {item.subItems.map((subItem) => renderNavItem(subItem, true))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* User Profile Area */}
      <div className="p-4 mt-auto border-t border-slate-800">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-emerald-400 font-bold border border-slate-700">
            {user?.name?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.name || "User"}
            </p>
            <p className="text-xs text-slate-400 truncate">
              {user?.role?.replace("_", " ")}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Fixed) */}
      <div className="hidden md:block fixed inset-y-0 left-0 w-64 z-50">
        {sidebarContent}
      </div>

      {/* Mobile Sidebar (Slide-over) */}
      <div className="md:hidden">
        {/* Backdrop */}
        {isOpen && (
          <div
            className="fixed inset-0 bg-slate-900/80 z-40"
            onClick={() => setIsOpen(false)}
          />
        )}

        {/* Slide-over panel */}
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: isOpen ? 0 : "-100%" }}
          transition={{ type: "spring", bounce: 0, duration: 0.3 }}
          className="fixed inset-y-0 left-0 w-64 z-50 shadow-xl"
        >
          {sidebarContent}
        </motion.div>
      </div>
    </>
  );
};
