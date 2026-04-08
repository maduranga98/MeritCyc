import React, { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { Menu, Bell, UserCheck, AlertCircle, Clock, Lock, ClipboardList, CheckCircle2, Star } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useNotificationStore } from "../../stores/notificationStore";
import { markNotificationRead, markAllNotificationsRead } from "../../services/notificationService";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { type NotificationType } from "../../types/incrementStory";

interface TopNavProps {
  setSidebarOpen: (isOpen: boolean) => void;
}

// Simple helper to convert paths to readable titles
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

  const { notifications, unreadCount } = useNotificationStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
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
                  <h3 className="font-bold text-merit-navy">Notifications</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs text-merit-emerald font-semibold hover:underline"
                    >
                      Mark All Read
                    </button>
                  )}
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-sm">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      No notifications yet
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
                                    View →
                                  </Link>
                                )}
                                {!notif.isRead && (
                                  <button
                                    onClick={(e) => handleMarkRead(e, notif.id)}
                                    className="text-[10px] text-slate-400 hover:text-slate-600 ml-auto"
                                  >
                                    Mark Read
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
                    View All Notifications
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