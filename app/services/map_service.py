import requests
import logging
from app.core.config import settings
from typing import List, Tuple, Optional

logger = logging.getLogger(__name__)

def get_route_geometry(coordinates: List[Tuple[float, float]]) -> Optional[dict]:
    """
    Use Mapbox Directions API to get route geometry (GeoJSON LineString).
    coordinates: list of (lng, lat) pairs (Mapbox uses lng,lat order)
    Returns GeoJSON or None if API fails/not configured.
    """
    if not settings.MAP_API_KEY:
        logger.warning("MAP_API_KEY not set, returning None for route geometry")
        return None

    if len(coordinates) < 2:
        return None

    coords_str = ";".join(f"{lng},{lat}" for lng, lat in coordinates)
    url = f"https://api.mapbox.com/directions/v5/mapbox/driving/{coords_str}"
    params = {
        "access_token": settings.MAP_API_KEY,
        "geometries": "geojson",
        "overview": "full"
    }

    try:
        resp = requests.get(url, params=params, timeout=5)
        resp.raise_for_status()
        data = resp.json()
        if data["routes"]:
            logger.info("Mapbox route fetched successfully")
            return data["routes"][0]["geometry"]
    except Exception as e:
        logger.exception("Mapbox API error")
    return None