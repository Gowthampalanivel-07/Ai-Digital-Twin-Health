from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List


@dataclass
class HealthSnapshot:
    timestamp: str
    heart_rate: int
    sleep_hours: float
    stress_level: int
    steps: int
    calories: int


def clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def compute_risk(snapshot: HealthSnapshot) -> Dict[str, float]:
    heart = 20 + (snapshot.heart_rate - 70) * 0.7 + (7 - snapshot.sleep_hours) * 5 + (10000 - snapshot.steps) / 400
    diabetes = 15 + (snapshot.calories - 2200) / 40 + (7 - snapshot.sleep_hours) * 4 + (10000 - snapshot.steps) / 500
    stress = 10 + snapshot.stress_level * 7 + (7 - snapshot.sleep_hours) * 3 + (snapshot.heart_rate - 70) * 0.3

    return {
        "risk_heart": round(clamp(heart), 2),
        "risk_diabetes": round(clamp(diabetes), 2),
        "risk_stress": round(clamp(stress), 2),
    }


def simulate_risk(
    base: Dict[str, float], sleep_hours: float, exercise_minutes: int, diet_quality: str, target_days: int
) -> Dict[str, float]:
    sleep_adjust = (sleep_hours - 7) * 2.2
    exercise_adjust = (exercise_minutes - 150) / 35
    diet_adjust = {"poor": 6, "average": 0, "good": -7}[diet_quality]
    time_adjust = min(12.0, target_days / 50)

    heart = base["risk_heart"] - sleep_adjust - exercise_adjust + diet_adjust - time_adjust
    diabetes = base["risk_diabetes"] - sleep_adjust * 0.8 - exercise_adjust * 0.9 + diet_adjust * 1.3 - time_adjust
    stress = base["risk_stress"] - sleep_adjust * 1.2 - exercise_adjust * 0.5 + diet_adjust * 0.4 - time_adjust * 0.8

    return {
        "risk_heart": round(clamp(heart), 2),
        "risk_diabetes": round(clamp(diabetes), 2),
        "risk_stress": round(clamp(stress), 2),
    }


def default_snapshot() -> HealthSnapshot:
    return HealthSnapshot(
        timestamp=datetime.utcnow().isoformat(),
        heart_rate=78,
        sleep_hours=6.2,
        stress_level=6,
        steps=4500,
        calories=2450,
    )


def compute_bmi(height_cm: float, weight_kg: float) -> float:
    meters = height_cm / 100
    if meters <= 0:
        return 0.0
    return round(weight_kg / (meters * meters), 2)


def analyze_symptoms(
    symptom_text: str,
    duration_days: int,
    severity: int,
    triggers: List[str],
    sleep_hours: float | None,
    hydration_liters: float | None,
) -> Dict[str, object]:
    text = symptom_text.lower()
    trigger_text = " ".join(triggers).lower()

    possible_conditions: List[str] = ["General fatigue"]
    category = "general"
    urgency = "mild"
    risk_level = "low"
    suggested_tests = ["Complete blood count (CBC) if persistent"]
    recommended_doctor = "General Physician"
    care_plan = [
        "Track symptoms daily in the app",
        "Ensure regular hydration and balanced meals",
    ]
    exercise_plan = ["20-30 minutes light walking", "Gentle mobility routine"]
    lifestyle_advice = ["Sleep 7-8 hours", "Reduce screen time before bed"]
    follow_up_days = 5

    if "headache" in text:
        category = "neurology"
        possible_conditions = ["Stress headache", "Dehydration headache"]
        suggested_tests = ["Blood pressure check", "Vision check if frequent"]
        care_plan.insert(0, "Rest in a dark, quiet room for 20 minutes")
        recommended_doctor = "General Physician / Neurologist"

    if "fatigue" in text:
        possible_conditions.append("Sleep debt")
        lifestyle_advice.append("Maintain a fixed sleep-wake schedule")

    if sleep_hours is not None and sleep_hours < 6:
        possible_conditions.append("Sleep deprivation")
        urgency = "moderate"
        risk_level = "medium"

    if hydration_liters is not None and hydration_liters < 1.5:
        possible_conditions.append("Dehydration")
        lifestyle_advice.append("Target 2-2.5 liters water/day")

    if severity >= 8 or duration_days > 14 or "chest pain" in text or "faint" in text:
        urgency = "critical"
        risk_level = "high"
        suggested_tests = ["Immediate clinical evaluation", "ECG / ER triage as advised"]
        recommended_doctor = "Emergency Care"
        follow_up_days = 1
        care_plan = ["Seek urgent in-person medical help now"]
        exercise_plan = ["No exercise until medically cleared"]

    if "stress" in trigger_text:
        lifestyle_advice.append("Practice 10-minute breathing sessions twice daily")

    return {
        "category": category,
        "urgency": urgency,
        "possible_conditions": possible_conditions,
        "risk_level": risk_level,
        "suggested_tests": suggested_tests,
        "recommended_doctor": recommended_doctor,
        "care_plan": care_plan,
        "exercise_plan": exercise_plan,
        "lifestyle_advice": lifestyle_advice,
        "follow_up_days": follow_up_days,
    }
