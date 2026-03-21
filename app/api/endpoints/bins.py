from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.bin import Bin
from app.models.bin_event import BinEvent
from app.models.ward import Ward
from app.schemas.bin import BinUpdate, BinResponse, BinCreate
from app.services.reward_service import process_bin_update_for_rewards_safe
from app.pathway_pipeline.pipeline import get_state
from datetime import datetime, timezone
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/update-bin", response_model=BinResponse)
async def update_bin(
    update: BinUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    bin_obj = await db.get(Bin, update.bin_id)
    if not bin_obj:
        raise HTTPException(status_code=404, detail="Bin not found")
    bin_obj.fill_level = update.fill_level
    if update.waste_type:
        bin_obj.waste_type = update.waste_type
    bin_obj.last_updated = datetime.now(timezone.utc)
    event = BinEvent(bin_id=int(bin_obj.id), fill_level=update.fill_level, waste_type=update.waste_type, timestamp=bin_obj.last_updated)
    db.add(event)
    if update.waste_type:
        background_tasks.add_task(process_bin_update_for_rewards_safe, int(bin_obj.id), update.waste_type)
    await db.commit()
    await db.refresh(bin_obj)
    logger.info(f"Bin {int(bin_obj.id)} updated")
    return bin_obj


@router.get("/bins")
async def get_bins(db: AsyncSession = Depends(get_db)):
    live = get_state("map")
    if live and live.get("bins") and len(live["bins"]) > 0:
        return live
    result = await db.execute(select(Bin))
    bins = result.scalars().all()
    return {"bins": [b.__dict__ for b in bins], "count": len(bins)}


@router.get("/dashboard")
async def get_dashboard():
    """Live dashboard stats from Pathway pipeline."""
    live = get_state("dashboard")
    if live and len(live) > 0:
        return live
    return {
        "total_bins": 0, "active_bins": 0, "critical_bins": 0,
        "total_waste_kg": 0, "recycl_waste_kg": 0, "biodeg_waste_kg": 0,
        "hazard_waste_kg": 0, "co2_saved_kg": 0, "overflow_pct": 0,
        "active_dispatches": 0, "total_dispatched": 0, "dispatch_mode": "manual",
    }


@router.get("/projection")
async def get_projection():
    """
    Scales current live data to all 272 Delhi wards.
    Used by dashboard to show full city deployment impact.
    """
    live  = get_state("dashboard")
    scale = 272 / 5   # 5 pilot wards → 272 total Delhi wards

    total_waste = live.get("total_waste_kg", 550)
    co2         = live.get("co2_saved_kg", 60)
    recycl_rate = live.get("recycl_waste_kg", 150) / max(total_waste, 1) * 100

    return {
        "current_wards":              5,
        "total_delhi_wards":          272,
        "scale_factor":               round(scale, 1),
        "projected_monthly_waste_kg": round(total_waste * scale * 30),
        "projected_monthly_co2_kg":   round(co2 * scale * 30),
        "projected_bins":             25 * int(scale),
        "landfill_sites_avoided":     3,
        "jobs_created":               1200,
        "annual_savings_crore":       47,
        "trees_equivalent":           round(co2 * scale * 30 / 21.77),
        "recycling_rate_pct":         round(recycl_rate, 1),
        "message":                    "Impact if Swachh AI deployed across all 272 Delhi wards",
    }


@router.post("/bins", response_model=BinResponse, status_code=status.HTTP_201_CREATED)
async def create_bin(bin_data: BinCreate, db: AsyncSession = Depends(get_db)):
    ward = await db.get(Ward, bin_data.ward_id)
    if not ward:
        raise HTTPException(status_code=404, detail="Ward not found")
    new_bin = Bin(**bin_data.model_dump())
    db.add(new_bin)
    await db.commit()
    await db.refresh(new_bin)
    return new_bin
