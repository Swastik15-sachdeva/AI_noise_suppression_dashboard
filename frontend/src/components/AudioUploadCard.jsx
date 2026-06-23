import React, { useState, useRef } from 'react';
import { audioService } from '../services/api';
import CustomAudioPlayer from './CustomAudioPlayer';

const AudioUploadCard = ({ onUploadSuccess, selectedModel }) => {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [results, setResults] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [voiceBoost, setVoiceBoost] = useState(true);
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
            setResults(null);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        try {
            setUploading(true);
            setError(null);

            const response = await audioService.uploadAudio(file, selectedModel, voiceBoost);
            const data = response.data;

            if (data.status === 'success') {
                const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
                const cleanUrl = data.clean_audio_url.startsWith('http') ? data.clean_audio_url : `${apiBaseUrl}${data.clean_audio_url}`;
                setResults({
                    noiseType: data.noise_type,
                    voiceClarity: data.voice_clarity,
                    noiseScore: data.noise_score,
                    audioQuality: data.audio_quality,
                    cleanAudioUrl: cleanUrl,
                    originalAudioUrl: URL.createObjectURL(file),
                    noiseBreakdown: data.noise_breakdown || {},
                    modelUsed: data.model_used
                });

                // Notify parent dashboard to update general metrics & alerts list
                onUploadSuccess(data);
            } else {
                setError('Processing failed. Please try again.');
            }
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.detail || 'An error occurred during audio processing.');
        } finally {
            setUploading(false);
        }
    };

    const triggerFileSelect = () => {
        fileInputRef.current.click();
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const droppedFile = e.dataTransfer.files[0];
            const fileName = droppedFile.name.toLowerCase();
            const isValidFormat = fileName.endsWith('.wav') || fileName.endsWith('.mp3') || fileName.endsWith('.m4a') || droppedFile.type.startsWith('audio/');
            
            if (isValidFormat) {
                setFile(droppedFile);
                setError(null);
                setResults(null);
            } else {
                setError('Unsupported file type. Please select a WAV, MP3, or M4A file.');
            }
        }
    };

    const renderNoiseBadge = (noiseType) => {
        if (!noiseType) return null;
        const cleaned = noiseType.trim();
        const lower = cleaned.toLowerCase();
        
        let bg = 'bg-[#141635] text-slate-400 border border-slate-700/30';
        
        if (lower.includes('traffic')) {
            bg = 'bg-pink-500/10 text-pink-400 border border-pink-500/20';
        } else if (lower.includes('crowd') || lower.includes('conversation') || lower.includes('speech')) {
            bg = 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
        } else if (lower.includes('wind')) {
            bg = 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20';
        } else if (lower.includes('fan') || lower.includes('ac') || lower.includes('conditioner') || lower.includes('noise')) {
            bg = 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20';
        } else if (lower.includes('keyboard') || lower.includes('click') || lower.includes('typing')) {
            bg = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
        }
        
        return (
            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${bg}`}>
                {cleaned}
            </span>
        );
    };

    return (
        <div className="p-6 border border-[#141635] rounded-2xl bg-[#0a0b1f]/60 backdrop-blur-md flex flex-col justify-between h-full shadow-xl hover:border-indigo-500/30 hover:shadow-[0_0_20px_rgba(99,102,241,0.15)] transition-all duration-300">
            <div>
                <div className="flex items-center justify-between mb-5 shrink-0">
                    <h3 className="text-sm font-semibold text-slate-100 glow-text-white">Audio Processing Hub</h3>
                    <span className="text-[10px] tracking-widest text-slate-500 uppercase font-bold">AI Uploader</span>
                </div>

                {/* Drag and Drop Zone */}
                <div
                    onClick={triggerFileSelect}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 text-center select-none ${
                        isDragging 
                            ? 'border-cyan-400 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.25)]' 
                            : 'border-[#141635] bg-[#040510]/50 hover:border-cyan-500/50 hover:bg-[#040510]/70'
                    }`}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="audio/*"
                        className="hidden"
                    />
                    
                    {/* Audio File Icon */}
                    <div className={`p-3 rounded-full mb-3 transition-colors duration-300 ${isDragging ? 'bg-cyan-500/20 text-cyan-400' : 'bg-[#141635] text-slate-400'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75V3m0 0L8.25 6.75M12 3l3.75 3.75M19.5 12a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" />
                        </svg>
                    </div>

                    <span className="text-xs font-semibold text-slate-200">
                        {file ? file.name : "Select or Drop Noisy Audio"}
                    </span>
                    
                    <span className="text-[10px] text-slate-500 mt-1.5 flex items-center justify-center gap-1.5">
                        <span>Drag your recording here</span>
                        <span>•</span>
                        {/* Tooltip implementation */}
                        <span className="relative group cursor-pointer inline-flex items-center gap-0.5 text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-2">
                            <span>Supported Formats</span>
                            <span className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 hidden group-hover:block bg-[#040510] text-slate-300 text-[10px] rounded-lg py-1.5 px-3 border border-[#141635] whitespace-nowrap shadow-2xl z-30 font-medium">
                                WAV, MP3, M4A files supported
                            </span>
                        </span>
                    </span>
                </div>

                {file && !results && (
                    <div className="mt-4 flex flex-col gap-3">
                        {/* Voice Boost Toggle */}
                        <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#141635] bg-[#040510]/30 select-none">
                            <div className="flex flex-col text-left">
                                <span className="text-xs font-bold text-slate-200">Voice Boost</span>
                                <span className="text-[9px] text-slate-500 mt-0.5 font-medium">Enhance vocal presence and equalize output</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={voiceBoost}
                                    onChange={(e) => setVoiceBoost(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-[#141635] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 peer-checked:after:bg-cyan-400 after:border-none after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-950/55 border border-slate-700/20 peer-checked:border-cyan-500/50"></div>
                            </label>
                        </div>

                        <button
                            onClick={handleUpload}
                            disabled={uploading}
                            className={`w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all duration-300 shadow-md ${
                                uploading 
                                    ? 'bg-[#141635] text-slate-500 cursor-not-allowed border border-[#141635] animate-pulse' 
                                    : 'bg-purple-600 hover:bg-purple-500 hover:scale-[1.01] active:scale-[0.99] shadow-[0_0_15px_rgba(168,85,247,0.4)] text-purple-50'
                            }`}
                        >
                            {uploading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                    AI model analyzing audio...
                                </span>
                            ) : 'Start Suppression & Analysis'}
                        </button>
                    </div>
                )}

                {error && (
                    <div className="mt-3 p-3 bg-pink-500/10 text-pink-400 text-xs rounded-xl border border-pink-500/25 glow-box-pink">
                        ⚠️ {error}
                    </div>
                )}
            </div>

            {/* Audio Players & Results */}
            {results && (
                <div className="mt-5 border-t border-[#141635] pt-4 flex-1 flex flex-col justify-end">
                    {/* Dominant noise badge */}
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">AI Classification</span>
                            <span className="text-xs text-slate-300">Dominant Noise:</span>
                        </div>
                        <div>
                            {renderNoiseBadge(results.noiseType)}
                        </div>
                    </div>

                    {/* Noise Composition Breakdown */}
                    {results.noiseBreakdown && Object.keys(results.noiseBreakdown).length > 0 && (
                        <div className="mb-4 p-3.5 rounded-xl border border-[#141635] bg-[#040510]/60">
                            <div className="text-[9px] uppercase tracking-widest text-slate-400 font-bold mb-3">
                                Noise Composition Breakdown
                            </div>
                            <div className="space-y-2.5">
                                {Object.entries(results.noiseBreakdown)
                                    .sort(([, a], [, b]) => b - a)
                                    .map(([label, pct]) => {
                                        const lower = label.toLowerCase();
                                        let barColor = '#6366f1';       // indigo default
                                        let textColor = 'text-indigo-400';
                                        if (lower.includes('traffic')) {
                                            barColor = '#ec4899'; textColor = 'text-pink-400';
                                        } else if (lower.includes('conversation') || lower.includes('speech') || lower.includes('crowd')) {
                                            barColor = '#a855f7'; textColor = 'text-purple-400';
                                        } else if (lower.includes('wind')) {
                                            barColor = '#06b6d4'; textColor = 'text-cyan-400';
                                        } else if (lower.includes('fan') || lower.includes('ac') || lower.includes('conditioner')) {
                                            barColor = '#22d3ee'; textColor = 'text-cyan-300';
                                        } else if (lower.includes('keyboard') || lower.includes('click') || lower.includes('typing')) {
                                            barColor = '#f59e0b'; textColor = 'text-amber-400';
                                        }
                                        return (
                                            <div key={label}>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className={`text-[10px] font-semibold ${textColor}`}>{label}</span>
                                                    <span className={`text-[10px] font-black ${textColor}`}>{pct}%</span>
                                                </div>
                                                <div className="h-1.5 w-full rounded-full bg-[#141635] overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-700 ease-out"
                                                        style={{
                                                            width: `${pct}%`,
                                                            background: `linear-gradient(90deg, ${barColor}99, ${barColor})`,
                                                            boxShadow: `0 0 6px ${barColor}66`
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        </div>
                    )}

                    <div className="space-y-3.5">
                        <div className="bg-[#040510]/60 p-2.5 rounded-xl border border-[#141635]">
                            <span className="text-[9px] uppercase tracking-widest text-slate-400 block mb-1.5 font-bold">Original Noisy Audio</span>
                            <CustomAudioPlayer src={results.originalAudioUrl} theme="pink" />
                        </div>
                        <div className="bg-[#040510]/60 p-2.5 rounded-xl border border-cyan-950/40 shadow-[0_0_10px_rgba(6,182,212,0.05)]">
                            <span className="text-[9px] uppercase tracking-widest text-cyan-400 glow-text-cyan block mb-1.5 font-bold">Cleaned Speech ({results.modelUsed || 'noisereduce'} Output)</span>
                            <CustomAudioPlayer src={results.cleanAudioUrl} theme="cyan" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AudioUploadCard;
