from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.bin import Bin
from app.schemas.route import RouteOptimizationRequest, RouteResponse, RouteWaypoint
from app.services.route_optimizer import optimize_route
from app.services.map_service import get_route_geometry
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/optimize-route", response_model=RouteResponse)
async def optimize_route_endpoint(
    req: RouteOptimizationRequest,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Bin).where(Bin.id.in_(req.bin_ids)))
    bins = result.scalars().all()
    if len(bins) != len(req.bin_ids):
        raise HTTPException(status_code=404, detail="Some bins not found")

    # Convert to list (bins is already a list)
    ordered_ids = optimize_route(list(bins))

    bin_map = {b.id: b for b in bins}
    waypoints = []
    coords = []
    for bid in ordered_ids:
        b = bin_map[bid]
        # Convert SQLAlchemy attributes to Python types
        waypoints.append(RouteWaypoint(
            lat=float(b.latitude),
            lng=float(b.longitude),
            bin_id=int(b.id),
            fill_level=float(b.fill_level)
        ))
        coords.append((float(b.longitude), float(b.latitude)))

    geometry = get_route_geometry(coords)
    fallback_used = geometry is None and len(coords) >= 2

    logger.info(f"Route optimized for {len(bins)} bins, fallback={fallback_used}")

    return RouteResponse(
        ordered_bin_ids=ordered_ids,
        waypoints=waypoints,
        geometry=geometry,
        fallback_used=fallback_used
    )