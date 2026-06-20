import React from 'react';

const VoiceQualityCard = ({ clarity = 0, stoi = 1.0 }) => {
  const normalizedClarity = Math.max(0, Math.min(100, clarity || 0));
  const normalizedStoi = stoi !== undefined ? stoi : 1.0;
  
  // Color coding details (higher is better):
  // Good: >= 75 (lime), Moderate: 45-74 (amber), Poor: < 45 (pink)
  let ratingColorClass = 'text-pink-500 glow-text-pink';
  let ratingText = 'Poor';
  if (normalizedClarity >= 75) {
    ratingColorClass = 'text-lime-400 glow-text-lime';
    ratingText = 'Good';
  } else if (normalizedClarity >= 45) {
    ratingColorClass = 'text-amber-400 glow-text-amber';
    ratingText = 'Moderate';
  }

  // Clarity is a clarity metric, so we use aqua highlights globally for this metric
  const circleColorClass = 'stroke-cyan-400';

  const radius = 24;
  const strokeWidth = 5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (normalizedClarity / 100) * circumference;

  return (
    <div className="p-5 border border-[#141635] rounded-2xl bg-[#0a0b1f]/60 backdrop-blur-md flex items-center justify-between transition-all duration-300 hover:border-indigo-500/50 hover:shadow-[0_0_20px_rgba(99,102,241,0.15)] shadow-lg">
      <div>
        <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1.5 font-bold">Voice Clarity</div>
        <div className="flex items-baseline space-x-1.5">
          <span className="text-2xl font-black text-cyan-400 glow-text-cyan">{normalizedClarity}</span>
          <span className="text-xs text-slate-500 font-medium">/ 100</span>
        </div>
        <div className="text-[9px] mt-1 font-semibold text-slate-500 flex flex-col gap-0.5">
          <div>Rating: <span className={`${ratingColorClass} font-bold`}>{ratingText}</span></div>
          <div>STOI Score: <span className="text-cyan-400 font-bold">{normalizedStoi.toFixed(2)}</span></div>
        </div>
      </div>

      <div className="relative w-16 h-16 flex items-center justify-center flex-shrink-0">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="32"
            cy="32"
            r={radius}
            className="stroke-[#141635]"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <circle
            cx="32"
            cy="32"
            r={radius}
            className={`${circleColorClass} transition-all duration-500 ease-out`}
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
