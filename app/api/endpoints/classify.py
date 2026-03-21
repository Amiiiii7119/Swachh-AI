from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from app.services.ai_classifier import classify_waste_image
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/classify-waste")
async def classify_waste(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    if file.size and file.size > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="Image too large (max 10MB)")
    try:
        contents = await file.read()
        result   = await classify_waste_image(contents)
        logger.info(
            f"Classified: {result.get('waste_type')} "
            f"— {result.get('object_count', 1)} item(s) detected"
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Classification failed")
        raise HTTPException(status_code=500, detail="Classification failed")


class ConfRequest(BaseModel):
    threshold: float


@router.post("/classifier/confidence")
async def set_confidence(req: ConfRequest):
    """Set YOLO confidence threshold (0.1 - 1.0). Default: 0.15"""
    from app.services.ai_classifier import set_conf_threshold
    set_conf_threshold(req.threshold)
    return {"success": True, "threshold": req.threshold}