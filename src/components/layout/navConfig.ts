import type React from "react";
import {
  LayoutDashboard,
  Users,
  RefreshCw,
  BarChart2,
  Settings,
  ClipboardList,
  TrendingUp,
  DollarSign,
  Scale,
  Bell,
  CheckSquare,
  ShieldCheck,
  BookOpen,
  CreditCard,
} from "lucide-react";
import { type RoleCode } from "../../types/roles";

// --- Navigation Config ---
export interface NavItem {
  nameKey: string;
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

export const getNavItems = (role?: RoleCode): NavItem[] => {
  if (!role) return [];

  switch (role) {
    case "super_admin":
      return [
        { nameKey: "nav.dashboard", href: "/dashboard/super-admin", icon: LayoutDashboard },
        {
          nameKey: "nav.people",
          href: "/people",
          icon: Users,
          subItems: [
            { nameKey: "nav.employeeDirectory", href: "/people/directory", icon: Users },
            { nameKey: "nav.departments", href: "/people/departments", icon: Users },
            { nameKey: "nav.salaryBands", href: "/people/salary-bands", icon: Users },
            { nameKey: "nav.pendingApprovals", href: "/hr/people/approvals", icon: Users, isBadge: true },
            { nameKey: "nav.inviteTracker", href: "/invites", icon: Users },
          ],
        },
        {
          nameKey: "nav.cycles",
          href: "/cycles",
          icon: RefreshCw,
          subItems: [
            { nameKey: "nav.allCycles", href: "/cycles", icon: RefreshCw, exact: true },
            { nameKey: "nav.scoreReview", href: "/evaluations/review", icon: CheckSquare, isReviewBadge: true },
          ]
        },
        { nameKey: "nav.careerPaths", href: "/career-paths", icon: TrendingUp },
        {
          nameKey: "nav.analytics",
          href: "/analytics",
          icon: BarChart2,
          subItems: [
            { nameKey: "nav.executiveDashboard", href: "/analytics", icon: BarChart2, exact: true },
            { nameKey: "nav.reports", href: "/analytics/reports", icon: BarChart2 },
            { nameKey: "nav.fairness", href: "/fairness", icon: Scale, isFairnessBadge: true },
            { nameKey: "nav.auditTrail", href: "/audit-trail", icon: ShieldCheck },
          ],
        },
        { nameKey: "nav.notifications", href: "/notifications", icon: Bell, isNotificationBadge: true },
        { nameKey: "nav.billing", href: "/billing", icon: CreditCard },
        { nameKey: "nav.settings", href: "/settings/general", icon: Settings },
        { nameKey: "nav.helpInstructions", href: "/help/instructions", icon: BookOpen },
      ];
    case "hr_admin":
      return [
        { nameKey: "nav.dashboard", href: "/dashboard/hr-admin", icon: LayoutDashboard },
        {
          nameKey: "nav.people",
          href: "/people",
          icon: Users,
          subItems: [
            { nameKey: "nav.employeeDirectory", href: "/people/directory", icon: Users },
            { nameKey: "nav.departments", href: "/people/departments", icon: Users },
            { nameKey: "nav.salaryBands", href: "/people/salary-bands", icon: Users },
            { nameKey: "nav.pendingApprovals", href: "/hr/people/approvals", icon: Users, isBadge: true },
            { nameKey: "nav.inviteTracker", href: "/invites", icon: Users },
          ],
        },
        {
          nameKey: "nav.cycles",
          href: "/cycles",
          icon: RefreshCw,
          subItems: [
            { nameKey: "nav.allCycles", href: "/cycles", icon: RefreshCw, exact: true },
            { nameKey: "nav.scoreReview", href: "/evaluations/review", icon: CheckSquare, isReviewBadge: true },
          ]
        },
        { nameKey: "nav.careerPaths", href: "/career-paths", icon: TrendingUp },
        {
          nameKey: "nav.analytics",
          href: "/analytics",
          icon: BarChart2,
          subItems: [
            { nameKey: "nav.executiveDashboard", href: "/analytics", icon: BarChart2, exact: true },
            { nameKey: "nav.reports", href: "/analytics/reports", icon: BarChart2 },
            { nameKey: "nav.fairness", href: "/fairness", icon: Scale, isFairnessBadge: true },
            { nameKey: "nav.auditTrail", href: "/audit-trail", icon: ShieldCheck },
          ],
        },
        { nameKey: "nav.notifications", href: "/notifications", icon: Bell, isNotificationBadge: true },
        { nameKey: "nav.settings", href: "/settings/notifications", icon: Settings },
        { nameKey: "nav.helpInstructions", href: "/help/instructions", icon: BookOpen },
      ];
    case "manager":
      return [
        { nameKey: "nav.dashboard", href: "/dashboard/manager", icon: LayoutDashboard },
        { nameKey: "nav.evaluations", href: "/evaluations", icon: ClipboardList, isEvalBadge: true },
        { nameKey: "nav.notifications", href: "/notifications", icon: Bell, isNotificationBadge: true },
        { nameKey: "nav.settings", href: "/settings/profile", icon: Settings },
      ];
    case "employee":
      return [
        { nameKey: "nav.dashboard", href: "/dashboard/employee", icon: LayoutDashboard },
        { nameKey: "nav.myCareer", href: "/career", icon: TrendingUp },
        { nameKey: "nav.myIncrements", href: "/increments", icon: DollarSign },
        { nameKey: "nav.notifications", href: "/notifications", icon: Bell, isNotificationBadge: true },
        { nameKey: "nav.settings", href: "/settings/profile", icon: Settings },
      ];
    default:
      return [];
  }
};
