import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { settingsService } from "../../services/settingsService";
import { dataExportService } from "../../services/dataExportService";
import { type CompanySettings } from "../../types/settings";
import { toast } from "sonner";
import { Loader2, AlertTriangle, Upload, Building2, Download } from "lucide-react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../../config/firebase";
import { getErrorMessage } from '../../utils/errorUtils';

export default function GeneralSettings() {
  const { t } = useTranslation();
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


  const fetchSettings = useCallback(async () => {
    try {
      if (!user?.companyId) return;
      const data = await settingsService.getCompanySettings(user.companyId);
      if (data) {
        setSettings(data);
        // Mock status check since it's on the company object, let's just use mock state
        const withDeletion = data as typeof data & { status?: string; deletionScheduledAt?: number };
        if (withDeletion.status === 'deletion_scheduled') {
           setScheduledDeletionDate(withDeletion.deletionScheduledAt || null);
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [user?.companyId]);

  useEffect(() => {
    if (user?.companyId) {
      fetchSettings();
    }
  }, [user?.companyId, fetchSettings]);

  const handleSaveGeneral = async () => {
    setSaving(true);
    try {
      await settingsService.updateCompanySettings(settings);
      toast.success("Settings saved successfully");
      setIsDirty(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save settings"));
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
      } catch (e) {
          toast.error(getErrorMessage(e, "Failed to schedule deletion"));
      }
  };

  const cancelDeletion = async () => {
      try {
          const res = await settingsService.cancelCompanyDeletion();
          if (res.success) {
              toast.success("Deletion cancelled");
              setScheduledDeletionDate(null);
          }
      } catch (e) {
          toast.error(getErrorMessage(e, "Failed to cancel deletion"));
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
    } catch (error) {
      console.error(error);
      toast.error(getErrorMessage(error, "Failed to export data"));
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
        <h1 className="text-2xl font-bold text-slate-900">{t('settings.general.title')}</h1>
        {isDirty && <span className="text-sm font-medium text-amber-600 bg-amber-50 px-3 py-1 rounded-full">{t('settings.unsavedChanges')}</span>}
      </div>

      {/* SECTION 1 - Company Identity */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 mb-4">{t('settings.general.companyIdentity')}</h2>

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
                        {t('settings.general.uploadLogo')}
                        <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={uploading} />
                    </label>
                    {settings.logoUrl && (
                        <button onClick={handleRemoveLogo} className="text-sm text-red-600 hover:underline">{t('settings.general.remove')}</button>
                    )}
                </div>
                <p className="text-xs text-slate-500 mt-2">{t('settings.general.logoHint')}</p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings.general.companyName')}</label>
                <input
                    type="text"
                    value={settings.name || ""}
                    onChange={e => { setSettings(s => ({...s, name: e.target.value})); setIsDirty(true); }}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings.general.industry')}</label>
                <select
                    value={settings.industry || ""}
                    onChange={e => { setSettings(s => ({...s, industry: e.target.value})); setIsDirty(true); }}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                >
                    <option value="">{t('settings.general.selectIndustry')}</option>
                    <option value="Technology">{t('settings.general.industries.technology')}</option>
                    <option value="Finance">{t('settings.general.industries.finance')}</option>
                    <option value="Healthcare">{t('settings.general.industries.healthcare')}</option>
                    <option value="Other">{t('settings.general.industries.other')}</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings.general.companySize')}</label>
                <select
                    value={settings.size || ""}
                    onChange={e => { setSettings(s => ({...s, size: e.target.value})); setIsDirty(true); }}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                >
                    <option value="">{t('settings.general.selectSize')}</option>
                    <option value="1-50">{t('settings.general.sizes.small')}</option>
                    <option value="51-200">{t('settings.general.sizes.medSmall')}</option>
                    <option value="201-500">{t('settings.general.sizes.medium')}</option>
                    <option value="500+">{t('settings.general.sizes.large')}</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings.general.mobileNumber')}</label>
                <input
                    type="tel"
                    value={settings.mobileNumber || ""}
                    onChange={e => { setSettings(s => ({...s, mobileNumber: e.target.value})); setIsDirty(true); }}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                />
            </div>
            <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings.general.address')}</label>
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
        <h2 className="text-base font-bold text-slate-900 mb-4">{t('settings.general.regionalSettings')}</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings.general.timezone')}</label>
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
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings.general.defaultCurrency')}</label>
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
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings.general.dateFormat')}</label>
                <select
                    value={settings.dateFormat || "DD/MM/YYYY"}
                    onChange={e => { setSettings(s => ({...s, dateFormat: e.target.value as 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'})); setIsDirty(true); }}
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
                {saving ? t('settings.saving') : t('settings.saveChanges')}
            </button>
        </div>
      </div>

      {/* SECTION 3 - Data Export */}
      <div className="border-2 border-emerald-200 bg-emerald-50/30 rounded-xl p-6 space-y-4">
        <h2 className="text-base font-bold text-emerald-700 mb-4">{t('settings.general.dataExport')}</h2>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h3 className="font-bold text-slate-900">{t('settings.general.downloadCompanyData')}</h3>
                <p className="text-emerald-600 text-sm max-w-md">{t('settings.general.downloadDesc')}</p>
            </div>

            <button
                onClick={handleExportData}
                disabled={exporting}
                className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
            >
                {exporting ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('settings.general.exporting')}
                    </>
                ) : (
                    <>
                        <Download className="w-4 h-4" />
                        {t('settings.general.exportData')}
                    </>
                )}
            </button>
        </div>
      </div>

      {/* SECTION 4 - Danger Zone */}
      <div className="border-2 border-red-200 bg-red-50/30 rounded-xl p-6 space-y-4">
        <h2 className="text-base font-bold text-red-700 mb-4">{t('settings.general.dangerZone')}</h2>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h3 className="font-bold text-slate-900">{t('settings.general.deleteCompany')}</h3>
                <p className="text-red-600 text-sm max-w-md">{t('settings.general.deleteDesc')}</p>
            </div>

            {scheduledDeletionDate ? (
                 <div className="bg-red-100 border border-red-200 p-4 rounded-lg flex flex-col items-end gap-3 w-full md:w-auto">
                     <div className="flex items-center gap-2 text-red-800 font-medium text-sm">
                         <AlertTriangle className="w-5 h-5" />
                         {t('settings.general.scheduledForDeletion', { date: new Date(scheduledDeletionDate).toLocaleDateString() })}
                     </div>
                     <button onClick={cancelDeletion} className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700">
                         {t('settings.general.cancelDeletion')}
                     </button>
                 </div>
            ) : (
                <button onClick={scheduleDeletion} className="px-4 py-2 bg-white border-2 border-red-200 text-red-700 font-bold rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap">
                    {t('settings.general.scheduleDeletion')}
                </button>
            )}
        </div>
      </div>
    </div>
  );
}