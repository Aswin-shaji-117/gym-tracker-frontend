
import React, { useEffect, useState } from "react";
import {
  Activity,
  CalendarDays,
  ChartNoAxesCombined,
  Dumbbell,
  History,
  Plus,
  Trash2,
  Weight,
  Save,
  CheckCircle2,
  LayoutDashboard,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import Login from "./login.jsx";
import "./styles.css";
import API_BASE_URL from "./services/api.js";
const API = import.meta.env.VITE_API_URL || API_BASE_URL;

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const blankExercise = () => ({
  name: "",
  muscle_group: "Chest",
  sets: 3,
  reps: 10,
  target_weight_kg: 0,
  rest_seconds: 90,
  notes: "",
});

async function request(path, auth, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(auth?.access_token
      ? { Authorization: `Bearer ${auth.access_token}` }
      : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      throw new Error("Your session has expired. Please log in again.");
    }

    throw new Error(data.detail || `Request failed (${response.status})`);
  }

  if (response.status === 204) return null;

  return response.json();
}

function Field({ label, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}

function Stat({ label, value, icon: Icon, sub }) {
  return (
    <div className="stat">
      <div className="stat-top">
        <span>{label}</span>
        <Icon size={18} />
      </div>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}

export default function App() {
  // Authentication
  const [auth, setAuth] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("gym-auth") || "null");
    } catch {
      return null;
    }
  });

  const activeUser = auth?.user;
  const userId = activeUser?.id;

  function handleLogin(data) {
    sessionStorage.setItem("gym-auth", JSON.stringify(data));
    setAuth(data);
  }

  function handleLogout() {
    sessionStorage.removeItem("gym-auth");
    setAuth(null);

    setPlans([]);
    setSessions([]);
    setMetrics([]);
    setError("");
    setNotice("");
  }

  // Dashboard state
  const [plans, setPlans] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [metrics, setMetrics] = useState([]);

  const [tab, setTab] = useState("Dashboard");

  const [day, setDay] = useState(
    DAYS[
      new Date().getDay() === 0
        ? 6
        : new Date().getDay() - 1
    ]
  );
  const [savingWorkout, setSavingWorkout] = useState(false);
  const [planTitle, setPlanTitle] = useState("");
  const [exercises, setExercises] = useState([blankExercise()]);

  const [sessionDate, setSessionDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [sessionNotes, setSessionNotes] = useState("");
  const [logPlan, setLogPlan] = useState("");
  const [logSets, setLogSets] = useState({});

  const [height, setHeight] = useState("175");
  const [weight, setWeight] = useState("");
  const [metricDate, setMetricDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [metricNotes, setMetricNotes] = useState("");

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  // Derived values
  const activePlan = plans.find((p) => p.day === day);

  const latestMetric = [...metrics].sort((a, b) =>
    b.date.localeCompare(a.date)
  )[0];

  const bmi =
    Number(weight) > 0 && Number(height) > 0
      ? Number(weight) / (Number(height) / 100) ** 2
      : null;

  const completedThisWeek = sessions.filter((session) => {
    const date = new Date(`${session.date}T12:00:00`);
    const now = new Date();

    const monday = new Date(now);
    monday.setDate(
      now.getDate() - ((now.getDay() + 6) % 7)
    );
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 7);

    return date >= monday && date < sunday;
  }).length;

  const chartData = metrics.map((m) => ({
    date: m.date.slice(5),
    weight: m.weight_kg,
    bmi: m.bmi,
  }));

  // Load data belonging to the authenticated user
  async function refreshAll() {
    if (!auth?.access_token) return;

    const [plansData, sessionsData, metricsData] =
      await Promise.all([
        request("/api/plans", auth),
        request("/api/sessions", auth),
        request("/api/body-metrics", auth),
      ]);

    setPlans(plansData);
    setSessions(sessionsData);
    setMetrics(metricsData);
  }

  useEffect(() => {
    if (!auth?.access_token || !auth?.user?.id) return;

    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        const [p, s, m] = await Promise.all([
          request("/api/plans", auth),
          request("/api/sessions", auth),
          request("/api/body-metrics", auth),
        ]);

        if (!cancelled) {
          setPlans(p);
          setSessions(s);
          setMetrics(m);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message);

          if (e.message.includes("session has expired")) {
            sessionStorage.removeItem("gym-auth");
            setAuth(null);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [auth?.access_token, auth?.user?.id]);

  // Save or update a weekly workout plan
  async function savePlan(e) {
    e.preventDefault();
    setError("");
    setNotice("");

    const cleaned = exercises
      .filter((x) => x.name.trim())
      .map((x) => ({
        ...x,
        sets: Number(x.sets),
        reps: Number(x.reps),
        target_weight_kg: Number(x.target_weight_kg),
        rest_seconds: Number(x.rest_seconds),
      }));

    if (!cleaned.length) {
      setError("Add at least one exercise with a name.");
      return;
    }

    try {
      const payload = {
        day,
        title: planTitle || `${day} workout`,
        exercises: cleaned,
      };

      if (activePlan) {
        await request(`/api/plans/${activePlan.id}`, auth, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await request("/api/plans", auth, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      await refreshAll();
      setNotice(`${day} plan saved successfully.`);
    } catch (e) {
      setError(e.message);
    }
  }

  async function removePlan() {
    if (
      !activePlan ||
      !window.confirm(`Delete the ${day} plan?`)
    ) {
      return;
    }

    try {
      await request(`/api/plans/${activePlan.id}`, auth, {
        method: "DELETE",
      });

      await refreshAll();
      setNotice("Plan deleted.");
    } catch (e) {
      setError(e.message);
    }
  }

  function updateExercise(index, key, value) {
    setExercises((previous) =>
      previous.map((exercise, i) =>
        i === index
          ? { ...exercise, [key]: value }
          : exercise
      )
    );
  }

  // Save a completed workout
  async function logWorkout(e) {
    e.preventDefault();
    if (savingWorkout) return;

    setSavingWorkout(true);
    setError("");
    setNotice("");
    setError("");
    setNotice("");

    const plan = plans.find((p) => p.id === logPlan);

    if (!plan) {
      setError("Choose a workout plan to log.");
      return;
    }

    const loggedExercises = plan.exercises.map((exercise, i) => ({
      ...exercise,
      sets: Array.from(
        { length: Number(exercise.sets) || 1 },
        (_, j) => ({
          set_number: j + 1,
          reps: Number(
            logSets[`${i}-${j}-reps`] ?? exercise.reps
          ),
          weight_kg: Number(
            logSets[`${i}-${j}-weight`] ??
              exercise.target_weight_kg
          ),
        })
      ),
    }));

    try {
      await request("/api/sessions", auth, {
        method: "POST",
        body: JSON.stringify({
          plan_id: plan.id,
          date: sessionDate,
          title: plan.title,
          notes: sessionNotes,
          exercises: loggedExercises,
        }),
      });

      await refreshAll();
      setSessionNotes("");
      setNotice("Workout session saved to history.");
      } catch (e) {
    setError(e.message);
  } finally {
    setSavingWorkout(false);
  }
}

  // Save a body measurement
  async function saveMetric(e) {
    e.preventDefault();
    setError("");
    setNotice("");

    try {
      await request("/api/body-metrics", auth, {
        method: "POST",
        body: JSON.stringify({
          date: metricDate,
          weight_kg: Number(weight),
          height_cm: Number(height),
          notes: metricNotes,
        }),
      });

      await refreshAll();
      setMetricNotes("");
      setNotice("Body measurement saved.");
    } catch (e) {
      setError(e.message);
    }
  }

  const nav = [
    ["Dashboard", LayoutDashboard],
    ["Weekly Plan", CalendarDays],
    ["Log Workout", Dumbbell],
    ["History", History],
    ["BMI & Weight", Weight],
  ];

  // Show login/register instead of the old Create Profile page
  if (!auth?.access_token || !activeUser?.id) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Dumbbell size={20} />
          </div>
          <div>
            <b>FORM / LOG</b>
            <small>PERSONAL TRAINING</small>
          </div>
        </div>

        <div className="profile-mini">
          <div className="avatar">
            {activeUser.name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <b>{activeUser.name}</b>
            <small>{activeUser.email}</small>
          </div>
        </div>

        <nav>
          {nav.map(([label, Icon]) => (
            <button
              key={label}
              className={
                tab === label ? "nav-item active" : "nav-item"
              }
              onClick={() => setTab(label)}
            >
              <Icon size={18} />
              {label}
              {label === "Weekly Plan" && (
                <span className="nav-count">{plans.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <span className="status-dot" />
          API connected
          <small>Authenticated · JSON storage</small>
          <button
            className="switch-profile"
            onClick={handleLogout}
          >
            Log out
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">TRAINING WORKSPACE</p>
            <h1>{tab}</h1>
          </div>

          <div className="top-right">
            <span className="today">
              {new Date().toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
            <div className="avatar">
              {activeUser.name.slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>

        {error && (
          <div className="alert error">
            {error}
            <button onClick={() => setError("")}>×</button>
          </div>
        )}

        {notice && (
          <div className="alert success">
            {notice}
            <button onClick={() => setNotice("")}>×</button>
          </div>
        )}

        {loading && (
          <p className="muted pad">Loading your training data...</p>
        )}

        {/* Dashboard */}
        {tab === "Dashboard" && (
          <div className="content">
            <section className="hero">
              <div>
                <p className="eyebrow">CONSISTENCY BUILDS RESULTS</p>
                <h2>
                  Show up.
                  <br />
                  <em>Get stronger.</em>
                </h2>
                <p>Your training journey, organized in one place.</p>
                <button
                  className="primary"
                  onClick={() => setTab("Log Workout")}
                >
                  <Dumbbell size={16} /> Log a workout
                </button>
              </div>

              <div className="hero-art">
                <div className="hero-ring">
                  <Activity size={62} />
                </div>
                <span className="art-caption">
                  ONE REP
                  <br />
                  AT A TIME
                </span>
              </div>
            </section>

            <div className="stats-grid">
              <Stat
                label="Plans created"
                value={plans.length}
                icon={CalendarDays}
                sub="Across your week"
              />
              <Stat
                label="Sessions logged"
                value={sessions.length}
                icon={CheckCircle2}
                sub={`${completedThisWeek} this week`}
              />
              <Stat
                label="Current weight"
                value={latestMetric ? `${latestMetric.weight_kg} kg` : "—"}
                icon={Weight}
                sub={
                  latestMetric
                    ? `Recorded ${latestMetric.date}`
                    : "Add a measurement"
                }
              />
              <Stat
                label="Current BMI"
                value={latestMetric?.bmi ?? "—"}
                icon={ChartNoAxesCombined}
                sub="Based on latest entry"
              />
            </div>

            <div className="two-col">
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <p className="eyebrow">YOUR ROUTINE</p>
                    <h3>This week</h3>
                  </div>
                  <button
                    className="text-btn"
                    onClick={() => setTab("Weekly Plan")}
                  >
                    Edit plan ↗
                  </button>
                </div>

                <div className="week-list">
                  {DAYS.map((d, i) => {
                    const plan = plans.find((p) => p.day === d);

                    return (
                      <button
                        className={`week-row ${
                          d === day ? "selected" : ""
                        }`}
                        key={d}
                        onClick={() => {
                          setDay(d);
                          setTab("Weekly Plan");
                        }}
                      >
                        <span className="day-index">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="week-day">{d}</span>
                        <span className="week-exercise">
                          {plan
                            ? `${plan.exercises.length} exercises · ${plan.title}`
                            : "Rest / no plan"}
                        </span>
                        <span className={plan ? "plan-dot" : "empty-dot"} />
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <div>
                    <p className="eyebrow">BODY METRICS</p>
                    <h3>Weight trend</h3>
                  </div>
                  <button
                    className="icon-btn"
                    onClick={() => setTab("BMI & Weight")}
                  >
                    <ChartNoAxesCombined size={18} />
                  </button>
                </div>

                {chartData.length > 1 ? (
                  <div className="chart">
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={chartData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#29333b"
                        />
                        <XAxis
                          dataKey="date"
                          stroke="#87949d"
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="#87949d"
                          tickLine={false}
                          axisLine={false}
                          width={36}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "#151d22",
                            border: "1px solid #344149",
                            borderRadius: 10,
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="weight"
                          name="Weight (kg)"
                          stroke="#b8f36b"
                          strokeWidth={3}
                          dot={{ r: 4, fill: "#b8f36b" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="empty-chart">
                    <ChartNoAxesCombined size={28} />
                    <b>Your progress starts here</b>
                    <span>
                      Record at least two weight entries to see a trend.
                    </span>
                    <button
                      className="text-btn"
                      onClick={() => setTab("BMI & Weight")}
                    >
                      Add body measurement →
                    </button>
                  </div>
                )}
              </section>
            </div>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">RECENT ACTIVITY</p>
                  <h3>Workout history</h3>
                </div>
                <button
                  className="text-btn"
                  onClick={() => setTab("History")}
                >
                  View all ↗
                </button>
              </div>

              {sessions.length ? (
                <div className="history-list">
                  {sessions.slice(0, 4).map((session) => (
                    <div className="history-row" key={session.id}>
                      <div className="history-icon">
                        <Dumbbell size={18} />
                      </div>
                      <div className="history-info">
                        <b>{session.title}</b>
                        <small>
                          {session.date} · {session.exercises.length} exercises
                        </small>
                      </div>
                      <span className="tag">Completed</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted pad">
                  No sessions yet. Save your first workout from Log Workout.
                </p>
              )}
            </section>
          </div>
        )}

        {/* Weekly Plan */}
        {tab === "Weekly Plan" && (
          <div className="content">
            <div className="section-intro">
              <div>
                <p className="eyebrow">PLAN YOUR TRAINING</p>
                <h2>Your week, your rules.</h2>
                <p className="muted">
                  Select a day, add exercises and save your plan.
                </p>
              </div>
              <span className="tag">{plans.length}/7 days planned</span>
            </div>

            <div className="day-tabs">
              {DAYS.map((d, i) => (
                <button
                  key={d}
                  className={day === d ? "day-tab active" : "day-tab"}
                  onClick={() => setDay(d)}
                >
                  <small>{d.slice(0, 3).toUpperCase()}</small>
                  <b>{String(i + 1).padStart(2, "0")}</b>
                  <span
                    className={
                      plans.some((p) => p.day === d)
                        ? "day-indicator on"
                        : "day-indicator"
                    }
                  />
                </button>
              ))}
            </div>

            <form className="panel plan-editor" onSubmit={savePlan}>
              <div className="panel-head">
                <div>
                  <p className="eyebrow">{day.toUpperCase()}</p>
                  <h3>Workout details</h3>
                </div>

                {activePlan && (
                  <button
                    type="button"
                    className="danger-ghost"
                    onClick={removePlan}
                  >
                    <Trash2 size={15} /> Delete plan
                  </button>
                )}
              </div>

              <Field
                label="Workout title"
                value={planTitle}
                onChange={(e) => setPlanTitle(e.target.value)}
                placeholder="e.g. Chest & Triceps"
                required
              />

              <div className="exercise-head">
                <h4>
                  Exercises <span>{exercises.length}</span>
                </h4>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setExercises((prev) => [...prev, blankExercise()])
                  }
                >
                  <Plus size={15} /> Add exercise
                </button>
              </div>

              {exercises.map((exercise, i) => (
                <div className="exercise-card" key={i}>
                  <div className="exercise-card-top">
                    <span className="exercise-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>

                    <Field
                      label="Exercise name"
                      value={exercise.name}
                      onChange={(e) =>
                        updateExercise(i, "name", e.target.value)
                      }
                      placeholder="e.g. Bench press"
                      required
                    />

                    <button
                      type="button"
                      className="icon-btn danger"
                      aria-label="Remove exercise"
                      onClick={() =>
                        setExercises((prev) =>
                          prev.filter((_, j) => j !== i)
                        )
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="exercise-fields">
                    <label className="field">
                      <span>Muscle group</span>
                      <select
                        value={exercise.muscle_group}
                        onChange={(e) =>
                          updateExercise(i, "muscle_group", e.target.value)
                        }
                      >
                        {[
                          "Chest",
                          "Back",
                          "Shoulders",
                          "Biceps",
                          "Triceps",
                          "Legs",
                          "Glutes",
                          "Abs",
                          "Full body",
                          "Cardio",
                          "General",
                        ].map((muscle) => (
                          <option key={muscle}>{muscle}</option>
                        ))}
                      </select>
                    </label>

                    <Field
                      label="Sets"
                      type="number"
                      min="1"
                      max="20"
                      value={exercise.sets}
                      onChange={(e) =>
                        updateExercise(i, "sets", e.target.value)
                      }
                    />

                    <Field
                      label="Reps"
                      type="number"
                      min="1"
                      max="100"
                      value={exercise.reps}
                      onChange={(e) =>
                        updateExercise(i, "reps", e.target.value)
                      }
                    />

                    <Field
                      label="Target weight (kg)"
                      type="number"
                      min="0"
                      step="0.5"
                      value={exercise.target_weight_kg}
                      onChange={(e) =>
                        updateExercise(i, "target_weight_kg", e.target.value)
                      }
                    />

                    <Field
                      label="Rest (sec)"
                      type="number"
                      min="0"
                      value={exercise.rest_seconds}
                      onChange={(e) =>
                        updateExercise(i, "rest_seconds", e.target.value)
                      }
                    />
                  </div>

                  <Field
                    label="Notes (optional)"
                    value={exercise.notes}
                    onChange={(e) =>
                      updateExercise(i, "notes", e.target.value)
                    }
                    placeholder="Technique cues, equipment, etc."
                  />
                </div>
              ))}

              <div className="form-actions">
                <span className="muted">
                  Only exercises with a name are saved.
                </span>
                <button className="primary" type="submit">
                  <Save size={16} /> Save {day} plan
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Log Workout */}
        {tab === "Log Workout" && (
          <div className="content">
            <div className="section-intro">
              <div>
                <p className="eyebrow">RECORD THE WORK</p>
                <h2>Every rep counts.</h2>
                <p className="muted">
                  Log actual performance to build your training history.
                </p>
              </div>
            </div>

            <form className="panel log-form" onSubmit={logWorkout}>
              <div className="form-grid">
                <label className="field">
                  <span>Workout plan</span>
                  <select
                    value={logPlan}
                    onChange={(e) => {
                      setLogPlan(e.target.value);
                      setLogSets({});
                    }}
                    required
                  >
                    <option value="">Choose a saved plan</option>
                    {plans.map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.day} — {p.title}
                      </option>
                    ))}
                  </select>
                </label>

                <Field
                  label="Workout date"
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  required
                />
              </div>

              {plans
                .find((p) => p.id === logPlan)
                ?.exercises.map((exercise, i) => (
                  <div className="log-exercise" key={exercise.name + i}>
                    <div>
                      <b>{exercise.name}</b>
                      <small>
                        {exercise.muscle_group} · target {exercise.sets} ×{" "}
                        {exercise.reps} · {exercise.target_weight_kg} kg
                      </small>
                    </div>

                    <div className="set-table">
                      <div className="set-header">
                        <span>Set</span>
                        <span>Reps</span>
                        <span>Weight (kg)</span>
                      </div>

                      {Array.from(
                        { length: Number(exercise.sets) || 1 },
                        (_, j) => (
                          <div className="set-row" key={j}>
                            <span>{j + 1}</span>
                            <input
                              aria-label={`${exercise.name} set ${j + 1} reps`}
                              type="number"
                              min="0"
                              value={
                                logSets[`${i}-${j}-reps`] ?? exercise.reps
                              }
                              onChange={(e) =>
                                setLogSets((prev) => ({
                                  ...prev,
                                  [`${i}-${j}-reps`]: e.target.value,
                                }))
                              }
                            />
                            <input
                              aria-label={`${exercise.name} set ${j + 1} weight`}
                              type="number"
                              min="0"
                              step="0.5"
                              value={
                                logSets[`${i}-${j}-weight`] ??
                                exercise.target_weight_kg
                              }
                              onChange={(e) =>
                                setLogSets((prev) => ({
                                  ...prev,
                                  [`${i}-${j}-weight`]: e.target.value,
                                }))
                              }
                            />
                          </div>
                        )
                      )}
                    </div>
                  </div>
                ))}

              <label className="field">
                <span>Session notes</span>
                <textarea
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  placeholder="Energy, form, PRs, how it felt..."
                  rows="3"
                />
              </label>

          <button
            className="primary"
            type="submit"
            disabled={!plans.length || savingWorkout}
          >
            <CheckCircle2 size={16} />
            {savingWorkout ? "Saving workout..." : "Save completed workout"}
          </button>
            </form>
          </div>
        )}

        {/* Workout History */}
        {tab === "History" && (
          <div className="content">
            <div className="section-intro">
              <div>
                <p className="eyebrow">YOUR TRAINING JOURNAL</p>
                <h2>Proof of progress.</h2>
                <p className="muted">
                  Past sessions saved for your account.
                </p>
              </div>
              <span className="tag">{sessions.length} sessions</span>
            </div>

            {sessions.length ? (
              <div className="history-list large">
                {sessions.map((session) => (
                  <article
                    className="panel history-entry"
                    key={session.id}
                  >
                    <div className="history-row">
                      <div className="history-icon">
                        <Dumbbell size={18} />
                      </div>
                      <div className="history-info">
                        <b>{session.title}</b>
                        <small>
                          {session.date}
                          {session.notes ? ` · ${session.notes}` : ""}
                        </small>
                      </div>
                      <span className="tag">Completed</span>
                    </div>

                    <div className="history-exercises">
                      {session.exercises.map((exercise, i) => (
                        <div className="logged-exercise" key={i}>
                          <div>
                            <b>{exercise.name}</b>
                            <small>{exercise.muscle_group}</small>
                          </div>

                          <div className="logged-sets">
                            {(exercise.sets || []).map((set, j) => (
                              <span key={j}>
                                S{set.set_number}: {set.reps} ×{" "}
                                {set.weight_kg} kg
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="panel empty-state">
                <History size={32} />
                <h3>No workout history yet</h3>
                <p>Save a workout to see it here.</p>
                <button
                  className="primary"
                  onClick={() => setTab("Log Workout")}
                >
                  Log first workout
                </button>
              </div>
            )}
          </div>
        )}

        {/* BMI and Weight */}
        {tab === "BMI & Weight" && (
          <div className="content">
            <div className="section-intro">
              <div>
                <p className="eyebrow">MEASURE WHAT MATTERS</p>
                <h2>Body metrics.</h2>
                <p className="muted">
                  BMI is a screening measure, not a diagnosis or a direct
                  measure of body fat.
                </p>
              </div>
            </div>

            <div className="metrics-grid">
              <section className="panel bmi-panel">
                <p className="eyebrow">BMI CALCULATOR</p>
                <h3>Check your baseline</h3>

                <div className="form-grid">
                  <Field
                    label="Height (cm)"
                    type="number"
                    min="1"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="175"
                  />

                  <Field
                    label="Current weight (kg)"
                    type="number"
                    min="1"
                    step="0.1"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="75"
                  />
                </div>

                <div className="bmi-result">
                  <span>Your BMI</span>
                  <strong>
                    {bmi && Number.isFinite(bmi) ? bmi.toFixed(1) : "—"}
                  </strong>
                  <small>
                    {!bmi
                      ? "Enter height and weight"
                      : bmi < 18.5
                        ? "Below standard adult range"
                        : bmi < 25
                          ? "Standard adult range"
                          : bmi < 30
                            ? "Above standard adult range"
                            : "Obesity category (adult BMI)"}
                  </small>
                </div>
              </section>

              <section className="panel">
                <p className="eyebrow">SAVE A MEASUREMENT</p>
                <h3>Track your weight</h3>

                <form onSubmit={saveMetric} className="metric-form">
                  <Field
                    label="Date"
                    type="date"
                    value={metricDate}
                    onChange={(e) => setMetricDate(e.target.value)}
                    required
                  />

                  <Field
                    label="Weight (kg)"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    required
                    placeholder="e.g. 76.5"
                  />

                  <Field
                    label="Height (cm)"
                    type="number"
                    min="1"
                    step="0.1"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    required
                  />

                  <Field
                    label="Notes (optional)"
                    value={metricNotes}
                    onChange={(e) => setMetricNotes(e.target.value)}
                    placeholder="Morning, fasted, etc."
                  />

                  <button className="primary" type="submit">
                    <Save size={16} /> Save measurement
                  </button>
                </form>
              </section>
            </div>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">HISTORICAL DATA</p>
                  <h3>Weight progression</h3>
                </div>

                {latestMetric && (
                  <span className="tag">
                    Latest: {latestMetric.weight_kg} kg
                  </span>
                )}
              </div>

              {chartData.length > 1 ? (
                <div className="chart large-chart">
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={chartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#29333b"
                      />
                      <XAxis
                        dataKey="date"
                        stroke="#87949d"
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#87949d"
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#151d22",
                          border: "1px solid #344149",
                          borderRadius: 10,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="weight"
                        name="Weight (kg)"
                        stroke="#b8f36b"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="bmi"
                        name="BMI"
                        stroke="#6ec9ff"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="muted pad">
                  Add at least two measurements to view a trend chart.
                </p>
              )}

              {metrics.length > 0 && (
                <div className="metric-table">
                  <div className="metric-row metric-header">
                    <span>Date</span>
                    <span>Weight</span>
                    <span>Height</span>
                    <span>BMI</span>
                    <span>Notes</span>
                  </div>

                  {[...metrics].reverse().map((metric) => (
                    <div className="metric-row" key={metric.id}>
                      <span>{metric.date}</span>
                      <b>{metric.weight_kg} kg</b>
                      <span>{metric.height_cm} cm</span>
                      <span>{metric.bmi}</span>
                      <span>{metric.notes || "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        <footer>
          FORM / LOG <span>·</span> Built for consistency, not perfection.
        </footer>
      </main>
    </div>
  );
}
