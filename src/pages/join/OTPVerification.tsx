// =============================================================================
// OTPVerification — Feature 1.3
// Public page. Verifies the 6-digit OTP sent to the employee's email.
//
// Route: /join/verify
// Expected location.state: { email, companyId, companyName, companyCode }
//
// Features:
//   - 6 individual digit boxes, auto-focus next, backspace goes back
//   - Auto-submits when all 6 digits are filled
//   - 10-minute countdown timer
//   - Resend button (disabled first 60 s, then enabled)
//   - Error states: wrong code (X attempts remaining), cooldown (5-min timer), expired
//   - Full-screen success — no redirect, this is the end of the journey
// =============================================================================

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  KeyboardEvent,
} from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../config/firebase";
import { Logo } from "../../components/Logo";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LocationState {
  email: string;
  companyId: string;
  companyName: string;
  companyCode: string;
}

interface VerifyResult {
  success: boolean;
}

interface SubmitResult {
  success: boolean;
  message: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OTP_LEN = 6;
const OTP_TTL_SEC = 10 * 60;      // 10 minutes OTP lifetime
const RESEND_COOLDOWN_SEC = 60;   // resend button locked for 60 s

// ---------------------------------------------------------------------------
// Countdown hook — counts down from `initial` seconds, returns [remaining, reset]
// ---------------------------------------------------------------------------

function useCountdown(initial: number): [number, () => void] {
  const [remaining, setRemaining] = useState(initial);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(
    (from: number) => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setRemaining(from);
      intervalRef.current = setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) {
            clearInterval(intervalRef.current!);
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    },
    [],
  );

  // Start on mount
  useEffect(() => {
    start(initial);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = useCallback(() => start(initial), [start, initial]);
  return [remaining, reset];
}

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const OTPVerification: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | null;

  // Guard: redirect if no state
  useEffect(() => {
    if (!state?.email) navigate("/join", { replace: true });
  }, [state, navigate]);

  if (!state?.email) return null;

  return <OTPForm state={state} />;
};

// Inner component so we can safely call hooks after the guard
const OTPForm: React.FC<{ state: LocationState }> = ({ state }) => {
  const navigate = useNavigate();

  // ── Digit state ────────────────────────────────────────────────────────
  const [digits, setDigits] = useState<string[]>(Array(OTP_LEN).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>(
    Array(OTP_LEN).fill(null),
  );

  // ── Verification state ─────────────────────────────────────────────────
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Cooldown imposed by server (e.g. 5 min after 3 wrong attempts)
  const [serverCooldown, setServerCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Resend state ───────────────────────────────────────────────────────
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  // ── Countdown timers ───────────────────────────────────────────────────
  const [otpRemaining, resetOtp] = useCountdown(OTP_TTL_SEC);
  const [resendRemaining, resetResend] = useCountdown(RESEND_COOLDOWN_SEC);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Server-side cooldown ticker
  const startServerCooldown = (seconds: number) => {
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    setServerCooldown(seconds);
    cooldownRef.current = setInterval(() => {
      setServerCooldown((s) => {
        if (s <= 1) {
          clearInterval(cooldownRef.current!);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  useEffect(
    () => () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    },
    [],
  );

  // ── Auto-submit when all digits filled ────────────────────────────────
  const otp = digits.join("");
  const prevOtpRef = useRef("");
  useEffect(() => {
    if (otp.length === OTP_LEN && prevOtpRef.current !== otp) {
      prevOtpRef.current = otp;
      verify(otp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  // ── Digit input handlers ───────────────────────────────────────────────
  const handleChange = (index: number, value: string) => {
    setError(null);

    // Support paste into first box
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, "").slice(0, OTP_LEN);
      const next = [...digits];
      for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
      setDigits(next);
      const focus = Math.min(pasted.length, OTP_LEN - 1);
      inputRefs.current[focus]?.focus();
      return;
    }

    const digit = value.replace(/\D/g, "");
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < OTP_LEN - 1) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[index]) {
        const next = [...digits];
        next[index] = "";
        setDigits(next);
      } else if (index > 0) {
        const next = [...digits];
        next[index - 1] = "";
        setDigits(next);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < OTP_LEN - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // ── Verify OTP ─────────────────────────────────────────────────────────
  const verify = async (code: string) => {
    if (verifying) return;
    setVerifying(true);
    setError(null);

    try {
      const fn = httpsCallable<
        { companyCode: string; email: string; otp: string },
        VerifyResult
      >(functions, "verifyEmailOTP");

      await fn({
        companyCode: state.companyCode,
        email: state.email,
        otp: code,
      });

      setSuccess(true);
    } catch (err: unknown) {
      const fnErr = err as { code?: string; message?: string };
      const msg = fnErr.message ?? "Verification failed.";

      // Clear digits and refocus first box
      setDigits(Array(OTP_LEN).fill(""));
      prevOtpRef.current = "";
      setTimeout(() => inputRefs.current[0]?.focus(), 0);

      if (fnErr.code === "functions/resource-exhausted") {
        // Extract cooldown seconds from message if present, else 5 min
        const match = msg.match(/(\d+)\s*second/i);
        startServerCooldown(match ? parseInt(match[1]) : 5 * 60);
        setError(msg);
      } else if (fnErr.code === "functions/deadline-exceeded") {
        setError("Code expired. Please go back and register again.");
      } else {
        setError(msg);
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length === OTP_LEN) verify(otp);
  };

  // ── Resend OTP ─────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendRemaining > 0 || resending) return;
    setResending(true);
    setResendMsg(null);

    try {
      const fn = httpsCallable<
        {
          companyCode: string;
          name: string;
          email: string;
          departmentId: string;
          jobTitle: string;
        },
        SubmitResult
      >(functions, "submitSelfRegistration");

      // Re-submit registration which regenerates and resends OTP
      await fn({
        companyCode: state.companyCode,
        name: "",        // existing reg is overwritten with set() — name kept
        email: state.email,
        departmentId: "",
        jobTitle: "",
      });

      setResendMsg("A new code has been sent to your email.");
      resetOtp();
      resetResend();
      setDigits(Array(OTP_LEN).fill(""));
      prevOtpRef.current = "";
      setTimeout(() => inputRefs.current[0]?.focus(), 0);
    } catch {
      setResendMsg("Failed to resend code. Please try again.");
    } finally {
      setResending(false);
    }
  };

  // ── Success screen ─────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 font-brand flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
          <Logo />

          <div className="mt-8 mb-5 mx-auto w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#10B981"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-3">
            Registration Submitted!
          </h1>
          <p className="text-slate-500 text-sm leading-relaxed max-w-xs mx-auto">
            Your account is pending HR approval for{" "}
            <span className="font-semibold text-slate-700">
              {state.companyName}
            </span>
            . You'll receive an email once it's approved.
          </p>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <Link
              to="/login"
              className="text-sm font-medium text-emerald-600 hover:underline"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isExpired = otpRemaining === 0;
  const isOnCooldown = serverCooldown > 0;
  const inputsDisabled = verifying || isExpired || isOnCooldown;

  return (
    <div className="min-h-screen bg-slate-50 font-brand flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-100 shadow-sm p-8 sm:p-10">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 text-center mb-2">
          Check Your Email
        </h1>
        <p className="text-slate-500 text-sm text-center mb-1">
          We sent a 6-digit code to
        </p>
        <p className="text-slate-900 font-semibold text-sm text-center mb-6 truncate px-4">
          {state.email}
        </p>

        {/* Expired banner */}
        {isExpired && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-4 text-center">
            <p className="text-amber-700 text-sm font-medium">
              This code has expired. Please use the resend button below.
            </p>
          </div>
        )}

        {/* Cooldown banner */}
        {isOnCooldown && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 mb-4 text-center">
            <p className="text-red-700 text-sm font-medium">
              Too many attempts. Try again in{" "}
              <span className="font-bold tabular-nums">
                {fmtTime(serverCooldown)}
              </span>
              .
            </p>
          </div>
        )}

        <form onSubmit={handleManualSubmit} noValidate>
          {/* OTP boxes */}
          <div
            className="flex gap-2 justify-center mb-5"
            role="group"
            aria-label="Verification code input"
          >
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                type="text"
                inputMode="numeric"
                pattern="\d*"
                maxLength={OTP_LEN}
                value={d}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onFocus={(e) => e.target.select()}
                disabled={inputsDisabled}
                aria-label={`Digit ${i + 1}`}
                className={[
                  "w-12 h-14 text-center text-xl font-bold rounded-xl border-2 transition-all",
                  "focus:outline-none focus:ring-2 focus:ring-emerald-500/20",
                  "disabled:bg-slate-50 disabled:cursor-not-allowed",
                  error
                    ? "border-red-400 text-red-600"
                    : d
                      ? "border-emerald-500 text-slate-900"
                      : "border-slate-200 text-slate-900",
                ].join(" ")}
              />
            ))}
          </div>

          {/* Countdown timer */}
          {!isExpired && !isOnCooldown && (
            <p className="text-center text-xs text-slate-400 mb-3 tabular-nums">
              Code expires in{" "}
              <span
                className={
                  otpRemaining < 60
                    ? "text-red-500 font-semibold"
                    : "text-slate-500"
                }
              >
                {fmtTime(otpRemaining)}
              </span>
            </p>
          )}

          {/* Error message */}
          {error && !isOnCooldown && (
            <p className="text-sm text-red-500 text-center mb-3 flex items-center justify-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                strokeLinejoin="round" className="shrink-0">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </p>
          )}

          {/* Manual submit button (shown when auto-submit hasn't fired) */}
          {otp.length === OTP_LEN && !verifying && (
            <button
              type="submit"
              disabled={inputsDisabled}
              className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Verify Code
            </button>
          )}

          {verifying && (
            <div className="flex justify-center py-3">
              <div className="h-6 w-6 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
            </div>
          )}
        </form>

        {/* Resend */}
        <div className="mt-6 text-center">
          {resendMsg && (
            <p className="text-sm text-emerald-600 mb-2">{resendMsg}</p>
          )}
          {resendRemaining > 0 ? (
            <p className="text-xs text-slate-400">
              Resend available in{" "}
              <span className="tabular-nums font-medium">
                {resendRemaining}s
              </span>
            </p>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="text-sm font-medium text-emerald-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resending ? "Sending…" : "Resend code"}
            </button>
          )}
        </div>

        {/* Back / expired link */}
        <p className="text-xs text-slate-400 text-center mt-4">
          Wrong email or can't find the code?{" "}
          <Link to="/join" className="text-slate-600 font-medium hover:underline">
            Start over
          </Link>
        </p>
      </div>
    </div>
  );
};

export default OTPVerification;
