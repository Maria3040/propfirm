import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthFooterLinkComponent, AuthLayoutComponent } from '../../layout/auth-layout.component';

@Component({
  selector: 'app-forgot-password-page',
  standalone: true,
  imports: [FormsModule, AuthLayoutComponent, AuthFooterLinkComponent],
  template: `
    <app-auth-layout title="Reset your password">
      @if (sent()) {
        <p class="auth-sent">
          If an account exists for <strong>{{ email }}</strong>, a reset link would be sent. (Demo — no
          email is sent.)
        </p>
      } @else {
        <form class="auth-form" (ngSubmit)="onSubmit()" novalidate>
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
          <button class="auth-submit" type="submit">Send reset link</button>
        </form>
      }
      <app-auth-footer-link href="/login" prefix="Remembered it?" label="Back to sign in" />
    </app-auth-layout>
  `,
})
export class ForgotPasswordPage {
  email = '';
  readonly sent = signal(false);

  onSubmit() {
    this.sent.set(true);
  }
}
