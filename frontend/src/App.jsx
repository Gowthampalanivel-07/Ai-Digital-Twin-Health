import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

const API_URL = "http://127.0.0.1:8010";
const VIDEO_RECOMMENDATIONS = [
  { title: "Breathing for Stress Relief", src: "https://www.youtube.com/embed/aXItOY0sLRY" },
  { title: "Better Sleep Routine", src: "https://www.youtube.com/embed/5MuIMqhT8DM" },
  { title: "Hydration Tips", src: "https://www.youtube.com/embed/9iMGFqMmUFs" },
  { title: "Beginner Full Body Stretch", src: "https://www.youtube.com/embed/g_tea8ZNk5A" },
  { title: "Desk Mobility for Neck and Back", src: "https://www.youtube.com/embed/4BOTvaRaDjI" },
  { title: "Guided Mindfulness Practice", src: "https://www.youtube.com/embed/ZToicYcHIOU" },
];
const AI_LOADING_STEPS = ["Syncing wearable signals", "Mapping risk patterns", "Preparing personalized dashboard"];

async function fetchRisk(userId) {
  const res = await fetch(`${API_URL}/users/${userId}/risk`);
  if (!res.ok) throw new Error("Unable to fetch risk");
  return res.json();
}

async function runSimulation(userId, payload) {
  const res = await fetch(`${API_URL}/users/${userId}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Simulation failed");
  return res.json();
}

async function analyzeSymptoms(userId, payload) {
  const res = await fetch(`${API_URL}/users/${userId}/symptoms/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Symptom analysis failed");
  return res.json();
}

async function fetchDashboard(role) {
  const res = await fetch(`${API_URL}/dashboard/${role}`);
  if (!res.ok) throw new Error("Unable to fetch dashboard");
  return res.json();
}

async function fetchNearbyHospitals(lat, lon, radiusKm) {
  const res = await fetch(`${API_URL}/geo/hospitals/nearby?lat=${lat}&lon=${lon}&radius_km=${radiusKm}`);
  if (!res.ok) {
    let message = "Unable to fetch nearby hospitals";
    try {
      const body = await res.json();
      if (body?.detail) message = body.detail;
    } catch (_err) {
      // keep fallback message
    }
    throw new Error(message);
  }
  return res.json();
}

async function sendSeriousMobileAlert(userId, payload) {
  const res = await fetch(`${API_URL}/users/${userId}/alerts/serious`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Unable to send serious mobile alert");
  return res.json();
}

function ParticleBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    let raf = 0;
    let width = 0;
    let height = 0;
    const pointer = { x: -200, y: -200 };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    resize();

    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.7,
      vy: (Math.random() - 0.5) * 0.7,
      r: 1.2 + Math.random() * 2.8,
    }));

    const onMove = (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    };

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        const dx = pointer.x - p.x;
        const dy = pointer.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = Math.max(0, 120 - dist) / 1200;
        p.vx -= (dx / dist) * force;
        p.vy -= (dy / dist) * force;

        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.995;
        p.vy *= 0.995;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
        p.x = Math.max(0, Math.min(width, p.x));
        p.y = Math.max(0, Math.min(height, p.y));
      }

      for (let i = 0; i < particles.length; i += 1) {
        const p1 = particles[i];
        for (let j = i + 1; j < particles.length; j += 1) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 100) {
            ctx.strokeStyle = `rgba(120, 175, 255, ${0.16 - d / 700})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
        ctx.fillStyle = "rgba(160, 210, 255, 0.9)";
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, p1.r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(animate);
    };

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove);
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return <canvas className="particle-bg" ref={canvasRef} aria-hidden="true" />;
}

function RiskChart({ risk, simulation }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !risk) return;

    const data = [
      { name: "Heart", current: risk.risk_heart, projected: simulation?.projected_risk_heart ?? risk.risk_heart },
      { name: "Diabetes", current: risk.risk_diabetes, projected: simulation?.projected_risk_diabetes ?? risk.risk_diabetes },
      { name: "Stress", current: risk.risk_stress, projected: simulation?.projected_risk_stress ?? risk.risk_stress },
    ];

    const width = 640;
    const height = 260;
    const margin = { top: 24, right: 24, bottom: 30, left: 48 };

    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const x = d3.scaleBand().domain(data.map((d) => d.name)).range([margin.left, width - margin.right]).padding(0.35);
    const y = d3.scaleLinear().domain([0, 100]).range([height - margin.bottom, margin.top]);

    svg.append("g").attr("transform", `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x)).attr("class", "axis");
    svg.append("g").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(5)).attr("class", "axis");

    svg
      .selectAll(".bar-current")
      .data(data)
      .enter()
      .append("rect")
      .attr("class", "bar-current")
      .attr("x", (d) => x(d.name))
      .attr("y", (d) => y(d.current))
      .attr("width", x.bandwidth() / 2)
      .attr("height", (d) => y(0) - y(d.current));

    svg
      .selectAll(".bar-projected")
      .data(data)
      .enter()
      .append("rect")
      .attr("class", "bar-projected")
      .attr("x", (d) => x(d.name) + x.bandwidth() / 2)
      .attr("y", (d) => y(d.projected))
      .attr("width", x.bandwidth() / 2)
      .attr("height", (d) => y(0) - y(d.projected));
  }, [risk, simulation]);

  if (!risk) return null;
  return <svg ref={ref} className="risk-chart" role="img" aria-label="Risk comparison chart" />;
}

function SectionTitle({ icon, title }) {
  return (
    <h2 className="section-title">
      <span className="section-icon" aria-hidden="true">
        {icon}
      </span>
      {title}
    </h2>
  );
}

function itemLogo(label) {
  const value = label.toLowerCase();
  if (value.includes("risk") || value.includes("heart")) return "❤";
  if (value.includes("doctor") || value.includes("patient")) return "⚕";
  if (value.includes("sleep")) return "☾";
  if (value.includes("water") || value.includes("hydration")) return "💧";
  if (value.includes("exercise")) return "🏃";
  if (value.includes("alert")) return "⚠";
  if (value.includes("analytics") || value.includes("usage")) return "📊";
  if (value.includes("audit") || value.includes("access")) return "🔒";
  if (value.includes("video")) return "▶";
  return "✦";
}

export default function App() {
  const [userId, setUserId] = useState("demo-user");
  const [sleep, setSleep] = useState(7);
  const [exercise, setExercise] = useState(180);
  const [diet, setDiet] = useState("good");
  const [horizon, setHorizon] = useState(90);
  const [risk, setRisk] = useState(null);
  const [simulation, setSimulation] = useState(null);
  const [role, setRole] = useState("user");
  const [dashboard, setDashboard] = useState(null);
  const [symptomText, setSymptomText] = useState("headache + fatigue");
  const [durationDays, setDurationDays] = useState(2);
  const [severity, setSeverity] = useState(4);
  const [sleepInput, setSleepInput] = useState(6);
  const [hydration, setHydration] = useState(1.2);
  const [symptomResult, setSymptomResult] = useState(null);
  const [theme, setTheme] = useState("dark");
  const [showIntro, setShowIntro] = useState(true);
  const [introStep, setIntroStep] = useState(0);
  const [cursor, setCursor] = useState({ x: -100, y: -100 });
  const [mobileNumber, setMobileNumber] = useState("");
  const [alertStatus, setAlertStatus] = useState("");
  const [hospitals, setHospitals] = useState([]);
  const [hospitalStatus, setHospitalStatus] = useState("");
  const [hospitalRadiusKm, setHospitalRadiusKm] = useState(6);
  const [isLoadingHospitals, setIsLoadingHospitals] = useState(false);
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [error, setError] = useState("");
  const cardsRef = useRef([]);

  const topRisk = useMemo(() => {
    if (!risk) return null;
    return Math.max(risk.risk_heart, risk.risk_diabetes, risk.risk_stress);
  }, [risk]);

  useEffect(() => {
    const timer = setTimeout(() => setShowIntro(false), 3200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!showIntro) return undefined;
    const ticker = setInterval(() => {
      setIntroStep((prev) => (prev + 1) % AI_LOADING_STEPS.length);
    }, 900);
    return () => clearInterval(ticker);
  }, [showIntro]);

  useEffect(() => {
    document.body.className = theme === "dark" ? "theme-dark" : "theme-light";
    return () => {
      document.body.className = "";
    };
  }, [theme]);

  useEffect(() => {
    const onPointer = (e) => setCursor({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", onPointer);
    return () => window.removeEventListener("pointermove", onPointer);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("card-visible");
        });
      },
      { threshold: 0.18 }
    );
    cardsRef.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const loadRisk = async () => {
    setError("");
    try {
      const data = await fetchRisk(userId);
      setRisk(data);
    } catch (e) {
      setError(e.message);
    }
  };

  const simulate = async () => {
    setError("");
    try {
      const data = await runSimulation(userId, {
        user_id: userId,
        target_days: Number(horizon),
        sleep_hours: Number(sleep),
        exercise_minutes_per_week: Number(exercise),
        diet_quality: diet,
      });
      setSimulation(data);
    } catch (e) {
      setError(e.message);
    }
  };

  const runSymptomAnalysis = async () => {
    setError("");
    try {
      const data = await analyzeSymptoms(userId, {
        user_id: userId,
        symptom_text: symptomText,
        duration_days: Number(durationDays),
        severity: Number(severity),
        location: "head",
        triggers: ["stress", "low water"],
        sleep_hours: Number(sleepInput),
        hydration_liters: Number(hydration),
      });
      setSymptomResult(data);

      if (data.urgency === "critical" && mobileNumber.trim()) {
        const alertData = await sendSeriousMobileAlert(userId, {
          user_id: userId,
          mobile_number: mobileNumber.trim(),
          condition_summary: `${symptomText} | severity ${severity}/10`,
          urgency: "critical",
        });
        setAlertStatus(`Emergency mobile alert sent to ${alertData.mobile_number}`);
      }
    } catch (e) {
      setError(e.message);
    }
  };

  const loadDashboard = async () => {
    setError("");
    try {
      const data = await fetchDashboard(role);
      setDashboard(data);
    } catch (e) {
      setError(e.message);
    }
  };

  const loadNearbyHospitals = async () => {
    setHospitalStatus("");
    setError("");
    setHospitals([]);
    if (!navigator.geolocation) {
      setHospitalStatus("Geolocation is not supported on this device.");
      return;
    }
    setIsLoadingHospitals(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const data = await fetchNearbyHospitals(
            position.coords.latitude,
            position.coords.longitude,
            Number(hospitalRadiusKm)
          );
          setHospitals(data.hospitals || []);
          if (data.hospitals?.length) {
            setHospitalStatus(`Found ${data.hospitals.length} hospitals within ${hospitalRadiusKm} km.`);
          } else {
            setHospitalStatus(`No hospitals found within ${hospitalRadiusKm} km. Try increasing radius.`);
          }
        } catch (e) {
          setHospitalStatus(e.message);
        } finally {
          setIsLoadingHospitals(false);
        }
      },
      () => {
        setIsLoadingHospitals(false);
        setHospitalStatus("Location access denied. Please allow location to find nearby hospitals.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  return (
    <main className={`container ${showIntro ? "intro-active" : "intro-done"}`}>
      {showIntro && (
        <div className="intro-overlay">
          <div className="intro-pulse" />
          <div className="intro-content">
            <div className="intro-logo">❤</div>
            <h2>Health Twin AI</h2>
            <p>Preparing a calm and personalized health space...</p>
            <p className="intro-step">{AI_LOADING_STEPS[introStep]}...</p>
          </div>
        </div>
      )}
      <ParticleBackground />
      <div className="cursor-glow" style={{ left: cursor.x, top: cursor.y }} />
      <div className="blob blob-a" aria-hidden="true" />
      <div className="blob blob-b" aria-hidden="true" />
      <header className="hero">
        <div>
          <p className="kicker">AI Digital Twin Platform</p>
          <h1 className="kinetic-title">Predict. Prevent. Personalize.</h1>
          <p className="subtitle">Adaptive health intelligence with immersive UX, advisory insights, and role-based flows.</p>
        </div>
        <button className="theme-btn" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
          Switch to {theme === "dark" ? "Light" : "Dark"} Mode
        </button>
      </header>

      <section className="card reveal" ref={(el) => (cardsRef.current[0] = el)}>
        <SectionTitle icon="⌘" title="Role Dashboard" />
        <label>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="user">user</option>
            <option value="doctor">doctor</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <button onClick={loadDashboard}>Load Dashboard</button>
        {dashboard && (
          <ul className="logo-list">
            {dashboard.cards.map((card) => (
              <li key={card}>
                <span className="item-logo">{itemLogo(card)}</span>
                {card}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card reveal" ref={(el) => (cardsRef.current[1] = el)}>
        <label>User ID</label>
        <input value={userId} onChange={(e) => setUserId(e.target.value)} />
        <button onClick={loadRisk}>Load Current Risk</button>
      </section>

      {risk && (
        <section className="card reveal" ref={(el) => (cardsRef.current[2] = el)}>
          <SectionTitle icon="❤" title="Current Risk" />
          <ul className="logo-list">
            <li>
              <span className="item-logo">❤</span>Heart: {risk.risk_heart}%
            </li>
            <li>
              <span className="item-logo">◉</span>Diabetes: {risk.risk_diabetes}%
            </li>
            <li>
              <span className="item-logo">⚕</span>Stress: {risk.risk_stress}%
            </li>
          </ul>
          <p>Status: {risk.summary}</p>
          <p>
            Top risk score: <strong>{topRisk}%</strong>
          </p>
          <RiskChart risk={risk} simulation={simulation} />
        </section>
      )}

      <section className="card reveal" ref={(el) => (cardsRef.current[3] = el)}>
        <SectionTitle icon="♻" title="Lifestyle Simulation" />
        <div className="grid">
          <label>
            Sleep Hours
            <input type="number" min="0" max="24" value={sleep} onChange={(e) => setSleep(e.target.value)} />
          </label>
          <label>
            Exercise / Week (min)
            <input
              type="number"
              min="0"
              max="2000"
              value={exercise}
              onChange={(e) => setExercise(e.target.value)}
            />
          </label>
          <label>
            Diet Quality
            <select value={diet} onChange={(e) => setDiet(e.target.value)}>
              <option value="poor">poor</option>
              <option value="average">average</option>
              <option value="good">good</option>
            </select>
          </label>
          <label>
            Future Horizon (days)
            <input type="number" min="7" max="3650" value={horizon} onChange={(e) => setHorizon(e.target.value)} />
          </label>
        </div>
        <button onClick={simulate}>Run Simulation</button>
      </section>

      {simulation && (
        <section className="card reveal" ref={(el) => (cardsRef.current[4] = el)}>
          <SectionTitle icon="📈" title={`Projected Risk (${simulation.horizon_days} days)`} />
          <ul className="logo-list">
            <li>
              <span className="item-logo">❤</span>Heart: {simulation.projected_risk_heart}%
            </li>
            <li>
              <span className="item-logo">◉</span>Diabetes: {simulation.projected_risk_diabetes}%
            </li>
            <li>
              <span className="item-logo">⚕</span>Stress: {simulation.projected_risk_stress}%
            </li>
          </ul>
          <p>{simulation.recommendation}</p>
        </section>
      )}

      <section className="card reveal" ref={(el) => (cardsRef.current[5] = el)}>
        <SectionTitle icon="✚" title="Symptom Input and AI Analysis" />
        <label>
          Mobile number for emergency alerts
          <input value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} placeholder="+91XXXXXXXXXX" />
        </label>
        <div className="grid">
          <label>
            Symptom text
            <input value={symptomText} onChange={(e) => setSymptomText(e.target.value)} />
          </label>
          <label>
            Duration (days)
            <input
              type="number"
              min="0"
              max="365"
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
            />
          </label>
          <label>
            Severity (1-10)
            <input type="number" min="1" max="10" value={severity} onChange={(e) => setSeverity(e.target.value)} />
          </label>
          <label>
            Sleep (hours)
            <input type="number" min="0" max="24" value={sleepInput} onChange={(e) => setSleepInput(e.target.value)} />
          </label>
          <label>
            Hydration (liters/day)
            <input type="number" min="0" max="12" value={hydration} onChange={(e) => setHydration(e.target.value)} />
          </label>
        </div>
        <button onClick={runSymptomAnalysis}>Analyze Symptoms</button>
        {alertStatus && <p className="success-msg">{alertStatus}</p>}
      </section>

      {symptomResult && (
        <section className="card reveal" ref={(el) => (cardsRef.current[6] = el)}>
          <SectionTitle icon="⚑" title="Advisory Output" />
          <p>
            Urgency: <strong>{symptomResult.urgency}</strong> | Risk: <strong>{symptomResult.risk_level}</strong>
          </p>
          <p>Category: {symptomResult.category}</p>
          <p>Doctor: {symptomResult.recommended_doctor}</p>
          <h3>Possible Conditions</h3>
          <ul className="logo-list">
            {symptomResult.possible_conditions.map((item) => (
              <li key={item}>
                <span className="item-logo">{itemLogo(item)}</span>
                {item}
              </li>
            ))}
          </ul>
          <h3>Care Plan</h3>
          <ul className="logo-list">
            {symptomResult.care_plan.map((item) => (
              <li key={item}>
                <span className="item-logo">{itemLogo(item)}</span>
                {item}
              </li>
            ))}
          </ul>
          <h3>Lifestyle Advice</h3>
          <ul className="logo-list">
            {symptomResult.lifestyle_advice.map((item) => (
              <li key={item}>
                <span className="item-logo">{itemLogo(item)}</span>
                {item}
              </li>
            ))}
          </ul>
          <p className="disclaimer">{symptomResult.disclaimer}</p>
        </section>
      )}

      <section className="card media-card reveal" ref={(el) => (cardsRef.current[7] = el)}>
        <SectionTitle icon="▶" title="Video Recommendations" />
        <div className="video-grid">
          {VIDEO_RECOMMENDATIONS.map((video) => (
            <article key={video.title} className="video-card">
              <p className="video-title">
                <span className="item-logo">▶</span>
                {video.title}
              </p>
              <iframe
                title={video.title}
                src={video.src}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </article>
          ))}
        </div>
      </section>

      <section className="card reveal" ref={(el) => (cardsRef.current[8] = el)}>
        <SectionTitle icon="🏥" title="Nearby Hospitals (from your location)" />
        <div className="grid">
          <label>
            Search radius (km)
            <input
              type="number"
              min="1"
              max="50"
              value={hospitalRadiusKm}
              onChange={(e) => setHospitalRadiusKm(e.target.value)}
            />
          </label>
        </div>
        <button onClick={loadNearbyHospitals} disabled={isLoadingHospitals}>
          {isLoadingHospitals ? "Finding Hospitals..." : "Find Nearby Hospitals"}
        </button>
        {hospitalStatus && <p>{hospitalStatus}</p>}
        {hospitals.length > 0 && (
          <ul className="logo-list">
            {hospitals.map((hospital, idx) => (
              <li key={`${hospital.name}-${idx}`} className="hospital-item">
                <span className="item-logo">🏥</span>
                <div>
                  <strong>
                    {hospital.name} ({hospital.distance_km} km)
                  </strong>
                  <p>{hospital.address}</p>
                  <p>Phone: {hospital.phone}</p>
                  <a href={hospital.maps_url} target="_blank" rel="noreferrer">
                    Open in Google Maps
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button className="floating-widget-toggle" onClick={() => setWidgetOpen((s) => !s)}>
        {widgetOpen ? "Close AI Widget" : "Open AI Widget"}
      </button>
      {widgetOpen && (
        <aside className="floating-widget">
          <h3>AI Health Assistant</h3>
          <p>Quick actions:</p>
          <div className="widget-actions">
            <button onClick={loadRisk}>Refresh Risk</button>
            <button onClick={runSymptomAnalysis}>Analyze Symptoms</button>
            <button onClick={loadNearbyHospitals}>Find Hospitals</button>
          </div>
        </aside>
      )}

      {error && <p className="error">{error}</p>}
    </main>
  );
}
