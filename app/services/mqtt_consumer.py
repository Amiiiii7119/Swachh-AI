"""
app/services/mqtt_consumer.py
MQTT subscriber for real IoT bin sensors.
Subscribes to: delhi/+/bin/+/fill
Falls back to simulator if MQTT broker not configured.

Topic format: delhi/{ward_id}/bin/{bin_id}/fill
Payload JSON: {"fill_level": 75.3, "waste_type": "recyclable"}

To enable: set MQTT_BROKER_HOST env variable.
"""

import json
import logging
import threading
from typing import Callable

logger = logging.getLogger(__name__)

UpdateCallback = Callable[[str, str, float, str], None]

_mqtt_active = False


def start_mqtt(
    broker_host: str,
    broker_port: int,
    on_update: UpdateCallback,
    username: str | None = None,
    password: str | None = None,
) -> bool:
    """
    Start MQTT subscriber in background thread.
    Returns True if started, False if paho-mqtt not installed.
    """
    global _mqtt_active

    try:
        import paho.mqtt.client as mqtt  # type: ignore[import]
    except ImportError:
        logger.warning(
            "paho-mqtt not installed — MQTT disabled. "
            "Run: pip install paho-mqtt  to enable real sensor data."
        )
        return False

    def on_connect(client: "mqtt.Client", userdata: None, flags: dict, rc: int) -> None:  # type: ignore[type-arg]
        if rc == 0:
            logger.info(f"MQTT connected to {broker_host}:{broker_port}")
            client.subscribe("delhi/+/bin/+/fill")
            global _mqtt_active
            _mqtt_active = True
        else:
            logger.error(f"MQTT connection failed with code {rc}")

    def on_message(client: "mqtt.Client", userdata: None, msg: "mqtt.MQTTMessage") -> None:  # type: ignore[type-arg]
        try:
            # Topic: delhi/{ward_id}/bin/{bin_id}/fill
            parts     = msg.topic.split("/")
            ward_id   = parts[1] if len(parts) > 1 else "ward-001"
            bin_id    = parts[3] if len(parts) > 3 else "BIN-001"
            payload   = json.loads(msg.payload.decode("utf-8"))
            fill      = float(payload.get("fill_level", 0))
            waste     = str(payload.get("waste_type", "general"))
            on_update(bin_id, ward_id, fill, waste)
        except Exception as e:
            logger.error(f"MQTT message parse error: {e}")

    def on_disconnect(client: "mqtt.Client", userdata: None, rc: int) -> None:  # type: ignore[type-arg]
        global _mqtt_active
        _mqtt_active = False
        logger.warning(f"MQTT disconnected (rc={rc}). Simulator continues.")

    def run() -> None:
        client = mqtt.Client()  # type: ignore[attr-defined]
        client.on_connect    = on_connect
        client.on_message    = on_message
        client.on_disconnect = on_disconnect

        if username and password:
            client.username_pw_set(username, password)

        try:
            client.connect(broker_host, broker_port, keepalive=60)
            client.loop_forever()
        except Exception as e:
            logger.error(f"MQTT connection error: {e}. Simulator continues.")

    thread = threading.Thread(target=run, name="mqtt-consumer", daemon=True)
    thread.start()
    return True


def is_mqtt_active() -> bool:
    return _mqtt_active