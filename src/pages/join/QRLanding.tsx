// =============================================================================
// QRLanding — Feature 1.3
// Entry point for employees who scan the QR code (or are redirected from
// ManualJoin after manual code validation).
//
// Route: /join/:code
//
// Two entry modes:
//   A) QR scan  — code comes from URL, page auto-validates on mount
//   B) Manual   — arrives from ManualJoin with location.state.preValidated
//                  skips validation step, goes straight to the form
// =============================================================================

import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../config/firebase";
import { Logo } from "../../components/Logo";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ValidateResult {
  success: boolean;
  companyId: string;
  companyName: string;
}

interface SubmitResult {
  success: boolean;
  registrationId: string;
}

interface LocationState {
  preValidated?: boolean;
  companyName?: string;
  companyId?: string;
}

interface RegistrationFields {
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  department: string;
}

type ValidationStatus = "idle" | "loading" | "success" | "error";

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

const Spinner: React.FC<{ className?: string }> = ({ className = "" }) => (
  <span
    className={`inline-block rounded-full border-2 border-current border-t-transparent animate-spin ${className}`}
  />
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const QRLanding: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;

  // --- Validation state ---
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>(
    state.preValidated ? "success" : "idle",
  );
  const [companyName, setCompanyName] = useState<string>(
    state.companyName ?? "",
  );
  const [companyId, setCompanyId] = useState<string>(state.companyId ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);

  // --- Registration form state ---
  const [fields, setFields] = useState<RegistrationFields>({
    firstName: "",
    lastName: "",
    email: "",
    jobTitle: "",
    department: "",
  });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof RegistrationFields, string>>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Prevent double-validation on StrictMode double-invoke
  const validated = useRef(false);

  // -------------------------------------------------------------------------
  // Auto-validate on mount (QR scan path)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (state.preValidated || validated.current || !code) return;
    validated.current = true;

    const validate = async () => {
      setValidationStatus("loading");
      setValidationError(null);

      try {
        const validateFn = httpsCallable<{ code: string }, ValidateResult>(
          functions,
          "validateCompanyCode",
        );
        const result = await validateFn({ code: code.toUpperCase() });
        setCompanyName(result.data.companyName);
        setCompanyId(result.data.companyId);
        setValidationStatus("success");
      } catch (err: unknown) {
        const fnErr = err as { code?: string };
        if (fnErr.code === "functions/resource-exhausted") {
          setValidationError(
            "Too many attempts. Please try again in a few minutes.",
          );
        } else {
          setValidationError(
            "This code is invalid or no longer active. Ask your HR team for a new link.",
          );
        }
        setValidationStatus("error");
      }
    };

    validate();
  }, [code, state.preValidated]);

  // -------------------------------------------------------------------------
  // Form field change handler
  // -------------------------------------------------------------------------
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFields((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    setSubmitError(null);
  };

  // -------------------------------------------------------------------------
  // Validate form fields, return true if valid
  // -------------------------------------------------------------------------
  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof RegistrationFields, string>> = {};

    if (!fields.firstName.trim()) errors.firstName = "First name is required.";
    if (!fields.lastName.trim()) errors.lastName = "Last name is required.";
    if (!fields.email.trim()) {
      errors.email = "Work email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) {
      errors.email = "Please enter a valid email address.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // -------------------------------------------------------------------------
  // Submit registration
  // -------------------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const submitFn = httpsCallable<
        {
          companyCode: string;
          firstName: string;
          lastName: string;
          email: string;
          jobTitle: string;
          department: string;
        },
        SubmitResult
      >(functions, "submitSelfRegistration");

      const result = await submitFn({
        companyCode: (code ?? "").toUpperCase(),
        firstName: fields.firstName.trim(),
        lastName: fields.lastName.trim(),
        email: fields.email.trim().toLowerCase(),
        jobTitle: fields.jobTitle.trim(),
        department: fields.department.trim(),
      });

      navigate("/join/verify", {
        state: {
          registrationId: result.data.registrationId,
          email: fields.email.trim().toLowerCase(),
          companyName,
          companyId,
        },
      });
    } catch (err: unknown) {
      const fnErr = err as { code?: string; message?: string };
      if (fnErr.code === "functions/resource-exhausted") {
        setSubmitError("Too many attempts. Please try again in a few minutes.");
      } else if (fnErr.code === "functions/already-exists") {
        setSubmitError(
          "A registration for this email is already in progress.",
        );
      } else {
        setSubmitError("Registration failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  const renderValidating = () => (
    <div className="flex flex-col items-center py-8 gap-4">
      <Spinner className="h-10 w-10 text-merit-emerald" />
      <p className="text-merit-slate text-sm">Verifying company code…</p>
    </div>
  );

  const renderValidationError = () => (
    <div className="py-6">
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 mb-6">
        <p className="text-red-600 text-sm font-medium">{validationError}</p>
      </div>
      <Link
        to="/join"
        className="w-full flex items-center justify-center gap-2 bg-merit-navy text-white font-bold py-4 rounded-xl hover:shadow-lg hover:shadow-merit-navy/20 transition-all"
      >
        Enter code manually
      </Link>
    </div>
  );

  const renderForm = () => (
    <>
      {/* Company confirmation badge */}
      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-6">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#10B981"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <span className="text-emerald-700 text-sm font-medium">
          Joining: {companyName}
        </span>
      </div>

      <h2 className="text-xl font-bold text-merit-navy mb-1">
        Complete Your Profile
      </h2>
      <p className="text-merit-slate text-sm mb-6">
        Your account will be reviewed by HR before activation.
      </p>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* First + Last name row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase text-merit-slate mb-1.5 tracking-wider">
              First Name
            </label>
            <input
              type="text"
              name="firstName"
              value={fields.firstName}
              onChange={handleChange}
              placeholder="Jane"
              autoComplete="given-name"
              disabled={isSubmitting}
              className={inputClass(!!fieldErrors.firstName)}
            />
            {fieldErrors.firstName && (
              <FieldError msg={fieldErrors.firstName} />
            )}
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-merit-slate mb-1.5 tracking-wider">
              Last Name
            </label>
            <input
              type="text"
              name="lastName"
              value={fields.lastName}
              onChange={handleChange}
              placeholder="Smith"
              autoComplete="family-name"
              disabled={isSubmitting}
              className={inputClass(!!fieldErrors.lastName)}
            />
            {fieldErrors.lastName && (
              <FieldError msg={fieldErrors.lastName} />
            )}
          </div>
        </div>

        {/* Work email */}
        <div>
          <label className="block text-xs font-bold uppercase text-merit-slate mb-1.5 tracking-wider">
            Work Email
          </label>
          <input
            type="email"
            name="email"
            value={fields.email}
            onChange={handleChange}
            placeholder="jane@company.com"
            autoComplete="email"
            inputMode="email"
            disabled={isSubmitting}
            className={inputClass(!!fieldErrors.email)}
          />
          {fieldErrors.email && <FieldError msg={fieldErrors.email} />}
        </div>

        {/* Job title */}
        <div>
          <label className="block text-xs font-bold uppercase text-merit-slate mb-1.5 tracking-wider">
            Job Title{" "}
            <span className="normal-case font-normal text-merit-slate/60">
              (optional)
            </span>
          </label>
          <input
            type="text"
            name="jobTitle"
            value={fields.jobTitle}
            onChange={handleChange}
            placeholder="e.g. Software Engineer"
            disabled={isSubmitting}
            className={inputClass(false)}
          />
        </div>

        {/* Department */}
        <div>
          <label className="block text-xs font-bold uppercase text-merit-slate mb-1.5 tracking-wider">
            Department{" "}
            <span className="normal-case font-normal text-merit-slate/60">
              (optional)
            </span>
          </label>
          <input
            type="text"
            name="department"
            value={fields.department}
            onChange={handleChange}
            placeholder="e.g. Engineering"
            disabled={isSubmitting}
            className={inputClass(false)}
          />
        </div>

        {/* Submit error */}
        {submitError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-red-600 text-sm">{submitError}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-merit-navy text-white font-bold py-4 rounded-xl hover:shadow-lg hover:shadow-merit-navy/20 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
        >
          {isSubmitting ? (
            <>
              <Spinner className="h-4 w-4" />
              <span>Submitting…</span>
            </>
          ) : (
            "Submit Registration"
          )}
        </button>
      </form>
    </>
  );

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-merit-bg font-brand flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 shadow-sm p-8 sm:p-10">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo />
        </div>

        {validationStatus === "loading" && renderValidating()}
        {validationStatus === "error" && renderValidationError()}
        {validationStatus === "success" && renderForm()}

        {/* Idle — should not normally display (auto-validates on mount) */}
        {validationStatus === "idle" && renderValidating()}
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

// ---------------------------------------------------------------------------
// Tiny helpers
// ---------------------------------------------------------------------------

function inputClass(hasError: boolean): string {
  return [
    "w-full px-4 py-3 rounded-xl border text-sm",
    "focus:outline-none focus:ring-2 focus:ring-merit-emerald/20 focus:border-merit-emerald",
    "transition-all disabled:bg-gray-50 disabled:cursor-not-allowed",
    hasError ? "border-red-400" : "border-gray-200",
  ].join(" ");
}

const FieldError: React.FC<{ msg: string }> = ({ msg }) => (
  <p className="mt-1 text-xs text-red-500">{msg}</p>
);

export default QRLanding;
