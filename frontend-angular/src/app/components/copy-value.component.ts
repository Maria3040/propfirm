import { Component, input, signal } from '@angular/core';

@Component({
  selector: 'app-copy-value',
  standalone: true,
  template: `
    <dd class="acc-cred-value">
      <span>{{ value() || '—' }}</span>
      @if (value()) {
        <button
          type="button"
          class="acc-copy-btn"
          [attr.aria-label]="'Copy ' + label()"
          (click)="copy()"
        >
          @if (copied()) {
            ✓
          } @else {
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              viewBox="0 0 256 256"
              aria-hidden="true"
            >
              <path
                d="M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32ZM160,208H48V96H160Zm48-48H176V88a8,8,0,0,0-8-8H96V48H208Z"
              />
            </svg>
          }
        </button>
      }
    </dd>
  `,
})
export class CopyValueComponent {
  readonly value = input.required<string>();
  readonly label = input.required<string>();
  readonly copied = signal(false);

  async copy() {
    const value = this.value();
    try {
      await navigator.clipboard.writeText(value);
      this.flash();
    } catch {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.setAttribute('aria-label', 'Clipboard copy buffer');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      this.flash();
    }
  }

  private flash() {
    this.copied.set(true);
    window.setTimeout(() => this.copied.set(false), 1200);
  }
}
