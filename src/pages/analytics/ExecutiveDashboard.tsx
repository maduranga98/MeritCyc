import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { analyticsService } from "../../services/analyticsService";
import { type CompanyKPIs, type IncrementTrendPoint } from "../../types/analytics";
import { Link } from "react-router-dom";
import {
  Users,
  RefreshCw,
  CheckCircle,
  DollarSign,
  TrendingUp,
  Scale,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Download,
  Loader2,
} from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  AreaChart,
  Area,
  ReferenceLine,
  BarChart,
} from "recharts";

export default function ExecutiveDashboard() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<CompanyKPIs | null>(null);
  const [trends, setTrends] = useState<IncrementTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("12m");

  useEffect(() => {
    if (user?.companyId) {
      fetchData();
    }
  }, [user, dateRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (!user?.companyId) return;
      const kpiData = await analyticsService.getCompanyKPIs(user.companyId, dateRange);
      setKpis(kpiData);

      const trendData = await analyticsService.getIncrementTrends(user.companyId, dateRange);
      setTrends(trendData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  // Mock data for charts
  const deptData = [
    { departmentName: "Engineering", averageScore: 82, averageIncrement: 12 },
    { departmentName: "Sales", averageScore: 75, averageIncrement: 10 },
    { departmentName: "Marketing", averageScore: 78, averageIncrement: 11 },
    { departmentName: "HR", averageScore: 80, averageIncrement: 9 },
    { departmentName: "Finance", averageScore: 85, averageIncrement: 10 },
  ];

  const yoyData = [
    { year: "2021", "Tier 1": 15, "Tier 2": 10, "Tier 3": 5 },
    { year: "2022", "Tier 1": 16, "Tier 2": 11, "Tier 3": 6 },
    { year: "2023", "Tier 1": 14, "Tier 2": 9, "Tier 3": 4 },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">Analytics Dashboard</h1>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="border-slate-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="12m">Last 12 months</option>
            <option value="6m">Last 6 months</option>
            <option value="ytd">This year</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* SECTION 1 - KPIs */}
      {kpis && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-slate-50 rounded-lg">
                <Users className="w-5 h-5 text-slate-500" />
              </div>
              <span className="flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                <ArrowUp className="w-3 h-3 mr-1" /> 5%
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Total Employees</p>
              <h3 className="text-2xl font-bold text-slate-900">{kpis.totalEmployees}</h3>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-slate-50 rounded-lg">
                <RefreshCw className="w-5 h-5 text-slate-500" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Active Cycles</p>
              <h3 className="text-2xl font-bold text-slate-900">{kpis.activeCycles}</h3>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-slate-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-slate-500" />
              </div>
              <span className="flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                <ArrowUp className="w-3 h-3 mr-1" /> 1
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Completed Cycles</p>
              <h3 className="text-2xl font-bold text-slate-900">{kpis.completedCycles}</h3>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Total Increments Awarded</p>
              <h3 className="text-2xl font-bold text-emerald-600">
                {kpis.currency} {kpis.totalSalaryIncrementsAwarded.toLocaleString()}
              </h3>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-blue-50 rounded-lg">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Average Increment</p>
              <h3 className="text-2xl font-bold text-blue-600">{kpis.averageIncrementPercent}%</h3>
            </div>
          </div>

          <Link to="/fairness" className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between hover:border-emerald-300 transition-colors group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition-colors">
                <Scale className="w-5 h-5 text-indigo-600" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1 flex items-center justify-between">
                Company Fairness Score
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-500" />
              </p>
              <h3 className={`text-2xl font-bold ${kpis.fairnessScore >= 75 ? 'text-emerald-600' : kpis.fairnessScore >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                {kpis.fairnessScore}/100
              </h3>
            </div>
          </Link>
        </div>
      )}

      {/* SECTION 2 - Increment Trends */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-6">Increment Trends Over Time</h2>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trends} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="cycleName" axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" domain={[0, 20]} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: '#f8fafc' }} />
              <Legend />
              <Bar yAxisId="right" dataKey="totalEmployees" name="Employees" fill="#E2E8F0" radius={[4,4,0,0]} barSize={40} />
              <Line yAxisId="left" type="monotone" dataKey="averageIncrement" name="Avg Increment %" stroke="#10B981" strokeWidth={3} dot={{ fill: '#10B981', r: 5, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SECTION 3 - Department Radar */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Department Performance</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={deptData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                <PolarGrid stroke="#E2E8F0" />
                <PolarAngleAxis dataKey="departmentName" tick={{ fill: '#64748B', fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Avg Score" dataKey="averageScore" stroke="#10B981" fill="#10B981" fillOpacity={0.15} />
                <Radar name="Avg Increment" dataKey="averageIncrement" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.1} />
                <Legend />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* SECTION 4 - YoY Comparison */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Year-over-Year Increment Analysis</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yoyData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="year" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip cursor={{ fill: '#f8fafc' }} />
                <Legend />
                <Bar dataKey="Tier 1" fill="#10B981" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Tier 2" fill="#3B82F6" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Tier 3" fill="#F59E0B" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* SECTION 5 - Top Performers */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Top Performance Departments</h2>
              <div className="space-y-3">
                  {[deptData[4], deptData[0], deptData[3]].map((dept, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="font-medium text-slate-900">{dept.departmentName}</span>
                          <div className="flex items-center gap-3">
                              <span className="text-sm font-bold text-slate-700">{dept.averageScore}</span>
                              <ArrowUp className="w-4 h-4 text-emerald-500" />
                          </div>
                      </div>
                  ))}
              </div>
          </div>
          {/* Bottom Performers */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Areas for Improvement</h2>
              <div className="space-y-3">
                  {[deptData[1], deptData[2]].map((dept, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="font-medium text-slate-900">{dept.departmentName}</span>
                          <div className="flex items-center gap-3">
                              <span className="text-sm font-bold text-slate-700">{dept.averageScore}</span>
                              <ArrowDown className="w-4 h-4 text-red-500" />
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      </div>

      {/* SECTION 6 - Budget Utilization */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-6">Budget Utilization Summary</h2>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorBudget" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="cycleName" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} domain={[0, 110]} tickFormatter={(v) => `${v}%`} />
              <Tooltip />
              <ReferenceLine y={100} stroke="#EF4444" strokeDasharray="3 3" label={{ position: 'top', value: 'Budget Limit', fill: '#EF4444', fontSize: 10 }} />
              <Area type="monotone" dataKey="budgetUtilization" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorBudget)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}