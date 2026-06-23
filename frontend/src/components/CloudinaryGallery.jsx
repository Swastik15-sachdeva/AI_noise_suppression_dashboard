import React, { useState, useEffect } from 'react';
import { audioService } from '../services/api';
import CustomAudioPlayer from './CustomAudioPlayer';

const CloudinaryGallery = ({ refreshTrigger }) => {
    const [files, setFiles] = useState({ before: [], after: [] });
    const [loading, setLoading] = useState(true);
    const [configured, setConfigured] = useState(true);
    const [deletingId, setDeletingId] = useState(null);

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

    useEffect(() => {
        fetchFiles();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshTrigger]);

    const handleDelete = async (publicId) => {
        if (!window.confirm("Are you sure you want to delete this audio file from Cloudinary?")) {
            return;
        }

        try {
            setDeletingId(publicId);
            await audioService.deleteCloudinaryFile(publicId);
            await fetchFiles();
        } catch (err) {
            console.error("Failed to delete file", err);
            alert("Failed to delete the file: " + (err.response?.data?.detail || err.message));
        } finally {
            setDeletingId(null);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Date unknown';
        const date = new Date(dateString);
        return date.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getDisplayId = (publicId) => {
        if (!publicId) return '';
        const parts = publicId.split('/');
        return parts[parts.length - 1];
    };

    if (loading && files.before.length === 0 && files.after.length === 0) {
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

    const renderFileCard = (file, isAfter = false) => {
        const isDeleting = deletingId === file.id;
        const displayId = getDisplayId(file.id);
        const displayDate = formatDate(file.created_at);
        const playerTheme = isAfter ? 'cyan' : 'pink';

        return (
            <div key={file.id} className="bg-[#040510]/80 p-3.5 border border-[#141635]/80 rounded-xl shadow-md hover:border-indigo-500/20 transition-all duration-300 flex flex-col gap-2.5 relative group">
                <div className="flex items-start justify-between gap-2.5 text-left">
                    <div className="min-w-0">
                        <span className="text-[11px] font-bold text-slate-300 block truncate" title={file.id}>
                            {displayId}
                        </span>
                        <span className="text-[9px] text-slate-500 font-semibold block mt-0.5">
                            Uploaded: {displayDate}
                        </span>
                    </div>

                    <button
                        onClick={() => handleDelete(file.id)}
                        disabled={isDeleting}
                        className="p-1.5 rounded-lg border border-transparent text-slate-500 hover:text-pink-500 hover:bg-pink-500/10 hover:border-pink-500/20 active:scale-95 transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Delete file from Cloudinary"
                    >
                        {isDeleting ? (
                            <svg className="animate-spin h-3.5 w-3.5 text-pink-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-3.5 h-3.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                        )}
                    </button>
                </div>
                <CustomAudioPlayer src={file.url} theme={playerTheme} />
            </div>
        );
    };

    return (
        <div className="mt-8 border-t border-[#141635] pt-8">
            <h2 className="text-lg font-black tracking-wider text-slate-100 glow-text-white mb-6 text-left">Cloudinary Audio Gallery</h2>

            {!configured ? (
                <div className="p-6 border border-[#141635] rounded-2xl bg-[#0a0b1f]/60 backdrop-blur-md hover:border-indigo-500/30 transition-all duration-300">
                    <div className="flex flex-col items-center justify-center text-slate-400 py-8 text-center max-w-md mx-auto gap-3">
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
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Before Suppression Column */}
                    <div className="p-5 border border-[#141635] rounded-2xl bg-[#0a0b1f]/60 backdrop-blur-md hover:border-indigo-500/20 transition-all duration-300 flex flex-col">
                        <div className="flex items-center justify-between mb-4 border-b border-[#141635]/40 pb-2">
                            <span className="text-xs font-black uppercase tracking-wider text-pink-400 glow-text-pink">Before Suppression (Raw)</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-[#141635] rounded-md text-slate-400">{files.before.length} files</span>
                        </div>
                        <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1.5 custom-scrollbar">
                            {files.before.length === 0 ? (
                                <div className="text-[11px] text-slate-500 italic py-8 text-center">No raw audio files found.</div>
                            ) : (
                                files.before.map(file => renderFileCard(file, false))
                            )}
                        </div>
                    </div>

                    {/* After Suppression Column */}
                    <div className="p-5 border border-[#141635] rounded-2xl bg-[#0a0b1f]/60 backdrop-blur-md hover:border-indigo-500/20 transition-all duration-300 flex flex-col">
                        <div className="flex items-center justify-between mb-4 border-b border-[#141635]/40 pb-2">
                            <span className="text-xs font-black uppercase tracking-wider text-cyan-400 glow-text-cyan">After Suppression (Cleaned)</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-[#141635] rounded-md text-slate-400">{files.after.length} files</span>
                        </div>
                        <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1.5 custom-scrollbar">
                            {files.after.length === 0 ? (
                                <div className="text-[11px] text-slate-500 italic py-8 text-center">No cleaned audio files found.</div>
                            ) : (
                                files.after.map(file => renderFileCard(file, true))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CloudinaryGallery;
