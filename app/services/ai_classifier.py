import cv2
import numpy as np
from ultralytics import YOLO
from app.core.config import settings
import logging
import os
import base64
import json
import httpx

logger = logging.getLogger(__name__)

DEFAULT_CONF = settings.YOLO_CONF_THRESHOLD

_model1: YOLO | None = None
_model2: YOLO | None = None

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL   = "meta-llama/llama-4-scout-17b-16e-instruct"

# ── Category metadata ─────────────────────────────────────────────────────────
BIN_COLOR_HEX: dict[str, str] = {
    "Green":  "#10b981",
    "Blue":   "#3b82f6",
    "Red":    "#f43f5e",
    "Purple": "#8b5cf6",
    "Yellow": "#f59e0b",
    "Black":  "#6b7280",
}

CATEGORY_META: dict[str, dict] = {
    "biodegradable": {
        "display":    "Biodegradable",
        "bin_color":  "Green",
        "bin_code":   "GREEN BIN",
        "hazardous":  False,
        "recyclable": False,
        "disposal":   "Place in green organic/wet waste bin. Suitable for composting.",
        "fact":       "Composting organic waste reduces landfill methane by up to 50%.",
        "mcd_rule":   "MCD Rule: Wet/organic waste in green bin — SWM Rules 2016.",
        "action":     "GREEN BIN — before 8 AM MCD collection.",
    },
    "recyclable": {
        "display":    "Recyclable",
        "bin_color":  "Blue",
        "bin_code":   "BLUE BIN",
        "hazardous":  False,
        "recyclable": True,
        "disposal":   "Clean, dry, remove caps, place in blue recycling bin.",
        "fact":       "Recycling 1 tonne of plastic saves 5,774 kWh of energy.",
        "mcd_rule":   "MCD Rule: Clean dry recyclables in blue bin — SWM Rules 2016.",
        "action":     "Rinse → dry → BLUE BIN.",
    },
    "hazardous": {
        "display":    "Hazardous",
        "bin_color":  "Red",
        "bin_code":   "HAZARDOUS BIN",
        "hazardous":  True,
        "recyclable": False,
        "disposal":   "Take to MCD hazardous waste collection point. Never mix with regular bins.",
        "fact":       "One battery can contaminate 400 litres of groundwater.",
        "mcd_rule":   "MCD Rule: Hazardous Waste Management Rules 2016.",
        "action":     "⚠️ MCD hazardous waste collection point only.",
    },
    "e-waste": {
        "display":    "E-Waste",
        "bin_color":  "Purple",
        "bin_code":   "E-WASTE BIN",
        "hazardous":  True,
        "recyclable": False,
        "disposal":   "Take to certified e-waste centre. 26 MCD-authorised centres in Delhi.",
        "fact":       "E-waste contains gold and silver worth ₹4,000+ per device.",
        "mcd_rule":   "MCD Rule: E-Waste (Management) Rules 2016. Visit mcdonline.nic.in.",
        "action":     "⚡ Nearest e-waste centre — mcdonline.nic.in.",
    },
    "medical": {
        "display":    "Medical",
        "bin_color":  "Yellow",
        "bin_code":   "MEDICAL BIN",
        "hazardous":  True,
        "recyclable": False,
        "disposal":   "Seal in puncture-proof bag. Take to pharmacy or hospital waste point.",
        "fact":       "Improper medical waste causes 8M+ hepatitis B infections yearly.",
        "mcd_rule":   "MCD Rule: Biomedical Waste Management Rules 2016.",
        "action":     "🏥 Seal → nearest pharmacy or hospital waste point.",
    },
    "general": {
        "display":    "General Waste",
        "bin_color":  "Black",
        "bin_code":   "BLACK BIN",
        "hazardous":  False,
        "recyclable": False,
        "disposal":   "Place in black general waste bin as last resort.",
        "fact":       "Better segregation reduces general waste going to landfill by 60%.",
        "mcd_rule":   "MCD Rule: Inert/general waste in black bin — SWM Rules 2016.",
        "action":     "BLACK BIN — check if reusable first.",
    },
}

# ── YOLO loaders ──────────────────────────────────────────────────────────────

def _get_model1() -> YOLO | None:
    global _model1
    if _model1 is None:
        try:
            _model1 = YOLO(settings.YOLO_MODEL_PATH)
            logger.info(f"Model 1 loaded: {settings.YOLO_MODEL_PATH}")
        except Exception as e:
            logger.error(f"Model 1 failed: {e}")
    return _model1


def _get_model2() -> YOLO | None:
    global _model2
    if _model2 is None:
        path = settings.YOLO_MODEL_PATH_2
        if not os.path.exists(path):
            logger.warning(f"Model 2 not found: {path}")
            return None
        try:
            _model2 = YOLO(path)
            logger.info(f"Model 2 loaded: {path}")
        except Exception as e:
            logger.error(f"Model 2 failed: {e}")
    return _model2


# ── YOLO bounding boxes ───────────────────────────────────────────────────────

def _get_yolo_boxes(img: np.ndarray, conf: float) -> list[dict]:
    boxes: list[dict] = []
    for model, label in [(_get_model1(), "m1"), (_get_model2(), "m2")]:
        if model is None:
            continue
        try:
            results = model.predict(source=img, conf=conf, verbose=False, max_det=15)
            if not results or results[0].boxes is None:
                continue
            for i in range(len(results[0].boxes)):
                box      = results[0].boxes[i]
                cls_id   = int(box.cls[0].item())
                conf_val = float(box.conf[0].item())
                name     = model.names.get(cls_id, "unknown").lower()
                bbox     = [round(float(v), 1) for v in box.xyxy[0].tolist()]
                if bbox[2] - bbox[0] > 10 and bbox[3] - bbox[1] > 10:
                    boxes.append({
                        "bbox":       bbox,
                        "yolo_class": name,
                        "yolo_conf":  round(conf_val * 100, 1),
                        "source":     label,
                    })
        except Exception as e:
            logger.error(f"YOLO {label} error: {e}")
    return _dedup_boxes(boxes)


def _iou(b1: list, b2: list) -> float:
    xi1 = max(b1[0], b2[0]); yi1 = max(b1[1], b2[1])
    xi2 = min(b1[2], b2[2]); yi2 = min(b1[3], b2[3])
    inter = max(0.0, xi2 - xi1) * max(0.0, yi2 - yi1)
    a1 = (b1[2]-b1[0]) * (b1[3]-b1[1])
    a2 = (b2[2]-b2[0]) * (b2[3]-b2[1])
    return inter / max(a1 + a2 - inter, 1e-6)


def _dedup_boxes(boxes: list[dict], thresh: float = 0.45) -> list[dict]:
    boxes.sort(key=lambda b: b["yolo_conf"], reverse=True)
    kept: list[dict] = []
    for b in boxes:
        if not any(_iou(b["bbox"], k["bbox"]) > thresh for k in kept):
            kept.append(b)
    return kept


# ── Groq Llama 4 Vision classification ───────────────────────────────────────

GROQ_PROMPT = """You are an expert waste classifier for Municipal Corporation of Delhi (MCD), India.

Analyze this image carefully. Identify ALL visible waste items — every single object.

Return a JSON array. Each object must have exactly these fields:
- "item": exact name (e.g. "Glass Bottle", "Plastic Bag", "Fishing Net", "Rubber Shoe", "Aluminum Can", "Food Waste")
- "category": exactly one of: biodegradable | recyclable | hazardous | e-waste | medical | general
- "confidence": integer 0-100
- "bin": exactly one of: GREEN BIN | BLUE BIN | HAZARDOUS BIN | E-WASTE BIN | MEDICAL BIN | BLACK BIN
- "hazardous": true or false
- "recyclable": true or false
- "disposal": one specific sentence on how to dispose this item in Delhi
- "fact": one interesting environmental fact about this waste type
- "mcd_rule": the relevant MCD Delhi waste management rule

Bin assignment rules:
- Glass bottle → BLUE BIN (recyclable)
- Plastic bottle → BLUE BIN (recyclable)
- Plastic bag → BLACK BIN (general)
- Fishing net / rope → BLACK BIN (general)
- Shoe / clothing / textile → BLACK BIN (general)
- Organic waste / food → GREEN BIN (biodegradable)
- Battery / chemicals → HAZARDOUS BIN (hazardous)
- Electronics / phone / laptop → E-WASTE BIN (e-waste)
- Metal can / tin → BLUE BIN (recyclable)
- Cardboard / paper → BLUE BIN (recyclable)
- Wood / leaves → GREEN BIN (biodegradable)

Return ONLY a valid JSON array. No markdown. No backticks. No explanation."""


async def _classify_with_groq(image_bytes: bytes) -> list[dict]:
    """Call Groq Llama 4 Scout Vision to classify all waste items."""
    api_key = settings.GROQ_API_KEY or ""
    if not api_key:
        logger.warning("GROQ_API_KEY not set — skipping AI classification")
        return []

    b64 = base64.b64encode(image_bytes).decode("utf-8")

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.post(
                GROQ_API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type":  "application/json",
                },
                json={
                    "model":      GROQ_MODEL,
                    "max_tokens": 2000,
                    "messages": [{
                        "role":    "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
                            },
                            {
                                "type": "text",
                                "text": GROQ_PROMPT,
                            },
                        ],
                    }],
                },
            )

        if res.status_code != 200:
            logger.error(f"Groq error {res.status_code}: {res.text[:300]}")
            return []

        data    = res.json()
        content = data["choices"][0]["message"]["content"].strip()
        content = content.replace("```json", "").replace("```", "").strip()

        items = json.loads(content)
        if not isinstance(items, list):
            return []

        logger.info(f"Groq classified {len(items)} items")
        return items

    except json.JSONDecodeError as e:
        logger.error(f"Groq JSON parse error: {e}")
        return []
    except Exception as e:
        logger.error(f"Groq API error: {e}")
        return []


# ── Merge YOLO boxes + Groq classifications ───────────────────────────────────

def _merge_results(yolo_boxes: list[dict], groq_items: list[dict]) -> list[dict]:
    detections: list[dict] = []

    if groq_items:
        for i, box in enumerate(yolo_boxes):
            gem = groq_items[i] if i < len(groq_items) else None
            if gem:
                detections.append(_build_from_groq(gem, box["bbox"], box["yolo_conf"], box["source"]))
            else:
                detections.append(_build_from_yolo(box))

        # Extra Groq items with no YOLO box
        for gem in groq_items[len(yolo_boxes):]:
            detections.append(_build_from_groq(gem, [], float(gem.get("confidence", 80)), "groq"))
    else:
        for box in yolo_boxes:
            detections.append(_build_from_yolo(box))

    return detections


def _build_from_groq(item: dict, bbox: list, yolo_conf: float, source: str) -> dict:
    raw_cat = str(item.get("category", "general")).lower().strip()
    if raw_cat not in CATEGORY_META:
        raw_cat = "general"
    meta      = CATEGORY_META[raw_cat]
    conf      = float(item.get("confidence", yolo_conf))
    name      = str(item.get("item", "Unknown Item"))
    bin_color = meta["bin_color"]
    return {
        "class":                 name.lower().replace(" ", "_"),
        "category":              meta["display"],
        "raw_category":          raw_cat,
        "confidence":            round(conf, 1),
        "bbox":                  bbox,
        "display_name":          name,
        "bin_color":             bin_color,
        "bin_color_hex":         BIN_COLOR_HEX.get(bin_color, "#6b7280"),
        "bin_code":              str(item.get("bin", meta["bin_code"])),
        "disposal_instructions": str(item.get("disposal", meta["disposal"])),
        "fact":                  str(item.get("fact",     meta["fact"])),
        "mcd_rule":              str(item.get("mcd_rule", meta["mcd_rule"])),
        "hazardous":             bool(item.get("hazardous",  meta["hazardous"])),
        "recyclable":            bool(item.get("recyclable", meta["recyclable"])),
        "action":                meta["action"],
        "source":                f"groq+{source}",
    }


def _build_from_yolo(box: dict) -> dict:
    name    = box["yolo_class"]
    raw_cat = _yolo_to_category(name)
    meta    = CATEGORY_META.get(raw_cat, CATEGORY_META["general"])
    bin_color = meta["bin_color"]
    return {
        "class":                 name,
        "category":              meta["display"],
        "raw_category":          raw_cat,
        "confidence":            box["yolo_conf"],
        "bbox":                  box["bbox"],
        "display_name":          name.replace("_", " ").title(),
        "bin_color":             bin_color,
        "bin_color_hex":         BIN_COLOR_HEX.get(bin_color, "#6b7280"),
        "bin_code":              meta["bin_code"],
        "disposal_instructions": meta["disposal"],
        "fact":                  meta["fact"],
        "mcd_rule":              meta["mcd_rule"],
        "hazardous":             bool(meta["hazardous"]),
        "recyclable":            bool(meta["recyclable"]),
        "action":                meta["action"],
        "source":                box["source"],
    }


def _yolo_to_category(name: str) -> str:
    n = name.lower()
    if any(x in n for x in ["plastic bottle", "glass", "metal", "aluminum", "tin", "paper", "cardboard", "foil", "milk"]):
        return "recyclable"
    if any(x in n for x in ["plastic bag", "stretch", "zip", "disposable", "textile", "shoe", "furniture", "ceramic", "unknown"]):
        return "general"
    if any(x in n for x in ["organic", "food", "biological", "cellulose", "wood"]):
        return "biodegradable"
    if any(x in n for x in ["battery", "chemical", "aerosol", "liquid", "canister"]):
        return "hazardous"
    if any(x in n for x in ["electronic", "ewaste"]):
        return "e-waste"
    if "medical" in n:
        return "medical"
    if "plastic" in n:
        return "recyclable"
    return "general"


# ── Recommendation + summary ──────────────────────────────────────────────────

def _make_rec(det: dict, rank: int) -> dict:
    cat   = det["raw_category"]
    icons = {"biodegradable":"🌿","recyclable":"♻️","hazardous":"⚠️","e-waste":"⚡","medical":"🏥","general":"🗑️"}
    clrs  = {"biodegradable":"#10b981","recyclable":"#3b82f6","hazardous":"#f43f5e","e-waste":"#8b5cf6","medical":"#ec4899","general":"#6b7280"}
    pri   = "high" if det["hazardous"] else "medium" if det["recyclable"] else "low"
    title = f"⚠️ Item {rank+1}: {det['display_name']} — HAZARDOUS" if det["hazardous"] else f"Item {rank+1}: {det['display_name']}"
    return {
        "item_rank":     rank + 1,
        "class":         det["class"],
        "display_name":  det["display_name"],
        "category":      det["category"],
        "confidence":    det["confidence"],
        "priority":      pri,
        "icon":          icons.get(cat, "🗑️"),
        "color":         clrs.get(cat, "#6b7280"),
        "title":         title,
        "bin_code":      det["bin_code"],
        "bin_color":     det["bin_color"],
        "bin_color_hex": det["bin_color_hex"],
        "action":        det["action"],
        "disposal":      det["disposal_instructions"],
        "fact":          det["fact"],
        "mcd_rule":      det["mcd_rule"],
        "hazardous":     det["hazardous"],
        "recyclable":    det["recyclable"],
        "source":        det.get("source", "yolo"),
    }


def _make_summary(dets: list[dict]) -> dict:
    haz  = [d for d in dets if d["hazardous"]]
    rec  = [d for d in dets if d["recyclable"]]
    cats = list({d["raw_category"] for d in dets})
    bins = list({d["bin_code"] for d in dets})
    return {
        "total_items":      len(dets),
        "hazardous_count":  len(haz),
        "recyclable_count": len(rec),
        "categories_found": [CATEGORY_META.get(c, {}).get("display", c) for c in cats],
        "bins_needed":      bins,
        "co2_impact":       f"Recycling {len(rec)} item(s) could prevent ~{len(rec)*0.25:.1f} kg CO₂." if rec else "",
        "urgent_action":    f"URGENT: {', '.join(d['display_name'] for d in haz)} require special disposal." if haz else "",
        "segregation_tip":  (f"Segregate into {len(bins)} bin(s): " + ", ".join(bins)) if len(bins) > 1 else (f"All items → {bins[0]}." if bins else ""),
    }


# ── Public API ────────────────────────────────────────────────────────────────

async def classify_waste_image(image_bytes: bytes) -> dict:
    """
    Pipeline:
    1. YOLO draws bounding boxes
    2. Groq Llama 4 Vision correctly identifies every item
    3. Merged — boxes from YOLO, names/bins from Groq
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img   = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Invalid image — could not decode.")

    # Step 1 — YOLO boxes
    yolo_boxes = _get_yolo_boxes(img, DEFAULT_CONF)
    logger.info(f"YOLO: {len(yolo_boxes)} boxes")

    # Step 2 — Groq classification
    groq_items = await _classify_with_groq(image_bytes)

    # Step 3 — Merge
    detections = _merge_results(yolo_boxes, groq_items)

    # Fallback — Groq only if YOLO found nothing
    if not detections and groq_items:
        detections = [_build_from_groq(g, [], float(g.get("confidence", 80)), "groq") for g in groq_items]

    if not detections:
        return _empty_result()

    detections.sort(key=lambda d: d["confidence"], reverse=True)

    recs = [_make_rec(d, i) for i, d in enumerate(detections)]
    summ = _make_summary(detections)
    top  = detections[0]

    groq_used = len(groq_items) > 0
    logger.info(f"Final: {len(detections)} items. Groq: {groq_used}. Top: {top['display_name']} ({top['confidence']}%)")

    return {
        "waste_type":            top["category"],
        "confidence":            top["confidence"],
        "recyclable":            top["recyclable"],
        "hazardous":             top["hazardous"],
        "disposal_instructions": top["disposal_instructions"],
        "sub_category":          top["display_name"],
        "detections":            detections,
        "primary_waste_type":    top["category"],
        "object_count":          len(detections),
        "model_type":            "groq+yolo" if groq_used else "yolo_only",
        "groq_used":             groq_used,
        "recommendations":       recs,
        "summary":               summ,
        "bin_color":             top["bin_color"],
        "bin_color_hex":         top["bin_color_hex"],
        "bin_code":              top["bin_code"],
        "fact":                  top["fact"],
        "mcd_rule":              top["mcd_rule"],
        "action":                top["action"],
    }


def classify_image(image_bytes: bytes, conf_threshold: float = DEFAULT_CONF) -> dict:
    import asyncio
    return asyncio.run(classify_waste_image(image_bytes))


def _empty_result() -> dict:
    return {
        "waste_type": "Unknown", "confidence": 0.0, "recyclable": False,
        "hazardous": False, "disposal_instructions": "Could not identify. Try a clearer photo.",
        "sub_category": "", "detections": [], "primary_waste_type": "Unknown",
        "object_count": 0, "model_type": "groq+yolo", "groq_used": False,
        "recommendations": [{
            "item_rank": 1, "class": "unknown", "display_name": "No Item Detected",
            "category": "Unknown", "confidence": 0.0, "priority": "low",
            "icon": "📷", "color": "#6b7280", "title": "No Waste Detected",
            "bin_code": "BLACK BIN", "bin_color": "Black", "bin_color_hex": "#6b7280",
            "action": "Take a clearer photo with good lighting.",
            "disposal": "Could not classify.", "fact": "", "mcd_rule": "",
            "hazardous": False, "recyclable": False, "source": "none",
        }],
        "summary": {
            "total_items": 0, "hazardous_count": 0, "recyclable_count": 0,
            "categories_found": [], "bins_needed": [], "co2_impact": "",
            "urgent_action": "", "segregation_tip": "No waste detected.",
        },
        "bin_color": "Black", "bin_color_hex": "#6b7280",
        "bin_code": "BLACK BIN", "fact": "", "mcd_rule": "", "action": "",
    }


def set_conf_threshold(threshold: float) -> None:
    global DEFAULT_CONF
    DEFAULT_CONF = max(0.1, min(1.0, threshold))


classify_waste_image_sync = classify_image