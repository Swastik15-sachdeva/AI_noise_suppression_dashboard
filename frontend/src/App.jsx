import React from 'react';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <div className="relative min-h-screen w-screen overflow-x-hidden overflow-y-auto bg-gradient-to-b from-[#0a0f26] to-[#040614] text-slate-300 font-sans selection:bg-cyan-500/20 selection:text-cyan-200">
      {/* Dynamic Background Glow Blobs */}
      <div className="glow-blob glow-blob-1"></div>
      <div className="glow-blob glow-blob-2"></div>
      <div className="glow-blob glow-blob-3"></div>

      {/* Main Content Area */}
      <div className="relative z-10 w-full min-h-screen">
        <Dashboard />
      </div>
    </div>
  );
}

export default App;

