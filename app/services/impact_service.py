from app.models.ward import Ward
from app.models.bin import Bin
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

async def calculate_impact(db: AsyncSession, ward_id: int) -> dict:
    bins_query = await db.execute(select(Bin).where(Bin.ward_id == ward_id))
    bins = bins_query.scalars().all()

    if not bins:
        return {"co2_saved_kg": 0, "landfill_reduction_kg": 0, "efficiency_percent": 0}

    # Convert SQLAlchemy values to float
    total_waste_kg = sum(float(b.fill_level) * 1.0 for b in bins)
    collected_kg = total_waste_kg * 0.3
    co2_saved = collected_kg * 0.5
    landfill_reduction = collected_kg
    efficiency = (collected_kg / total_waste_kg * 100) if total_waste_kg > 0 else 0

    return {
        "co2_saved_kg": round(co2_saved, 2),
        "landfill_reduction_kg": round(landfill_reduction, 2),
        "efficiency_percent": round(efficiency, 2)
    }