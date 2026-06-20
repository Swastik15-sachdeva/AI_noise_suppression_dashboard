import React, { useState, useEffect } from 'react';
import { audioService } from '../services/api';

const CloudinaryGallery = ({ refreshTrigger }) => {
    const [files, setFiles] = useState({ before: [], after: [] });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('before'); // 'before' or 'after'

    useEffect(() => {
        const fetchFiles = async () => {
            try {
                setLoading(true);
                const response = await audioService.getCloudinaryFiles();
                setFiles(response.data);
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
        <div className="mt-8 border-t border-slate-800/80 pt-8">
            <h2 className="text-lg font-semibold text-white mb-6">Cloudinary Audio Gallery</h2>
            
            {/* Tabs */}
            <div className="flex space-x-2 border-b border-slate-800/50 mb-6">
                <button
                    onClick={() => setActiveTab('before')}
                    className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                        activeTab === 'before' 
                        ? 'border-indigo-500 text-white' 
                        : 'border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                >
                    Before Suppression (Raw)
                </button>
                <button
                    onClick={() => setActiveTab('after')}
                    className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                        activeTab === 'after' 
                        ? 'border-indigo-500 text-white' 
                        : 'border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                >
                    After Suppression (Cleaned)
                </button>
            </div>

            {/* Tab Content */}
            <div className="p-6 border border-slate-800/80 rounded-2xl bg-slate-900/40 backdrop-blur-md min-h-[200px]">
                {currentFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 py-8">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 mb-2 opacity-50">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75V3m0 0L8.25 6.75M12 3l3.75 3.75M19.5 12a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" />
                        </svg>
                        <p className="text-sm font-medium">No audio files found in this folder.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                        {currentFiles.map((file, idx) => (
                            <div key={idx} className="bg-slate-950/60 p-4 border border-slate-900/60 rounded-xl shadow-sm hover:border-slate-800 transition-colors">
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
