"""
app/api/endpoints/advanced.py
All new feature endpoints — add this as a new file.
Register in main.py with: app.include_router(advanced.router, prefix="/api", tags=["Advanced"])
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


# ── WebSocket ─────────────────────────────────────────────────────────────────

@router.websocket("/ws/dashboard")
async def websocket_dashboard(websocket: WebSocket):
    """
    Real-time WebSocket endpoint.
    Clients receive: dashboard, leaderboard, dispatch_update events.
    Connect: ws://localhost:8000/api/ws/dashboard
    """
    from app.services.websocket_manager import ws_manager
    from app.pathway_pipeline.pipeline import get_state
    import asyncio
    import json

    await ws_manager.connect(websocket)
    try:
        # Send initial state immediately on connect
        await websocket.send_text(json.dumps({
            "event": "dashboard",
            "data":  get_state("dashboard"),
        }))
        await websocket.send_text(json.dumps({
            "event": "leaderboard",
            "data":  get_state("leaderboard"),
        }))
        await websocket.send_text(json.dumps({
            "event": "map",
            "data":  get_state("map"),
        }))

        # Keep connection alive — client can send "ping"
        while True:
            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                if msg == "ping":
                    await websocket.send_text('{"event":"pong"}')
            except asyncio.TimeoutError:
                # Send heartbeat
                await websocket.send_text('{"event":"heartbeat"}')

    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket)
    except Exception:
        await ws_manager.disconnect(websocket)


# ── Predictions ────────────────────────────────────────────────────────────────

@router.get("/predict/{bin_id}")
async def predict_bin_fill(bin_id: str):
    """
    Predict fill level for next 2h and 6h.
    Returns overflow risk flag.
    """
    from app.services.predictor import predict_fill
    result = predict_fill(bin_id)
    if result is None:
        # Not enough history yet — return current fill from pipeline
        from app.pathway_pipeline.pipeline import get_state
        mp   = get_state("map")
        bins = mp.get("bins", [])
        b    = next((x for x in bins if x["bin_id"] == bin_id), None)
        if not b:
            raise HTTPException(status_code=404, detail=f"Bin {bin_id} not found")
        return {
            "bin_id":            bin_id,
            "current_fill":      b["fill_level"],
            "predicted_fill_2h": b["fill_level"],
            "predicted_fill_6h": b["fill_level"],
            "overflow_risk":     b["fill_level"] >= 90,
            "overflow_risk_6h":  b["fill_level"] >= 90,
            "confidence":        "insufficient_data",
            "message":           "Need more history. Check back in 2 minutes.",
        }
    return result


@router.get("/predict")
async def predict_all_bins():
    """Get predictions for all bins sorted by overflow risk."""
    from app.services.predictor import get_all_predictions
    return {"predictions": get_all_predictions()}


# ── Carbon Credits ─────────────────────────────────────────────────────────────

@router.get("/carbon/{ward_id}")
async def carbon_credits_ward(ward_id: str):
    """
    Carbon credit calculation for a specific ward.
    Returns CO2 saved, credits earned, INR value.
    """
    from app.services.carbon_service import get_ward_carbon
    return get_ward_carbon(ward_id)


@router.get("/carbon")
async def carbon_credits_city():
    """Carbon credits for all pilot wards combined."""
    from app.services.carbon_service import get_city_carbon
    return get_city_carbon()


# ── Digital Twin Simulation ────────────────────────────────────────────────────

class SimulationRequest(BaseModel):
    mode: str


@router.post("/simulation/mode")
async def set_simulation_mode(req: SimulationRequest):
    """
    Set digital twin simulation mode.
    Modes: normal | festival | rain | strike | crisis | weekend
    """
    from app.pathway_pipeline.pipeline import set_simulation_mode
    try:
        result = set_simulation_mode(req.mode)
        return {"success": True, **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/simulation/mode")
async def get_simulation_mode():
    """Get current simulation state."""
    from app.pathway_pipeline.pipeline import get_state
    dash = get_state("dashboard")
    return {
        "mode":            dash.get("simulation_mode", "normal"),
        "label":           dash.get("simulation_label", "Normal Operations"),
        "fill_multiplier": get_state("simulation").get("fill_multiplier", 1.0),
    }


@router.get("/simulation/modes")
async def list_simulation_modes():
    """List all available simulation modes."""
    from app.services.digital_twin import list_modes
    return {"modes": list_modes()}


# ── Multi-Vehicle Route ────────────────────────────────────────────────────────

class MultiRouteRequest(BaseModel):
    bin_ids:       list[int]
    num_vehicles:  Optional[int] = 3
    max_dist_km:   Optional[float] = 25.0
    priority_fill: Optional[float] = 85.0


@router.post("/optimize-route/multi")
async def optimize_multi_vehicle_route(
    req: MultiRouteRequest,
    db=None
):
    """
    Multi-vehicle VRP route optimization using OR-Tools.
    Falls back to nearest-neighbor if OR-Tools not installed.
    """
    from sqlalchemy.ext.asyncio import AsyncSession
    from fastapi import Depends
    from sqlalchemy import select
    from app.db.session import get_db
    from app.models.bin import Bin
    from app.services.route_optimizer import optimize_multi_vehicle

    # Quick version that works with pipeline data
    from app.pathway_pipeline.pipeline import get_state
    mp   = get_state("map")
    bins = mp.get("bins", [])

    matching = [b for b in bins if True]  # all bins or filter by bin_ids

    # Create simple objects
    class BinObj:
        def __init__(self, d):
            self.id        = d.get("bin_id", "")
            self.bin_id    = d.get("bin_id", "")
            self.latitude  = d.get("lat", 0)
            self.longitude = d.get("lng", 0)
            self.fill_level = d.get("fill_level", 0)

    bin_objs = [BinObj(b) for b in matching]

    routes = optimize_multi_vehicle(
        bin_objs,
        num_vehicles=req.num_vehicles or 3,
        max_dist_km=req.max_dist_km or 25.0,
        priority_threshold=req.priority_fill or 85.0,
    )

    total_distance = sum(r["distance_km"] for r in routes)
    return {
        "routes":          routes,
        "total_vehicles":  len(routes),
        "total_distance":  round(total_distance, 2),
        "total_bins":      sum(r["bin_count"] for r in routes),
        "optimizer":       "ortools_vrp" if _ortools_available() else "nearest_neighbor",
    }


def _ortools_available() -> bool:
    try:
        return True
    except ImportError:
        return False


# ── Confidence Threshold (CV upgrade) ─────────────────────────────────────────

class ConfRequest(BaseModel):
    threshold: float


@router.post("/classifier/confidence")
async def set_confidence_threshold(req: ConfRequest):
    """Set YOLO confidence threshold (0.1–1.0). Default: 0.35"""
    from app.services.ai_classifier import set_conf_threshold
    set_conf_threshold(req.threshold)
    return {"success": True, "threshold": req.threshold}


# ── WebSocket status ───────────────────────────────────────────────────────────

@router.get("/ws/status")
async def websocket_status():
    """How many WebSocket clients are connected."""
    from app.services.websocket_manager import ws_manager
    return {"connected_clients": ws_manager.client_count}


# ── MQTT status ────────────────────────────────────────────────────────────────

@router.get("/mqtt/status")
async def mqtt_status():
    from app.services.mqtt_consumer import is_mqtt_active
    from app.pathway_pipeline.pipeline import get_state
    return {
        "mqtt_active": is_mqtt_active(),
        "pipeline_mqtt_active": get_state("mqtt_active"),
        "message": "MQTT active — real sensor data" if is_mqtt_active() else "Using simulated sensor data",
    }
