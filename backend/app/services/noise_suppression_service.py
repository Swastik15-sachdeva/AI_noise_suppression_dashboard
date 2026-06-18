import torch
import torchaudio
import os
from typing import Dict, Any

class NoiseSuppressionService:
    """
    Service to perform background noise suppression using a pre-trained ConvTasNet model.
    """
    
    def __init__(self):
        """
        Initializes the pre-trained ConvTasNet model from Torchaudio pipelines.
        """
        try:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            
            # Use the pre-trained ConvTasNet model trained on Libri2Mix speech separation
            from torchaudio.pipelines import CONVTASNET_BASE_LIBRI2MIX 
            self.bundle = CONVTASNET_BASE_LIBRI2MIX
            self.model = self.bundle.get_model()
            self.model.to(self.device)
            self.model.eval()
            
            print(f"NoiseSuppressionService initialized successfully on {self.device}")
            
        except Exception as e:
            print(f"Error initializing NoiseSuppressionService: {str(e)}")
            self.model = None
    
    def process_audio(self, input_path: str, output_path: str) -> Dict[str, Any]:
        """
        Processes an audio file to separate speech from background noise.
        
        Args:
            input_path: Path to the noisy audio file.
            output_path: Path to save the processed clean audio file.
            
        Returns:
            Dict[str, Any]: Analysis results including success status and metrics.
        """
        if self.model is None:
            return {
                "success": False,
                "error": "Model not initialized properly",
                "clean_audio_url": ""
            }
        
        try:
            # Load audio using torchaudio
            waveform, sample_rate = torchaudio.load(input_path)
            
            # ConvTasNet expects mono audio at its target sample rate (usually 8000Hz or 16000Hz)
            if sample_rate != self.bundle.sample_rate:
                resampler = torchaudio.transforms.Resample(sample_rate, self.bundle.sample_rate)
                waveform = resampler(waveform)
            
            # Convert to mono if it is stereo
            if waveform.shape[0] > 1:
                waveform = torch.mean(waveform, dim=0, keepdim=True)
                
            waveform = waveform.to(self.device)
            
            # Perform speech separation
            with torch.no_grad():
                # ConvTasNet expects shape [batch, channels, time]
                # unsqueeze(0) adds the batch dimension
                separated = self.model(waveform.unsqueeze(0)) # Output shape: [1, num_sources, time]
                
                # ConvTasNet splits the mixture into 2 sources (speech, background noise)
                # Source 0 is typically the primary speech signal
                clean_waveform = separated[0][0:1].cpu()
            
            # Save the clean processed audio
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            torchaudio.save(output_path, clean_waveform, self.bundle.sample_rate)
            
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
