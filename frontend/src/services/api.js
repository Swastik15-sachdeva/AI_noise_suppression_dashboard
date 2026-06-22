import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const healthService = {
  getHealth: () => apiClient.get('/health'),
};

export const metricsService = {
  getMetrics: () => apiClient.get('/metrics'),
  resetMetrics: () => apiClient.post('/metrics/reset'),
};

export const audioService = {
  getAlerts: () => apiClient.get('/alerts'),
  uploadAudio: (file, model) => {
    const formData = new FormData();
    formData.append('file', file);
    const url = model ? `/audio/upload?model=${model}` : '/audio/upload';
    return apiClient.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  getCloudinaryFiles: () => apiClient.get('/audio/files'),
  deleteCloudinaryFile: (publicId) => apiClient.delete('/audio/files', { params: { public_id: publicId } }),
};

export default apiClient;
