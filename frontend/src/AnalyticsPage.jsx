import { useState, useMemo, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import './styles/analytics.css';
import { analyticsApi } from './lib/api.js';

/* ── Line / area chart ── */
function LineAreaChart({ data, yLabels, max }) {
  const W = 460, H = 200, padL = 8, padR = 8, padB = 4;
  const innerW = W - padL - padR;
  const stepX = innerW / (data.length - 1);
  const pts = data.map((d, i) => {
    const x = padL + i * stepX;
    const y = H - padB - (d.value / max) * (H - padB - 8);
    return [x, y];
  });

  // Smooth path (Catmull-Rom → bezier)
  const line = pts.map((p, i) => {
    if (i === 0) return `M ${p[0]},${p[1]}`;
    const prev = pts[i - 1];
    const cx = (prev[0] + p[0]) / 2;
    return `C ${cx},${prev[1]} ${cx},${p[1]} ${p[0]},${p[1]}`;
  }).join(' ');
  const area = `${line} L ${pts[pts.length - 1][0]},${H} L ${pts[0][0]},${H} Z`;

  return (
    <div className="chart-area">
      <div className="chart-yaxis" style={{ paddingBottom: 4 }}>
        {yLabels.map((l) => <span key={l}>{l}</span>)}
      </div>
      <div className="chart-plot">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="200" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
          {[0, 25, 50, 75, 100].map((p) => (
            <line key={p} x1="0" x2={W} y1={H - (p / 100) * (H - padB - 8) - padB} y2={H - (p / 100) * (H - padB - 8) - padB}
              stroke="var(--sand-200)" strokeWidth="1" strokeDasharray="4 4" />
          ))}
          <path d={area} fill="var(--sage-100)" opacity="0.5" />
          <path d={line} fill="none" stroke="var(--sage-500)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {pts.map((p, i) => i % 3 === 0 && (
            <circle key={i} cx={p[0]} cy={p[1]} r="4" fill="var(--clay-500)" stroke="var(--sand-0)" strokeWidth="2" />
          ))}
        </svg>
        <div className="chart-xaxis">
          {data.map((d, i) => <span key={i}>{i % 5 === 0 ? d.label : ''}</span>)}
        </div>
      </div>
    </div>
  );
}

const RANGES = { 'Last 7 Days': 7, 'Last 30 Days': 30, 'Last 90 Days': 90 };

export default function AnalyticsPage() {
  const [range, setRange] = useState('Last 30 Days');

  // Real backend data — the only source of truth for this page.
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');

  useEffect(() => {
    let cancelled = false;
    analyticsApi.summary()
      .then((s) => { if (!cancelled) { setSummary(s); setSummaryError(''); } })
      .catch((err) => { if (!cancelled) setSummaryError(err.message || 'Could not load analytics'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Map the backend's weeklySleep into the LineAreaChart's shape. The current
  // /api/analytics window is a fixed 7 days — the range selector doesn't
  // change this yet, which is why it's disabled below rather than pretending
  // to filter data that was never fetched for that range.
  const sleepData = useMemo(() => {
    if (!summary?.weeklySleep?.length) return [];
    return summary.weeklySleep.map((p) => ({
      label: p.date?.slice(5) || '',  // mm-dd
      value: typeof p.hours === 'number' ? p.hours : 0,
    }));
  }, [summary]);

  return (
    <div className="app-shell" data-screen-label="Analytics">
      <div className="botanical-overlay" />
      <Sidebar active="analytics" />

      <main className="app-main">
        <div className="app-main__content">
          <div className="analytics__header">
            <h1 className="analytics__title">Your Lifestyle Trends &amp; Historical Analytics</h1>
          </div>
          {summaryError && (
            <div role="alert" className="form-helper form-helper--error" style={{ marginBottom: 'var(--space-3)' }}>
              {summaryError}
            </div>
          )}

          {/* Master date-range filter — disabled until the backend supports a
              date-ranged analytics query; showing it as active without wiring
              would misrepresent what's on screen. */}
          <div className="range-bar">
            <span className="range-bar__label">Master Date-Range Filter</span>
            <div className="range-bar__controls">
              <select
                className="range-bar__select"
                value={range}
                onChange={(e) => setRange(e.target.value)}
                aria-label="Select date range (coming soon)"
                disabled
                title="Date-range filtering is not available yet"
              >
                {Object.keys(RANGES).map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          {/* 2×2 chart grid */}
          <div className="analytics__grid">
            {/* Step Frequency — no backend field for actual steps taken yet
                (DailyLog only stores a target), so there's nothing real to
                chart here. */}
            <section className="card" id="card-step-frequency">
              <div className="chart-card__header">
                <h2 className="chart-card__title">Step Frequency Bar Chart</h2>
                <span className="chip chip--clay">Health</span>
              </div>
              <div className="txn-empty">No data available yet.</div>
            </section>

            {/* Sleep Duration — real data from /api/analytics */}
            <section className="card" id="card-sleep-duration">
              <div className="chart-card__header">
                <h2 className="chart-card__title">Sleep Duration Line Chart</h2>
                <span className="chip chip--info">Body Analytics</span>
              </div>
              {loading ? (
                <div className="txn-empty">Loading…</div>
              ) : summaryError ? (
                <div className="txn-empty" role="alert" style={{ color: 'var(--clay-600)' }}>{summaryError}</div>
              ) : sleepData.length === 0 ? (
                <div className="txn-empty">No data available yet.</div>
              ) : (
                <LineAreaChart
                  data={sleepData}
                  yLabels={['0 hrs', '2 hrs', '4 hrs', '6 hrs', '8 hrs', '10 hrs', '12 hrs']}
                  max={12}
                />
              )}
            </section>

            {/* Habit Completion — no backend endpoint computes a completion
                rate against the habit catalog yet. */}
            <section className="card" id="card-habit-completion">
              <div className="chart-card__header">
                <h2 className="chart-card__title">Habit Completion Percentage</h2>
                <span className="chip chip--clay">Mind Analytics</span>
              </div>
              <div className="txn-empty">No data available yet.</div>
            </section>

            {/* Expense Comparison — /api/analytics returns category totals,
                not a per-day breakdown this chart needs, so there's nothing
                real to plot per-day yet. */}
            <section className="card" id="card-expense-comparison">
              <div className="chart-card__header">
                <h2 className="chart-card__title">Categorical Expense Comparison</h2>
                <span className="chip chip--clay">Finance Analytics</span>
              </div>
              <div className="txn-empty">No data available yet.</div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
