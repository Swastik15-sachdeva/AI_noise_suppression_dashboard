import React, { useState, useEffect, useRef } from 'react';

const CustomAudioPlayer = ({ src, theme = 'cyan' }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.8);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);

    const audioRef = useRef(null);
    const speedMenuRef = useRef(null);

    // Reset player states when src changes
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            setIsPlaying(false);
            setCurrentTime(0);
            setDuration(0);
            audioRef.current.load();
        }
    }, [src]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
        };

        const handleLoadedMetadata = () => {
            setDuration(audio.duration || 0);
        };

        const handleAudioEnded = () => {
            setIsPlaying(false);
            setCurrentTime(0);
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('ended', handleAudioEnded);

        // Update volume & rate
        audio.volume = isMuted ? 0 : volume;
        audio.playbackRate = playbackRate;

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('ended', handleAudioEnded);
        };
    }, [volume, isMuted, playbackRate]);

    // Close speed menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (speedMenuRef.current && !speedMenuRef.current.contains(event.target)) {
                setShowSpeedMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const togglePlay = () => {
        if (!src) return;
        const audio = audioRef.current;
        if (isPlaying) {
            audio.pause();
            setIsPlaying(false);
        } else {
            audio.play().catch(err => console.error("Playback error:", err));
            setIsPlaying(true);
        }
    };

    const handleSeek = (e) => {
        const audio = audioRef.current;
        if (!audio) return;
        const newTime = parseFloat(e.target.value);
        audio.currentTime = newTime;
        setCurrentTime(newTime);
    };

    const toggleMute = () => {
        setIsMuted(!isMuted);
    };

    const handleVolumeChange = (e) => {
        const newVol = parseFloat(e.target.value);
        setVolume(newVol);
        if (newVol > 0) {
            setIsMuted(false);
        }
    };

    const changeSpeed = (rate) => {
        setPlaybackRate(rate);
        setShowSpeedMenu(false);
    };

    const formatTime = (timeInSeconds) => {
        if (isNaN(timeInSeconds)) return '00:00';
        const mins = Math.floor(timeInSeconds / 60);
        const secs = Math.floor(timeInSeconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Style helper for themes
    const themeStyles = {
        cyan: {
            text: 'text-cyan-400',
            bg: 'bg-cyan-500',
            border: 'border-cyan-500/30',
            hoverBorder: 'hover:border-cyan-400/50',
            glow: 'shadow-[0_0_12px_rgba(6,182,212,0.35)]',
            btnColor: 'bg-cyan-500 hover:bg-cyan-400 text-slate-950',
            trackFill: 'bg-gradient-to-r from-cyan-500 to-indigo-500',
            glowText: 'glow-text-cyan'
        },
        pink: {
            text: 'text-pink-400',
            bg: 'bg-pink-500',
            border: 'border-pink-500/30',
            hoverBorder: 'hover:border-pink-400/50',
            glow: 'shadow-[0_0_12px_rgba(236,72,153,0.35)]',
            btnColor: 'bg-pink-500 hover:bg-pink-400 text-slate-950',
            trackFill: 'bg-gradient-to-r from-pink-500 to-rose-500',
            glowText: 'glow-text-pink'
        },
        purple: {
            text: 'text-purple-400',
            bg: 'bg-purple-500',
            border: 'border-purple-500/30',
            hoverBorder: 'hover:border-purple-400/50',
            glow: 'shadow-[0_0_12px_rgba(168,85,247,0.35)]',
            btnColor: 'bg-purple-500 hover:bg-purple-400 text-purple-50',
            trackFill: 'bg-gradient-to-r from-purple-500 to-indigo-500',
            glowText: 'glow-text-purple'
        }
    };

    const currentTheme = themeStyles[theme] || themeStyles.cyan;

    // Progress percentage
    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div className={`flex items-center gap-3.5 px-4 py-2.5 rounded-xl border border-[#141635] bg-[#040510]/80 backdrop-blur-md shadow-lg transition-all duration-300 w-full hover:border-[#22265c]`}>
            <audio ref={audioRef} src={src} preload="metadata" />

            {/* Play/Pause Button */}
            <button
                onClick={togglePlay}
                disabled={!src}
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${currentTheme.btnColor} ${isPlaying ? currentTheme.glow : ''}`}
                title={isPlaying ? 'Pause' : 'Play'}
            >
                {isPlaying ? (
                    // Pause icon
                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-3.5 h-3.5">
                        <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7.5 0a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1-.75-.75V5.25Z" clipRule="evenodd" />
                    </svg>
                ) : (
                    // Play icon
                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-3.5 h-3.5 translate-x-[1px]">
                        <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
                    </svg>
                )}
            </button>

            {/* Time / Progress Area */}
            <div className="flex-1 flex flex-col justify-center min-w-0">
                {/* Custom Slider */}
                <div className="relative group w-full h-1.5 flex items-center cursor-pointer select-none">
                    <input
                        type="range"
                        min="0"
                        max={duration || 0}
                        value={currentTime}
                        onChange={handleSeek}
                        disabled={!src}
                        className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer disabled:cursor-not-allowed"
                    />
                    
                    {/* Background track */}
                    <div className="w-full h-1 rounded-full bg-[#141635]" />
                    
                    {/* Filled track */}
                    <div 
                        className={`absolute left-0 top-1/2 -translate-y-1/2 h-1 rounded-full transition-all ${currentTheme.trackFill}`} 
                        style={{ width: `${progressPercent}%` }}
                    />

                    {/* Thumb indicator on hover */}
                    <div 
                        className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border border-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${currentTheme.bg}`}
                        style={{ left: `calc(${progressPercent}% - 5px)` }}
                    />
                </div>

                {/* Time indicators & Audio Micro-animation */}
                <div className="flex justify-between items-center mt-1">
                    <span className="text-[10px] text-slate-400 font-mono">
                        {formatTime(currentTime)} <span className="text-slate-600">/</span> {formatTime(duration)}
                    </span>

                    {/* Soundwave animation */}
                    {isPlaying && (
                        <div className="flex items-end gap-[2px] h-2.5 pr-1">
                            <span className={`w-[1.5px] rounded-full animate-[pulse_0.4s_infinite_alternate] h-2 ${currentTheme.bg}`} />
                            <span className={`w-[1.5px] rounded-full animate-[pulse_0.3s_infinite_alternate_0.1s] h-3 ${currentTheme.bg}`} />
                            <span className={`w-[1.5px] rounded-full animate-[pulse_0.5s_infinite_alternate_0.05s] h-1.5 ${currentTheme.bg}`} />
                            <span className={`w-[1.5px] rounded-full animate-[pulse_0.2s_infinite_alternate_0.15s] h-2.5 ${currentTheme.bg}`} />
                        </div>
                    )}
                </div>
            </div>

            {/* Volume Control */}
            <div className="relative group/vol flex items-center">
                <button
                    onClick={toggleMute}
                    className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    title={isMuted ? 'Unmute' : 'Mute'}
                >
                    {isMuted || volume === 0 ? (
                        // Mute
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                        </svg>
                    ) : volume < 0.4 ? (
                        // Vol Low
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                        </svg>
                    ) : (
                        // Vol High
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                        </svg>
                    )}
                </button>

                {/* Slider reveals on hover */}
                <div className="w-0 group-hover/vol:w-16 overflow-hidden transition-all duration-300 flex items-center ml-1">
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-14 h-1 rounded-lg bg-[#141635] accent-slate-300 cursor-pointer"
                    />
                </div>
            </div>

            {/* Playback Speed Control */}
            <div className="relative" ref={speedMenuRef}>
                <button
                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    className="text-[10px] font-bold bg-[#040510] px-2 py-1 border border-[#141635] rounded-md text-slate-400 hover:text-slate-200 transition-colors cursor-pointer select-none"
                    title="Playback speed"
                >
                    {playbackRate}x
                </button>

                {showSpeedMenu && (
                    <div className="absolute right-0 bottom-full mb-1.5 bg-[#040510] border border-[#141635] rounded-lg shadow-2xl py-1 z-30 min-w-[56px] text-center">
                        {[0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                            <button
                                key={rate}
                                onClick={() => changeSpeed(rate)}
                                className={`w-full block py-1 text-[10px] font-semibold hover:bg-slate-800/40 cursor-pointer ${
                                    playbackRate === rate ? currentTheme.text : 'text-slate-400'
                                }`}
                            >
                                {rate}x
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomAudioPlayer;
