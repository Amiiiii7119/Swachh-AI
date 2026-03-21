from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.session import get_db
from app.core.config import settings
from app.schemas.health import HealthCheck

router = APIRouter()


async def check_redis() -> bool:
    if not settings.REDIS_URL:
        return False
    try:
        from redis.asyncio import Redis
        r: Redis = Redis.from_url(settings.REDIS_URL)
        result = await r.ping()  # type: ignore
        await r.close()
        return bool(result)
    except Exception:
        return False


@router.get("/health", response_model=HealthCheck)
async def health_check(db: AsyncSession = Depends(get_db)):
    # Database
    db_status = "ok"
    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        db_status = "error"

    # Model
    model_status = "ok"
    try:
        from app.services.ai_classifier import _get_model1
        m = _get_model1()
        if m is None:
            model_status = "error"
    except Exception:
        model_status = "error"

    # Redis
    redis_status = "not configured"
    if settings.REDIS_URL:
        redis_ok = await check_redis()
        redis_status = "ok" if redis_ok else "error"

    return HealthCheck(
        status="ok",
        database=db_status,
        model=model_status,
        redis=redis_status,
    )


@router.get("/db-health")
async def db_health(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


@router.get("/model-health")
async def model_health():
    try:
        from app.services.ai_classifier import _get_model1, _get_model2
        m1 = _get_model1()
        m2 = _get_model2()
        return {
            "status":        "ok",
            "model1_loaded": m1 is not None,
            "model2_loaded": m2 is not None,
            "model1_path":   settings.YOLO_MODEL_PATH,
            "model2_path":   settings.YOLO_MODEL_PATH_2,
            "ensemble":      True,
        }
    except Exception as e:
        return {"status": "error", "detail": str(e)}


@router.get("/redis-health")
async def redis_health():
    if not settings.REDIS_URL:
        return {"status": "not configured"}
    redis_ok = await check_redis()
    return {"status": "ok" if redis_ok else "error"}