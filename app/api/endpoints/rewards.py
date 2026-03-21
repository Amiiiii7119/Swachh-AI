from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.models.ward import Ward

router = APIRouter()

@router.get("/rewards/{ward_id}")
async def get_ward_rewards(ward_id: int, db: AsyncSession = Depends(get_db)):
    ward = await db.get(Ward, ward_id)
    if not ward:
        raise HTTPException(status_code=404, detail="Ward not found")
    return {
        "ward_id": ward.id,
        "points": ward.points,
        "segregation_score": ward.segregation_score
    }