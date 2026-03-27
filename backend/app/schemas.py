from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class ManualHealthInput(BaseModel):
    user_id: str = Field(..., min_length=1)
    timestamp: str
    heart_rate: int = Field(..., ge=30, le=220)
    sleep_hours: float = Field(..., ge=0, le=24)
    stress_level: int = Field(..., ge=1, le=10)
    steps: int = Field(..., ge=0)
    calories: int = Field(..., ge=0)


class RiskResponse(BaseModel):
    user_id: str
    risk_heart: float
    risk_diabetes: float
    risk_stress: float
    summary: str


class SimulationRequest(BaseModel):
    user_id: str
    target_days: int = Field(30, ge=7, le=3650)
    sleep_hours: float = Field(..., ge=0, le=24)
    exercise_minutes_per_week: int = Field(..., ge=0, le=2000)
    diet_quality: Literal["poor", "average", "good"]


class SimulationResponse(BaseModel):
    user_id: str
    horizon_days: int
    projected_risk_heart: float
    projected_risk_diabetes: float
    projected_risk_stress: float
    recommendation: str


class UserProfileInput(BaseModel):
    user_id: str = Field(..., min_length=1)
    name: str
    age: int = Field(..., ge=0, le=120)
    gender: str
    height_cm: float = Field(..., ge=30, le=260)
    weight_kg: float = Field(..., ge=2, le=400)
    activity_level: Literal["low", "moderate", "high"]
    diet_type: str
    sleep_hours_avg: float = Field(..., ge=0, le=24)
    medical_history: List[str] = []
    surgeries: List[str] = []
    allergies: List[str] = []
    medications: List[str] = []
    family_history: List[str] = []


class UserProfileResponse(BaseModel):
    user_id: str
    name: str
    age: int
    gender: str
    height_cm: float
    weight_kg: float
    bmi: float
    activity_level: str
    diet_type: str
    sleep_hours_avg: float
    medical_history: List[str]
    surgeries: List[str]
    allergies: List[str]
    medications: List[str]
    family_history: List[str]


class SymptomInput(BaseModel):
    user_id: str
    symptom_text: str = Field(..., min_length=3)
    duration_days: int = Field(..., ge=0, le=365)
    severity: int = Field(..., ge=1, le=10)
    location: Optional[str] = None
    triggers: List[str] = []
    sleep_hours: Optional[float] = Field(default=None, ge=0, le=24)
    hydration_liters: Optional[float] = Field(default=None, ge=0, le=12)


class SymptomAnalysisResponse(BaseModel):
    category: str
    urgency: Literal["mild", "moderate", "critical"]
    possible_conditions: List[str]
    risk_level: Literal["low", "medium", "high"]
    suggested_tests: List[str]
    recommended_doctor: str
    care_plan: List[str]
    exercise_plan: List[str]
    lifestyle_advice: List[str]
    follow_up_days: int
    disclaimer: str


class ReminderInput(BaseModel):
    user_id: str
    reminder_type: Literal["medication", "exercise", "appointment", "water", "health_check"]
    title: str
    schedule: str


class ReminderItem(BaseModel):
    id: str
    user_id: str
    reminder_type: str
    title: str
    schedule: str


class DashboardResponse(BaseModel):
    role: Literal["user", "doctor", "admin"]
    cards: List[str]


class HospitalItem(BaseModel):
    name: str
    lat: float
    lon: float
    distance_km: float
    phone: str
    address: str
    maps_url: str


class HospitalSearchResponse(BaseModel):
    latitude: float
    longitude: float
    radius_km: float
    hospitals: List[HospitalItem]


class SeriousAlertRequest(BaseModel):
    user_id: str
    mobile_number: str = Field(..., min_length=8, max_length=20)
    condition_summary: str
    urgency: Literal["critical"]


class SeriousAlertResponse(BaseModel):
    status: str
    message: str
    mobile_number: str
