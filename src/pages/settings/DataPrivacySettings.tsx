import { useState } from "react";
import { settingsService } from "../../services/settingsService";
import { toast } from "sonner";
import { Loader2, Download, Shield, Database, Clock, Lock } from "lucide-react";

export default function DataPrivacySettings() {
  const [exporting, setExporting] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setDownloadUrl(null);
    try {
      const res = await settingsService.exportCompanyData();
      if (res.success && res.downloadUrl) {
          setDownloadUrl(res.downloadUrl);
          toast.success("Data export prepared successfully");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to export data");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900">Data & Privacy Settings</h1>

      {/* SECTION 1 - Data Export */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
            <Database className="w-5 h-5 text-slate-700" />
            Export Company Data
        </h2>

        <p className="text-sm text-slate-600 mb-4">
            Download a complete export of all your company data including employees, cycles, evaluations, and increment stories. Export is provided as a JSON file.
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div>
                <p className="text-sm font-medium text-slate-900">Last exported: Never exported</p>
                <p className="text-xs text-slate-500 mt-1">You can export once per hour.</p>
            </div>

            {!downloadUrl ? (
                <button
                    onClick={handleExport}
                    disabled={exporting}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap disabled:opacity-50"
                >
                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {exporting ? "Preparing export..." : "Export All Data"}
                </button>
            ) : (
                <a
                    href={downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap"
                >
                    <Download className="w-4 h-4" />
                    Your export is ready — Download
                </a>
            )}
        </div>
      </div>

      {/* SECTION 2 - Data Retention */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-700" />
            Data Retention Policy
        </h2>

        <p className="text-sm font-medium text-slate-800 mb-4">
            MeritCyc retains your data for as long as your account is active.
        </p>

        <ul className="space-y-3">
            {[
                "Employee records: retained until manually deleted or account closure.",
                "Evaluation data: retained indefinitely for compliance.",
                "Audit logs: retained indefinitely, append-only.",
                "Rejected registrations: auto-deleted after 30 days.",
                "Expired invites: auto-deleted after 7 days."
            ].map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 flex-shrink-0" />
                    {item}
                </li>
            ))}
        </ul>
      </div>

      {/* SECTION 3 - GDPR / Compliance Notes */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-600" />
            Privacy & Compliance Commitment
        </h2>

        <p className="text-sm text-slate-600 mb-4">
            MeritCyc is designed with data privacy in mind to help you meet compliance requirements:
        </p>

        <ul className="space-y-3">
            {[
                "All data is strictly isolated per company — no cross-company data access is possible.",
                "Audit logs capture all system actions and cannot be modified or deleted.",
                "Employee data can be exported on request to fulfill right-to-access requirements.",
                "Account deletion includes a 30-day grace period before permanent data destruction."
            ].map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                    <Lock className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    {item}
                </li>
            ))}
        </ul>
      </div>
    </div>
  );
}