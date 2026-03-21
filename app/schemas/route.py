from pydantic import BaseModel
from typing import List, Tuple, Optional

class RouteOptimizationRequest(BaseModel):
    bin_ids: List[int]   # IDs of bins to visit

class RouteWaypoint(BaseModel):
    lat: float
    lng: float
    bin_id: int
    fill_level: float

class RouteResponse(BaseModel):
    ordered_bin_ids: List[int]
    waypoints: List[RouteWaypoint]
    geometry: Optional[dict] = None   # GeoJSON from Mapbox
    fallback_used: bool = False