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

export default function AnalyticsPage() {
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

          {/* Sleep Duration — the only chart on this page backed by a real
              endpoint (/api/analytics). Step frequency, habit completion, and
              expense comparison were removed: no backend data exists for them. */}
          <div className="analytics__grid">
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
          </div>
        </div>
      </main>
    </div>
  );
}
