from pydantic import BaseModel
from typing import Dict, List, Optional

class HealthResponse(BaseModel):
    status: str

class MetricsResponse(BaseModel):
    microphone_status: str
    noise_score: int
    voice_clarity: int
    latency: int
    audio_quality: int
    stoi_score: float

class Alert(BaseModel):
    message: str
    time: str

class AudioUploadResponse(BaseModel):
    message: str
    status: str
    noise_type: str
    voice_clarity: int
    noise_score: int
    speech_presence: int
    audio_quality: int
    clean_audio_url: str
    stoi_score: float
    noise_breakdown: Optional[Dict[str, float]] = None
    model_used: Optional[str] = None
