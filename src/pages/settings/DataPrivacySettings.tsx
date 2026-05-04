import { useState } from "react";
import { settingsService } from "../../services/settingsService";
import { useAuth } from "../../context/AuthContext";
import { toast } from "sonner";
import { Loader2, Download, Shield, Database, Clock, Lock, AlertTriangle, X } from "lucide-react";

function ConfirmExportModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Export Company Data</h2>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-slate-600">
          This will export all company data including employee records, cycle data, and evaluation
          scores. The export may take a minute for large companies.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 font-medium">
            Sensitive employee data is included. Store this file securely and do not share it
            publicly.
          </p>
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 transition-colors border border-slate-200"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DataPrivacySettings() {
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const isSuperAdmin = user?.role === "super_admin";

  const triggerDownload = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const contentDisposition = response.headers.get("content-disposition");
      const filenameMatch = contentDisposition?.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      const filename = filenameMatch?.[1]?.replace(/['"]/g, "") ?? "company-data-export.zip";
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const handleExport = async () => {
    setShowConfirm(false);
    setExporting(true);
    setDownloadUrl(null);
    try {
      const res = await settingsService.exportCompanyData();
      if (res.success && res.downloadUrl) {
        setDownloadUrl(res.downloadUrl);
        toast.success("Data export ready — click Download to save");
      }
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "Failed to export data");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900">Data & Privacy Settings</h1>

      {/* SECTION 1 - Data Export — super_admin only */}
      {isSuperAdmin && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
            <Database className="w-5 h-5 text-slate-700" />
            Export Company Data
          </h2>

          <p className="text-sm text-slate-600 mb-4">
            Download a complete export of all your company data including employees, cycles,
            evaluations, and increment stories. The export is prepared server-side and downloaded as
            a ZIP archive.
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div>
              <p className="text-sm font-medium text-slate-900">Last exported: Never exported</p>
              <p className="text-xs text-slate-500 mt-1">You can export once per hour.</p>
            </div>

            {!downloadUrl ? (
              <button
                onClick={() => setShowConfirm(true)}
                disabled={exporting}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap disabled:opacity-50"
              >
                {exporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {exporting ? "Preparing export..." : "Export All Data"}
              </button>
            ) : (
              <button
                onClick={() => triggerDownload(downloadUrl)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                Download Export
              </button>
            )}
          </div>

          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              <span className="font-semibold">Sensitive employee data is included.</span> Store this
              file securely and restrict access to authorised personnel only.
            </p>
          </div>
        </div>
      )}

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
            "Expired invites: auto-deleted after 7 days.",
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
            "Account deletion includes a 30-day grace period before permanent data destruction.",
          ].map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
              <Lock className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {showConfirm && (
        <ConfirmExportModal onConfirm={handleExport} onCancel={() => setShowConfirm(false)} />
      )}
    </div>
  );
}
