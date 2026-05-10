import React from "react";
import { type FairnessReport } from "../../types/fairness";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, ShieldCheck, AlertCircle } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

interface PayEquityReportProps {
  report: FairnessReport;
  onClose: () => void;
}

export const PayEquityReport: React.FC<PayEquityReportProps> = ({ report, onClose }) => {
  const handleDownloadPdf = () => {
    // In a real app, this would use jsPDF and html2canvas to capture the modal content
    alert("PDF generation would start here using jsPDF + html2canvas");
  };

  const totalEmployeesAnalyzed = report.metrics.departmentDisparity.reduce((sum, d) => sum + d.employeeCount, 0);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 sm:p-6"
      >
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          className="bg-slate-50 w-full max-w-5xl max-h-full rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Pay Equity Report</h2>
                <p className="text-sm text-slate-500">Comprehensive fairness and compliance analysis</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleDownloadPdf}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6" id="pay-equity-report-content">

            {/* 1. Executive Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200">
                <p className="text-sm font-medium text-slate-500 mb-1">Overall Fairness Score</p>
                <p className={`text-3xl font-bold ${report.overallFairnessScore >= 75 ? 'text-emerald-600' : report.overallFairnessScore >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                  {report.overallFairnessScore}/100
                </p>
              </div>
              <div className="bg-white p-5 rounded-xl border border-slate-200">
                <p className="text-sm font-medium text-slate-500 mb-1">Employees Analyzed</p>
                <p className="text-3xl font-bold text-slate-900">{totalEmployeesAnalyzed}</p>
              </div>
              <div className="bg-white p-5 rounded-xl border border-slate-200">
                <p className="text-sm font-medium text-slate-500 mb-1">Cycles Analyzed</p>
                <p className="text-3xl font-bold text-slate-900">{report.cycleId ? '1' : 'All'}</p>
              </div>
              <div className="bg-white p-5 rounded-xl border border-slate-200">
                <p className="text-sm font-medium text-slate-500 mb-1">Report Date</p>
                <p className="text-xl font-bold text-slate-900 mt-2">
                  {report.generatedAt
                    ? new Date(report.generatedAt.toMillis()).toLocaleDateString()
                    : "—"}
                </p>
              </div>
            </div>

            {/* 4. Flagged Discrepancies */}
            {report.alerts.length > 0 && (
              <div className="bg-white rounded-xl border border-red-200 p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  Flagged Discrepancies
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {report.alerts.map(alert => (
                    <div key={alert.id} className="p-4 bg-red-50 border border-red-100 rounded-lg">
                      <p className="font-bold text-red-800 mb-1">{alert.type.replace('_', ' ').toUpperCase()}</p>
                      <p className="text-sm text-red-700">{alert.message}</p>
                      <p className="text-xs text-red-600 mt-2 font-medium">Affected: {alert.affectedEntity}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Department Pay Analysis */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Department Pay Analysis</h3>
              <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                 <thead className="text-xs text-slate-500 bg-slate-50 uppercase">
                   <tr>
                     <th className="px-4 py-3 rounded-tl-lg">Department</th>
                     <th className="px-4 py-3">Employees</th>
                     <th className="px-4 py-3">Avg Score</th>
                     <th className="px-4 py-3">Avg Increment</th>
                     <th className="px-4 py-3 rounded-tr-lg">vs Company Avg</th>
                   </tr>
                 </thead>
                 <tbody>
                   {report.metrics.departmentDisparity.map((dept, idx) => (
                       <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                         <td className="px-4 py-3 font-medium text-slate-900">{dept.departmentName}</td>
                         <td className="px-4 py-3 text-slate-600">{dept.employeeCount}</td>
                         <td className="px-4 py-3 text-slate-600">{dept.averageScore.toFixed(1)}</td>
                         <td className="px-4 py-3 text-slate-600">{dept.averageIncrement.toFixed(1)}%</td>
                         <td className={`px-4 py-3 font-medium ${dept.disparity > 0 ? 'text-emerald-600' : dept.disparity < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                           {dept.disparity > 0 ? '+' : ''}{dept.disparity.toFixed(1)}%
                         </td>
                       </tr>
                   ))}
                 </tbody>
               </table>
              </div>
            </div>

            {/* 3. Band Progression Analysis */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Band Progression Analysis</h3>
              <p className="text-sm text-slate-500 mb-6">Analyzing if higher bands are receiving proportionally higher increments.</p>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[...report.metrics.bandDistribution].sort((a,b) => a.bandLevel - b.bandLevel)} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="bandName" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                    <Tooltip cursor={{ stroke: '#f1f5f9', strokeWidth: 2 }} />
                    <Legend />
                    <Line type="monotone" dataKey="averageIncrement" name="Avg Increment %" stroke="#3B82F6" strokeWidth={3} dot={{ r: 6, fill: '#3B82F6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 5. Compliance Statement */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 text-center">
              <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-900 mb-2">Compliance Statement</h3>
              <p className="text-slate-600 max-w-3xl mx-auto leading-relaxed">
                Based on {totalEmployeesAnalyzed} evaluated employees across {report.metrics.departmentDisparity.length} departments
                in {report.cycleId ? 'the selected increment cycle' : 'all completed increment cycles'}, MeritCyc's analysis indicates
                that the current compensation adjustment process yields an overall fairness score of {report.overallFairnessScore}/100.
                {report.alerts.length > 0 ? ` Note that ${report.alerts.length} areas of concern have been flagged and require review.` : ' No significant discrepancies were identified.'}
              </p>
              <p className="text-xs text-slate-400 mt-6 uppercase tracking-widest font-bold">Generated by MeritCyc Intelligence Engine</p>
            </div>

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
