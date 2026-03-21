"""
app/services/digital_twin.py
Digital twin simulation — modifies pipeline fill rates dynamically.
Modes: normal | festival | rain | strike | crisis
"""

import threading
import logging

logger = logging.getLogger(__name__)

_lock = threading.Lock()

MODES = {
    "normal":   { "fill_multiplier": 1.0,  "collection_delay": 0,   "label": "Normal Operations"       },
    "festival": { "fill_multiplier": 1.8,  "collection_delay": 0,   "label": "Festival (Diwali/Holi)"  },
    "rain":     { "fill_multiplier": 1.3,  "collection_delay": 0.3, "label": "Monsoon Rain"             },
    "strike":   { "fill_multiplier": 1.0,  "collection_delay": 0.7, "label": "Driver Strike"            },
    "crisis":   { "fill_multiplier": 2.5,  "collection_delay": 0.5, "label": "City Crisis"              },
    "weekend":  { "fill_multiplier": 1.4,  "collection_delay": 0,   "label": "Weekend Surge"            },
}

_state = {
    "mode":                "normal",
    "fill_multiplier":     1.0,
    "collection_delay":    0.0,
    "label":               "Normal Operations",
    "active_since":        None,
    "events":              [],      # list of active event descriptions
}


def set_mode(mode: str) -> dict:
    """Switch simulation mode. Returns new state."""
    import time
    if mode not in MODES:
        raise ValueError(f"Unknown mode '{mode}'. Valid: {list(MODES.keys())}")

    cfg = MODES[mode]
    with _lock:
        _state["mode"]             = mode
        _state["fill_multiplier"]  = cfg["fill_multiplier"]
        _state["collection_delay"] = cfg["collection_delay"]
        _state["label"]            = cfg["label"]
        _state["active_since"]     = time.time()
        _state["events"]           = _build_events(mode)

    logger.info(f"Digital twin mode changed to: {mode} ({cfg['label']})")
    return get_state()


def get_state() -> dict:
    with _lock:
        return dict(_state)


def get_fill_multiplier() -> float:
    with _lock:
        return _state["fill_multiplier"]


def get_collection_delay() -> float:
    """Returns fraction 0–1 of collection operations blocked (0=none, 1=all)."""
    with _lock:
        return _state["collection_delay"]


def _build_events(mode: str) -> list[str]:
    events = {
        "normal":   [],
        "festival": ["Diwali waste surge active (+80% fill rate)", "All collection vehicles on high alert"],
        "rain":     ["Monsoon flooding detected (+30% fill rate)", "30% of routes delayed"],
        "strike":   ["Driver strike — 70% fleet grounded", "Emergency contractor vehicles deployed"],
        "crisis":   ["Multi-event crisis (+150% fill rate)", "Emergency protocol active", "50% fleet delay"],
        "weekend":  ["Weekend residential surge (+40%)", "Market areas filling faster"],
    }
    return events.get(mode, [])


def list_modes() -> list[dict]:
    return [
        {
            "mode":             k,
            "label":            v["label"],
            "fill_multiplier":  v["fill_multiplier"],
            "collection_delay": v["collection_delay"],
        }
        for k, v in MODES.items()
    ]
