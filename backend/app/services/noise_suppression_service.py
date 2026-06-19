import os
import numpy as np
import librosa
import soundfile as sf
import noisereduce as nr
from typing import Dict, Any

class NoiseSuppressionService:
    """
    Service to perform background noise suppression using noisereduce.
    """
    
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
