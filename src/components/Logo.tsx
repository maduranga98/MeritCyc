// src/components/Logo.tsx
import React from "react";

export const Logo: React.FC = () => {
  return (
    <div className="flex items-center gap-2">
      {/* Icon */}
      <div className="relative h-7 w-7 flex items-end gap-[3px]">
        {/* Bars */}
        <div className="w-[6px] h-3 bg-merit-slate rounded-sm opacity-60"></div>
        <div className="w-[6px] h-5 bg-merit-slate rounded-sm opacity-80"></div>
        <div className="w-[6px] h-full bg-merit-emerald rounded-sm"></div>

        {/* Arc - Can be done with a pseudo-element or a simple div */}
        <div className="absolute top-[-3px] left-0 w-full h-full border-t-[3px] border-l-[3px] border-merit-emerald rounded-full opacity-40 transform -rotate-12"></div>
      </div>

      {/* Text */}
      <h1 className="text-3xl font-brand text-merit-navy">
        Merit<span className="font-regular text-merit-emerald">Cyc</span>
      </h1>
    </div>
  );
};
