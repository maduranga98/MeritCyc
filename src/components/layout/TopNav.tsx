import React, { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { Menu, Bell, UserCheck, AlertCircle, Clock, Lock, ClipboardList, CheckCircle2, Star, Globe, Search as SearchIcon } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useNotificationStore } from "../../stores/notificationStore";
import { markNotificationRead, markAllNotificationsRead } from "../../services/notificationService";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { type NotificationType } from "../../types/incrementStory";
import { useTranslation } from "react-i18next";

interface TopNavProps {
  setSidebarOpen: (isOpen: boolean) => void;
}

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case 'cycle_locked': return <Lock className="w-5 h-5 text-emerald-500" />;
    case 'evaluation_submitted': return <ClipboardList className="w-5 h-5 text-blue-500" />;
    case 'cycle_completed': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
    case 'increment_story_ready': return <Star className="w-5 h-5 text-amber-500" />;
    case 'account_approved': return <UserCheck className="w-5 h-5 text-emerald-500" />;
    case 'info_requested': return <AlertCircle className="w-5 h-5 text-amber-500" />;
    case 'deadline_reminder': return <Clock className="w-5 h-5 text-red-500" />;
    case 'general':
    default: return <Bell className="w-5 h-5 text-slate-500" />;
  }
};

export const TopNav: React.FC<TopNavProps> = ({ setSidebarOpen }) => {
  const location = useLocation();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();

  const getPageTitle = (pathname: string): string => {
    if (pathname.startsWith("/dashboard/super-admin")) return t("topNav.pageTitles.superAdminDashboard");
    if (pathname.startsWith("/dashboard/hr-admin")) return t("topNav.pageTitles.hrAdminDashboard");
    if (pathname.startsWith("/dashboard/manager")) return t("topNav.pageTitles.managerDashboard");
    if (pathname.startsWith("/dashboard/employee")) return t("topNav.pageTitles.employeeDashboard");
    if (pathname.startsWith("/invites")) return t("topNav.pageTitles.inviteTracker");
    if (pathname.startsWith("/hr/people/approvals")) return t("topNav.pageTitles.pendingApprovals");
    if (pathname.startsWith("/settings/general")) return t("topNav.pageTitles.generalSettings");
    if (pathname.startsWith("/settings/registration")) return t("topNav.pageTitles.registrationSettings");
    if (pathname.startsWith("/settings/notifications")) return t("topNav.pageTitles.notificationSettings");
    if (pathname.startsWith("/settings/security")) return t("topNav.pageTitles.securitySettings");
    if (pathname.startsWith("/settings/data")) return t("topNav.pageTitles.dataPrivacy");
    if (pathname.startsWith("/settings/profile")) return t("topNav.pageTitles.profileSettings");
    if (pathname.startsWith("/settings")) return t("topNav.pageTitles.settings");
    if (pathname.startsWith("/people/directory")) return t("topNav.pageTitles.employeeDirectory");
    if (pathname.startsWith("/people/departments")) return t("topNav.pageTitles.departments");
    if (pathname.startsWith("/people/salary-bands")) return t("topNav.pageTitles.salaryBands");
    if (pathname.startsWith("/people")) return t("topNav.pageTitles.people");
    if (pathname.startsWith("/cycles")) return t("topNav.pageTitles.cycles");
    if (pathname.startsWith("/analytics/reports")) return t("topNav.pageTitles.reports");
    if (pathname.startsWith("/analytics")) return t("topNav.pageTitles.analytics");
    if (pathname.startsWith("/fairness")) return t("topNav.pageTitles.fairnessDashboard");
    if (pathname.startsWith("/evaluations/review")) return t("topNav.pageTitles.scoreReview");
    if (pathname.startsWith("/evaluations")) return t("topNav.pageTitles.evaluations");
    if (pathname.startsWith("/notifications")) return t("topNav.pageTitles.notifications");
    if (pathname.startsWith("/career")) return t("topNav.pageTitles.myCareer");
    if (pathname.startsWith("/increments")) return t("topNav.pageTitles.myIncrements");
    return t("topNav.pageTitles.dashboard");
  };

  const pageTitle = getPageTitle(location.pathname);

  const { notifications, unreadCount } = useNotificationStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setLangMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkRead = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    await markNotificationRead(id);
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
  };

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('meritcyc-lang', lang);
    setLangMenuOpen(false);
  };

  const currentLang = i18n.language === 'fr' ? 'FR' : 'EN';

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
        {/* Global search (command palette) */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
          className="flex items-center gap-2 px-2.5 py-1.5 text-sm text-slate-500 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
          aria-label={t("commandPalette.title")}
        >
          <SearchIcon className="w-4 h-4" />
          <span className="hidden lg:inline text-slate-400">{t("commandPalette.searchHint")}</span>
          <kbd className="hidden lg:inline text-[10px] font-semibold text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">
            Ctrl K
          </kbd>
        </button>

        {/* Language Switcher */}
        <div className="relative" ref={langMenuRef}>
          <button
            onClick={() => setLangMenuOpen(!langMenuOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
          >
            <Globe className="w-4 h-4" />
            {currentLang}
          </button>
          <AnimatePresence>
            {langMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-1 w-28 bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden z-50"
              >
                {[
                  { code: 'en', label: 'English' },
                  { code: 'fr', label: 'Français' },
                ].map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => changeLanguage(lang.code)}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      i18n.language === lang.code
                        ? 'bg-emerald-50 text-emerald-700 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Notifications */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
          >
            <Bell className="w-5 h-5" />
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.span
                  key={unreadCount}
                  initial={{ scale: 1 }}
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 0.3 }}
                  className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-[10px] font-bold text-white flex items-center justify-center rounded-full border-2 border-white"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          {/* Notification Dropdown */}
          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
                className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-50"
              >
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <h3 className="font-bold text-merit-navy">{t("topNav.notifications")}</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs text-merit-emerald font-semibold hover:underline"
                    >
                      {t("topNav.markAllRead")}
                    </button>
                  )}
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-sm">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      {t("topNav.noNotificationsYet")}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {notifications.slice(0, 5).map((notif) => (
                        <div
                          key={notif.id}
                          className={`p-4 hover:bg-slate-50 transition-colors ${!notif.isRead ? 'bg-emerald-50/30 border-l-2 border-emerald-400' : 'bg-white border-l-2 border-transparent'}`}
                        >
                          <div className="flex gap-3">
                            <div className="mt-1 flex-shrink-0">
                              {getNotificationIcon(notif.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start mb-1">
                                <p className={`text-sm ${!notif.isRead ? 'font-bold text-merit-navy' : 'text-slate-700'}`}>
                                  {notif.title}
                                </p>
                                {notif.createdAt && (
                                  <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">
                                    {formatDistanceToNow(notif.createdAt.toDate(), { addSuffix: true })}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 line-clamp-2 mb-2">
                                {notif.message}
                              </p>
                              <div className="flex justify-between items-center mt-2">
                                {notif.actionUrl && (
                                  <Link
                                    to={notif.actionUrl}
                                    onClick={() => setDropdownOpen(false)}
                                    className="text-xs text-merit-emerald font-medium hover:underline"
                                  >
                                    {t("common.viewArrow")}
                                  </Link>
                                )}
                                {!notif.isRead && (
                                  <button
                                    onClick={(e) => handleMarkRead(e, notif.id)}
                                    className="text-[10px] text-slate-400 hover:text-slate-600 ml-auto"
                                  >
                                    {t("topNav.markRead")}
                                  </button>
                                )}
                              </div>
                            </div>
                            {!notif.isRead && (
                              <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-3 border-t border-slate-100 text-center bg-slate-50">
                  <Link
                    to="/notifications"
                    onClick={() => setDropdownOpen(false)}
                    className="text-sm text-merit-emerald font-medium hover:underline block"
                  >
                    {t("topNav.viewAllNotifications")}
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User Avatar Circle */}
        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-merit-navy font-bold border border-slate-200 shadow-sm z-10 relative">
          {user?.name?.charAt(0).toUpperCase() || "U"}
        </div>
      </div>
    </header>
  );
};
