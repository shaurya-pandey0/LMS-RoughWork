import { useState, useMemo, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import './styles/analytics.css';
import { analyticsApi } from './lib/api.js';

/* ── Deterministic pseudo-random so charts are stable ── */
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/* ── Bar chart (single series) ── */
function BarChart({ data, yLabels, colorA, colorB }) {
  const max = Math.max(...data.map((d) => d.value));
  return (
    <div className="chart-area">
      <div className="chart-yaxis">
        {yLabels.map((l) => <span key={l}>{l}</span>)}
      </div>
      <div className="chart-plot">
        <div className="chart-bars">
          {[0, 25, 50, 75, 100].map((p) => (
            <div key={p} className="chart-gridline" style={{ bottom: `${p}%` }} />
          ))}
          {data.map((d, i) => (
            <div
              key={i}
              className="chart-bar"
              style={{ height: `${(d.value / max) * 100}%`, background: i % 3 === 0 ? colorA : colorB }}
              title={`${d.label}: ${d.value.toLocaleString()}`}
            />
          ))}
        </div>
        <div className="chart-xaxis">
          {data.map((d, i) => <span key={i}>{i % 3 === 0 ? d.label : ''}</span>)}
        </div>
      </div>
    </div>
  );
}

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

/* ── Donut chart ── */
function DonutChart({ segments }) {
  const r = 50, cx = 65, cy = 65, strokeW = 22;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const arcs = [];
  let offset = 0;
  for (const seg of segments) {
    const len = (seg.value / total) * circ;
    arcs.push({ ...seg, len, offset });
    offset += len;
  }
  return (
    <svg width="150" height="150" viewBox="0 0 130 130">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--sand-100)" strokeWidth={strokeW} />
      {arcs.map((seg, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={strokeW}
          strokeDasharray={`${Math.max(seg.len - 2, 0)} ${circ - seg.len + 2}`}
          strokeDashoffset={-seg.offset + circ * 0.25} strokeLinecap="butt" />
      ))}
    </svg>
  );
}

/* ── Grouped bar chart ── */
function GroupedBarChart({ groups, series, yLabels }) {
  const max = Math.max(...groups.flatMap((g) => g.values));
  return (
    <div className="chart-area">
      <div className="chart-yaxis">{yLabels.map((l) => <span key={l}>{l}</span>)}</div>
      <div className="chart-plot">
        <div className="chart-bars">
          {[0, 25, 50, 75, 100].map((p) => <div key={p} className="chart-gridline" style={{ bottom: `${p}%` }} />)}
          {groups.map((g, gi) => (
            <div className="chart-group" key={gi} title={`Day ${g.label}`}>
              {g.values.map((v, si) => (
                <div key={si} className="chart-group__bar" style={{ height: `${(v / max) * 100}%`, background: series[si].color }} />
              ))}
            </div>
          ))}
        </div>
        <div className="chart-xaxis">
          {groups.map((g, i) => <span key={i}>{i % 3 === 0 ? g.label : ''}</span>)}
        </div>
      </div>
    </div>
  );
}

/* ── Data generators ── */
const RANGES = { 'Last 7 Days': 7, 'Last 30 Days': 30, 'Last 90 Days': 90 };

function buildData(days) {
  const rand = seeded(days * 7 + 13);
  const stepData = Array.from({ length: days }, (_, i) => ({
    label: `D${i + 1}`,
    value: Math.round(40000 + rand() * 70000),
  }));
  const sleepData = Array.from({ length: days }, (_, i) => ({
    label: `D${i + 1}`,
    value: +(6 + rand() * 4).toFixed(1),
  }));
  const expenseSeries = [
    { label: 'Food', color: '#7E9469' },
    { label: 'Travel', color: '#B5734F' },
    { label: 'Housing', color: '#D2C4B4' },
    { label: 'Wellness', color: '#A9B894' },
  ];
  const expenseGroups = Array.from({ length: Math.min(days, 30) }, (_, i) => ({
    label: `${i + 1}`,
    values: expenseSeries.map(() => Math.round(200 + rand() * 900)),
  }));
  return { stepData, sleepData, expenseSeries, expenseGroups };
}

const HABIT_SEGMENTS = [
  { label: 'Complete',   value: 47, color: '#7E9469' },
  { label: 'Incomplete', value: 27, color: '#D2C4B4' },
  { label: 'Delayed',    value: 26, color: '#B5734F' },
];

export default function AnalyticsPage() {
  const [range, setRange] = useState('Last 30 Days');
  const days = RANGES[range];
  const { stepData, sleepData: mockSleep, expenseSeries, expenseGroups: mockExpenses } = useMemo(() => buildData(days), [days]);

  // Real backend data for the two charts the API can drive.
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState('');

  useEffect(() => {
    let cancelled = false;
    analyticsApi.summary()
      .then((s) => { if (!cancelled) { setSummary(s); setSummaryError(''); } })
      .catch((err) => { if (!cancelled) setSummaryError(err.message || 'Could not load analytics'); });
    return () => { cancelled = true; };
  }, []);

  // Map the backend's weeklySleep into the LineAreaChart's shape.
  const sleepData = useMemo(() => {
    if (!summary?.weeklySleep?.length) return mockSleep;
    return summary.weeklySleep.map((p) => ({
      label: p.date?.slice(5) || '',  // mm-dd
      value: typeof p.hours === 'number' ? p.hours : 0,
    }));
  }, [summary, mockSleep]);

  // For the existing GroupedBarChart we keep the mocked daily breakdown until
  // we add a date-bucketed expense endpoint. Category totals from the summary
  // could be visualised here, but the chart's shape expects per-day groups.
  const expenseGroups = mockExpenses;

  const habitTotal = HABIT_SEGMENTS.reduce((s, x) => s + x.value, 0);

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

          {/* Master date-range filter */}
          <div className="range-bar">
            <span className="range-bar__label">Master Date-Range Filter</span>
            <div className="range-bar__controls">
              <select className="range-bar__select" value={range} onChange={(e) => setRange(e.target.value)} aria-label="Select date range">
                {Object.keys(RANGES).map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          {/* 2×2 chart grid */}
          <div className="analytics__grid">
            {/* Step Frequency */}
            <section className="card" id="card-step-frequency">
              <div className="chart-card__header">
                <h2 className="chart-card__title">Step Frequency Bar Chart</h2>
                <span className="chip chip--clay">Health</span>
              </div>
              <BarChart
                data={stepData}
                yLabels={['0', '20k', '40k', '60k', '80k', '100k', '110k+']}
                colorA="var(--sage-500)"
                colorB="var(--sand-300)"
              />
            </section>

            {/* Sleep Duration */}
            <section className="card" id="card-sleep-duration">
              <div className="chart-card__header">
                <h2 className="chart-card__title">Sleep Duration Line Chart</h2>
                <span className="chip chip--info">Body Analytics</span>
              </div>
              <LineAreaChart
                data={sleepData}
                yLabels={['0 hrs', '2 hrs', '4 hrs', '6 hrs', '8 hrs', '10 hrs', '12 hrs']}
                max={12}
              />
            </section>

            {/* Habit Completion */}
            <section className="card" id="card-habit-completion">
              <div className="chart-card__header">
                <h2 className="chart-card__title">Habit Completion Percentage</h2>
                <span className="chip chip--clay">Mind Analytics</span>
              </div>
              <div className="donut-row">
                <DonutChart segments={HABIT_SEGMENTS} />
                <div className="donut-row__legend">
                  {HABIT_SEGMENTS.map((s) => (
                    <div className="chart-legend__item" key={s.label}>
                      <span className="chart-legend__dot chart-legend__dot--round" style={{ background: s.color }} />
                      {s.label}
                      <span className="chart-legend__pct">{Math.round((s.value / habitTotal) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Expense Comparison */}
            <section className="card" id="card-expense-comparison">
              <div className="chart-card__header">
                <h2 className="chart-card__title">Categorical Expense Comparison</h2>
                <span className="chip chip--clay">Finance Analytics</span>
              </div>
              <GroupedBarChart
                groups={expenseGroups}
                series={expenseSeries}
                yLabels={['$0', '$300', '$600', '$900', '$1k+']}
              />
              <div className="chart-legend">
                {expenseSeries.map((s) => (
                  <div className="chart-legend__item" key={s.label}>
                    <span className="chart-legend__dot" style={{ background: s.color }} />
                    {s.label}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
