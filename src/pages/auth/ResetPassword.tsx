// =============================================================================
// MeritCyc Reset Password Page
// Handles Firebase oobCode flow: ?mode=resetPassword&oobCode=<code>
// =============================================================================

import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import {
  verifyPasswordResetCode,
  confirmPasswordReset,
  type AuthError,
} from "firebase/auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { auth } from "../../config/firebase";
import { AuthLayout } from "../../components/auth/AuthLayout";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const resetSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain at least one uppercase letter")
      .regex(/[0-9]/, "Must contain at least one number"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type ResetFormValues = z.infer<typeof resetSchema>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type PageState = "verifying" | "ready" | "invalid" | "success";

const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>("verifying");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const oobCode = searchParams.get("oobCode") ?? "";
  const mode = searchParams.get("mode");

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
  });

  // ---------------------------------------------------------------------------
  // Verify the oobCode on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (mode !== "resetPassword" || !oobCode) {
      setPageState("invalid");
      return;
    }

    verifyPasswordResetCode(auth, oobCode)
      .then(() => setPageState("ready"))
      .catch(() => setPageState("invalid"));
  }, [oobCode, mode]);

  // ---------------------------------------------------------------------------
  // Submit new password
  // ---------------------------------------------------------------------------
  const onSubmit = async (data: ResetFormValues) => {
    setIsLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, data.password);
      setPageState("success");
      toast.success("Password updated! Please sign in with your new password.");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err: unknown) {
      const code = (err as AuthError).code ?? "";
      if (code === "auth/expired-action-code") {
        toast.error("This reset link has expired. Please request a new one.");
        setPageState("invalid");
      } else if (code === "auth/invalid-action-code") {
        toast.error("This reset link is invalid or has already been used.");
        setPageState("invalid");
      } else if (code === "auth/weak-password") {
        toast.error("Password is too weak. Please choose a stronger password.");
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const password = watch("password", "");

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------

  if (pageState === "verifying") {
    return (
      <AuthLayout>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 rounded-full border-4 border-merit-emerald border-t-transparent animate-spin" />
        </div>
      </AuthLayout>
    );
  }

  if (pageState === "invalid") {
    return (
      <AuthLayout>
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#EF4444"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-merit-navy mb-3">
            Invalid Reset Link
          </h2>
          <p className="text-merit-slate text-sm mb-8">
            This password reset link is invalid or has expired. Please request a
            new one.
          </p>
          <Link
            to="/forgot-password"
            className="inline-flex items-center gap-2 px-6 py-3 bg-merit-navy text-white font-bold rounded-xl hover:shadow-lg transition-all"
          >
            Request New Link
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (pageState === "success") {
    return (
      <AuthLayout>
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-merit-emerald/10 flex items-center justify-center">
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
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-merit-navy mb-3">
            Password Updated
          </h2>
          <p className="text-merit-slate text-sm">
            Redirecting you to sign in…
          </p>
        </div>
      </AuthLayout>
    );
  }

  // pageState === "ready"
  return (
    <AuthLayout>
      <div className="w-full max-w-md">
        <h2 className="text-3xl font-semibold text-merit-navy mb-2">
          Set New Password
        </h2>
        <p className="text-merit-slate mb-8 text-sm">
          Choose a strong password for your account.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* New password */}
          <div>
            <label className="block text-xs font-bold uppercase text-merit-slate mb-2 tracking-wider">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                {...register("password")}
                autoComplete="new-password"
                placeholder="••••••••"
                disabled={isLoading}
                className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-merit-emerald/20 focus:border-merit-emerald transition-all disabled:bg-gray-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-merit-slate hover:text-merit-navy transition-colors"
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-500 text-sm mt-1">
                {errors.password.message}
              </p>
            )}
            {/* Strength hints */}
            {password.length > 0 && (
              <div className="mt-2 space-y-1">
                <StrengthHint
                  met={password.length >= 8}
                  label="At least 8 characters"
                />
                <StrengthHint
                  met={/[A-Z]/.test(password)}
                  label="One uppercase letter"
                />
                <StrengthHint met={/[0-9]/.test(password)} label="One number" />
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-xs font-bold uppercase text-merit-slate mb-2 tracking-wider">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                {...register("confirmPassword")}
                autoComplete="new-password"
                placeholder="••••••••"
                disabled={isLoading}
                className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-merit-emerald/20 focus:border-merit-emerald transition-all disabled:bg-gray-50"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-merit-slate hover:text-merit-navy transition-colors"
              >
                {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-red-500 text-sm mt-1">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-merit-navy text-white font-bold py-4 rounded-xl hover:shadow-lg hover:shadow-merit-navy/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>Updating…</span>
              </>
            ) : (
              "Update Password"
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm text-merit-emerald font-bold hover:underline"
          >
            <BackArrowIcon />
            Back to Sign In
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const StrengthHint: React.FC<{ met: boolean; label: string }> = ({
  met,
  label,
}) => (
  <div className="flex items-center gap-2">
    <div
      className={`w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 ${
        met ? "bg-merit-emerald" : "bg-gray-200"
      }`}
    >
      {met && (
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
          <path
            d="M1.5 4L3 5.5L6.5 2"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
    <span className={`text-xs ${met ? "text-merit-emerald" : "text-merit-slate"}`}>
      {label}
    </span>
  </div>
);

const EyeIcon: React.FC = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon: React.FC = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const BackArrowIcon: React.FC = () => (
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
    <path d="m15 18-6-6 6-6" />
  </svg>
);

export default ResetPasswordPage;
