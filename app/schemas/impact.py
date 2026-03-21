from pydantic import BaseModel

class ImpactResponse(BaseModel):
    ward_id: int
    co2_saved_kg: float
    landfill_reduction_kg: float
    efficiency_percent: float