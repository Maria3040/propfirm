import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

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

@Component({
  selector: 'app-settings-feature-suggestions-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="settings-page">
      <h1 class="settings-page-title">Feature Suggestions</h1>
      <form class="settings-form" (ngSubmit)="onSubmit()">
        <section class="settings-card">
          <header class="settings-card-head"><h2>Feature Suggestion</h2></header>
          <div class="settings-card-body">
            <div class="settings-grid-2">
              <div class="settings-field">
                <label for="title">Feature Title</label>
                <input id="title" class="settings-input" name="title" type="text" placeholder="Brief title for your feature suggestion" required [(ngModel)]="title" (ngModelChange)="saved.set(false)" />
              </div>
              <div class="settings-field">
                <label for="category">Category</label>
                <select id="category" class="settings-select" name="category" required [(ngModel)]="category" (ngModelChange)="saved.set(false)">
                  <option value="">Select a category</option>
                  @for (c of categories; track c.value) {
                    <option [value]="c.value">{{ c.label }}</option>
                  }
                </select>
              </div>
              <div class="settings-field sfs-span-2">
                <label for="description">Detailed Description</label>
                <div class="sfs-textarea-wrap">
                  <textarea id="description" class="sfs-textarea" name="description" maxlength="2000" rows="6" placeholder="Describe your feature idea in detail. What problem does it solve? How would it work?" required [(ngModel)]="description" (ngModelChange)="saved.set(false)"></textarea>
                  <span class="sfs-count">{{ description.length }} / 2000 characters</span>
                </div>
              </div>
              <div class="settings-field sfs-span-2">
                <label for="useCase">Use Case (Optional)</label>
                <div class="sfs-textarea-wrap">
                  <textarea id="useCase" class="sfs-textarea" name="useCase" maxlength="1000" rows="4" placeholder="When and how would you use this feature? Example scenarios..." [(ngModel)]="useCase" (ngModelChange)="saved.set(false)"></textarea>
                  <span class="sfs-count">{{ useCase.length }} / 1000 characters</span>
                </div>
              </div>
              <div class="settings-field">
                <label for="priority">How important is this to you?</label>
                <select id="priority" class="settings-select" name="priority" required [(ngModel)]="priority" (ngModelChange)="saved.set(false)">
                  <option value="">Select priority</option>
                  @for (p of priorities; track p.value) {
                    <option [value]="p.value">{{ p.label }}</option>
                  }
                </select>
              </div>
            </div>
          </div>
        </section>
        <div class="settings-actions">
          @if (err()) {
            <p class="err">{{ err() }}</p>
          } @else if (saved()) {
            <p class="settings-saved">Suggestion submitted</p>
          } @else {
            <span></span>
          }
          <button type="submit" class="settings-save-btn" [disabled]="busy()">{{ busy() ? 'Submitting…' : 'Submit Suggestion' }}</button>
        </div>
      </form>

      <section class="settings-card" style="margin-top: 1.5rem">
        <header class="settings-card-head">
          <h2>Your suggestions</h2>
          <p>Persisted via \`GET/POST /api/feature-suggestions\`.</p>
        </header>
        <div class="settings-card-body">
          @if (mine().length === 0) {
            <p class="meta">No suggestions yet.</p>
          } @else {
            <ul class="sfs-mine-list">
              @for (s of mine(); track s.id) {
                <li>
                  <strong>{{ s.title }}</strong>
                  <span class="meta"> · {{ s.category }} · {{ s.priority }} · {{ s.status }}</span>
                  <p class="meta">{{ s.description }}</p>
                </li>
              }
            </ul>
          }
        </div>
      </section>
    </div>
  `,
})
export class SettingsFeatureSuggestionsPage implements OnInit {
  private readonly api = inject(ApiService);
  readonly categories = CATEGORIES;
  readonly priorities = PRIORITIES;
  title = '';
  category = '';
  description = '';
  useCase = '';
  priority = '';
  readonly saved = signal(false);
  readonly err = signal('');
  readonly busy = signal(false);
  readonly mine = signal<Suggestion[]>([]);

  ngOnInit() {
    void this.loadMine();
  }

  async onSubmit() {
    this.err.set('');
    this.saved.set(false);
    this.busy.set(true);
    try {
      await this.api.request('/api/feature-suggestions', {
        method: 'POST',
        body: JSON.stringify({
          title: this.title,
          category: this.category,
          description: this.description,
          useCase: this.useCase,
          priority: this.priority,
        }),
      });
      this.saved.set(true);
      this.title = '';
      this.category = '';
      this.description = '';
      this.useCase = '';
      this.priority = '';
      await this.loadMine();
    } catch (ex: unknown) {
      this.err.set(ex instanceof Error ? ex.message : 'Submit failed');
    } finally {
      this.busy.set(false);
    }
  }

  private async loadMine() {
    try {
      const rows = await this.api.request<Suggestion[]>('/api/feature-suggestions');
      this.mine.set(Array.isArray(rows) ? rows : []);
    } catch {
      this.mine.set([]);
    }
  }
}
