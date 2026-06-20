import React from 'react';

const MicrophoneStatusCard = ({ status }) => {
  const isConnected = status === 'connected';

  return (
    <div className="p-5 border border-[#141635] rounded-2xl bg-[#0a0b1f]/60 backdrop-blur-md flex items-center justify-between transition-all duration-300 hover:border-indigo-500/50 hover:shadow-[0_0_20px_rgba(99,102,241,0.15)] shadow-lg">
      <div>
        <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1.5 font-bold">Microphone</div>
        <div className="text-2xl font-black text-slate-100 capitalize tracking-wide glow-text-white">{status || 'Unknown'}</div>
        <div className="text-[10px] mt-1 font-semibold text-slate-500 flex items-center gap-1">
          Status:{' '}
          <span className={isConnected ? 'text-cyan-400 glow-text-cyan font-bold' : 'text-pink-500 glow-text-pink font-bold'}>
            {isConnected ? 'Active' : 'Offline'}
          </span>
        </div>
      </div>

      <div className="relative w-12 h-12 flex items-center justify-center rounded-xl bg-[#141635]/50 border border-[#1e293b] text-slate-300">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-6 h-6 text-slate-300"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
          />
        </svg>
        {/* Pulsing indicator */}
        <span
          className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border border-[#040510] ${
            isConnected
              ? 'bg-cyan-400 shadow-[0_0_8px_#06b6d4] animate-ping'
              : 'bg-pink-500 shadow-[0_0_8px_#ec4899] animate-ping'
          }`}
        />
        <span
          className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border border-[#040510] ${
            isConnected ? 'bg-cyan-400' : 'bg-pink-500'
          }`}
        />
      </div>
    </div>
  );
};

export default MicrophoneStatusCard;
