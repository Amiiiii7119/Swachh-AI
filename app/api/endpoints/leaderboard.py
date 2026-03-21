from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.services.leaderboard_service import get_leaderboard
from app.pathway_pipeline.pipeline import get_state

router = APIRouter()


@router.get("/leaderboard")
async def leaderboard(db: AsyncSession = Depends(get_db)):
    # Return live Pathway rankings if available
    live = get_state("leaderboard")
    if live and live.get("wards") and len(live["wards"]) > 0:
        return live

    # Fallback to database
    top, bottom = await get_leaderboard(db)
    return {
        "top_wards": top,
        "bottom_wards": bottom,
    }