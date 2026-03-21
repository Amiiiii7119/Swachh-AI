from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.pathway_pipeline.pipeline import get_state

router = APIRouter()


@router.get("/impact/{ward_id}")
async def environmental_impact(ward_id: str, db: AsyncSession = Depends(get_db)):
    """
    Returns live eco impact data from Pathway pipeline.
    ward_id can be 'ward-001' through 'ward-005' or any string.
    Falls back to zeros if pipeline not ready.
    """
    live = get_state("impact")
    if live and float(live.get("co2_saved_kg", 0)) > 0:
        return {"ward_id": ward_id, **live}

    return {
        "ward_id":            ward_id,
        "co2_saved_kg":       0.0,
        "landfill_reduced_kg": 0.0,
        "trees_equivalent":   0.0,
        "water_saved_liters": 0.0,
        "energy_saved_kwh":   0.0,
        "recycling_rate_pct": 0.0,
        "biodeg_rate_pct":    0.0,
        "updated_at":         None,
    }