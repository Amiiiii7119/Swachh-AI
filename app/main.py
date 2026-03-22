from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import logging
import asyncio

from app.core.config import settings
from app.core.exceptions import (
    global_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.exceptions import RequestValidationError

from app.api.endpoints import (
    classify,
    bins,
    route,
    rewards,
    leaderboard,
    impact,
    health,
    dispatch,
)
from app.api.endpoints import advanced
from app.services.bin_simulator import simulate_bin_fill
from app.services.seeder import seed_initial_data
from app.db.session import AsyncSessionLocal

try:
    from app.utils.logging import setup_logging
    setup_logging(getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))
except ImportError:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Swachh AI Backend",
    version="7.0.0",
    description="AI-Driven Circular Waste Intelligence System — India Innovates 2026",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def http_exception_handler_wrapper(request: Request, exc: Exception):
    return await http_exception_handler(request, exc)  # type: ignore


async def validation_exception_handler_wrapper(request: Request, exc: Exception):
    return await validation_exception_handler(request, exc)  # type: ignore


app.add_exception_handler(Exception, global_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler_wrapper)
app.add_exception_handler(RequestValidationError, validation_exception_handler_wrapper)

# Routers
app.include_router(classify.router,    prefix="/api", tags=["Classification"])
app.include_router(bins.router,        prefix="/api", tags=["Bins"])
app.include_router(route.router,       prefix="/api", tags=["Route"])
app.include_router(rewards.router,     prefix="/api", tags=["Rewards"])
app.include_router(leaderboard.router, prefix="/api", tags=["Leaderboard"])
app.include_router(impact.router,      prefix="/api", tags=["Impact"])
app.include_router(health.router,      prefix="/api", tags=["Health"])
app.include_router(dispatch.router,    prefix="/api", tags=["Dispatch"])
app.include_router(advanced.router,    prefix="/api", tags=["Advanced"])

_pipeline_started = False


@app.on_event("startup")
async def startup_event():
    global _pipeline_started

    logger.info("=== Swachh AI v7.0 Starting ===")

    # ── Download YOLO models from HuggingFace if not present ─────────────────
    try:
        from app.utils.model_downloader import download_models
        download_models()
        logger.info("Models ready")
    except Exception as e:
        logger.error(f"Model download failed: {e}")

    # ── Database ──────────────────────────────────────────────────────────────
    try:
        from app.db.base import Base
        from app.db.session import engine
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables ensured")
    except Exception as e:
        logger.error(f"Database setup failed: {e}")

    # ── Seeder ────────────────────────────────────────────────────────────────
    try:
        async with AsyncSessionLocal() as db:
            await seed_initial_data(db)
        logger.info("Seeder OK")
    except Exception as e:
        logger.error(f"Seeder failed: {e}")

    # ── Pathway Pipeline ──────────────────────────────────────────────────────
    if not _pipeline_started:
        try:
            from app.pathway_pipeline.pipeline import start
            loop = asyncio.get_event_loop()
            start(ws_loop=loop)
            _pipeline_started = True
            logger.info("Pathway pipeline v7.0 started")
        except Exception as e:
            logger.error(f"Pipeline start failed: {e}")

    # ── Bin Simulator ─────────────────────────────────────────────────────────
    try:
        asyncio.create_task(simulate_bin_fill())
        logger.info("Bin simulator started")
    except Exception as e:
        logger.error(f"Bin simulator failed: {e}")

    logger.info("=== Swachh AI Ready ===")


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down Swachh AI v7.0...")


@app.get("/api/pipeline-status")
async def pipeline_status():
    from app.pathway_pipeline.pipeline import get_state
    from app.services.websocket_manager import ws_manager
    dash = get_state("dashboard")
    lb   = get_state("leaderboard")
    mp   = get_state("map")
    imp  = get_state("impact")
    return {
        "pipeline_started":   _pipeline_started,
        "dashboard_has_data": bool(dash and dash.get("total_waste_kg", 0) > 0),
        "leaderboard_wards":  len(lb.get("wards", [])),
        "map_bins":           len(mp.get("bins", [])),
        "impact_has_data":    bool(imp and imp.get("co2_saved_kg", 0) > 0),
        "websocket_clients":  ws_manager.client_count,
        "simulation_mode":    dash.get("simulation_mode", "normal"),
        "dashboard_sample":   {
            k: dash.get(k)
            for k in ["total_waste_kg", "co2_saved_kg", "critical_bins"]
        },
        "version": "7.0.0",
    }