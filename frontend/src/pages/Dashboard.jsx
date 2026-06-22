import React, { useState, useEffect } from 'react';
import DashboardHeader from '../components/DashboardHeader';
import MicrophoneStatusCard from '../components/MicrophoneStatusCard';
import NoiseLevelCard from '../components/NoiseLevelCard';
import VoiceQualityCard from '../components/VoiceQualityCard';
import LatencyCard from '../components/LatencyCard';
import AudioUploadCard from '../components/AudioUploadCard';
import AudioWaveformCard from '../components/AudioWaveformCard';
import AlertPanel from '../components/AlertPanel';
import CloudinaryGallery from '../components/CloudinaryGallery';
import ModelBenchmarksCard from '../components/ModelBenchmarksCard';
import { healthService, metricsService, audioService } from '../services/api';

const Dashboard = () => {
  const [systemStatus, setSystemStatus] = useState('loading');
  const [metrics, setMetrics] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadCount, setUploadCount] = useState(0);
  const [selectedModel, setSelectedModel] = useState('noisereduce');

  const fetchData = async () => {
    try {
      const [healthRes, metricsRes, alertsRes] = await Promise.all([
        healthService.getHealth().catch(() => ({ data: { status: 'offline' } })),
        metricsService.getMetrics(),
        audioService.getAlerts()
      ]);
      setSystemStatus(healthRes.data.status);
      setMetrics(metricsRes.data);
      setAlerts(alertsRes.data);
    } catch {
      setSystemStatus('offline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initDashboard = async () => {
      try {
        await metricsService.resetMetrics();
      } catch (err) {
        console.error("Failed to reset metrics:", err);
      }
      fetchData();
    };
    initDashboard();
    // Poll for alerts and online status check every 2 seconds for real-time updates
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleUploadSuccess = (data) => {
    // Instantly update UI metrics from the processed audio file results
    setMetrics({
      microphone_status: 'connected',
      noise_score: data.noise_score,
      voice_clarity: data.voice_clarity,
      latency: metrics?.latency || 50,
      audio_quality: data.audio_quality,
      stoi_score: data.stoi_score || 1.0
    });
    // Refresh alerts to show the new classification log
    audioService.getAlerts().then((res) => {
      setAlerts(res.data);
    });
    // Trigger Cloudinary gallery refresh
    setUploadCount(prev => prev + 1);
  };

  // Called by AudioWaveformCard whenever the backend pushes a live metrics frame
  // over the WebSocket — gives us instant KPI updates without waiting for the 2s poll
  const handleLiveMetrics = (liveData) => {
    setMetrics(prev => ({
      ...prev,
      noise_score: liveData.noise_score ?? prev?.noise_score,
      voice_clarity: liveData.voice_clarity ?? prev?.voice_clarity,
      audio_quality: liveData.audio_quality ?? prev?.audio_quality,
      stoi_score: liveData.stoi_score ?? prev?.stoi_score,
      // Prefer the RTT latency measured by the WS client when available
      latency: liveData.latency ?? prev?.latency,
    }));
  };

  if (loading && !metrics) {
    return (
      <div className="relative min-h-screen w-screen overflow-hidden flex flex-col items-center justify-center bg-[#070913] text-slate-400 gap-4">
        {/* Dynamic Background Glow Blobs for loading state */}
        <div className="glow-blob glow-blob-1"></div>
        <div className="glow-blob glow-blob-2"></div>
        <div className="glow-blob glow-blob-3"></div>

        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="h-7 w-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-[10px] tracking-widest uppercase font-semibold text-slate-500">
            Loading Dashboard...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto flex flex-col max-w-6xl mx-auto px-6 py-8">
      <DashboardHeader systemStatus={systemStatus} />

      <div className="flex flex-col gap-6 pb-12">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 shrink-0">
          <MicrophoneStatusCard status={metrics?.microphone_status} />
          <NoiseLevelCard score={metrics?.noise_score} />
          <VoiceQualityCard clarity={metrics?.voice_clarity} stoi={metrics?.stoi_score} />
          <LatencyCard latency={metrics?.latency} />
        </div>

        {/* Main View: Left side has stack of Upload and Visualizer, Right side has Alerts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
          <div className="md:col-span-2 flex flex-col gap-6">
            <div className="flex-1 min-h-fit">
              <AudioUploadCard onUploadSuccess={handleUploadSuccess} selectedModel={selectedModel} />
            </div>
            <div className="min-h-fit">
              <AudioWaveformCard
                onUploadSuccess={handleUploadSuccess}
                onLiveMetrics={handleLiveMetrics}
                selectedModel={selectedModel}
              />
            </div>
          </div>
          <div className="md:col-span-1 h-full flex flex-col">
            <AlertPanel alerts={alerts} />
          </div>
        </div>
        
        {/* Model Benchmarks Card */}
        <div className="shrink-0">
          <ModelBenchmarksCard
            selectedModel={selectedModel}
            onModelSelect={setSelectedModel}
          />
        </div>
        
        {/* Cloudinary Gallery */}
        <CloudinaryGallery refreshTrigger={uploadCount} />
      </div>
    </div>
  );
};

export default Dashboard;
