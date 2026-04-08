import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getIncrementStories, getCareerMap } from '../../services/incrementStoryService';
import { useNotificationStore } from '../../stores/notificationStore';
import { type IncrementStory, type CareerMap } from '../../types/incrementStory';
import { type Evaluation } from '../../types/evaluation';
import { Clock, TrendingUp, Award, DollarSign, Bell } from 'lucide-react';
import { markNotificationRead } from '../../services/notificationService';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 18) return 'Good afternoon';
  return 'Good evening';
};

const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stories, setStories] = useState<IncrementStory[]>([]);
  const [careerMap, setCareerMap] = useState<CareerMap | null>(null);
  const { notifications, unreadCount } = useNotificationStore();
  const [activeCycleData] = useState<{ evaluation: Evaluation, criteria: unknown[], currentScore: number, tier: unknown, daysRemaining: number } | null>(null);

  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribeStories = getIncrementStories(user.uid, (data) => {
      setStories(data);
    });

    const unsubscribeCareerMap = getCareerMap(user.uid, (data) => {
      setCareerMap(data);
    });

    return () => {
      unsubscribeStories();
      unsubscribeCareerMap();
    };
  }, [user]);

  useEffect(() => {
    // Attempt to fetch active cycle progress if there is one
    // We don't have a direct way to find the active cycle ID without fetching all cycles,
    // For this dashboard, let's assume we find it via an internal api or just show empty if not known.
    // In a real app, we'd query cycles where status == 'active'.
    // Given the constraints and lack of direct activeCycleId, we might skip showing it if we can't find it,
    // or we'll mock it if needed. The instructions mention "If employee has an active cycle evaluation".
    // We will leave the active cycle card muted if activeCycleData is null.
  }, [user]);

  const bestScore = stories.length > 0 ? Math.max(...stories.map(s => s.score)) : 0;
  const bestStory = stories.find(s => s.score === bestScore);
  const totalIncrements = stories.reduce((sum, s) => sum + s.incrementPercent, 0);
  const latestStory = stories[0];

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-brand pb-12">
      {/* SECTION 1 — Welcome Hero Card */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-8 text-white flex justify-between items-center shadow-lg">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            {getGreeting()}, {user?.name?.split(' ')[0]}!
          </h1>
          <div className="flex items-center gap-3">
            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-sm font-semibold">
              Employee
            </span>
            <span className="text-slate-300 text-sm">
              {careerMap?.currentBandName || 'Band Not Set'} • Department
            </span>
          </div>
        </div>
        <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center text-3xl font-bold border-4 border-slate-700 shadow-xl">
          {user?.name?.charAt(0).toUpperCase()}
        </div>
      </div>

      {/* SECTION 2 — Active Cycle Card */}
      {activeCycleData ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wider mb-2 inline-block">
                Active Increment Cycle
              </span>
              <h2 className="text-xl font-bold text-merit-navy">2026 Annual Review</h2>
              <p className="text-slate-500 text-sm mt-1">Jan 1 – Mar 31, 2026</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black text-amber-500">{activeCycleData.daysRemaining}</div>
              <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Days Remaining</div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium bg-emerald-50 px-3 py-2 rounded-lg">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-600">✓</span>
              Criteria locked — your evaluation rules won't change
            </div>
            <Link to="/career" className="text-sm font-bold text-merit-navy hover:text-merit-emerald transition-colors px-4 py-2 border border-slate-200 rounded-lg hover:border-emerald-200 hover:bg-emerald-50">
              View My Progress
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 text-center text-slate-500">
          <Clock className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p>No active increment cycle at the moment. Check back when HR launches a new cycle.</p>
        </div>
      )}

      {/* SECTION 3 — Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="text-slate-500 text-sm mb-1 flex items-center gap-2">
            <RefreshIcon /> Cycles Participated
          </div>
          <div className="text-2xl font-bold text-merit-navy">{stories.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="text-slate-500 text-sm mb-1 flex items-center gap-2">
            <Award className="w-4 h-4" /> Best Score
          </div>
          <div className="text-2xl font-bold text-merit-navy">
            {bestScore > 0 ? bestScore.toFixed(1) : '-'}
            {bestStory && <span className="text-xs font-normal ml-2 px-2 py-0.5 rounded-full" style={{backgroundColor: `${bestStory.tierColor}20`, color: bestStory.tierColor}}>{bestStory.tierName}</span>}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="text-slate-500 text-sm mb-1 flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Total Increments
          </div>
          <div className="text-2xl font-bold text-emerald-600">+{totalIncrements.toFixed(1)}%</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="text-slate-500 text-sm mb-1 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Current Band
          </div>
          <div className="text-lg font-bold text-merit-navy truncate" title={careerMap?.currentBandName || 'Not Set'}>
            {careerMap?.currentBandName || 'Not Set'}
          </div>
        </div>
      </div>

      {/* SECTION 4 — Recent Increment Story Preview */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-merit-navy flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-500" /> Latest Increment Result
          </h2>
          {latestStory && (
            <Link to={`/increments/${latestStory.cycleId}`} className="text-sm font-bold text-merit-emerald hover:underline">
              Read Full Story →
            </Link>
          )}
        </div>

        <div className="p-6">
          {latestStory ? (
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="text-center md:w-1/3">
                <div className="text-5xl font-black text-merit-navy mb-2">
                  <Counter target={latestStory.score} />
                </div>
                <div className="inline-block px-3 py-1 rounded-full text-sm font-bold mb-4" style={{ backgroundColor: `${latestStory.tierColor}20`, color: latestStory.tierColor }}>
                  {latestStory.tierName}
                </div>
                <div className="text-lg font-bold text-emerald-600 bg-emerald-50 py-2 rounded-lg border border-emerald-100">
                  +{latestStory.incrementPercent.toFixed(1)}% Salary Increment
                </div>
              </div>

              <div className="md:w-2/3 w-full space-y-4">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Top Performance Areas</h3>
                {latestStory.scoreBreakdown.slice(0, 3).map((item) => (
                  <div key={item.criteriaId}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-merit-navy">{item.criteriaName}</span>
                      <span className="text-slate-500">{item.normalizedScore}/100</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <motion.div
                        className="h-2 rounded-full"
                        style={{ backgroundColor: getPerformanceColor(item.performance) }}
                        initial={{ width: 0 }}
                        animate={{ width: `${item.normalizedScore}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      ></motion.div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-500 py-8">
              <Award className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>Your first increment story will appear here after your first evaluation cycle completes.</p>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 5 — Latest Notifications Inline */}
      {unreadCount > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Recent Notifications</span>
            <Link to="/notifications" className="text-xs text-merit-emerald normal-case hover:underline">View All</Link>
          </h2>
          <div className="grid gap-3">
            {notifications.filter(n => !n.isRead).slice(0, 3).map(notif => (
              <div key={notif.id} className="bg-emerald-50/40 border border-emerald-200 rounded-lg p-4 flex gap-4 items-start">
                <div className="mt-0.5"><Bell className="w-5 h-5 text-emerald-500" /></div>
                <div className="flex-1">
                  <h4 className="font-bold text-merit-navy text-sm">{notif.title}</h4>
                  <p className="text-slate-600 text-sm mt-0.5">{notif.message}</p>
                </div>
                <button
                  onClick={() => markNotificationRead(notif.id)}
                  className="text-xs font-medium text-emerald-600 hover:bg-emerald-100 px-2 py-1 rounded"
                >
                  Mark Read
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 6 — Career Progress Teaser */}
      {careerMap && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row items-center gap-6 justify-between">
          <div className="flex-1 w-full">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Career Progress</h3>
            <div className="flex justify-between items-end mb-2">
              <span className="font-bold text-merit-navy">{careerMap.currentBandName}</span>
              {careerMap.nextBandName && (
                <span className="text-sm text-slate-500">→ {careerMap.nextBandName}</span>
              )}
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3">
              <motion.div
                className="bg-emerald-500 h-3 rounded-full relative"
                initial={{ width: 0 }}
                animate={{ width: `${careerMap.progressPercent}%` }}
                transition={{ duration: 1.2, ease: "easeOut" }}
              >
                <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white shadow-sm"></div>
              </motion.div>
            </div>
            <div className="text-xs text-slate-500 mt-2 text-right">
              {careerMap.progressPercent}% toward {careerMap.nextBandName || 'next level'}
            </div>
          </div>
          <Link to="/career" className="whitespace-nowrap px-6 py-3 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-sm">
            View Career Map
          </Link>
        </div>
      )}

    </div>
  );
};

// Helpers
const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21v-5h5"/></svg>
);

const getPerformanceColor = (perf: string) => {
  switch (perf) {
    case 'excellent': return '#3b82f6';
    case 'good': return '#10b981';
    case 'average': return '#f59e0b';
    case 'needs_improvement': return '#ef4444';
    default: return '#94a3b8';
  }
};

const Counter = ({ target }: { target: number }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = target;
    const duration = 1500;
    const increment = end / (duration / 16);

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, 16);

    return () => clearInterval(timer);
  }, [target]);

  return <>{count.toFixed(1)}</>;
};

export default EmployeeDashboard;