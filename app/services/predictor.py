"""
app/services/predictor.py
Lightweight bin fill predictor — no heavy dependencies.
Uses double exponential smoothing (Holt's method) — fast, accurate for time series.
Stores last 100 readings per bin, predicts next 2h and 6h fill levels.
"""

import time
import threading
from collections import deque
from typing import Optional

# ── Per-bin history store ─────────────────────────────────────────────────────
# { bin_id: deque of (timestamp, fill_level) }
_history: dict[str, deque] = {}
_lock = threading.Lock()

MAX_HISTORY    = 100   # data points to keep per bin
FILL_RATE_SECS = 1.0   # pipeline tick rate (seconds between readings)


def record_fill(bin_id: str, fill_level: float) -> None:
    """Call this every time a bin fill level is updated in the pipeline."""
    with _lock:
        if bin_id not in _history:
            _history[bin_id] = deque(maxlen=MAX_HISTORY)
        _history[bin_id].append((time.time(), fill_level))


def _holt_forecast(values: list[float], steps: int, alpha: float = 0.4, beta: float = 0.2) -> float:
    """
    Holt's double exponential smoothing.
    alpha = level smoothing, beta = trend smoothing.
    Returns forecasted value `steps` ticks ahead.
    """
    if len(values) < 2:
        return values[-1] if values else 0.0

    level = values[0]
    trend = values[1] - values[0]

    for v in values[1:]:
        prev_level = level
        level = alpha * v + (1 - alpha) * (level + trend)
        trend = beta  * (level - prev_level) + (1 - beta) * trend

    forecast = level + steps * trend
    return max(0.0, min(100.0, forecast))


def predict_fill(bin_id: str, horizon_hours: float = 2.0) -> Optional[dict]:
    """
    Predict fill level for a bin at horizon_hours from now.
    Returns None if insufficient history.
    """
    with _lock:
        history = list(_history.get(bin_id, []))

    if len(history) < 5:
        return None

    fills      = [h[1] for h in history]
    timestamps = [h[0] for h in history]
    current    = fills[-1]

    # Estimate fill rate per second from recent history
    if len(history) >= 10:
        recent_fills = fills[-10:]
        recent_times = timestamps[-10:]
        time_span    = recent_times[-1] - recent_times[0]
        fill_span    = recent_fills[-1] - recent_fills[0]
        rate_per_sec = fill_span / max(time_span, 1.0)
    else:
        rate_per_sec = (fills[-1] - fills[0]) / max(timestamps[-1] - timestamps[0], 1.0)

    # Steps = horizon in seconds / tick rate
    horizon_secs = horizon_hours * 3600
    steps_2h     = int(2 * 3600 / max(FILL_RATE_SECS, 1))
    steps_6h     = int(6 * 3600 / max(FILL_RATE_SECS, 1))

    pred_2h = _holt_forecast(fills, steps_2h)
    pred_6h = _holt_forecast(fills, steps_6h)

    # Also compute simple linear projection as sanity check
    linear_2h = min(100.0, max(0.0, current + rate_per_sec * 2 * 3600))
    linear_6h = min(100.0, max(0.0, current + rate_per_sec * 6 * 3600))

    # Blend: 70% Holt + 30% linear
    final_2h = round(0.7 * pred_2h + 0.3 * linear_2h, 1)
    final_6h = round(0.7 * pred_6h + 0.3 * linear_6h, 1)

    # Time to overflow (fill reaching 90%)
    if rate_per_sec > 0 and current < 90:
        secs_to_overflow = (90 - current) / rate_per_sec
        hours_to_overflow = round(secs_to_overflow / 3600, 1)
    else:
        hours_to_overflow = None

    return {
        "bin_id":               bin_id,
        "current_fill":         round(current, 1),
        "predicted_fill_2h":    final_2h,
        "predicted_fill_6h":    final_6h,
        "overflow_risk":        final_2h >= 90,
        "overflow_risk_6h":     final_6h >= 90,
        "hours_to_overflow":    hours_to_overflow,
        "fill_rate_per_hour":   round(rate_per_sec * 3600, 2),
        "data_points_used":     len(history),
        "confidence":           "high" if len(history) >= 30 else "medium" if len(history) >= 10 else "low",
    }


def get_all_predictions() -> list[dict]:
    """Get predictions for all bins that have enough history."""
    with _lock:
        bin_ids = list(_history.keys())
    results = []
    for bid in bin_ids:
        p = predict_fill(bid)
        if p:
            results.append(p)
    return sorted(results, key=lambda x: x["predicted_fill_2h"], reverse=True)
