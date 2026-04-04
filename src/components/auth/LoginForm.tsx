import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, type Role } from "../../context/AuthContext";

export const LoginForm: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Mock authentication logic based on email
    let role: Role = null;
    let redirectPath = "";

    if (email.startsWith("superadmin")) {
      role = "Super Admin";
      redirectPath = "/dashboard/super-admin";
    } else if (email.startsWith("admin")) {
      role = "Admin";
      redirectPath = "/dashboard/admin";
    } else if (email.startsWith("hr")) {
      role = "HR Admin";
      redirectPath = "/dashboard/hr-admin";
    } else if (email.startsWith("manager")) {
      role = "Manager";
      redirectPath = "/dashboard/manager";
    } else if (email.startsWith("employee")) {
      role = "Employee";
      redirectPath = "/dashboard/employee";
    }

    if (role) {
      login(email, role);
      navigate(redirectPath);
    } else {
      alert("Invalid email. Please use a role-based prefix like superadmin@, admin@, hr@, manager@, or employee@");
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
