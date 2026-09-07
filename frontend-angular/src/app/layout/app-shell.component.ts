import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { MobileNavigationComponent } from '../components/mobile-navigation.component';
import { BasketDrawerComponent } from '../components/basket-drawer.component';
import { basketCount, readBasket, subscribeBasket, writeBasket } from '../lib/basket';
import type { BasketLine } from '../lib/basket-types';

const NAV = [
  { href: '/accounts', label: 'Accounts', icon: 'accounts' },
  { href: '/payouts', label: 'Rewards', icon: 'rewards' },
  { href: '/competitions', label: 'Competitions', icon: 'trophy' },
  { href: '/leaderboards', label: 'Leaderboards', icon: 'list' },
  { href: '/certificates', label: 'Certificates', icon: 'cert' },
  { href: '/economic-calendar', label: 'Economic Calendar', icon: 'cal' },
  { href: '/tools', label: 'Tools', icon: 'tools' },
  { href: '/trade-copier', label: 'Trade Copier', icon: 'radio' },
  { href: '/affiliate', label: 'Affiliate', icon: 'users' },
] as const;

const ICONS: Record<string, string> = {
  accounts:
    'M216,56H176V48a24,24,0,0,0-24-24H104A24,24,0,0,0,80,48v8H40A16,16,0,0,0,24,72V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V72A16,16,0,0,0,216,56ZM96,48a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96ZM216,72v41.61A184,184,0,0,1,128,136a184.07,184.07,0,0,1-88-22.38V72Zm0,128H40V131.64A200.19,200.19,0,0,0,128,152a200.25,200.25,0,0,0,88-20.37V200ZM104,112a8,8,0,0,1,8-8h32a8,8,0,0,1,0,16H112A8,8,0,0,1,104,112Z',
  rewards:
    'M184,89.57V84c0-25.08-37.83-44-88-44S8,58.92,8,84v40c0,20.89,26.25,37.49,64,42.46V172c0,25.08,37.83,44,88,44s88-18.92,88-44V132C248,111.3,222.58,94.68,184,89.57ZM232,132c0,13.22-30.79,28-72,28-3.73,0-7.43-.13-11.08-.37C170.49,151.77,184,139,184,124V105.74C213.87,110.19,232,122.27,232,132ZM72,150.25V126.46A183.74,183.74,0,0,0,96,128a183.74,183.74,0,0,0,24-1.54v23.79A163,163,0,0,1,96,152,163,163,0,0,1,72,150.25Zm96-40.32V124c0,8.39-12.41,17.4-32,22.87V123.5C148.91,120.37,159.84,115.71,168,109.93ZM96,56c41.21,0,72,14.78,72,28s-30.79,28-72,28S24,97.22,24,84,54.79,56,96,56ZM24,124V109.93c8.16,5.78,19.09,10.44,32,13.57v23.37C36.41,141.4,24,132.39,24,124Zm64,48v-4.17c2.63.1,5.29.17,8,.17,3.88,0,7.67-.13,11.39-.35A121.92,121.92,0,0,0,120,171.41v23.46C100.41,189.4,88,180.39,88,172Zm48,26.25V174.4a179.48,179.48,0,0,0,24,1.6,183.74,183.74,0,0,0,24-1.54v23.79a165.45,165.45,0,0,1-48,0Zm64-3.38V171.5c12.91-3.13,23.84-7.79,32-13.57V172C232,180.39,219.59,189.4,200,194.87Z',
  trophy:
    'M232,64H208V48a8,8,0,0,0-8-8H56a8,8,0,0,0-8,8V64H24A16,16,0,0,0,8,80V96a40,40,0,0,0,40,40h3.65A80.13,80.13,0,0,0,120,191.61V216H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16H136V191.58c31.94-3.23,58.44-25.64,68.08-55.58H208a40,40,0,0,0,40-40V80A16,16,0,0,0,232,64ZM48,120A24,24,0,0,1,24,96V80H48v32q0,4,.39,8Zm144-8.9c0,35.52-29,64.64-64,64.9a64,64,0,0,1-64-64V56H192ZM232,96a24,24,0,0,1-24,24h-.5a81.81,81.81,0,0,0,.5-8.9V80h24Z',
  list: 'M224,128a8,8,0,0,1-8,8H104a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM104,72H216a8,8,0,0,0,0-16H104a8,8,0,0,0,0,16ZM216,184H104a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16ZM43.58,55.16,48,52.94V104a8,8,0,0,0,16,0V40a8,8,0,0,0-11.58-7.16l-16,8a8,8,0,0,0,7.16,14.32ZM79.77,156.72a23.73,23.73,0,0,0-9.6-15.95,24.86,24.86,0,0,0-34.11,4.7,23.63,23.63,0,0,0-3.57,6.46,8,8,0,1,0,15,5.47,7.84,7.84,0,0,1,1.18-2.13,8.76,8.76,0,0,1,12-1.59A7.91,7.91,0,0,1,63.93,159a7.64,7.64,0,0,1-1.57,5.78,1,1,0,0,0-.08.11L33.59,203.21A8,8,0,0,0,40,216H72a8,8,0,0,0,0-16H56l19.08-25.53A23.47,23.47,0,0,0,79.77,156.72Z',
  cert: 'M128,136a8,8,0,0,1-8,8H72a8,8,0,0,1,0-16h48A8,8,0,0,1,128,136Zm-8-40H72a8,8,0,0,0,0,16h48a8,8,0,0,0,0-16Zm112,65.47V224A8,8,0,0,1,220,231l-24-13.74L172,231A8,8,0,0,1,160,224V200H40a16,16,0,0,1-16-16V56A16,16,0,0,1,40,40H216a16,16,0,0,1,16,16V86.53a51.88,51.88,0,0,1,0,74.94ZM160,184V161.47A52,52,0,0,1,216,76V56H40V184Zm56-12a51.88,51.88,0,0,1-40,0v38.22l16-9.16a8,8,0,0,1,7.94,0l16,9.16Zm16-48a36,36,0,1,0-36,36A36,36,0,0,0,232,124Z',
  cal: 'M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Zm-68-76a12,12,0,1,1-12-12A12,12,0,0,1,140,132Zm44,0a12,12,0,1,1-12-12A12,12,0,0,1,184,132ZM96,172a12,12,0,1,1-12-12A12,12,0,0,1,96,172Zm44,0a12,12,0,1,1-12-12A12,12,0,0,1,140,172Zm44,0a12,12,0,1,1-12-12A12,12,0,0,1,184,172Z',
  tools:
    'M226.76,69a8,8,0,0,0-12.84-2.88l-40.3,37.19-17.23-3.7-3.7-17.23,37.19-40.3A8,8,0,0,0,187,29.24,72,72,0,0,0,88,96,72.34,72.34,0,0,0,94,124.94L33.79,177c-.15.12-.29.26-.43.39a32,32,0,0,0,45.26,45.26c.13-.13.27-.28.39-.42L131.06,162A72,72,0,0,0,232,96,71.56,71.56,0,0,0,226.76,69ZM160,152a56.14,56.14,0,0,1-27.07-7,8,8,0,0,0-9.92,1.77L67.11,211.51a16,16,0,0,1-22.62-22.62L109.18,133a8,8,0,0,0,1.77-9.93,56,56,0,0,1,58.36-82.31l-31.2,33.81a8,8,0,0,0-1.94,7.1L141.83,108a8,8,0,0,0,6.14,6.14l26.35,5.66a8,8,0,0,0,7.1-1.94l33.81-31.2A56.06,56.06,0,0,1,160,152Z',
  radio:
    'M128,88a40,40,0,1,0,40,40A40,40,0,0,0,128,88Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,152Zm73.71,7.14a80,80,0,0,1-14.08,22.2,8,8,0,0,1-11.92-10.67,63.95,63.95,0,0,0,0-85.33,8,8,0,1,1,11.92-10.67,80.08,80.08,0,0,1,14.08,84.47ZM69,103.09a64,64,0,0,0,11.26,67.58,8,8,0,0,1-11.92,10.67,79.93,79.93,0,0,1,0-106.67A8,8,0,1,1,80.29,85.34,63.77,63.77,0,0,0,69,103.09ZM248,128a119.58,119.58,0,0,1-34.29,84,8,8,0,1,1-11.42-11.2,103.9,103.9,0,0,0,0-145.56A8,8,0,1,1,213.71,44,119.58,119.58,0,0,1,248,128ZM53.71,200.78A8,8,0,1,1,42.29,212a119.87,119.87,0,0,1,0-168,8,8,0,1,1,11.42,11.2,103.9,103.9,0,0,0,0,145.56Z',
  users:
    'M117.25,157.92a60,60,0,1,0-66.5,0A95.83,95.83,0,0,0,3.53,195.63a8,8,0,1,0,13.4,8.74,80,80,0,0,1,134.14,0,8,8,0,0,0,13.4-8.74A95.83,95.83,0,0,0,117.25,157.92ZM40,108a44,44,0,1,1,44,44A44.05,44.05,0,0,1,40,108Zm210.14,98.7a8,8,0,0,1-11.07-2.33A79.83,79.83,0,0,0,172,168a8,8,0,0,1,0-16,44,44,0,1,0-16.34-84.87,8,8,0,1,1-5.94-14.85,60,60,0,0,1,55.53,105.64,95.83,95.83,0,0,1,47.22,37.71A8,8,0,0,1,250.14,206.7Z',
  settings:
    'M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Zm88-29.84q.06-2.16,0-4.32l14.92-18.64a8,8,0,0,0,1.48-7.06,107.21,107.21,0,0,0-10.88-26.25,8,8,0,0,0-6-3.93l-23.72-2.64q-1.48-1.56-3-3L186,40.54a8,8,0,0,0-3.94-6,107.71,107.71,0,0,0-26.25-10.87,8,8,0,0,0-7.06,1.49L130.16,40Q128,40,125.84,40L107.2,25.11a8,8,0,0,0-7.06-1.48A107.6,107.6,0,0,0,73.89,34.51a8,8,0,0,0-3.93,6L67.32,64.27q-1.56,1.49-3,3L40.54,70a8,8,0,0,0-6,3.94,107.71,107.71,0,0,0-10.87,26.25,8,8,0,0,0,1.49,7.06L40,125.84Q40,128,40,130.16L25.11,148.8a8,8,0,0,0-1.48,7.06,107.21,107.21,0,0,0,10.88,26.25,8,8,0,0,0,6,3.93l23.72,2.64q1.49,1.56,3,3L70,215.46a8,8,0,0,0,3.94,6,107.71,107.71,0,0,0,26.25,10.87,8,8,0,0,0,7.06-1.49L125.84,216q2.16.06,4.32,0l18.64,14.92a8,8,0,0,0,7.06,1.48,107.21,107.21,0,0,0,26.25-10.88,8,8,0,0,0,3.93-6l2.64-23.72q1.56-1.48,3-3L215.46,186a8,8,0,0,0,6-3.94,107.71,107.71,0,0,0,10.87-26.25,8,8,0,0,0-1.49-7.06Zm-16.1-6.5a73.93,73.93,0,0,1,0,8.68,8,8,0,0,0,1.74,5.48l14.19,17.73a91.57,91.57,0,0,1-6.23,15L187,173.11a8,8,0,0,0-5.1,2.64,74.11,74.11,0,0,1-6.14,6.14,8,8,0,0,0-2.64,5.1l-2.51,22.58a91.32,91.32,0,0,1-15,6.23l-17.74-14.19a8,8,0,0,0-5-1.75h-.48a73.93,73.93,0,0,1-8.68,0,8,8,0,0,0-5.48,1.74L100.45,215.8a91.57,91.57,0,0,1-15-6.23L82.89,187a8,8,0,0,0-2.64-5.1,74.11,74.11,0,0,1-6.14-6.14,8,8,0,0,0-5.1-2.64L46.43,170.6a91.32,91.32,0,0,1-6.23-15l14.19-17.74a8,8,0,0,0,1.74-5.48,73.93,73.93,0,0,1,0-8.68,8,8,0,0,0-1.74-5.48L40.2,100.45a91.57,91.57,0,0,1,6.23-15L69,82.89a8,8,0,0,0,5.1-2.64,74.11,74.11,0,0,1,6.14-6.14A8,8,0,0,0,82.89,69L85.4,46.43a91.32,91.32,0,0,1,15-6.23l17.74,14.19a8,8,0,0,0,5.48,1.74,73.93,73.93,0,0,1,8.68,0,8,8,0,0,0,5.48-1.74L155.55,40.2a91.57,91.57,0,0,1,15,6.23L173.11,69a8,8,0,0,0,2.64,5.1,74.11,74.11,0,0,1,6.14,6.14,8,8,0,0,0,5.1,2.64l22.58,2.51a91.32,91.32,0,0,1,6.23,15l-14.19,17.74A8,8,0,0,0,199.87,123.66Z',
  moon: 'M233.54,142.23a8,8,0,0,0-8-2,88.08,88.08,0,0,1-109.8-109.8,8,8,0,0,0-10-10,104.84,104.84,0,0,0-52.91,37A104,104,0,0,0,136,224a103.09,103.09,0,0,0,62.52-20.88,104.84,104.84,0,0,0,37-52.91A8,8,0,0,0,233.54,142.23ZM188.9,190.34A88,88,0,0,1,65.66,67.11a89,89,0,0,1,31.4-26A106,106,0,0,0,96,56,104.11,104.11,0,0,0,200,160a106,106,0,0,0,14.92-1.06A89,89,0,0,1,188.9,190.34Z',
  logout:
    'M120,216a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V40a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H56V208h56A8,8,0,0,1,120,216Zm109.66-93.66-40-40a8,8,0,0,0-11.32,11.32L204.69,120H112a8,8,0,0,0,0,16h92.69l-26.35,26.34a8,8,0,0,0,11.32,11.32l40-40A8,8,0,0,0,229.66,122.34Z',
  bell: 'M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80Z',
};

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MobileNavigationComponent,
    BasketDrawerComponent,
  ],
  template: `
    <div class="app-shell">
      <div class="app-banner" role="region" aria-label="Announcements">
        <div class="app-banner-inner">
          <span>
            New here? Get 20% OFF your first challenge with code <strong>HELLO</strong>. Excludes 100K
            accounts.
          </span>
        </div>
      </div>

      <app-mobile-navigation
        [basketCount]="count()"
        [hasSession]="hasSession()"
        (openBasket)="basketOpen.set(true)"
        (logout)="logout()"
      />

      <aside class="app-sidebar" aria-label="App sidebar">
        <div class="app-sidebar-top">
          <a routerLink="/accounts" class="app-sidebar-brand" aria-label="Go to Dashboard">
            <svg viewBox="0 0 45 49" fill="currentColor" aria-label="PropFirm" class="app-brand-mark">
              <g fill-rule="evenodd">
                <path
                  fill-rule="nonzero"
                  d="M8.294 4.586c0 2.21-1.795 4-4.01 4a4.004 4.004 0 0 1-4.008-4c0-2.209 1.795-4 4.009-4a4.004 4.004 0 0 1 4.009 4m10.022 34c0-2.209 1.795-4 4.009-4a4.004 4.004 0 0 1 4.009 4v6c0 2.209-1.795 4-4.01 4a4.005 4.005 0 0 1-4.008-4z"
                />
                <path
                  fill-rule="nonzero"
                  d="M13.561 4.586c0-2.209 1.795-4 4.009-4h11.983c8.185 0 14.82 6.62 14.82 14.787s-6.635 14.788-14.82 14.788H8.293v14.425c0 2.209-1.794 4-4.008 4a4.005 4.005 0 0 1-4.01-4V22.161h29.278c3.758 0 6.802-3.04 6.802-6.788s-3.044-6.787-6.802-6.787H17.57a4.004 4.004 0 0 1-4.009-4"
                />
              </g>
            </svg>
          </a>

          <a
            routerLink="/notifications"
            routerLinkActive="active"
            class="app-sidebar-btn"
            aria-label="View notifications"
            title="Notifications"
          >
            <svg width="22" height="22" fill="currentColor" viewBox="0 0 256 256">
              <path [attr.d]="icons['bell']" />
            </svg>
          </a>

          <nav aria-label="Main Navigation" class="app-sidebar-nav">
            @for (item of nav; track item.href) {
              <a
                [routerLink]="item.href"
                routerLinkActive="active"
                class="app-sidebar-btn"
                [attr.aria-label]="item.label"
                [attr.title]="item.label"
              >
                <svg width="22" height="22" fill="currentColor" viewBox="0 0 256 256">
                  <path [attr.d]="icons[item.icon]" />
                </svg>
              </a>
            }
          </nav>
        </div>

        <div class="app-sidebar-bottom">
          <a
            routerLink="/settings"
            routerLinkActive="active"
            class="app-sidebar-btn"
            aria-label="Settings"
            title="Settings"
          >
            <svg width="22" height="22" fill="currentColor" viewBox="0 0 256 256">
              <path [attr.d]="icons['settings']" />
            </svg>
          </a>
          <button
            type="button"
            class="app-sidebar-btn"
            aria-label="Toggle theme"
            title="Theme"
            (click)="toggleTheme()"
          >
            <svg width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
              <path [attr.d]="icons['moon']" />
            </svg>
          </button>
          @if (hasSession()) {
            <button type="button" class="app-sidebar-btn" aria-label="Log out" (click)="logout()">
              <svg width="22" height="22" fill="currentColor" viewBox="0 0 256 256">
                <path [attr.d]="icons['logout']" />
              </svg>
            </button>
          } @else {
            <a routerLink="/login" class="app-sidebar-btn" aria-label="Log in" title="Log in">
              <svg width="22" height="22" fill="currentColor" viewBox="0 0 256 256">
                <path [attr.d]="icons['logout']" />
              </svg>
            </a>
          }
        </div>
      </aside>

      <div class="app-content">
        <router-outlet />
      </div>

      <app-basket-drawer
        [open]="basketOpen()"
        [basket]="basket()"
        [currency]="currency()"
        (close)="basketOpen.set(false)"
        (clear)="persist([])"
        (updateQty)="updateQty($event.key, $event.qty)"
        (remove)="persist(basket().filter((i) => i.key !== $event))"
      />
    </div>
  `,
})
export class AppShellComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly nav = NAV;
  readonly icons = ICONS;
  readonly hasSession = computed(() => !!this.auth.user());

  readonly basket = signal<BasketLine[]>([]);
  readonly currency = signal('USD');
  readonly basketOpen = signal(false);
  readonly count = computed(() => basketCount(this.basket()));

  constructor() {
    const user = this.auth.user();
    if (user?.role === 'Admin') {
      void this.router.navigateByUrl('/admin');
    }
  }

  ngOnInit() {
    this.refreshBasket();
    const unsub = subscribeBasket(() => this.refreshBasket());
    this.destroyRef.onDestroy(unsub);
  }

  refreshBasket() {
    const stored = readBasket();
    this.basket.set(stored.items);
    this.currency.set(stored.currency);
  }

  persist(items: BasketLine[], cur = this.currency()) {
    writeBasket(items, cur);
    this.basket.set(items);
  }

  updateQty(key: string, qty: number) {
    const next = this.basket()
      .map((i) => (i.key === key ? { ...i, qty: Math.min(10, Math.max(1, qty)) } : i))
      .filter((i) => i.qty > 0);
    this.persist(next);
  }

  toggleTheme() {
    const next = document.documentElement.dataset['theme'] !== 'dark';
    document.documentElement.dataset['theme'] = next ? 'dark' : 'light';
    localStorage.setItem('pf-theme', next ? 'dark' : 'light');
  }

  async logout() {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}
