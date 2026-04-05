import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../config/firebase";
import { useAuth } from "../../context/AuthContext";
import { getDashboardPath } from "../../types/roles";

export const LoginForm: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const { user } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate(getDashboardPath(user.role));
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Navigation handled by useEffect watching `user`
    } catch (err: unknown) {
      console.error("Login Error:", err);
      if (
        err instanceof Error &&
        "code" in err &&
        (err as { code: string }).code === "auth/invalid-credential"
      ) {
        setError("Invalid email or password.");
      } else {
        setError("Failed to log in. Please try again later.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <h2 className="text-3xl font-semibold text-merit-navy mb-2">
        Welcome Back
      </h2>
      <p className="text-merit-slate mb-8 text-sm">
        Please enter your details to sign in.
      </p>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-sm font-medium border border-red-100">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-bold uppercase text-merit-slate mb-2 tracking-wider">
            Work Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-merit-emerald/20 focus:border-merit-emerald transition-all"
            placeholder="name@company.com"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase text-merit-slate mb-2 tracking-wider">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-merit-emerald/20 focus:border-merit-emerald transition-all"
            placeholder="••••••••"
            required
          />
        </div>
        <button
          disabled={isLoading}
          className="w-full bg-merit-navy text-white font-bold py-4 rounded-xl hover:shadow-lg hover:shadow-merit-navy/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isLoading ? "Signing In..." : "Sign In"}
        </button>
      </form>
    </div>
  );
};
