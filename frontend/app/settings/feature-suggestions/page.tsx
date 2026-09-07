'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';

const CATEGORIES = [
  { value: 'trading-features', label: 'Trading Features' },
  { value: 'account-management', label: 'Account Management' },
  { value: 'payments-payouts', label: 'Payments & Rewards' },
  { value: 'dashboard-analytics', label: 'Dashboard Analytics' },
  { value: 'challenges', label: 'Challenges & Evaluations' },
  { value: 'reports', label: 'Reports & Statistics' },
  { value: 'mobile-app', label: 'Mobile App' },
  { value: 'integrations', label: 'Integrations (Discord, MetaTrader, etc.)' },
  { value: 'security', label: 'Security & Privacy' },
  { value: 'ui-ux', label: 'User Interface & Experience' },
  { value: 'other', label: 'Other' },
] as const;

const PRIORITIES = [
  { value: 'low', label: 'Nice to Have' },
  { value: 'medium', label: 'Would Be Helpful' },
  { value: 'high', label: 'Would Significantly Improve My Experience' },
  { value: 'critical', label: 'Critical for My Workflow' },
] as const;

type Suggestion = {
  id: string;
  title: string;
  category: string;
  description: string;
  useCase?: string | null;
  priority: string;
  status: string;
  createdAt: string;
};

export default function FeatureSuggestionsPage() {
  const { ready, authenticated } = useRequireAuth('/settings/feature-suggestions');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [useCase, setUseCase] = useState('');
  const [priority, setPriority] = useState('');
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<Suggestion[]>([]);

  async function loadMine() {
    try {
      const rows = await api<Suggestion[]>('/api/feature-suggestions');
      setMine(Array.isArray(rows) ? rows : []);
    } catch {
      setMine([]);
    }
  }

  useEffect(() => {
    if (!authenticated) return;
    void loadMine();
  }, [authenticated]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    setSaved(false);
    setBusy(true);
    try {
      await api('/api/feature-suggestions', {
        method: 'POST',
        body: JSON.stringify({ title, category, description, useCase, priority }),
      });
      setSaved(true);
      setTitle('');
      setCategory('');
      setDescription('');
      setUseCase('');
      setPriority('');
      await loadMine();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Submit failed');
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !authenticated) {
    return (
      <div className="settings-page">
        <h1 className="settings-page-title">Feature Suggestions</h1>
        <p className="meta">Checking session…</p>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <h1 className="settings-page-title">Feature Suggestions</h1>

      <form className="settings-form" onSubmit={(e) => void onSubmit(e)}>
        <section className="settings-card">
          <header className="settings-card-head">
            <h2>Feature Suggestion</h2>
          </header>
          <div className="settings-card-body">
            <div className="settings-grid-2">
              <div className="settings-field">
                <label htmlFor="title">Feature Title</label>
                <input
                  id="title"
                  className="settings-input"
                  type="text"
                  placeholder="Brief title for your feature suggestion"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setSaved(false);
                  }}
                  required
                />
              </div>
              <div className="settings-field">
                <label htmlFor="category">Category</label>
                <select
                  id="category"
                  className="settings-select"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setSaved(false);
                  }}
                  required
                >
                  <option value="">Select a category</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="settings-field sfs-span-2">
                <label htmlFor="description">Detailed Description</label>
                <div className="sfs-textarea-wrap">
                  <textarea
                    id="description"
                    className="sfs-textarea"
                    maxLength={2000}
                    rows={6}
                    placeholder="Describe your feature idea in detail. What problem does it solve? How would it work?"
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      setSaved(false);
                    }}
                    required
                  />
                  <span className="sfs-count">{description.length} / 2000 characters</span>
                </div>
              </div>
              <div className="settings-field sfs-span-2">
                <label htmlFor="useCase">Use Case (Optional)</label>
                <div className="sfs-textarea-wrap">
                  <textarea
                    id="useCase"
                    className="sfs-textarea"
                    maxLength={1000}
                    rows={4}
                    placeholder="When and how would you use this feature? Example scenarios..."
                    value={useCase}
                    onChange={(e) => {
                      setUseCase(e.target.value);
                      setSaved(false);
                    }}
                  />
                  <span className="sfs-count">{useCase.length} / 1000 characters</span>
                </div>
              </div>
              <div className="settings-field">
                <label htmlFor="priority">How important is this to you?</label>
                <select
                  id="priority"
                  className="settings-select"
                  value={priority}
                  onChange={(e) => {
                    setPriority(e.target.value);
                    setSaved(false);
                  }}
                  required
                >
                  <option value="">Select priority</option>
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        <div className="settings-actions">
          {err ? <p className="err">{err}</p> : saved ? <p className="settings-saved">Suggestion submitted</p> : <span />}
          <button type="submit" className="settings-save-btn" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit Suggestion'}
          </button>
        </div>
      </form>

      <section className="settings-card" style={{ marginTop: '1.5rem' }}>
        <header className="settings-card-head">
          <h2>Your suggestions</h2>
          <p>Persisted via `GET/POST /api/feature-suggestions`.</p>
        </header>
        <div className="settings-card-body">
          {mine.length === 0 ? (
            <p className="meta">No suggestions yet.</p>
          ) : (
            <ul className="sfs-mine-list">
              {mine.map((s) => (
                <li key={s.id}>
                  <strong>{s.title}</strong>
                  <span className="meta">
                    {' '}
                    · {s.category} · {s.priority} · {s.status}
                  </span>
                  <p className="meta">{s.description}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
