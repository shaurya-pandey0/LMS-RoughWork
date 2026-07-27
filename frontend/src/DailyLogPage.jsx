import { useState, useRef, useEffect } from 'react';
import './styles/daily-log.css';
import { dailyLogApi } from './lib/api.js';
import Sidebar from './components/Sidebar';
import { useReference, moodDisplay } from './lib/reference.jsx';

/* ── Inline SVG icons for sidebar nav ── */

/* ── Speedometer-style Gauge Component ── */
function Gauge({ value = 0, max = 100 }) {
  const pct = Math.min(Math.max(value / max, 0), 1);

  // Needle angle: 0% → 180° (left), 100% → 0° (right)
  const needleAngleDeg = 180 - pct * 180;
  const needleAngleRad = (needleAngleDeg * Math.PI) / 180;

  // Needle tip position (on the arc, radius ~13 so it sits inside the thick arc)
  const needleLen = 13;
  const cx = 20;
  const cy = 22;
  const tipX = cx + needleLen * Math.cos(needleAngleRad);
  const tipY = cy - needleLen * Math.sin(needleAngleRad);

  return (
    <div className="gauge" title={`${Math.round(pct * 100)}%`}>
      <svg className="gauge__svg" viewBox="0 0 40 26" overflow="visible">
        <defs>
          {/* Gradient from light sand (left) to dark clay (right) */}
          <linearGradient id={`gaugeGrad`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#D9A88E" />
            <stop offset="100%" stopColor="#6E6052" />
          </linearGradient>
        </defs>

        {/* Thick background track arc */}
        <path
          d="M4,22 A16,16 0 0,1 36,22"
          fill="none"
          stroke="var(--sand-200)"
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* Filled progress arc with gradient */}
        <path
          d="M4,22 A16,16 0 0,1 36,22"
          fill="none"
          stroke="url(#gaugeGrad)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={Math.PI * 16}
          strokeDashoffset={Math.PI * 16 * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 500ms ease' }}
        />

        {/* Needle line — tapered from center-bottom to tip */}
        <line
          x1={cx}
          y1={cy}
          x2={tipX}
          y2={tipY}
          stroke="var(--clay-700)"
          strokeWidth="1.8"
          strokeLinecap="round"
          style={{ transition: 'x2 500ms ease, y2 500ms ease' }}
        />

        {/* Center pivot dot */}
        <circle cx={cx} cy={cy} r="2" fill="var(--clay-700)" />
      </svg>
    </div>
  );
}

/* ── Default data ── */
const DEFAULT_MEALS = [
  { id: 1, name: 'Breakfast', items: ['Oatmeal'] },
  { id: 2, name: 'Lunch', items: ['Chicken Salad'] },
  { id: 3, name: 'Dinner', items: ['Fish Taco'] },
  { id: 4, name: 'Snacks', items: ['Fruit'] },
];

/* Habit catalogs and mood vocabulary come from the backend
   (/api/reference) — see lib/reference.jsx. */

/* Mood <option> list built from the backend vocabulary. */
function MoodOptions({ moods }) {
  return (
    <>
      <option value="">Select mood…</option>
      {moods.map((m) => {
        const { emoji, label } = moodDisplay(m);
        return <option key={m} value={m}>{emoji} {label}</option>;
      })}
    </>
  );
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function checklistFromList(list) {
  // Convert the API's flat list of habit names into the page's
  // { habitName: true } shape used by the checkboxes.
  if (!Array.isArray(list)) return {};
  return Object.fromEntries(list.map((h) => [h, true]));
}

function listFromChecklist(checked) {
  return Object.entries(checked).filter(([, v]) => v).map(([k]) => k);
}


export default function DailyLogPage() {
  const { transactionalHabits, embeddedHabits, dailyMoods } = useReference();

  /* Activity Metrics */
  const [sleepHours, setSleepHours] = useState('');
  const [stepTarget, setStepTarget] = useState('');
  const [waterIntake, setWaterIntake] = useState('');

  /* Transactional habits */
  const [transChecked, setTransChecked] = useState({});

  /* Embedded habits */
  const [embeddedChecked, setEmbeddedChecked] = useState({});

  /* Meals */
  const [meals, setMeals] = useState(DEFAULT_MEALS);
  const [addingTo, setAddingTo] = useState(null); // meal id being edited
  const [newItemText, setNewItemText] = useState('');
  const addInputRef = useRef(null);

  /* Moods — empty means "not set"; valid values come from the backend. */
  const [morningMood, setMorningMood] = useState('');
  const [afternoonMood, setAfternoonMood] = useState('');
  const [eveningMood, setEveningMood] = useState('');

  /* Persistence */
  const [logId, setLogId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveOk, setSaveOk] = useState(false);

  // Load today's existing log (if any) so the form edits rather than overwrites.
  // The backend resolves "today" for us — no need to download every log.
  useEffect(() => {
    let cancelled = false;
    dailyLogApi.today()
      .then((todays) => {
        if (cancelled) return;
        if (todays) {
          setLogId(todays.id);
          if (todays.sleepHours != null) setSleepHours(String(todays.sleepHours));
          if (todays.stepTarget != null) setStepTarget(String(todays.stepTarget));
          if (todays.waterIntake != null) setWaterIntake(String(todays.waterIntake));
          setTransChecked(checklistFromList(todays.transactionalHabits));
          setEmbeddedChecked(checklistFromList(todays.embeddedHabits));
          if (Array.isArray(todays.meals) && todays.meals.length) {
            setMeals(todays.meals.map((m, idx) => ({
              id: idx + 1,
              name: m.name,
              items: Array.isArray(m.items) ? m.items : [],
            })));
          }
          if (todays.morningMood) setMorningMood(todays.morningMood);
          if (todays.afternoonMood) setAfternoonMood(todays.afternoonMood);
          if (todays.eveningMood) setEveningMood(todays.eveningMood);
        }
      })
      .catch((err) => { if (!cancelled) setSaveError(err.message || 'Could not load today’s log'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    if (saving) return;
    setSaveError('');
    setSaveOk(false);
    setSaving(true);
    const payload = {
      date: todayIso(),
      sleepHours: sleepHours === '' ? null : parseFloat(sleepHours),
      stepTarget: stepTarget === '' ? null : parseInt(stepTarget, 10),
      waterIntake: waterIntake === '' ? null : parseFloat(waterIntake),
      transactionalHabits: listFromChecklist(transChecked),
      embeddedHabits: listFromChecklist(embeddedChecked),
      meals: meals.map((m) => ({ name: m.name, items: m.items })),
      morningMood: morningMood || null,
      afternoonMood: afternoonMood || null,
      eveningMood: eveningMood || null,
    };
    try {
      // POST is upsert-by-date on the backend, so a single call works whether
      // today's log exists yet or not.
      const saved = await dailyLogApi.upsert(payload);
      setLogId(saved.id);
      setSaveOk(true);
    } catch (err) {
      setSaveError(err.message || 'Could not save today’s log');
    } finally {
      setSaving(false);
    }
  };

  /* ── Handlers ── */

  const toggleTrans = (habit) => {
    setTransChecked((prev) => ({ ...prev, [habit]: !prev[habit] }));
  };

  const toggleEmbedded = (habit) => {
    setEmbeddedChecked((prev) => ({ ...prev, [habit]: !prev[habit] }));
  };

  const addMealItem = (mealId) => {
    if (!newItemText.trim()) return;
    setMeals((prev) =>
      prev.map((m) =>
        m.id === mealId ? { ...m, items: [...m.items, newItemText.trim()] } : m
      )
    );
    setNewItemText('');
    setAddingTo(null);
  };

  const removeMealItem = (mealId, idx) => {
    setMeals((prev) =>
      prev.map((m) =>
        m.id === mealId ? { ...m, items: m.items.filter((_, i) => i !== idx) } : m
      )
    );
  };

  const startAdding = (mealId) => {
    setAddingTo(mealId);
    setNewItemText('');
    setTimeout(() => addInputRef.current?.focus(), 50);
  };

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <Sidebar active="daily-log" />

      {/* ── Main Content ── */}
      <main className="app-main">
        <div className="app-main__content">
          {/* Page Header */}
          <header className="daily-log__header">
            <h1 className="daily-log__title" id="daily-log-page-title">
              Daily Log Page: Commit to Balance
            </h1>
          </header>

          {/* Three-column layout */}
          <div className="daily-log__grid">

            {/* ── Column 1: Activity Metrics + Transactional ── */}
            <div className="card" id="card-activity-metrics">
              <h2 className="daily-log-card__title">Today's Activity Metrics</h2>

              {/* Sleep Hours */}
              <div className="metric-row">
                <div className="metric-row__input-group">
                  <label className="metric-row__label" htmlFor="sleep-hours">
                    Sleep Hours (Last Night)
                  </label>
                  <input
                    type="number"
                    id="sleep-hours"
                    className="metric-row__input"
                    placeholder="hours"
                    min="0"
                    max="24"
                    step="0.5"
                    value={sleepHours}
                    onChange={(e) => setSleepHours(e.target.value)}
                  />
                </div>
                <Gauge value={sleepHours ? parseFloat(sleepHours) : 0} max={10} />
              </div>

              {/* Step Target */}
              <div className="metric-row">
                <div className="metric-row__input-group">
                  <label className="metric-row__label" htmlFor="step-target">
                    Step Target (Daily Goal)
                  </label>
                  <input
                    type="number"
                    id="step-target"
                    className="metric-row__input"
                    placeholder="steps"
                    min="0"
                    value={stepTarget}
                    onChange={(e) => setStepTarget(e.target.value)}
                  />
                </div>
                <Gauge value={stepTarget ? parseFloat(stepTarget) : 0} max={15000} />
              </div>

              {/* Water Intake */}
              <div className="metric-row">
                <div className="metric-row__input-group">
                  <label className="metric-row__label" htmlFor="water-intake">
                    Water Intake
                  </label>
                  <input
                    type="number"
                    id="water-intake"
                    className="metric-row__input"
                    placeholder="ml/oz"
                    min="0"
                    value={waterIntake}
                    onChange={(e) => setWaterIntake(e.target.value)}
                  />
                </div>
              </div>

              {/* Transactional Habits */}
              <h3 className="daily-log-card__section-title">Transactional</h3>
              <div className="checklist" id="transactional-checklist">
                {transactionalHabits.map((habit) => (
                  <label
                    key={habit}
                    className={`checklist__item ${transChecked[habit] ? 'checklist__item--checked' : ''}`}
                  >
                    <input
                      type="checkbox"
                      className="checklist__checkbox"
                      checked={!!transChecked[habit]}
                      onChange={() => toggleTrans(habit)}
                    />
                    <span className="checklist__label">{habit}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* ── Column 2: Today's Meal Log ── */}
            <div className="card" id="card-meal-log">
              <h2 className="daily-log-card__title">Today's Meal Log</h2>

              <div className="meal-section">
                {meals.map((meal) => (
                  <div className="meal-card" key={meal.id}>
                    <div className="meal-card__name">{meal.name}</div>
                    <div className="meal-card__items">
                      {meal.items.map((item, idx) => (
                        <div className="meal-card__item" key={idx}>
                          <span className="meal-card__item-text">{item}</span>
                          <button
                            className="meal-card__remove-btn"
                            onClick={() => removeMealItem(meal.id, idx)}
                            title="Remove item"
                            aria-label={`Remove ${item}`}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>

                    {addingTo === meal.id ? (
                      <div className="meal-card__add-row">
                        <input
                          ref={addInputRef}
                          type="text"
                          className="meal-card__add-input"
                          placeholder="Item name…"
                          value={newItemText}
                          onChange={(e) => setNewItemText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') addMealItem(meal.id);
                            if (e.key === 'Escape') setAddingTo(null);
                          }}
                        />
                        <button
                          className="meal-card__add-confirm"
                          onClick={() => addMealItem(meal.id)}
                        >
                          Add
                        </button>
                      </div>
                    ) : (
                      <button
                        className="meal-card__add"
                        onClick={() => startAdding(meal.id)}
                      >
                        Add {meal.name === 'Snacks' ? 'Item' : 'meal Item'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Column 3: Embedded Habits + Mood ── */}
            <div className="daily-log__right-stack">
              {/* Embedded Habits */}
              <div className="card" id="card-embedded-habits">
                <h2 className="daily-log-card__title">Embedded Habits</h2>
                <div className="checklist" id="embedded-checklist">
                  {embeddedHabits.map((habit) => (
                    <label
                      key={habit}
                      className={`checklist__item ${embeddedChecked[habit] ? 'checklist__item--checked' : ''}`}
                    >
                      <input
                        type="checkbox"
                        className="checklist__checkbox"
                        checked={!!embeddedChecked[habit]}
                        onChange={() => toggleEmbedded(habit)}
                      />
                      <span className="checklist__label">{habit}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Daily Mood Parameters */}
              <div className="card" id="card-mood-parameters">
                <h2 className="daily-log-card__title">Daily Mood Parameters</h2>
                <div className="mood-group">
                  <div className="mood-item">
                    <label className="mood-item__label" htmlFor="morning-mood">Morning Mood</label>
                    <select
                      id="morning-mood"
                      className="mood-item__select"
                      value={morningMood}
                      onChange={(e) => setMorningMood(e.target.value)}
                    >
                      <MoodOptions moods={dailyMoods} />
                    </select>
                  </div>
                  <div className="mood-item">
                    <label className="mood-item__label" htmlFor="afternoon-mood">Afternoon Mood</label>
                    <select
                      id="afternoon-mood"
                      className="mood-item__select"
                      value={afternoonMood}
                      onChange={(e) => setAfternoonMood(e.target.value)}
                    >
                      <MoodOptions moods={dailyMoods} />
                    </select>
                  </div>
                  <div className="mood-item">
                    <label className="mood-item__label" htmlFor="evening-mood">Evening Mood</label>
                    <select
                      id="evening-mood"
                      className="mood-item__select"
                      value={eveningMood}
                      onChange={(e) => setEveningMood(e.target.value)}
                    >
                      <MoodOptions moods={dailyMoods} />
                    </select>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Save bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-5)', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn--primary"
              id="btn-save-daily-log"
              onClick={handleSave}
              disabled={saving || loading}
            >
              {saving ? 'Saving…' : (logId ? 'Update Today’s Log' : 'Save Today’s Log')}
            </button>
            {loading && <span className="text-sm text-secondary">Loading today’s log…</span>}
            {saveOk && (
              <span className="form-helper" style={{ color: 'var(--sage-700, var(--sage-500))' }}>
                Saved.
              </span>
            )}
            {saveError && (
              <span role="alert" className="form-helper form-helper--error">{saveError}</span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
