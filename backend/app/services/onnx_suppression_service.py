import os
import urllib.request
import numpy as np

# Try importing onnxruntime. If it fails, fallback gracefully to classical DSP.
try:
    import onnxruntime as ort
    ONNX_AVAILABLE = True
except ImportError:
    ort = None
    ONNX_AVAILABLE = False

# Public pretrained ONNX model weights URLs
DTLN_URL = "https://github.com/breizhn/DTLN/raw/master/pretrained_model/model_1.onnx"
RNNOISE_URL = "https://github.com/shome-r/rnnoise-onnx/raw/main/rnnoise.onnx"

class ONNXSuppressionService:
    def __init__(self):
        self.models_dir = "models/onnx"
        os.makedirs(self.models_dir, exist_ok=True)
        self.dtln_path = os.path.join(self.models_dir, "dtln.onnx")
        self.rnnoise_path = os.path.join(self.models_dir, "rnnoise.onnx")
        
        self.sessions = {}
        self.states = {}
        
    def _download_file(self, url: str, dest: str) -> bool:
        try:
            print(f"Downloading pre-trained ONNX model from {url} to {dest}...")
            # Use headers to prevent server block on user-agent
            req = urllib.request.Request(
                url, 
                headers={'User-Agent': 'Mozilla/5.0'}
            )
            with urllib.request.urlopen(req) as response, open(dest, 'wb') as out_file:
                out_file.write(response.read())
            print("Download completed successfully.")
            return True
        except Exception as e:
            print(f"Error downloading ONNX weights: {e}")
            return False

    def _get_session(self, model_name: str):
        if not ONNX_AVAILABLE:
            return None
            
        if model_name in self.sessions:
            return self.sessions[model_name]
            
        if model_name == "dtln":
            path = self.dtln_path
            url = DTLN_URL
        elif model_name == "rnnoise":
            path = self.rnnoise_path
            url = RNNOISE_URL
        else:
            return None
            
        # Download if not exists
        if not os.path.exists(path):
            success = self._download_file(url, path)
            if not success:
                return None
                
        try:
            # Create CPU ONNX session
            session = ort.InferenceSession(path, providers=['CPUExecutionProvider'])
            self.sessions[model_name] = session
            
            # Initialize hidden states with zeros based on inputs
            self.states[model_name] = {}
            for input_meta in session.get_inputs():
                if any(x in input_meta.name.lower() for x in ["state", "h_in", "c_in", "h0", "c0"]):
                    shape = [1 if (dim is None or dim == -1) else dim for dim in input_meta.shape]
                    self.states[model_name][input_meta.name] = np.zeros(shape, dtype=np.float32)
            
            print(f"ONNX Model '{model_name}' loaded successfully on CPU.")
            return session
        except Exception as e:
            print(f"Error loading ONNX session for '{model_name}': {e}")
            return None

    def process_chunk(self, audio_chunk: np.ndarray, model_name: str) -> np.ndarray:
        """
        Processes a raw audio chunk using the selected ONNX model.
        Falls back to raw audio if model/runtime is unavailable.
        """
        if not ONNX_AVAILABLE or model_name not in ["dtln", "rnnoise"]:
            return audio_chunk
            
        session = self._get_session(model_name)
        if session is None:
            return audio_chunk
            
        try:
            # DTLN model processing
            if model_name == "dtln":
                block_size = 512
                if len(audio_chunk) % block_size != 0:
                    pad_len = block_size - (len(audio_chunk) % block_size)
                    audio_chunk = np.pad(audio_chunk, (0, pad_len))
                    
                processed_blocks = []
                for i in range(0, len(audio_chunk), block_size):
                    block = audio_chunk[i:i+block_size]
                    
                    inputs = {}
                    # DTLN model input shape: [1, 1, 512] or [1, 512]
                    first_input_name = session.get_inputs()[0].name
                    first_input_shape = session.get_inputs()[0].shape
                    
                    if len(first_input_shape) == 3:
                        inputs[first_input_name] = block.reshape(1, 1, block_size).astype(np.float32)
                    else:
                        inputs[first_input_name] = block.reshape(1, block_size).astype(np.float32)
                    
                    # Feed current states
                    for state_name, state_val in self.states[model_name].items():
                        inputs[state_name] = state_val
                        
                    outputs = session.run(None, inputs)
                    
                    # Output is usually the first element in outputs
                    out_block = outputs[0].flatten()
                    processed_blocks.append(out_block)
                    
                    # Update states returned from session
                    state_idx = 1
                    for state_name in self.states[model_name].keys():
                        if state_idx < len(outputs):
                            self.states[model_name][state_name] = outputs[state_idx]
                            state_idx += 1
                            
                return np.concatenate(processed_blocks)[:len(audio_chunk)]
                
            # RNNoise model processing
            elif model_name == "rnnoise":
                block_size = 480
                if len(audio_chunk) % block_size != 0:
                    pad_len = block_size - (len(audio_chunk) % block_size)
                    audio_chunk = np.pad(audio_chunk, (0, pad_len))
                    
                processed_blocks = []
                for i in range(0, len(audio_chunk), block_size):
                    block = audio_chunk[i:i+block_size]
                    
                    inputs = {}
                    first_input_name = session.get_inputs()[0].name
                    inputs[first_input_name] = block.reshape(1, block_size).astype(np.float32)
                    
                    for state_name, state_val in self.states[model_name].items():
                        inputs[state_name] = state_val
                        
                    outputs = session.run(None, inputs)
                    
                    out_block = outputs[0].flatten()
                    processed_blocks.append(out_block)
                    
                    state_idx = 1
                    for state_name in self.states[model_name].keys():
                        if state_idx < len(outputs):
                            self.states[model_name][state_name] = outputs[state_idx]
                            state_idx += 1
                            
                return np.concatenate(processed_blocks)[:len(audio_chunk)]
                
            return audio_chunk
        except Exception as err:
            print(f"ONNX inference error for '{model_name}': {err}")
            return audio_chunk
