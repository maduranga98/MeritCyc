import React from "react";
import { AuthLayout } from "../components/auth/AuthLayout";
import { LoginForm } from "../components/auth/LoginForm";

const LoginPage: React.FC = () => {
  return (
    <AuthLayout>
      <LoginForm />
      <div className="mt-8 text-center">
        <p className="text-sm text-merit-slate">
          New to MeritCyc?{" "}
          <a href="#" className="text-merit-emerald font-bold hover:underline">
            Request access
          </a>
        </p>
      </div>
    </AuthLayout>
  );
};

export default LoginPage;
