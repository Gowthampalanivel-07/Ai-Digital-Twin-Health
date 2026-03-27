from datetime import datetime
import math
import json
from typing import Dict, List
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .schemas import (
    DashboardResponse,
    HospitalItem,
    HospitalSearchResponse,
    ManualHealthInput,
    ReminderInput,
    ReminderItem,
    RiskResponse,
    SeriousAlertRequest,
    SeriousAlertResponse,
    SimulationRequest,
    SimulationResponse,
    SymptomAnalysisResponse,
    SymptomInput,
    UserProfileInput,
    UserProfileResponse,
)
from .services import HealthSnapshot, analyze_symptoms, compute_bmi, compute_risk, default_snapshot, simulate_risk

app = FastAPI(title="AI Digital Twin - Health Predictor", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

USER_DATA: Dict[str, HealthSnapshot] = {}
USER_PROFILES: Dict[str, UserProfileResponse] = {}
REMINDERS: Dict[str, List[ReminderItem]] = {}


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.post("/ingest/manual")
def ingest_manual(payload: ManualHealthInput) -> Dict[str, str]:
    USER_DATA[payload.user_id] = HealthSnapshot(
        timestamp=payload.timestamp,
        heart_rate=payload.heart_rate,
        sleep_hours=payload.sleep_hours,
        stress_level=payload.stress_level,
        steps=payload.steps,
        calories=payload.calories,
    )
    return {"status": "stored", "user_id": payload.user_id}


@app.get("/users/{user_id}/risk", response_model=RiskResponse)
def get_risk(user_id: str) -> RiskResponse:
    snapshot = USER_DATA.get(user_id, default_snapshot())
    scores = compute_risk(snapshot)

    summary = "Stable trends"
    if max(scores.values()) >= 70:
        summary = "High-risk trend detected"
    elif max(scores.values()) >= 40:
        summary = "Moderate risk, lifestyle changes recommended"

    return RiskResponse(user_id=user_id, summary=summary, **scores)


@app.post("/users/{user_id}/simulate", response_model=SimulationResponse)
def simulate(user_id: str, payload: SimulationRequest) -> SimulationResponse:
    if payload.user_id != user_id:
        raise HTTPException(status_code=400, detail="user_id mismatch")

    snapshot = USER_DATA.get(user_id, default_snapshot())
    baseline = compute_risk(snapshot)
    projected = simulate_risk(
        baseline,
        sleep_hours=payload.sleep_hours,
        exercise_minutes=payload.exercise_minutes_per_week,
        diet_quality=payload.diet_quality,
        target_days=payload.target_days,
    )

    recommendation = "Keep current plan"
    if projected["risk_stress"] > baseline["risk_stress"]:
        recommendation = "Increase sleep and reduce stress triggers"
    elif projected["risk_heart"] < baseline["risk_heart"] and projected["risk_diabetes"] < baseline["risk_diabetes"]:
        recommendation = "Plan looks good. Continue for next 12 weeks"

    return SimulationResponse(
        user_id=user_id,
        horizon_days=payload.target_days,
        projected_risk_heart=projected["risk_heart"],
        projected_risk_diabetes=projected["risk_diabetes"],
        projected_risk_stress=projected["risk_stress"],
        recommendation=recommendation,
    )


@app.post("/users/{user_id}/profile", response_model=UserProfileResponse)
def upsert_profile(user_id: str, payload: UserProfileInput) -> UserProfileResponse:
    if payload.user_id != user_id:
        raise HTTPException(status_code=400, detail="user_id mismatch")

    profile = UserProfileResponse(
        user_id=payload.user_id,
        name=payload.name,
        age=payload.age,
        gender=payload.gender,
        height_cm=payload.height_cm,
        weight_kg=payload.weight_kg,
        bmi=compute_bmi(payload.height_cm, payload.weight_kg),
        activity_level=payload.activity_level,
        diet_type=payload.diet_type,
        sleep_hours_avg=payload.sleep_hours_avg,
        medical_history=payload.medical_history,
        surgeries=payload.surgeries,
        allergies=payload.allergies,
        medications=payload.medications,
        family_history=payload.family_history,
    )
    USER_PROFILES[user_id] = profile
    return profile


@app.get("/users/{user_id}/profile", response_model=UserProfileResponse)
def get_profile(user_id: str) -> UserProfileResponse:
    if user_id not in USER_PROFILES:
        raise HTTPException(status_code=404, detail="profile not found")
    return USER_PROFILES[user_id]


@app.post("/users/{user_id}/symptoms/analyze", response_model=SymptomAnalysisResponse)
def analyze_user_symptoms(user_id: str, payload: SymptomInput) -> SymptomAnalysisResponse:
    if payload.user_id != user_id:
        raise HTTPException(status_code=400, detail="user_id mismatch")

    analysis = analyze_symptoms(
        symptom_text=payload.symptom_text,
        duration_days=payload.duration_days,
        severity=payload.severity,
        triggers=payload.triggers,
        sleep_hours=payload.sleep_hours,
        hydration_liters=payload.hydration_liters,
    )
    disclaimer = "This advisory is decision support only and not a medical diagnosis."
    return SymptomAnalysisResponse(**analysis, disclaimer=disclaimer)


@app.post("/users/{user_id}/reminders", response_model=ReminderItem)
def create_reminder(user_id: str, payload: ReminderInput) -> ReminderItem:
    if payload.user_id != user_id:
        raise HTTPException(status_code=400, detail="user_id mismatch")
    item = ReminderItem(
        id=str(uuid4()),
        user_id=user_id,
        reminder_type=payload.reminder_type,
        title=payload.title,
        schedule=payload.schedule,
    )
    REMINDERS.setdefault(user_id, []).append(item)
    return item


@app.get("/users/{user_id}/reminders", response_model=List[ReminderItem])
def list_reminders(user_id: str) -> List[ReminderItem]:
    return REMINDERS.get(user_id, [])


@app.get("/dashboard/{role}", response_model=DashboardResponse)
def get_dashboard(role: str) -> DashboardResponse:
    if role not in {"user", "doctor", "admin"}:
        raise HTTPException(status_code=400, detail="invalid role")

    cards_by_role = {
        "user": [
            "Today risk score",
            "Medication reminders",
            "Hydration and sleep tracker",
            "Symptom trend and care plan",
            "Recommended health videos",
        ],
        "doctor": [
            "Patient queue by urgency",
            "Symptom analysis snapshots",
            "Treatment adherence overview",
            "Follow-up recommendations",
        ],
        "admin": [
            "System usage analytics",
            "RBAC and access audits",
            "Critical alert logs",
            "Integrations health status",
        ],
    }
    return DashboardResponse(role=role, cards=cards_by_role[role])


@app.get("/geo/hospitals/nearby", response_model=HospitalSearchResponse)
def nearby_hospitals(lat: float, lon: float, radius_km: float = 5.0) -> HospitalSearchResponse:
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise HTTPException(status_code=400, detail="invalid coordinates")
    if radius_km <= 0 or radius_km > 50:
        raise HTTPException(status_code=400, detail="radius_km must be between 0 and 50")

    radius_m = int(radius_km * 1000)
    query = f"""
    [out:json];
    (
      node["amenity"="hospital"](around:{radius_m},{lat},{lon});
      way["amenity"="hospital"](around:{radius_m},{lat},{lon});
      relation["amenity"="hospital"](around:{radius_m},{lat},{lon});
    );
    out center tags;
    """
    overpass_endpoints = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
        "https://lz4.overpass-api.de/api/interpreter",
    ]
    payload = None
    errors: List[str] = []
    encoded = urlencode({"data": query}).encode("utf-8")

    for endpoint in overpass_endpoints:
        try:
            req = Request(
                endpoint,
                data=encoded,
                method="POST",
                headers={
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "User-Agent": "ai-digital-twin-health/1.0",
                },
            )
            with urlopen(req, timeout=15) as response:  # nosec B310
                payload = json.loads(response.read().decode("utf-8"))
            break
        except Exception as exc:
            errors.append(f"{endpoint}: {exc}")

    if payload is None:
        raise HTTPException(status_code=502, detail=f"hospital lookup failed across providers: {' | '.join(errors)}")

    hospitals: List[HospitalItem] = []
    seen = set()

    def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        radius = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return radius * c

    for element in payload.get("elements", []):
        tags = element.get("tags", {})
        name = tags.get("name", "Nearby Hospital")
        phone = tags.get("phone") or tags.get("contact:phone") or "Emergency: 108"
        address_parts = [
            tags.get("addr:housenumber"),
            tags.get("addr:street"),
            tags.get("addr:city"),
            tags.get("addr:state"),
        ]
        address = ", ".join([part for part in address_parts if part]) or "Address not available"

        el_lat = element.get("lat") or element.get("center", {}).get("lat")
        el_lon = element.get("lon") or element.get("center", {}).get("lon")
        if el_lat is None or el_lon is None:
            continue
        d_km = round(haversine_km(lat, lon, float(el_lat), float(el_lon)), 2)
        key = (name.lower().strip(), round(float(el_lat), 4), round(float(el_lon), 4))
        if key in seen:
            continue
        seen.add(key)
        maps_url = f"https://www.google.com/maps/search/?api=1&query={el_lat},{el_lon}"

        hospitals.append(
            HospitalItem(
                name=name,
                lat=float(el_lat),
                lon=float(el_lon),
                distance_km=d_km,
                phone=phone,
                address=address,
                maps_url=maps_url,
            )
        )

    hospitals = sorted(hospitals, key=lambda item: item.distance_km)[:15]
    return HospitalSearchResponse(latitude=lat, longitude=lon, radius_km=radius_km, hospitals=hospitals)


@app.post("/users/{user_id}/alerts/serious", response_model=SeriousAlertResponse)
def send_serious_alert(user_id: str, payload: SeriousAlertRequest) -> SeriousAlertResponse:
    if payload.user_id != user_id:
        raise HTTPException(status_code=400, detail="user_id mismatch")

    # Placeholder SMS hook. Integrate Twilio/MSG91 provider here for real mobile delivery.
    message = (
        f"Critical health alert for {user_id}: {payload.condition_summary}. "
        "Please seek emergency care immediately."
    )
    print(f"[SERIOUS_ALERT] To {payload.mobile_number}: {message}")

    return SeriousAlertResponse(status="queued", message=message, mobile_number=payload.mobile_number)
