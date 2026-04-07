// =============================================================================
// ManualJoin — Feature 1.4
// Employee fallback: manually type the company code instead of scanning QR.
// Route: /join
// =============================================================================

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../config/firebase";
import { Logo } from "../../components/Logo";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ValidateResult {
  success: boolean;
  companyId?: string;
  companyName?: string;
  error?: { code: string; message: string };
}

// ---------------------------------------------------------------------------
// Code formatting helpers
// ---------------------------------------------------------------------------

/** Strips non-alphanumeric chars, uppercases, then inserts the MC- dash. */
function formatCode(raw: string): string {
  // Keep only A-Z 0-9
  const stripped = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (stripped.length <= 2) return stripped;

  // Always insert dash after position 2 (after 'MC')
  return stripped.slice(0, 2) + "-" + stripped.slice(2, 8);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ManualJoin: React.FC = () => {
  const navigate = useNavigate();

  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validated, setValidated] = useState<{
    companyId: string;
    companyName: string;
  } | null>(null);

  // -------------------------------------------------------------------------
  // Input handler — live format as user types
  // -------------------------------------------------------------------------
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setValidated(null);
    setCode(formatCode(e.target.value));
  };

  // -------------------------------------------------------------------------
  // Submit — call validateCompanyCode Cloud Function
  // -------------------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (code.length < 9) {
      setError("Please enter the full 9-character code (e.g. MC-7X9K2P).");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const validateFn = httpsCallable<{ companyCode: string }, ValidateResult>(
        functions,
        "validateCompanyCode",
      );
      const result = await validateFn({ companyCode: code });
      const data = result.data;

      if (data.success && data.companyId && data.companyName) {
        setValidated({ companyId: data.companyId, companyName: data.companyName });
      } else if (data.error?.code === "RATE_LIMITED") {
        setError("Too many attempts. Please try again in a few minutes.");
      } else {
        setError("Invalid or inactive company code. Check with your HR team.");
      }
    } catch (err: unknown) {
      const fnErr = err as { code?: string };
      if (fnErr.code === "functions/resource-exhausted") {
        setError("Too many attempts. Please try again in a few minutes.");
      } else {
        setError("Invalid or inactive company code. Check with your HR team.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // Continue — navigate to QRLanding with pre-validated state
  // -------------------------------------------------------------------------
  const handleContinue = () => {
    if (!validated) return;
    navigate(`/join/${code}`, {
      state: {
        preValidated: true,
        companyName: validated.companyName,
        companyId: validated.companyId,
      },
    });
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-merit-bg font-brand flex flex-col items-center justify-center px-4 py-12">
      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 shadow-sm p-8 sm:p-10">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo />
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-bold text-merit-navy text-center mb-2">
          Join Your Company
        </h1>
        <p className="text-merit-slate text-sm text-center mb-8 leading-relaxed">
          Enter the company code provided by your HR team
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label
              htmlFor="company-code"
              className="block text-xs font-bold uppercase text-merit-slate mb-2 tracking-wider"
            >
              Company Code
            </label>
            <input
              id="company-code"
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              value={code}
              onChange={handleCodeChange}
              maxLength={9}
              placeholder="e.g. MC-7X9K2P"
              disabled={isLoading}
              className={[
                "w-full px-4 py-4 text-lg font-mono tracking-widest rounded-xl border",
                "focus:outline-none focus:ring-2 focus:ring-merit-emerald/20 focus:border-merit-emerald",
                "transition-all disabled:bg-gray-50 disabled:cursor-not-allowed",
                "placeholder:text-gray-300 placeholder:font-sans placeholder:tracking-normal",
                error ? "border-red-400" : "border-gray-200",
              ].join(" ")}
            />

            {/* Inline error */}
            {error && (
              <p className="mt-2 text-sm text-red-500 flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </span>
                {error}
              </p>
            )}
          </div>

          {/* Continue button */}
          {!validated && (
            <button
              type="submit"
              disabled={isLoading || code.length < 9}
              className="w-full bg-merit-navy text-white font-bold py-4 rounded-xl hover:shadow-lg hover:shadow-merit-navy/20 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Checking…</span>
                </>
              ) : (
                "Continue"
              )}
            </button>
          )}
        </form>

        {/* Confirmation card — shown after successful validation */}
        {validated && (
          <div className="mt-2">
            {/* Success banner */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 mb-4">
              <div className="flex items-center gap-2 mb-1">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span className="font-bold text-emerald-700 text-sm">
                  Found: {validated.companyName}
                </span>
              </div>
              <p className="text-emerald-600 text-sm pl-6">
                You're about to join this organization.
              </p>
            </div>

            {/* Primary CTA */}
            <button
              type="button"
              onClick={handleContinue}
              className="w-full bg-merit-emerald text-white font-bold py-4 rounded-xl hover:shadow-lg hover:shadow-merit-emerald/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              Continue Registration
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>

            {/* Re-enter link */}
            <button
              type="button"
              onClick={() => {
                setValidated(null);
                setCode("");
              }}
              className="w-full mt-3 text-sm text-merit-slate hover:text-merit-navy transition-colors text-center"
            >
              Use a different code
            </button>
          </div>
        )}
      </div>

      {/* Footer hint */}
      <p className="mt-6 text-xs text-merit-slate text-center max-w-xs leading-relaxed">
        Have a QR code?{" "}
        <span className="font-medium text-merit-navy">
          Ask your HR to share the QR poster
        </span>{" "}
        and scan it with your camera to join instantly.
      </p>

      {/* Back to login */}
      <Link
        to="/login"
        className="mt-4 text-xs text-merit-slate hover:text-merit-navy transition-colors"
      >
        Already have an account? Sign in
      </Link>
    </div>
  );
};

export default ManualJoin;
