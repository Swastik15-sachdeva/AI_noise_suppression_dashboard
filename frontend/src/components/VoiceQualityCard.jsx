import React from 'react';

const VoiceQualityCard = ({ clarity = 0 }) => {
  const normalizedClarity = Math.max(0, Math.min(100, clarity || 0));
  
  // Color coding details (higher is better):
  // Good: >= 75 (emerald), Moderate: 45-74 (amber), Poor: < 45 (rose)
  let colorClass = 'stroke-rose-500 text-rose-400';
  let ratingText = 'Poor';
  if (normalizedClarity >= 75) {
    colorClass = 'stroke-emerald-500 text-emerald-400';
    ratingText = 'Good';
  } else if (normalizedClarity >= 45) {
    colorClass = 'stroke-amber-500 text-amber-400';
    ratingText = 'Moderate';
  }

  const radius = 24;
  const strokeWidth = 5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (normalizedClarity / 100) * circumference;

  return (
    <div className="p-5 border border-slate-800/80 rounded-2xl bg-slate-900/40 backdrop-blur-md flex items-center justify-between transition-all duration-300 hover:border-slate-700/60 shadow-lg">
      <div>
        <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1.5 font-bold">Voice Clarity</div>
        <div className="flex items-baseline space-x-1.5">
          <span className="text-2xl font-bold text-white">{normalizedClarity}</span>
          <span className="text-xs text-slate-500 font-medium">/ 100</span>
        </div>
        <div className="text-[10px] mt-1 font-semibold text-slate-500 flex items-center gap-1">
          Rating: <span className={colorClass.split(' ')[1]}>{ratingText}</span>
        </div>
      </div>

      <div className="relative w-16 h-16 flex items-center justify-center flex-shrink-0">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="32"
            cy="32"
            r={radius}
            className="stroke-slate-800"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <circle
            cx="32"
            cy="32"
            r={radius}
            className={`${colorClass.split(' ')[0]} transition-all duration-500 ease-out`}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
};

export default VoiceQualityCard;
