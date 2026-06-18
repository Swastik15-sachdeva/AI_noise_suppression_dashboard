import React, { useEffect, useRef, useState } from 'react';

const AudioWaveformCard = () => {
  const [isListening, setIsListening] = useState(false);
  const [isSuppressing, setIsSuppressing] = useState(false);
  const [recordingState, setRecordingState] = useState('idle'); // 'idle', 'recording_before', 'recording_after'
  
  // Recorded Audio URLs
  const [beforeAudioUrl, setBeforeAudioUrl] = useState(null);
  const [afterAudioUrl, setAfterAudioUrl] = useState(null);

  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const animationRef = useRef(null);
  
  // WebSockets and Streaming refs
  const socketRef = useRef(null);
  const processorRef = useRef(null);
  const nextPlayTimeRef = useRef(0);

  // Recording API Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startListening = async (shouldSuppress = false, isRecording = false) => {
    try {
      // 1. Get microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 2. Set up Web Audio API context at 16000Hz (browser will auto-resample input to 16kHz!)
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;
      nextPlayTimeRef.current = audioCtx.currentTime;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);

      if (shouldSuppress) {
        // --- WebSocket Streaming suppression setup ---
        const ws = new WebSocket('ws://localhost:8000/audio/stream');
        ws.binaryType = 'arraybuffer';
        socketRef.current = ws;

        ws.onopen = () => {
          console.log('Connected to real-time suppression WebSocket');
          
          // Create script processor to read mic chunks (buffer size 4096 frames)
          // 4096 frames at 16kHz sample rate = 256ms chunk size
          const processor = audioCtx.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;

          source.connect(processor);
          processor.connect(audioCtx.destination);

          processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(inputData.buffer);
            }
          };
        };

        // Set up MediaStreamDestination for recording CLEAN output
        const dest = audioCtx.createMediaStreamDestination();

        ws.onmessage = (e) => {
          const cleanBuffer = e.data;
          const cleanData = new Float32Array(cleanBuffer);

          // Build audio source node from returned clean data
          const playBuffer = audioCtx.createBuffer(1, cleanData.length, 16000);
          playBuffer.getChannelData(0).set(cleanData);

          const bufferSource = audioCtx.createBufferSource();
          bufferSource.buffer = playBuffer;

          // Connect to analyser (for drawing cleaned waveform) and speakers
          bufferSource.connect(analyser);
          analyser.connect(audioCtx.destination);
          
          // Connect to the recording destination node as well
          analyser.connect(dest);

          // Queue playback continuously to prevent gaps/clicks
          if (nextPlayTimeRef.current < audioCtx.currentTime) {
            nextPlayTimeRef.current = audioCtx.currentTime;
          }
          bufferSource.start(nextPlayTimeRef.current);
          nextPlayTimeRef.current += playBuffer.duration;
        };

        // Start recording Clean (After) if requested
        if (isRecording) {
          const recorder = new MediaRecorder(dest.stream);
          mediaRecorderRef.current = recorder;
          audioChunksRef.current = [];

          recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              audioChunksRef.current.push(event.data);
            }
          };

          recorder.onstop = () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            setAfterAudioUrl(URL.createObjectURL(audioBlob));
            setRecordingState('idle');
          };

          recorder.start();
          setRecordingState('recording_after');
        }

        ws.onerror = (err) => {
          console.error('WebSocket Error:', err);
        };

        ws.onclose = () => {
          console.log('Suppression WebSocket closed');
        };

        setIsSuppressing(true);
      } else {
        // --- Standard raw microphone setup ---
        source.connect(analyser);
        setIsSuppressing(false);

        // Start recording Noisy (Before) if requested
        if (isRecording) {
          const recorder = new MediaRecorder(stream);
          mediaRecorderRef.current = recorder;
          audioChunksRef.current = [];

          recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              audioChunksRef.current.push(event.data);
            }
          };

          recorder.onstop = () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            setBeforeAudioUrl(URL.createObjectURL(audioBlob));
            setRecordingState('idle');
          };

          recorder.start();
          setRecordingState('recording_before');
        }
      }

      setIsListening(true);
      drawWaveform();
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access microphone. Please check browser permissions.');
      stopListening();
    }
  };

  const stopListening = () => {
    // 1. Stop recording if active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    // 2. Stop visualizer animation loop
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    // 3. Stop recording script processor
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    // 4. Close WebSocket
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    // 5. Stop microphone stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    // 6. Close Audio Context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setIsListening(false);
    setIsSuppressing(false);
    clearCanvas();
  };

  const toggleSuppression = () => {
    if (recordingState !== 'idle') return; // Disable toggle during recording
    if (isListening) {
      stopListening();
      startListening(!isSuppressing);
    } else {
      startListening(true);
    }
  };

  // Recording controls
  const handleRecordBefore = () => {
    stopListening();
    // Start mic with suppression OFF and begin recording
    startListening(false, true);
  };

  const handleRecordAfter = () => {
    stopListening();
    // Start mic with suppression ON and begin recording
    startListening(true, true);
  };

  const clearRecordings = () => {
    setBeforeAudioUrl(null);
    setAfterAudioUrl(null);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw empty baseline
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#a1a1aa';
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
  };

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas || !analyserRef.current) return;

    const ctx = canvas.getContext('2d');
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyserRef.current.getByteTimeDomainData(dataArray);

      ctx.fillStyle = '#f4f4f5'; // zinc-100
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid
      ctx.strokeStyle = '#e4e4e7';
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        const y = (canvas.height / 4) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Draw Waveform line
      ctx.lineWidth = 3;
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      if (isSuppressing) {
        gradient.addColorStop(0, '#10b981'); // Emerald
        gradient.addColorStop(0.5, '#06b6d4'); // Cyan
        gradient.addColorStop(1, '#10b981');
      } else {
        gradient.addColorStop(0, '#f97316'); // Orange
        gradient.addColorStop(0.5, '#ef4444'); // Red
        gradient.addColorStop(1, '#f97316');
      }
      ctx.strokeStyle = gradient;
      
      ctx.beginPath();
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    draw();
  };

  useEffect(() => {
    clearCanvas();
    return () => {
      stopListening();
    };
  }, []);

  return (
    <div className="h-full p-6 border border-zinc-300 rounded-xl bg-zinc-100/50 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h3 className="text-sm font-medium text-zinc-900">Live Mic Input</h3>
            <span className="text-[10px] text-zinc-500">
              {isSuppressing 
                ? "Running real-time spectral noise suppression" 
                : "Visualizing raw microphone input"}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={toggleSuppression}
              disabled={recordingState !== 'idle'}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 border ${
                isSuppressing 
                  ? 'bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-500' 
                  : 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50'
              } ${recordingState !== 'idle' ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isSuppressing ? 'Suppression: ON' : 'Enable Suppression'}
            </button>
            
            <button
              onClick={isListening ? stopListening : () => startListening(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide text-white transition-all duration-200 ${
                isListening ? 'bg-red-600 hover:bg-red-500' : 'bg-zinc-900 hover:bg-zinc-800'
              }`}
            >
              {recordingState !== 'idle' ? 'Stop Recording' : (isListening ? 'Stop Mic' : 'Start Mic')}
            </button>
          </div>
        </div>
        
        {/* Canvas Display */}
        <div className="flex-1 min-h-[120px] rounded-lg overflow-hidden border border-zinc-200 relative bg-zinc-100">
          <canvas 
            ref={canvasRef} 
            width={500} 
            height={150} 
            className="w-full h-full object-cover" 
          />
          {isListening && (
            <span className="absolute top-2 right-2 flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isSuppressing ? 'bg-emerald-400' : 'bg-orange-400'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                isSuppressing ? 'bg-emerald-500' : 'bg-orange-500'
              }`}></span>
            </span>
          )}
          {recordingState !== 'idle' && (
            <div className="absolute inset-0 bg-red-600/10 flex items-center justify-center border border-red-500 rounded-lg">
              <span className="text-red-700 font-bold text-xs tracking-wider animate-pulse flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-600 inline-block"></span>
                RECORDING {recordingState === 'recording_before' ? 'BEFORE' : 'AFTER'} (SPEAK NOW)
              </span>
            </div>
          )}
        </div>

        {/* Demo Side-by-Side Recording Controls */}
        <div className="mt-4 flex gap-4">
          <button
            onClick={handleRecordBefore}
            disabled={recordingState !== 'idle'}
            className="flex-1 py-2 rounded-lg border border-orange-300 hover:bg-orange-50/50 text-orange-700 font-semibold text-xs tracking-wide transition-all duration-200"
          >
            🎙️ Record Before (Suppression OFF)
          </button>
          <button
            onClick={handleRecordAfter}
            disabled={recordingState !== 'idle'}
            className="flex-1 py-2 rounded-lg border border-emerald-300 hover:bg-emerald-50/50 text-emerald-700 font-semibold text-xs tracking-wide transition-all duration-200"
          >
            ✨ Record After (Suppression ON)
          </button>
        </div>
      </div>
      
      {/* Side-by-Side Comparison Players */}
      {(beforeAudioUrl || afterAudioUrl) && (
        <div className="mt-4 border-t border-zinc-200 pt-4 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Demo Comparison</span>
            <button
              onClick={clearRecordings}
              className="text-[10px] text-red-600 hover:text-red-500 font-medium underline"
            >
              Clear Comparison
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-white border border-zinc-200 rounded-lg">
              <span className="text-[10px] font-semibold text-orange-600 uppercase tracking-wider block mb-1">Before (Noisy Mic)</span>
              {beforeAudioUrl ? (
                <audio src={beforeAudioUrl} controls className="w-full h-8 scale-95 origin-left" />
              ) : (
                <div className="h-8 flex items-center justify-center text-[10px] text-zinc-400 italic">No recording yet</div>
              )}
            </div>
            <div className="p-3 bg-white border border-zinc-200 rounded-lg">
              <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider block mb-1">After (Suppressed Voice)</span>
              {afterAudioUrl ? (
                <audio src={afterAudioUrl} controls className="w-full h-8 scale-95 origin-left" />
              ) : (
                <div className="h-8 flex items-center justify-center text-[10px] text-zinc-400 italic">No recording yet</div>
              )}
            </div>
          </div>
        </div>
      )}

      {isSuppressing && (
        <div className="mt-2 text-[10px] text-zinc-500 text-center animate-pulse">
          🎧 Use headphones to prevent microphone feedback loops while playing back suppressed audio.
        </div>
      )}
    </div>
  );
};

export default AudioWaveformCard;
