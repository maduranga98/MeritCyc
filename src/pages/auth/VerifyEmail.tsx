// =============================================================================
// MeritCyc Email Verification Page
// User verifies their email after signup.
// =============================================================================

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { applyActionCode } from "firebase/auth";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { auth } from "../../config/firebase";
import { AuthLayout } from "../../components/auth/AuthLayout";

const VerifyEmailPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get("oobCode");
  const [status, setStatus] = useState<
    "verifying" | "success" | "error" | "waiting"
  >(() => (oobCode ? "verifying" : "waiting"));

  useEffect(() => {
    if (!oobCode) return;

    let cancelled = false;
    applyActionCode(auth, oobCode)
      .then(() => {
        if (cancelled) return;
        setStatus("success");
        toast.success("Email verified successfully! Redirecting to sign in...");
        setTimeout(() => {
          if (!cancelled) navigate("/", { replace: true });
        }, 2000);
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus("error");
        console.error("Email verification error:", err);
        toast.error(
          "Email verification failed. The link may be expired or invalid."
        );
      });

    return () => {
      cancelled = true;
    };
  }, [oobCode, navigate]);

  return (
    <AuthLayout>
      <div className="w-full max-w-md">
        <div className="text-center">
          {status === "waiting" && (
            <>
              <h2 className="text-3xl font-semibold text-merit-navy mb-4">
                Check Your Email
              </h2>
              <p className="text-merit-slate mb-8">
                We've sent you a verification link. Click it to verify your email
                and complete your registration.
              </p>
              <div className="flex justify-center mb-6">
                <div className="h-12 w-12 rounded-full bg-merit-emerald/10 flex items-center justify-center">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-merit-emerald"
                  >
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </div>
              </div>
              <a
                href="/"
                className="text-merit-emerald font-semibold hover:underline"
              >
                Back to Sign In
              </a>
            </>
          )}

          {status === "verifying" && (
            <>
              <div className="h-12 w-12 rounded-full border-4 border-merit-emerald border-t-transparent animate-spin mx-auto mb-6" />
              <h2 className="text-2xl font-semibold text-merit-navy mb-2">
                Verifying Email
              </h2>
              <p className="text-merit-slate">
                Please wait while we verify your email address...
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="h-12 w-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-6">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-green-600"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-merit-navy mb-2">
                Email Verified!
              </h2>
              <p className="text-merit-slate mb-6">
                Your email has been verified successfully. Redirecting to sign
                in...
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-red-600"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-merit-navy mb-2">
                Verification Failed
              </h2>
              <p className="text-merit-slate mb-6">
                The verification link is invalid or has expired. Try signing
                up again or contact support.
              </p>
              <a
                href="/"
                className="text-merit-emerald font-semibold hover:underline"
              >
                Back to Sign In
              </a>
            </>
          )}
        </div>
      </div>
    </AuthLayout>
  );
};

export default VerifyEmailPage;
