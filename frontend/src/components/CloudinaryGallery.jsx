import React, { useState, useEffect } from 'react';
import { audioService } from '../services/api';

const CloudinaryGallery = ({ refreshTrigger }) => {
    const [files, setFiles] = useState({ before: [], after: [] });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('before'); // 'before' or 'after'
    const [configured, setConfigured] = useState(true);

    useEffect(() => {
        const fetchFiles = async () => {
            try {
                setLoading(true);
                const response = await audioService.getCloudinaryFiles();
                setFiles(response.data);
                if (response.data && typeof response.data.configured === 'boolean') {
                    setConfigured(response.data.configured);
                }
            } catch (error) {
                console.error("Failed to fetch Cloudinary files", error);
            } finally {
                setLoading(false);
            }
        };

        fetchFiles();
    }, [refreshTrigger]);

    if (loading) {
        return (
            <div className="flex justify-center items-center p-8 text-sm text-slate-500">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="font-medium">Loading Cloudinary Audio Files...</span>
            </div>
        );
    }

    const currentFiles = activeTab === 'before' ? files.before : files.after;

    return (
        <div className="mt-8 border-t border-[#141635] pt-8">
            <h2 className="text-lg font-black tracking-wider text-slate-100 glow-text-white mb-6">Cloudinary Audio Gallery</h2>
            
            {/* Tabs */}
            <div className="flex space-x-2 border-b border-[#141635]/50 mb-6">
                <button
                    onClick={() => setActiveTab('before')}
                    className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                        activeTab === 'before' 
                        ? 'border-purple-500 text-purple-400 glow-text-purple' 
                        : 'border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                >
                    Before Suppression (Raw)
                </button>
                <button
                    onClick={() => setActiveTab('after')}
                    className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                        activeTab === 'after' 
                        ? 'border-purple-500 text-purple-400 glow-text-purple' 
                        : 'border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                >
                    After Suppression (Cleaned)
                </button>
            </div>

            {/* Tab Content */}
            <div className="p-6 border border-[#141635] rounded-2xl bg-[#0a0b1f]/60 backdrop-blur-md min-h-[200px] hover:border-indigo-500/30 transition-all duration-300">
                {!configured ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 py-8 text-center max-w-md mx-auto gap-3">
                        <div className="p-3 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                            </svg>
                        </div>
                        <h4 className="text-xs font-bold text-amber-400 uppercase tracking-widest">Cloudinary Config Required</h4>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                            To view and persist audio files in this gallery, please configure your Cloudinary credentials (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`) in your backend `.env` file.
                        </p>
                    </div>
                ) : currentFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 py-8">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 mb-2 opacity-50">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75V3m0 0L8.25 6.75M12 3l3.75 3.75M19.5 12a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" />
                        </svg>
                        <p className="text-sm font-medium">No audio files found in this folder.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                        {currentFiles.map((file, idx) => (
                            <div key={idx} className="bg-[#040510]/60 p-4 border border-[#141635]/80 rounded-xl shadow-sm hover:border-cyan-400/50 hover:shadow-[0_0_15px_rgba(6,182,212,0.1)] transition-all duration-300">
                                <span className="text-xs font-semibold text-slate-300 break-all mb-3 block truncate" title={file.id}>
                                    {file.id}
                                </span>
                                <audio src={file.url} controls className="w-full h-8 scale-95 origin-left" />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CloudinaryGallery;
