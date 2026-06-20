import React from 'react';

const DashboardHeader = ({ systemStatus }) => {
  const isOnline = systemStatus === 'online';

  return (
    <div className="flex items-center justify-between pb-6 mb-6 border-b border-[#141635] shrink-0">
      <h1 className="text-2xl font-black tracking-wider text-slate-100 glow-text-white">AI NOISE SUPPRESSION DASHBOARD</h1>
      <div className="flex items-center space-x-3 bg-[#0a0b1f]/60 border border-[#141635] px-4 py-1.5 rounded-full backdrop-blur-sm shadow-inner">
        <span className={`text-[10px] font-extrabold uppercase tracking-widest ${isOnline ? 'text-cyan-400 glow-text-cyan' : 'text-pink-400 glow-text-pink'}`}>
          {systemStatus || 'Offline'}
        </span>
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            isOnline
              ? 'bg-cyan-400 shadow-[0_0_10px_#06b6d4] animate-pulse'
              : 'bg-pink-500 shadow-[0_0_10px_#ec4899] animate-pulse'
          }`}
        />
      </div>
    </div>
  );
};

export default DashboardHeader;
