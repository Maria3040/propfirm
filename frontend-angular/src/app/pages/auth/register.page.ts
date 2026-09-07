import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthFooterLinkComponent, AuthLayoutComponent } from '../../layout/auth-layout.component';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [FormsModule, AuthLayoutComponent, AuthFooterLinkComponent],
  template: `
    <app-auth-layout title="Create your account">
      <form class="auth-form" (ngSubmit)="onSubmit()" novalidate>
        <div class="auth-field">
          <label for="displayName">Display name</label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            autocomplete="name"
            [(ngModel)]="displayName"
          />
        </div>
        <div class="auth-field">
          <label for="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autocomplete="email"
            required
            [(ngModel)]="email"
          />
        </div>
        <div class="auth-field">
          <label for="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autocomplete="new-password"
            required
            [(ngModel)]="password"
          />
        </div>
        @if (err()) {
          <p class="auth-err">{{ err() }}</p>
        }
        <button class="auth-submit" type="submit" [disabled]="busy()">
          {{ busy() ? 'Creating…' : 'Create account' }}
        </button>
      </form>
      <app-auth-footer-link href="/login" prefix="Already have an account?" label="Sign in" />
    </app-auth-layout>
  `,
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  email = '';
  password = '';
  displayName = '';
  readonly err = signal('');
  readonly busy = signal(false);

  async onSubmit() {
    this.err.set('');
    this.busy.set(true);
    try {
      let clientIp: string | undefined;
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json', {
          signal: AbortSignal.timeout(3000),
        });
        if (ipRes.ok) {
          const ipJson = (await ipRes.json()) as { ip?: string };
          clientIp = ipJson.ip;
        }
      } catch {
        /* optional */
      }
      await this.auth.register(
        this.email,
        this.password,
        this.displayName || this.email.split('@')[0],
        clientIp,
      );
      await this.router.navigateByUrl('/accounts');
    } catch (ex: unknown) {
      this.err.set(ex instanceof Error ? ex.message : 'Registration failed');
    } finally {
      this.busy.set(false);
    }
  }
}
