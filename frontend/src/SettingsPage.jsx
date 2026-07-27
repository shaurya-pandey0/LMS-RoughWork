import { useState } from 'react';
import Sidebar from './components/Sidebar';
import { useReference } from './lib/reference.jsx';
import { ApiError } from './lib/api.js';

/**
 * Settings page — the 4 fields already persisted via GET/PUT /api/settings.
 * Deliberately narrow: monthly budget + sleep/step/water targets only.
 * No notifications, AI toggles, or profile fields — those don't exist on
 * the backend UserSettings entity and won't be added here.
 */
export default function SettingsPage() {
  const { settings, loading, saveSettings } = useReference();

  const [form, setForm] = useState({
    monthlyBudget: '',
    sleepTargetHours: '',
    stepTarget: '',
    waterTargetMl: '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');

  // Populate the form once settings arrive from the backend. Adjusting state
  // during render (rather than in a useEffect) avoids an extra render pass —
  // this bails out safely because React re-renders immediately with the new
  // state before committing to the DOM.
  const [loadedSettings, setLoadedSettings] = useState(null);
  if (settings && settings !== loadedSettings) {
    setLoadedSettings(settings);
    setForm({
      monthlyBudget: String(settings.monthlyBudget ?? ''),
      sleepTargetHours: String(settings.sleepTargetHours ?? ''),
      stepTarget: String(settings.stepTarget ?? ''),
      waterTargetMl: String(settings.waterTargetMl ?? ''),
    });
  }

  const updateField = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    if (errors[field]) setErrors((er) => ({ ...er, [field]: '' }));
    setSaveMessage('');
  };

  const validate = () => {
    const next = {};
    const budget = Number(form.monthlyBudget);
    const sleep = Number(form.sleepTargetHours);
    const steps = Number(form.stepTarget);
    const water = Number(form.waterTargetMl);

    if (form.monthlyBudget === '' || Number.isNaN(budget) || budget < 0) {
      next.monthlyBudget = 'Monthly budget must be zero or a positive number.';
    }
    if (form.sleepTargetHours === '' || Number.isNaN(sleep) || sleep <= 0) {
      next.sleepTargetHours = 'Sleep target must be a positive number of hours.';
    }
    if (form.stepTarget === '' || Number.isNaN(steps) || steps <= 0) {
      next.stepTarget = 'Daily step target must be a positive number.';
    }
    if (form.waterTargetMl === '' || Number.isNaN(water) || water <= 0) {
      next.waterTargetMl = 'Water target must be a positive number of mL.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    setSaveMessage('');
    setSaveError('');
    if (!validate()) return;
    setSaving(true);
    try {
      await saveSettings({
        monthlyBudget: Number(form.monthlyBudget),
        sleepTargetHours: Number(form.sleepTargetHours),
        stepTarget: Number(form.stepTarget),
        waterTargetMl: Number(form.waterTargetMl),
      });
      setSaveMessage('Settings saved.');
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-shell" data-screen-label="Settings">
      <div className="botanical-overlay" />
      <Sidebar active="settings" />

      <main className="app-main">
        <div className="app-main__content" style={{ maxWidth: '560px' }}>
          <h1 className="card__title" style={{ marginBottom: 'var(--space-5)' }}>Settings</h1>

          <section className="card" id="card-settings">
            {loading ? (
              <div className="txn-empty">Loading settings…</div>
            ) : (
              <>
                {saveMessage && (
                  <p role="status" className="form-helper" style={{ color: 'var(--sage-700, var(--sage-500))', marginBottom: 'var(--space-3)' }}>
                    {saveMessage}
                  </p>
                )}
                {saveError && (
                  <p role="alert" className="form-helper form-helper--error" style={{ marginBottom: 'var(--space-3)' }}>
                    {saveError}
                  </p>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="settings-budget">Monthly Budget</label>
                  <input
                    id="settings-budget"
                    type="number"
                    min="0"
                    step="0.01"
                    className={`form-input${errors.monthlyBudget ? ' form-input--error' : ''}`}
                    value={form.monthlyBudget}
                    onChange={updateField('monthlyBudget')}
                    aria-invalid={!!errors.monthlyBudget}
                    aria-describedby={errors.monthlyBudget ? 'settings-budget-error' : undefined}
                  />
                  {errors.monthlyBudget && (
                    <span className="form-helper form-helper--error" id="settings-budget-error" role="alert">
                      {errors.monthlyBudget}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="settings-sleep">Sleep Target Hours</label>
                  <input
                    id="settings-sleep"
                    type="number"
                    min="0"
                    step="0.5"
                    className={`form-input${errors.sleepTargetHours ? ' form-input--error' : ''}`}
                    value={form.sleepTargetHours}
                    onChange={updateField('sleepTargetHours')}
                    aria-invalid={!!errors.sleepTargetHours}
                    aria-describedby={errors.sleepTargetHours ? 'settings-sleep-error' : undefined}
                  />
                  {errors.sleepTargetHours && (
                    <span className="form-helper form-helper--error" id="settings-sleep-error" role="alert">
                      {errors.sleepTargetHours}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="settings-steps">Daily Step Target</label>
                  <input
                    id="settings-steps"
                    type="number"
                    min="0"
                    step="1"
                    className={`form-input${errors.stepTarget ? ' form-input--error' : ''}`}
                    value={form.stepTarget}
                    onChange={updateField('stepTarget')}
                    aria-invalid={!!errors.stepTarget}
                    aria-describedby={errors.stepTarget ? 'settings-steps-error' : undefined}
                  />
                  {errors.stepTarget && (
                    <span className="form-helper form-helper--error" id="settings-steps-error" role="alert">
                      {errors.stepTarget}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="settings-water">Water Target (mL)</label>
                  <input
                    id="settings-water"
                    type="number"
                    min="0"
                    step="50"
                    className={`form-input${errors.waterTargetMl ? ' form-input--error' : ''}`}
                    value={form.waterTargetMl}
                    onChange={updateField('waterTargetMl')}
                    aria-invalid={!!errors.waterTargetMl}
                    aria-describedby={errors.waterTargetMl ? 'settings-water-error' : undefined}
                  />
                  {errors.waterTargetMl && (
                    <span className="form-helper form-helper--error" id="settings-water-error" role="alert">
                      {errors.waterTargetMl}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  className="btn btn--primary"
                  id="btn-save-settings"
                  onClick={handleSave}
                  disabled={saving}
                  style={{ marginTop: 'var(--space-2)' }}
                >
                  {saving ? 'Saving…' : 'Save Settings'}
                </button>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
