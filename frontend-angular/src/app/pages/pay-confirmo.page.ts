import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../core/api.service';
import { writeBasket } from '../lib/basket';
import { clearCryptoInvoice, loadCryptoInvoice, type CryptoInvoice } from '../lib/crypto-invoice';

type Token = {
  id: string;
  title: string;
  color: string;
  networks: { id: string; label: string }[];
};

const TOKENS: Token[] = [
  { id: 'usdc', title: 'USDC', color: '#2775CA', networks: [{ id: 'ethereum', label: 'Ethereum' }, { id: 'solana', label: 'Solana' }] },
  { id: 'usdt', title: 'USDT', color: '#26A17B', networks: [{ id: 'ethereum', label: 'Ethereum' }, { id: 'tron', label: 'Tron' }, { id: 'solana', label: 'Solana' }] },
  { id: 'usdg', title: 'USDG', color: '#1B6BFF', networks: [{ id: 'ethereum', label: 'Ethereum' }, { id: 'solana', label: 'Solana' }] },
  { id: 'btc', title: 'Bitcoin', color: '#F7931A', networks: [{ id: 'bitcoin', label: 'Bitcoin' }, { id: 'lightning', label: 'Lightning' }] },
  { id: 'eth', title: 'Ethereum', color: '#627EEA', networks: [{ id: 'ethereum', label: 'Ethereum' }] },
  { id: 'sol', title: 'Solana', color: '#9945FF', networks: [{ id: 'solana', label: 'Solana' }] },
  { id: 'ltc', title: 'Litecoin', color: '#345D9D', networks: [{ id: 'litecoin', label: 'Litecoin' }] },
];

function mockAddress(tokenId: string, networkId: string) {
  if (networkId === 'bitcoin' || tokenId === 'btc') return 'bc1qpropfirmmockpaymentaddress000000xyz';
  if (networkId === 'tron') return 'TPropFirmMockTronAddress0000000001';
  if (networkId === 'solana' || tokenId === 'sol') return 'SoLPropFirmMock1111111111111111111111111';
  return '0xPropFirmMockEthereumAddress000000000001';
}

@Component({
  selector: 'app-pay-confirmo-page',
  standalone: true,
  template: `
    @if (!invoice()) {
      <div class="cfm-root">
        <div class="cfm-card">
          <main class="cfm-main">
            <h1 class="cfm-heading">Invoice not found</h1>
            <p class="cfm-sub">This mock Confirmo invoice expired or was never created.</p>
            <button type="button" class="cfm-primary" (click)="router.navigateByUrl('/')">Back to catalog</button>
          </main>
        </div>
      </div>
    } @else {
      <div class="cfm-root">
        <div class="cfm-card">
          <header class="cfm-nav">
            <button type="button" class="cfm-return" (click)="onReturn()">← Return</button>
            <div class="cfm-pills" role="progressbar" [attr.aria-valuenow]="progress()" aria-valuemin="1" aria-valuemax="4" aria-label="Checkout progress">
              @for (n of [1, 2, 3, 4]; track n) {
                <span class="cfm-pill" [class.active]="n <= progress()" [class.pending]="n > progress()"></span>
              }
            </div>
            <button type="button" class="cfm-overlay-btn" aria-label="Open overlay" (click)="overlayOpen.set(true)">
              <span class="cfm-lang">🌐 en</span>
              <span aria-hidden="true">?</span>
            </button>
          </header>

          <main class="cfm-main">
            @if (step() === 'select') {
              <div class="cfm-heading-block">
                <h1 class="cfm-heading">{{ tab() === 'token' ? 'Select token' : 'Select network' }}</h1>
                <p class="cfm-sub">
                  {{
                    tab() === 'token'
                      ? 'Payment selection requires two steps. A crypto token and a network to carry it. You must send the token on the network you select.'
                      : 'Choose the network for ' + (token()?.title || 'your token') + '. Sending on the wrong network may result in loss of funds.'
                  }}
                </p>
              </div>
              <div class="cfm-tabs" role="tablist">
                <button type="button" role="tab" class="cfm-tab" [class.active]="tab() === 'token'" [attr.aria-selected]="tab() === 'token'" (click)="tab.set('token')">Token</button>
                <button type="button" role="tab" class="cfm-tab" [class.active]="tab() === 'network'" [attr.aria-selected]="tab() === 'network'" [disabled]="!tokenId()" (click)="tokenId() && tab.set('network')">Network</button>
              </div>
              @if (tab() === 'token') {
                <ul class="cfm-list">
                  @for (t of tokens; track t.id) {
                    <li>
                      <button type="button" class="cfm-list-btn" [class.on]="tokenId() === t.id" (click)="selectToken(t.id)">
                        <div class="cfm-token-icon" [style.background]="t.color" aria-hidden="true">{{ t.title.slice(0, 1) }}</div>
                        <span class="cfm-list-text">
                          <span class="cfm-list-title">{{ t.title }}</span>
                          <span class="cfm-list-sub">{{ t.networks.length }} network{{ t.networks.length === 1 ? '' : 's' }}</span>
                        </span>
                      </button>
                    </li>
                  }
                </ul>
              } @else {
                <ul class="cfm-list">
                  @for (n of token()?.networks || []; track n.id) {
                    <li>
                      <button type="button" class="cfm-list-btn" [class.on]="networkId() === n.id" (click)="networkId.set(n.id)">
                        <div class="cfm-token-icon" [style.background]="token()?.color || '#888'" aria-hidden="true">{{ n.label.slice(0, 1) }}</div>
                        <span class="cfm-list-text">
                          <span class="cfm-list-title">{{ n.label }}</span>
                          <span class="cfm-list-sub">{{ token()?.title }}</span>
                        </span>
                      </button>
                    </li>
                  }
                </ul>
              }
            }

            @if (step() === 'pay' && token() && network()) {
              <div class="cfm-pay">
                <div class="cfm-heading-block">
                  <h1 class="cfm-heading">Send payment</h1>
                  <p class="cfm-sub">
                    Send exactly the amount below using {{ token()!.title }} on {{ network()!.label }}. This is a local mock — no real blockchain transfer is required.
                  </p>
                </div>
                <div class="cfm-pay-card">
                  <div class="cfm-pay-row"><span>Amount</span><strong>{{ invoice()!.amountUsd.toFixed(2) }} {{ token()!.title }}</strong></div>
                  <div class="cfm-pay-row"><span>Network</span><strong>{{ network()!.label }}</strong></div>
                  <div class="cfm-address">
                    <span>Deposit address</span>
                    <code>{{ address() }}</code>
                    <button type="button" (click)="copyAddress()">{{ copied() ? 'Copied' : 'Copy' }}</button>
                  </div>
                  <div class="cfm-qr" aria-hidden="true"><div class="cfm-qr-inner"></div></div>
                </div>
                @if (err()) {
                  <p class="err">{{ err() }}</p>
                }
                <button type="button" class="cfm-primary" [disabled]="busy()" (click)="simulatePaid()">
                  {{ busy() ? 'Confirming…' : 'Simulate payment received' }}
                </button>
              </div>
            }

            @if (step() === 'done') {
              <div class="cfm-done">
                <div class="cfm-done-icon" aria-hidden="true">✓</div>
                <h1 class="cfm-heading">Payment confirmed</h1>
                <p class="cfm-sub">Redirecting to your challenge…</p>
              </div>
            }
          </main>

          @if (step() === 'select') {
            <footer class="cfm-dock">
              <div class="cfm-price-row">
                <span>Product price</span>
                <span>{{ amountLabel() }}</span>
              </div>
              <button type="button" class="cfm-dock-btn" [disabled]="!token() || !network()" (click)="step.set('pay')">
                <span class="cfm-dock-icons">
                  @if (token()) {
                    <div class="cfm-token-icon" [style.background]="token()!.color" aria-hidden="true">{{ token()!.title.slice(0, 1) }}</div>
                  } @else {
                    <span class="cfm-dock-placeholder-icon"></span>
                  }
                  @if (network()) {
                    <div class="cfm-token-icon" style="background:#222" aria-hidden="true">{{ network()!.label.slice(0, 1) }}</div>
                  } @else {
                    <span class="cfm-dock-placeholder-icon"></span>
                  }
                </span>
                <span class="cfm-dock-label">
                  {{ token() && network() ? 'Continue with ' + token()!.title : token() ? 'Select network' : 'Select token' }}
                </span>
              </button>
              <p class="cfm-cookies">
                By using this service, you agree to our
                <a href="https://confirmo.com/legal-and-regulatory" target="_blank" rel="noopener noreferrer">Cookie Policy</a>.
                <span class="cfm-mock-tag">Mock gateway</span>
              </p>
            </footer>
          }
        </div>

        @if (overlayOpen()) {
          <div class="cfm-support" role="dialog" aria-modal="true" aria-label="Support">
            <div class="cfm-support-inner">
              <header>
                <button type="button" class="cfm-return" (click)="overlayOpen.set(false)">Close ×</button>
              </header>
              <section class="cfm-support-list">
                <div class="cfm-support-item"><span>Language</span><strong>English</strong></div>
                <div class="cfm-support-item"><span>Payment ID</span><strong [title]="invoice()!.invoiceId">{{ invoice()!.invoiceId }}</strong></div>
                <div class="cfm-support-item"><span>Support</span><strong>support&#64;confirmo.com</strong></div>
              </section>
              <footer>
                <p>Mock of <a href="https://confirmo.com" target="_blank" rel="noopener noreferrer">confirmo.com</a></p>
              </footer>
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class PayConfirmoPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);

  readonly tokens = TOKENS;
  readonly invoice = signal<CryptoInvoice | null>(null);
  readonly tab = signal<'token' | 'network'>('token');
  readonly tokenId = signal('');
  readonly networkId = signal('');
  readonly step = signal<'select' | 'pay' | 'done'>('select');
  readonly overlayOpen = signal(false);
  readonly busy = signal(false);
  readonly err = signal('');
  readonly copied = signal(false);

  readonly token = computed(() => TOKENS.find((t) => t.id === this.tokenId()) || null);
  readonly network = computed(() => this.token()?.networks.find((n) => n.id === this.networkId()) || null);
  readonly progress = computed(() => {
    if (this.step() === 'done') return 4;
    if (this.step() === 'pay') return 3;
    if (this.tokenId()) return 2;
    return 1;
  });
  readonly amountLabel = computed(() => {
    const inv = this.invoice();
    if (!inv) return '—';
    return `${inv.amountUsd.toFixed(2)} ${inv.currency}`;
  });
  readonly address = computed(() => {
    const t = this.token();
    const n = this.network();
    return t && n ? mockAddress(t.id, n.id) : '';
  });

  ngOnInit() {
    const stored = loadCryptoInvoice();
    const q = this.route.snapshot.queryParamMap.get('invoice');
    if (stored && (!q || q === stored.invoiceId)) this.invoice.set(stored);
    else this.invoice.set(null);
  }

  onReturn() {
    if (this.step() === 'pay') {
      this.step.set('select');
      return;
    }
    if (this.tab() === 'network' && this.tokenId()) {
      this.tab.set('token');
      return;
    }
    void this.router.navigateByUrl(this.invoice()?.returnPath || '/');
  }

  selectToken(id: string) {
    this.tokenId.set(id);
    this.networkId.set('');
    this.tab.set('network');
  }

  async simulatePaid() {
    const invoice = this.invoice();
    if (!invoice) return;
    this.busy.set(true);
    this.err.set('');
    try {
      for (const item of invoice.basket) {
        const order = await this.api.request<{ orderId: string }>('/api/orders', {
          method: 'POST',
          body: JSON.stringify({
            productId: item.productId,
            addonSwapFree: item.swapFree,
            platform: item.platform,
            quantity: item.qty,
          }),
        });
        await this.api.request(`/api/orders/${order.orderId}/confirm`, { method: 'POST' });
      }
      clearCryptoInvoice();
      writeBasket([]);
      this.step.set('done');
      setTimeout(() => void this.router.navigateByUrl('/accounts'), 1200);
    } catch (ex: unknown) {
      this.err.set(ex instanceof Error ? ex.message : 'Payment confirmation failed');
    } finally {
      this.busy.set(false);
    }
  }

  async copyAddress() {
    try {
      await navigator.clipboard.writeText(this.address());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    } catch {
      /* ignore */
    }
  }
}
