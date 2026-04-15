import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { analyticsService } from "../../services/analyticsService";
import { pdfGenerationService } from "../../services/pdfGenerationService";
import { type GeneratedReport, type ReportType } from "../../types/analytics";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../config/firebase";
import { type Cycle } from "../../types/cycle";
import { type Evaluation } from "../../types/evaluation";
import {
  FileText,
  BarChart2,
  Layers,
  Scale,
  Shield,
  Download,
  Loader2,
  FileSpreadsheet
} from "lucide-react";
import { toast } from "sonner";

const reportTypes = [
  {
    id: "cycle_summary" as ReportType,
    title: "Cycle Summary Report",
    description: "Complete breakdown of a single increment cycle",
    icon: FileText
  },
  {
    id: "annual_summary" as ReportType,
    title: "Annual Summary Report",
    description: "Company-wide increment analysis for a full year",
    icon: BarChart2
  },
  {
    id: "department_comparison" as ReportType,
    title: "Department Comparison Report",
    description: "Side-by-side comparison of department performance",
    icon: Layers
  },
  {
    id: "fairness_equity" as ReportType,
    title: "Fairness & Equity Report",
    description: "Pay equity analysis and compliance report",
    icon: Scale
  },
  {
    id: "audit_trail" as ReportType,
    title: "Audit Trail Export",
    description: "Full audit log of all system actions",
    icon: Shield
  }
];

export default function ReportsGenerator() {
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState<ReportType>("cycle_summary");
  const [generating, setGenerating] = useState(false);
  const [recentReports, setRecentReports] = useState<GeneratedReport[]>([]);
  const [cycles, setCycles] = useState<{ id: string; name: string }[]>([]);

  // Form states
  const [selectedCycle, setSelectedCycle] = useState("");
  const [format, setFormat] = useState<"pdf" | "csv">("pdf");
  const [generatedPreview, setGeneratedPreview] = useState<GeneratedReport | null>(null);

  useEffect(() => {
    if (user?.companyId) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      if (!user?.companyId) return;
      const reports = await analyticsService.getGeneratedReports(user.companyId);
      setRecentReports(reports);

      const cyclesSnap = await getDocs(query(collection(db, "cycles"), where("companyId", "==", user.companyId), where("status", "==", "completed")));
      const cyclesData = cyclesSnap.docs
        .map(d => ({ id: d.id, name: d.data().name }));
      setCycles(cyclesData);
      if (cyclesData.length > 0 && !selectedCycle) {
          setSelectedCycle(cyclesData[0].id);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGeneratedPreview(null);
    try {
      if (selectedType === 'fairness_equity') {
         toast.info("Generating fairness report. Please wait...");
      } else if (selectedType === 'cycle_summary' && !selectedCycle) {
         toast.error("Please select a cycle.");
         return;
      }

      // Handle cycle summary PDF generation
      if (selectedType === 'cycle_summary' && format === 'pdf') {
        const cycleSnap = await getDocs(query(collection(db, "cycles"), where('id', '==', selectedCycle)));
        const cycleDoc = cycleSnap.docs[0];
        if (!cycleDoc) {
          toast.error("Cycle not found.");
          return;
        }
        const cycle = { id: cycleDoc.id, ...cycleDoc.data() } as Cycle;

        const evalsSnap = await getDocs(query(collection(db, "evaluations"), where('cycleId', '==', selectedCycle)));
        const evaluations = evalsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Evaluation[];

        // Calculate department breakdown
        const deptMap = new Map<string, { employees: number; totalScore: number }>();
        evaluations.forEach(eval_ => {
          const deptId = eval_.departmentId || 'unknown';
          if (!deptMap.has(deptId)) {
            deptMap.set(deptId, { employees: 0, totalScore: 0 });
          }
          const dept = deptMap.get(deptId)!;
          dept.employees++;
          dept.totalScore += eval_.weightedTotalScore || 0;
        });

        const departmentBreakdown = Array.from(deptMap.entries()).map(([deptId, data]) => ({
          departmentName: deptId === 'unknown' ? 'Unknown Department' : deptId,
          averageScore: data.totalScore / data.employees,
          employeeCount: data.employees,
        }));

        // Calculate tier distribution
        const tierCounts = new Map<string, number>();
        evaluations.forEach(eval_ => {
          const tierId = eval_.assignedTierId || 'unassigned';
          tierCounts.set(tierId, (tierCounts.get(tierId) || 0) + 1);
        });

        const tierDistribution = Array.from(tierCounts.entries()).map(([tierId, count]) => {
          const tierConfig = cycle.tiers.find(t => t.id === tierId);
          const eval_ = evaluations.find(e => e.assignedTierId === tierId);
          return {
            tierName: tierConfig?.name || eval_?.assignedTierName || 'Unassigned',
            count,
            percentage: (count / evaluations.length) * 100,
          };
        });

        // Calculate budget metrics
        const totalBudgetUtilized = evaluations.reduce((sum, e) => {
          const baseSalary = e.currentSalary || 50000;
          const increment = (e.incrementPercent || 0) / 100;
          return sum + (baseSalary * increment);
        }, 0);

        const totalBudgetAllocated = cycle.budget.type === 'fixed_pool' ? (cycle.budget.totalBudget || 0) : 1000000; // mock

        pdfGenerationService.generateCycleSummaryPDF({
          cycle,
          evaluations,
          companyName: 'Company',
          currency: cycle.budget.currency,
          departmentBreakdown,
          tierDistribution,
          totalBudgetUtilized,
          totalBudgetAllocated,
        });

        toast.success("PDF report downloaded successfully!");
        const newReport: GeneratedReport = {
          id: selectedCycle,
          companyId: user?.companyId || "",
          reportType: selectedType,
          parameters: { cycleId: selectedCycle },
          format: 'pdf',
          generatedAt: { toMillis: () => Date.now() } as any,
          generatedBy: user?.uid || "",
          fileSizeBytes: Math.floor(Math.random() * 5000000) + 1000000,
        };
        setGeneratedPreview(newReport);
        fetchData();
        return;
      }

      const res = await analyticsService.generateReport({
          reportType: selectedType,
          cycleId: selectedCycle,
          format
      });

      if (res.success) {
          toast.success("Report generated successfully!");
          const newReport: GeneratedReport = {
              id: res.reportId || "temp-id",
              companyId: user?.companyId || "",
              reportType: selectedType,
              parameters: { cycleId: selectedCycle },
              format,
              generatedAt: { toMillis: () => Date.now() } as any,
              generatedBy: user?.uid || "",
              fileSizeBytes: Math.floor(Math.random() * 5000000) + 1000000 // mock size
          };
          setGeneratedPreview(newReport);
          fetchData();
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate report.");
    } finally {
      setGenerating(false);
    }
  };

  const renderConfigForm = () => {
    switch (selectedType) {
      case "cycle_summary":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Select Cycle</label>
              <select
                value={selectedCycle}
                onChange={(e) => setSelectedCycle(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
              >
                {cycles.length === 0 && <option value="">No completed cycles available</option>}
                {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Include Sections</label>
              <div className="space-y-2">
                {['Score Distribution', 'Department Breakdown', 'Budget Summary', 'Tier Analysis'].map(sec => (
                  <label key={sec} className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked className="rounded text-emerald-600 focus:ring-emerald-500" />
                    <span className="text-sm text-slate-600">{sec}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
               <label className="block text-sm font-medium text-slate-700 mb-1">Format</label>
               <div className="flex gap-4">
                   <label className="flex items-center gap-2">
                       <input type="radio" name="format" value="pdf" checked={format === 'pdf'} onChange={() => setFormat('pdf')} className="text-emerald-600 focus:ring-emerald-500" />
                       <span className="text-sm">PDF Document</span>
                   </label>
                   <label className="flex items-center gap-2">
                       <input type="radio" name="format" value="csv" checked={format === 'csv'} onChange={() => setFormat('csv')} className="text-emerald-600 focus:ring-emerald-500" />
                       <span className="text-sm">CSV Data</span>
                   </label>
               </div>
            </div>
          </div>
        );
      case "annual_summary":
        return (
            <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Select Year</label>
              <select className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500">
                <option>2024</option>
                <option>2023</option>
              </select>
            </div>
            <div>
               <label className="block text-sm font-medium text-slate-700 mb-1">Format</label>
               <div className="flex gap-4">
                   <label className="flex items-center gap-2">
                       <input type="radio" name="format2" value="pdf" checked={format === 'pdf'} onChange={() => setFormat('pdf')} className="text-emerald-600" />
                       <span className="text-sm">PDF Document</span>
                   </label>
                   <label className="flex items-center gap-2">
                       <input type="radio" name="format2" value="csv" checked={format === 'csv'} onChange={() => setFormat('csv')} className="text-emerald-600" />
                       <span className="text-sm">CSV Data</span>
                   </label>
               </div>
            </div>
          </div>
        );
      case "fairness_equity":
          return (
            <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Select Scope</label>
                  <select className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500">
                    <option value="all">All Cycles</option>
                    {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex items-start gap-2">
                    <Scale className="w-4 h-4 text-blue-600 mt-0.5" />
                    <p className="text-xs text-blue-800">Fairness reports are only available in PDF format to ensure compliance standards are met.</p>
                </div>
            </div>
          );
      case "audit_trail":
          return (
             <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                        <input type="date" className="w-full border border-slate-300 rounded-lg p-2 text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                        <input type="date" className="w-full border border-slate-300 rounded-lg p-2 text-sm" />
                    </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg flex items-start gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-slate-500 mt-0.5" />
                    <p className="text-xs text-slate-600">Audit logs are exported as raw CSV data for integration with compliance tools.</p>
                </div>
             </div>
          );
      default:
        return <p className="text-sm text-slate-500">Select parameters for this report type.</p>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">Reports Generator</h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Panel - Report Types */}
        <div className="w-full lg:w-80 flex-shrink-0 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Report Types</h2>
          {reportTypes.map((type) => {
            const Icon = type.icon;
            const isSelected = selectedType === type.id;
            return (
              <button
                key={type.id}
                onClick={() => {
                    setSelectedType(type.id);
                    if (type.id === 'fairness_equity') setFormat('pdf');
                    if (type.id === 'audit_trail') setFormat('csv');
                }}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  isSelected
                    ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-3 mb-1">
                  <Icon className={`w-5 h-5 ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <h3 className={`font-bold ${isSelected ? 'text-emerald-800' : 'text-slate-700'}`}>{type.title}</h3>
                </div>
                <p className={`text-xs ml-8 ${isSelected ? 'text-emerald-600/80' : 'text-slate-500'}`}>{type.description}</p>
              </button>
            );
          })}
        </div>

        {/* Right Panel - Configuration */}
        <div className="flex-1 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4">Configuration</h2>

            {renderConfigForm()}

            <div className="mt-8 pt-6 border-t border-slate-100">
               <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
               >
                  {generating ? (
                      <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Generating report...
                      </>
                  ) : (
                      "Generate Report"
                  )}
               </button>
               {selectedType === 'audit_trail' || selectedType === 'fairness_equity' ? null : (
                   <p className="text-xs text-center text-slate-500 mt-3">Large datasets may take up to 30 seconds to process.</p>
               )}
            </div>
          </div>

          {/* Generated Preview Card */}
          {generatedPreview && (
              <div className="bg-white rounded-xl border border-emerald-200 shadow-sm p-6 flex items-start gap-4 animate-in fade-in slide-in-from-bottom-4">
                  <div className="p-3 bg-emerald-100 rounded-xl">
                      {generatedPreview.format === 'pdf' ? <FileText className="w-8 h-8 text-emerald-600" /> : <FileSpreadsheet className="w-8 h-8 text-emerald-600" />}
                  </div>
                  <div className="flex-1">
                      <h3 className="text-lg font-bold text-slate-900">{reportTypes.find(t => t.id === generatedPreview.reportType)?.title}</h3>
                      <p className="text-sm text-slate-500 mb-4">
                          Generated on {new Date(generatedPreview.generatedAt.toMillis()).toLocaleString()} • ~{(generatedPreview.fileSizeBytes! / 1024 / 1024).toFixed(1)} MB
                      </p>
                      <div className="flex items-center gap-3">
                          <button className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 font-bold rounded-lg hover:bg-emerald-100 transition-colors">
                              <Download className="w-4 h-4" />
                              Download {generatedPreview.format.toUpperCase()}
                          </button>
                          <button onClick={() => setGeneratedPreview(null)} className="text-sm font-medium text-slate-500 hover:text-slate-700">
                              Generate Another
                          </button>
                      </div>
                  </div>
              </div>
          )}
        </div>
      </div>

      {/* Recent Reports List */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Recent Reports</h2>
          {recentReports.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No reports generated yet.</p>
          ) : (
              <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                 <thead className="text-xs text-slate-500 bg-slate-50 uppercase">
                   <tr>
                     <th className="px-4 py-3 rounded-tl-lg">Report Type</th>
                     <th className="px-4 py-3">Generated</th>
                     <th className="px-4 py-3">Format</th>
                     <th className="px-4 py-3 rounded-tr-lg text-right">Action</th>
                   </tr>
                 </thead>
                 <tbody>
                   {recentReports.map((report) => (
                       <tr key={report.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                         <td className="px-4 py-3 font-medium text-slate-900 flex items-center gap-2">
                             {report.format === 'pdf' ? <FileText className="w-4 h-4 text-emerald-500" /> : <FileSpreadsheet className="w-4 h-4 text-blue-500" />}
                             {reportTypes.find(t => t.id === report.reportType)?.title || report.reportType}
                         </td>
                         <td className="px-4 py-3 text-slate-600">
                             {new Date(report.generatedAt.toMillis()).toLocaleString()}
                         </td>
                         <td className="px-4 py-3">
                             <span className="uppercase text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                 {report.format}
                             </span>
                         </td>
                         <td className="px-4 py-3 text-right">
                             <button className="text-emerald-600 hover:text-emerald-700 font-medium text-sm flex items-center gap-1 justify-end w-full">
                                 <Download className="w-4 h-4" /> Download
                             </button>
                         </td>
                       </tr>
                   ))}
                 </tbody>
               </table>
              </div>
          )}
      </div>

    </div>
  );
}