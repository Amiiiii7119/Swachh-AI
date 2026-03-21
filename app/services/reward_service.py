from sqlalchemy import select, func
from app.db.session import AsyncSessionLocal
from app.models.bin import Bin
from app.models.ward import Ward
from app.models.bin_event import BinEvent
import logging

logger = logging.getLogger(__name__)


async def process_bin_update_for_rewards_safe(bin_id: int, reported_waste_type: str | None):
    if not reported_waste_type:
        return

    async with AsyncSessionLocal() as db:
        try:
            bin_obj = await db.get(Bin, bin_id)
            if not bin_obj:
                logger.warning(f"Bin {bin_id} not found")
                return

            ward = await db.get(Ward, bin_obj.ward_id)
            if not ward:
                logger.warning(f"Ward {bin_obj.ward_id} not found")
                return

            points_change = 10 if reported_waste_type == bin_obj.allowed_waste_type else -5
            ward.points = max(0, ward.points + points_change)

            # ✅ FIXED (NO subquery())
            subq = select(Bin.id).where(Bin.ward_id == ward.id)

            total_events_result = await db.execute(
                select(func.count())
                .select_from(BinEvent)
                .where(BinEvent.bin_id.in_(subq))
            )
            total = total_events_result.scalar() or 1

            correct_events_result = await db.execute(
                select(func.count())
                .select_from(BinEvent)
                .join(Bin, Bin.id == BinEvent.bin_id)
                .where(
                    Bin.ward_id == ward.id,
                    BinEvent.waste_type == Bin.allowed_waste_type
                )
            )
            correct = correct_events_result.scalar() or 0

            ward.segregation_score = min(100, (correct / total) * 100)

            await db.commit()

            logger.info(
                f"Reward processed | bin={bin_id} | change={points_change} | score={ward.segregation_score:.2f}"
            )

        except Exception:
            logger.exception(f"Error processing rewards for bin {bin_id}")
            await db.rollback()