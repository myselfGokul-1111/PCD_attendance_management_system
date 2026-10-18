import React from 'react';

interface PcdEmblemProps {
  className?: string;
  size?: number;
}

export const PcdEmblem: React.FC<PcdEmblemProps> = ({ className = '', size = 32 }) => {
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative shrink-0 flex items-center justify-center rounded-xl bg-gradient-to-br from-neutral-900 to-neutral-800 text-white font-extrabold shadow-xs border border-neutral-700/60 select-none ${className}`}
    >
      {/* Tri-color indicator for YRC (Red), NSS (Blue), NSO (Green) */}
      <div className="absolute -top-1 -right-1 flex gap-0.5">
        <span className="w-2 h-2 rounded-full bg-red-500 ring-1 ring-white shadow-xs" title="YRC (Red)" />
        <span className="w-2 h-2 rounded-full bg-blue-500 ring-1 ring-white shadow-xs" title="NSS (Blue)" />
        <span className="w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white shadow-xs" title="NSO (Green)" />
      </div>
      <span className="text-[11px] font-black tracking-tight leading-none text-neutral-100">
        PCD
      </span>
    </div>
  );
};
