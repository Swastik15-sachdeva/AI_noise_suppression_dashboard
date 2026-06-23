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
from app.services.onnx_suppression_service import ONNXSuppressionService
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

# Initialize services
suppression_service = NoiseSuppressionService()
onnx_service = ONNXSuppressionService()

@router.get("/alerts", response_model=List[Alert])
def get_alerts():
    # Return the dynamic alerts list from session state
    return session.current_alerts

@router.post("/audio/upload", response_model=AudioUploadResponse)
def upload_audio(file: UploadFile = File(...), model: str = "noisereduce", voice_boost: bool = False):
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
        
        # 3. Apply noise suppression based on selected model
        if model == "noisereduce":
            suppression_result = suppression_service.process_audio(noisy_file_path, clean_file_path)
            if not suppression_result.get("success"):
                raise HTTPException(status_code=500, detail=f"Suppression model failed: {suppression_result.get('error')}")
            
            if voice_boost:
                try:
                    import librosa, soundfile as sf
                    y_clean, sr = librosa.load(clean_file_path, sr=16000, mono=True)
                    y_boosted = NoiseSuppressionService.apply_voice_boost(y_clean, sr)
                    sf.write(clean_file_path, y_boosted, sr)
                except Exception as vb_err:
                    print(f"Failed to apply voice boost to noisereduce output: {vb_err}")
        else:
            # Use ONNX model for full file processing.
            # Reset states so each upload gets a clean LSTM/GRU context.
            onnx_service.reset_states(model)
            import librosa, soundfile as sf
            y_noisy, _ = librosa.load(noisy_file_path, sr=16000, mono=True)
            processed = onnx_service.process_chunk(y_noisy.astype(np.float32), model)
            
            if voice_boost:
                processed = NoiseSuppressionService.apply_voice_boost(processed, 16000)
                
            # Write processed audio to clean path
            sf.write(clean_file_path, processed, 16000)
            # For consistency, set a placeholder success dict
            suppression_result = {"success": True}

        import librosa
        try:
            y_noisy, _ = librosa.load(noisy_file_path, sr=16000, mono=True)
            y_clean, _ = librosa.load(clean_file_path, sr=16000, mono=True)
            stoi_score = AudioQualityService.calculate_stoi_estimate(y_clean, y_noisy)
        except Exception as stoi_err:
            print(f"Failed to calculate STOI estimate: {stoi_err}")
            stoi_score = 0.85

        # 4. Classify noise type using our dedicated classifier (returns list + full breakdown)
        detected_noises, noise_breakdown = NoiseClassificationService.classify_noise_with_scores(noisy_file_path)
        dominant_noise = detected_noises[0] if detected_noises else "Other"

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
            f"Processed {file.filename}: Dominant noise was '{dominant_noise}' (Level: {quality_metrics['noise_level']}%)."
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
            "noise_type": dominant_noise,
            "voice_clarity": quality_metrics["voice_clarity"],
            "noise_score": quality_metrics["noise_level"],
            "speech_presence": quality_metrics["speech_presence"],
            "audio_quality": quality_metrics["audio_quality"],
            "clean_audio_url": clean_audio_url,
            "stoi_score": stoi_score,
            "noise_breakdown": noise_breakdown,
            "model_used": model
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
            "after": after_files,
            "configured": bool(os.getenv("CLOUDINARY_CLOUD_NAME"))
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch Cloudinary files: {str(e)}")

@router.websocket("/audio/stream")
async def audio_stream(websocket: WebSocket, suppress: bool = True, save: bool = False, model: str = "noisereduce", voice_boost: bool = False):
    await websocket.accept()
    print(f"WebSocket connection established for real-time audio stream. Suppression: {suppress}, Model: {model}, Voice Boost: {voice_boost}")

    # Reset ONNX stateful buffers at the start of every new stream session
    # so LSTM/GRU hidden states don't bleed across disconnects/reconnects.
    if model not in ("noisereduce",):
        onnx_service.reset_states(model)

    # Filter state for stateful voice boost
    vb_state = None
    if voice_boost:
        from scipy.signal import lfilter_zi, butter
        nyq = 0.5 * 16000
        b_hp, a_hp = butter(2, 80.0 / nyq, btype='high')
        b_bp, a_bp = butter(2, [1000.0 / nyq, 3500.0 / nyq], btype='band')
        vb_state = {
            "hp": lfilter_zi(b_hp, a_hp) * 0.0,
            "bp": lfilter_zi(b_bp, a_bp) * 0.0,
            "b_hp": b_hp, "a_hp": a_hp,
            "b_bp": b_bp, "a_bp": a_bp
        }

    # Update microphone status in session to streaming
    session.current_metrics["microphone_status"] = "streaming"
    
    # Buffers to calculate live metrics (3 seconds sliding window)
    rolling_buffer = []
    clean_rolling_buffer = []
    full_session_buffer = [] # Accumulate all audio to save at the end
    samples_count = 0
    
    # State to rate-limit alerts and notifications using list references for thread safety
    last_alert_time = [0.0]
    last_detected_noise = ["Other"]
    
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
                        if model == "noisereduce":
                            # Fast stationary noise reduction using noisereduce
                            cleaned_chunk = nr.reduce_noise(
                                y=audio_chunk,
                                sr=16000,
                                stationary=True,
                                prop_decrease=0.85
                            )
                        else:
                            # ONNX model inference
                            cleaned_chunk = onnx_service.process_chunk(audio_chunk.astype(np.float32), model)
                        
                        # Apply stateful voice boost if enabled
                        if voice_boost and vb_state is not None:
                            try:
                                from scipy.signal import lfilter
                                y_hp, vb_state["hp"] = lfilter(vb_state["b_hp"], vb_state["a_hp"], cleaned_chunk.astype(np.float32), zi=vb_state["hp"])
                                y_presence, vb_state["bp"] = lfilter(vb_state["b_bp"], vb_state["a_bp"], y_hp, zi=vb_state["bp"])
                                cleaned_chunk = y_hp + 0.6 * y_presence
                                peak = np.max(np.abs(cleaned_chunk))
                                if peak > 1e-5:
                                    cleaned_chunk = (cleaned_chunk / peak) * 0.89
                            except Exception as vb_err:
                                print(f"Error in real-time voice boost: {vb_err}")
                    else:
                        cleaned_chunk = audio_chunk
                    
                    # 1. Convert back to raw bytes and send cleaned audio immediately to frontend
                    cleaned_bytes = cleaned_chunk.astype(np.float32).tobytes()
                    await websocket.send_bytes(cleaned_bytes)
                    
                    # 2. Accumulate in the sliding buffer for stream analysis
                    rolling_buffer.append(audio_chunk)
                    clean_rolling_buffer.append(cleaned_chunk)
                    samples_count += len(audio_chunk)
                    
                    # 3. 3 seconds window at 16kHz = 48,000 samples
                    if samples_count >= 48000:
                        # Concatenate all accumulated chunks
                        full_signal = np.concatenate(rolling_buffer)
                        full_clean_signal = np.concatenate(clean_rolling_buffer)
                        
                        # Keep only the last 3 seconds
                        analysis_signal = full_signal[-48000:]
                        analysis_clean_signal = full_clean_signal[-48000:]
                        
                        # Run the analysis in a background thread to prevent blocking the event loop
                        import asyncio
                        
                        def perform_analysis(noisy_sig, clean_sig):
                            try:
                                detected_noises, noise_breakdown = NoiseClassificationService.classify_noise_with_scores(y=noisy_sig, sr=16000)
                                dominant_noise = detected_noises[0] if detected_noises else "Other"
                                quality_metrics = AudioQualityService.analyze_quality(y=noisy_sig, sr=16000)
                                
                                if suppress:
                                    stoi_score = AudioQualityService.calculate_stoi_estimate(clean_sig, noisy_sig)
                                else:
                                    stoi_score = 1.0
                                
                                # Update session metrics
                                session.update_metrics(
                                    noise_score=quality_metrics["noise_level"],
                                    voice_clarity=quality_metrics["voice_clarity"],
                                    audio_quality=quality_metrics["audio_quality"],
                                    stoi_score=stoi_score
                                )
                                
                                # Log alert if specific noise detected (prevent spamming: rate-limit to once per 10s)
                                current_time = time.time()
                                if dominant_noise != "Other" and (dominant_noise != last_detected_noise[0] or (current_time - last_alert_time[0]) > 10):
                                    session.add_alert(f"Live Mic: Detected '{dominant_noise}' background noise.")
                                    last_alert_time[0] = current_time
                                    last_detected_noise[0] = dominant_noise
                                
                                return {
                                    "noise_type": dominant_noise,
                                    "noise_breakdown": noise_breakdown,
                                    "noise_score": quality_metrics["noise_level"],
                                    "voice_clarity": quality_metrics["voice_clarity"],
                                    "audio_quality": quality_metrics["audio_quality"],
                                    "stoi_score": stoi_score
                                }
                            except Exception as analysis_err:
                                print(f"Error in background stream analysis: {str(analysis_err)}")
                                return None
                        
                        # Schedule in thread pool and send metrics back to frontend
                        async def run_analysis_and_push(noisy_sig, clean_sig):
                            analysis_res = await asyncio.to_thread(perform_analysis, noisy_sig, clean_sig)
                            if analysis_res and websocket.client_state.name == "CONNECTED":
                                # Push live metrics back to frontend as a JSON text frame
                                try:
                                    import json
                                    metrics_payload = json.dumps({
                                        "type": "metrics",
                                        "noise_score": analysis_res["noise_score"],
                                        "voice_clarity": analysis_res["voice_clarity"],
                                        "audio_quality": analysis_res["audio_quality"],
                                        "stoi_score": analysis_res["stoi_score"],
                                        "latency": session.current_metrics.get("latency", 0),
                                        "noise_type": analysis_res["noise_type"],
                                        "noise_breakdown": analysis_res["noise_breakdown"]
                                    })
                                    await websocket.send_text(metrics_payload)
                                except Exception as push_err:
                                    print(f"Failed to push metrics to frontend: {push_err}")
 
                        asyncio.create_task(run_analysis_and_push(analysis_signal, analysis_clean_signal))
                        
                        # Reset buffer to keep sliding window context
                        rolling_buffer = [analysis_signal]
                        clean_rolling_buffer = [analysis_clean_signal]
                        samples_count = len(analysis_signal)
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
        # Reset microphone status only — preserve last real metric values so the
        # dashboard continues to show the final session readings after disconnect.
        session.current_metrics["microphone_status"] = "connected"
        # Clear ONNX states so the next stream starts fresh.
        if model not in ("noisereduce",):
            onnx_service.reset_states(model)
        print("WebSocket stream finished: Microphone status reset. Last session metrics preserved.")

@router.delete("/audio/files")
def delete_audio(public_id: str):
    try:
        success = CloudinaryService.delete_audio(public_id)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to delete file from Cloudinary")
        return {"status": "success", "message": "File deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

