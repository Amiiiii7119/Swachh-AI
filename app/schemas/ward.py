from pydantic import BaseModel

class WardScore(BaseModel):
    id: int
    name: str
    segregation_score: float
    collection_efficiency: float
    optimization_score: float
    participation_score: float
    swachh_score: float

    class Config:
        from_attributes = True