import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import QRCodeManager from "../../components/shared/QRCodeManager";
import { Link } from "react-router-dom";
import { Users, Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../config/firebase";
import { toast } from "sonner";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../config/firebase";

export default function RegistrationSettings() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [qrEnabled, setQrEnabled] = useState(true); // Mocking initial state


  const fetchData = useCallback(async () => {
    try {
      if (!user?.companyId) return;
      const q = query(
        collection(db, "companies", user.companyId, "pendingRegistrations"),
        where("status", "in", ["pending_approval", "info_requested"])
      );
      const snap = await getDocs(q);
      setPendingCount(snap.size);

      const regRef = collection(db, "companies", user.companyId, "registration");
      const regSnap = await getDocs(regRef);
      if (!regSnap.empty && regSnap.docs[0].data().qrEnabled !== undefined) {
         setQrEnabled(regSnap.docs[0].data().qrEnabled);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [user?.companyId]);

  useEffect(() => {
    if (user?.companyId) {
      fetchData();
    }
  }, [user?.companyId, fetchData]);

  const handleToggleQR = async () => {
      const newState = !qrEnabled;
      setQrEnabled(newState);
      try {
          const fn = httpsCallable(functions, "toggleQRRegistration");
          await fn({ enabled: newState });
          toast.success(`Self-registration ${newState ? 'enabled' : 'disabled'}`);
      } catch {
          setQrEnabled(!newState); // revert
          toast.error("Failed to update registration settings");
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
      <h1 className="text-2xl font-bold text-slate-900">{t('settings.registration.title')}</h1>

      {/* SECTION 1 - QR Code Management */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 mb-4">{t('settings.registration.registrationCode')}</h2>
        <QRCodeManager />
      </div>

      {/* SECTION 2 - Registration Rules */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
        <h2 className="text-base font-bold text-slate-900 mb-4">{t('settings.registration.registrationRules')}</h2>

        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold text-slate-900">{t('settings.registration.selfRegistration')}</h3>
                    <p className="text-sm text-slate-500">{t('settings.registration.selfRegistrationDesc')}</p>
                </div>
                <button
                   onClick={handleToggleQR}
                   className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${qrEnabled ? 'bg-emerald-500' : 'bg-slate-200'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${qrEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>

            <div className="border-t border-slate-100 pt-6 flex items-center justify-between">
                <div className="flex-1">
                    <h3 className="text-sm font-bold text-slate-900">{t('settings.registration.autoApproveDomain')}</h3>
                    <p className="text-sm text-slate-500 mb-2">{t('settings.registration.autoApproveDesc')}</p>
                    <div className="flex items-center gap-2 max-w-sm">
                        <span className="text-slate-500 text-sm bg-slate-50 border border-slate-200 rounded-l-lg px-3 py-2">@</span>
                        <input type="text" placeholder="yourcompany.com" className="w-full border border-slate-300 rounded-r-lg p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500" />
                    </div>
                </div>
                <div className="ml-4">
                    <button className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 bg-slate-200`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-1`} />
                    </button>
                </div>
            </div>

            <div className="border-t border-slate-100 pt-6 flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold text-slate-900">{t('settings.registration.requireEmployeeId')}</h3>
                    <p className="text-sm text-slate-500">{t('settings.registration.requireEmployeeIdDesc')}</p>
                </div>
                <button className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 bg-slate-200`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-1`} />
                </button>
            </div>
        </div>

        <div className="pt-4 flex justify-end">
             <button className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium">
                {t('settings.registration.saveBtn')}
            </button>
        </div>
      </div>

      {/* SECTION 3 - Pending Approvals */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
              <div className="p-3 bg-white rounded-full text-emerald-600 shadow-sm">
                  <Users className="w-6 h-6" />
              </div>
              <div>
                  <h3 className="text-lg font-bold text-emerald-900">{t('settings.registration.pendingApprovals', { count: pendingCount })}</h3>
                  <p className="text-sm text-emerald-700">{t('settings.registration.pendingDesc')}</p>
              </div>
          </div>
          <Link to="/hr/people/approvals" className="px-4 py-2 bg-white text-emerald-700 font-bold rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors">
              {t('settings.registration.reviewNow')}
          </Link>
      </div>
    </div>
  );
}