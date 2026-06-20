import React, { useState, useRef, useEffect } from 'react';

const LiveMicrophoneCard = ({ onStreamEnd }) => {
    const [isSuppressionOn, setIsSuppressionOn] = useState(true);
    const [isRecording, setIsRecording] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);

    const audioContextRef = useRef(null);
    const streamRef = useRef(null);
    const processorRef = useRef(null);
    const socketRef = useRef(null);

    const toggleSuppression = () => {
        if (isRecording) return; // Prevent toggling suppression during active recording
        setIsSuppressionOn(!isSuppressionOn);
    };

    const startStreaming = async () => {
        try {
            setErrorMessage(null);
            
            // 1. Get microphone input
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // 2. Initialize AudioContext at 16kHz
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            const audioCtx = new AudioContextClass({ sampleRate: 16000 });
            audioContextRef.current = audioCtx;

            const source = audioCtx.createMediaStreamSource(stream);

            // 3. Establish WebSocket connection to backend
            const wsUrl = `ws://localhost:8000/audio/stream?suppress=${isSuppressionOn}`;
            const ws = new WebSocket(wsUrl);
            ws.binaryType = 'arraybuffer';
            socketRef.current = ws;

            ws.onopen = () => {
                console.log(`Live streaming WebSocket connected: ${wsUrl}`);
                setIsRecording(true);

                // Create a ScriptProcessorNode to capture chunks (buffer size 4096 samples = 256ms)
                const processor = audioCtx.createScriptProcessor(4096, 1, 1);
                processorRef.current = processor;

                source.connect(processor);
                processor.connect(audioCtx.destination);

                processor.onaudioprocess = (e) => {
                    const inputData = e.inputBuffer.getChannelData(0);
                    if (ws.readyState === WebSocket.OPEN) {
                        // Send binary float32 PCM samples
                        ws.send(inputData.buffer);
                    }
                };
            };

            ws.onmessage = (e) => {
                // Real-time backend updates are synced directly to session state
                // This client sends the audio stream and updates on-disconnect.
            };

            ws.onerror = (err) => {
                console.error("Live streaming WebSocket error:", err);
                setErrorMessage("WebSocket streaming error. Check connection.");
                stopStreaming();
            };

            ws.onclose = () => {
                console.log("Live streaming WebSocket closed.");
                setIsRecording(false);
            };

        } catch (err) {
            console.error("Failed to access microphone for live streaming:", err);
            setErrorMessage("Microphone access denied or not found.");
            setIsRecording(false);
        }
    };

    const stopStreaming = () => {
        setIsRecording(false);
        
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => {});
            audioContextRef.current = null;
        }
        
        if (socketRef.current) {
            // Delay closing slightly so final audio packets reach the server
            setTimeout(() => {
                if (socketRef.current) {
                    socketRef.current.close();
                    socketRef.current = null;
                }
                // Call callback to refresh the gallery
                if (onStreamEnd) {
                    onStreamEnd();
                }
            }, 200);
        }
    };

    const handleRecordClick = () => {
        if (!isRecording) {
            startStreaming();
        } else {
            stopStreaming();
        }
    };

    useEffect(() => {
        return () => {
            // Clean up resources on component unmount
            if (processorRef.current) processorRef.current.disconnect();
            if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
            if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
            if (socketRef.current) socketRef.current.close();
        };
    }, []);

    return (
        <div className="p-6 border border-zinc-300 rounded-xl bg-zinc-100/50 h-fit flex flex-col justify-between">
            <div className="flex items-center justify-between mb-6 shrink-0">
                <h3 className="text-sm font-medium text-zinc-900">Live Microphone Testing</h3>
                <span className="text-[10px] tracking-widest text-zinc-500 uppercase">Real-Time</span>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center gap-6">
                
                {/* Noise Suppression Toggle */}
                <div className="flex items-center gap-4 bg-white px-6 py-4 rounded-xl border border-zinc-200 shadow-sm w-full max-w-sm justify-between">
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold text-zinc-800">Noise Suppression</span>
                        <span className="text-[10px] text-zinc-500">
                            {isSuppressionOn ? 'AI is cleaning audio' : 'Raw microphone audio'}
                        </span>
                    </div>
                    
                    <button 
                        onClick={toggleSuppression}
                        disabled={isRecording}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none ${isRecording ? 'opacity-50 cursor-not-allowed' : ''} ${isSuppressionOn ? 'bg-zinc-900' : 'bg-zinc-300'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${isSuppressionOn ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>

                {/* Record Button */}
                <button
                    onClick={handleRecordClick}
                    className={`relative group flex items-center justify-center w-20 h-20 rounded-full transition-all duration-300 shadow-sm border-4 ${
                        isRecording 
                        ? 'bg-red-500 border-red-200 animate-pulse' 
                        : 'bg-white border-zinc-200 hover:border-zinc-300'
                    }`}
                >
                    {isRecording ? (
                        <div className="w-6 h-6 bg-white rounded-sm"></div> // Stop Square
                    ) : (
                        <div className="w-8 h-8 bg-red-500 rounded-full group-hover:scale-105 transition-transform"></div> // Record Circle
                    )}
                </button>

                <div className="text-center">
                    <p className="text-xs text-zinc-500">
                        {isRecording 
                            ? 'Recording in progress... Click to stop.' 
                            : 'Click to start live WebSocket stream'}
                    </p>
                    {errorMessage && (
                        <p className="text-[10px] text-red-500 mt-1 font-semibold">
                            ⚠️ {errorMessage}
                        </p>
                    )}
                </div>
                
                {/* Active Connection Status */}
                <div className={`p-3 rounded-lg text-xs w-full border transition-colors duration-300 ${
                    isRecording 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800' 
                    : 'bg-zinc-50 border-zinc-200 text-zinc-600'
                }`}>
                    {isRecording ? (
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <strong>Active Stream:</strong> Streaming live to <code>/audio/stream</code>.
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-zinc-400"></span>
                            <span>WebSocket is disconnected. Press Record to start streaming.</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LiveMicrophoneCard;
