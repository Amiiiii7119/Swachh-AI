import threading
import time
import random
import asyncio
from datetime import datetime, timezone
from typing import Any

# ──────────────────────────────────────────────────────────────────────────────
# SHARED STATE
# ──────────────────────────────────────────────────────────────────────────────

_lock = threading.Lock()

_state: dict[str, Any] = {
    "dashboard":   {},
    "leaderboard": {"wards": []},
    "map":         {"bins": []},
    "impact":      {},
    "dispatch":    {
        "active":           [],
        "completed":        [],
        "total_dispatched": 0,
        "mode":             "manual",
    },
    "simulation":  {
        "mode":            "normal",
        "fill_multiplier": 1.0,
        "label":           "Normal Operations",
    },
    "mqtt_active": False,
}


def get_state(key: str) -> dict:
    with _lock:
        import copy
        return copy.deepcopy(_state.get(key, {}))


# ──────────────────────────────────────────────────────────────────────────────
# CONSTANTS
# ──────────────────────────────────────────────────────────────────────────────

KG_PER_FILL         = 0.5
CO2_FACTOR          = 0.253
LANDFILL_FACTOR     = 0.82
ENERGY_FACTOR       = 0.18
WATER_FACTOR        = 1.4
DISPATCH_THRESHOLD  = 90.0
MAX_AUTO_DISPATCHES = 5
VEHICLE_TRAVEL_SEC  = 45
COOLDOWN_SEC        = 120

WARD_NAMES = {
    "ward-001": "Karol Bagh",
    "ward-002": "Dwarka",
    "ward-003": "Saket",
    "ward-004": "Rohini",
    "ward-005": "Connaught Place",
}

WARD_META = [
    {"ward_id": "ward-001", "lat": 28.6519, "lng": 77.1905},
    {"ward_id": "ward-002", "lat": 28.5921, "lng": 77.0460},
    {"ward_id": "ward-003", "lat": 28.5245, "lng": 77.2066},
    {"ward_id": "ward-004", "lat": 28.7500, "lng": 77.1100},
    {"ward_id": "ward-005", "lat": 28.6315, "lng": 77.2167},
]

WASTE_TYPES = ["biodegradable", "recyclable", "hazardous", "general"]

BINS: list[dict] = []
for _w in WARD_META:
    for _i in range(5):
        BINS.append({
            "bin_id":  f"BIN-{_w['ward_id'][-3:]}-{_i+1:02d}",
            "ward_id": _w["ward_id"],
            "lat":     round(_w["lat"] + (random.random() - 0.5) * 0.03, 6),
            "lng":     round(_w["lng"] + (random.random() - 0.5) * 0.03, 6),
            "address": f"Sector {_i+1}, {WARD_NAMES[_w['ward_id']]}",
        })

BIN_META: dict[str, dict] = {b["bin_id"]: b for b in BINS}

# Live fill state
_fill:       dict[str, float] = {b["bin_id"]: float(random.randint(20, 60)) for b in BINS}
_waste_type: dict[str, str]   = {b["bin_id"]: random.choice(WASTE_TYPES) for b in BINS}
_cooldown:   dict[str, float] = {}

# Optional WebSocket event loop reference
_ws_loop: asyncio.AbstractEventLoop | None = None


# ──────────────────────────────────────────────────────────────────────────────
# STATS THREAD
# ──────────────────────────────────────────────────────────────────────────────

def _compute_stats() -> None:
    while True:
        time.sleep(1)
        try:
            now_iso = datetime.now(timezone.utc).isoformat()

            with _lock:
                fill_snap  = dict(_fill)
                waste_snap = dict(_waste_type)

            # Record fill history for predictor
            try:
                from app.services.predictor import record_fill
                for bid, fl in fill_snap.items():
                    record_fill(bid, fl)
            except ImportError:
                pass

            # Map
            map_bins = []
            for b in BINS:
                bid = b["bin_id"]
                fl  = fill_snap.get(bid, 0)
                wt  = waste_snap.get(bid, "general")
                fs  = "critical" if fl >= 75 else "medium" if fl >= 40 else "low"
                fc  = "#f43f5e"  if fl >= 75 else "#f59e0b" if fl >= 40 else "#10b981"
                map_bins.append({
                    "bin_id": bid, "ward_id": b["ward_id"],
                    "fill_level": round(fl, 1), "waste_type": wt,
                    "lat": b["lat"], "lng": b["lng"], "address": b["address"],
                    "fill_status": fs, "fill_color": fc,
                    "needs_dispatch": fl >= DISPATCH_THRESHOLD,
                    "updated_at": now_iso,
                })

            # Per-ward
            ward_stats: dict[str, dict] = {
                wm["ward_id"]: {
                    "ward_id": wm["ward_id"], "ward_name": WARD_NAMES[wm["ward_id"]],
                    "fills": [], "recycl": 0.0, "biodeg": 0.0,
                    "hazard": 0.0, "overflow": 0,
                }
                for wm in WARD_META
            }

            for b in BINS:
                bid = b["bin_id"]; wid = b["ward_id"]
                fl  = fill_snap.get(bid, 0); wt = waste_snap.get(bid, "general")
                ws  = ward_stats[wid]
                ws["fills"].append(fl)
                if wt == "recyclable":    ws["recycl"]  += fl
                elif wt == "biodegradable": ws["biodeg"] += fl
                elif wt == "hazardous":   ws["hazard"]  += fl
                if fl >= 75: ws["overflow"] += 1

            # Global
            all_fills     = list(fill_snap.values())
            total_fill    = sum(all_fills)
            total_bins    = len(all_fills)
            active_bins   = sum(1 for f in all_fills if f < 90)
            critical_bins = sum(1 for f in all_fills if f >= 75)

            recycl_fill = sum(fl for bid, fl in fill_snap.items() if waste_snap.get(bid) == "recyclable")
            biodeg_fill = sum(fl for bid, fl in fill_snap.items() if waste_snap.get(bid) == "biodegradable")
            hazard_fill = sum(fl for bid, fl in fill_snap.items() if waste_snap.get(bid) == "hazardous")

            total_waste_kg  = round(total_fill  * KG_PER_FILL, 1)
            recycl_waste_kg = round(recycl_fill * KG_PER_FILL, 1)
            biodeg_waste_kg = round(biodeg_fill * KG_PER_FILL, 1)
            hazard_waste_kg = round(hazard_fill * KG_PER_FILL, 1)
            co2_saved_kg    = round((recycl_fill + biodeg_fill) * KG_PER_FILL * CO2_FACTOR, 2)
            overflow_pct    = round((critical_bins / max(total_bins, 1)) * 100, 1)

            # Leaderboard
            leaderboard_list = []
            for wid, ws in ward_stats.items():
                fills = ws["fills"]; n = len(fills)
                avg   = sum(fills) / max(n, 1)
                rc    = sum(1 for b in BINS if b["ward_id"] == wid and waste_snap.get(b["bin_id"]) == "recyclable")
                bc    = sum(1 for b in BINS if b["ward_id"] == wid and waste_snap.get(b["bin_id"]) == "biodegradable")
                ov    = ws["overflow"]
                seg   = min(100.0, ((rc + bc) / max(n, 1)) * 160)
                eff   = max(0.0, 100.0 - avg * 0.6 - (ov / max(n, 1)) * 30)
                par   = min(100.0, max(0.0, 100.0 - abs(avg - 45) * 0.8))
                score = round(seg * 0.4 + eff * 0.4 + par * 0.2, 2)
                leaderboard_list.append({
                    "ward_id": wid, "ward_name": ws["ward_name"],
                    "bin_count": n, "avg_fill": round(avg, 2),
                    "total_waste_kg": round(sum(fills) * KG_PER_FILL, 1),
                    "segregation_score": round(seg, 1),
                    "efficiency_score": round(eff, 1),
                    "participation_score": round(par, 1),
                    "score": score, "updated_at": now_iso,
                })

            leaderboard_list.sort(key=lambda r: r["score"], reverse=True)
            for rank, w in enumerate(leaderboard_list, 1):
                w["rank"] = rank

            impact = {
                "co2_saved_kg":        co2_saved_kg,
                "landfill_reduced_kg": round(total_fill * KG_PER_FILL * LANDFILL_FACTOR, 2),
                "energy_saved_kwh":    round(recycl_fill * KG_PER_FILL * ENERGY_FACTOR, 2),
                "water_saved_liters":  round(recycl_fill * KG_PER_FILL * WATER_FACTOR, 2),
                "trees_equivalent":    round(co2_saved_kg / 21.77, 1),
                "recycling_rate_pct":  round((recycl_fill / max(total_fill, 0.001)) * 100, 1),
                "biodeg_rate_pct":     round((biodeg_fill / max(total_fill, 0.001)) * 100, 1),
                "updated_at":          now_iso,
            }

            with _lock:
                active_disp = len(_state["dispatch"]["active"])
                total_disp  = _state["dispatch"]["total_dispatched"]
                disp_mode   = _state["dispatch"]["mode"]
                sim_state   = dict(_state["simulation"])

            dashboard = {
                "total_bins": total_bins, "active_bins": active_bins,
                "critical_bins": critical_bins, "total_waste_kg": total_waste_kg,
                "recycl_waste_kg": recycl_waste_kg, "biodeg_waste_kg": biodeg_waste_kg,
                "hazard_waste_kg": hazard_waste_kg, "co2_saved_kg": co2_saved_kg,
                "overflow_pct": overflow_pct, "active_dispatches": active_disp,
                "total_dispatched": total_disp, "dispatch_mode": disp_mode,
                "simulation_mode": sim_state.get("mode", "normal"),
                "simulation_label": sim_state.get("label", "Normal"),
                "updated_at": now_iso,
            }

            with _lock:
                _state["map"]         = {"bins": map_bins, "count": len(map_bins), "critical_count": critical_bins, "updated_at": now_iso}
                _state["leaderboard"] = {"wards": leaderboard_list, "updated_at": now_iso}
                _state["impact"]      = impact
                _state["dashboard"]   = dashboard

            # Broadcast to WebSocket clients
            _ws_broadcast("dashboard", dashboard)
            _ws_broadcast("leaderboard", {"wards": leaderboard_list[:5]})

        except Exception:
            import traceback
            traceback.print_exc()


def _ws_broadcast(event: str, data: dict) -> None:
    """Fire-and-forget WebSocket broadcast from sync thread."""
    global _ws_loop
    if _ws_loop is None:
        return
    try:
        from app.services.websocket_manager import ws_manager
        if ws_manager.client_count == 0:
            return
        asyncio.run_coroutine_threadsafe(ws_manager.broadcast(event, data), _ws_loop)
    except Exception:
        pass


# ──────────────────────────────────────────────────────────────────────────────
# DISPATCH MANAGER
# ──────────────────────────────────────────────────────────────────────────────

class DispatchManager:
    def __init__(self):
        self._dispatched: set[str] = set()
        self._lock  = threading.Lock()
        self._total = 0
        self._mode  = "manual"

    def set_mode(self, mode: str):
        with self._lock: self._mode = mode
        with _lock: _state["dispatch"]["mode"] = mode

    def get_mode(self) -> str:
        with self._lock: return self._mode

    def active_count(self) -> int:
        with _lock: return len(_state["dispatch"]["active"])

    def dispatch_bin(self, bin_id: str, forced: bool = False) -> dict | None:
        # Check collection delay from digital twin
        try:
            from app.services.digital_twin import get_collection_delay
            delay = get_collection_delay()
            if not forced and random.random() < delay:
                return None  # vehicle blocked by simulation event
        except ImportError:
            pass

        with self._lock:
            if bin_id in self._dispatched:
                return None
            now = time.time()
            if not forced and bin_id in _cooldown and now < _cooldown[bin_id]:
                return None
            if not forced and self._mode == "auto" and self.active_count() >= MAX_AUTO_DISPATCHES:
                return None

            self._dispatched.add(bin_id)
            self._total += 1
            meta = BIN_META.get(bin_id, {})
            event = {
                "dispatch_id":      f"DSP-{self._total:04d}",
                "bin_id":           bin_id,
                "ward_id":          meta.get("ward_id", ""),
                "ward_name":        WARD_NAMES.get(meta.get("ward_id", ""), ""),
                "address":          meta.get("address", ""),
                "lat":              meta.get("lat", 0.0),
                "lng":              meta.get("lng", 0.0),
                "fill_at_dispatch": round(_fill.get(bin_id, 0), 1),
                "dispatched_at":    datetime.now(timezone.utc).isoformat(),
                "eta_seconds":      VEHICLE_TRAVEL_SEC,
                "status":           "en_route",
                "vehicle_id":       f"VAN-{random.randint(1, 10):02d}",
                "progress_pct":     0.0,
                "elapsed_seconds":  0.0,
            }
            with _lock:
                _state["dispatch"]["active"].append(event)
                _state["dispatch"]["total_dispatched"] = self._total

            _ws_broadcast("dispatch_update", {"type": "dispatched", "bin_id": bin_id, "vehicle": event["vehicle_id"]})
            return event

    def run(self):
        while True:
            time.sleep(1)
            now = time.time()
            with self._lock:
                still_active = []
                completed    = []
                with _lock:
                    current = list(_state["dispatch"]["active"])
                for event in current:
                    try:
                        ts = datetime.fromisoformat(event["dispatched_at"].replace("Z", "+00:00")).timestamp()
                    except Exception:
                        still_active.append(event)
                        continue
                    elapsed  = now - ts
                    progress = min((elapsed / VEHICLE_TRAVEL_SEC) * 100, 100.0)
                    event["elapsed_seconds"] = round(elapsed, 1)
                    event["progress_pct"]    = round(progress, 1)
                    if elapsed >= VEHICLE_TRAVEL_SEC:
                        bid = event["bin_id"]
                        new_fill = float(random.randint(5, 15))
                        _fill[bid] = new_fill
                        _cooldown[bid] = now + COOLDOWN_SEC
                        self._dispatched.discard(bid)
                        event["status"] = "collected"
                        event["collected_at"] = datetime.now(timezone.utc).isoformat()
                        event["fill_after"]   = new_fill
                        completed.append(event)
                        _ws_broadcast("dispatch_update", {"type": "collected", "bin_id": bid, "new_fill": new_fill})
                    else:
                        still_active.append(event)
                with _lock:
                    _state["dispatch"]["active"] = still_active
                    if completed:
                        _state["dispatch"]["completed"].extend(completed)
                        _state["dispatch"]["completed"] = _state["dispatch"]["completed"][-100:]


# ──────────────────────────────────────────────────────────────────────────────
# SENSOR LOOP
# ──────────────────────────────────────────────────────────────────────────────

def _sensor_loop(dispatch_mgr: DispatchManager, tick: float = 1.0) -> None:
    while True:
        # Get fill multiplier from digital twin
        fill_mult = 1.0
        try:
            from app.services.digital_twin import get_fill_multiplier
            fill_mult = get_fill_multiplier()
        except ImportError:
            pass

        for bin_meta in random.sample(BINS, k=random.randint(4, 8)):
            bid = bin_meta["bin_id"]
            now = time.time()
            in_cooldown = bid in _cooldown and now < _cooldown[bid]

            if in_cooldown:
                _fill[bid] += random.gauss(0.05, 0.2)
                _fill[bid]  = max(0.0, min(30.0, _fill[bid]))
            else:
                drift = random.gauss(0.5, 1.5) * fill_mult
                _fill[bid] += drift
                _fill[bid]  = max(0.0, min(100.0, _fill[bid]))

            if (not in_cooldown and dispatch_mgr.get_mode() == "auto"
                    and _fill[bid] >= DISPATCH_THRESHOLD
                    and bid not in dispatch_mgr._dispatched
                    and dispatch_mgr.active_count() < MAX_AUTO_DISPATCHES):
                dispatch_mgr.dispatch_bin(bid)

            if random.random() < 0.02:
                _waste_type[bid] = random.choice(WASTE_TYPES)

        time.sleep(tick)


def apply_mqtt_update(bin_id: str, ward_id: str, fill_level: float, waste_type: str) -> None:
    """
    Called by MQTT consumer when real sensor data arrives.
    Overrides simulated fill for this bin.
    """
    _fill[bin_id]       = max(0.0, min(100.0, fill_level))
    _waste_type[bin_id] = waste_type
    with _lock:
        _state["mqtt_active"] = True


# ──────────────────────────────────────────────────────────────────────────────
# PUBLIC API
# ──────────────────────────────────────────────────────────────────────────────

_dispatch_mgr: DispatchManager | None = None


def manual_dispatch(bin_id: str) -> dict | None:
    if _dispatch_mgr is None: return None
    return _dispatch_mgr.dispatch_bin(bin_id, forced=True)


def set_dispatch_mode(mode: str) -> None:
    if _dispatch_mgr: _dispatch_mgr.set_mode(mode)


def get_dispatch_mode() -> str:
    if _dispatch_mgr is None: return "manual"
    return _dispatch_mgr.get_mode()


def set_simulation_mode(mode: str) -> dict:
    try:
        from app.services.digital_twin import set_mode, get_state as dt_state
        result = set_mode(mode)
        with _lock:
            _state["simulation"] = {
                "mode":            mode,
                "fill_multiplier": result["fill_multiplier"],
                "label":           result["label"],
            }
        return result
    except ImportError:
        return {"mode": mode, "error": "digital_twin module not found"}


def start(tick: float = 1.0, ws_loop: asyncio.AbstractEventLoop | None = None) -> None:
    global _dispatch_mgr, _ws_loop
    _ws_loop = ws_loop
    _dispatch_mgr = DispatchManager()

    threading.Thread(target=_dispatch_mgr.run,   name="dispatch-manager", daemon=True).start()
    threading.Thread(target=_sensor_loop, args=(_dispatch_mgr, tick), name="sensor-loop",  daemon=True).start()
    threading.Thread(target=_compute_stats, name="stats-thread", daemon=True).start()

    # Start MQTT if configured
    mqtt_broker = __import__("os").getenv("MQTT_BROKER_HOST", "")
    if mqtt_broker:
        try:
            from app.services.mqtt_consumer import start_mqtt
            mqtt_port = int(__import__("os").getenv("MQTT_BROKER_PORT", "1883"))
            start_mqtt(mqtt_broker, mqtt_port, apply_mqtt_update)
        except Exception as e:
            print(f"MQTT start failed: {e}. Using simulator.")
