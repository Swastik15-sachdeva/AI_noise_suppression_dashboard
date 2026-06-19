import React from 'react';

const DashboardHeader = ({ systemStatus }) => {
  const isOnline = systemStatus === 'online';

  return (
    <div className="flex items-center justify-between pb-6 mb-6 border-b border-slate-800/80 shrink-0">
      <h1 className="text-xl font-semibold tracking-tight text-white">AI Noise Suppression Dashboard</h1>
      <div className="flex items-center space-x-3 bg-slate-900/40 border border-slate-800 px-3 py-1.5 rounded-full backdrop-blur-sm">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          {systemStatus || 'Offline'}
        </span>
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            isOnline
              ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse'
              : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)] animate-pulse'
          }`}
        />
      </div>
    </div>
  );
};

export default DashboardHeader;
