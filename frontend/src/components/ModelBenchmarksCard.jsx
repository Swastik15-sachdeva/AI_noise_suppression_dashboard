import React from 'react';

const ModelBenchmarksCard = ({ selectedModel = 'noisereduce', onModelSelect }) => {
  const models = [
    {
      id: 'noisereduce',
      name: 'Spectral Gating (noisereduce)',
      type: 'Classical DSP',
      stoi: '0.80 - 0.84',
      latency: '< 3 ms',
      footprint: 'Ultra-Low (CPU)',
      useCase: 'Call Centers (High scale, low cost)',
      accentColor: 'cyan',
    },
    {
      id: 'rnnoise',
      name: 'RNNoise (GRU)',
      type: 'Hybrid Deep Learning',
      stoi: '0.85 - 0.88',
      latency: '~10 ms',
      footprint: 'Low (CPU/ONNX)',
      useCase: 'Video Conferencing (Low latency CPU)',
      accentColor: 'purple',
    },
    {
      id: 'dtln',
      name: 'DTLN (LSTM-FFT)',
      type: 'Dual-Signal LSTM',
      stoi: '0.90 - 0.93',
      latency: '~15 ms',
      footprint: 'Medium (CPU/ONNX)',
      useCase: 'Smart Speakers / Mobile VoIP',
      accentColor: 'indigo',
    },
  ];

  const accentClasses = {
    cyan: {
      row: 'bg-cyan-500/5 border-l-2 border-l-cyan-500',
      badge: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',
      stoi: 'text-cyan-300',
      hover: 'hover:bg-cyan-500/10 hover:border-l-cyan-400',
    },
    purple: {
      row: 'bg-purple-500/5 border-l-2 border-l-purple-500',
      badge: 'bg-purple-500/15 text-purple-300 border border-purple-500/30',
      stoi: 'text-purple-300',
      hover: 'hover:bg-purple-500/10 hover:border-l-purple-400',
    },
    indigo: {
      row: 'bg-indigo-500/5 border-l-2 border-l-indigo-500',
      badge: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30',
      stoi: 'text-indigo-300',
      hover: 'hover:bg-indigo-500/10 hover:border-l-indigo-400',
    },
  };

  return (
    <div className="p-6 border border-[#141635] rounded-2xl bg-[#0a0b1f]/60 backdrop-blur-md shadow-xl hover:border-indigo-500/30 hover:shadow-[0_0_20px_rgba(99,102,241,0.15)] transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-100 glow-text-white">AI Model Benchmarks &amp; Comparison</h3>
          <span className="text-[10px] text-slate-400 font-medium">
            Click a row to select the active suppression model for live mic &amp; recording
          </span>
        </div>
        <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          DSP &amp; Deep Learning
        </span>
      </div>

      {/* Benchmarks Table */}
      <div className="overflow-x-auto mt-4 rounded-xl border border-[#141635] bg-[#040510]/40">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#141635] bg-[#040510]/80 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
              <th className="p-3.5">Model</th>
              <th className="p-3.5">Type</th>
              <th className="p-3.5">STOI Range</th>
              <th className="p-3.5">Latency</th>
              <th className="p-3.5">Resource Footprint</th>
              <th className="p-3.5">Primary Use Case</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#141635] text-xs text-slate-300">
            {models.map((model) => {
              const isSelected = selectedModel === model.id;
              const accent = accentClasses[model.accentColor];
              return (
                <tr
                  key={model.id}
                  onClick={() => onModelSelect && onModelSelect(model.id)}
                  className={`
                    transition-all duration-200 cursor-pointer select-none
                    ${isSelected
                      ? `${accent.row} shadow-[inset_0_0_12px_rgba(0,0,0,0.2)]`
                      : `hover:bg-[#141635]/30 border-l-2 border-l-transparent ${accent.hover}`
                    }
                  `}
                >
                  {/* Model Name + badges */}
                  <td className="p-3.5 font-bold text-slate-100">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{model.name}</span>
                      {isSelected && (
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase animate-pulse ${accent.badge}`}>
                          ✦ Selected
                        </span>
                      )}
                      {model.id === 'noisereduce' && !isSelected && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-slate-700/40 text-slate-500 border border-slate-700/30">
                          Default
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3.5 text-slate-400">{model.type}</td>
                  <td className={`p-3.5 font-semibold ${isSelected ? accent.stoi : 'text-cyan-400'}`}>
                    {model.stoi}
                  </td>
                  <td className="p-3.5 font-semibold text-purple-400">{model.latency}</td>
                  <td className="p-3.5 text-[11px] font-medium text-slate-400">{model.footprint}</td>
                  <td className="p-3.5 text-[11px] text-slate-400 italic">{model.useCase}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Active model callout */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-start gap-2.5 p-3 rounded-xl border border-[#141635]/50 bg-[#040510]/20 text-[10px] text-slate-400 leading-relaxed flex-1">
          <span className="text-sm select-none">💡</span>
          <div>
            <span className="font-bold text-slate-200">System Fallback Strategy:</span> The dashboard operates on an adaptive execution model. If CPU resource constraints are detected during high-concurrency loops, the pipeline falls back dynamically to the highly optimized classical DSP spectral gating engine (<span className="text-cyan-400 font-semibold">noisereduce</span>) to preserve ultra-low latencies below 5ms.
          </div>
        </div>

        {/* Currently active model pill */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Active Model</span>
          <span className="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wide bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.2)]">
            {models.find(m => m.id === selectedModel)?.name.split(' ')[0] || 'noisereduce'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ModelBenchmarksCard;
