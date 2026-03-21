"""
app/services/websocket_manager.py
Manages WebSocket connections and broadcasts real-time updates.
Replaces polling — clients connect once and receive live data.
"""

import asyncio
import json
import logging
from typing import Any
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketManager:
    def __init__(self):
        self._connections: list[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._connections.append(ws)
        logger.info(f"WebSocket client connected. Total: {len(self._connections)}")

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            if ws in self._connections:
                self._connections.remove(ws)
        logger.info(f"WebSocket client disconnected. Total: {len(self._connections)}")

    async def broadcast(self, event: str, data: Any) -> None:
        """Send event+data to all connected clients."""
        if not self._connections:
            return
        message = json.dumps({"event": event, "data": data})
        dead = []
        async with self._lock:
            clients = list(self._connections)
        for ws in clients:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        # Clean up dead connections
        if dead:
            async with self._lock:
                for ws in dead:
                    if ws in self._connections:
                        self._connections.remove(ws)

    @property
    def client_count(self) -> int:
        return len(self._connections)


# Global singleton
ws_manager = WebSocketManager()
