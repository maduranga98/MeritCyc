import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getCareerMap, getIncrementStories } from '../../services/incrementStoryService';
import { type CareerMap, type IncrementStory } from '../../types/incrementStory';
import { type SalaryBand } from '../../types/salaryBand';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { motion } from 'framer-motion';
import { CheckCircle2, Star, TrendingUp, Award, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { watchCareerProgress } from '../../services/careerPathService';
import { CareerProgressCard } from '../../components/career/CareerProgressCard';
import { CriterionProgressBar } from '../../components/career/CriterionProgressBar';
import { type CareerProgressResult } from '../../types/careerPath';

const MilestoneIcon = ({ type, isAchieved }: { type: string, isAchieved: boolean }) => {
  let Icon = Award;
  if (!isAchieved) {
    Icon = Lock;
  } else {
    switch (type) {
      case 'cycle_completed': Icon = CheckCircle2; break;
      case 'tier_achieved': Icon = Star; break;
      case 'band_promoted': Icon = TrendingUp; break;
      case 'criteria_mastered': Icon = Award; break;
    }
  }

  const colorClass = isAchieved ? (
    type === 'cycle_completed' ? 'text-emerald-500' :
    type === 'tier_achieved' ? 'text-amber-500' :
    type === 'band_promoted' ? 'text-blue-500' :
    'text-purple-500'
  ) : 'text-slate-400';

  return <Icon className={`w-6 h-6 ${colorClass}`} />;
};

const CareerMapPage: React.FC = () => {
  const { user } = useAuth();
  const [careerMap, setCareerMap] = useState<CareerMap | null>(null);
  const [history, setHistory] = useState<IncrementStory[]>([]);
  const [salaryBands, setSalaryBands] = useState<SalaryBand[]>([]);
  const [progress, setProgress] = useState<CareerProgressResult | null>(null);

  useEffect(() => {
    if (!user?.uid || !user?.companyId) return;

    const unsubscribeMap = getCareerMap(user.uid, (data) => {
      setCareerMap(data);
    });

    const unsubscribeHistory = getIncrementStories(user.uid, (data) => {
      setHistory(data);
    });

    const fetchBands = async () => {
      const q = query(collection(db, 'companies', user.companyId, 'salaryBands'), orderBy('level', 'asc'));
      const snap = await getDocs(q);
      setSalaryBands(snap.docs.map(d => ({ id: d.id, ...d.data() } as SalaryBand)));
    };
    fetchBands();

    const unsubscribeProgress = watchCareerProgress(user.uid, setProgress);

    return () => {
      unsubscribeMap();
      unsubscribeHistory();
      unsubscribeProgress();
    };
  }, [user]);

  if (!careerMap) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  const currentBandObj = salaryBands.find(b => b.id === careerMap.currentBandId);

  const achievedMilestones = careerMap.milestones?.filter(m => m.isAchieved) || [];
  const upcomingMilestones = careerMap.milestones?.filter(m => !m.isAchieved) || [];

  return (
    <div className="max-w-4xl mx-auto space-y-8 font-brand pb-12">

      {/* SECTION 1 — Current Position Hero */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
        <div className="absolute top-0 left-0 h-full w-2 bg-gradient-to-b from-emerald-400 to-emerald-600"></div>
        <div className="p-8 pl-10">
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Your Current Level</p>
          <h1 className="text-4xl font-black text-merit-navy mb-2">{careerMap.currentBandName}</h1>
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center text-slate-600">
            {currentBandObj && (
              <span className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 font-medium">
                <DollarSignIcon /> LKR {currentBandObj.minSalary.toLocaleString()} – {currentBandObj.maxSalary.toLocaleString()}
              </span>
            )}
            <span className="flex items-center gap-2">
              <BriefcaseIcon /> Department • Job Title
            </span>
          </div>
        </div>
      </div>

      {progress && <CareerProgressCard progress={progress} />}

      {progress && (
        <div className='bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-3'>
          <h3 className='text-lg font-bold text-merit-navy'>Criteria Progress</h3>
          {progress.criteriaProgress.map((item) => <CriterionProgressBar key={item.name} item={item} />)}
        </div>
      )}

      {/* SECTION 2 — Progress Toward Next Level */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <div className="flex justify-between items-end mb-6">
          <h2 className="text-xl font-bold text-merit-navy">Path to Next Level</h2>
          <span className="text-lg font-bold text-emerald-600">{careerMap.progressPercent}% progress</span>
        </div>

        <div className="relative flex items-center justify-between mb-8">
          <div className="z-10 flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xl ring-4 ring-emerald-100 shadow-md">
              L{careerMap.currentBandLevel}
            </div>
            <span className="text-xs font-bold text-merit-navy mt-2 absolute top-14 whitespace-nowrap text-center w-32 -ml-10">{careerMap.currentBandName}</span>
          </div>

          <div className="absolute left-6 right-6 h-3 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-emerald-500"
              initial={{ width: 0 }}
              animate={{ width: `${careerMap.progressPercent}%` }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            ></motion.div>
          </div>

          <div className="z-10 flex flex-col items-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl ${careerMap.progressPercent >= 100 ? 'bg-emerald-500 text-white ring-4 ring-emerald-100 shadow-md' : 'bg-white border-2 border-dashed border-slate-300 text-slate-400'}`}>
              L{careerMap.currentBandLevel + 1}
            </div>
            <span className="text-xs font-bold text-slate-500 mt-2 absolute top-14 whitespace-nowrap text-center w-32 -ml-10">{careerMap.nextBandName || 'Next Level'}</span>
          </div>
        </div>
        <div className="mt-12 text-center text-sm text-slate-500">
          Your progress is calculated based on your performance scores across recent increment cycles.
        </div>
      </div>

      {/* SECTION 3 — Milestone Cards Grid */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-merit-navy">Your Milestones</h2>

        {achievedMilestones.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {achievedMilestones.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-emerald-50/50 rounded-xl border border-emerald-200 p-5 shadow-sm relative overflow-hidden"
              >
                <div className="absolute -right-4 -top-4 opacity-10">
                  <MilestoneIcon type={m.type} isAchieved={true} />
                </div>
                <div className="flex gap-4">
                  <div className="mt-1 bg-white p-2 rounded-full shadow-sm border border-emerald-100">
                    <MilestoneIcon type={m.type} isAchieved={true} />
                  </div>
                  <div>
                    <h3 className="font-bold text-merit-navy">{m.title}</h3>
                    <p className="text-sm text-slate-600 mt-1">{m.description}</p>
                    {m.achievedAt && (
                      <p className="text-xs font-bold text-emerald-600 mt-3 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Achieved on {format(m.achievedAt.toDate(), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {upcomingMilestones.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            {upcomingMilestones.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 + (i * 0.1) }}
                className="bg-slate-50 rounded-xl border border-slate-200 p-5 shadow-sm opacity-80"
              >
                <div className="flex gap-4">
                  <div className="mt-1 bg-white p-2 rounded-full shadow-sm border border-slate-200">
                    <Lock className="w-6 h-6 text-slate-300" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-700">{m.title}</h3>
                    <p className="text-sm text-slate-500 mt-1">{m.description}</p>
                    <p className="text-xs font-bold text-slate-400 mt-3 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Not yet achieved
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 4 — Performance History Timeline */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <h2 className="text-2xl font-bold text-merit-navy mb-8">Performance History</h2>

        {history.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <TrendingUp className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-lg">Your career journey starts with your first evaluation cycle.</p>
          </div>
        ) : (
          <div className="relative border-l-2 border-slate-100 ml-4 space-y-8">
            {history.map((story) => (
              <div key={story.cycleId} className="relative pl-8">
                <div className="absolute -left-[9px] top-4 w-4 h-4 rounded-full bg-white border-2 border-emerald-500"></div>
                <div className="text-xs font-bold text-slate-400 mb-1">{format(story.completedAt.toDate(), 'MMMM yyyy')}</div>
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-merit-navy">{story.cycleName}</h3>
                      <div className="flex gap-2 mt-2">
                        <span className="px-2 py-0.5 rounded text-xs font-bold" style={{backgroundColor: `${story.tierColor}20`, color: story.tierColor}}>
                          {story.tierName}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 text-xs font-bold">
                          +{story.incrementPercent.toFixed(1)}% increment
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-slate-800">{story.score.toFixed(1)}</div>
                      <div className="text-xs text-slate-400 font-medium">/ 100</div>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-4">
                    <div className="h-1.5 rounded-full" style={{ width: `${story.score}%`, backgroundColor: story.tierColor }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 5 — Band Ladder Overview */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-8">
        <h2 className="text-xl font-bold text-merit-navy mb-6">Company Band Structure</h2>
        <div className="flex flex-col-reverse gap-3">
          {salaryBands.map((band) => {
            const isCurrent = band.id === careerMap.currentBandId;
            const isBelow = band.level < careerMap.currentBandLevel;

            return (
              <div
                key={band.id}
                className={`relative rounded-xl p-5 flex items-center justify-between transition-all ${
                  isCurrent ? 'bg-emerald-50 border-2 border-emerald-400 shadow-sm z-10 scale-[1.02]' :
                  isBelow ? 'bg-slate-50 border border-slate-200 opacity-60' :
                  'bg-white border border-slate-200 shadow-sm'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${isCurrent ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    L{band.level}
                  </div>
                  <div>
                    <h3 className={`font-bold ${isCurrent ? 'text-emerald-900' : 'text-slate-700'}`}>{band.name}</h3>
                    <p className="text-sm text-slate-500">LKR {band.minSalary.toLocaleString()} – {band.maxSalary.toLocaleString()}</p>
                  </div>
                </div>
                {isCurrent && (
                  <div className="px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full uppercase tracking-wider">
                    You are here
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};

const DollarSignIcon = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>;
const BriefcaseIcon = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>;

export default CareerMapPage;