import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.ward import Ward
from app.models.bin import Bin

logger = logging.getLogger(__name__)

DELHI_WARDS = [
    {"name": "Karol Bagh", "lat": 28.6520, "lng": 77.1903},
    {"name": "Dwarka", "lat": 28.5921, "lng": 77.0461},
    {"name": "Saket", "lat": 28.5245, "lng": 77.2051},
    {"name": "Rohini", "lat": 28.7347, "lng": 77.1155},
    {"name": "Connaught Place", "lat": 28.6304, "lng": 77.2177}
]

async def seed_initial_data(db: AsyncSession):
    # Check if wards already exist
    result = await db.execute(select(Ward))
    existing = result.scalars().all()
    if existing:
        logger.info("Wards already exist, skipping seeding.")
        return

    logger.info("Seeding initial wards and bins...")
    for w in DELHI_WARDS:
        ward = Ward(
            name=w["name"],
            points=0,
            segregation_score=0,
            collection_efficiency=0,
            optimization_score=0,
            participation_score=0
        )
        db.add(ward)
        await db.flush()  # to get ward.id

        # Create 3 bins per ward with different allowed waste types
        for allowed in ["biodegradable", "recyclable", "hazardous"]:
            # Slightly vary coordinates
            lat_offset = (hash(allowed) % 100) / 10000.0
            lng_offset = (hash(allowed + w["name"]) % 100) / 10000.0
            bin = Bin(
                ward_id=ward.id,
                allowed_waste_type=allowed,
                latitude=w["lat"] + lat_offset,
                longitude=w["lng"] + lng_offset,
                fill_level=0.0,
                waste_type=None
            )
            db.add(bin)

    await db.commit()
    logger.info("Seeding completed.")