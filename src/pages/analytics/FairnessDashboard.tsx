import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { fairnessService } from "../../services/fairnessService";
import { type FairnessReport } from "../../types/fairness";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../../config/firebase";
import {
  RadialBarChart,
  RadialBar,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ScatterChart,
  Scatter,
  ResponsiveContainer,
} from "recharts";
import { PayEquityReport } from "../../components/analytics/PayEquityReport";
import {
  AlertTriangle,
  Info,
  CheckCircle,
  FileText,
  Download,
  Loader2,
  AlertCircle,
  Scale,
} from "lucide-react";
import { toast } from "sonner";

export default function FairnessDashboard() {
  const { user } = useAuth();
  const [report, setReport] = useState<FairnessReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showPayEquityModal, setShowPayEquityModal] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState<string>("all");
  const [cycles, setCycles] = useState<{ id: string; name: string }[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  useEffect(() => {
    if (user?.companyId) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (!user?.companyId) return;

      const latestReport = await fairnessService.getLatestFairnessReport(user.companyId);
      setReport(latestReport);

      const cyclesSnap = await getDocs(
        query(collection(db, "cycles"), where("companyId", "==", user.companyId), where("status", "==", "completed"))
      );
      const cyclesData = cyclesSnap.docs
        .map(d => ({ id: d.id, name: d.data().name }));
      setCycles(cyclesData);

      const logsSnap = await getDocs(
        query(collection(db, "auditLogs"), where("companyId", "==", user.companyId), orderBy("timestamp", "desc"), limit(20))
      );
      setAuditLogs(logsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error(error);
      toast.error("Failed to load fairness data");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      const res = await fairnessService.generateReport(selectedCycle === "all" ? undefined : selectedCycle);
      if (res.success) {
        toast.success("Fairness report generated successfully");
        fetchData();
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  const handleExportPdf = () => {
    setShowPayEquityModal(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  const scoreColor = (score: number) => {
    if (score >= 75) return "text-emerald-600 bg-emerald-50 border-emerald-200 fill-emerald-500";
    if (score >= 60) return "text-amber-600 bg-amber-50 border-amber-200 fill-amber-500";
    return "text-red-600 bg-red-50 border-red-200 fill-red-500";
  };

  const scoreChartColor = (score: number) => {
    if (score >= 75) return "#10B981";
    if (score >= 60) return "#F59E0B";
    return "#EF4444";
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fairness & Compliance</h1>
          <p className="text-slate-500">
            {report ? `Last generated: ${new Date(report.generatedAt?.toMillis() || Date.now()).toLocaleString()}` : "No report generated yet"}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedCycle}
            onChange={(e) => setSelectedCycle(e.target.value)}
            className="border-slate-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="all">All Cycles</option>
            {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button
            onClick={handleGenerateReport}
            disabled={generating}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Generate Report
          </button>
          <button
            onClick={handleExportPdf}
            disabled={!report}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>

      {!report ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center">
          <Scale className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-700 mb-2">No Fairness Report Found</h2>
          <p className="text-slate-500 mb-6">Generate your first fairness report to analyze pay equity and scoring consistency.</p>
          <button
            onClick={handleGenerateReport}
            disabled={generating}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
             {generating ? "Generating..." : "Generate Report"}
          </button>
        </div>
      ) : (
        <>
          {/* SECTION 1 - Overall Score */}
          <div className="bg-white rounded-xl border border-slate-200 p-8 flex flex-col items-center justify-center text-center">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Company Fairness Score</h2>
            <div className="w-64 h-64 relative">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius="80%"
                  outerRadius="100%"
                  barSize={20}
                  data={[{ name: "Score", value: report.overallFairnessScore, fill: scoreChartColor(report.overallFairnessScore) }]}
                  startAngle={180}
                  endAngle={0}
                >
                  <RadialBar background dataKey="value" cornerRadius={10} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center mt-8">
                <span className={`text-5xl font-bold ${scoreColor(report.overallFairnessScore).split(' ')[0]}`}>
                  {report.overallFairnessScore}
                </span>
                <span className="text-slate-500 font-medium">/ 100</span>
              </div>
            </div>
            <p className="mt-4 text-lg font-medium text-slate-700">
              {report.overallFairnessScore >= 75 && "Your increment process meets fairness standards"}
              {report.overallFairnessScore >= 60 && report.overallFairnessScore < 75 && "Some areas need attention"}
              {report.overallFairnessScore < 60 && "Significant fairness issues detected — action required"}
            </p>
          </div>

          {/* SECTION 2 - Alerts */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Fairness Alerts</h2>
            {report.alerts.length === 0 ? (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-lg flex items-center gap-3">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">No fairness issues detected ✓</span>
              </div>
            ) : (
              <div className="space-y-3">
                {report.alerts.map((alert, idx) => {
                  let alertStyle = "border-l-4 border-blue-500 bg-blue-50 text-blue-800";
                  let Icon = Info;
                  if (alert.severity === "critical") {
                    alertStyle = "border-l-4 border-red-500 bg-red-50 text-red-800";
                    Icon = AlertCircle;
                  } else if (alert.severity === "warning") {
                    alertStyle = "border-l-4 border-amber-500 bg-amber-50 text-amber-800";
                    Icon = AlertTriangle;
                  }

                  return (
                    <div key={idx} className={`p-4 rounded-r-lg flex items-start gap-3 ${alertStyle}`}>
                      <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold capitalize">{alert.severity}</span>
                          <span className="text-xs opacity-75 uppercase tracking-wider">• {alert.type.replace('_', ' ')}</span>
                        </div>
                        <p className="text-sm mb-1">{alert.message}</p>
                        <p className="text-xs font-medium opacity-75">
                          Affected: {alert.affectedEntity} ({alert.value})
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 3 - Department Disparity */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
             <h2 className="text-lg font-bold text-slate-900 mb-6">Increment Distribution by Department</h2>
             <div className="h-[300px] mb-8">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={report.metrics.departmentDisparity} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                   <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                   <XAxis dataKey="departmentName" axisLine={false} tickLine={false} />
                   <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                   <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                   <ReferenceLine y={report.metrics.departmentDisparity.reduce((sum, d) => sum + d.averageIncrement, 0) / (report.metrics.departmentDisparity.length || 1)} stroke="#94a3b8" strokeDasharray="3 3" label="Avg" />
                   <Bar dataKey="averageIncrement" radius={[4, 4, 0, 0]}>
                      {
                        // @ts-ignore
                        report.metrics.departmentDisparity.map((entry, index) => {
                        const deviation = Math.abs(entry.disparity);
                        let fill = '#10B981';
                        if (deviation > 15) fill = '#EF4444';
                        else if (deviation > 5) fill = '#F59E0B';
                        return <Cell key={`cell-${index}`} fill={fill} />;
                      })}
                   </Bar>
                 </BarChart>
               </ResponsiveContainer>
             </div>

             <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                 <thead className="text-xs text-slate-500 bg-slate-50 uppercase">
                   <tr>
                     <th className="px-4 py-3 rounded-tl-lg">Department</th>
                     <th className="px-4 py-3">Employees</th>
                     <th className="px-4 py-3">Avg Score</th>
                     <th className="px-4 py-3">Avg Increment</th>
                     <th className="px-4 py-3">Deviation</th>
                     <th className="px-4 py-3 rounded-tr-lg">Status</th>
                   </tr>
                 </thead>
                 <tbody>
                   {report.metrics.departmentDisparity.map((dept, idx) => {
                      const deviation = Math.abs(dept.disparity);
                      let status = "Healthy";
                      let statusColor = "text-emerald-600 bg-emerald-50";
                      if (deviation > 15) { status = "Critical"; statusColor = "text-red-600 bg-red-50"; }
                      else if (deviation > 5) { status = "Warning"; statusColor = "text-amber-600 bg-amber-50"; }

                      return (
                       <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                         <td className="px-4 py-3 font-medium text-slate-900">{dept.departmentName}</td>
                         <td className="px-4 py-3 text-slate-600">{dept.employeeCount}</td>
                         <td className="px-4 py-3 text-slate-600">{dept.averageScore.toFixed(1)}</td>
                         <td className="px-4 py-3 text-slate-600">{dept.averageIncrement.toFixed(1)}%</td>
                         <td className="px-4 py-3 text-slate-600">{dept.disparity > 0 ? '+' : ''}{dept.disparity.toFixed(1)}</td>
                         <td className="px-4 py-3">
                           <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                             {status}
                           </span>
                         </td>
                       </tr>
                     );
                   })}
                 </tbody>
               </table>
             </div>
          </div>

          {/* SECTION 4 - Manager Consistency Analysis */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-slate-900">Manager Scoring Consistency</h2>
              <p className="text-sm text-slate-500">Measures how consistently each manager applies scoring criteria</p>
            </div>

            <div className="overflow-x-auto mb-8">
               <table className="w-full text-sm text-left">
                 <thead className="text-xs text-slate-500 bg-slate-50 uppercase">
                   <tr>
                     <th className="px-4 py-3 rounded-tl-lg">Manager</th>
                     <th className="px-4 py-3">Employees Evaluated</th>
                     <th className="px-4 py-3">Avg Score</th>
                     <th className="px-4 py-3">Score Variance</th>
                     <th className="px-4 py-3">Outliers</th>
                     <th className="px-4 py-3 rounded-tr-lg">Consistency Score</th>
                   </tr>
                 </thead>
                 <tbody>
                   {report.metrics.managerConsistency.filter(m => m.employeesEvaluated >= 3).map((mgr, idx) => {
                      let consistencyColor = "text-emerald-600 bg-emerald-50";
                      if (mgr.consistencyScore < 60) consistencyColor = "text-red-600 bg-red-50";
                      else if (mgr.consistencyScore < 80) consistencyColor = "text-amber-600 bg-amber-50";

                      return (
                       <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                         <td className="px-4 py-3 font-medium text-slate-900">{mgr.managerName}</td>
                         <td className="px-4 py-3 text-slate-600">{mgr.employeesEvaluated}</td>
                         <td className="px-4 py-3 text-slate-600">{mgr.averageScore.toFixed(1)}</td>
                         <td className="px-4 py-3 text-slate-600">{mgr.scoreVariance.toFixed(1)}</td>
                         <td className="px-4 py-3">
                            {mgr.outlierCount > 0 ? (
                               <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-bold">{mgr.outlierCount}</span>
                            ) : (
                               <span className="text-slate-400">0</span>
                            )}
                         </td>
                         <td className="px-4 py-3">
                           <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${consistencyColor}`}>
                             {mgr.consistencyScore.toFixed(0)}
                           </span>
                         </td>
                       </tr>
                     );
                   })}
                   {report.metrics.managerConsistency.filter(m => m.employeesEvaluated >= 3).length === 0 && (
                       <tr>
                           <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                               Not enough data. Managers must evaluate at least 3 employees to appear here.
                           </td>
                       </tr>
                   )}
                 </tbody>
               </table>
            </div>

            {report.metrics.managerConsistency.filter(m => m.employeesEvaluated >= 3).length > 0 && (
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="managerName" type="category" name="Manager" axisLine={false} tickLine={false} />
                            <YAxis dataKey="score" type="number" domain={[0, 100]} name="Score" axisLine={false} tickLine={false} />
                            <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(value, _name, props) => [value, props.payload.employeeName || 'Employee']} />
                            <Scatter
                                data={report.metrics.managerConsistency.filter(m => m.employeesEvaluated >= 3).flatMap(m => (m.individualScores || []).map(s => ({ managerName: m.managerName, score: s.score, employeeName: s.name })))}
                                fill="#10B981"
                                opacity={0.7}
                            />
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
            )}
          </div>

          {/* SECTION 5 - Band Distribution */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-6">Performance by Salary Band</h2>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.metrics.bandDistribution} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="bandName" axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" orientation="left" stroke="#10B981" axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" stroke="#3B82F6" axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="averageScore" name="Avg Score" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="averageIncrement" name="Avg Increment %" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* SECTION 6 - Criteria Stability */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col md:flex-row items-center gap-8">
             <div className="flex-1">
                 <h2 className="text-lg font-bold text-slate-900 mb-2">Criteria Lock Compliance</h2>
                 <p className="text-sm text-slate-500 mb-4">Stable evaluation criteria are essential for long-term fairness and tracking.</p>
                 <div className="space-y-3">
                     <div className="flex justify-between items-center py-2 border-b border-slate-100">
                         <span className="text-slate-600 text-sm">Cycles with locked criteria</span>
                         <span className="font-bold text-slate-900">{report.metrics.criteriaStability.cyclesWithLockedCriteria}</span>
                     </div>
                     <div className="flex justify-between items-center py-2 border-b border-slate-100">
                         <span className="text-slate-600 text-sm">Cycles with changes</span>
                         <span className="font-bold text-slate-900">{report.metrics.criteriaStability.cyclesWithChanges}</span>
                     </div>
                     <div className="flex justify-between items-center py-2">
                         <span className="text-slate-600 text-sm">Last criteria change</span>
                         <span className="font-medium text-slate-900 text-sm">
                             {report.metrics.criteriaStability.lastCriteriaChange ? new Date(report.metrics.criteriaStability.lastCriteriaChange.toMillis()).toLocaleDateString() : "No changes detected"}
                         </span>
                     </div>
                 </div>
             </div>
             <div className="w-48 h-48 flex-shrink-0 relative">
                 <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" barSize={15} data={[{ value: report.metrics.criteriaStability.stabilityScore, fill: '#3B82F6' }]} startAngle={180} endAngle={0}>
                        <RadialBar background dataKey="value" cornerRadius={10} />
                    </RadialBarChart>
                 </ResponsiveContainer>
                 <div className="absolute inset-0 flex flex-col items-center justify-center mt-6">
                     <span className="text-3xl font-bold text-blue-600">{report.metrics.criteriaStability.stabilityScore}</span>
                     <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Stability</span>
                 </div>
             </div>
          </div>

          {/* SECTION 7 - Audit Trail */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
             <div className="flex justify-between items-center mb-6">
                 <h2 className="text-lg font-bold text-slate-900">Recent Actions</h2>
                 <button className="text-sm text-emerald-600 font-medium hover:text-emerald-700">Export Audit Log</button>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                 <thead className="text-xs text-slate-500 bg-slate-50 uppercase">
                   <tr>
                     <th className="px-4 py-3 rounded-tl-lg">Timestamp</th>
                     <th className="px-4 py-3">Actor</th>
                     <th className="px-4 py-3">Action</th>
                     <th className="px-4 py-3">Target</th>
                     <th className="px-4 py-3 rounded-tr-lg">Details</th>
                   </tr>
                 </thead>
                 <tbody>
                   {auditLogs.map((log) => (
                     <tr key={log.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                       <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                         {log.timestamp ? new Date(log.timestamp.toMillis ? log.timestamp.toMillis() : log.timestamp).toLocaleString() : 'N/A'}
                       </td>
                       <td className="px-4 py-3">
                         <div className="font-medium text-slate-900">{log.actorEmail}</div>
                         <div className="text-xs text-slate-500">{log.actorRole}</div>
                       </td>
                       <td className="px-4 py-3">
                         <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
                           {log.action}
                         </span>
                       </td>
                       <td className="px-4 py-3 text-slate-600">
                         <span className="capitalize">{log.targetType}</span>
                         <div className="text-xs text-slate-400 truncate w-32">{log.targetId}</div>
                       </td>
                       <td className="px-4 py-3 text-slate-600">
                         <button className="text-emerald-600 hover:underline">View details</button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </div>
        </>
      )}

      {/* Pay Equity Report Modal */}
      {showPayEquityModal && report && (
        <PayEquityReport
          report={report}
          onClose={() => setShowPayEquityModal(false)}
        />
      )}
    </div>
  );
}