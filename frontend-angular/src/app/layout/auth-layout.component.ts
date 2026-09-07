import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  template: `
    <div class="auth-page">
      <button
        type="button"
        class="auth-theme-toggle"
        [attr.aria-label]="dark ? 'Switch to light mode' : 'Switch to dark mode'"
        (click)="toggleTheme()"
      >
        @if (dark) {
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
            <path d="M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm80,80a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V216A8,8,0,0,0,128,208Zm112-88H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Z" />
          </svg>
        } @else {
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
            <path d="M233.54,142.23a8,8,0,0,0-8-2,88.08,88.08,0,0,1-109.8-109.8,8,8,0,0,0-10-10,104.84,104.84,0,0,0-52.91,37A104,104,0,0,0,136,224a103.09,103.09,0,0,0,62.52-20.88,104.84,104.84,0,0,0,37-52.91A8,8,0,0,0,233.54,142.23ZM188.9,190.34A88,88,0,0,1,65.66,67.11a89,89,0,0,1,31.4-26A106,106,0,0,0,96,56,104.11,104.11,0,0,0,200,160a106,106,0,0,0,14.92-1.06A89,89,0,0,1,188.9,190.34Z" />
          </svg>
        }
      </button>
      <div class="auth-layout">
        <div class="auth-layout-center">
          <div class="auth-brand-block">
            <h1>
              <svg viewBox="0 0 182 36" fill="none" aria-label="PropFirm" class="auth-lockup">
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
            </h1>
            <h2 class="auth-title">{{ title }}</h2>
          </div>
          <div class="auth-form-wrap">
            <ng-content />
          </div>
        </div>
      </div>
    </div>
  `,
})
export class AuthLayoutComponent {
  @Input({ required: true }) title = '';
  dark = false;

  constructor() {
    if (typeof localStorage !== 'undefined') {
      this.dark = localStorage.getItem('pf-theme') === 'dark';
      document.documentElement.dataset['theme'] = this.dark ? 'dark' : 'light';
    }
  }

  toggleTheme() {
    this.dark = !this.dark;
    document.documentElement.dataset['theme'] = this.dark ? 'dark' : 'light';
    localStorage.setItem('pf-theme', this.dark ? 'dark' : 'light');
  }
}

@Component({
  selector: 'app-auth-footer-link',
  standalone: true,
  imports: [RouterLink],
  template: `
    <p class="auth-footer">
      {{ prefix }}
      <a [routerLink]="href" class="auth-link">{{ label }}</a>
    </p>
  `,
})
export class AuthFooterLinkComponent {
  @Input({ required: true }) href = '';
  @Input({ required: true }) label = '';
  @Input({ required: true }) prefix = '';
}
