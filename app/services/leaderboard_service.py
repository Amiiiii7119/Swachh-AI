from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.ward import Ward
from app.schemas.ward import WardScore

async def compute_swachh_score(ward: Ward) -> float:
    """Swachh Score = 0.4*segregation + 0.25*collection + 0.15*optimization + 0.2*participation"""
    return (0.4 * float(ward.segregation_score) +
            0.25 * float(ward.collection_efficiency) +
            0.15 * float(ward.optimization_score) +
            0.2 * float(ward.participation_score))

async def get_leaderboard(db: AsyncSession) -> tuple[list[WardScore], list[WardScore]]:
    result = await db.execute(select(Ward))
    wards = result.scalars().all()
    scores = []
    for w in wards:
        swachh = await compute_swachh_score(w)
        scores.append(WardScore(
            id=int(w.id),
            name=str(w.name),
            segregation_score=float(w.segregation_score),
            collection_efficiency=float(w.collection_efficiency),
            optimization_score=float(w.optimization_score),
            participation_score=float(w.participation_score),
            swachh_score=swachh
        ))
    scores.sort(key=lambda x: x.swachh_score, reverse=True)
    top = scores[:5]
    bottom = scores[-5:] if len(scores) >= 5 else scores
    return top, bottom