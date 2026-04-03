import React from "react";
import { Logo } from "../Logo";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-merit-bg font-brand flex flex-col lg:flex-row">
      {/* LEFT SIDE - BRANDING (Desktop only) */}
      <div className="hidden lg:flex w-1/2 bg-white flex-col items-center justify-center p-12 border-r border-gray-100 shadow-[inset_-10px_0_20px_-15px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col items-center gap-8 animate-in fade-in slide-in-from-left duration-700">
          {/* Logo Container */}
          <div className="transform scale-125 mb-4" aria-label="MeritCyc Logo">
            <Logo />
          </div>

          <div className="space-y-3 text-center">
            <p className="text-merit-slate text-lg max-w-sm leading-relaxed">
              Precision in Pay. <br />
              <span className="font-medium text-merit-emerald/80">
                Clarity in Growth.
              </span>
            </p>
          </div>

          {/* Decorative Divider */}
          <div className="w-12 h-1 bg-merit-emerald/20 rounded-full"></div>
        </div>
      </div>

      {/* RIGHT SIDE - CONTENT (Form Area) */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 lg:p-20 relative overflow-hidden">
        {/* Mobile Header (Shows only on mobile) */}
        <div className="lg:hidden mb-10 flex flex-col items-center">
          <Logo />
          <p className="mt-4 text-merit-navy font-bold text-xl">MeritCyc</p>
        </div>

        {/* The Form (Children) */}
        <div className="w-full max-w-md z-10">{children}</div>

        {/* Subtle Background Decorative Element */}
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-merit-emerald/5 rounded-full blur-3xl pointer-events-none"></div>
      </div>
    </div>
  );
};
