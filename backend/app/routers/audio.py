import os
import shutil
from fastapi import APIRouter, File, UploadFile, HTTPException
from typing import List
from app.models.schemas import Alert, AudioUploadResponse
from app.services import session
from app.services.noise_suppression_service import NoiseSuppressionService
from app.services.noise_classification_service import NoiseClassificationService
from app.services.audio_quality_service import AudioQualityService

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
        # 1. Save uploaded file to noisy uploads folder
        noisy_file_path = os.path.join(UPLOAD_DIR_NOISY, file.filename)
        with open(noisy_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 2. Define path for clean audio
        clean_file_path = os.path.join(UPLOAD_DIR_CLEAN, file.filename)
        
        # 3. Apply noise suppression
        # (This runs the PyTorch Demucs model you wrote)
        suppression_result = suppression_service.process_audio(noisy_file_path, clean_file_path)
        if not suppression_result.get("success"):
            raise HTTPException(status_code=500, detail=f"Suppression model failed: {suppression_result.get('error')}")

        # 4. Classify noise type using our dedicated classifier
        noise_type = NoiseClassificationService.classify_noise(noisy_file_path)

        # 5. Analyze audio quality metrics using our quality service
        quality_metrics = AudioQualityService.analyze_quality(noisy_file_path)

        # 6. Update global session metrics
        session.update_metrics(
            noise_score=quality_metrics["noise_level"],
            voice_clarity=quality_metrics["voice_clarity"],
            audio_quality=quality_metrics["audio_quality"]
        )

        # 7. Log a new alert for this audio upload
        session.add_alert(
            f"Processed {file.filename}: Dominant noise was '{noise_type}' (Level: {quality_metrics['noise_level']}%)."
        )

        return {
            "message": f"Successfully processed file: {file.filename}",
            "status": "success",
            "noise_type": noise_type,
            "voice_clarity": quality_metrics["voice_clarity"],
            "noise_score": quality_metrics["noise_level"],
            "speech_presence": quality_metrics["speech_presence"],
            "audio_quality": quality_metrics["audio_quality"],
            "clean_audio_url": f"/static/clean/{file.filename}"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process audio: {str(e)}")
