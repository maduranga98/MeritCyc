import React, { useState } from 'react';
import { useNotificationStore } from '../../stores/notificationStore';
import { markNotificationRead, markAllNotificationsRead } from '../../services/notificationService';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell,
  Lock,
  ClipboardList,
  CheckCircle2,
  Star,
  UserCheck,
  AlertCircle,
  Clock,
  Check
} from 'lucide-react';
import { type NotificationType } from '../../types/incrementStory';

type FilterTab = 'All' | 'Unread' | 'Cycle Updates' | 'Evaluations' | 'Account';

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

const getFilterTypeMap = (tab: FilterTab): NotificationType[] | null => {
  switch (tab) {
    case 'Cycle Updates': return ['cycle_locked', 'cycle_completed', 'increment_story_ready'];
    case 'Evaluations': return ['evaluation_submitted', 'deadline_reminder'];
    case 'Account': return ['account_approved', 'info_requested'];
    case 'Unread':
    case 'All':
    default: return null;
  }
};

const NotificationsPage: React.FC = () => {
  const { notifications, unreadCount } = useNotificationStore();
  const [activeTab, setActiveTab] = useState<FilterTab>('All');
  const tabs: FilterTab[] = ['All', 'Unread', 'Cycle Updates', 'Evaluations', 'Account'];

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'Unread') return !n.isRead;
    const typeMap = getFilterTypeMap(activeTab);
    if (typeMap) return typeMap.includes(n.type);
    return true; // All
  });

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-brand pb-12">

      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-merit-navy">Notifications</h1>
          <p className="text-slate-500 mt-1">You have {unreadCount} unread messages</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-sm font-bold text-slate-600 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Check className="w-4 h-4" /> Mark All Read
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Filter Tabs */}
        <div className="border-b border-slate-200 px-2 flex overflow-x-auto hide-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-4 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-merit-emerald text-merit-emerald'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* List */}
        <div>
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-16 bg-slate-50/50">
              <Bell className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-medium text-slate-600">No notifications here</p>
              <p className="text-sm text-slate-400 mt-1">You're all caught up on {activeTab.toLowerCase()} notifications.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredNotifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-6 transition-colors ${!notif.isRead ? 'bg-emerald-50/30 border-l-2 border-l-emerald-400' : 'bg-white border-l-2 border-l-transparent'}`}
                >
                  <div className="flex gap-4">
                    <div className="mt-1 flex-shrink-0 bg-white p-2 rounded-full border border-slate-100 shadow-sm">
                      {getNotificationIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-1 gap-2 sm:gap-0">
                        <p className={`text-base ${!notif.isRead ? 'font-bold text-merit-navy' : 'font-semibold text-slate-700'}`}>
                          {notif.title}
                        </p>
                        {notif.createdAt && (
                          <span className="text-xs font-medium text-slate-400 whitespace-nowrap">
                            {formatDistanceToNow(notif.createdAt.toDate(), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 mb-3 max-w-2xl">
                        {notif.message}
                      </p>
                      <div className="flex items-center gap-4">
                        {notif.actionUrl && (
                          <Link
                            to={notif.actionUrl}
                            className="text-sm font-bold text-merit-emerald hover:underline"
                          >
                            View Details →
                          </Link>
                        )}
                        {!notif.isRead && (
                          <button
                            onClick={() => handleMarkRead(notif.id)}
                            className="text-xs font-medium text-slate-400 hover:text-slate-600"
                          >
                            Mark as read
                          </button>
                        )}
                      </div>
                    </div>
                    {!notif.isRead && (
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-2 flex-shrink-0 shadow-sm"></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default NotificationsPage;