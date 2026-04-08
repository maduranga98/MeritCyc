import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { settingsService } from "../../services/settingsService";
import { type SecuritySettings } from "../../types/settings";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Download, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";

export default function SecuritySettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Partial<SecuritySettings>>({
    idleTimeoutMinutes: 30,
    passwordMinLength: 8,
    requireUppercase: true,
    requireNumbers: true,
    requireSpecialChars: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (user?.companyId) {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    try {
      if (!user?.companyId) return;
      const data = await settingsService.getSecuritySettings(user.companyId);
      if (data) setSettings(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load security settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsService.updateSecuritySettings(settings);
      toast.success("Security settings saved");
      setIsDirty(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to save settings");
    } finally {
      setSaving(false);
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
        <h1 className="text-2xl font-bold text-slate-900">Security Settings</h1>
        {isDirty && <span className="text-sm font-medium text-amber-600 bg-amber-50 px-3 py-1 rounded-full">Unsaved changes</span>}
      </div>

      {/* SECTION 1 - Session Management */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 mb-4">Session Management</h2>

        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Idle Timeout</label>
                <select
                    value={settings.idleTimeoutMinutes || 30}
                    onChange={e => { setSettings(s => ({...s, idleTimeoutMinutes: parseInt(e.target.value)})); setIsDirty(true); }}
                    className="w-full md:w-1/2 border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={120}>2 hours</option>
                    <option value={240}>4 hours</option>
                    <option value={0}>Never</option>
                </select>
                <p className="text-xs text-slate-500 mt-2">Automatically log out users after this period of inactivity.</p>
            </div>

            <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
                <p className="text-xs text-blue-800">Active sessions cannot be listed in this version.</p>
            </div>
        </div>
      </div>

      {/* SECTION 2 - Password Policy */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 mb-4">Password Policy</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Minimum password length</label>
                <select
                    value={settings.passwordMinLength || 8}
                    onChange={e => { setSettings(s => ({...s, passwordMinLength: parseInt(e.target.value)})); setIsDirty(true); }}
                    className="w-full md:w-1/2 border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                >
                    <option value={6}>6 characters</option>
                    <option value={8}>8 characters</option>
                    <option value={10}>10 characters</option>
                    <option value={12}>12 characters</option>
                </select>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-50">
                <span className="text-sm text-slate-700">Require uppercase letter</span>
                <button
                    onClick={() => { setSettings(s => ({...s, requireUppercase: !s.requireUppercase})); setIsDirty(true); }}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${settings.requireUppercase ? 'bg-emerald-500' : 'bg-slate-200'}`}
                >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${settings.requireUppercase ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-50">
                <span className="text-sm text-slate-700">Require numbers</span>
                <button
                    onClick={() => { setSettings(s => ({...s, requireNumbers: !s.requireNumbers})); setIsDirty(true); }}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${settings.requireNumbers ? 'bg-emerald-500' : 'bg-slate-200'}`}
                >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${settings.requireNumbers ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
            </div>

            <div className="flex items-center justify-between py-2 md:col-span-2 md:w-1/2">
                <span className="text-sm text-slate-700">Require special characters</span>
                <button
                    onClick={() => { setSettings(s => ({...s, requireSpecialChars: !s.requireSpecialChars})); setIsDirty(true); }}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${settings.requireSpecialChars ? 'bg-emerald-500' : 'bg-slate-200'}`}
                >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${settings.requireSpecialChars ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
            </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-lg mt-4">
            <p className="text-sm text-slate-700">
                <span className="font-bold">Preview:</span> Your current policy requires passwords with at least {settings.passwordMinLength || 8} characters
                {settings.requireUppercase || settings.requireNumbers || settings.requireSpecialChars ? ', including ' : '.'}
                {[
                    settings.requireUppercase && 'uppercase letters',
                    settings.requireNumbers && 'numbers',
                    settings.requireSpecialChars && 'special characters'
                ].filter(Boolean).join(', ')}.
            </p>
        </div>

        <p className="text-xs text-slate-500 italic mt-2">Note: Password policy applies to new password changes. Existing passwords are not affected.</p>

        <div className="pt-4 flex justify-end border-t border-slate-100">
             <button
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 font-medium"
            >
                {saving ? "Saving..." : "Save Security Settings"}
            </button>
        </div>
      </div>

      {/* SECTION 3 - Audit & Compliance */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            Audit Log Retention
        </h2>

        <p className="text-sm text-slate-600">
            Audit logs are retained indefinitely and cannot be deleted. This ensures compliance with data regulations and provides a complete historical record of system actions.
        </p>

        <div className="flex flex-wrap gap-3 pt-4">
            <Link to="/fairness" className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors">
                View Full Audit Log
            </Link>
            <Link to="/analytics/reports" className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2">
                <Download className="w-4 h-4" /> Export Audit Log
            </Link>
        </div>
      </div>
    </div>
  );
}