import React from 'react';

const LatencyCard = ({ latency = 0 }) => {
  const safeLatency = latency || 0;
  
  // Color coding details (lower is better):
  // Good: < 80ms (lime), Moderate: 80-149ms (amber), Poor: >= 150ms (pink)
  let colorClass = 'stroke-lime-500 text-lime-400 glow-text-lime';
  let ratingText = 'Good';
  if (safeLatency >= 150) {
    colorClass = 'stroke-pink-500 text-pink-400 glow-text-pink';
    ratingText = 'Poor';
  } else if (safeLatency >= 80) {
    colorClass = 'stroke-amber-500 text-amber-400 glow-text-amber';
    ratingText = 'Moderate';
  }

  // Calculate fill percentage relative to a max threshold of 200ms
  const fillPercentage = Math.min(100, Math.max(0, (safeLatency / 200) * 100));

  const radius = 24;
  const strokeWidth = 5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (fillPercentage / 100) * circumference;

  return (
    <div className="p-5 border border-[#141635] rounded-2xl bg-[#0a0b1f]/60 backdrop-blur-md flex items-center justify-between transition-all duration-300 hover:border-indigo-500/50 hover:shadow-[0_0_20px_rgba(99,102,241,0.15)] shadow-lg">
      <div>
        <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1.5 font-bold">Latency</div>
        <div className="flex items-baseline space-x-1.5">
          <span className="text-2xl font-black text-slate-100 glow-text-white">{safeLatency}</span>
          <span className="text-xs text-slate-500 font-medium">ms</span>
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

export default LatencyCard;
