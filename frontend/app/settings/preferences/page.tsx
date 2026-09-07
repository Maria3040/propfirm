'use client';

import { useEffect, useState } from 'react';
import { api, getSession } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'ar', label: 'العربية' },
] as const;

const STORAGE_KEY = 'propfirm_language';

function readLocalLanguage() {
  if (typeof window === 'undefined') return 'en';
  return localStorage.getItem(STORAGE_KEY) || 'en';
}

export default function PreferencesPage() {
  const { ready, authenticated } = useRequireAuth('/settings/preferences');
  const [language, setLanguage] = useState(readLocalLanguage);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = readLocalLanguage();
      if (!cancelled) setLanguage(local);
      if (!getSession()) {
        if (!cancelled) setHydrated(true);
        return;
      }
      try {
        const res = await api<{ language: string }>('/api/users/me/preferences');
        if (!cancelled && res.language) {
          setLanguage(res.language);
          localStorage.setItem(STORAGE_KEY, res.language);
          document.documentElement.lang = res.language;
        }
      } catch {
        document.documentElement.lang = local;
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated]);

  async function onChange(value: string) {
    setLanguage(value);
    localStorage.setItem(STORAGE_KEY, value);
    document.documentElement.lang = value;
    setSaved(true);
    setErr('');
    window.setTimeout(() => setSaved(false), 1600);
    if (!getSession()) return;
    try {
      await api('/api/users/me/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ language: value }),
      });
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Failed to sync preference');
    }
  }

  if (!ready) {
    return (
      <div className="settings-page">
        <h1 className="settings-page-title">Preferences</h1>
        <p className="meta">Loading…</p>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <h1 className="settings-page-title">Preferences</h1>

      <section className="settings-card">
        <header className="settings-card-head">
          <h2>Preferences</h2>
          <p>Select your preferred language. Saved to your account and restored after refresh.</p>
        </header>
        <div className="settings-card-body">
          <div className="settings-field">
            <label htmlFor="language">Language</label>
            <select
              id="language"
              className="settings-select sp-lang"
              value={language}
              disabled={!hydrated}
              onChange={(e) => void onChange(e.target.value)}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
            {saved ? <p className="settings-saved">Preference saved</p> : null}
            {err ? <p className="err">{err}</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
