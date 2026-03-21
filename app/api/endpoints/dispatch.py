from fastapi import APIRouter
from app.pathway_pipeline.pipeline import (
    get_state,
    manual_dispatch,
    set_dispatch_mode,
    get_dispatch_mode,
)

router = APIRouter()


@router.get("/dispatch")
def get_dispatch():
    """Returns active/completed dispatches and current mode."""
    return get_state("dispatch")


@router.post("/dispatch/manual/{bin_id}")
def dispatch_manual(bin_id: str):
    """
    Manually dispatch a collection vehicle to a specific bin.
    Works regardless of current dispatch mode.
    """
    event = manual_dispatch(bin_id)
    if event is None:
        return {
            "success": False,
            "message": f"Bin {bin_id} is already being serviced or not found.",
        }
    return {
        "success":    True,
        "message":    f"Vehicle {event['vehicle_id']} dispatched to {bin_id}",
        "dispatch":   event,
    }


@router.post("/dispatch/mode/{mode}")
def set_mode(mode: str):
    """
    Set dispatch mode.
    mode = 'manual' — no auto dispatch, only manual triggers
    mode = 'auto'   — auto dispatch when bin >= 95%, max 5 vehicles
    """
    if mode not in ("manual", "auto"):
        return {"success": False, "message": "Mode must be 'manual' or 'auto'"}

    set_dispatch_mode(mode)
    return {
        "success": True,
        "mode":    mode,
        "message": f"Dispatch mode set to {mode}",
    }


@router.get("/dispatch/mode")
def get_mode():
    return {"mode": get_dispatch_mode()}