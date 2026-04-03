import React, { useState } from "react";

export const LoginForm: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Logging in with:", { email, password });
    // මෙතනට Firebase Sign-in logic එක පසුව එකතු කරමු
  };

  return (
    <div className="w-full max-w-md">
      <h2 className="text-3xl font-semibold text-merit-navy mb-2">
        Welcome Back
      </h2>
      <p className="text-merit-slate mb-8 text-sm">
        Please enter your details to sign in.
      </p>

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
          />
        </div>
        <button className="w-full bg-merit-navy text-white font-bold py-4 rounded-xl hover:shadow-lg hover:shadow-merit-navy/20 transition-all active:scale-[0.98]">
          Sign In
        </button>
      </form>
    </div>
  );
};
