"""
app/services/carbon_service.py
Carbon credit calculation from CO2 savings.
India carbon credit price: ~₹1500 per ton CO2 (configurable).
"""

import logging
from app.pathway_pipeline.pipeline import get_state

logger = logging.getLogger(__name__)

# Configurable constants
CO2_KG_PER_CREDIT    = 100.0    # 1 credit = 100 kg CO2 saved
CREDIT_VALUE_INR     = 1500.0   # ₹1500 per credit (~market rate India 2026)
CO2_PER_TON_INR      = 15000.0  # ₹15,000 per ton CO2 (1000 kg)

WARD_NAMES = {
    "ward-001": "Karol Bagh",
    "ward-002": "Dwarka",
    "ward-003": "Saket",
    "ward-004": "Rohini",
    "ward-005": "Connaught Place",
}


def calculate_carbon_credits(co2_saved_kg: float) -> dict:
    """
    Convert CO2 savings to carbon credits and INR value.
    co2_saved_kg: kilograms of CO2 prevented
    """
    credits      = co2_saved_kg / CO2_KG_PER_CREDIT
    value_inr    = credits * CREDIT_VALUE_INR
    tons_saved   = co2_saved_kg / 1000.0
    city_scale_kg = co2_saved_kg * (272 / 5)  # projected to all 272 Delhi wards

    return {
        "co2_saved_kg":          round(co2_saved_kg, 2),
        "co2_saved_tons":         round(tons_saved, 4),
        "credits":                round(credits, 3),
        "value_inr":              round(value_inr, 2),
        "value_usd":              round(value_inr / 83.5, 2),
        "city_scale_co2_kg":      round(city_scale_kg, 1),
        "city_scale_credits":     round(city_scale_kg / CO2_KG_PER_CREDIT, 1),
        "city_scale_value_inr":   round((city_scale_kg / CO2_KG_PER_CREDIT) * CREDIT_VALUE_INR, 0),
        "credit_rate_per_100kg":  CREDIT_VALUE_INR,
        "methodology":            "India Carbon Credit Exchange (ICCX) — Municipal Solid Waste",
    }


def get_ward_carbon(ward_id: str) -> dict:
    """
    Get carbon credit data for a specific ward.
    Pulls live CO2 data from pipeline state.
    """
    leaderboard = get_state("leaderboard")
    impact      = get_state("impact")
    wards       = leaderboard.get("wards", [])
    ward        = next((w for w in wards if w.get("ward_id") == ward_id), None)

    if ward:
        # Per-ward CO2 estimate (total / number of wards)
        total_co2  = impact.get("co2_saved_kg", 0)
        n_wards    = max(len(wards), 1)
        ward_co2   = total_co2 / n_wards * (ward.get("score", 50) / 100 * 1.5)
    else:
        ward_co2 = impact.get("co2_saved_kg", 0) / 5

    credits_data = calculate_carbon_credits(ward_co2)
    credits_data.update({
        "ward_id":   ward_id,
        "ward_name": WARD_NAMES.get(ward_id, ward_id),
        "score":     round(ward.get("score", 0), 2) if ward else 0,
    })
    return credits_data


def get_city_carbon() -> dict:
    """Total carbon credits for all pilot wards."""
    impact = get_state("impact")
    co2    = impact.get("co2_saved_kg", 0)
    return {
        "scope":    "5 pilot wards",
        **calculate_carbon_credits(co2),
    }
