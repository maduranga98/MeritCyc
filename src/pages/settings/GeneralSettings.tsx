import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { settingsService } from "../../services/settingsService";
import { dataExportService } from "../../services/dataExportService";
import { type CompanySettings } from "../../types/settings";
import { toast } from "sonner";
import { Loader2, AlertTriangle, Upload, Building2, Download } from "lucide-react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../../config/firebase";

export default function GeneralSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Partial<CompanySettings>>({
    name: "",
    timezone: "UTC",
    currency: "USD",
    dateFormat: "DD/MM/YYYY"
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [scheduledDeletionDate, setScheduledDeletionDate] = useState<number | null>(null);

  useEffect(() => {
    if (user?.companyId) {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    try {
      if (!user?.companyId) return;
      const data = await settingsService.getCompanySettings(user.companyId);
      if (data) {
        setSettings(data);
        // Mock status check since it's on the company object, let's just use mock state
        if ((data as any).status === 'deletion_scheduled') {
           setScheduledDeletionDate((data as any).deletionScheduledAt || null);
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGeneral = async () => {
    setSaving(true);
    try {
      await settingsService.updateCompanySettings(settings);
      toast.success("Settings saved successfully");
      setIsDirty(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        toast.error("Please upload an image file");
        return;
    }

    if (file.size > 2 * 1024 * 1024) {
        toast.error("Logo must be less than 2MB");
        return;
    }

    setUploading(true);
    try {
      const storageRef = ref(storage, `companies/${user?.companyId}/logo_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      setSettings(prev => ({ ...prev, logoUrl: url }));
      setIsDirty(true);
      toast.success("Logo uploaded successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to upload logo");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = () => {
      setSettings(prev => ({ ...prev, logoUrl: "" }));
      setIsDirty(true);
  };

  const scheduleDeletion = async () => {
      const confirmName = prompt("Type your company name to confirm deletion:");
      if (confirmName !== settings.name) {
          toast.error("Company name did not match.");
          return;
      }

      try {
          const res = await settingsService.scheduleCompanyDeletion();
          if (res.success) {
              toast.success("Company scheduled for deletion");
              setScheduledDeletionDate(res.deletionDate || Date.now() + 30*24*60*60*1000);
          }
      } catch(e: any) {
          toast.error(e.message || "Failed to schedule deletion");
      }
  };

  const cancelDeletion = async () => {
      try {
          const res = await settingsService.cancelCompanyDeletion();
          if (res.success) {
              toast.success("Deletion cancelled");
              setScheduledDeletionDate(null);
          }
      } catch(e: any) {
          toast.error(e.message || "Failed to cancel deletion");
      }
  };

  const handleExportData = async () => {
    if (!user?.companyId) {
      toast.error("Unable to export: Company not found");
      return;
    }

    setExporting(true);
    try {
      toast.loading("Preparing your data export...");
      await dataExportService.exportCompanyDataZIP(user.companyId);
      toast.success("Your company data has been downloaded as a ZIP file");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to export data");
    } finally {
      setExporting(false);
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
    <div className="space-y-6 max-w-3xl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">General Settings</h1>
        {isDirty && <span className="text-sm font-medium text-amber-600 bg-amber-50 px-3 py-1 rounded-full">Unsaved changes</span>}
      </div>

      {/* SECTION 1 - Company Identity */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 mb-4">Company Identity</h2>

        <div className="flex items-center gap-6 pb-6 border-b border-slate-100">
            <div className="relative">
                <div className="w-20 h-20 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                    {settings.logoUrl ? (
                        <img src={settings.logoUrl} alt="Company Logo" className="w-full h-full object-cover" />
                    ) : (
                        <Building2 className="w-8 h-8 text-slate-400" /> // Using a generic icon if missing, actually Building2 is not imported here, wait let me add it. No, let's just use text
                    )}
                </div>
            </div>
            <div>
                <div className="flex items-center gap-3">
                    <label className="cursor-pointer px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2">
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        Upload Logo
                        <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={uploading} />
                    </label>
                    {settings.logoUrl && (
                        <button onClick={handleRemoveLogo} className="text-sm text-red-600 hover:underline">Remove</button>
                    )}
                </div>
                <p className="text-xs text-slate-500 mt-2">Max 2MB, JPG or PNG only.</p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
                <input
                    type="text"
                    value={settings.name || ""}
                    onChange={e => { setSettings(s => ({...s, name: e.target.value})); setIsDirty(true); }}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Industry</label>
                <select
                    value={settings.industry || ""}
                    onChange={e => { setSettings(s => ({...s, industry: e.target.value})); setIsDirty(true); }}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                >
                    <option value="">Select Industry</option>
                    <option value="Technology">Technology</option>
                    <option value="Finance">Finance</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="Other">Other</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company Size</label>
                <select
                    value={settings.size || ""}
                    onChange={e => { setSettings(s => ({...s, size: e.target.value})); setIsDirty(true); }}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                >
                    <option value="">Select Size</option>
                    <option value="1-50">1-50 employees</option>
                    <option value="51-200">51-200 employees</option>
                    <option value="201-500">201-500 employees</option>
                    <option value="500+">500+ employees</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mobile Number</label>
                <input
                    type="tel"
                    value={settings.mobileNumber || ""}
                    onChange={e => { setSettings(s => ({...s, mobileNumber: e.target.value})); setIsDirty(true); }}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                />
            </div>
            <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <textarea
                    value={settings.address || ""}
                    onChange={e => { setSettings(s => ({...s, address: e.target.value})); setIsDirty(true); }}
                    rows={3}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                />
            </div>
        </div>
      </div>

      {/* SECTION 2 - Regional Settings */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 mb-4">Regional Settings</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Timezone</label>
                <select
                    value={settings.timezone || "UTC"}
                    onChange={e => { setSettings(s => ({...s, timezone: e.target.value})); setIsDirty(true); }}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                >
                    <option value="UTC">UTC</option>
                    <option value="Asia/Colombo">Asia/Colombo</option>
                    <option value="America/New_York">America/New_York</option>
                    <option value="Europe/London">Europe/London</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Default Currency</label>
                <select
                    value={settings.currency || "USD"}
                    onChange={e => { setSettings(s => ({...s, currency: e.target.value})); setIsDirty(true); }}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                >
                    <option value="USD">USD ($)</option>
                    <option value="LKR">LKR (Rs)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="EUR">EUR (€)</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date Format</label>
                <select
                    value={settings.dateFormat || "DD/MM/YYYY"}
                    onChange={e => { setSettings(s => ({...s, dateFormat: e.target.value as any})); setIsDirty(true); }}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                >
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
            </div>
        </div>

        <div className="pt-4 flex justify-end">
             <button
                onClick={handleSaveGeneral}
                disabled={saving || !isDirty}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 font-medium"
            >
                {saving ? "Saving..." : "Save Changes"}
            </button>
        </div>
      </div>

      {/* SECTION 3 - Data Export */}
      <div className="border-2 border-emerald-200 bg-emerald-50/30 rounded-xl p-6 space-y-4">
        <h2 className="text-base font-bold text-emerald-700 mb-4">Data Export</h2>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h3 className="font-bold text-slate-900">Download Company Data</h3>
                <p className="text-emerald-600 text-sm max-w-md">Export all your company's data including cycles, evaluations, employees, and audit logs as a ZIP file.</p>
            </div>

            <button
                onClick={handleExportData}
                disabled={exporting}
                className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
            >
                {exporting ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Exporting...
                    </>
                ) : (
                    <>
                        <Download className="w-4 h-4" />
                        Export Data
                    </>
                )}
            </button>
        </div>
      </div>

      {/* SECTION 4 - Danger Zone */}
      <div className="border-2 border-red-200 bg-red-50/30 rounded-xl p-6 space-y-4">
        <h2 className="text-base font-bold text-red-700 mb-4">Danger Zone</h2>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h3 className="font-bold text-slate-900">Delete Company</h3>
                <p className="text-red-600 text-sm max-w-md">Permanently delete your company account and all associated data. This action cannot be undone.</p>
            </div>

            {scheduledDeletionDate ? (
                 <div className="bg-red-100 border border-red-200 p-4 rounded-lg flex flex-col items-end gap-3 w-full md:w-auto">
                     <div className="flex items-center gap-2 text-red-800 font-medium text-sm">
                         <AlertTriangle className="w-5 h-5" />
                         Account scheduled for deletion on {new Date(scheduledDeletionDate).toLocaleDateString()}
                     </div>
                     <button onClick={cancelDeletion} className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700">
                         Cancel Deletion
                     </button>
                 </div>
            ) : (
                <button onClick={scheduleDeletion} className="px-4 py-2 bg-white border-2 border-red-200 text-red-700 font-bold rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap">
                    Schedule Deletion
                </button>
            )}
        </div>
      </div>
    </div>
  );
}