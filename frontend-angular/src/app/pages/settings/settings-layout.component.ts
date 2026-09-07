import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { SETTINGS_NAV } from '../../lib/settings-data';

@Component({
  selector: 'app-settings-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="settings-layout">
      <aside class="settings-aside">
        <div class="settings-aside-head">
          <h1>Configuration</h1>
        </div>
        <nav class="settings-nav" aria-label="Settings">
          @for (item of nav; track item.href) {
            <a
              [routerLink]="item.href"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: true }"
              class="settings-nav-link"
            >
              {{ item.label }}
            </a>
          }
        </nav>
      </aside>

      <div class="settings-main">
        <div class="settings-mobile-nav">
          <button
            type="button"
            class="settings-mobile-trigger"
            [attr.aria-expanded]="mobileOpen()"
            (click)="mobileOpen.set(!mobileOpen())"
          >
            <span>{{ currentLabel() }}</span>
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 256 256" aria-hidden class="opacity-50">
              <path
                d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"
              />
            </svg>
          </button>
          @if (mobileOpen()) {
            <div class="settings-mobile-menu" role="listbox">
              @for (item of nav; track item.href) {
                <a
                  [routerLink]="item.href"
                  role="option"
                  [attr.aria-selected]="item.href === currentHref()"
                  (click)="mobileOpen.set(false)"
                >
                  {{ item.label }}
                </a>
              }
            </div>
          }
        </div>
        <router-outlet />
      </div>
    </div>
  `,
})
export class SettingsLayoutComponent {
  private readonly router = inject(Router);
  readonly nav = SETTINGS_NAV;
  readonly mobileOpen = signal(false);

  private readonly url = toSignal(
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)),
    { initialValue: null },
  );

  readonly currentHref = computed(() => {
    void this.url();
    const path = this.router.url.split('?')[0];
    const match = this.nav.find((n) => path === n.href || path.startsWith(`${n.href}/`));
    return match?.href || this.nav[0].href;
  });

  readonly currentLabel = computed(() => {
    const href = this.currentHref();
    return this.nav.find((n) => n.href === href)?.label || 'Settings';
  });
}
