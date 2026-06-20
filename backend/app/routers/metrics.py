from fastapi import APIRouter
from app.models.schemas import MetricsResponse
from app.services import session

router = APIRouter(tags=["Metrics"])

@router.get("/metrics", response_model=MetricsResponse)
def get_metrics():
    # Return the dynamic metrics stored in memory
    return session.current_metrics

@router.post("/metrics/reset")
def reset_metrics():
    session.reset_session()
    return {"status": "success", "message": "Session metrics and alerts reset."}
