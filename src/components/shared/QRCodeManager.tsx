// =============================================================================
// QRCodeManager — Feature 1.3
// HR/super_admin component for managing the company's QR self-registration code.
//
// Features:
//   - Shows current code and live QR canvas
//   - Download PNG (canvas.toDataURL)
//   - Download PDF poster (jsPDF — branded with company name + instructions)
//   - Regenerate code (confirmation dialog)
//   - Toggle QR registration on/off
//   - First-time setup: "Generate Your First QR Code" button
// =============================================================================

import React, { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { jsPDF } from "jspdf";
import { doc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../config/firebase";
import { useAuth } from "../../context/AuthContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RegistrationDoc {
  companyCode: string;
  qrEnabled: boolean;
}

interface GenerateResult {
  success: boolean;
  companyCode: string;
}

interface ToggleResult {
  success: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const APP_BASE_URL = "https://app.meritcyc.com";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const QRCodeManager: React.FC = () => {
  const { user } = useAuth();
  const companyId = user?.companyId ?? "";
  const companyName = user?.name ?? "Your Company"; // HR/SA name, not company name
  // We'll fetch company name from the registration doc parent — for now use a
  // separate state loaded from Firestore (the company document)

  const [regDoc, setRegDoc] = useState<RegistrationDoc | null | undefined>(
    undefined, // undefined = loading, null = doesn't exist, object = loaded
  );
  const [fetchedCompanyName, setFetchedCompanyName] = useState("");

  // Action states
  const [generating, setGenerating] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const qrCanvasRef = useRef<HTMLDivElement>(null);

  // ── Live Firestore listener ────────────────────────────────────────────
  useEffect(() => {
    if (!companyId) return;

    // Fetch company name
    import("firebase/firestore").then(({ doc: fsDoc, getDoc }) => {
      getDoc(fsDoc(db, "companies", companyId)).then((snap) => {
        if (snap.exists()) setFetchedCompanyName(snap.data().name ?? "");
      });
    });

    const regRef = doc(
      db,
      "companies",
      companyId,
      "registration",
      companyId,
    );

    const unsub = onSnapshot(regRef, (snap) => {
      if (!snap.exists()) {
        setRegDoc(null);
      } else {
        setRegDoc(snap.data() as RegistrationDoc);
      }
    });

    return unsub;
  }, [companyId]);

  // ── Derived ───────────────────────────────────────────────────────────
  const joinUrl = regDoc?.companyCode
    ? `${APP_BASE_URL}/join/${regDoc.companyCode}`
    : "";

  // ── Actions ───────────────────────────────────────────────────────────

  const flashSuccess = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 3000);
  };

  const handleGenerate = async (isRegen = false) => {
    setGenerating(true);
    setActionError(null);
    setShowConfirm(false);

    try {
      const fn = httpsCallable<Record<string, never>, GenerateResult>(
        functions,
        "generateCompanyQRCode",
      );
      await fn({});
      flashSuccess(
        isRegen
          ? "QR code regenerated. The old code is now invalid."
          : "QR code generated successfully!",
      );
    } catch (err: unknown) {
      setActionError(
        (err as { message?: string }).message ?? "Failed to generate code.",
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleToggle = async () => {
    if (!regDoc) return;
    setToggling(true);
    setActionError(null);

    try {
      const fn = httpsCallable<{ enabled: boolean }, ToggleResult>(
        functions,
        "toggleQRRegistration",
      );
      await fn({ enabled: !regDoc.qrEnabled });
      flashSuccess(
        !regDoc.qrEnabled
          ? "QR registration enabled."
          : "QR registration disabled.",
      );
    } catch (err: unknown) {
      setActionError(
        (err as { message?: string }).message ?? "Failed to update setting.",
      );
    } finally {
      setToggling(false);
    }
  };

  // ── Download PNG ──────────────────────────────────────────────────────
  const handleDownloadPng = () => {
    const canvas = qrCanvasRef.current?.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `meritcyc-qr-${regDoc?.companyCode ?? "code"}.png`;
    a.click();
  };

  // ── Download PDF poster ────────────────────────────────────────────────
  const handleDownloadPdf = () => {
    const canvas = qrCanvasRef.current?.querySelector("canvas");
    if (!canvas || !regDoc) return;

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = 210;
    const pageH = 297;

    // Background
    pdf.setFillColor(248, 250, 252); // slate-50
    pdf.rect(0, 0, pageW, pageH, "F");

    // Header band
    pdf.setFillColor(15, 23, 42); // slate-900
    pdf.rect(0, 0, pageW, 48, "F");

    // MeritCyc logo text
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(28);
    pdf.setTextColor(255, 255, 255);
    pdf.text("MeritCyc", pageW / 2, 22, { align: "center" });

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(13);
    pdf.setTextColor(100, 116, 139); // slate-500 (visible on dark bg not great, use light)
    pdf.setTextColor(203, 213, 225); // slate-300
    pdf.text("Employee Self-Registration", pageW / 2, 34, { align: "center" });

    // Company name
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(22);
    pdf.setTextColor(15, 23, 42);
    pdf.text(fetchedCompanyName || "Your Company", pageW / 2, 68, {
      align: "center",
    });

    // Instruction
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(12);
    pdf.setTextColor(100, 116, 139);
    pdf.text("Scan this QR code with your phone to join", pageW / 2, 78, {
      align: "center",
    });

    // QR code image
    const qrDataUrl = canvas.toDataURL("image/png");
    const qrSize = 100;
    const qrX = (pageW - qrSize) / 2;
    pdf.addImage(qrDataUrl, "PNG", qrX, 86, qrSize, qrSize);

    // Company code pill
    pdf.setFillColor(236, 253, 245); // emerald-50
    pdf.setDrawColor(167, 243, 208); // emerald-200
    pdf.roundedRect(pageW / 2 - 38, 192, 76, 12, 3, 3, "FD");
    pdf.setFont("courier", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(5, 150, 105); // emerald-600
    pdf.text(regDoc.companyCode, pageW / 2, 200, { align: "center" });

    // Or enter manually
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(100, 116, 139);
    pdf.text(
      "Or visit app.meritcyc.com/join and enter the code above",
      pageW / 2,
      212,
      { align: "center" },
    );

    // Divider
    pdf.setDrawColor(226, 232, 240);
    pdf.line(30, 220, pageW - 30, 220);

    // Steps
    pdf.setFontSize(10);
    pdf.setTextColor(15, 23, 42);
    const steps = [
      "1.  Scan the QR code or visit the link above",
      "2.  Fill in your name, email and job title",
      "3.  Enter the 6-digit code sent to your email",
      "4.  Wait for HR to activate your account",
    ];
    steps.forEach((s, i) => {
      pdf.text(s, pageW / 2, 230 + i * 8, { align: "center" });
    });

    // Footer
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184);
    pdf.text("Generated by MeritCyc · meritcyc.com", pageW / 2, pageH - 8, {
      align: "center",
    });

    pdf.save(
      `meritcyc-registration-poster-${regDoc.companyCode}.pdf`,
    );
  };

  // ── Loading ────────────────────────────────────────────────────────────
  if (!companyId) return null;

  if (regDoc === undefined) {
    return (
      <div className="flex items-center justify-center p-10">
        <div className="h-8 w-8 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  // ── First-time setup ───────────────────────────────────────────────────
  if (regDoc === null) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
          <QrIcon className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">
          No QR Code Yet
        </h3>
        <p className="text-slate-500 text-sm mb-6 leading-relaxed">
          Generate a unique company code so employees can self-register via QR
          code or the join link.
        </p>
        {actionError && (
          <p className="text-red-500 text-sm mb-4">{actionError}</p>
        )}
        <button
          onClick={() => handleGenerate(false)}
          disabled={generating}
          className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {generating ? (
            <>
              <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              Generating…
            </>
          ) : (
            "Generate Your First QR Code"
          )}
        </button>
      </div>
    );
  }

  // ── Main view ──────────────────────────────────────────────────────────
  const enabled = regDoc.qrEnabled;

  return (
    <div className="space-y-4">
      {/* Status bar */}
      {actionSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="#10B981" strokeWidth="2.5" strokeLinecap="round"
            strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <p className="text-emerald-700 text-sm font-medium">{actionSuccess}</p>
        </div>
      )}

      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-red-600 text-sm">{actionError}</p>
        </div>
      )}

      {/* QR Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Employee Registration QR
            </h3>
            <p className="text-slate-500 text-sm mt-0.5">
              Share this with new employees to let them self-register.
            </p>
          </div>

          {/* Toggle switch */}
          <button
            type="button"
            onClick={handleToggle}
            disabled={toggling}
            aria-label={enabled ? "Disable QR registration" : "Enable QR registration"}
            className={[
              "relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
              "transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30",
              "disabled:opacity-60 disabled:cursor-not-allowed",
              enabled ? "bg-emerald-500" : "bg-slate-200",
            ].join(" ")}
          >
            <span
              className={[
                "pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow",
                "transform transition-transform duration-200",
                enabled ? "translate-x-5" : "translate-x-0",
              ].join(" ")}
            />
          </button>
        </div>

        {/* Disabled warning */}
        {!enabled && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-4 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="#F59E0B" strokeWidth="2" strokeLinecap="round"
              strokeLinejoin="round" className="shrink-0">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <p className="text-amber-700 text-sm font-medium">
              QR registration is currently disabled. New scans will be rejected.
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-6 items-start">
          {/* QR Code */}
          <div
            ref={qrCanvasRef}
            className={[
              "p-3 rounded-xl border-2 bg-white shrink-0",
              enabled ? "border-slate-200" : "border-slate-100 opacity-50",
            ].join(" ")}
          >
            <QRCodeCanvas
              value={joinUrl}
              size={160}
              level="M"
              includeMargin={false}
              fgColor={enabled ? "#0F172A" : "#94A3B8"}
            />
          </div>

          {/* Code + buttons */}
          <div className="flex-1 min-w-0">
            {/* Company code */}
            <p className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-1.5">
              Company Code
            </p>
            <div className="flex items-center gap-2 mb-4">
              <span className="font-mono text-2xl font-bold tracking-widest text-slate-900">
                {regDoc.companyCode}
              </span>
              <button
                type="button"
                onClick={() =>
                  navigator.clipboard.writeText(regDoc.companyCode)
                }
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                title="Copy code"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            </div>

            {/* Join URL */}
            <p className="text-xs text-slate-400 font-mono truncate mb-5">
              {joinUrl}
            </p>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <ActionBtn
                icon={<DownloadIcon />}
                onClick={handleDownloadPng}
                disabled={!enabled}
              >
                Download PNG
              </ActionBtn>

              <ActionBtn
                icon={<PdfIcon />}
                onClick={handleDownloadPdf}
                disabled={!enabled}
              >
                Download PDF Poster
              </ActionBtn>
            </div>
          </div>
        </div>

        {/* Regenerate */}
        <div className="mt-5 pt-5 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            disabled={generating}
            className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-red-600 transition-colors disabled:opacity-50"
          >
            <RefreshIcon />
            Regenerate Code
          </button>
          <p className="text-xs text-slate-400 mt-1">
            This will invalidate the current QR code immediately.
          </p>
        </div>
      </div>

      {/* Confirm regenerate dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <h4 className="text-base font-bold text-slate-900 mb-2">
              Regenerate QR Code?
            </h4>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              The current code{" "}
              <span className="font-mono font-bold text-slate-800">
                {regDoc.companyCode}
              </span>{" "}
              will be permanently invalidated. Any printed posters or shared
              links using this code will stop working.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 border border-slate-200 text-slate-700 font-semibold py-3 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleGenerate(true)}
                disabled={generating}
                className="flex-1 bg-red-600 text-white font-semibold py-3 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {generating ? (
                  <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  "Yes, Regenerate"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Icon sub-components
// ---------------------------------------------------------------------------

const QrIcon: React.FC<{ className?: string }> = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
    strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="3" height="3" />
    <line x1="21" y1="14" x2="21" y2="14.01" />
    <line x1="17" y1="21" x2="21" y2="21" />
    <line x1="21" y1="17" x2="21" y2="21" />
  </svg>
);

const DownloadIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
    strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const PdfIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
    strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </svg>
);

const RefreshIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
    strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

interface ActionBtnProps {
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

const ActionBtn: React.FC<ActionBtnProps> = ({
  icon,
  onClick,
  disabled,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {icon}
    {children}
  </button>
);

export default QRCodeManager;
