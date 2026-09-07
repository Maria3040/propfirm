import { Component, HostListener, Input, OnChanges, SimpleChanges, inject, output } from '@angular/core';
import { Router } from '@angular/router';
import type { BasketLine } from '../lib/basket-types';

const MAX_ALLOCATION = 400_000;
const MAX_ACCOUNTS = 10;

function sizeText(n: number) {
  return n >= 1000 ? `$${n / 1000}k` : `$${n}`;
}

function money(n: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

@Component({
  selector: 'app-basket-drawer',
  standalone: true,
  template: `
    @if (open) {
      <div class="cfg-drawer-root" role="presentation">
        <button type="button" class="cfg-drawer-backdrop" aria-label="Close basket" (click)="close.emit()"></button>
        <aside class="cfg-drawer" role="dialog" aria-modal="true" aria-labelledby="basket-title">
          <header class="cfg-drawer-head">
            <h2 id="basket-title">Your basket</h2>
            <button type="button" class="cfg-drawer-close" aria-label="Close" (click)="close.emit()">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z" />
              </svg>
            </button>
          </header>

          <div class="cfg-drawer-body">
            <div class="cfg-drawer-count-row">
              <p>{{ count }} challenge{{ count === 1 ? '' : 's' }}</p>
              <button type="button" class="cfg-clear-basket" [disabled]="!basket.length" (click)="clear.emit()">
                Clear basket
              </button>
            </div>

            <section class="cfg-alloc" aria-label="Account allocation">
              <div class="cfg-alloc-row">
                <span>Allocation after checkout</span>
                <span>{{ sizeText(allocSize) }} of {{ sizeText(MAX_ALLOCATION) }}</span>
              </div>
              <div
                class="cfg-alloc-bar"
                role="progressbar"
                [attr.aria-valuemin]="0"
                [attr.aria-valuemax]="MAX_ALLOCATION"
                [attr.aria-valuenow]="allocSize"
                aria-label="Allocation after checkout"
              >
                <div [style.width.%]="allocPct"></div>
              </div>
              <p class="cfg-alloc-hint">{{ sizeText(Math.max(0, MAX_ALLOCATION - allocSize)) }} remaining</p>
              <div class="cfg-alloc-accounts">
                <div class="cfg-alloc-row">
                  <span>Accounts after checkout</span>
                  <span>{{ count }} of {{ MAX_ACCOUNTS }}</span>
                </div>
                <p class="cfg-alloc-hint">{{ Math.max(0, MAX_ACCOUNTS - count) }} account slots remaining</p>
              </div>
            </section>

            <div class="cfg-drawer-items">
              @if (!basket.length) {
                <p class="cfg-drawer-empty">Your basket is empty.</p>
              } @else {
                @for (item of basket; track item.key) {
                  <article class="cfg-cart-item">
                    <div class="cfg-cart-top">
                      <div>
                        <h3>{{ item.title }}</h3>
                        <p>{{ item.platformShort }}{{ item.swapFree ? ' · Swap Free' : '' }}</p>
                      </div>
                      <div class="cfg-cart-price">
                        <span>Challenge total</span>
                        <strong>{{ money(item.unitPrice * item.qty, currency) }}</strong>
                      </div>
                    </div>
                    <div class="cfg-cart-qty">
                      <span>Quantity</span>
                      <div class="cfg-qty-controls">
                        <button type="button" class="cfg-max" (click)="updateQty.emit({ key: item.key, qty: 10 })">
                          Max <span>|</span> <span>10</span>
                        </button>
                        <div class="cfg-stepper" role="group">
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            (click)="updateQty.emit({ key: item.key, qty: item.qty - 1 })"
                          >
                            −
                          </button>
                          <span>{{ item.qty }}</span>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            [disabled]="item.qty >= 10"
                            (click)="updateQty.emit({ key: item.key, qty: item.qty + 1 })"
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          class="cfg-remove-item"
                          [attr.aria-label]="'Remove ' + item.title + ' from basket'"
                          (click)="remove.emit(item.key)"
                        >
                          ⌫
                        </button>
                      </div>
                    </div>
                  </article>
                }
              }
            </div>
          </div>

          <footer class="cfg-drawer-foot">
            <div class="cfg-drawer-total">
              <span>Total</span>
              <strong>{{ money(total, currency) }}</strong>
            </div>
            <p class="cfg-drawer-charge">You will be charged in {{ currency }}.</p>
            @if (basket.length) {
              <button type="button" class="cfg-btn primary" (click)="onContinue()">Continue to checkout</button>
            } @else {
              <button type="button" class="cfg-btn primary" (click)="startChallenge()">Start a challenge</button>
            }
            <button type="button" class="cfg-add-another" (click)="startChallenge()">Add another challenge</button>
          </footer>
        </aside>
      </div>
    }
  `,
})
export class BasketDrawerComponent implements OnChanges {
  private readonly router = inject(Router);

  @Input({ required: true }) open = false;
  @Input({ required: true }) basket: BasketLine[] = [];
  @Input() currency = 'USD';

  readonly close = output<void>();
  readonly clear = output<void>();
  readonly updateQty = output<{ key: string; qty: number }>();
  readonly remove = output<string>();
  readonly continueCheckout = output<void>();

  readonly Math = Math;
  readonly MAX_ALLOCATION = MAX_ALLOCATION;
  readonly MAX_ACCOUNTS = MAX_ACCOUNTS;
  readonly sizeText = sizeText;
  readonly money = money;

  count = 0;
  total = 0;
  allocSize = 0;
  allocPct = 0;

  ngOnChanges(_changes: SimpleChanges) {
    this.recalc();
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.open) this.close.emit();
  }

  private recalc() {
    this.count = this.basket.reduce((n, i) => n + (i.qty || 0), 0);
    this.total = this.basket.reduce((n, i) => n + i.unitPrice * i.qty, 0);
    this.allocSize = this.basket.reduce((n, i) => n + i.accountSize * i.qty, 0);
    this.allocPct = Math.min(100, (this.allocSize / MAX_ALLOCATION) * 100);
  }

  onContinue() {
    this.continueCheckout.emit();
  }

  startChallenge() {
    this.close.emit();
    void this.router.navigateByUrl('/');
  }
}
