// =============================================================================
// MeritCyc Login Page
// Email/password + Google SSO, role-based redirect, approval gate.
// =============================================================================

import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  type AuthError,
} from "firebase/auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { auth } from "../../config/firebase";
import { useAuth } from "../../context/AuthContext";
import { getDashboardPath } from "../../types/roles";
import { AuthLayout } from "../../components/auth/AuthLayout";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const googleProvider = new GoogleAuthProvider();

function getErrorMessage(code: string): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password. Please try again.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact your administrator.";
    case "auth/popup-closed-by-user":
      return "Sign-in popup was closed. Please try again.";
    case "auth/popup-blocked":
      return "Pop-up was blocked by your browser. Please allow pop-ups for this site.";
    default:
      return "Something went wrong. Please try again.";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const LoginPage: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  // Show session-expired or other reason messages on mount
  useEffect(() => {
    const reason = searchParams.get("reason");
    if (reason === "session_expired") {
      toast.info("Your session expired. Please sign in again.");
    } else if (reason === "unauthorized") {
      toast.error("You don't have permission to access that page.");
    }
  }, [searchParams]);

  // Redirect if already authenticated and fully resolved.
  // Users who signed up but haven't completed company setup have no
  // companyId yet — send them to /onboarding so the completeOnboarding
  // Cloud Function can populate their custom claims.
  useEffect(() => {
    if (!user || loading) return;
    if (!user.companyId && user.role !== "platform_admin") {
      navigate("/onboarding", { replace: true });
      return;
    }
    navigate(getDashboardPath(user.role), { replace: true });
  }, [user, loading, navigate]);

  // ---------------------------------------------------------------------------
  // Post-login: verify token, then redirect
  // ---------------------------------------------------------------------------
  const handlePostLogin = async (): Promise<boolean> => {
    const currentUser = auth.currentUser;
    if (!currentUser) return false;

    try {
      await currentUser.getIdTokenResult(true);
      return true;
    } catch {
      await signOut(auth);
      toast.error("Unable to verify your account. Please try again.");
      return false;
    }
  };

  // ---------------------------------------------------------------------------
  // Email/password submit
  // ---------------------------------------------------------------------------
  const onSubmit = async (data: LoginFormValues) => {
    setIsEmailLoading(true);
    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
      const ok = await handlePostLogin();
      if (!ok) return;
      // Navigation handled by useEffect watching `user` from AuthContext
    } catch (err: unknown) {
      const code = (err as AuthError).code ?? "";
      toast.error(getErrorMessage(code));
    } finally {
      setIsEmailLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Google SSO
  // ---------------------------------------------------------------------------
  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      const ok = await handlePostLogin();
      if (!ok) return;
    } catch (err: unknown) {
      const code = (err as AuthError).code ?? "";
      toast.error(getErrorMessage(code));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const isLoading = isEmailLoading || isGoogleLoading;

  return (
    <AuthLayout>
      <div className="w-full max-w-md">
        <h2 className="text-3xl font-semibold text-merit-navy mb-2">
          Welcome Back
        </h2>
        <p className="text-merit-slate mb-8 text-sm">
          Sign in to your MeritCyc account.
        </p>

        {/* Google SSO */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-merit-navy font-medium transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed mb-6"
        >
          {isGoogleLoading ? (
            <div className="h-5 w-5 rounded-full border-2 border-merit-slate border-t-transparent animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          <span>Continue with Google</span>
        </button>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-3 bg-merit-bg text-merit-slate uppercase tracking-wider font-medium">
              or
            </span>
          </div>
        </div>

        {/* Email / password form */}
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

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase text-merit-slate tracking-wider">
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-xs text-merit-emerald font-medium hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                {...register("password")}
                autoComplete="current-password"
                placeholder="••••••••"
                disabled={isLoading}
                className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-merit-emerald/20 focus:border-merit-emerald transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-merit-slate hover:text-merit-navy transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-500 text-sm mt-1">
                {errors.password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-merit-navy text-white font-bold py-4 rounded-xl hover:shadow-lg hover:shadow-merit-navy/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isEmailLoading ? (
              <>
                <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>Signing In…</span>
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        {/* ── Registration links footer ── */}
        <div className="mt-8 space-y-3">
          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-100" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-merit-bg text-merit-slate">
                New to MeritCyc?
              </span>
            </div>
          </div>

          {/* Join with company code — for employees */}
          <Link
            to="/join"
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-merit-navy font-medium transition-all active:scale-[0.98] text-sm"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <path d="M14 14h3v3h-3zM17 17h3v3h-3zM14 20h3" />
            </svg>
            Join with a company code
          </Link>

          {/* Register a new company — for HR / founders */}
          <p className="text-center text-xs text-merit-slate">
            Setting up MeritCyc for your company?{" "}
            <Link
              to="/signup"
              className="text-merit-emerald font-semibold hover:underline"
            >
              Register your company →
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
};

// ---------------------------------------------------------------------------
// Icon sub-components
// ---------------------------------------------------------------------------

const GoogleIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path
      d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
      fill="#4285F4"
    />
    <path
      d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      fill="#34A853"
    />
    <path
      d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
      fill="#FBBC05"
    />
    <path
      d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
      fill="#EA4335"
    />
  </svg>
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

export default LoginPage;
