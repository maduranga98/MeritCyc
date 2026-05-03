import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../config/firebase";

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [invitePreview, setInvitePreview] = useState<any>(null);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchPreview() {
      if (!token) {
        setError("Invalid or missing token.");
        setLoading(false);
        return;
      }

      try {
        const functions = getFunctions();
        const getInvitePreview = httpsCallable(functions, "getInvitePreview");
        const result = await getInvitePreview({ token });
        setInvitePreview(result.data);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        console.error("Error fetching invite:", err);
        setError("Error fetching invitation details.");
      } finally {
        setLoading(false);
      }
    }

    fetchPreview();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setSubmitting(true);
    setError(null);

    try {
      const functions = getFunctions();
      const acceptInvite = httpsCallable(functions, "acceptInvite");

      await acceptInvite({ token, password });

      // If they provided a password, it means they are likely a new user,
      // or at least we can attempt to log them in directly
      if (password) {
        await signInWithEmailAndPassword(auth, invitePreview.email, password);
      } else {
        // If no password provided, maybe they are already logged in? Or we should redirect them to login page
        navigate("/login");
        return;
      }

      // Successful acceptance and login
      // Wait a tick for claims to propagate or AuthContext to catch up
      setTimeout(() => {
        // Force refresh user token to get custom claims
        auth.currentUser?.getIdToken(true).then(() => {
          navigate("/"); // Let ProtectedRoute and App.tsx handle redirect based on role
        });
      }, 500);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error("Error accepting invite:", err);
      setError(err.message || "Failed to accept invite.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-brand bg-merit-bg">
        <p className="text-merit-slate">Loading invitation...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center font-brand bg-merit-bg">
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-100 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-merit-slate mb-6">{error}</p>
          <button
            onClick={() => navigate("/")}
            className="text-merit-emerald font-medium hover:underline"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center font-brand bg-merit-bg">
      <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-100 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-merit-navy mb-2">Accept Invitation</h1>
          <p className="text-merit-slate">
            You've been invited to join <span className="font-semibold">{invitePreview?.companyName}</span> as a <span className="font-semibold">{invitePreview?.role}</span>.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-merit-navy mb-1">Email</label>
            <input
              type="email"
              value={invitePreview?.email || ""}
              disabled
              className="w-full px-4 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-merit-navy mb-1">
              Set Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-merit-emerald/20 focus:border-merit-emerald outline-none transition-all"
              placeholder="Minimum 6 characters"
            />
            <p className="text-xs text-gray-500 mt-1">
              If you already have an account, enter your existing password to link your account.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting || password.length < 6}
            className="w-full bg-merit-emerald hover:bg-merit-emerald/90 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50"
          >
            {submitting ? "Accepting..." : "Accept Invitation"}
          </button>
        </form>
      </div>
    </div>
  );
}
