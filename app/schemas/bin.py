from pydantic import BaseModel, Field, field_validator
from datetime import datetime

class BinUpdate(BaseModel):
    bin_id: int
    fill_level: float = Field(ge=0, le=100)
    waste_type: str | None = None

    @field_validator('fill_level')
    def validate_fill_level(cls, v):
        if v < 0 or v > 100:
            raise ValueError('fill_level must be between 0 and 100')
        return v

class BinResponse(BaseModel):
    id: int
    ward_id: int
    fill_level: float
    waste_type: str | None
    allowed_waste_type: str
    latitude: float
    longitude: float
    last_updated: datetime

    class Config:
        from_attributes = True

class BinCreate(BaseModel):
    ward_id: int
    allowed_waste_type: str
    latitude: float
    longitude: float