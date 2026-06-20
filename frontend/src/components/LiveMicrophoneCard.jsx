import React, { useState } from 'react';

const LiveMicrophoneCard = () => {
    const [isSuppressionOn, setIsSuppressionOn] = useState(true);
    const [isRecording, setIsRecording] = useState(false);

    const toggleSuppression = () => {
        setIsSuppressionOn(!isSuppressionOn);
    };

    const handleRecordClick = () => {
        // Placeholder for interns
        if (!isRecording) {
            console.log(`Starting record... Suppression is ${isSuppressionOn ? 'ON' : 'OFF'}`);
            setIsRecording(true);
            // INTERN TASK: Connect to WebSocket /audio/stream?suppress=true|false
        } else {
            console.log("Stopping record...");
            setIsRecording(false);
            // INTERN TASK: Close WebSocket, fetch updated Cloudinary files
        }
    };

    return (
        <div className="p-6 border border-slate-800/80 rounded-2xl bg-slate-900/40 h-full flex flex-col justify-between shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between mb-6 shrink-0">
                <h3 className="text-sm font-semibold text-white">Live Microphone Testing</h3>
                <span className="text-[10px] tracking-widest text-slate-500 uppercase font-bold">Real-Time</span>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center gap-6">
                
                {/* Noise Suppression Toggle */}
                <div className="flex items-center gap-4 bg-slate-950 px-6 py-4 rounded-xl border border-slate-800/80 shadow-sm w-full max-w-sm justify-between">
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-200">Noise Suppression</span>
                        <span className="text-[10px] text-slate-500">
                            {isSuppressionOn ? 'AI is cleaning audio' : 'Raw microphone audio'}
                        </span>
                    </div>
                    
                    <button 
                        onClick={toggleSuppression}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none ${isSuppressionOn ? 'bg-indigo-600' : 'bg-slate-700'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${isSuppressionOn ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>

                {/* Record Button */}
                <button
                    onClick={handleRecordClick}
                    className={`relative group flex items-center justify-center w-20 h-20 rounded-full transition-all duration-300 shadow-sm border-4 ${
                        isRecording 
                        ? 'bg-rose-600 border-rose-500/30 animate-pulse' 
                        : 'bg-slate-900 border-slate-700 hover:border-slate-500'
                    }`}
                >
                    {isRecording ? (
                        <div className="w-6 h-6 bg-white rounded-sm"></div> // Stop Square
                    ) : (
                        <div className="w-8 h-8 bg-rose-500 rounded-full group-hover:scale-105 transition-transform"></div> // Record Circle
                    )}
                </button>

                <p className="text-xs text-slate-500 mt-2 text-center">
                    {isRecording 
                        ? 'Recording in progress... Click to stop.' 
                        : 'Click to start live WebSocket stream'}
                </p>
                
                {/* Instructions for Interns */}
                <div className="mt-4 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-300 w-full">
                    <strong>Intern Task:</strong> Link this record button to <code>/audio/stream?suppress={isSuppressionOn.toString()}</code>. Once recording stops, refresh the Cloudinary Gallery.
                </div>
            </div>
        </div>
    );
};

export default LiveMicrophoneCard;
