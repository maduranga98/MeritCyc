// =============================================================================
// PendingApproval — Feature 1.3 / GAP 5
// Shown to users who have completed self-registration but await HR approval.
// Auto-refreshes the ID token every 10 seconds; redirects to dashboard once
// the HR admin sets approved: true in custom claims.
// =============================================================================

import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../config/firebase";
import { useAuth } from "../../context/AuthContext";
import { getDashboardPath, type RoleCode } from "../../types/roles";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PendingApproval: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState<string | null>(null);

  // Fetch company name from Firestore once we have a companyId
  useEffect(() => {
    if (!user?.companyId) return;
    let cancelled = false;
    getDoc(doc(db, "companies", user.companyId))
      .then((snap) => {
        if (cancelled) return;
        if (snap.exists()) {
          setCompanyName((snap.data().name as string) ?? null);
        }
      })
      .catch(() => {
        if (cancelled) return;
        console.warn("Could not fetch company name");
        setCompanyName(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.companyId]);

  // Poll for claim changes — force-refresh the token every 10 s.
  // If HR approves the account while this page is open, redirect immediately.
  const checkApproval = useCallback(async () => {
    const fbUser = auth.currentUser;
    if (!fbUser) return;
    try {
      const tokenResult = await fbUser.getIdTokenResult(true);
      if (tokenResult.claims.approved === true) {
        const role = (tokenResult.claims.role as RoleCode) ?? "employee";
        navigate(getDashboardPath(role), { replace: true });
      }
    } catch {
      // Ignore transient token-refresh errors
    }
  }, [navigate]);

  useEffect(() => {
    const interval = setInterval(checkApproval, 10_000);
    return () => clearInterval(interval);
  }, [checkApproval]);

  const handleSignOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 font-brand flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
        {/* Clock icon */}
        <div className="mx-auto mb-6 w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#F59E0B"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Your Account is Pending Approval
        </h1>
        <p className="text-slate-500 text-sm leading-relaxed mb-6">
          {companyName ? (
            <>You've successfully verified your email. Your HR team is reviewing your registration.</>
          ) : (
            <>Your account has been created and is awaiting approval. You'll receive an email once it's verified and approved.</>
          )}
        </p>

        {/* Status info card */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left mb-6 space-y-2">
          {user?.email && (
            <InfoRow label="Registered email" value={user.email} />
          )}
          {companyName && (
            <InfoRow label="Company" value={companyName} />
          )}
          {!companyName && user?.email && (
            <InfoRow label="Status" value="Verifying email…" valueClass="text-blue-600 font-semibold" />
          )}
          {companyName && (
            <InfoRow label="Status" value="Awaiting HR Approval" valueClass="text-amber-600 font-semibold" />
          )}
        </div>

        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          Check your email at{" "}
          <span className="font-medium text-slate-700">{user?.email ?? "your registered address"}</span>{" "}
          for further instructions. It may take a few minutes to arrive.
        </p>

        <button
          type="button"
          onClick={handleSignOut}
          className="w-full border border-slate-200 text-slate-700 font-semibold py-3.5 rounded-xl hover:bg-slate-50 transition-colors active:scale-[0.98] mb-4"
        >
          Sign Out
        </button>

        <p className="text-xs text-slate-400 leading-relaxed">
          Questions? Contact your HR department directly.
        </p>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

const InfoRow: React.FC<{ label: string; value: string; valueClass?: string }> = ({
  label,
  value,
  valueClass = "text-slate-700",
}) => (
  <div className="flex items-start justify-between gap-4 text-sm">
    <span className="text-slate-500 shrink-0">{label}</span>
    <span className={`text-right break-all ${valueClass}`}>{value}</span>
  </div>
);

export default PendingApproval;
