import asyncio
import random
from app.db.session import AsyncSessionLocal
from app.models.bin import Bin
from app.models.bin_event import BinEvent
from sqlalchemy import select
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

async def simulate_bin_fill():
    while True:
        await asyncio.sleep(60)
        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(Bin))
                bins = result.scalars().all()
                for bin in bins:
                    increase = random.uniform(0, 5)
                    new_level = min(bin.fill_level + increase, 100)
                    bin.fill_level = new_level  # type: ignore
                    event = BinEvent(
                        bin_id=bin.id,
                        fill_level=new_level,
                        waste_type=bin.waste_type,
                        timestamp=datetime.now(timezone.utc)
                    )
                    db.add(event)
                await db.commit()
                logger.info("Bin simulation tick completed")
        except Exception as e:
            logger.exception("Error in bin simulation")