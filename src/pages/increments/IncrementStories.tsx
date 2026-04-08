import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getIncrementStories } from '../../services/incrementStoryService';
import { type IncrementStory } from '../../types/incrementStory';
import { Link } from 'react-router-dom';
import { FileText, TrendingUp, Award } from 'lucide-react';
import { format } from 'date-fns';

const IncrementStoriesPage: React.FC = () => {
  const { user } = useAuth();
  const [stories, setStories] = useState<IncrementStory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = getIncrementStories(user.uid, (data) => {
      setStories(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  const avgScore = stories.length > 0 ? stories.reduce((sum, s) => sum + s.score, 0) / stories.length : 0;
  const totalGrowth = stories.reduce((sum, s) => sum + s.incrementPercent, 0);
  const bestScore = stories.length > 0 ? Math.max(...stories.map(s => s.score)) : 0;
  const bestStory = stories.find(s => s.score === bestScore);

  return (
    <div className="max-w-4xl mx-auto space-y-8 font-brand pb-12">

      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-merit-navy">My Increment History</h1>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="text-slate-500 text-sm mb-1 flex items-center gap-2">
            <FileText className="w-4 h-4" /> Total Cycles
          </div>
          <div className="text-2xl font-bold text-merit-navy">{stories.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="text-slate-500 text-sm mb-1 flex items-center gap-2">
            <Award className="w-4 h-4" /> Average Score
          </div>
          <div className="text-2xl font-bold text-merit-navy">{avgScore > 0 ? avgScore.toFixed(1) : '-'}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="text-slate-500 text-sm mb-1 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Salary Growth
          </div>
          <div className="text-2xl font-bold text-emerald-600">+{totalGrowth.toFixed(1)}%</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="text-slate-500 text-sm mb-1 flex items-center gap-2">
            <Award className="w-4 h-4" /> Best Tier
          </div>
          <div className="text-lg font-bold text-merit-navy truncate">
            {bestStory ? bestStory.tierName : '-'}
          </div>
        </div>
      </div>

      {/* Story List */}
      <div className="space-y-4">
        {stories.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
            <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-lg text-slate-500">No increment stories yet.</p>
            <p className="text-sm text-slate-400 mt-2">Your stories will appear here after each completed evaluation cycle.</p>
          </div>
        ) : (
          stories.map((story) => (
            <div key={story.cycleId} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col sm:flex-row relative hover:shadow-md transition-shadow">
              {/* Left Color Bar */}
              <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: story.tierColor }}></div>

              <div className="p-6 flex-1 pl-8">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-merit-navy">{story.cycleName}</h2>
                    <p className="text-sm text-slate-500 mt-1">
                      {format(story.cycleStartDate.toDate(), 'MMM d')} – {format(story.cycleEndDate.toDate(), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="mt-4 sm:mt-0 flex gap-2">
                    <span className="px-3 py-1 rounded-full text-sm font-bold" style={{backgroundColor: `${story.tierColor}20`, color: story.tierColor}}>
                      {story.tierName}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-6 mb-6">
                  <div>
                    <div className="text-sm text-slate-500 font-medium uppercase tracking-wider mb-1">Score</div>
                    <div className="text-3xl font-black text-slate-800">{story.score.toFixed(1)} <span className="text-sm font-medium text-slate-400">/ 100</span></div>
                  </div>
                  <div className="w-px h-10 bg-slate-200"></div>
                  <div>
                    <div className="text-sm text-slate-500 font-medium uppercase tracking-wider mb-1">Increment</div>
                    <div className="text-xl font-bold text-emerald-600">+{story.incrementPercent.toFixed(1)}%</div>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg flex flex-col sm:flex-row gap-4 justify-between items-center border border-slate-100">
                  <div className="flex-1 w-full space-y-2">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Top Criteria</div>
                    <div className="flex gap-4">
                      {story.scoreBreakdown.slice(0, 3).map(sb => (
                        <div key={sb.criteriaId} className="flex-1">
                          <div className="text-xs text-slate-600 truncate mb-1" title={sb.criteriaName}>{sb.criteriaName}</div>
                          <div className="w-full bg-slate-200 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full" style={{ width: `${sb.normalizedScore}%`, backgroundColor: getPerformanceColor(sb.performance) }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Link
                    to={`/increments/${story.cycleId}`}
                    className="whitespace-nowrap px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800 transition-colors w-full sm:w-auto text-center"
                  >
                    Read Full Story
                  </Link>
                </div>

              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
};

const getPerformanceColor = (perf: string) => {
  switch (perf) {
    case 'excellent': return '#3b82f6';
    case 'good': return '#10b981';
    case 'average': return '#f59e0b';
    case 'needs_improvement': return '#ef4444';
    default: return '#94a3b8';
  }
};

export default IncrementStoriesPage;