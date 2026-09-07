import { Component, inject, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { AuthService } from '../core/auth.service';

const ADMIN_NAV = [
  { tab: 'overview', label: 'Overview' },
  { tab: 'payouts', label: 'Payouts' },
  { tab: 'verifications', label: 'Verifications' },
  { tab: 'traders', label: 'Traders' },
  { tab: 'challenges', label: 'Challenges' },
  { tab: 'catalog', label: 'Catalog' },
  { tab: 'audit', label: 'Audit' },
  { tab: 'mail', label: 'Mail' },
] as const;

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <div class="admin-shell">
      <aside class="admin-shell-sidebar" aria-label="Admin navigation">
        <div class="admin-shell-brand">
          <span class="admin-shell-badge">Admin</span>
          <strong>PropFirm Control</strong>
          <p>{{ displayName() }}</p>
          <p class="admin-shell-email">{{ email() }}</p>
        </div>
        <nav class="admin-shell-nav">
          @for (item of nav; track item.tab) {
            <button
              type="button"
              [class.on]="currentTab() === item.tab"
              [attr.aria-current]="currentTab() === item.tab ? 'page' : null"
              (click)="go(item.tab)"
            >
              {{ item.label }}
            </button>
          }
        </nav>
        <div class="admin-shell-footer">
          <a routerLink="/">View marketing site</a>
          <button type="button" (click)="onLogout()">Sign out</button>
        </div>
      </aside>
      <div class="admin-shell-main">
        <router-outlet />
      </div>
    </div>
  `,
})
export class AdminShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly nav = ADMIN_NAV;
  readonly displayName = computed(() => this.auth.user()?.displayName || 'Admin');
  readonly email = computed(() => this.auth.user()?.email || 'admin@propfirm.local');

  private readonly queryTab = toSignal(
    this.route.queryParamMap.pipe(map((q) => q.get('tab') || 'overview')),
    { initialValue: 'overview' },
  );

  readonly currentTab = computed(() => this.queryTab() || 'overview');

  go(tab: (typeof ADMIN_NAV)[number]['tab']) {
    if (tab === 'overview') {
      void this.router.navigate(['/admin']);
    } else {
      void this.router.navigate(['/admin'], { queryParams: { tab } });
    }
  }

  async onLogout() {
    await this.auth.logout().catch(() => undefined);
    await this.router.navigateByUrl('/login?next=/admin');
  }
}
