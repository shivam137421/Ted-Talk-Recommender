import React from "react";

export const SkeletonCard: React.FC = () => {
  return (
    <div className="flex flex-col bg-white border border-[#E5E2DC] rounded-lg overflow-hidden animate-pulse">
      <div className="bg-[#F5F3EE] p-5 border-b border-[#E5E2DC] space-y-3">
        <div className="flex justify-between items-center">
          <div className="w-16 h-4 bg-neutral-200 rounded"></div>
          <div className="w-12 h-4 bg-neutral-200 rounded"></div>
        </div>
        <div className="w-8 h-0.5 bg-neutral-200"></div>
        <div className="w-24 h-3 bg-neutral-200 rounded"></div>
        <div className="w-full h-5 bg-neutral-200 rounded"></div>
      </div>
      <div className="p-4 space-y-3 flex-1">
        <div className="w-full h-3 bg-neutral-100 rounded"></div>
        <div className="w-4/5 h-3 bg-neutral-100 rounded"></div>
        <div className="pt-3 border-t border-neutral-100 flex justify-between items-center">
          <div className="w-16 h-3 bg-neutral-100 rounded"></div>
          <div className="w-20 h-6 bg-neutral-100 rounded"></div>
        </div>
      </div>
    </div>
  );
};

