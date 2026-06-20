import React from 'react';

const NoiseLevelCard = ({ score = 0 }) => {
  const normalizedScore = Math.max(0, Math.min(100, score || 0));
  
  // Color coding details (lower is better):
  // Good: <= 30 (lime), Moderate: 31-65 (amber), Poor: > 65 (pink)
  let colorClass = 'stroke-lime-500 text-lime-400 glow-text-lime';
  let ratingText = 'Good';
  if (normalizedScore > 65) {
    colorClass = 'stroke-pink-500 text-pink-400 glow-text-pink';
    ratingText = 'Poor';
  } else if (normalizedScore > 30) {
    colorClass = 'stroke-amber-500 text-amber-400 glow-text-amber';
    ratingText = 'Moderate';
  }

  const radius = 24;
  const strokeWidth = 5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (normalizedScore / 100) * circumference;

  return (
    <div className="p-5 border border-[#141635] rounded-2xl bg-[#0a0b1f]/60 backdrop-blur-md flex items-center justify-between transition-all duration-300 hover:border-indigo-500/50 hover:shadow-[0_0_20px_rgba(99,102,241,0.15)] shadow-lg">
      <div>
        <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1.5 font-bold">Noise Level</div>
        <div className="flex items-baseline space-x-1.5">
          <span className="text-2xl font-black text-slate-100 glow-text-white">{normalizedScore}</span>
          <span className="text-xs text-slate-500 font-medium">/ 100</span>
        </div>
        <div className="text-[10px] mt-1 font-semibold text-slate-500 flex items-center gap-1">
          Rating: <span className={colorClass.split(' ').slice(1).join(' ') + ' font-bold'}>{ratingText}</span>
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

export default NoiseLevelCard;
