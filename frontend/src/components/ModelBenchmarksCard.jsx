import React from 'react';

const ModelBenchmarksCard = () => {
  const models = [
    {
      name: 'Spectral Gating (noisereduce)',
      type: 'Classical DSP',
      stoi: '0.80 - 0.84',
      latency: '< 3 ms',
      footprint: 'Ultra-Low (CPU)',
      status: 'Active Fallback',
      useCase: 'Call Centers (High scale, low cost)',
    },
    {
      name: 'RNNoise (GRU)',
      type: 'Hybrid Deep Learning',
      stoi: '0.85 - 0.88',
      latency: '~10 ms',
      footprint: 'Low (CPU/ONNX)',
      status: 'Available',
      useCase: 'Video Conferencing (Low latency CPU)',
    },
    {
      name: 'DTLN (LSTM-FFT)',
      type: 'Dual-Signal LSTM',
      stoi: '0.90 - 0.93',
      latency: '~15 ms',
      footprint: 'Medium (CPU/ONNX)',
      status: 'Available',
      useCase: 'Smart Speakers / Mobile VoIP',
    },
    {
      name: 'DeepFilterNet (ERB)',
      type: 'Deep Conv-TasNet',
      stoi: '0.92 - 0.95',
      latency: '~30 ms',
      footprint: 'High (GPU/PyTorch)',
      status: 'Experimental',
      useCase: 'Live Streaming / Podcast Recording',
    },
  ];

  return (
    <div className="p-6 border border-[#141635] rounded-2xl bg-[#0a0b1f]/60 backdrop-blur-md shadow-xl hover:border-indigo-500/30 hover:shadow-[0_0_20px_rgba(99,102,241,0.15)] transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-100 glow-text-white">AI Model Benchmarks & Comparison</h3>
          <span className="text-[10px] text-slate-400 font-medium">Evaluation metrics and use case alignment of target speech suppression models</span>
        </div>
        <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          DSP & Deep Learning
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
            {models.map((model, idx) => (
              <tr 
                key={idx} 
                className="hover:bg-[#141635]/20 transition-colors duration-150"
              >
                <td className="p-3.5 font-bold text-slate-100 flex items-center gap-2">
                  <span>{model.name}</span>
                  {model.status === 'Active Fallback' && (
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      Active
                    </span>
                  )}
                </td>
                <td className="p-3.5 text-slate-400">{model.type}</td>
                <td className="p-3.5 font-semibold text-cyan-400">{model.stoi}</td>
                <td className="p-3.5 font-semibold text-purple-400">{model.latency}</td>
                <td className="p-3.5 text-[11px] font-medium text-slate-400">{model.footprint}</td>
                <td className="p-3.5 text-[11px] text-slate-400 italic">{model.useCase}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 p-3 rounded-xl border border-[#141635]/50 bg-[#040510]/20 flex items-start gap-2.5 text-[10px] text-slate-400 leading-relaxed">
        <span className="text-sm select-none">💡</span>
        <div>
          <span className="font-bold text-slate-200">System Fallback Strategy:</span> The dashboard operates on an adaptive execution model. If CPU resource constraints are detected during high-concurrency loops, the pipeline falls back dynamically to the highly optimized classical DSP spectral gating engine (<span className="text-cyan-400 font-semibold">noisereduce</span>) to preserve ultra-low latencies below 5ms.
        </div>
      </div>
    </div>
  );
};

export default ModelBenchmarksCard;
