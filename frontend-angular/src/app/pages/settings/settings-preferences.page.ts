import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'ar', label: 'العربية' },
] as const;

const STORAGE_KEY = 'propfirm_language';

@Component({
  selector: 'app-settings-preferences-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="settings-page">
      <h1 class="settings-page-title">Preferences</h1>
      <section class="settings-card">
        <header class="settings-card-head">
          <h2>Preferences</h2>
          <p>Select your preferred language. Saved to your account and restored after refresh.</p>
        </header>
        <div class="settings-card-body">
          <div class="settings-field">
            <label for="language">Language</label>
            <select
              id="language"
              class="settings-select sp-lang"
              name="language"
              [ngModel]="language()"
              [disabled]="!hydrated()"
              (ngModelChange)="onChange($event)"
            >
              @for (l of languages; track l.value) {
                <option [value]="l.value">{{ l.label }}</option>
              }
            </select>
            @if (saved()) {
              <p class="settings-saved">Preference saved</p>
            }
            @if (err()) {
              <p class="err">{{ err() }}</p>
            }
          </div>
        </div>
      </section>
    </div>
  `,
})
export class SettingsPreferencesPage implements OnInit {
  private readonly api = inject(ApiService);
  readonly languages = LANGUAGES;
  readonly language = signal(localStorage.getItem(STORAGE_KEY) || 'en');
  readonly saved = signal(false);
  readonly err = signal('');
  readonly hydrated = signal(false);

  ngOnInit() {
    void this.load();
  }

  async onChange(value: string) {
    this.language.set(value);
    localStorage.setItem(STORAGE_KEY, value);
    document.documentElement.lang = value;
    this.saved.set(true);
    this.err.set('');
    window.setTimeout(() => this.saved.set(false), 1600);
    try {
      await this.api.request('/api/users/me/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ language: value }),
      });
    } catch (ex: unknown) {
      this.err.set(ex instanceof Error ? ex.message : 'Failed to sync preference');
    }
  }

  private async load() {
    const local = localStorage.getItem(STORAGE_KEY) || 'en';
    this.language.set(local);
    try {
      const res = await this.api.request<{ language: string }>('/api/users/me/preferences');
      if (res.language) {
        this.language.set(res.language);
        localStorage.setItem(STORAGE_KEY, res.language);
        document.documentElement.lang = res.language;
      }
    } catch {
      document.documentElement.lang = local;
    } finally {
      this.hydrated.set(true);
    }
  }
}
