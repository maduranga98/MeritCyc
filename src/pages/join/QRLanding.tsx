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
//   Step 2 — registration form (name, email, department, jobTitle)
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
// Component
// ---------------------------------------------------------------------------

const QRLanding: React.FC = () => {
  const { companyCode } = useParams<{ companyCode: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const locState = (location.state ?? {}) as LocationState;

  // ── Step 1: validation ─────────────────────────────────────────────────
  type Step = "validating" | "invalid" | "form";
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
  const [departmentId, setDepartmentId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptLoading, setDeptLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
        },
        SubmitResult
      >(functions, "submitSelfRegistration");

      await fn({
        companyCode: (companyCode ?? "").toUpperCase(),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        departmentId,
        jobTitle: jobTitle.trim(),
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
              {/* Full Name */}
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

              {/* Work Email */}
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

              {/* Department */}
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

              {/* Job Title */}
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
