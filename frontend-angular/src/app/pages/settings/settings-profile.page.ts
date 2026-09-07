import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import {
  COUNTRIES,
  TIME_ZONES,
  TITLES,
  loadProfile,
  saveProfile,
  type ProfileFormData,
} from '../../lib/settings-data';

@Component({
  selector: 'app-settings-profile-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="settings-page">
      @if (!ready()) {
        <h1 class="settings-page-title">Profile Details</h1>
        <p class="settings-loading">Loading profile…</p>
      } @else {
        <header class="settings-page-head">
          <h1 class="settings-page-title">Profile Details</h1>
        </header>

        <form class="settings-form" (ngSubmit)="onSubmit()">
          <section class="settings-card">
            <header class="settings-card-head">
              <h2>Personal Information</h2>
              <p>Update your personal details and contact information.</p>
            </header>
            <div class="settings-card-body">
              <div class="settings-grid-2">
                <div class="settings-field">
                  <label for="title">Title</label>
                  <div class="settings-select-wrap">
                    <select id="title" class="settings-select" name="title" [(ngModel)]="form.title" (ngModelChange)="saved.set(false)">
                      @for (t of titles; track t) {
                        <option [value]="t">{{ t }}</option>
                      }
                    </select>
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 256 256" aria-hidden class="settings-chevrons">
                      <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
                    </svg>
                  </div>
                </div>
                <div class="settings-field">
                  <label for="firstName">First Name</label>
                  <input id="firstName" class="settings-input" name="firstName" type="text" placeholder="Enter your first name" [(ngModel)]="form.firstName" (ngModelChange)="saved.set(false)" />
                </div>
                <div class="settings-field">
                  <label for="lastName">Last Name</label>
                  <input id="lastName" class="settings-input" name="lastName" type="text" placeholder="Enter your last name" [(ngModel)]="form.lastName" (ngModelChange)="saved.set(false)" />
                </div>
                <div class="settings-field">
                  <label for="dateOfBirth">Date of Birth</label>
                  <input id="dateOfBirth" class="settings-input" name="dateOfBirth" type="date" [(ngModel)]="form.dateOfBirth" (ngModelChange)="saved.set(false)" />
                </div>
              </div>

              <div class="settings-grid-2">
                <div class="settings-field">
                  <label for="email">Email Address</label>
                  <input id="email" class="settings-input disabled" name="email" type="email" disabled [ngModel]="form.email" />
                </div>
                <div class="settings-field">
                  <label for="timeZone">Preferred Time Zone</label>
                  <div class="settings-select-wrap">
                    <select id="timeZone" class="settings-select" name="timeZone" [(ngModel)]="form.timeZone" (ngModelChange)="saved.set(false)">
                      @for (tz of timeZones; track tz.id) {
                        <option [value]="tz.id">{{ tz.label }}</option>
                      }
                    </select>
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 256 256" aria-hidden class="settings-chevrons">
                      <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="settings-card">
            <header class="settings-card-head">
              <h2>Address Information</h2>
              <p>Your residential address for verification and billing purposes.</p>
            </header>
            <div class="settings-card-body">
              <div class="settings-field">
                <label for="street">Street Address</label>
                <input id="street" class="settings-input" name="street" type="text" placeholder="123 Main Street" [(ngModel)]="form.street" (ngModelChange)="saved.set(false)" />
              </div>
              <div class="settings-grid-2">
                <div class="settings-field">
                  <label for="city">City</label>
                  <input id="city" class="settings-input" name="city" type="text" placeholder="Enter your city" [(ngModel)]="form.city" (ngModelChange)="saved.set(false)" />
                </div>
                <div class="settings-field">
                  <label for="postcode">Postal Code</label>
                  <input id="postcode" class="settings-input" name="postcode" type="text" placeholder="12345" [(ngModel)]="form.postcode" (ngModelChange)="saved.set(false)" />
                </div>
              </div>
              <div class="settings-field">
                <label for="country">Country</label>
                <div class="settings-select-wrap">
                  <select id="country" class="settings-select" name="country" [(ngModel)]="form.country" (ngModelChange)="saved.set(false)">
                    @for (c of countries; track c) {
                      <option [value]="c">{{ c }}</option>
                    }
                  </select>
                  <svg width="16" height="16" fill="currentColor" viewBox="0 0 256 256" aria-hidden class="settings-chevrons">
                    <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
                  </svg>
                </div>
              </div>
            </div>
          </section>

          <div class="settings-actions">
            @if (saved()) {
              <p class="settings-saved">Profile saved</p>
            } @else {
              <span></span>
            }
            <button type="submit" class="settings-save-btn">Save Profile Changes</button>
          </div>
        </form>
      }
    </div>
  `,
})
export class SettingsProfilePage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  form: ProfileFormData = loadProfile();
  readonly ready = signal(false);
  readonly saved = signal(false);
  readonly titles = TITLES;
  readonly timeZones = TIME_ZONES;
  readonly countries = COUNTRIES;

  ngOnInit() {
    void this.load();
  }

  onSubmit() {
    saveProfile(this.form);
    this.saved.set(true);
  }

  private async load() {
    const session = this.auth.user();
    try {
      const me = await this.api.request<{ email?: string; displayName?: string }>('/api/users/me');
      this.form = loadProfile(me.email || session?.email, me.displayName || session?.displayName);
    } catch {
      this.form = loadProfile(session?.email, session?.displayName);
    } finally {
      this.ready.set(true);
    }
  }
}
