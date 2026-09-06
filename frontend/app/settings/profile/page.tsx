'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, getSession } from '@/lib/api';
import {
  COUNTRIES,
  TITLES,
  TIME_ZONES,
  defaultProfile,
  loadProfile,
  saveProfile,
  type ProfileFormData,
} from '@/lib/settings-data';

function Chevrons() {
  return (
    <svg width="16" height="16" fill="currentColor" viewBox="0 0 256 256" aria-hidden className="settings-chevrons">
      <path d="M181.66,170.34a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-48-48a8,8,0,0,1,11.32-11.32L128,212.69l42.34-42.35A8,8,0,0,1,181.66,170.34Zm-96-84.68L128,43.31l42.34,42.35a8,8,0,0,0,11.32-11.32l-48-48a8,8,0,0,0-11.32,0l-48,48A8,8,0,0,0,85.66,85.66Z" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg width="16" height="16" fill="currentColor" viewBox="0 0 256 256" aria-hidden className="settings-chevrons">
      <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
    </svg>
  );
}

export default function ProfileSettingsPage() {
  const [form, setForm] = useState<ProfileFormData>(() => defaultProfile());
  const [tzOpen, setTzOpen] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const session = getSession();
    api<{ email?: string; displayName?: string }>('/api/users/me')
      .then((me) => {
        setForm(loadProfile(me.email || session?.email, me.displayName || session?.displayName));
      })
      .catch(() => {
        setForm(loadProfile(session?.email, session?.displayName));
      })
      .finally(() => setReady(true));
  }, []);

  const set =
    (key: keyof ProfileFormData) =>
    (value: string) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setSaved(false);
    };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    saveProfile(form);
    setSaved(true);
  };

  const tzLabel = TIME_ZONES.find((t) => t.id === form.timeZone)?.label || form.timeZone;

  if (!ready) {
    return (
      <div className="settings-page">
        <h1 className="settings-page-title">Profile Details</h1>
        <p className="settings-loading">Loading profile…</p>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <header className="settings-page-head">
        <h1 className="settings-page-title">Profile Details</h1>
      </header>

      <form className="settings-form" onSubmit={onSubmit}>
        <section className="settings-card">
          <header className="settings-card-head">
            <h2>Personal Information</h2>
            <p>Update your personal details and contact information.</p>
          </header>
          <div className="settings-card-body">
            <div className="settings-grid-2">
              <div className="settings-field">
                <label htmlFor="title">Title</label>
                <div className="settings-select-wrap">
                  <select
                    id="title"
                    className="settings-select"
                    value={form.title}
                    onChange={(e) => set('title')(e.target.value)}
                  >
                    {TITLES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <ChevronDown />
                </div>
              </div>

              <div className="settings-field">
                <label htmlFor="firstName">First Name</label>
                <input
                  id="firstName"
                  className="settings-input"
                  type="text"
                  placeholder="Enter your first name"
                  value={form.firstName}
                  onChange={(e) => set('firstName')(e.target.value)}
                />
              </div>

              <div className="settings-field">
                <label htmlFor="lastName">Last Name</label>
                <input
                  id="lastName"
                  className="settings-input"
                  type="text"
                  placeholder="Enter your last name"
                  value={form.lastName}
                  onChange={(e) => set('lastName')(e.target.value)}
                />
              </div>

              <div className="settings-field">
                <label htmlFor="dateOfBirth">Date of Birth</label>
                <input
                  id="dateOfBirth"
                  className="settings-input"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => set('dateOfBirth')(e.target.value)}
                />
              </div>
            </div>

            <div className="settings-grid-2">
              <div className="settings-field">
                <label htmlFor="email">Email Address</label>
                <input
                  id="email"
                  className="settings-input disabled"
                  type="email"
                  disabled
                  value={form.email}
                  placeholder="your.email@example.com"
                />
              </div>

              <div className="settings-field">
                <label>Preferred Time Zone</label>
                <div className="settings-combo-wrap">
                  <button
                    type="button"
                    className="settings-combo"
                    aria-expanded={tzOpen}
                    onClick={() => {
                      setTzOpen((o) => !o);
                      setCountryOpen(false);
                    }}
                  >
                    <span className="truncate">{tzLabel}</span>
                    <Chevrons />
                  </button>
                  {tzOpen && (
                    <ul className="settings-combo-menu" role="listbox">
                      {TIME_ZONES.map((tz) => (
                        <li key={tz.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={form.timeZone === tz.id}
                            onClick={() => {
                              set('timeZone')(tz.id);
                              setTzOpen(false);
                            }}
                          >
                            {tz.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="settings-card">
          <header className="settings-card-head">
            <h2>Address Information</h2>
            <p>Your residential address for verification and billing purposes.</p>
          </header>
          <div className="settings-card-body">
            <div className="settings-field">
              <label htmlFor="street">Street Address</label>
              <input
                id="street"
                className="settings-input"
                type="text"
                placeholder="123 Main Street"
                value={form.street}
                onChange={(e) => set('street')(e.target.value)}
              />
            </div>

            <div className="settings-grid-2">
              <div className="settings-field">
                <label htmlFor="city">City</label>
                <input
                  id="city"
                  className="settings-input"
                  type="text"
                  placeholder="Enter your city"
                  value={form.city}
                  onChange={(e) => set('city')(e.target.value)}
                />
              </div>
              <div className="settings-field">
                <label htmlFor="postcode">Postal Code</label>
                <input
                  id="postcode"
                  className="settings-input"
                  type="text"
                  placeholder="12345"
                  value={form.postcode}
                  onChange={(e) => set('postcode')(e.target.value)}
                />
              </div>
            </div>

            <div className="settings-field">
              <label>Country</label>
              <div className="settings-combo-wrap">
                <button
                  type="button"
                  className="settings-combo"
                  aria-expanded={countryOpen}
                  title={form.country}
                  onClick={() => {
                    setCountryOpen((o) => !o);
                    setTzOpen(false);
                  }}
                >
                  <span className="truncate">{form.country}</span>
                  <Chevrons />
                </button>
                {countryOpen && (
                  <ul className="settings-combo-menu" role="listbox">
                    {COUNTRIES.map((c) => (
                      <li key={c}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={form.country === c}
                          onClick={() => {
                            set('country')(c);
                            setCountryOpen(false);
                          }}
                        >
                          {c}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="settings-actions">
          {saved ? <p className="settings-saved">Profile saved</p> : <span />}
          <button type="submit" className="settings-save-btn">
            Save Profile Changes
          </button>
        </div>
      </form>
    </div>
  );
}
