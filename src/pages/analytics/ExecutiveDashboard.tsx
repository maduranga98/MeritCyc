import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { analyticsService } from "../../services/analyticsService";
import { type CompanyKPIs, type IncrementTrendPoint, type DepartmentPerformance, type YoYTierData } from "../../types/analytics";
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
  const [deptData, setDeptData] = useState<DepartmentPerformance[]>([]);
  const [yoyData, setYoyData] = useState<YoYTierData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("12m");
  const [selectedDept, setSelectedDept] = useState<DepartmentPerformance | null>(null);

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

      const deptData = await analyticsService.getDepartmentPerformance(user.companyId);
      setDeptData(deptData);

      const yoyData = await analyticsService.getYoYComparison(user.companyId);
      setYoyData(yoyData);
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
          <h2 className="text-lg font-bold text-slate-900 mb-2">Department Performance</h2>
          <p className="text-sm text-slate-500 mb-6">Click on a department to view details</p>
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
          <div className="mt-6 space-y-2">
            {deptData.map((dept) => (
              <button
                key={dept.departmentId}
                onClick={() => setSelectedDept(dept)}
                className="w-full p-3 text-left rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
              >
                <p className="font-medium text-slate-900">{dept.departmentName}</p>
                <p className="text-xs text-slate-500">{dept.employeeCount} employees | Avg: {dept.averageScore}/100</p>
              </button>
            ))}
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

      {/* Department Drill-Down Modal */}
      {selectedDept && (
        <>
          <div
            className="fixed inset-0 bg-slate-900/60 z-40 transition-opacity"
            onClick={() => setSelectedDept(null)}
          />
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-lg max-w-2xl w-full">
              <div className="p-6 border-b border-slate-200 flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{selectedDept.departmentName}</h2>
                  <p className="text-sm text-slate-500 mt-1">{selectedDept.employeeCount} employees</p>
                </div>
                <button
                  onClick={() => setSelectedDept(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                    <p className="text-xs text-emerald-600 font-medium uppercase">Average Score</p>
                    <p className="text-3xl font-bold text-emerald-700 mt-2">{selectedDept.averageScore}/100</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <p className="text-xs text-blue-600 font-medium uppercase">Average Increment</p>
                    <p className="text-3xl font-bold text-blue-700 mt-2">{selectedDept.averageIncrement}%</p>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-slate-900 mb-3">Performance Metrics</p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Relative to Company Average</span>
                      <span className="text-sm font-bold text-slate-900">
                        {selectedDept.averageScore >= 75 ? '+' : ''}{selectedDept.averageScore - 75}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-emerald-500 h-2 rounded-full"
                        style={{
                          width: `${Math.min(100, (selectedDept.averageScore / 100) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
                <button
                  onClick={() => setSelectedDept(null)}
                  className="px-4 py-2 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
}