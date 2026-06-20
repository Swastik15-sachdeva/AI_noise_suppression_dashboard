import React from 'react';

const AlertPanel = ({ alerts = [] }) => {
  // Determine alert category style
  const getAlertStyle = (msg) => {
    const lower = msg.toLowerCase();
    if (lower.includes('failed') || lower.includes('error') || lower.includes('offline')) {
      return {
        borderClass: 'border-[#141635] border-l-4 border-l-pink-500 bg-pink-500/5',
        textClass: 'text-slate-200 font-medium',
        iconColor: 'text-pink-500',
        type: 'error'
      };
    } else if (lower.includes('detected') || lower.includes('noise') || lower.includes('warning')) {
      return {
        borderClass: 'border-[#141635] border-l-4 border-l-amber-500 bg-amber-500/5',
        textClass: 'text-slate-200 font-medium',
        iconColor: 'text-amber-500',
        type: 'warning'
      };
    } else {
      return {
        borderClass: 'border-[#141635] border-l-4 border-l-lime-500 bg-lime-500/5',
        textClass: 'text-slate-200 font-medium',
        iconColor: 'text-lime-500',
        type: 'success'
      };
    }
  };

  // Group alerts dynamically by session type:
  // 1. Live Streaming Stream alerts
  // 2. File Upload Session logs
  const liveAlerts = alerts.filter(
    (a) => a.message.toLowerCase().includes('live mic') || a.message.toLowerCase().includes('system')
  );
  const fileAlerts = alerts.filter(
    (a) => a.message.toLowerCase().includes('processed') || a.message.toLowerCase().includes('file')
  );

  const renderAlertCard = (alert, idx) => {
    const style = getAlertStyle(alert.message);
    const isErrOrWarn = style.type !== 'success';
    
    return (
      <div
        key={idx}
        className={`p-3 rounded-xl border backdrop-blur-sm transition-all duration-300 hover:scale-[1.01] ${style.borderClass}`}
      >
        <div className="flex gap-2.5 items-start">
          {isErrOrWarn ? (
            // Warning/Error Icon SVG
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className={`w-4.5 h-4.5 ${style.iconColor} flex-shrink-0 mt-0.5`}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          ) : (
            // Success Icon SVG
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className={`w-4.5 h-4.5 ${style.iconColor} flex-shrink-0 mt-0.5`}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
          )}
          <div className="flex-1 min-w-0">
            <p className={`text-xs leading-relaxed break-words ${style.textClass}`}>{alert.message}</p>
            <span className="text-[9px] text-slate-500 uppercase tracking-wider mt-1.5 block font-bold">
              {alert.time}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full p-6 border border-[#141635] rounded-2xl bg-[#0a0b1f]/60 backdrop-blur-md flex flex-col min-h-[300px] shadow-xl hover:border-indigo-500/30 hover:shadow-[0_0_20px_rgba(99,102,241,0.15)] transition-all duration-300">
      <h3 className="text-sm font-semibold text-slate-100 glow-text-white mb-5 shrink-0">Recent Incident Alerts</h3>
      <div className="flex-1 overflow-y-auto space-y-5 pr-1 select-none custom-scrollbar">
        {alerts.length === 0 ? (
          <div className="text-xs text-slate-500 text-center py-10 font-medium">No active session alerts</div>
        ) : (
          <>
            {/* Live Streaming alerts group */}
            {liveAlerts.length > 0 && (
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5 border-b border-slate-800/50 pb-1 flex items-center justify-between">
                  <span>Live Stream Activity</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                </div>
                <div className="space-y-3">
                  {liveAlerts.map((alert, idx) => renderAlertCard(alert, `live-${idx}`))}
                </div>
              </div>
            )}

            {/* File Upload reports group */}
            {fileAlerts.length > 0 && (
              <div className="mt-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5 border-b border-slate-800/50 pb-1 flex items-center justify-between">
                  <span>File Analysis Session</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                </div>
                <div className="space-y-3">
                  {fileAlerts.map((alert, idx) => renderAlertCard(alert, `file-${idx}`))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AlertPanel;
