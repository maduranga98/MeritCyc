import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getIncrementStories, getCareerMap } from '../../services/incrementStoryService';
import { useNotificationStore } from '../../stores/notificationStore';
import { type IncrementStory, type CareerMap } from '../../types/incrementStory';
import { type Evaluation, type CriteriaScore } from '../../types/evaluation';
import { type Cycle } from '../../types/cycle';
import { type SalaryBand } from '../../types/salaryBand';
import { type Department } from '../../types/department';
import { Clock, TrendingUp, Award, DollarSign, Bell, Activity } from 'lucide-react';
import { markNotificationRead } from '../../services/notificationService';
import { salaryBandService } from '../../services/salaryBandService';
import { departmentService } from '../../services/departmentService';
import { db } from '../../config/firebase';
import { doc, getDoc, collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';

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
  const [activeCycle, setActiveCycle] = useState<(Cycle & { isLocked: boolean }) | null>(null);
  const [activeEvaluation, setActiveEvaluation] = useState<Evaluation | null>(null);
  const [currentWeightedScore, setCurrentWeightedScore] = useState<number>(0);
  const [estimatedTier, setEstimatedTier] = useState<string | null>(null);
  const [salaryBands, setSalaryBands] = useState<SalaryBand[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [userSalaryBandId, setUserSalaryBandId] = useState<string | undefined>();
  const [userDepartmentId, setUserDepartmentId] = useState<string | undefined>();

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

  // Fetch salary bands, departments, and user profile fields
  useEffect(() => {
    if (!user?.uid || !user?.companyId) return;
    let isMounted = true;

    const fetchData = async () => {
      try {
        const [bands, depts, userSnap] = await Promise.all([
          salaryBandService.getSalaryBands(user.companyId),
          departmentService.getDepartments(user.companyId),
          getDoc(doc(db, 'users', user.uid)),
        ]);

        if (!isMounted) return;

        setSalaryBands(bands);
        setDepartments(depts);

        if (userSnap.exists()) {
          const d = userSnap.data();
          setUserSalaryBandId(d.salaryBandId as string | undefined);
          setUserDepartmentId(d.departmentId as string | undefined);
        }
      } catch {
        // Non-critical
      }
    };

    fetchData();
    return () => { isMounted = false; };
  }, [user?.uid, user?.companyId]);

  useEffect(() => {
    if (!user?.uid || !user?.companyId) return;

    let evalUnsubscribe: (() => void) | null = null;
    let isMounted = true;

    const init = async () => {
      try {
        const cyclesSnapshot = await getDocs(
          query(
            collection(db, 'cycles'),
            where('companyId', '==', user.companyId),
            where('status', 'in', ['active', 'locked'])
          )
        );

        if (!isMounted) return;

        if (cyclesSnapshot.empty) {
          setActiveCycle(null);
          setActiveEvaluation(null);
          return;
        }

        const cycleDoc = cyclesSnapshot.docs[0];
        const cycleData = cycleDoc.data() as Cycle;

        if (!isMounted) return;

        setActiveCycle({ ...cycleData, isLocked: cycleData.status === 'locked' });

        evalUnsubscribe = onSnapshot(
          query(
            collection(db, 'evaluations'),
            where('cycleId', '==', cycleDoc.id),
            where('employeeId', '==', user.uid)
          ),
          (snapshot) => {
            if (!isMounted) return;

            if (!snapshot.empty) {
              const evalData = snapshot.docs[0].data() as Evaluation;
              setActiveEvaluation(evalData);

              if (evalData.scores && typeof evalData.scores === 'object') {
                const criteriaArray = Object.values(evalData.scores) as CriteriaScore[];
                const totalWeighted = criteriaArray.reduce((sum: number, c: CriteriaScore) => {
                  const weight = c.weight || 1;
                  const score = c.normalizedScore || 0;
                  return sum + (score * weight);
                }, 0);
                const totalWeight = criteriaArray.reduce((sum: number, c: CriteriaScore) => sum + (c.weight || 1), 0);
                const weighted = totalWeight > 0 ? totalWeighted / totalWeight : 0;
                setCurrentWeightedScore(weighted);

                if (weighted >= 90) setEstimatedTier('Exceptional');
                else if (weighted >= 75) setEstimatedTier('Exceeds');
                else if (weighted >= 60) setEstimatedTier('Meets');
                else setEstimatedTier('Developing');
              }
            } else {
              setActiveEvaluation(null);
            }
          }
        );
      } catch (err) {
        console.error('Error loading active cycle:', err);
      }
    };

    init();

    return () => {
      isMounted = false;
      evalUnsubscribe?.();
    };
  }, [user?.uid, user?.companyId]);

  const bestScore = stories.length > 0 ? Math.max(...stories.map(s => s.score)) : 0;
  const bestStory = stories.find(s => s.score === bestScore);
  const totalIncrements = stories.reduce((sum, s) => sum + s.incrementPercent, 0);
  const latestStory = stories[0];

  const resolvedBand = salaryBands.find(b => b.id === (userSalaryBandId || careerMap?.currentBandId));
  const resolvedBandName = resolvedBand?.name || careerMap?.currentBandName || 'Band Not Set';
  const resolvedDeptName = departments.find(d => d.id === userDepartmentId)?.name || 'Department';

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
              {resolvedBandName} • {resolvedDeptName}
            </span>
            {resolvedBand && (
              <span className="text-emerald-400/80 text-sm">
                {resolvedBand.currency} {resolvedBand.minSalary.toLocaleString()} – {resolvedBand.maxSalary.toLocaleString()}
              </span>
            )}
          </div>
        </div>
        <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center text-3xl font-bold border-4 border-slate-700 shadow-xl">
          {user?.name?.charAt(0).toUpperCase()}
        </div>
      </div>

      {/* SECTION 2 — Active Cycle Card */}
      {activeCycle && activeEvaluation ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative overflow-hidden">
          <div className={`absolute top-0 left-0 w-1.5 h-full ${activeCycle.isLocked ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wider mb-2 inline-block ${activeCycle.isLocked ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {activeCycle.isLocked ? 'Evaluation Locked' : 'Active Increment Cycle'}
              </span>
              <h2 className="text-xl font-bold text-merit-navy">{activeCycle.name}</h2>
              <p className="text-slate-500 text-sm mt-1">
                {new Date(activeCycle.timeline.startDate.toDate?.() || activeCycle.timeline.startDate).toLocaleDateString()} – {new Date(activeCycle.timeline.endDate.toDate?.() || activeCycle.timeline.endDate).toLocaleDateString()}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black text-amber-500">{Math.ceil(currentWeightedScore)}</div>
              <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Current Score</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 mb-4">
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Estimated Tier</p>
              <p className="text-sm font-bold text-merit-navy mt-1">{estimatedTier || 'Calculating...'}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Status</p>
              <p className="text-sm font-bold text-emerald-600 mt-1 flex items-center gap-1">
                <Activity className="w-4 h-4" /> In Progress
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div className={`flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg ${activeCycle.isLocked ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-700'}`}>
              <span className={`flex items-center justify-center w-5 h-5 rounded-full ${activeCycle.isLocked ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-700'}`}>
                {activeCycle.isLocked ? '✓' : '○'}
              </span>
              {activeCycle.isLocked ? 'Criteria locked — your evaluation rules won\'t change' : 'Evaluation in progress'}
            </div>
            <Link to="/career" className="text-sm font-bold text-merit-navy hover:text-merit-emerald transition-colors px-4 py-2 border border-slate-200 rounded-lg hover:border-emerald-200 hover:bg-emerald-50">
              View Details →
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 text-center text-slate-500">
          <Clock className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p>No active increment cycle at the moment. Check back when HR launches a new cycle.</p>
        </div>
      )}

      {/* SECTION 2.5 — Your Progress This Cycle */}
      {activeCycle && activeCycle.status === 'completed' ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <h3 className="font-semibold text-emerald-800">Your increment story is ready</h3>
          <Link
            to={`/increments/${activeCycle.id}`}
            className="text-sm font-bold text-emerald-600 hover:text-emerald-700 mt-2 inline-block"
          >
            View My Increment Story →
          </Link>
        </div>
      ) : activeCycle ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Your Progress This Cycle</h2>
              <p className="text-sm text-slate-500 mt-1">{activeCycle.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs text-emerald-600 font-medium">Live</span>
            </div>
          </div>

          {activeEvaluation ? (
            <>
              <div className="space-y-3 divide-y divide-slate-50">
                {activeCycle.criteria.map((criterion) => {
                  const score = activeEvaluation.scores[criterion.id];
                  const scoreValue = score?.normalizedScore ?? null;
                  const sourceLabel =
                    criterion.dataSource === 'manager'
                      ? 'Manager'
                      : criterion.dataSource === 'system'
                        ? 'System'
                        : 'You';

                  return (
                    <div key={criterion.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-slate-800">{criterion.name}</span>
                          <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                            {Math.round(criterion.weight * 100)}%
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">Scored by: {sourceLabel}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        {scoreValue !== null ? (
                          <>
                            <div className="font-bold text-slate-900 text-right w-12">
                              {Math.round(scoreValue)}
                            </div>
                            <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-emerald-500 h-1.5 rounded-full"
                                style={{ width: `${scoreValue}%` }}
                              ></div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-xs text-slate-400 text-right w-12">Pending</div>
                            <div className="w-24 bg-slate-200 rounded-full h-1.5"></div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-slate-100 pt-4 mt-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-700">Current Weighted Score</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">
                      {currentWeightedScore.toFixed(1)}%
                    </span>
                    {activeEvaluation.scores &&
                      Object.values(activeEvaluation.scores as Record<string, CriteriaScore>).length <
                        activeCycle.criteria.length * 0.5 && (
                        <span className="text-xs text-amber-500">(partial)</span>
                      )}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-700">Estimated Tier</span>
                  <span className="font-bold text-slate-900">
                    {estimatedTier || 'Pending — more scores needed'}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <Clock className="w-6 h-6 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-400">Your manager hasn't started your evaluation yet.</p>
            </div>
          )}
        </div>
      ) : null}

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
          <div className="text-lg font-bold text-merit-navy truncate" title={resolvedBandName}>
            {resolvedBandName}
          </div>
          {resolvedBand && (
            <div className="text-xs text-slate-500 mt-1">
              {resolvedBand.currency} {resolvedBand.minSalary.toLocaleString()} – {resolvedBand.maxSalary.toLocaleString()}
            </div>
          )}
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