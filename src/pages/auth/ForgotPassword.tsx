// =============================================================================
// MeritCyc Forgot Password Page
// Sends a Firebase password-reset email.
// =============================================================================

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { sendPasswordResetEmail, type AuthError } from "firebase/auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { auth } from "../../config/firebase";
import { AuthLayout } from "../../components/auth/AuthLayout";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const forgotSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ForgotFormValues = z.infer<typeof forgotSchema>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ForgotPasswordPage: React.FC = () => {
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema),
  });

  const onSubmit = async (data: ForgotFormValues) => {
    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, data.email);
      setSentEmail(data.email);
      setSent(true);
    } catch (err: unknown) {
      const code = (err as AuthError).code ?? "";
      // Don't reveal whether the email exists — show generic success instead
      if (code === "auth/user-not-found") {
        setSentEmail(data.email);
        setSent(true);
      } else if (code === "auth/network-request-failed") {
        toast.error("Network error. Check your connection and try again.");
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Success state
  // ---------------------------------------------------------------------------
  if (sent) {
    return (
      <AuthLayout>
        <div className="w-full max-w-md text-center">
          {/* Envelope icon */}
          <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-merit-emerald/10 flex items-center justify-center">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#10B981"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>

          <h2 className="text-2xl font-semibold text-merit-navy mb-3">
            Check your email
          </h2>
          <p className="text-merit-slate text-sm mb-2">
            If an account exists for{" "}
            <span className="font-medium text-merit-navy">{sentEmail}</span>, a
            password-reset link has been sent.
          </p>
          <p className="text-merit-slate text-sm mb-8">
            Check your spam folder if you don't see it within a few minutes.
          </p>

          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm text-merit-emerald font-bold hover:underline"
          >
            <BackArrowIcon />
            Back to Sign In
          </Link>
        </div>
      </AuthLayout>
    );
  }

  // ---------------------------------------------------------------------------
  // Form state
  // ---------------------------------------------------------------------------
  return (
    <AuthLayout>
      <div className="w-full max-w-md">
        <h2 className="text-3xl font-semibold text-merit-navy mb-2">
          Reset Password
        </h2>
        <p className="text-merit-slate mb-8 text-sm">
          Enter the email associated with your account and we'll send a reset
          link.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase text-merit-slate mb-2 tracking-wider">
              Work Email
            </label>
            <input
              type="email"
              {...register("email")}
              autoComplete="email"
              placeholder="name@company.com"
              disabled={isLoading}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-merit-emerald/20 focus:border-merit-emerald transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
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
                <span>Sending…</span>
              </>
            ) : (
              "Send Reset Link"
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

export default ForgotPasswordPage;
