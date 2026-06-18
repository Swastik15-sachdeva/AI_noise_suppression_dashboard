import torch
import torchaudio
import os
import tempfile
from typing import Dict, Any

class NoiseSuppressionService:
    """
    Service to perform background noise suppression using Demucs model.
    This is a placeholder implementation using a pre-trained Demucs model.
    """
    
    def __init__(self):
        """
        Initializes the Demucs model.
        """
        try:
            # Try to use GPU if available
            if torch.cuda.is_available():
                self.device = torch.device("cuda")
            else:
                self.device = torch.device("cpu")
            
            # Load Demucs model
            # We use the stem_model for general audio processing
            from torchaudio.pipelines import REMIX 
            self.model = REMIX()
            self.model.to(self.device)
            self.model.eval()
            
            print(f"NoiseSuppressionService initialized on {self.device}")
            
        except Exception as e:
            print(f"Error initializing NoiseSuppressionService: {str(e)}")
            self.model = None
    
    def process_audio(self, input_path: str, output_path: str) -> Dict[str, Any]:
        """
        Processes an audio file to suppress background noise.
        
        Args:
            input_path: Path to the noisy audio file.
            output_path: Path to save the processed clean audio file.
            
        Returns:
            Dict[str, Any]: Analysis results including metrics and file paths.
        """
        if not self.model:
            return {
                "success": False,
                "error": "Model not initialized",
                "noise_score": 100,
                "voice_clarity": 0,
                "audio_quality": 0,
                "clean_audio_url": ""
            }
        
        try:
            # Load audio
            waveform, sample_rate = torchaudio.load(input_path)
            waveform = waveform.to(self.device)
            
            # Perform noise suppression
            with torch.no_grad():
                # Demucs returns a dictionary of stems
                # Format: { 'bass': tensor, 'drums': tensor, 'other': tensor, 'vocals': tensor }
                processed_audio = self.model(waveform)
                
                # Extract the 'other' stem which usually contains vocals and main instruments
                # or combine all stems except bass/drums if we want pure vocals
                # For simplicity, let's combine 'other' and 'vocals' if available
                clean_waveform = torch.zeros_like(waveform)
                
                for stem, audio_data in processed_audio.items():
                    if stem in ['other', 'vocals']:
                        clean_waveform += audio_data
                    elif stem == 'instrument': # In some models this might be present
                        clean_waveform += audio_data
                
                # If no specific stems, use the original with some processing
                if torch.all(clean_waveform == 0):
                    clean_waveform = waveform
                
                # Ensure output is mono if input was mono, or keep stereo
                if waveform.shape[0] == 1:
                    clean_waveform = clean_waveform.mean(dim=0, keepdim=True)
                
                # Save processed audio
                # Ensure output directory exists
                os.makedirs(os.path.dirname(output_path), exist_ok=True)
                
                torchaudio.save(output_path, clean_waveform, sample_rate)
            
            # Perform basic analysis
            noise_score = self._calculate_noise_score(waveform, clean_waveform)
            voice_clarity = self._calculate_voice_clarity(clean_waveform)
            audio_quality = self._calculate_audio_quality(clean_waveform, noise_score)
            
            return {
                "success": True,
                "error": None,
                "noise_type": self._detect_noise_type(input_path),
                "voice_clarity": voice_clarity,
                "noise_score": noise_score,
                "speech_presence": self._detect_speech_presence(waveform),
                "audio_quality": audio_quality,
                "clean_audio_url": output_path
            }
            
        except Exception as e:
            print(f"Error processing audio: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "noise_score": 100,
                "voice_clarity": 0,
                "audio_quality": 0,
                "clean_audio_url": ""
            }
    
    def _calculate_noise_score(self, original_audio: torch.Tensor, processed_audio: torch.Tensor) -> int:
        """
        Calculates noise score based on reduction.
        """
        try:
            # Calculate energy of original and processed audio
            original_energy = torch.norm(original_audio) ** 2
            processed_energy = torch.norm(processed_audio) ** 2
            
            if original_energy == 0:
                return 100
            
            # Reduction factor
            reduction = (original_energy - processed_energy) / original_energy
            
            # Convert to percentage (0-100)
            noise_score = int(min(100, max(0, reduction * 100)))
            return noise_score
        except:
            return 100
    
    def _calculate_voice_clarity(self, audio: torch.Tensor) -> int:
        """
        Calculates voice clarity.
        """
        try:
            # Simplified: based on energy level
            energy = torch.norm(audio) ** 2
            # Normalize based on typical audio energy
            clarity = min(100, int(energy / 1000000))
            return clarity
        except:
            return 80
    
    def _calculate_audio_quality(self, audio: torch.Tensor, noise_score: int) -> int:
        """
        Calculates overall audio quality.
        """
        try:
            # Combine voice clarity and noise reduction
            # Quality = (Voice Clarity * 0.6) + (Noise Reduction * 0.4)
            quality = int((self._calculate_voice_clarity(audio) * 0.6) + (noise_score * 0.4))
            return quality
        except:
            return 80
    
    def _detect_noise_type(self, file_path: str) -> str:
        """
        Placeholder for actual noise type detection.
        In a real implementation, this would use a classifier model.
        """
        # Simple heuristic or placeholder
        # For now, return a generic type
        return "background"
    
    def _detect_speech_presence(self, audio: torch.Tensor) -> int:
        """
        Detects presence of speech.
        """
        try:
            # Simple heuristic: energy level
            energy = torch.norm(audio) ** 2
            if energy > 100000: # Threshold can be adjusted
                return 90 # High confidence
            return 30 # Low confidence
        except:
            return 50
