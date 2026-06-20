import React from 'react';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <div className="relative min-h-screen w-screen overflow-x-hidden overflow-y-auto bg-[#070913] text-slate-100 font-sans selection:bg-indigo-500/30">
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

