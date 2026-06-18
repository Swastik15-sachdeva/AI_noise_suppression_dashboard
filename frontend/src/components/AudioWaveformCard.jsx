import React, { useEffect, useRef, useState } from 'react';

const AudioWaveformCard = () => {
  const [isListening, setIsListening] = useState(false);
  const [isSuppressing, setIsSuppressing] = useState(false);
  
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const animationRef = useRef(null);
  
  // WebSockets and Streaming refs
  const socketRef = useRef(null);
  const processorRef = useRef(null);
  const nextPlayTimeRef = useRef(0);

  const startListening = async (shouldSuppress = false) => {
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
          // 4096 frames at 16kHz sample rate = 256ms chunk size (good balance of latency/stability)
          const processor = audioCtx.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;

          source.connect(processor);
          // Connect processor to destination so it gets processed, but set output gain/connect to visualizer
          processor.connect(audioCtx.destination);

          processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            if (ws.readyState === WebSocket.OPEN) {
              // Send Float32 PCM binary data
              ws.send(inputData.buffer);
            }
          };
        };

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

          // Queue playback continuously to prevent gaps/clicks
          if (nextPlayTimeRef.current < audioCtx.currentTime) {
            nextPlayTimeRef.current = audioCtx.currentTime;
          }
          bufferSource.start(nextPlayTimeRef.current);
          nextPlayTimeRef.current += playBuffer.duration;
        };

        ws.onerror = (err) => {
          console.error('WebSocket Error:', err);
        };

        ws.onclose = () => {
          console.log('Suppression WebSocket closed');
        };

        setIsSuppressing(true);
      } else {
        // --- Standard visualization setup (no feedback loop) ---
        source.connect(analyser);
        setIsSuppressing(false);
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
    // Stop HMR loop animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    // Stop recording script processor
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    // Close WebSocket
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    // Stop microphone tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    // Close Audio Context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setIsListening(false);
    setIsSuppressing(false);
    clearCanvas();
  };

  const toggleSuppression = () => {
    if (isListening) {
      stopListening();
      // Restart with suppression toggled
      startListening(!isSuppressing);
    } else {
      startListening(true);
    }
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
        // Green and Cyan gradient for suppressed, clean voice
        gradient.addColorStop(0, '#10b981'); // Emerald
        gradient.addColorStop(0.5, '#06b6d4'); // Cyan
        gradient.addColorStop(1, '#10b981');
      } else {
        // Red and Orange gradient for raw, noisy voice
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
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 border ${
              isSuppressing 
                ? 'bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-500' 
                : 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50'
            }`}
          >
            {isSuppressing ? 'Suppression: ON' : 'Enable Suppression'}
          </button>
          
          <button
            onClick={isListening ? stopListening : () => startListening(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide text-white transition-all duration-200 ${
              isListening ? 'bg-red-600 hover:bg-red-500' : 'bg-zinc-900 hover:bg-zinc-800'
            }`}
          >
            {isListening ? 'Stop Mic' : 'Start Mic'}
          </button>
        </div>
      </div>
      
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
      </div>
      
      {isSuppressing && (
        <div className="mt-2 text-[10px] text-zinc-500 text-center animate-pulse">
          🎧 Use headphones to prevent microphone feedback loops while playing back suppressed audio.
        </div>
      )}
    </div>
  );
};

export default AudioWaveformCard;
