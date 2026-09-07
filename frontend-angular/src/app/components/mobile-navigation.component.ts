import {
  Component,
  DestroyRef,
  OnInit,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs/operators';

const PRIMARY = [
  { href: '/accounts', label: 'Dashboard', match: 'dashboard' as const },
  { href: '/accounts', label: 'Accounts', match: 'accounts' as const },
  { href: '/new-challenge', label: 'New Challenge', match: 'path' as const },
  { href: '/payouts', label: 'Rewards', match: 'path' as const },
  { href: '/competitions', label: 'Competitions', match: 'path' as const },
];

const SECONDARY = [
  { href: '/leaderboards', label: 'Leaderboards' },
  { href: '/certificates', label: 'Certificates' },
  { href: '/economic-calendar', label: 'Economic Calendar' },
  { href: '/tools', label: 'Tools' },
  { href: '/trade-copier', label: 'Trade Copier' },
  { href: '/affiliate', label: 'Affiliate' },
  { href: '/settings', label: 'Settings' },
];

const ICON_BELL =
  'M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80Z';
const ICON_BASKET =
  'M136,120v56a8,8,0,0,1-16,0V120a8,8,0,0,1,16,0Zm36.84-.8-5.6,56A8,8,0,0,0,174.4,184a7.32,7.32,0,0,0,.81,0,8,8,0,0,0,7.95-7.2l5.6-56a8,8,0,0,0-15.92-1.6Zm-89.68,0a8,8,0,0,0-15.92,1.6l5.6,56a8,8,0,0,0,8,7.2,7.32,7.32,0,0,0,.81,0,8,8,0,0,0,7.16-8.76ZM239.93,89.06,224.86,202.12A16.06,16.06,0,0,1,209,216H47a16.06,16.06,0,0,1-15.86-13.88L16.07,89.06A8,8,0,0,1,24,80H68.37L122,18.73a8,8,0,0,1,12,0L187.63,80H232a8,8,0,0,1,7.93,9.06ZM89.63,80h76.74L128,36.15ZM222.86,96H33.14L47,200H209Z';
const ICON_MENU =
  'M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z';
const ICON_CLOSE =
  'M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z';
const ICON_MOON =
  'M233.54,142.23a8,8,0,0,0-8-2,88.08,88.08,0,0,1-109.8-109.8,8,8,0,0,0-10-10,104.84,104.84,0,0,0,52.91,37A104,104,0,0,0,136,224a103.09,103.09,0,0,0,62.52-20.88,104.84,104.84,0,0,0,37-52.91A8,8,0,0,0,233.54,142.23ZM188.9,190.34A88,88,0,0,1,65.66,67.11a89,89,0,0,1,31.4-26A106,106,0,0,0,96,56,104.11,104.11,0,0,0,200,160a106,106,0,0,0,14.92-1.06A89,89,0,0,1,188.9,190.34Z';
const ICON_LOGOUT =
  'M120,216a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V40a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H56V208h56A8,8,0,0,1,120,216Zm109.66-93.66-40-40a8,8,0,0,0-11.32,11.32L204.69,120H112a8,8,0,0,0,0,16h92.69l-26.35,26.34a8,8,0,0,0,11.32,11.32l40-40A8,8,0,0,0,229.66,122.34Z';

@Component({
  selector: 'app-mobile-navigation',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="mobile-nav-bar">
      <div class="mobile-nav-bar-inner">
        <a routerLink="/accounts" class="mobile-nav-brand" aria-label="Go to Dashboard">
          <svg viewBox="0 0 182 36" fill="none" aria-label="PropFirm" class="mobile-nav-lockup">
            <g fill="currentColor" transform="translate(0 2) scale(0.65)">
              <path
                fill-rule="evenodd"
                d="M8.294 4.586c0 2.21-1.795 4-4.01 4a4.004 4.004 0 0 1-4.008-4c0-2.209 1.795-4 4.009-4a4.004 4.004 0 0 1 4.009 4m10.022 34c0-2.209 1.795-4 4.009-4a4.004 4.004 0 0 1 4.009 4v6c0 2.209-1.795 4-4.01 4a4.005 4.005 0 0 1-4.008-4z"
              />
              <path
                fill-rule="evenodd"
                d="M13.561 4.586c0-2.209 1.795-4 4.009-4h11.983c8.185 0 14.82 6.62 14.82 14.787s-6.635 14.788-14.82 14.788H8.293v14.425c0 2.209-1.794 4-4.008 4a4.005 4.005 0 0 1-4.01-4V22.161h29.278c3.758 0 6.802-3.04 6.802-6.788s-3.044-6.787-6.802-6.787H17.57a4.004 4.004 0 0 1-4.009-4"
              />
            </g>
            <text
              x="42"
              y="25"
              fill="currentColor"
              font-family="DM Sans, system-ui, sans-serif"
              font-size="18"
              font-weight="700"
              letter-spacing="0.02em"
            >
              PropFirm
            </text>
          </svg>
        </a>
        <div class="mobile-nav-actions">
          <a
            routerLink="/notifications"
            routerLinkActive="active"
            class="mobile-nav-icon-btn"
            aria-label="View notifications"
            title="Notifications"
          >
            <svg width="24" height="24" fill="currentColor" viewBox="0 0 256 256" class="mm-icon-md">
              <path [attr.d]="iconBell" />
            </svg>
          </a>
          <button
            type="button"
            class="mobile-nav-icon-btn"
            [attr.aria-label]="basketCount() ? 'Basket, ' + basketCount() : 'Basket'"
            title="Basket"
            (click)="openBasket.emit()"
          >
            <svg width="24" height="24" fill="currentColor" viewBox="0 0 256 256" class="mm-icon-md">
              <path [attr.d]="iconBasket" />
            </svg>
            @if (basketCount() > 0) {
              <span class="mobile-nav-badge">{{ basketCount() }}</span>
            }
          </button>
          <button
            type="button"
            class="mobile-nav-icon-btn"
            aria-label="Open menu"
            aria-haspopup="dialog"
            [attr.aria-expanded]="open()"
            (click)="setOpen(true)"
          >
            <svg width="24" height="24" fill="currentColor" viewBox="0 0 256 256" class="mm-icon-lg">
              <path [attr.d]="iconMenu" />
            </svg>
          </button>
        </div>
      </div>
    </header>

    @if (open()) {
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-nav-title"
        class="mobile-menu-surface"
      >
        <div class="mobile-menu-header">
          <h2 id="mobile-nav-title" class="sr-only">Main Navigation</h2>
          <a
            routerLink="/accounts"
            class="mobile-nav-brand"
            aria-label="Go to Dashboard"
            (click)="close()"
          >
            <svg viewBox="0 0 182 36" fill="none" aria-label="PropFirm" class="mobile-nav-lockup">
              <g fill="currentColor" transform="translate(0 2) scale(0.65)">
                <path
                  fill-rule="evenodd"
                  d="M8.294 4.586c0 2.21-1.795 4-4.01 4a4.004 4.004 0 0 1-4.008-4c0-2.209 1.795-4 4.009-4a4.004 4.004 0 0 1 4.009 4m10.022 34c0-2.209 1.795-4 4.009-4a4.004 4.004 0 0 1 4.009 4v6c0 2.209-1.795 4-4.01 4a4.005 4.005 0 0 1-4.008-4z"
                />
                <path
                  fill-rule="evenodd"
                  d="M13.561 4.586c0-2.209 1.795-4 4.009-4h11.983c8.185 0 14.82 6.62 14.82 14.787s-6.635 14.788-14.82 14.788H8.293v14.425c0 2.209-1.794 4-4.008 4a4.005 4.005 0 0 1-4.01-4V22.161h29.278c3.758 0 6.802-3.04 6.802-6.788s-3.044-6.787-6.802-6.787H17.57a4.004 4.004 0 0 1-4.009-4"
                />
              </g>
              <text
                x="42"
                y="25"
                fill="currentColor"
                font-family="DM Sans, system-ui, sans-serif"
                font-size="18"
                font-weight="700"
                letter-spacing="0.02em"
              >
                PropFirm
              </text>
            </svg>
          </a>
          <button type="button" class="mobile-menu-close" aria-label="Close menu" (click)="close()">
            <span class="sr-only">Close menu</span>
            <svg
              width="24"
              height="24"
              fill="currentColor"
              viewBox="0 0 256 256"
              class="mm-icon-lg"
              aria-hidden="true"
            >
              <path [attr.d]="iconClose" />
            </svg>
          </button>
        </div>

        <nav aria-label="Main Navigation" class="mobile-menu-nav">
          <ul class="mobile-menu-list">
            @for (item of primary; track item.label; let i = $index) {
              <li class="mobile-menu-item" [style.--mobile-menu-index]="i">
                <a [routerLink]="item.href" (click)="close()">
                  <span class="mobile-menu-link large" [class.active]="isPrimaryActive(item)">
                    <span>{{ item.label }}</span>
                    @if (isPrimaryActive(item)) {
                      <span aria-hidden="true" class="mobile-menu-dot"></span>
                    }
                  </span>
                </a>
              </li>
            }
          </ul>

          <div class="mobile-menu-item mobile-menu-divider" style="--mobile-menu-index: 5"></div>

          <ul class="mobile-menu-list">
            @for (item of secondary; track item.href; let i = $index) {
              <li class="mobile-menu-item" [style.--mobile-menu-index]="6 + i">
                <a [routerLink]="item.href" (click)="close()">
                  <span class="mobile-menu-link" [class.active]="isPathActive(item.href)">
                    <span>{{ item.label }}</span>
                    @if (isPathActive(item.href)) {
                      <span aria-hidden="true" class="mobile-menu-dot"></span>
                    }
                  </span>
                </a>
              </li>
            }
            <li class="mobile-menu-item" style="--mobile-menu-index: 13">
              <button type="button" class="mobile-menu-support" (click)="support()">
                <span class="mobile-menu-link"><span>Support</span></span>
              </button>
            </li>
          </ul>
        </nav>

        <div class="mobile-menu-item mobile-menu-footer" style="--mobile-menu-index: 16">
          <button type="button" class="mobile-menu-footer-btn" (click)="toggleTheme()">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 256 256" class="mm-icon-sm">
              <path [attr.d]="iconMoon" />
            </svg>
            <span>{{ dark() ? 'Light mode' : 'Dark mode' }}</span>
          </button>
          <button
            type="button"
            class="mobile-menu-footer-btn"
            [attr.aria-label]="hasSession() ? 'Log out' : 'Log in'"
            (click)="onAuthAction()"
          >
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
              <path [attr.d]="iconLogout" />
            </svg>
            <span>{{ hasSession() ? 'Log out' : 'Log in' }}</span>
          </button>
        </div>
      </div>
    }
  `,
})
export class MobileNavigationComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly basketCount = input(0);
  readonly hasSession = input(false);
  readonly openBasket = output<void>();
  readonly logout = output<void>();

  readonly open = signal(false);
  readonly dark = signal(false);
  readonly path = signal('');

  readonly primary = PRIMARY;
  readonly secondary = SECONDARY;
  readonly iconBell = ICON_BELL;
  readonly iconBasket = ICON_BASKET;
  readonly iconMenu = ICON_MENU;
  readonly iconClose = ICON_CLOSE;
  readonly iconMoon = ICON_MOON;
  readonly iconLogout = ICON_LOGOUT;

  private prevOverflow = '';

  constructor() {
    effect(() => {
      if (this.open()) {
        this.prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = this.prevOverflow;
      }
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.open()) this.close();
    };
    window.addEventListener('keydown', onKey);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = this.prevOverflow;
    });
  }

  ngOnInit() {
    this.path.set(this.router.url.split('?')[0] || '/');
    const stored = localStorage.getItem('pf-theme');
    const isDark = stored === 'dark';
    this.dark.set(isDark);
    document.documentElement.dataset['theme'] = isDark ? 'dark' : 'light';

    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => {
        this.path.set(e.urlAfterRedirects.split('?')[0] || '/');
        this.close();
      });
  }

  setOpen(value: boolean) {
    this.open.set(value);
  }

  close() {
    this.open.set(false);
  }

  isPrimaryActive(item: (typeof PRIMARY)[number]) {
    const pathname = this.path();
    if (item.match === 'dashboard') {
      return pathname === '/dashboard';
    }
    if (item.match === 'accounts') {
      return (
        pathname === '/accounts' ||
        pathname.startsWith('/accounts/') ||
        pathname.startsWith('/challenges/')
      );
    }
    return this.isPathActive(item.href);
  }

  isPathActive(href: string) {
    const pathname = this.path();
    if (href === '/settings') return pathname.startsWith('/settings');
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  toggleTheme() {
    const next = !this.dark();
    this.dark.set(next);
    document.documentElement.dataset['theme'] = next ? 'dark' : 'light';
    localStorage.setItem('pf-theme', next ? 'dark' : 'light');
  }

  support() {
    window.open('mailto:support@propfirm.local');
  }

  onAuthAction() {
    this.close();
    if (this.hasSession()) {
      this.logout.emit();
    } else {
      void this.router.navigateByUrl('/login');
    }
  }
}
