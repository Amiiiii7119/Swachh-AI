"""
app/services/route_optimizer.py
Multi-vehicle route optimizer.
Uses OR-Tools VRP when installed, falls back to nearest-neighbor greedy algorithm.
Install OR-Tools: pip install ortools
"""

import math
import logging
from typing import Any

logger = logging.getLogger(__name__)

DEPOT_LAT = 28.6200
DEPOT_LNG = 77.2000


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R    = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a    = (math.sin(dlat / 2) ** 2
            + math.cos(math.radians(lat1))
            * math.cos(math.radians(lat2))
            * math.sin(dlng / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))


def _bin_lat(b: Any) -> float:
    return float(getattr(b, "latitude", 0))


def _bin_lng(b: Any) -> float:
    return float(getattr(b, "longitude", 0))


def _bin_id(b: Any) -> int:
    return int(getattr(b, "id", 0))


def _bin_str_id(b: Any) -> str:
    return str(getattr(b, "bin_id", getattr(b, "id", "")))


def _bin_fill(b: Any) -> float:
    return float(getattr(b, "fill_level", 0))


# ── Nearest-Neighbor fallback ─────────────────────────────────────────────────

def _nearest_neighbor_routes(bins: list[Any], num_vehicles: int) -> list[dict]:
    if not bins:
        return []

    remaining   = list(bins)
    routes      = []
    per_vehicle = max(1, math.ceil(len(remaining) / num_vehicles))

    for v in range(num_vehicles):
        if not remaining:
            break

        route_bins: list[Any] = []
        cur_lat = DEPOT_LAT
        cur_lng = DEPOT_LNG

        for _ in range(per_vehicle):
            if not remaining:
                break
            nearest = min(
                remaining,
                key=lambda b: _haversine_km(cur_lat, cur_lng, _bin_lat(b), _bin_lng(b)),
            )
            remaining.remove(nearest)
            route_bins.append(nearest)
            cur_lat = _bin_lat(nearest)
            cur_lng = _bin_lng(nearest)

        dist = sum(
            _haversine_km(
                _bin_lat(route_bins[i]), _bin_lng(route_bins[i]),
                _bin_lat(route_bins[i + 1]), _bin_lng(route_bins[i + 1]),
            )
            for i in range(len(route_bins) - 1)
        ) if len(route_bins) > 1 else 0.0

        routes.append({
            "vehicle_id":  v + 1,
            "bins":        [_bin_id(b)     for b in route_bins],
            "bin_ids":     [_bin_str_id(b) for b in route_bins],
            "distance_km": round(dist, 2),
            "bin_count":   len(route_bins),
            "has_priority": any(_bin_fill(b) >= 85 for b in route_bins),
        })

    return routes


# ── OR-Tools VRP ──────────────────────────────────────────────────────────────

def _ortools_routes(
    bins: list[Any],
    num_vehicles: int,
    max_dist_km: float,
    priority_threshold: float,
) -> list[dict]:
    try:
        from ortools.constraint_solver import routing_enums_pb2  # type: ignore[import]
        from ortools.constraint_solver import pywrapcp            # type: ignore[import]
    except ImportError:
        logger.info("OR-Tools not installed — using nearest-neighbor. pip install ortools")
        return _nearest_neighbor_routes(bins, num_vehicles)

    locations = [(DEPOT_LAT, DEPOT_LNG)] + [(_bin_lat(b), _bin_lng(b)) for b in bins]
    n = len(locations)

    def dist_int(i: int, j: int) -> int:
        return int(
            _haversine_km(locations[i][0], locations[i][1], locations[j][0], locations[j][1]) * 1000
        )

    dist_matrix = [[dist_int(i, j) for j in range(n)] for i in range(n)]

    manager  = pywrapcp.RoutingIndexManager(n, num_vehicles, 0)
    routing  = pywrapcp.RoutingModel(manager)

    def distance_callback(from_idx: int, to_idx: int) -> int:
        return dist_matrix[manager.IndexToNode(from_idx)][manager.IndexToNode(to_idx)]

    cb_idx = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(cb_idx)

    max_dist_int = int(max_dist_km * 1000)
    routing.AddDimension(cb_idx, 0, max_dist_int, True, "Distance")
    routing.GetDimensionOrDie("Distance").SetGlobalSpanCostCoefficient(100)

    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC  # type: ignore[attr-defined]
    )
    params.time_limit.seconds = 5

    solution = routing.SolveWithParameters(params)
    if not solution:
        logger.warning("OR-Tools found no solution — falling back to nearest-neighbor")
        return _nearest_neighbor_routes(bins, num_vehicles)

    routes = []
    for v in range(num_vehicles):
        index      = routing.Start(v)
        bin_idxs   = []
        total_dist = 0

        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            if node != 0:
                bin_idxs.append(node - 1)
            prev  = index
            index = solution.Value(routing.NextVar(index))
            total_dist += routing.GetArcCostForVehicle(prev, index, v)

        if not bin_idxs:
            continue

        route_bins = [bins[i] for i in bin_idxs if i < len(bins)]
        routes.append({
            "vehicle_id":  v + 1,
            "bins":        [_bin_id(b)     for b in route_bins],
            "bin_ids":     [_bin_str_id(b) for b in route_bins],
            "distance_km": round(total_dist / 1000, 2),
            "bin_count":   len(route_bins),
            "has_priority": any(_bin_fill(b) >= priority_threshold for b in route_bins),
        })

    return routes if routes else _nearest_neighbor_routes(bins, num_vehicles)


# ── Public API ────────────────────────────────────────────────────────────────

def optimize_route(bins: list[Any], num_vehicles: int = 1, max_dist_km: float = 25.0) -> list[int]:
    """
    Legacy single-vehicle interface — returns ordered list of integer bin IDs.
    Used by existing /api/optimize-route endpoint.
    """
    routes = optimize_multi_vehicle(bins, num_vehicles=1, max_dist_km=max_dist_km)
    if routes and routes[0]["bins"]:
        return routes[0]["bins"]
    return [_bin_id(b) for b in bins]


def optimize_multi_vehicle(
    bins: list[Any],
    num_vehicles: int = 3,
    max_dist_km: float = 25.0,
    priority_threshold: float = 85.0,
) -> list[dict]:
    """
    Multi-vehicle VRP.
    Priority bins (fill >= priority_threshold) are sorted first.
    Uses OR-Tools if installed, otherwise nearest-neighbor.
    """
    if not bins:
        return []

    priority  = [b for b in bins if _bin_fill(b) >= priority_threshold]
    normal    = [b for b in bins if _bin_fill(b) <  priority_threshold]
    sorted_bins = priority + normal

    try:
        from ortools.constraint_solver import routing_enums_pb2  # type: ignore[import]  # noqa: F401
        return _ortools_routes(sorted_bins, num_vehicles, max_dist_km, priority_threshold)
    except ImportError:
        return _nearest_neighbor_routes(sorted_bins, num_vehicles)