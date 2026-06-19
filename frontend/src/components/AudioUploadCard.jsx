import React, { useState, useRef } from 'react';
import { audioService } from '../services/api';

const AudioUploadCard = ({ onUploadSuccess }) => {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [results, setResults] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
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

            const response = await audioService.uploadAudio(file);
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
                    originalAudioUrl: URL.createObjectURL(file)
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
        
        let bg = 'bg-slate-800 text-slate-400 border border-slate-700/60';
        
        if (lower.includes('traffic')) {
            bg = 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
        } else if (lower.includes('crowd') || lower.includes('conversation') || lower.includes('speech')) {
            bg = 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
        } else if (lower.includes('wind')) {
            bg = 'bg-sky-500/10 text-sky-400 border border-sky-500/20';
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
        <div className="p-6 border border-slate-800/80 rounded-2xl bg-slate-900/40 backdrop-blur-md flex flex-col justify-between h-full shadow-xl">
            <div>
                <div className="flex items-center justify-between mb-5 shrink-0">
                    <h3 className="text-sm font-semibold text-white">Audio Processing Hub</h3>
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
                            ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_12px_rgba(99,102,241,0.2)]' 
                            : 'border-slate-800 bg-slate-950/40 hover:border-slate-600 hover:bg-slate-950/60'
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
                    <div className={`p-3 rounded-full mb-3 transition-colors duration-300 ${isDragging ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-900 text-slate-400'}`}>
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
                        <span className="relative group cursor-pointer inline-flex items-center gap-0.5 text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-2">
                            <span>Supported Formats</span>
                            <span className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 hidden group-hover:block bg-slate-950 text-slate-300 text-[10px] rounded-lg py-1.5 px-3 border border-slate-800 whitespace-nowrap shadow-2xl z-30 font-medium">
                                WAV, MP3, M4A files supported
                            </span>
                        </span>
                    </span>
                </div>

                {file && !results && (
                    <button
                        onClick={handleUpload}
                        disabled={uploading}
                        className={`w-full mt-4 py-2.5 rounded-xl text-xs font-bold tracking-wider text-white transition-all duration-300 shadow-md ${
                            uploading 
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50 animate-pulse' 
                                : 'bg-indigo-600 hover:bg-indigo-500 hover:scale-[1.01] active:scale-[0.99] hover:shadow-[0_0_12px_rgba(99,102,241,0.4)]'
                        }`}
                    >
                        {uploading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                AI model analyzing audio...
                            </span>
                        ) : 'Start Suppression & Analysis'}
                    </button>
                )}

                {error && (
                    <div className="mt-3 p-3 bg-rose-500/10 text-rose-400 text-xs rounded-xl border border-rose-500/20">
                        ⚠️ {error}
                    </div>
                )}
            </div>

            {/* Audio Players & Results */}
            {results && (
                <div className="mt-5 border-t border-slate-800/80 pt-4 flex-1 flex flex-col justify-end">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">AI Classification</span>
                            <span className="text-xs text-slate-300">Dominant Noise:</span>
                        </div>
                        <div>
                            {renderNoiseBadge(results.noiseType)}
                        </div>
                    </div>

                    <div className="space-y-3.5">
                        <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-900/60">
                            <span className="text-[9px] uppercase tracking-widest text-slate-500 block mb-1 font-bold">Original Noisy Audio</span>
                            <audio src={results.originalAudioUrl} controls className="w-full h-7 scale-95 origin-left" />
                        </div>
                        <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-900/60">
                            <span className="text-[9px] uppercase tracking-widest text-emerald-500 block mb-1 font-bold">Cleaned Speech (noisereduce Output)</span>
                            <audio src={results.cleanAudioUrl} controls className="w-full h-7 scale-95 origin-left" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AudioUploadCard;
