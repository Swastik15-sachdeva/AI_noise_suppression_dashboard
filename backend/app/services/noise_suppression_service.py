import os
import numpy as np
import librosa
import soundfile as sf
import noisereduce as nr
from typing import Dict, Any
from scipy.signal import butter, lfilter

class NoiseSuppressionService:
    """
    Service to perform background noise suppression using noisereduce.
    """
    
    @staticmethod
    def apply_voice_boost(y: np.ndarray, sr: int = 16000) -> np.ndarray:
        """
        Applies a voice clarity boost to a clean signal by:
        1. High-pass filtering above 80Hz (removes low-end rumble/plosives).
        2. Equalizing / boosting presence frequencies (1kHz - 3.5kHz) where speech clarity lives.
        3. Peak-normalizing to ensure maximum loudness without clipping.
        """
        try:
            nyq = 0.5 * sr
            # 1. High-pass filter at 80Hz to clean up sub-bass
            b_hp, a_hp = butter(2, 80.0 / nyq, btype='high')
            y_hp = lfilter(b_hp, a_hp, y)
            
            # 2. Band-pass filter to extract presence band (1000Hz - 3500Hz)
            low_cut = 1000.0 / nyq
            high_cut = 3500.0 / nyq
            b_bp, a_bp = butter(2, [low_cut, high_cut], btype='band')
            y_presence = lfilter(b_bp, a_bp, y_hp)
            
            # 3. Mix presence back with high-passed audio to boost voice
            y_boosted = y_hp + 0.6 * y_presence
            
            # 4. Normalize to -1 dB (0.89) to prevent clipping
            peak = np.max(np.abs(y_boosted))
            if peak > 1e-5:
                y_boosted = (y_boosted / peak) * 0.89
                
            return y_boosted.astype(np.float32)
        except Exception as e:
            print(f"Failed to apply voice boost: {e}")
            return y

    def __init__(self):
        """
        Initializes the noise suppression service.
        """
        try:
            print("NoiseSuppressionService initialized successfully using noisereduce")
        except Exception as e:
            print(f"Error initializing NoiseSuppressionService: {str(e)}")
    
    def process_audio(self, input_path: str, output_path: str) -> Dict[str, Any]:
        """
        Processes an audio file to suppress background noise.
        
        Args:
            input_path: Path to the noisy audio file.
            output_path: Path to save the processed clean audio file.
            
        Returns:
            Dict[str, Any]: Analysis results including success status and metrics.
        """
        try:
            # 1. Load audio using librosa (16kHz, mono)
            y, sr = librosa.load(input_path, sr=16000, mono=True)
            
            if len(y) == 0:
                raise ValueError("Loaded audio file is empty")
            
            # 2. Apply fast stationary noise reduction using noisereduce
            clean_waveform = nr.reduce_noise(
                y=y,
                sr=sr,
                stationary=True,
                prop_decrease=0.85
            )
            
            # 3. Save processed clean audio using soundfile
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            sf.write(output_path, clean_waveform, sr)
            
            return {
                "success": True,
                "error": None,
                "clean_audio_url": output_path
            }
            
        except Exception as e:
            print(f"Error processing audio: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "clean_audio_url": ""
            }
