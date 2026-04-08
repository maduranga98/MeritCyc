import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { settingsService } from "../../services/settingsService";
import { type NotificationSettings } from "../../types/settings";
import { toast } from "sonner";
import { Loader2, Info } from "lucide-react";

export default function NotificationSettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Partial<NotificationSettings>>({
    pendingApprovalThresholdHours: 48,
    pendingApprovalReminderFrequencyHours: 24,
    budgetWarningThreshold: 80,
    budgetCriticalThreshold: 95,
    evaluationReminderDays: [7, 3, 1],
    reminderRecipient: 'manager',
    emailEventsEnabled: {
      new_registration: true,
      registration_approved: true,
      registration_rejected: true,
      invite_accepted: true,
      evaluation_submitted: true,
      cycle_finalized: true
    }
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
      const data = await settingsService.getNotificationSettings(user.companyId);
      if (data) setSettings(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load notification settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsService.updateNotificationSettings(settings);
      toast.success("Notification settings saved");
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
        <h1 className="text-2xl font-bold text-slate-900">Notification Settings</h1>
        {isDirty && <span className="text-sm font-medium text-amber-600 bg-amber-50 px-3 py-1 rounded-full">Unsaved changes</span>}
      </div>

      {/* SECTION 1 - Approval Thresholds */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 mb-4">Pending Approval Reminders</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Send reminder when pending for:</label>
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        min={12}
                        max={168}
                        value={settings.pendingApprovalThresholdHours || 48}
                        onChange={e => { setSettings(s => ({...s, pendingApprovalThresholdHours: parseInt(e.target.value)})); setIsDirty(true); }}
                        className="w-24 border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                    />
                    <span className="text-sm text-slate-600">hours</span>
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reminder frequency:</label>
                <select
                    value={settings.pendingApprovalReminderFrequencyHours || 24}
                    onChange={e => { setSettings(s => ({...s, pendingApprovalReminderFrequencyHours: parseInt(e.target.value)})); setIsDirty(true); }}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                >
                    <option value={12}>Every 12 hours</option>
                    <option value={24}>Every 24 hours</option>
                    <option value={48}>Every 48 hours</option>
                </select>
            </div>
        </div>
      </div>

      {/* SECTION 2 - Budget Alert Thresholds */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 mb-4">Budget Alert Thresholds</h2>

        <div className="space-y-6">
            <div>
                <div className="flex justify-between items-center mb-1">
                    <label className="text-sm font-medium text-slate-700">Warning alert at:</label>
                    <span className="text-sm font-bold text-amber-600">{settings.budgetWarningThreshold || 80}%</span>
                </div>
                <p className="text-xs text-slate-500 mb-2">Send warning when budget reaches this percentage.</p>
                <input
                    type="range"
                    min="50"
                    max="95"
                    value={settings.budgetWarningThreshold || 80}
                    onChange={e => { setSettings(s => ({...s, budgetWarningThreshold: parseInt(e.target.value)})); setIsDirty(true); }}
                    className="w-full accent-amber-500"
                />
            </div>
            <div>
                <div className="flex justify-between items-center mb-1">
                    <label className="text-sm font-medium text-slate-700">Critical alert at:</label>
                    <span className="text-sm font-bold text-red-600">{settings.budgetCriticalThreshold || 95}%</span>
                </div>
                <p className="text-xs text-slate-500 mb-2">Send critical alert when budget reaches this percentage.</p>
                <input
                    type="range"
                    min="80"
                    max="99"
                    value={settings.budgetCriticalThreshold || 95}
                    onChange={e => { setSettings(s => ({...s, budgetCriticalThreshold: parseInt(e.target.value)})); setIsDirty(true); }}
                    className="w-full accent-red-500"
                />
            </div>

            {/* Visual Preview */}
            <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden mt-4">
                <div className="absolute top-0 left-0 h-full bg-emerald-400" style={{ width: `${settings.budgetWarningThreshold}%` }}></div>
                <div className="absolute top-0 h-full bg-amber-400" style={{ left: `${settings.budgetWarningThreshold}%`, width: `${(settings.budgetCriticalThreshold || 95) - (settings.budgetWarningThreshold || 80)}%` }}></div>
                <div className="absolute top-0 h-full bg-red-500" style={{ left: `${settings.budgetCriticalThreshold}%`, width: `${100 - (settings.budgetCriticalThreshold || 95)}%` }}></div>
            </div>
            <div className="flex justify-between text-xs font-bold text-slate-400">
                <span>0%</span>
                <span>100%</span>
            </div>
        </div>
      </div>

      {/* SECTION 3 - Evaluation Reminders */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 mb-4">Evaluation Deadline Reminders</h2>

        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Send reminders:</label>
                <div className="flex flex-wrap gap-4">
                    {[
                        { label: '7 days before deadline', value: 7 },
                        { label: '3 days before deadline', value: 3 },
                        { label: '1 day before deadline', value: 1 },
                        { label: 'Day of deadline', value: 0 }
                    ].map(opt => (
                        <label key={opt.value} className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={(settings.evaluationReminderDays || []).includes(opt.value)}
                                onChange={e => {
                                    const curr = settings.evaluationReminderDays || [];
                                    const next = e.target.checked ? [...curr, opt.value] : curr.filter(v => v !== opt.value);
                                    setSettings(s => ({...s, evaluationReminderDays: next}));
                                    setIsDirty(true);
                                }}
                                className="rounded text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="text-sm text-slate-700">{opt.label}</span>
                        </label>
                    ))}
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reminder recipient:</label>
                <select
                    value={settings.reminderRecipient || 'manager'}
                    onChange={e => { setSettings(s => ({...s, reminderRecipient: e.target.value as any})); setIsDirty(true); }}
                    className="w-full md:w-1/2 border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                >
                    <option value="manager">Manager only</option>
                    <option value="manager_hr">Manager + HR</option>
                    <option value="all">All</option>
                </select>
            </div>
        </div>
      </div>

      {/* SECTION 4 - Email Notifications */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-start gap-3 mb-4">
            <Info className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
                <h2 className="text-base font-bold text-slate-900">Email Notification Templates</h2>
                <p className="text-sm text-slate-500">Email notifications are sent via Brevo. The following events trigger emails:</p>
            </div>
        </div>

        <div className="space-y-3 pl-8 border-l-2 border-slate-100 ml-2">
            {[
                { key: 'new_registration', label: 'New registration request', role: '(HR)' },
                { key: 'registration_approved', label: 'Registration approved', role: '(Employee)' },
                { key: 'registration_rejected', label: 'Registration rejected', role: '(Employee)' },
                { key: 'invite_accepted', label: 'Invite accepted', role: '(HR)' },
                { key: 'evaluation_submitted', label: 'Evaluation submitted', role: '(Employee)' },
                { key: 'cycle_finalized', label: 'Cycle finalized - increment story ready', role: '(Employee)' },
            ].map(event => (
                <div key={event.key} className="flex items-center justify-between">
                    <div>
                        <span className="text-sm font-medium text-slate-700">{event.label}</span>
                        <span className="text-xs text-slate-400 ml-2">{event.role}</span>
                    </div>
                    <button
                       onClick={() => {
                           setSettings(s => ({
                               ...s,
                               emailEventsEnabled: {
                                   ...(s.emailEventsEnabled || {}),
                                   [event.key]: !(s.emailEventsEnabled as any)?.[event.key]
                               }
                           }));
                           setIsDirty(true);
                       }}
                       className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${settings.emailEventsEnabled?.[event.key] !== false ? 'bg-emerald-500' : 'bg-slate-200'}`}
                    >
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${settings.emailEventsEnabled?.[event.key] !== false ? 'translate-x-5' : 'translate-x-1'}`} />
                    </button>
                </div>
            ))}
            <div className="flex items-center justify-between opacity-50 pt-2">
                <div>
                    <span className="text-sm font-medium text-slate-700">Security events</span>
                    <span className="text-xs text-slate-400 ml-2">(All)</span>
                </div>
                <button disabled className="relative inline-flex h-5 w-9 items-center rounded-full bg-slate-300">
                    <span className="inline-block h-3 w-3 transform translate-x-5 rounded-full bg-white" />
                </button>
            </div>
            <p className="text-xs text-slate-400 italic">Security events cannot be disabled.</p>
        </div>

        <div className="pt-6 flex justify-end">
             <button
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 font-medium"
            >
                {saving ? "Saving..." : "Save Notification Settings"}
            </button>
        </div>
      </div>
    </div>
  );
}