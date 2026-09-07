import { Component, HostListener, input, output } from '@angular/core';

/** In-app confirm dialog — replaces browser `confirm()` / `alert()` for approvals. */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  template: `
    @if (open()) {
      <div
        class="pf-dialog-backdrop"
        role="presentation"
        (click)="!busy() && cancel.emit()"
      >
        <div
          class="pf-dialog"
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="titleId"
          [attr.aria-describedby]="description() ? descId : null"
          (click)="$event.stopPropagation()"
        >
          <div class="pf-dialog-header">
            <h2 [id]="titleId">{{ title() }}</h2>
            @if (description()) {
              <p [id]="descId" class="pf-dialog-desc">{{ description() }}</p>
            }
          </div>
          <div class="pf-dialog-footer">
            <button
              type="button"
              class="pf-dialog-cancel"
              [disabled]="busy()"
              (click)="$event.preventDefault(); $event.stopPropagation(); cancel.emit()"
            >
              {{ cancelLabel() }}
            </button>
            <button
              type="button"
              class="pf-dialog-confirm"
              [class.danger]="danger()"
              [disabled]="busy()"
              (click)="$event.preventDefault(); $event.stopPropagation(); confirm.emit()"
            >
              {{ busy() ? 'Please wait…' : confirmLabel() }}
            </button>
          </div>
          <button
            type="button"
            class="pf-dialog-x"
            aria-label="Close"
            [disabled]="busy()"
            (click)="cancel.emit()"
          >
            ×
          </button>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialogComponent {
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly description = input<string>();
  readonly confirmLabel = input('Confirm');
  readonly cancelLabel = input('Cancel');
  readonly danger = input(false);
  readonly busy = input(false);

  readonly confirm = output<void>();
  readonly cancel = output<void>();

  readonly titleId = `pf-dialog-title-${Math.random().toString(36).slice(2, 9)}`;
  readonly descId = `pf-dialog-desc-${Math.random().toString(36).slice(2, 9)}`;

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.open() && !this.busy()) this.cancel.emit();
  }
}
