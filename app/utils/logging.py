"""
app/utils/logging.py
Missing file that main.py imports from.
"""

import logging
import sys


def setup_logging(level: int = logging.INFO) -> None:
    """Configure root logger with clean formatting."""
    logging.basicConfig(
        level=level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )
    # Silence noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("pathway").setLevel(logging.WARNING)
