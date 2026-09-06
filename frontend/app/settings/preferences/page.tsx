'use client';

import { useEffect, useState } from 'react';

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'ar', label: 'العربية' },
] as const;

const STORAGE_KEY = 'propfirm_language';

export default function PreferencesPage() {
  const [language, setLanguage] = useState('en');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setLanguage(stored);
  }, []);

  const onChange = (value: string) => {
    setLanguage(value);
    localStorage.setItem(STORAGE_KEY, value);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };

  return (
    <div className="settings-page">
      <h1 className="settings-page-title">Preferences</h1>

      <section className="settings-card">
        <header className="settings-card-head">
          <h2>Preferences</h2>
          <p>Select your preferred language.</p>
        </header>
        <div className="settings-card-body">
          <div className="settings-field">
            <label htmlFor="language">Language</label>
            <select
              id="language"
              className="settings-select sp-lang"
              value={language}
              onChange={(e) => onChange(e.target.value)}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
            {saved ? <p className="settings-saved">Preference saved</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
