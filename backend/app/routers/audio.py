import os
import shutil
import uuid
import time
import soundfile as sf
import numpy as np
import noisereduce as nr
from fastapi import APIRouter, File, UploadFile, HTTPException, WebSocket, WebSocketDisconnect
from typing import List
from app.models.schemas import Alert, AudioUploadResponse
from app.services import session
from app.services.noise_suppression_service import NoiseSuppressionService
from app.services.noise_classification_service import NoiseClassificationService
from app.services.audio_quality_service import AudioQualityService
from app.services.cloudinary_service import CloudinaryService
import subprocess

def get_current_branch():
    try:
        branch = subprocess.check_output(["git", "rev-parse", "--abbrev-ref", "HEAD"], stderr=subprocess.DEVNULL).decode("utf-8").strip()
        return branch
    except Exception:
        return "main"

router = APIRouter(tags=["Audio"])

# Create directories to store noisy and clean files
UPLOAD_DIR_NOISY = "uploads/noisy"
UPLOAD_DIR_CLEAN = "uploads/clean"
os.makedirs(UPLOAD_DIR_NOISY, exist_ok=True)
os.makedirs(UPLOAD_DIR_CLEAN, exist_ok=True)

# Initialize the suppression service
suppression_service = NoiseSuppressionService()

@router.get("/alerts", response_model=List[Alert])
def get_alerts():
    # Return the dynamic alerts list from session state
    return session.current_alerts

@router.post("/audio/upload", response_model=AudioUploadResponse)
def upload_audio(file: UploadFile = File(...)):
    try:
        # 1. Save uploaded file to noisy uploads folder locally
        file_bytes = file.file.read()
        file.file.seek(0)
        
        noisy_file_path = os.path.join(UPLOAD_DIR_NOISY, file.filename)
        with open(noisy_file_path, "wb") as buffer:
            buffer.write(file_bytes)
            
        branch = get_current_branch()
        
        # Upload raw/noisy audio to Cloudinary only if credentials are configured
        if os.getenv("CLOUDINARY_CLOUD_NAME"):
            try:
                cloudinary_url = CloudinaryService.upload_audio(
                    file_bytes=file_bytes, 
                    folder=f"{branch}/beforeNoiseSuppression", 
                    filename=file.filename.split('.')[0]
                )
            except Exception as upload_err:
                print(f"Failed to upload raw audio to Cloudinary: {str(upload_err)}")
        
        # 2. Define path for clean audio
        clean_file_path = os.path.join(UPLOAD_DIR_CLEAN, file.filename)
        
        # 3. Apply noise suppression
        suppression_result = suppression_service.process_audio(noisy_file_path, clean_file_path)
        if not suppression_result.get("success"):
            raise HTTPException(status_code=500, detail=f"Suppression model failed: {suppression_result.get('error')}")

        # Compute STOI estimate using standard librosa loading
        import librosa
        try:
            y_noisy, _ = librosa.load(noisy_file_path, sr=16000, mono=True)
            y_clean, _ = librosa.load(clean_file_path, sr=16000, mono=True)
            stoi_score = AudioQualityService.calculate_stoi_estimate(y_clean, y_noisy)
        except Exception as stoi_err:
            print(f"Failed to calculate STOI estimate: {stoi_err}")
            stoi_score = 0.85

        # 4. Classify noise type using our dedicated classifier
        noise_type = NoiseClassificationService.classify_noise(noisy_file_path)

        # 5. Analyze audio quality metrics using our quality service
        quality_metrics = AudioQualityService.analyze_quality(noisy_file_path)

        # 6. Update global session metrics
        session.update_metrics(
            noise_score=quality_metrics["noise_level"],
            voice_clarity=quality_metrics["voice_clarity"],
            audio_quality=quality_metrics["audio_quality"],
            stoi_score=stoi_score
        )

        # 7. Log a new alert for this audio upload
        session.add_alert(
            f"Processed {file.filename}: Dominant noise was '{noise_type}' (Level: {quality_metrics['noise_level']}%)."
        )

        # 8. Upload clean audio to Cloudinary if credentials are configured
        clean_audio_url = f"/static/clean/{file.filename}"
        if os.getenv("CLOUDINARY_CLOUD_NAME"):
            try:
                with open(clean_file_path, "rb") as f:
                    clean_bytes = f.read()
                clean_audio_url = CloudinaryService.upload_audio(
                    file_bytes=clean_bytes,
                    folder=f"{branch}/afterNoiseSuppression",
                    filename=file.filename.split('.')[0] + "_clean"
                )
                print(f"Successfully uploaded clean audio to Cloudinary: {clean_audio_url}")
            except Exception as upload_err:
                print(f"Failed to upload clean audio to Cloudinary: {str(upload_err)}. Falling back to local static URL.")

        return {
            "message": f"Successfully processed file: {file.filename}",
            "status": "success",
            "noise_type": noise_type,
            "voice_clarity": quality_metrics["voice_clarity"],
            "noise_score": quality_metrics["noise_level"],
            "speech_presence": quality_metrics["speech_presence"],
            "audio_quality": quality_metrics["audio_quality"],
            "clean_audio_url": clean_audio_url,
            "stoi_score": stoi_score
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process audio: {str(e)}")

@router.get("/audio/files")
def get_audio_files():
    try:
        branch = get_current_branch()
        before_files = CloudinaryService.get_audio_files(f"{branch}/beforeNoiseSuppression")
        after_files = CloudinaryService.get_audio_files(f"{branch}/afterNoiseSuppression")
        return {
            "before": before_files,
            "after": after_files
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch Cloudinary files: {str(e)}")

@router.websocket("/audio/stream")
async def audio_stream(websocket: WebSocket, suppress: bool = True, save: bool = False):
    await websocket.accept()
    print(f"WebSocket connection established for real-time audio stream. Suppression: {suppress}")
    
    # Update microphone status in session to streaming
    session.current_metrics["microphone_status"] = "streaming"
    
    # Buffers to calculate live metrics (3 seconds sliding window)
    rolling_buffer = []
    full_session_buffer = [] # Accumulate all audio to save at the end
    samples_count = 0
    
    # State to rate-limit alerts and notifications
    last_alert_time = 0
    last_detected_noise = "Other"
    
    try:
        while True:
            # Receive raw websocket message
            message = await websocket.receive()
            
            # Handle disconnect message
            if message.get("type") == "websocket.disconnect":
                print("WebSocket client disconnected via message")
                break
                
            # If text, check if it contains latency updates from the frontend
            if "text" in message:
                import json
                try:
                    payload = json.loads(message["text"])
                    if "latency" in payload:
                        session.current_metrics["latency"] = int(payload["latency"])
                except Exception as json_err:
                    print(f"Error parsing websocket text frame: {json_err}")
                continue
                
            # If bytes, it is a binary audio chunk
            if "bytes" in message:
                data = message["bytes"]
                if not data:
                    break
                
                # Convert bytes to numpy Float32 array
                audio_chunk = np.frombuffer(data, dtype=np.float32)
                
                if len(audio_chunk) > 0:
                    full_session_buffer.append(audio_chunk)
                    
                    if suppress:
                        # 1. Apply fast stationary noise reduction using noisereduce
                        cleaned_chunk = nr.reduce_noise(
                            y=audio_chunk,
                            sr=16000,
                            stationary=True,
                            prop_decrease=0.85
                        )
                    else:
                        cleaned_chunk = audio_chunk
                    
                    # 2. Accumulate in the sliding buffer for stream analysis
                    rolling_buffer.append(audio_chunk)
                    samples_count += len(audio_chunk)
                    
                    # 3 seconds window at 16kHz = 48,000 samples
                    if samples_count >= 48000:
                        # Concatenate all accumulated chunks
                        full_signal = np.concatenate(rolling_buffer)
                        # Keep only the last 3 seconds
                        analysis_signal = full_signal[-48000:]
                        
                        try:
                            # Analyze noise type and quality in-memory (no disk IO!)
                            noise_type = NoiseClassificationService.classify_noise(y=analysis_signal, sr=16000)
                            quality_metrics = AudioQualityService.analyze_quality(y=analysis_signal, sr=16000)
                            
                            # Calculate real-time STOI score if suppression is ON
                            if suppress:
                                clean_analysis = nr.reduce_noise(y=analysis_signal, sr=16000, stationary=True, prop_decrease=0.85)
                                stoi_score = AudioQualityService.calculate_stoi_estimate(clean_analysis, analysis_signal)
                            else:
                                stoi_score = 1.0
                            
                            # Update session metrics in real time
                            session.update_metrics(
                                noise_score=quality_metrics["noise_level"],
                                voice_clarity=quality_metrics["voice_clarity"],
                                audio_quality=quality_metrics["audio_quality"],
                                stoi_score=stoi_score
                            )
                            
                            # Log alert if specific noise detected (prevent spamming: rate-limit to once per 10s)
                            current_time = time.time()
                            if noise_type != "Other" and (noise_type != last_detected_noise or (current_time - last_alert_time) > 10):
                                session.add_alert(f"Live Mic: Detected '{noise_type}' background noise.")
                                last_alert_time = current_time
                                last_detected_noise = noise_type
                                
                        except Exception as analysis_err:
                            print(f"Error in stream analysis: {str(analysis_err)}")
                        
                        # Reset buffer to keep sliding window context
                        rolling_buffer = [analysis_signal]
                        samples_count = len(analysis_signal)
                    
                    # 3. Convert back to raw bytes and send cleaned audio
                    cleaned_bytes = cleaned_chunk.astype(np.float32).tobytes()
                    await websocket.send_bytes(cleaned_bytes)
    except WebSocketDisconnect:
        print("WebSocket client disconnected")
        # Save session to Cloudinary only if explicitly requested and credentials are configured
        if save and full_session_buffer and os.getenv("CLOUDINARY_CLOUD_NAME"):
            session_audio = np.concatenate(full_session_buffer)
            try:
                import io
                wav_buffer = io.BytesIO()
                sf.write(wav_buffer, session_audio, 16000, format='WAV')
                file_bytes = wav_buffer.getvalue()
                    
                branch = get_current_branch()
                folder = f"{branch}/afterNoiseSuppression" if suppress else f"{branch}/beforeNoiseSuppression"
                CloudinaryService.upload_audio(
                    file_bytes=file_bytes,
                    folder=folder,
                    filename=f"live_{'suppressed' if suppress else 'raw'}_{int(time.time())}"
                )
                print(f"Uploaded live session to {folder}")
            except Exception as e:
                print(f"Failed to save stream to Cloudinary: {e}")

    except Exception as e:
        print(f"Error in WebSocket audio stream: {str(e)}")
        
    finally:
        # Reset microphone status and metrics on disconnect/error
        session.current_metrics["microphone_status"] = "connected"
        session.current_metrics["noise_score"] = 0
        session.current_metrics["voice_clarity"] = 100
        session.current_metrics["audio_quality"] = 100
        print("WebSocket stream finished: Reset microphone status and metrics to defaults.")

@router.delete("/audio/files")
def delete_audio(public_id: str):
    try:
        success = CloudinaryService.delete_audio(public_id)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to delete file from Cloudinary")
        return {"status": "success", "message": "File deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

