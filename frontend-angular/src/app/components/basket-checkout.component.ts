import {
  Component,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import type { BasketLine } from '../lib/basket-types';
import { createCryptoInvoice } from '../lib/crypto-invoice';

type PayMethod = { id: string; label: string; fee?: string };
type GuestPhase = 'email' | 'country' | 'ready';
type AppliedCoupon = {
  code: string;
  discountAmount: number;
  finalTotal: number;
  message: string;
  kind: string;
};

const COUNTRIES = [
  'Afghanistan',
  'Albania',
  'Algeria',
  'Argentina',
  'Armenia',
  'Australia',
  'Austria',
  'Azerbaijan',
  'Bahrain',
  'Bangladesh',
  'Belgium',
  'Brazil',
  'Bulgaria',
  'Canada',
  'Chile',
  'China',
  'Colombia',
  'Croatia',
  'Cyprus',
  'Czech Republic',
  'Denmark',
  'Egypt',
  'Estonia',
  'Finland',
  'France',
  'Georgia',
  'Germany',
  'Greece',
  'Hong Kong',
  'Hungary',
  'Iceland',
  'India',
  'Indonesia',
  'Iran',
  'Iraq',
  'Ireland',
  'Israel',
  'Italy',
  'Japan',
  'Jordan',
  'Kazakhstan',
  'Kenya',
  'Kuwait',
  'Latvia',
  'Lebanon',
  'Lithuania',
  'Luxembourg',
  'Malaysia',
  'Malta',
  'Mexico',
  'Morocco',
  'Netherlands',
  'New Zealand',
  'Nigeria',
  'Norway',
  'Oman',
  'Pakistan',
  'Philippines',
  'Poland',
  'Portugal',
  'Qatar',
  'Romania',
  'Saudi Arabia',
  'Serbia',
  'Singapore',
  'Slovakia',
  'Slovenia',
  'South Africa',
  'South Korea',
  'Spain',
  'Sweden',
  'Switzerland',
  'Thailand',
  'Turkey',
  'Ukraine',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Vietnam',
].sort((a, b) => a.localeCompare(b));

const PAY_METHODS: PayMethod[] = [
  { id: 'BASIC_CARD', label: 'Credit / Debit Card' },
  { id: 'CRYPTO', label: 'Crypto' },
  { id: 'APPLEPAY', label: 'Apple Pay' },
  { id: 'GOOGLEPAY', label: 'Google Pay' },
  { id: 'BINANCE_PAY', label: 'Binance Pay' },
  { id: 'PAYPAL', label: 'PayPal' },
  { id: 'NETELLER', label: 'Neteller', fee: '+4%' },
  { id: 'PAYSAFECARD', label: 'Paysafecard', fee: '+10%' },
  { id: 'SKRILL', label: 'Skrill', fee: '+4%' },
];

const MAX_ALLOCATION = 400_000;
const MAX_ACCOUNTS = 10;

const FX: Record<string, { rate: number; symbol: string }> = {
  USD: { rate: 1, symbol: '$' },
  EUR: { rate: 0.92, symbol: '€' },
  GBP: { rate: 0.79, symbol: '£' },
  CHF: { rate: 0.88, symbol: 'Fr' },
  CAD: { rate: 1.36, symbol: 'C$' },
  INR: { rate: 83, symbol: '₹' },
};

function sizeText(n: number) {
  return n >= 1000 ? `$${n / 1000}k` : `$${n}`;
}

function money(n: number, currency: string) {
  const fx = FX[currency] || FX['USD'];
  return `${fx.symbol}${(n * fx.rate).toFixed(2)}`;
}

@Component({
  selector: 'app-basket-checkout',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section id="basket-checkout" class="bc-page">
      <header class="bc-head">
        <button type="button" class="bc-back" (click)="back.emit()">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
            <path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z" />
          </svg>
          Add another challenge
        </button>
        <h1 id="cart-checkout-heading" tabindex="-1">Checkout</h1>
        <p>{{ count }} challenge{{ count === 1 ? '' : 's' }}</p>
      </header>

      <div class="bc-grid">
        <div class="bc-main">
          <section aria-label="Checkout identity" class="bc-identity">
            @if (phase !== 'ready') {
              <section class="bc-identity-panel">
                <header>
                  <h2>Continue as guest</h2>
                  <p>
                    {{
                      phase === 'email'
                        ? 'Enter your email to continue with this basket.'
                        : 'Select your country to continue.'
                    }}
                  </p>
                </header>

                <div class="bc-identity-panel-body">
                  @if (phase === 'email') {
                    <form class="bc-guest-form" (ngSubmit)="onEmailContinue($event)" novalidate>
                      <div class="bc-field">
                        <label for="guest-checkout-email">Email address</label>
                        <input
                          id="guest-checkout-email"
                          type="email"
                          autocomplete="email"
                          placeholder="you@example.com"
                          [(ngModel)]="email"
                          name="guestEmail"
                          [attr.aria-invalid]="err ? true : null"
                        />
                      </div>
                      @if (err) {
                        <p class="err">{{ err }}</p>
                      }
                      <button type="submit" class="bc-continue" [disabled]="busy">
                        {{ busy ? 'Please wait…' : 'Continue' }}
                      </button>
                    </form>
                  } @else {
                    <form class="bc-guest-form" (ngSubmit)="onCountryContinue($event)" novalidate>
                      <div class="bc-field">
                        <label for="guest-checkout-email-ro">Email address</label>
                        <input id="guest-checkout-email-ro" type="email" [value]="email" readonly />
                      </div>
                      <div class="bc-field">
                        <label for="guest-checkout-country">Country</label>
                        <div class="bc-country" #guestCountryRoot>
                          <button
                            type="button"
                            id="guest-checkout-country"
                            class="bc-country-trigger"
                            [class.has-value]="!!country"
                            [attr.aria-expanded]="countryOpen === 'guest'"
                            aria-haspopup="listbox"
                            aria-controls="guest-checkout-country-listbox"
                            [attr.aria-invalid]="err && !country ? true : null"
                            (click)="toggleCountry('guest')"
                          >
                            <span [class.placeholder]="!country">{{ country || 'Select a country' }}</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                              <path d="M181.66,170.34a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-48-48a8,8,0,0,1,11.32-11.32L128,212.69l42.34-42.35A8,8,0,0,1,181.66,170.34Zm-96-84.68L128,43.31l42.34,42.35a8,8,0,0,0,11.32-11.32l-48-48a8,8,0,0,0-11.32,0l-48,48A8,8,0,0,0,85.66,85.66Z" />
                            </svg>
                          </button>
                          @if (countryOpen === 'guest') {
                            <div class="bc-country-popover" role="presentation">
                              <input
                                type="search"
                                class="bc-country-search"
                                placeholder="Search country…"
                                [(ngModel)]="countryQuery"
                                name="guestCountryQuery"
                                aria-label="Search country"
                                autocomplete="off"
                                #guestCountrySearch
                              />
                              <ul id="guest-checkout-country-listbox" role="listbox" class="bc-country-list" aria-label="Countries">
                                @for (c of filteredCountries(); track c) {
                                  <li role="option" [attr.aria-selected]="c === country">
                                    <button type="button" [class.on]="c === country" (click)="pickCountry(c)">{{ c }}</button>
                                  </li>
                                }
                                @if (!filteredCountries().length) {
                                  <li class="bc-country-empty">No countries found</li>
                                }
                              </ul>
                            </div>
                          }
                        </div>
                      </div>
                      @if (err) {
                        <p class="err">{{ err }}</p>
                      }
                      <button type="submit" class="bc-continue" [disabled]="busy">
                        {{ busy ? 'Please wait…' : 'Continue' }}
                      </button>
                    </form>
                  }
                </div>

                <footer>
                  <div class="bc-identity-footer">
                    <div class="bc-secure">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                        <path d="M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96ZM208,208H48V96H208V208Zm-68-56a12,12,0,1,1-12-12A12,12,0,0,1,140,152Z" />
                      </svg>
                      Your basket is protected by an encrypted browser session.
                    </div>
                    <p class="bc-signin">
                      Already have an account?
                      <a [routerLink]="['/login']" [queryParams]="{ next: signInNext }">Sign in</a>
                    </p>
                  </div>
                </footer>
              </section>
            } @else {
              <div class="bc-contact-summary">
                <div>
                  <h2>Contact</h2>
                  <p>{{ email }}</p>
                </div>
                <p class="bc-signed-in">Signed in</p>
              </div>
            }
          </section>

          <section aria-labelledby="cart-items-heading">
            <div class="bc-items-head">
              <h2 id="cart-items-heading">Basket items</h2>
              <button type="button" class="bc-clear" (click)="clear.emit()" [disabled]="!basket.length">Clear basket</button>
            </div>
            <div class="bc-items">
              @for (item of basket; track item.key) {
                <article class="bc-item">
                  <div class="bc-item-row">
                    <div>
                      <h3>{{ item.title }}</h3>
                      <p>{{ item.platformShort }}{{ item.swapFree ? ' · Swap Free' : '' }}</p>
                    </div>
                    <div class="bc-item-controls">
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
                      </div>
                      <strong>{{ money(item.unitPrice * item.qty, currency) }}</strong>
                      <button
                        type="button"
                        class="cfg-remove-item"
                        [attr.aria-label]="'Remove ' + item.title"
                        (click)="remove.emit(item.key)"
                      >
                        ⌫
                      </button>
                    </div>
                  </div>
                </article>
              }
              @if (!basket.length) {
                <p class="cfg-drawer-empty">Your basket is empty.</p>
              }
            </div>
          </section>

          @if (phase === 'ready') {
            <section aria-labelledby="billing-details-heading" class="bc-billing" id="billing-details">
              <h2 class="sr-only" id="billing-details-heading">Billing Details</h2>
              <div class="bc-billing-head">
                <div>
                  <p class="bc-billing-title">Billing Details</p>
                  <p class="bc-billing-sub">Enter your billing information for the challenge purchase</p>
                </div>
              </div>

              <div class="bc-billing-form">
                <div class="bc-billing-grid2">
                  <div class="bc-field">
                    <label for="billing.first_name">First Name</label>
                    <input id="billing.first_name" [(ngModel)]="billing.firstName" name="firstName" placeholder="John" />
                  </div>
                  <div class="bc-field">
                    <label for="billing.last_name">Last Name</label>
                    <input id="billing.last_name" [(ngModel)]="billing.lastName" name="lastName" placeholder="Doe" />
                  </div>
                </div>

                <div class="bc-field">
                  <label for="billing.country">Country</label>
                  <div class="bc-country" #billingCountryRoot>
                    <button
                      type="button"
                      id="billing.country"
                      class="bc-country-trigger"
                      [class.has-value]="!!country"
                      [attr.aria-expanded]="countryOpen === 'billing'"
                      aria-haspopup="listbox"
                      aria-controls="billing-country-listbox"
                      (click)="toggleCountry('billing')"
                    >
                      <span [class.placeholder]="!country">{{ country || 'Select a country' }}</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                        <path d="M181.66,170.34a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-48-48a8,8,0,0,1,11.32-11.32L128,212.69l42.34-42.35A8,8,0,0,1,181.66,170.34Zm-96-84.68L128,43.31l42.34,42.35a8,8,0,0,0,11.32-11.32l-48-48a8,8,0,0,0-11.32,0l-48,48A8,8,0,0,0,85.66,85.66Z" />
                      </svg>
                    </button>
                    @if (countryOpen === 'billing') {
                      <div class="bc-country-popover" role="presentation">
                        <input
                          type="search"
                          class="bc-country-search"
                          placeholder="Search country…"
                          [(ngModel)]="countryQuery"
                          name="billingCountryQuery"
                          aria-label="Search country"
                          autocomplete="off"
                        />
                        <ul id="billing-country-listbox" role="listbox" class="bc-country-list" aria-label="Countries">
                          @for (c of filteredCountries(); track c) {
                            <li role="option" [attr.aria-selected]="c === country">
                              <button type="button" [class.on]="c === country" (click)="pickCountry(c)">{{ c }}</button>
                            </li>
                          }
                          @if (!filteredCountries().length) {
                            <li class="bc-country-empty">No countries found</li>
                          }
                        </ul>
                      </div>
                    }
                  </div>
                </div>

                <div class="bc-field">
                  <label for="billing.street">Billing Address</label>
                  <input
                    id="billing.street"
                    [(ngModel)]="billing.street"
                    name="street"
                    placeholder="123, Billing Street"
                  />
                </div>

                <div class="bc-billing-grid2">
                  <div class="bc-field">
                    <label for="billing.city">City</label>
                    <input id="billing.city" [(ngModel)]="billing.city" name="city" placeholder="New York" />
                  </div>
                  <div class="bc-field">
                    <label for="billing.postal_code">ZIP / Postal Code</label>
                    <input
                      id="billing.postal_code"
                      [(ngModel)]="billing.postal"
                      name="postal"
                      placeholder="10001"
                    />
                  </div>
                </div>
              </div>
            </section>
          }
        </div>

        <aside class="bc-aside">
          <div class="bc-summary-card">
            <section aria-labelledby="cart-summary-heading" class="bc-summary">
              <h2 id="cart-summary-heading">Order summary</h2>
              <dl>
                <div>
                  <dt>Subtotal</dt>
                  <dd>{{ money(total, currency) }}</dd>
                </div>
                @if (appliedCoupon) {
                  <div>
                    <dt>Discount ({{ appliedCoupon.code }})</dt>
                    <dd>−{{ money(appliedCoupon.discountAmount, currency) }}</dd>
                  </div>
                }
              </dl>
              <div class="bc-summary-total">
                <span>Total</span>
                <strong>{{ money(payableTotal, currency) }}</strong>
              </div>
              <p class="bc-charge">You will be charged in {{ currency }}.</p>

              @if (phase === 'ready' && attention.length > 0) {
                <div class="bc-alert" role="alert">
                  <div class="bc-alert-inner">
                    <span class="bc-alert-icon" aria-hidden="true">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                        <path d="M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96ZM208,208H48V96H208V208Zm-68-56a12,12,0,1,1-12-12A12,12,0,0,1,140,152Z" />
                      </svg>
                    </span>
                    <div>
                      <h3>Some items need attention</h3>
                      <ul>
                        @for (a of attention; track a) {
                          <li>{{ a }}</li>
                        }
                      </ul>
                    </div>
                  </div>
                </div>
              }

              @if (phase === 'ready') {
                <section class="bc-alloc-inline" aria-label="Account allocation">
                  <div class="cfg-alloc-row">
                    <span>Allocation after checkout</span>
                    <span>{{ sizeText(allocSize) }} of {{ sizeText(MAX_ALLOCATION) }}</span>
                  </div>
                  <div class="cfg-alloc-bar" role="progressbar" [attr.aria-valuenow]="allocSize">
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
              }
            </section>

            @if (phase === 'ready') {
              <section class="bc-coupon" aria-label="Coupon">
                <label for="cart-coupon">Coupon code</label>
                <div class="bc-coupon-row">
                  <input
                    id="cart-coupon"
                    [ngModel]="coupon"
                    (ngModelChange)="onCouponInput($event)"
                    name="coupon"
                    autocomplete="off"
                    placeholder="WELCOME10"
                  />
                  @if (appliedCoupon) {
                    <button type="button" (click)="clearCoupon()">Remove</button>
                  } @else {
                    <button type="button" [disabled]="!coupon.trim() || couponBusy || total <= 0" (click)="applyCoupon()">
                      {{ couponBusy ? '…' : 'Apply' }}
                    </button>
                  }
                </div>
                @if (couponMsg) {
                  <p [class]="appliedCoupon ? 'bc-coupon-ok' : 'err'" role="status">{{ couponMsg }}</p>
                } @else {
                  <p class="bc-coupon-hint">Try WELCOME10, SAVE20, or FLAT50</p>
                }
              </section>

              <section class="bc-pay-methods" aria-label="Payment methods">
                <label class="bc-pay-label">Select payment method</label>
                @if (!country) {
                  <p class="bc-pay-empty" role="status">Select your billing country to see available payment methods.</p>
                } @else {
                  <div class="bc-pay-list" role="radiogroup" aria-label="Payment methods">
                    @for (m of payMethods; track m.id) {
                      <div class="bc-pay-block">
                        <button
                          type="button"
                          role="radio"
                          [attr.aria-checked]="paymentMethod === m.id"
                          [attr.aria-label]="m.label"
                          class="bc-pay-row"
                          [class.on]="paymentMethod === m.id"
                          (click)="selectPayment(m.id)"
                        >
                          <span class="bc-pay-radio" [class.on]="paymentMethod === m.id">
                            @if (paymentMethod === m.id) {
                              <span></span>
                            }
                          </span>
                          <span class="bc-pay-copy">
                            <span class="bc-pay-name">{{ m.label }}</span>
                            @if (m.fee) {
                              <span class="bc-pay-fee">{{ m.fee }}</span>
                            }
                          </span>
                          @switch (m.id) {
                            @case ('BASIC_CARD') {
                              <span class="bc-pay-brands bc-pay-brands-card" aria-hidden="true">
                                <svg viewBox="0 0 48 16" class="bc-brand-visa">
                                  <text x="0" y="13" fill="#1430BF" font-size="14" font-weight="700" font-family="Arial,sans-serif">VISA</text>
                                </svg>
                                <svg viewBox="0 0 32 20" class="bc-brand-mc">
                                  <circle cx="12" cy="10" r="8" fill="#EB001B" />
                                  <circle cx="20" cy="10" r="8" fill="#F79E1B" />
                                  <path d="M16 4.2a8 8 0 0 1 0 11.6 8 8 0 0 1 0-11.6z" fill="#FF5A00" />
                                </svg>
                              </span>
                            }
                            @case ('CRYPTO') {
                              <svg viewBox="0 0 32 32" class="bc-brand-crypto" aria-hidden="true">
                                <circle cx="16" cy="16" r="16" fill="#F7931A" />
                                <path
                                  fill="#FFF"
                                  d="M21.2 14.1c.2-1.4-.9-2.2-2.3-2.7l.5-1.9-1.2-.3-.5 1.8c-.3-.1-.6-.1-.9-.2l.5-1.8-1.2-.3-.5 1.9c-.2-.1-.5-.1-.7-.2l-1.6-.4-.3 1.2s.9.2.8.2c.5.1.6.4.5.7l-.5 2.2.1 0-.8 3.1c-.1.1-.2.3-.5.3l-.8-.2-.6 1.3 1.5.4c.3.1.6.1.8.2l-.5 1.9 1.2.3.5-1.9c.3.1.6.2.9.2l-.5 1.9 1.2.3.5-1.9c2 .4 3.5.2 4.1-1.6.5-1.4 0-2.3-1.1-2.8.8-.2 1.3-.7 1.5-1.7zm-2.6 3.7c-.4 1.4-2.8.7-3.6.5l.6-2.5c.8.2 3.3.6 3 2zm.4-3.7c-.3 1.3-2.3.6-3 .5l.6-2.3c.6.2 2.7.5 2.4 1.8z"
                                />
                              </svg>
                            }
                            @case ('APPLEPAY') {
                              <svg viewBox="0 0 52 20" class="bc-brand-word" aria-hidden="true">
                                <text x="0" y="15" fill="currentColor" font-size="13" font-weight="600" font-family="Arial,sans-serif">Pay</text>
                              </svg>
                            }
                            @case ('GOOGLEPAY') {
                              <svg viewBox="0 0 64 20" class="bc-brand-word" aria-hidden="true">
                                <text x="0" y="15" fill="currentColor" font-size="12" font-weight="600" font-family="Arial,sans-serif">GPay</text>
                              </svg>
                            }
                            @case ('BINANCE_PAY') {
                              <svg viewBox="0 0 32 32" class="bc-brand-crypto" aria-hidden="true">
                                <circle cx="16" cy="16" r="16" fill="#F0B90B" />
                                <path
                                  fill="#FFF"
                                  d="M12.1 14.4 16 10.5l3.9 3.9 2.3-2.3L16 6l-6.1 6.1 2.2 2.3ZM6 16l2.3-2.3L10.5 16l-2.2 2.3L6 16zm6.1 1.6L16 21.5l3.9-3.9 2.3 2.3L16 26l-6.1-6.1 2.2-2.3zm9.4-1.6 2.2-2.3L26 16l-2.3 2.3L21.5 16z"
                                />
                              </svg>
                            }
                            @case ('PAYPAL') {
                              <span class="bc-brand-paypal" aria-hidden="true">PayPal</span>
                            }
                            @case ('NETELLER') {
                              <span class="bc-brand-neteller" aria-hidden="true">Neteller</span>
                            }
                            @case ('PAYSAFECARD') {
                              <span class="bc-brand-psc" aria-hidden="true">paysafecard</span>
                            }
                            @default {
                              <span class="bc-brand-skrill" aria-hidden="true">Skrill</span>
                            }
                          }
                        </button>

                        @if (paymentMethod === m.id) {
                          <div class="bc-pay-expand">
                            <div class="bc-pay-expand-inner">
                              <div class="bc-policy">
                                <button
                                  type="button"
                                  role="checkbox"
                                  [attr.aria-checked]="policiesAccepted"
                                  [attr.id]="'cart-policies-' + m.id"
                                  class="bc-checkbox"
                                  [class.on]="policiesAccepted"
                                  (click)="togglePolicies()"
                                >
                                  @if (policiesAccepted) {
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                                      <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z" />
                                    </svg>
                                  }
                                </button>
                                <label [attr.for]="'cart-policies-' + m.id" class="bc-policy-label">
                                  I have read and agreed to the
                                  <a href="https://fundingpips.com/trading-objectives" target="_blank" rel="noopener noreferrer">Trading Objectives</a>
                                  and
                                  <a href="https://fundingpips.com/legal/terms-and-conditions" target="_blank" rel="noopener noreferrer">Terms &amp; Conditions</a>
                                  . All information provided is correct and matches government-issued ID.
                                </label>
                              </div>

                              @if (err) {
                                <p class="err">{{ err }}</p>
                              }

                              <button
                                type="button"
                                class="bc-pay-continue"
                                [disabled]="!canContinuePayment"
                                (click)="pay()"
                              >
                                {{ busy ? 'Processing…' : 'Continue to payment' }}
                              </button>

                              <p class="bc-secure-checkout">
                                <span>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                                    <path d="M208,40H48A16,16,0,0,0,32,56v56c0,52.72,25.52,84.67,46.93,102.19,23.06,18.86,46,25.26,47,25.53a8,8,0,0,0,4.2,0c1-.27,23.91-6.67,47-25.53C198.48,196.67,224,164.72,224,112V56A16,16,0,0,0,208,40Zm0,72c0,37.07-13.66,67.16-40.6,89.42A129.3,129.3,0,0,1,128,223.62a128.25,128.25,0,0,1-38.92-21.81C61.82,179.51,48,149.3,48,112l0-56,160,0ZM82.34,141.66a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32l-56,56a8,8,0,0,1-11.32,0Z" />
                                  </svg>
                                  <span>Secure checkout</span>
                                </span>
                                <span class="bc-secure-sub">Your basket is kept if payment does not complete.</span>
                              </p>
                            </div>
                          </div>
                        }
                      </div>
                    }
                  </div>
                }
              </section>
            }
          </div>
        </aside>
      </div>
    </section>
  `,
})
export class BasketCheckoutComponent implements OnChanges {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);

  @Input({ required: true }) basket: BasketLine[] = [];
  @Input() currency = 'USD';

  readonly back = output<void>();
  readonly clear = output<void>();
  readonly updateQty = output<{ key: string; qty: number }>();
  readonly remove = output<string>();
  readonly paid = output<string | undefined>();

  readonly Math = Math;
  readonly MAX_ALLOCATION = MAX_ALLOCATION;
  readonly MAX_ACCOUNTS = MAX_ACCOUNTS;
  readonly payMethods = PAY_METHODS;
  readonly money = money;
  readonly sizeText = sizeText;

  phase: GuestPhase = 'email';
  email = '';
  country = '';
  err = '';
  busy = false;
  coupon = '';
  appliedCoupon: AppliedCoupon | null = null;
  couponBusy = false;
  couponMsg = '';
  billing = { firstName: '', lastName: '', street: '', city: '', postal: '' };
  paymentMethod = '';
  policiesAccepted = false;
  countryOpen: '' | 'guest' | 'billing' = '';
  countryQuery = '';
  signInNext = '/checkout#basket-checkout';

  count = 0;
  total = 0;
  payableTotal = 0;
  allocSize = 0;
  allocPct = 0;
  attention: string[] = [];

  constructor() {
    const existing = this.auth.user();
    if (existing) {
      this.phase = 'ready';
      this.email = existing.email || '';
    }
    if (typeof window !== 'undefined') {
      this.signInNext = `${window.location.pathname}#basket-checkout`;
    }
  }

  ngOnChanges(_changes: SimpleChanges) {
    this.recalc();
  }

  get canContinuePayment() {
    return !!this.country && !!this.paymentMethod && this.policiesAccepted && this.basket.length > 0 && !this.busy;
  }

  filteredCountries() {
    const q = this.countryQuery.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.toLowerCase().includes(q));
  }

  @HostListener('document:mousedown', ['$event'])
  onDocMouseDown(e: MouseEvent) {
    if (!this.countryOpen) return;
    const t = e.target as Node;
    if (!this.host.nativeElement.contains(t)) {
      this.countryOpen = '';
      return;
    }
    const root = (e.target as HTMLElement | null)?.closest?.('.bc-country');
    if (!root) this.countryOpen = '';
  }

  toggleCountry(which: 'guest' | 'billing') {
    if (this.countryOpen === which) {
      this.countryOpen = '';
      return;
    }
    this.countryOpen = which;
    this.countryQuery = '';
  }

  pickCountry(next: string) {
    this.country = next;
    this.paymentMethod = '';
    this.policiesAccepted = false;
    this.err = '';
    this.countryOpen = '';
    this.recalc();
  }

  selectPayment(id: string) {
    this.paymentMethod = id;
    this.err = '';
    this.recalc();
  }

  togglePolicies() {
    this.policiesAccepted = !this.policiesAccepted;
    this.err = '';
  }

  onCouponInput(value: string) {
    this.coupon = (value || '').toUpperCase();
    if (this.appliedCoupon) this.appliedCoupon = null;
  }

  private recalc() {
    this.count = this.basket.reduce((n, i) => n + i.qty, 0);
    this.total = this.basket.reduce((n, i) => n + i.unitPrice * i.qty, 0);
    this.payableTotal = this.appliedCoupon ? this.appliedCoupon.finalTotal : this.total;
    this.allocSize = this.basket.reduce((n, i) => n + i.accountSize * i.qty, 0);
    this.allocPct = Math.min(100, (this.allocSize / MAX_ALLOCATION) * 100);
    const items: string[] = [];
    if (this.phase === 'ready' && !this.country) items.push('Please set your country');
    if (this.phase === 'ready' && this.country && !this.paymentMethod) {
      items.push('Select a payment method');
    }
    this.attention = items;
  }

  /**
   * Guest checkout: create session via register, or login with the demo guest password
   * if that email was already registered on a previous attempt.
   */
  private async ensureGuestSession(trimmed: string): Promise<boolean> {
    if (this.auth.user()) return true;
    try {
      await this.auth.register(trimmed, 'GuestCheckout1!', trimmed.split('@')[0] || 'Guest');
      return !!this.auth.user();
    } catch {
      try {
        await this.auth.login(trimmed, 'GuestCheckout1!');
        return !!this.auth.user();
      } catch {
        return false;
      }
    }
  }

  async onEmailContinue(e: Event) {
    e.preventDefault();
    this.err = '';
    const trimmed = this.email.trim();
    if (!trimmed.includes('@')) {
      this.err = 'Enter a valid email address.';
      return;
    }
    this.busy = true;
    try {
      const ok = await this.ensureGuestSession(trimmed);
      if (!ok) {
        this.err =
          'Could not start guest checkout for this email. Sign in with your account, or use a new email.';
        return;
      }
      this.phase = 'country';
    } finally {
      this.busy = false;
    }
  }

  async onCountryContinue(e: Event) {
    e.preventDefault();
    this.err = '';
    if (!this.country) {
      this.err = 'Select your country.';
      return;
    }
    this.busy = true;
    try {
      const ok = await this.ensureGuestSession(this.email.trim());
      if (!ok) {
        this.err =
          'Could not start guest checkout for this email. Sign in with your account, or use a new email.';
        return;
      }
      const parts = this.email.split('@')[0].split(/[._-]/).filter(Boolean);
      const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : '');
      this.billing = {
        ...this.billing,
        firstName: this.billing.firstName || cap(parts[0] || ''),
        lastName: this.billing.lastName || cap(parts[1] || ''),
      };
      this.phase = 'ready';
      this.recalc();
    } finally {
      this.busy = false;
    }
  }

  async applyCoupon() {
    this.couponMsg = '';
    this.err = '';
    const code = this.coupon.trim();
    if (!code) {
      this.couponMsg = 'Enter a coupon code';
      return;
    }
    this.couponBusy = true;
    try {
      const res = await this.api.request<{
        valid: boolean;
        code: string;
        kind: string;
        discountAmount: number;
        finalTotal: number;
        message: string;
      }>('/api/coupons/validate', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ code, subtotal: this.total }),
      });
      this.appliedCoupon = {
        code: res.code,
        discountAmount: res.discountAmount,
        finalTotal: res.finalTotal,
        message: res.message,
        kind: res.kind,
      };
      this.coupon = res.code;
      this.couponMsg = res.message;
      this.recalc();
    } catch (ex: unknown) {
      this.appliedCoupon = null;
      this.couponMsg = ex instanceof Error ? ex.message : 'Invalid coupon';
      this.recalc();
    } finally {
      this.couponBusy = false;
    }
  }

  clearCoupon() {
    this.appliedCoupon = null;
    this.couponMsg = '';
    this.coupon = '';
    this.recalc();
  }

  async pay() {
    if (!this.basket.length) return;
    if (!this.country) {
      this.err = 'Please set your country';
      return;
    }
    if (!this.paymentMethod) {
      this.err = 'Select a payment method';
      return;
    }
    if (!this.policiesAccepted) {
      this.err = 'Please accept the Trading Objectives and Terms & Conditions.';
      return;
    }
    if (!this.auth.user()) {
      const ok = await this.ensureGuestSession(this.email.trim());
      if (!ok || !this.auth.user()) {
        this.err = 'Sign in required to complete payment for this email.';
        return;
      }
    }

    if (this.paymentMethod === 'CRYPTO') {
      this.busy = true;
      this.err = '';
      try {
        const invoice = createCryptoInvoice({
          amountUsd: this.payableTotal,
          currency: this.currency,
          basket: this.basket,
          email: this.email,
          returnPath: `${window.location.pathname}#basket-checkout`,
        });
        await this.router.navigateByUrl(`/pay/confirmo?invoice=${encodeURIComponent(invoice.invoiceId)}`);
      } catch (ex: unknown) {
        this.err = ex instanceof Error ? ex.message : 'Could not start crypto checkout';
        this.busy = false;
      }
      return;
    }

    this.busy = true;
    this.err = '';
    try {
      let lastChallenge: string | undefined;
      let flatCouponUsed = false;
      for (const item of this.basket) {
        let couponCode: string | undefined;
        if (this.appliedCoupon) {
          if (this.appliedCoupon.kind === 'flat') {
            if (!flatCouponUsed) {
              couponCode = this.appliedCoupon.code;
              flatCouponUsed = true;
            }
          } else {
            couponCode = this.appliedCoupon.code;
          }
        }
        const order = await this.api.request<{ orderId: string }>('/api/orders', {
          method: 'POST',
          body: JSON.stringify({
            productId: item.productId,
            addonSwapFree: item.swapFree,
            platform: item.platform,
            quantity: item.qty,
            couponCode,
          }),
        });
        const paid = await this.api.request<{ challengeId?: string }>(`/api/orders/${order.orderId}/confirm`, {
          method: 'POST',
        });
        lastChallenge = paid.challengeId || lastChallenge;
      }
      this.paid.emit(lastChallenge);
    } catch (ex: unknown) {
      this.err = ex instanceof Error ? ex.message : 'payment failed';
    } finally {
      this.busy = false;
    }
  }
}
