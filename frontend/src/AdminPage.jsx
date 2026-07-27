import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import './styles/admin.css';
import { adminApi } from './lib/api.js';
import { useAuth } from './lib/auth.jsx';

/* ── Admin sidebar nav ── */
const ADMIN_NAV = [
  {
    id: 'stats', label: 'System Statistics',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="10" width="3" height="8" rx="1" /><rect x="8.5" y="5" width="3" height="13" rx="1" /><rect x="15" y="2" width="3" height="16" rx="1" />
      </svg>
    ),
  },
  {
    id: 'users', label: 'Active Users',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="7" cy="7" r="3" /><path d="M2 17c0-2.8 2.2-5 5-5s5 2.2 5 5" /><path d="M14 4.5a3 3 0 010 5.8M14.5 12c2.2.3 3.5 2.3 3.5 5" />
      </svg>
    ),
  },
  {
    id: 'trends', label: 'Aggregated Trends',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="2 13 7 8 11 11 18 4" /><polyline points="13 4 18 4 18 9" />
      </svg>
    ),
  },
];

/* ── Speedometer gauge ── */
function StatGauge({ pct, color }) {
  const cx = 32, cy = 34, r = 26;
  const circ = Math.PI * r;
  const dash = (pct / 100) * circ;
  const angle = Math.PI - (pct / 100) * Math.PI;
  const nx = cx + (r - 4) * Math.cos(angle);
  const ny = cy - (r - 4) * Math.sin(angle);
  return (
    <svg width="64" height="44" viewBox="0 0 64 44">
      <path d={`M6,34 A${r},${r} 0 0,1 58,34`} fill="none" stroke="var(--sand-200)" strokeWidth="6" strokeLinecap="round" />
      <path d={`M6,34 A${r},${r} 0 0,1 58,34`} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`} />
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--clay-700)" strokeWidth="2" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="3" fill="var(--clay-700)" />
    </svg>
  );
}

/* ── Bar chart (system step distribution) ── */
function seeded(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

function StepDistChart() {
  const rand = seeded(91);
  const bars = Array.from({ length: 22 }, () => Math.round(20000 + rand() * 90000));
  const max = 110000;
  const palette = ['#7E9469', '#A9B894', '#D2C4B4', '#B5734F'];
  const yLabels = ['0', '10k', '20k', '40k', '60k', '80k', '100k', '110k+'];
  return (
    <div className="chart-area">
      <div className="chart-yaxis">{yLabels.map((l) => <span key={l}>{l}</span>)}</div>
      <div className="chart-plot">
        <div className="chart-bars" style={{ height: 220 }}>
          {[0, 25, 50, 75, 100].map((p) => <div key={p} className="chart-gridline" style={{ bottom: `${p}%` }} />)}
          {bars.map((v, i) => (
            <div key={i} className="chart-bar" style={{ height: `${(v / max) * 100}%`, background: palette[i % palette.length] }}
              title={`${v.toLocaleString()} steps`} />
          ))}
        </div>
        <div className="chart-xaxis">
          {bars.map((_, i) => <span key={i}>{i % 3 === 0 ? `D${i + 1}` : ''}</span>)}
        </div>
      </div>
    </div>
  );
}

/* ── Multi-series velocity (area lines) ── */
function VelocityChart() {
  const W = 440, H = 180;
  const series = [
    { color: '#7E9469', fill: 'rgba(126,148,105,0.18)', pts: [60, 50, 45, 70, 95, 110, 80, 65, 90] },
    { color: '#A9B894', fill: 'rgba(169,184,148,0.16)', pts: [40, 55, 60, 50, 65, 72, 60, 70, 100] },
    { color: '#B5734F', fill: 'rgba(181,115,79,0.14)', pts: [30, 35, 32, 40, 45, 42, 38, 48, 52] },
  ];
  const maxV = 120;
  const toPath = (pts, close) => {
    const stepX = W / (pts.length - 1);
    const coords = pts.map((v, i) => [i * stepX, H - (v / maxV) * (H - 16) - 8]);
    let d = coords.map((p, i) => {
      if (i === 0) return `M ${p[0]},${p[1]}`;
      const prev = coords[i - 1];
      const cx = (prev[0] + p[0]) / 2;
      return `C ${cx},${prev[1]} ${cx},${p[1]} ${p[0]},${p[1]}`;
    }).join(' ');
    if (close) d += ` L ${W},${H} L 0,${H} Z`;
    return { d, coords };
  };

  return (
    <div>
      <div className="chart-area">
        <div className="chart-yaxis" style={{ paddingBottom: 4 }}>
          {['$0', '$10k', '$20k', '$30k', '$40k+'].map((l) => <span key={l}>{l}</span>)}
        </div>
        <div className="chart-plot" style={{ position: 'relative' }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="180" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
            {[0, 25, 50, 75, 100].map((p) => (
              <line key={p} x1="0" x2={W} y1={H - (p / 100) * (H - 16) - 8} y2={H - (p / 100) * (H - 16) - 8}
                stroke="var(--sand-200)" strokeWidth="1" strokeDasharray="4 4" />
            ))}
            {series.map((s, i) => {
              const { d } = toPath(s.pts, true);
              return <path key={`a${i}`} d={d} fill={s.fill} />;
            })}
            {series.map((s, i) => {
              const { d } = toPath(s.pts, false);
              return <path key={`l${i}`} d={d} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" />;
            })}
            {/* annotated points */}
            {(() => {
              const { coords } = toPath(series[0].pts, false);
              return (
                <>
                  <circle cx={coords[3][0]} cy={coords[3][1]} r="4" fill="#B5734F" stroke="#fff" strokeWidth="2" />
                  <circle cx={coords[5][0]} cy={coords[5][1]} r="4" fill="#B5734F" stroke="#fff" strokeWidth="2" />
                </>
              );
            })()}
          </svg>
        </div>
      </div>
      <div className="chart-legend">
        <div className="chart-legend__item"><span className="chart-legend__dot" style={{ background: '#7E9469' }} />Food</div>
        <div className="chart-legend__item"><span className="chart-legend__dot" style={{ background: '#B5734F' }} />Travel</div>
        <div className="chart-legend__item"><span className="chart-legend__dot" style={{ background: '#A9B894' }} />Wellness</div>
      </div>
    </div>
  );
}

/* ── Donut ── */
function DonutChart({ segments }) {
  const r = 48, cx = 62, cy = 62, strokeW = 20;
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
    <svg width="140" height="140" viewBox="0 0 124 124">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--sand-100)" strokeWidth={strokeW} />
      {arcs.map((seg, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={strokeW}
          strokeDasharray={`${Math.max(seg.len - 2, 0)} ${circ - seg.len + 2}`}
          strokeDashoffset={-seg.offset + circ * 0.25} strokeLinecap="butt" />
      ))}
    </svg>
  );
}

const FUNNEL = [
  { label: 'Steps',      value: 30, color: '#D2C4B4' },
  { label: 'Meditation', value: 29, color: '#7E9469' },
  { label: 'Journaling', value: 20, color: '#B5734F' },
  { label: 'Banking',    value: 11, color: '#A9B894' },
  { label: 'Hydration',  value: 10, color: '#5E7050' },
];

const STAT_CARDS = [
  { label: 'Total Users',       value: '12,450', pct: 78, color: 'var(--clay-500)' },
  { label: 'Daily Active Users', value: '8,720', pct: 64, color: 'var(--clay-500)' },
  { label: 'Weekly Sign-ups',     value: '654',  pct: 42, color: 'var(--clay-500)' },
];

export default function AdminPage() {
  const { user, logout } = useAuth();
  const [activeNav, setActiveNav] = useState('stats');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([adminApi.stats(), adminApi.users()])
      .then(([s, u]) => {
        if (cancelled) return;
        if (s.status === 'fulfilled') setStats(s.value);
        else setError(s.reason?.message || 'Could not load admin stats');
        if (u.status === 'fulfilled') setUsers(u.value || []);
      });
    return () => { cancelled = true; };
  }, []);

  const statCards = useMemo(() => {
    if (!stats) return STAT_CARDS;
    return [
      { label: 'Total Users',    value: String(stats.totalUsers ?? 0),         pct: 78, color: 'var(--clay-500)' },
      { label: 'Daily Logs',     value: String(stats.totalDailyLogs ?? 0),     pct: 64, color: 'var(--clay-500)' },
      { label: 'Journal Entries', value: String(stats.totalJournalEntries ?? 0), pct: 42, color: 'var(--clay-500)' },
    ];
  }, [stats]);

  const adminName = user?.fullName || 'Admin';
  const adminInitials = (adminName.match(/\b[A-Za-z]/g) || []).slice(0, 2).join('').toUpperCase() || 'A';

  const funnelTotal = FUNNEL.reduce((s, x) => s + x.value, 0);

  return (
    <div className="app-shell" data-screen-label="Admin">
      <div className="botanical-overlay" />

      {/* ── Admin Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar__header">
          <Link to="/" className="sidebar__logo">
            <svg className="sidebar__logo-mark" width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <path d="M16 2C14 8 8 14 4 18C8 17 12 18 14 22C14 18 16 12 22 6C20 8 18 6 16 2Z" fill="#241F1A" />
            </svg>
            <span className="sidebar__logo-text">LifeTrack</span>
          </Link>
        </div>

        <nav className="sidebar__nav" aria-label="Admin navigation">
          <ul className="sidebar__nav-list">
            {ADMIN_NAV.map((item) => (
              <li key={item.id}>
                <button
                  className={`sidebar__nav-item${activeNav === item.id ? ' sidebar__nav-item--active' : ''}`}
                  onClick={() => setActiveNav(item.id)}
                  style={{ width: '100%', background: activeNav === item.id ? undefined : 'none', border: 'none', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}
                >
                  <span className="sidebar__nav-icon">{item.icon}</span>
                  <span className="sidebar__nav-label">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar__user">
          <div className="sidebar__avatar sidebar__avatar--fallback">{adminInitials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sidebar__username" title={adminName}>{adminName}</div>
            <div className="admin-sidebar__role">Administrator</div>
          </div>
          <button
            type="button"
            onClick={logout}
            aria-label="Sign out"
            title="Sign out"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--taupe-500)', padding: 'var(--space-1)', display: 'inline-flex', alignItems: 'center' }}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4h3a1 1 0 011 1v10a1 1 0 01-1 1h-3" />
              <path d="M9 14l-4-4 4-4" />
              <path d="M5 10h10" />
            </svg>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="app-main">
        <div className="app-main__content">
          <div className="admin__header">
            <h1 className="admin__title">Admin Dashboard</h1>
          </div>
          {error && (
            <div role="alert" className="form-helper form-helper--error" style={{ marginBottom: 'var(--space-3)' }}>
              {error}
            </div>
          )}

          {/* Stat cards */}
          <div className="admin__stats">
            {statCards.map((s) => (
              <div className="card stat-card" key={s.label}>
                <StatGauge pct={s.pct} color={s.color} />
                <div>
                  <div className="stat-card__label">{s.label}</div>
                  <div className="stat-card__value">{s.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Content grid */}
          <div className="admin__grid">
            <div className="admin__col">
              <section className="card" id="card-step-distribution">
                <h2 className="admin-card__title">Global Population Step Distribution (Last 30 Days)</h2>
                <StepDistChart />
              </section>
            </div>

            <div className="admin__col">
              <section className="card" id="card-velocity">
                <h2 className="admin-card__title">System Financial Velocity Vectors (Weekly)</h2>
                <VelocityChart />
              </section>

              <section className="card" id="card-funnel">
                <h2 className="admin-card__title">Top Habit Completion Funnel</h2>
                <div className="funnel-row">
                  <DonutChart segments={FUNNEL} />
                  <div className="funnel-legend">
                    {FUNNEL.map((f) => (
                      <div className="funnel-legend__item" key={f.label}>
                        <span className="funnel-legend__dot" style={{ background: f.color }} />
                        {f.label}
                        <span className="funnel-legend__pct">{Math.round((f.value / funnelTotal) * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          </div>

          {/* Active Users (live from /api/admin/users) */}
          <section className="card" id="card-users" style={{ marginTop: 'var(--space-5)' }}>
            <h2 className="admin-card__title">Active Users ({users.length})</h2>
            {users.length === 0 ? (
              <div className="txn-empty">No users yet.</div>
            ) : (
              <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 120px', gap: 'var(--space-3)', padding: '0 var(--space-3)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--taupe-600)' }}>
                  <span>Name</span>
                  <span>Email</span>
                  <span>Role</span>
                </div>
                {users.map((u) => (
                  <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 120px', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', background: 'var(--sand-50)', borderRadius: 'var(--radius-md)', alignItems: 'center' }}>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>{u.fullName}</span>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--taupe-600)' }}>{u.email}</span>
                    <span>
                      <span className={`chip ${u.role === 'ADMIN' ? 'chip--clay' : 'chip--sage'}`} style={{ fontSize: 'var(--text-xs)' }}>{u.role}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
