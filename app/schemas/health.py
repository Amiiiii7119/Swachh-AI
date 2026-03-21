from pydantic import BaseModel

class HealthCheck(BaseModel):
    status: str
    database: str
    model: str
    redis: str