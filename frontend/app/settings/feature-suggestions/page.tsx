'use client';

import { FormEvent, useState } from 'react';

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

export default function FeatureSuggestionsPage() {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [useCase, setUseCase] = useState('');
  const [priority, setPriority] = useState('');
  const [saved, setSaved] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTitle('');
    setCategory('');
    setDescription('');
    setUseCase('');
    setPriority('');
  };

  return (
    <div className="settings-page">
      <h1 className="settings-page-title">Feature Suggestions</h1>

      <form className="settings-form" onSubmit={onSubmit}>
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
          {saved ? <p className="settings-saved">Suggestion submitted (demo)</p> : <span />}
          <button type="submit" className="settings-save-btn">
            Submit Suggestion
          </button>
        </div>
      </form>
    </div>
  );
}
