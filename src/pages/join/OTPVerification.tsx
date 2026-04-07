// =============================================================================
// OTPVerification — Feature 1.3
// Verifies the 6-digit OTP sent to the employee's email after registration.
//
// Route: /join/verify
// Expected location.state: {
//   registrationId: string
//   email: string
//   companyName: string
//   companyId: string
// }
// =============================================================================

import React, { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../config/firebase";
import { Logo } from "../../components/Logo";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LocationState {
  registrationId: string;
  email: string;
  companyName: string;
  companyId: string;
}

interface VerifyResult {
  success: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OTP_LENGTH = 6;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const OTPVerification: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>(
    Array(OTP_LENGTH).fill(null),
  );

  // Focus the first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Redirect to /join if arrived without required state
  useEffect(() => {
    if (!state?.registrationId) {
      navigate("/join", { replace: true });
    }
  }, [state, navigate]);

  if (!state?.registrationId) return null;

  const otp = digits.join("");

  // -------------------------------------------------------------------------
  // Digit input handlers
  // -------------------------------------------------------------------------
  const handleDigitChange = (index: number, value: string) => {
    // Allow paste of full OTP into first box
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, "").slice(0, OTP_LENGTH);
      const newDigits = [...digits];
      for (let i = 0; i < pasted.length; i++) {
        newDigits[i] = pasted[i];
      }
      setDigits(newDigits);
      setError(null);
      const nextIndex = Math.min(pasted.length, OTP_LENGTH - 1);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    const digit = value.replace(/\D/g, "");
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    setError(null);

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[index]) {
        const newDigits = [...digits];
        newDigits[index] = "";
        setDigits(newDigits);
      } else if (index > 0) {
        const newDigits = [...digits];
        newDigits[index - 1] = "";
        setDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // -------------------------------------------------------------------------
  // Verify OTP
  // -------------------------------------------------------------------------
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (otp.length < OTP_LENGTH) {
      setError("Please enter all 6 digits.");
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const verifyFn = httpsCallable<
        { registrationId: string; otp: string },
        VerifyResult
      >(functions, "verifyRegistrationOTP");

      await verifyFn({ registrationId: state.registrationId, otp });

      setSuccess(true);
      // Brief success animation before navigating
      setTimeout(() => navigate("/pending-approval", { replace: true }), 1200);
    } catch (err: unknown) {
      const fnErr = err as { code?: string; message?: string };
      if (fnErr.code === "functions/resource-exhausted") {
        setError("Too many attempts. Please try again in a few minutes.");
      } else if (fnErr.code === "functions/deadline-exceeded") {
        setError("OTP has expired. Please go back and start over.");
      } else if (fnErr.code === "functions/invalid-argument") {
        setError("Incorrect code. Please double-check and try again.");
      } else {
        setError("Verification failed. Please try again.");
      }
      // Clear digits on wrong code
      setDigits(Array(OTP_LENGTH).fill(""));
      setTimeout(() => inputRefs.current[0]?.focus(), 0);
    } finally {
      setIsVerifying(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-merit-bg font-brand flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 shadow-sm p-8 sm:p-10">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo />
        </div>

        {success ? (
          /* ---- Success state ---- */
          <div className="flex flex-col items-center py-6 gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
              <svg
                width="32"
                height="32"
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
            </div>
            <h2 className="text-xl font-bold text-merit-navy">
              Registration Submitted!
            </h2>
            <p className="text-merit-slate text-sm leading-relaxed max-w-xs">
              Your account is pending HR approval. You'll receive an email once
              it's activated.
            </p>
          </div>
        ) : (
          /* ---- OTP entry form ---- */
          <>
            <h1 className="text-2xl font-bold text-merit-navy text-center mb-2">
              Check Your Email
            </h1>
            <p className="text-merit-slate text-sm text-center mb-1 leading-relaxed">
              We sent a 6-digit verification code to
            </p>
            <p className="text-merit-navy font-semibold text-sm text-center mb-8 truncate">
              {state.email}
            </p>

            <form onSubmit={handleVerify} noValidate>
              {/* OTP boxes */}
              <div
                className="flex gap-2 justify-center mb-6"
                role="group"
                aria-label="One-time password input"
              >
                {digits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      inputRefs.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={OTP_LENGTH} // allow paste on first box
                    value={digit}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onFocus={(e) => e.target.select()}
                    disabled={isVerifying}
                    aria-label={`Digit ${i + 1}`}
                    className={[
                      "w-11 h-14 text-center text-xl font-bold rounded-xl border-2",
                      "focus:outline-none focus:ring-2 focus:ring-merit-emerald/20 focus:border-merit-emerald",
                      "transition-all disabled:bg-gray-50 disabled:cursor-not-allowed",
                      error
                        ? "border-red-400 text-red-600"
                        : digit
                          ? "border-merit-emerald text-merit-navy"
                          : "border-gray-200 text-merit-navy",
                    ].join(" ")}
                  />
                ))}
              </div>

              {/* Error message */}
              {error && (
                <p className="text-sm text-red-500 text-center mb-4 flex items-center justify-center gap-1.5">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {error}
                </p>
              )}

              {/* Verify button */}
              <button
                type="submit"
                disabled={isVerifying || otp.length < OTP_LENGTH}
                className="w-full bg-merit-navy text-white font-bold py-4 rounded-xl hover:shadow-lg hover:shadow-merit-navy/20 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isVerifying ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>Verifying…</span>
                  </>
                ) : (
                  "Verify & Complete"
                )}
              </button>
            </form>

            {/* Back link */}
            <p className="text-xs text-merit-slate text-center mt-6">
              Wrong email or expired code?{" "}
              <Link
                to="/join"
                className="font-medium text-merit-emerald hover:underline"
              >
                Start over
              </Link>
            </p>
          </>
        )}
      </div>

      <Link
        to="/login"
        className="mt-6 text-xs text-merit-slate hover:text-merit-navy transition-colors"
      >
        Already have an account? Sign in
      </Link>
    </div>
  );
};

export default OTPVerification;
