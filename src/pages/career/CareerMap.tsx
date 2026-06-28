import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import {
  getEmployeeCareerMap,
  getCareerMapWithPath,
  getEmployeeEvaluations,
  getActiveCycle,
  getIncrementStoryRecommendations,
} from '../../services/careerPathService';
import { getIncrementStories } from '../../services/incrementStoryService';
import { evaluationService } from '../../services/evaluationService';
import { type EmployeeCareerMap, type CareerPath, type CareerLevel } from '../../types/careerPath';
import { type IncrementStory, type StoryRecommendation, type RecommendationPriority } from '../../types/incrementStory';
import { type Evaluation } from '../../types/evaluation';
import { type Cycle } from '../../types/cycle';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  CheckCircle2,
  FileText,
  Loader2,
  MapPin,
  Calendar,
  ChevronRight,
  Target,
} from 'lucide-react';
import { format, differenceInDays, differenceInMonths } from 'date-fns';
import { Link } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Milestone Dot
// ---------------------------------------------------------------------------

const MilestoneDot: React.FC<{
  achieved: boolean;
  title: string;
  onClick: () => void;
}> = ({ achieved, title, onClick }) => {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 group">
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
          achieved
            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200'
            : 'bg-slate-100 text-slate-400 border-2 border-slate-200'
        }`}
      >
        {achieved ? <CheckCircle2 className="w-5 h-5" /> : <div className="w-3 h-3 rounded-full bg-slate-300" />}
      </div>
      <span className="text-[10px] font-medium text-slate-500 text-center max-w-[80px] line-clamp-2 leading-tight">
        {title}
      </span>
    </button>
  );
};

// ---------------------------------------------------------------------------
// Career Map Page
// ---------------------------------------------------------------------------

const CareerMapPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [careerMap, setCareerMap] = useState<EmployeeCareerMap | null>(null);
  const [careerPath, setCareerPath] = useState<CareerPath | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [activeCycle, setActiveCycle] = useState<Cycle | null>(null);
  const [activeEvaluation, setActiveEvaluation] = useState<Evaluation | null>(null);
  const [incrementStories, setIncrementStories] = useState<IncrementStory[]>([]);
  const [recommendations, setRecommendations] = useState<StoryRecommendation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [listenerError, setListenerError] = useState<string | null>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<{
    title: string;
    description: string;
    achieved: boolean;
    achievedAt?: Date;
    type: string;
    targetValue: number;
    currentValue?: number;
  } | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<CareerLevel | null>(null);

  // Progress animation
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const hasAnimated = useRef(false);

  // Fetch career map
  useEffect(() => {
    if (!user?.uid) return;
    setListenerError(null);
    const unsub = getEmployeeCareerMap(
      user.uid,
      (map) => {
        setCareerMap(map);
        setLoading(false);
      },
      (error) => {
        setListenerError(error.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user?.uid]);

  // Fetch career path and related data
  useEffect(() => {
    if (!user?.uid || !user?.companyId) return;

    const fetchData = async () => {
      try {
        const { careerPath: path } = await getCareerMapWithPath(user.uid);
        setCareerPath(path);

        const evals = await getEmployeeEvaluations(user.uid, user.companyId, 5);
        setEvaluations(evals as Evaluation[]);

        const cycle = await getActiveCycle(user.companyId);
        setActiveCycle(cycle as Cycle | null);

        if (cycle && user.uid) {
          const evalId = `${cycle.id}_${user.uid}`;
          try {
            const evalDoc = await evaluationService.getEvaluation(evalId);
            setActiveEvaluation(evalDoc);
          } catch {
            setActiveEvaluation(null);
          }
        } else {
          setActiveEvaluation(null);
        }
      } catch {
        // Non-fatal
      }
    };

    fetchData();
  }, [user?.uid, user?.companyId, careerMap?.careerPathId]);

  // Fetch increment stories and recommendations
  useEffect(() => {
    if (!user?.uid) return;

    const unsubStories = getIncrementStories(user.uid, (stories) => {
      setIncrementStories(stories);
    });

    const fetchRecommendations = async () => {
      try {
        const recs = await getIncrementStoryRecommendations(user.uid);
        if (Array.isArray(recs)) {
          setRecommendations(recs as StoryRecommendation[]);
        } else {
          setRecommendations([]);
        }
      } catch {
        setRecommendations([]);
      }
    };
    fetchRecommendations();

    return () => unsubStories();
  }, [user?.uid]);

  // Gap calculation: derive recommendations from active evaluation when none are stored
  useEffect(() => {
    if (recommendations === null) return; // still loading stored ones
    if (recommendations.length > 0) return; // already have recommendations
    if (!activeEvaluation || !activeCycle) return;

    const computed: StoryRecommendation[] = activeCycle.criteria
      .map((criterion) => {
        const score = activeEvaluation.scores?.[criterion.id];
        const currentScore = score?.normalizedScore ?? 0;
        const targetScore = 90; // exceptional threshold
        const gap = targetScore - currentScore;
        if (gap <= 5) return null; // already close to exceptional
        const priority: RecommendationPriority = gap > 25 ? 'high' : gap > 10 ? 'medium' : 'low';
        return {
          criteriaId: criterion.id,
          criteriaName: criterion.name,
          currentScore,
          targetScore,
          priority,
          suggestion: `Improve your ${criterion.name.toLowerCase()} performance by ${gap.toFixed(0)} points to reach Exceptional level. ${
            criterion.dataSource === 'manager'
              ? 'Discuss specific improvement areas with your manager.'
              : criterion.dataSource === 'self'
              ? 'Track your own progress and document achievements.'
              : 'Your system-measured metrics will update automatically.'
          }`,
        };
      })
      .filter(Boolean) as StoryRecommendation[];

    computed.sort(
      (a, b) => (b.targetScore - b.currentScore) - (a.targetScore - a.currentScore)
    );

    if (computed.length > 0) {
      setRecommendations(computed);
    }
  }, [recommendations, activeEvaluation, activeCycle]);

  // Animate progress bar on mount
  useEffect(() => {
    if (!hasAnimated.current && careerMap && !loading) {
      hasAnimated.current = true;
      const target = careerMap.progressPercent;
      const duration = 1200;
      const startTime = performance.now();

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(1, elapsed / duration);
        setAnimatedProgress(Math.round(target * progress));
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      requestAnimationFrame(animate);
    }
  }, [careerMap, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  // Empty state: no career path assigned
  if (!careerMap) {
    return (
      <div className="max-w-4xl mx-auto font-brand pb-12">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center">
            <MapPin className="w-8 h-8 text-slate-300" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">{t('career.map.noCareerPath.title')}</h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            {t('career.map.noCareerPath.desc')}
          </p>
          {listenerError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg text-left">
              <p className="text-xs font-bold text-red-700 mb-1">Debug info:</p>
              <p className="text-xs text-red-600 font-mono break-all">{listenerError}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const currentLevel = careerPath?.levels.find((l) => l.levelId === careerMap.currentLevelId);
  const nextLevel = careerPath?.levels.find((l) => l.levelId === careerMap.nextLevelId);
  const timeAtLevel = careerMap.levelHistory[careerMap.levelHistory.length - 1]?.startedAt;
  const monthsAtLevel = timeAtLevel ? differenceInMonths(new Date(), timeAtLevel.toDate()) : 0;

  // Check if employee is in active cycle scope
  const isInActiveCycle = activeCycle
    ? activeCycle.scope.allEmployees ||
      activeCycle.scope.departmentIds.includes((user as unknown as { departmentId?: string })?.departmentId || '') ||
      activeCycle.scope.salaryBandIds.includes(careerMap.currentSalaryBandId)
    : false;

  return (
    <div className="max-w-5xl mx-auto space-y-8 font-brand pb-12">
      {/* Header Card — Current Position */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="absolute top-0 left-0 h-full w-2 bg-gradient-to-b from-emerald-400 to-emerald-600" />
        <div className="p-8 pl-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">{t('career.map.currentLevel')}</p>
              <h1 className="text-3xl font-black text-slate-900 mb-2">{careerMap.currentLevelTitle}</h1>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">
                  {t('career.map.level')} {careerMap.currentLevelNumber}
                </span>
                <span className="text-sm text-slate-600 font-medium">{careerMap.currentSalaryBandName}</span>
              </div>
            </div>
            <div className="text-left md:text-right">
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">{t('career.map.target')}</p>
              <p className="text-lg font-bold text-slate-700">{careerMap.nextLevelTitle || t('career.map.topOfTrack')}</p>
              {nextLevel && (
                <p className="text-xs text-slate-500 mt-1">
                  Requires score ≥ {nextLevel.requiredScore}% and {nextLevel.requiredCycles} cycles
                </p>
              )}
            </div>
          </div>
          {timeAtLevel && (
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
              <Calendar className="w-4 h-4" />
              {monthsAtLevel > 0 ? t('career.map.monthsAtLevel', { count: monthsAtLevel }) : 'Recently started at this level'}
            </div>
          )}
        </div>
      </div>

      {/* Progress Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <div className="flex justify-between items-end mb-6">
          <h2 className="text-xl font-bold text-slate-900">{t('career.map.progressTitle')}</h2>
          <span className="text-lg font-bold text-emerald-600">
            {careerMap.progressPercent >= 100 ? '100%' : `${evaluations.length < 2 ? 0 : animatedProgress}%`}
          </span>
        </div>

        <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-emerald-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${careerMap.progressPercent >= 100 ? 100 : evaluations.length < 2 ? 0 : animatedProgress}%` }}
            transition={{ duration: 0 }}
          />
        </div>

        <div className="mt-4 text-center">
          {careerMap.progressPercent >= 100 ? (
            <p className="text-sm font-medium text-emerald-600">
              {t('career.map.readyForPromotion')}
            </p>
          ) : evaluations.length < 2 ? (
            <p className="text-sm text-slate-500">
              {t('career.map.completeMoreCycles')}
            </p>
          ) : (
            <p className="text-sm text-slate-500">
              {t('career.map.percentToward', { percent: animatedProgress, level: careerMap.nextLevelTitle })}
            </p>
          )}
        </div>
      </div>

      {/* Milestones Row */}
      {currentLevel && currentLevel.milestones.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">{t('career.map.milestones')}</h3>
          <div className="flex flex-wrap gap-6">
            {currentLevel.milestones.map((m) => {
              const achievement = careerMap.milestoneAchievements.find((ma) => ma.milestoneId === m.milestoneId);
              return (
                <MilestoneDot
                  key={m.milestoneId}
                  achieved={achievement?.achieved || false}
                  title={m.title}
                  onClick={() => setSelectedMilestone({
                    title: m.title,
                    description: m.description,
                    achieved: achievement?.achieved || false,
                    achievedAt: achievement?.achievedAt?.toDate?.(),
                    type: m.type,
                    targetValue: m.targetValue,
                    currentValue: achievement?.achieved
                      ? m.targetValue
                      : m.type === 'cycle_count'
                      ? careerMap.completedCyclesAtLevel
                      : m.type === 'score_threshold'
                      ? careerMap.averageScoreLastTwoCycles
                      : m.type === 'tenure_months'
                      ? monthsAtLevel
                      : undefined,
                  })}
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Active Cycle Progress Card */}
          {activeCycle && isInActiveCycle && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">{activeCycle.name} — {t('career.map.cycleInProgress')}</h3>
                {activeCycle.timeline?.endDate && (
                  <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-100">
                    {t('career.map.daysRemaining', { count: Math.max(0, differenceInDays(activeCycle.timeline.endDate.toDate(), new Date())) })}
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {activeCycle.criteria.map((c) => {
                  const score = activeEvaluation?.scores?.[c.id];
                  let progressContent: React.ReactNode;

                  if (c.dataSource === 'system') {
                    progressContent = score ? (
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${Math.min(100, (score.normalizedScore / (c.maxValue || 100)) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-600">{score.rawScore} / {c.maxValue || 100}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">{t('career.map.noDataYet')}</span>
                    );
                  } else if (c.dataSource === 'manager') {
                    progressContent = (
                      <span className="text-xs text-amber-600 font-medium">{t('career.map.pendingManagerEval')}</span>
                    );
                  } else {
                    progressContent = score ? (
                      <span className="text-xs text-slate-600">{t('career.map.submitted', { score: score.rawScore })}</span>
                    ) : (
                      <span className="text-xs text-slate-400">{t('career.map.notSubmitted')}</span>
                    );
                  }

                  return (
                    <div key={c.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-700">{c.name}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                          {c.weight}%
                        </span>
                      </div>
                      {progressContent}
                    </div>
                  );
                })}
              </div>

              {/* Estimated Score */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">{t('career.map.estimatedScore')}</span>
                  <span className="text-lg font-bold text-slate-900">
                    {activeCycle.criteria.reduce((sum, c) => {
                      const evalDoc = evaluations.find((e) => e.cycleId === activeCycle.id);
                      const score = evalDoc?.scores?.[c.id];
                      return sum + (score ? score.normalizedScore * (c.weight / 100) : 0);
                    }, 0).toFixed(1)}
                    /100
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Increment History */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">{t('career.map.incrementHistory')}</h3>
            {incrementStories.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <FileText className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                <p className="text-sm">{t('career.map.historyEmpty')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {incrementStories.map((story) => (
                  <div
                    key={story.cycleId}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-1 h-10 rounded-full"
                        style={{ backgroundColor: story.tierColor }}
                      />
                      <div>
                        <p className="text-sm font-bold text-slate-900">{story.cycleName}</p>
                        <p className="text-xs text-slate-500">{format(story.completedAt.toDate(), 'MMM d, yyyy')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-bold"
                        style={{ backgroundColor: `${story.tierColor}20`, color: story.tierColor }}
                      >
                        {story.tierName}
                      </span>
                      <span className="text-sm font-bold text-emerald-600">+{story.incrementPercent.toFixed(1)}%</span>
                      <Link
                        to={`/increments/${story.cycleId}`}
                        className="text-xs font-medium text-slate-500 hover:text-slate-900 flex items-center gap-0.5"
                      >
                        {t('career.map.viewStory')} <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Improvement Recommendations */}
          {recommendations && recommendations.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">{t('career.map.howToImprove')}</h3>
              <div className="space-y-3">
                {recommendations.slice(0, 3).map((rec, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-slate-800">{rec.criteriaName}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          rec.priority === 'high'
                            ? 'bg-red-100 text-red-700'
                            : rec.priority === 'medium'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {rec.priority}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mb-1">
                      {t('career.map.currentVsTarget', { current: rec.currentScore.toFixed(1), target: rec.targetScore.toFixed(1) })}
                    </p>
                    <p className="text-sm text-slate-700">{rec.suggestion}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {recommendations && recommendations.length === 0 && incrementStories.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-2">{t('career.map.howToImprove')}</h3>
              <p className="text-sm text-slate-500">{t('career.map.noImprovementAreas')}</p>
            </div>
          )}

          {/* Career Journey Timeline */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-6">{t('career.map.careerJourney')}</h3>
            {careerMap.levelHistory.length === 0 ? (
              <p className="text-sm text-slate-500">{t('career.map.noHistory')}</p>
            ) : (
              <div className="relative border-l-2 border-slate-100 ml-3 space-y-6">
                {careerMap.levelHistory.map((entry, idx) => (
                  <div key={idx} className="relative pl-6">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-emerald-500" />
                    <p className="text-xs font-bold text-slate-400 mb-1">
                      {format(entry.startedAt.toDate(), 'MMM yyyy')}
                    </p>
                    <p className="text-sm font-bold text-slate-800">
                      {entry.promotedAt ? t('career.map.promotedTo') : t('career.map.startedAt')} {entry.levelTitle} ({entry.salaryBandName})
                    </p>
                  </div>
                ))}
                {careerMap.levelHistory.length === 1 && (
                  <div className="relative pl-6">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-100 border-2 border-slate-300" />
                    <p className="text-xs font-bold text-slate-400 mb-1">{t('career.map.futurePlaceholder')}</p>
                    <p className="text-sm text-slate-500">
                      {t('career.map.nextPromotion')}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Band Ladder Sidebar */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">{t('career.map.careerTrack')}</h3>
          <div className="space-y-3">
            {careerPath?.levels.map((level) => {
              const isCurrent = level.levelId === careerMap.currentLevelId;
              const isBelow = level.levelNumber < careerMap.currentLevelNumber;
              const isAbove = level.levelNumber > careerMap.currentLevelNumber;

              return (
                <button
                  key={level.levelId}
                  onClick={() => setSelectedLevel(level)}
                  className={`w-full text-left rounded-xl p-4 border transition-all ${
                    isCurrent
                      ? 'bg-emerald-50 border-emerald-400 shadow-sm'
                      : isBelow
                      ? 'bg-slate-50 border-slate-200 opacity-60'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          isCurrent ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {isBelow ? <CheckCircle2 className="w-4 h-4" /> : level.levelNumber}
                      </div>
                      <div>
                        <p className={`text-sm font-bold ${isCurrent ? 'text-emerald-900' : 'text-slate-700'}`}>
                          {level.title}
                        </p>
                        <p className="text-xs text-slate-500">{level.salaryBandName}</p>
                      </div>
                    </div>
                    {isCurrent && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white uppercase">
                        {t('career.map.current')}
                      </span>
                    )}
                    {isAbove && (
                      <Lock className="w-4 h-4 text-slate-300" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Milestone Detail Popover */}
      <AnimatePresence>
        {selectedMilestone && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedMilestone(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm"
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    selectedMilestone.achieved ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {selectedMilestone.achieved ? <CheckCircle2 className="w-5 h-5" /> : <Target className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">{selectedMilestone.title}</h4>
                  <p className="text-xs text-slate-500 capitalize">{selectedMilestone.type.replace(/_/g, ' ')}</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-4">{selectedMilestone.description}</p>

              {/* Progress / Target info */}
              <div className="bg-slate-50 rounded-lg p-4 mb-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 uppercase tracking-wider">{t('career.map.milestone.target')}</span>
                  <span className="text-sm font-bold text-slate-900">
                    {selectedMilestone.targetValue} {selectedMilestone.type === 'tenure_months' ? t('career.map.milestone.months') : selectedMilestone.type === 'cycle_count' ? t('career.map.milestone.cycles') : t('career.map.milestone.points')}
                  </span>
                </div>
                {!selectedMilestone.achieved && selectedMilestone.currentValue !== undefined && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500 uppercase tracking-wider">{t('career.map.milestone.current')}</span>
                      <span className="text-sm font-bold text-slate-900">
                        {selectedMilestone.currentValue.toFixed?.(1) || selectedMilestone.currentValue} {selectedMilestone.type === 'tenure_months' ? t('career.map.milestone.months') : selectedMilestone.type === 'cycle_count' ? t('career.map.milestone.cycles') : t('career.map.milestone.points')}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
                      <div
                        className="bg-emerald-500 h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (selectedMilestone.currentValue / selectedMilestone.targetValue) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {t('career.map.milestone.moreToGo', { count: Math.max(0, selectedMilestone.targetValue - selectedMilestone.currentValue) })}
                    </p>
                  </>
                )}
                {selectedMilestone.achieved && selectedMilestone.achievedAt && (
                  <div className="flex items-center gap-2 text-xs text-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{t('career.map.milestone.achievedOn', { date: format(selectedMilestone.achievedAt, 'MMM d, yyyy') })}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 mb-4">
                <span
                  className={`text-xs font-bold px-2 py-1 rounded-full ${
                    selectedMilestone.achieved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {selectedMilestone.achieved ? t('career.map.milestone.achieved') : t('career.map.milestone.inProgress')}
                </span>
              </div>

              {!selectedMilestone.achieved && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
                  <p className="text-xs text-blue-700 font-medium">{t('career.map.milestone.nextStep')}</p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    {selectedMilestone.type === 'cycle_count'
                      ? t('career.map.milestone.nextSteps.cycleCount')
                      : selectedMilestone.type === 'score_threshold'
                      ? t('career.map.milestone.nextSteps.scoreThreshold')
                      : selectedMilestone.type === 'tenure_months'
                      ? t('career.map.milestone.nextSteps.tenure')
                      : t('career.map.milestone.nextSteps.manual')}
                  </p>
                </div>
              )}

              <button
                onClick={() => setSelectedMilestone(null)}
                className="w-full py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                {t('career.map.close')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Level Detail Popover */}
      <AnimatePresence>
        {selectedLevel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedLevel(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm"
            >
              <h4 className="text-lg font-bold text-slate-900 mb-1">{selectedLevel.title}</h4>
              <p className="text-sm text-slate-500 mb-4">{selectedLevel.salaryBandName}</p>

              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-slate-50">
                  <span className="text-sm text-slate-500">{t('career.map.requiredScore')}</span>
                  <span className="text-sm font-bold text-slate-900">{selectedLevel.requiredScore}%</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-50">
                  <span className="text-sm text-slate-500">{t('career.map.requiredCycles')}</span>
                  <span className="text-sm font-bold text-slate-900">{selectedLevel.requiredCycles}</span>
                </div>
                {selectedLevel.description && (
                  <div className="py-2">
                    <span className="text-sm text-slate-500">{t('career.map.description')}</span>
                    <p className="text-sm text-slate-700 mt-1">{selectedLevel.description}</p>
                  </div>
                )}
              </div>

              <button
                onClick={() => setSelectedLevel(null)}
                className="mt-4 w-full py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                {t('career.map.close')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CareerMapPage;
