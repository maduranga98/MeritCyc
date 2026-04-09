// =============================================================================
// QRLanding — Feature 1.3
// Public page for employees arriving via QR code scan or manual code entry.
//
// Routes:
//   /join              → show manual entry hint (code-less entry handled by ManualJoin)
//   /join/:companyCode → auto-validate code on mount, then show registration form
//
// Flow:
//   Step 1 — validate company code (auto or manual)
//   Step 2 — registration form (name, email, phone, department, jobTitle, employeeId, password)
//   Step 3 — navigate to /join/verify
// =============================================================================

import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { collection, getDocs } from "firebase/firestore";
import { functions, db } from "../../config/firebase";
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

interface SubmitResult {
  success: boolean;
  message: string;
}

interface Department {
  id: string;
  name: string;
}

interface LocationState {
  preValidated?: boolean;
  companyName?: string;
  companyId?: string;
}

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

const Spinner: React.FC<{ size?: string }> = ({ size = "h-8 w-8" }) => (
  <div
    className={`${size} rounded-full border-[3px] border-emerald-500 border-t-transparent animate-spin`}
  />
);

// ---------------------------------------------------------------------------
// Password strength helpers
// ---------------------------------------------------------------------------

interface PasswordStrength {
  score: number;
  label: string;
  barColor: string;
  labelColor: string;
  width: string;
}

function getPasswordStrength(pwd: string): PasswordStrength {
  if (!pwd) return { score: 0, label: "", barColor: "", labelColor: "", width: "0%" };
  const hasUpper = /[A-Z]/.test(pwd);
  const hasLower = /[a-z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const score = [hasUpper, hasLower, hasNumber].filter(Boolean).length;
  if (score === 1) return { score: 1, label: "Weak", barColor: "bg-red-400", labelColor: "text-red-400", width: "33%" };
  if (score === 2) return { score: 2, label: "Medium", barColor: "bg-amber-400", labelColor: "text-amber-400", width: "66%" };
  return { score: 3, label: "Strong", barColor: "bg-emerald-500", labelColor: "text-emerald-500", width: "100%" };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const QRLanding: React.FC = () => {
  const { companyCode } = useParams<{ companyCode: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const locState = (location.state ?? {}) as LocationState;

  // ── Step 1: validation ─────────────────────────────────────────────────
  type Step = "validating" | "invalid" | "form" | "disabled";
  const [step, setStep] = useState<Step>(
    locState.preValidated ? "form" : companyCode ? "validating" : "invalid",
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState(locState.companyName ?? "");
  const [companyId, setCompanyId] = useState(locState.companyId ?? "");
  const didValidate = useRef(false);

  // ── Step 2: form ───────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptLoading, setDeptLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const pwdStrength = getPasswordStrength(password);

  // ── Auto-validate on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (locState.preValidated || didValidate.current || !companyCode) return;
    didValidate.current = true;

    const run = async () => {
      try {
        const fn = httpsCallable<{ companyCode: string }, ValidateResult>(
          functions,
          "validateCompanyCode",
        );
        const result = await fn({ companyCode: companyCode.toUpperCase() });
        const data = result.data;

        if (data.success && data.companyId && data.companyName) {
          setCompanyId(data.companyId);
          setCompanyName(data.companyName);
          setStep("form");
        } else if (data.error?.code === "REGISTRATION_DISABLED") {
          setCompanyName(data.companyName ?? "");
          setStep("disabled");
        } else {
          setValidationError(
            data.error?.message ??
              "This QR code is invalid or registration is disabled.",
          );
          setStep("invalid");
        }
      } catch {
        setValidationError(
          "This QR code is invalid or registration is disabled.",
        );
        setStep("invalid");
      }
    };

    run();
  }, [companyCode, locState.preValidated]);

  // ── Fetch departments once company is known ────────────────────────────
  useEffect(() => {
    if (!companyId) return;
    setDeptLoading(true);

    getDocs(collection(db, "companies", companyId, "departments"))
      .then((snap) => {
        setDepartments(
          snap.docs.map((d) => ({ id: d.id, name: d.data().name as string })),
        );
      })
      .catch(() => setDepartments([]))
      .finally(() => setDeptLoading(false));
  }, [companyId]);

  // ── Form validation ────────────────────────────────────────────────────
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Full name is required.";
    if (!email.trim()) {
      errs.email = "Work email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = "Please enter a valid email.";
    }
    if (!jobTitle.trim()) errs.jobTitle = "Job title is required.";

    // Password
    if (!password) {
      errs.password = "Password is required.";
    } else if (password.length < 8) {
      errs.password = "Password must be at least 8 characters.";
    } else if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      errs.password = "Must include uppercase, lowercase, and a number.";
    }

    // Confirm password
    if (!confirmPassword) {
      errs.confirmPassword = "Please confirm your password.";
    } else if (password !== confirmPassword) {
      errs.confirmPassword = "Passwords do not match.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Submit registration ────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const fn = httpsCallable<
        {
          companyCode: string;
          name: string;
          email: string;
          departmentId: string;
          jobTitle: string;
          password: string;
          phoneNumber: string;
          employeeId: string;
        },
        SubmitResult
      >(functions, "submitSelfRegistration");

      await fn({
        companyCode: (companyCode ?? "").toUpperCase(),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        departmentId,
        jobTitle: jobTitle.trim(),
        password,
        phoneNumber: phoneNumber.trim(),
        employeeId: employeeId.trim(),
      });

      navigate("/join/verify", {
        state: {
          email: email.trim().toLowerCase(),
          companyId,
          companyName,
          companyCode: (companyCode ?? "").toUpperCase(),
        },
      });
    } catch (err: unknown) {
      const fnErr = err as { code?: string; message?: string };
      if (fnErr.code === "functions/resource-exhausted") {
        setSubmitError("Too many attempts. Please try again in a few minutes.");
      } else if (fnErr.code === "functions/already-exists") {
        setSubmitError("An account with this email already exists in this company.");
      } else if (fnErr.code === "functions/invalid-argument" && fnErr.message?.includes("Password")) {
        setSubmitError("Password does not meet the requirements.");
      } else {
        setSubmitError("Registration failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 font-brand flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-100 shadow-sm p-8 sm:p-10">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo />
        </div>

        {/* ── Validating ── */}
        {step === "validating" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Spinner />
            <p className="text-slate-500 text-sm">Verifying company code…</p>
          </div>
        )}

        {/* ── Invalid code ── */}
        {step === "invalid" && (
          <div className="text-center">
            <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">
              Code Not Valid
            </h2>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              {validationError ??
                "This QR code is invalid or registration is disabled."}
            </p>
            <p className="text-slate-500 text-sm mb-4">
              If you believe this is an error, please{" "}
              <a
                href="mailto:support@meritcyc.com"
                className="text-emerald-600 font-medium hover:underline"
              >
                contact support
              </a>
              .
            </p>
            <Link
              to="/join"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:underline"
            >
              Enter code manually →
            </Link>
          </div>
        )}

        {/* ── Registration disabled ── */}
        {step === "disabled" && (
          <div className="text-center py-4">
            <div className="mx-auto mb-6 w-20 h-20 flex items-center justify-center">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none"
                stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-3">
              Registration Currently Disabled
            </h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-2">
              Self-registration for{" "}
              {companyName ? (
                <span className="font-semibold text-slate-700">{companyName}</span>
              ) : (
                "this company"
              )}{" "}
              is not accepting new requests at this time.
            </p>
            <p className="text-slate-500 text-sm leading-relaxed mb-8">
              Please contact your HR department directly to get access.
            </p>
            <Link
              to="/join"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Back
            </Link>
          </div>
        )}

        {/* ── Registration form ── */}
        {step === "form" && (
          <>
            {/* Company badge */}
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-6">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="#10B981" strokeWidth="2.5" strokeLinecap="round"
                strokeLinejoin="round" className="shrink-0">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span className="text-emerald-700 text-sm font-semibold">
                You're joining {companyName}
              </span>
            </div>

            <h1 className="text-xl font-bold text-slate-900 mb-1">
              Create Your Account
            </h1>
            <p className="text-slate-500 text-sm mb-6">
              Your account will be reviewed by HR before activation.
            </p>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* 1. Full Name */}
              <Field label="Full Name" error={errors.name}>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setErrors((p) => ({ ...p, name: "" }));
                  }}
                  placeholder="Jane Smith"
                  autoComplete="name"
                  disabled={submitting}
                  className={inputCls(!!errors.name)}
                />
              </Field>

              {/* 2. Work Email */}
              <Field label="Work Email" error={errors.email}>
                <input
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrors((p) => ({ ...p, email: "" }));
                  }}
                  placeholder="jane@company.com"
                  autoComplete="email"
                  disabled={submitting}
                  className={inputCls(!!errors.email)}
                />
              </Field>

              {/* 3. Phone Number (optional) */}
              <Field label="Phone Number" hint="(optional)">
                <input
                  type="tel"
                  inputMode="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1 555 000 0000"
                  autoComplete="tel"
                  disabled={submitting}
                  className={inputCls(false)}
                />
                <p className="mt-1 text-xs text-slate-400">
                  Used by HR if they need to reach you
                </p>
              </Field>

              {/* 4. Department (optional) */}
              <Field label="Department" hint="(optional)">
                {deptLoading ? (
                  <div className="flex items-center gap-2 h-12 px-4 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="h-4 w-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                    <span className="text-slate-400 text-sm">Loading…</span>
                  </div>
                ) : (
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    disabled={submitting}
                    className={inputCls(false) + " appearance-none bg-white"}
                  >
                    <option value="">Select department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>

              {/* 5. Job Title */}
              <Field label="Job Title" error={errors.jobTitle}>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => {
                    setJobTitle(e.target.value);
                    setErrors((p) => ({ ...p, jobTitle: "" }));
                  }}
                  placeholder="e.g. Software Engineer"
                  disabled={submitting}
                  className={inputCls(!!errors.jobTitle)}
                />
              </Field>

              {/* 6. Employee ID (optional) */}
              <Field label="Employee ID" hint="(optional)">
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="e.g. EMP-1234"
                  disabled={submitting}
                  className={inputCls(false)}
                />
                <p className="mt-1 text-xs text-slate-400">
                  Your company's internal employee ID if you know it
                </p>
              </Field>

              {/* 7. Password */}
              <Field label="Password" error={errors.password}>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrors((p) => ({ ...p, password: "" }));
                    }}
                    placeholder="Min 8 characters"
                    autoComplete="new-password"
                    disabled={submitting}
                    className={inputCls(!!errors.password) + " pr-11"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={submitting}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Password strength meter */}
                {password.length > 0 && (
                  <div className="mt-2">
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${pwdStrength.barColor}`}
                        style={{ width: pwdStrength.width }}
                      />
                    </div>
                    <p className={`text-xs mt-1 ${pwdStrength.labelColor}`}>
                      {pwdStrength.label}
                    </p>
                  </div>
                )}
              </Field>

              {/* 8. Confirm Password */}
              <Field label="Confirm Password" error={errors.confirmPassword}>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setErrors((p) => ({ ...p, confirmPassword: "" }));
                    }}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    disabled={submitting}
                    className={inputCls(!!errors.confirmPassword) + " pr-11"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    disabled={submitting}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </Field>

              {/* Submit error */}
              {submitError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-red-600 text-sm">{submitError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:shadow-lg hover:shadow-slate-900/20 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2 text-base"
              >
                {submitting ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Sending code…
                  </>
                ) : (
                  "Send Verification Code"
                )}
              </button>
            </form>
          </>
        )}
      </div>

      <Link
        to="/login"
        className="mt-6 text-xs text-slate-400 hover:text-slate-600 transition-colors"
      >
        Already have an account? Sign in
      </Link>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inputCls(hasError: boolean) {
  return [
    "w-full px-4 py-3.5 rounded-xl border text-sm",
    "focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500",
    "transition-all disabled:bg-slate-50 disabled:cursor-not-allowed",
    hasError ? "border-red-400" : "border-slate-200",
  ].join(" ");
}

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ label, hint, error, children }) => (
  <div>
    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 tracking-wider">
      {label}{" "}
      {hint && (
        <span className="normal-case font-normal text-slate-400">{hint}</span>
      )}
    </label>
    {children}
    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
  </div>
);

export default QRLanding;
