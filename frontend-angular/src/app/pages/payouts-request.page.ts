import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { accountNo, moneyPlain, sizeLabel, typeLabel } from '../core/models';
import {
  CRYPTO_WALLET_NETWORKS,
  loadSavedCryptoWallets,
  saveCryptoWallets,
  toPayoutNetwork,
  type SavedCryptoWallet,
} from '../data/crypto-wallets';

type EligibleAccount = {
  id: string;
  sku: string;
  status: string;
  accountSize: number;
  equity: number;
  login: string | null;
  platform: string | null;
  profitSplitPct?: number;
  grossProfit?: number;
  profitShareCap?: number;
  alreadyRequested?: number;
  profitShareAvailable?: number;
  withdrawable?: number;
};

type EligibleResponse = {
  availableBalance: number;
  accounts: EligibleAccount[];
};

const METHODS = [
  { id: 'crypto' as const, label: 'Crypto' },
  { id: 'rise' as const, label: 'Rise' },
  { id: 'bank' as const, label: 'Bank transfer' },
];

function accountWithdrawable(a: EligibleAccount): number {
  if (typeof a.withdrawable === 'number') return a.withdrawable;
  if (typeof a.profitShareAvailable === 'number') return a.profitShareAvailable;
  return Math.max(0, Number(a.grossProfit || 0));
}

@Component({
  selector: 'app-payouts-request-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="rw-page">
      <div class="rw-heading">
        <h1>Request A Reward</h1>
      </div>

      @if (err()) {
        <p class="err">{{ err() }}</p>
      }

      @if (!data() && !err()) {
        <p class="meta">Loading…</p>
      } @else if (!data()?.accounts?.length) {
        <div class="rw-empty-eligible">
          <div class="rw-empty-eligible-inner">
            <h2>No Eligible Accounts</h2>
            <p>
              You don't have any accounts eligible for a reward yet. Keep trading and meet your
              targets to become eligible.
            </p>
            <div class="rw-empty-actions">
              <a routerLink="/payouts" class="rw-btn">Back to Rewards</a>
              <a routerLink="/accounts" class="rw-btn rw-btn-secondary">View Accounts</a>
            </div>
          </div>
        </div>
      } @else {
        <form class="rw-card rw-request-wizard" (ngSubmit)="submit()">
          <p class="rw-form-hint">
            Rewards wallet: <strong>{{ moneyPlain(data()!.availableBalance) }}</strong> · You can
            only withdraw each funded account's <strong>profit share</strong>.
          </p>

          <label>
            Account
            <select [(ngModel)]="challengeId" name="challengeId" required (ngModelChange)="onAccountChange($event)">
              @for (a of data()!.accounts; track a.id) {
                <option [value]="a.id">
                  {{ accountNo(a) }} · {{ typeLabel(a.sku) }} · {{ sizeLabel(a.accountSize) }} · up
                  to {{ moneyPlain(withdrawable(a)) }}
                </option>
              }
            </select>
          </label>

          @if (selected(); as sel) {
            <div class="rw-form-hint rw-profit-share">
              <div>
                Equity {{ moneyPlain(sel.equity ?? sel.accountSize)
                }}{{ sel.platform ? ' · ' + sel.platform : '' }}
              </div>
              <div>
                Gross profit {{ moneyPlain(sel.grossProfit ?? 0) }} · Split
                {{ sel.profitSplitPct ?? '—' }}% · Cap {{ moneyPlain(sel.profitShareCap ?? 0) }}
              </div>
              <div>
                Already requested {{ moneyPlain(sel.alreadyRequested ?? 0) }} ·
                <strong>Withdrawable {{ moneyPlain(maxAmount()) }}</strong>
              </div>
            </div>
          }

          <label>
            Amount (USD)
            <input type="number" min="0.01" step="0.01" [(ngModel)]="amount" name="amount" required />
          </label>

          <fieldset class="rw-method">
            <legend>Payout method</legend>
            <div class="rw-method-options">
              @for (m of methods; track m.id) {
                <label [class.on]="method === m.id">
                  <input type="radio" name="method" [value]="m.id" [(ngModel)]="method" />
                  {{ m.label }}
                </label>
              }
            </div>
          </fieldset>

          @if (method === 'crypto') {
            <div class="rw-wallet-block">
              @if (wallets().length > 0 && !addingWallet()) {
                <label>
                  Payout wallet
                  <select [(ngModel)]="walletId" name="walletId" required>
                    @for (w of wallets(); track w.id) {
                      <option [value]="w.id">
                        {{ w.label }} · {{ w.network }} · {{ w.address.slice(0, 8) }}…{{
                          w.address.slice(-6)
                        }}
                      </option>
                    }
                  </select>
                </label>
                <p class="rw-form-hint">
                  <button type="button" class="rw-link-btn" (click)="addingWallet.set(true)">
                    Add another wallet
                  </button>
                </p>
              } @else {
                <fieldset class="rw-add-wallet">
                  <legend>{{ wallets().length === 0 ? 'Add payout wallet' : 'Add another wallet' }}</legend>
                  <label>
                    Label (optional)
                    <input [(ngModel)]="newLabel" name="newLabel" placeholder="e.g. Main USDT" />
                  </label>
                  <label>
                    Network
                    <select [(ngModel)]="newNetwork" name="newNetwork" required>
                      @for (n of networks; track n) {
                        <option [value]="n">{{ n }}</option>
                      }
                    </select>
                  </label>
                  <label>
                    Wallet address
                    <input
                      [(ngModel)]="newAddress"
                      name="newAddress"
                      placeholder="Paste your payout address"
                      required
                      autocomplete="off"
                    />
                  </label>
                  @if (walletErr()) {
                    <p class="err">{{ walletErr() }}</p>
                  }
                  <div class="rw-empty-actions">
                    @if (wallets().length > 0) {
                      <button
                        type="button"
                        class="rw-btn rw-btn-secondary"
                        (click)="addingWallet.set(false)"
                      >
                        Cancel
                      </button>
                    }
                    <button type="button" class="rw-btn" (click)="persistNewWallet()">Save wallet</button>
                  </div>
                </fieldset>
              }
            </div>
          }

          @if (method === 'bank') {
            <p class="rw-form-hint">
              Bank details will be collected by our team after you submit this request.
            </p>
          }
          @if (method === 'rise') {
            <p class="rw-form-hint">
              We will reach out with Rise onboarding instructions after you submit.
            </p>
          }

          <div class="rw-empty-actions">
            <a routerLink="/payouts" class="rw-btn rw-btn-secondary">Cancel</a>
            <button class="rw-btn" type="submit" [disabled]="busy() || maxAmount() <= 0">
              {{ busy() ? 'Submitting…' : 'Submit request' }}
            </button>
          </div>
        </form>
      }
    </div>
  `,
})
export class PayoutsRequestPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly methods = METHODS;
  readonly networks = CRYPTO_WALLET_NETWORKS;
  readonly moneyPlain = moneyPlain;
  readonly accountNo = accountNo;
  readonly typeLabel = typeLabel;
  readonly sizeLabel = sizeLabel;
  readonly withdrawable = accountWithdrawable;

  readonly data = signal<EligibleResponse | null>(null);
  readonly err = signal('');
  readonly busy = signal(false);
  readonly wallets = signal<SavedCryptoWallet[]>([]);
  readonly addingWallet = signal(false);
  readonly walletErr = signal('');

  challengeId = '';
  amount = '';
  method: (typeof METHODS)[number]['id'] = 'crypto';
  walletId = '';
  newLabel = '';
  newNetwork: string = CRYPTO_WALLET_NETWORKS[0];
  newAddress = '';

  readonly selected = computed(
    () => this.data()?.accounts.find((a) => a.id === this.challengeId) ?? null,
  );
  readonly maxAmount = computed(() => {
    const sel = this.selected();
    return sel ? accountWithdrawable(sel) : 0;
  });

  ngOnInit() {
    const saved = loadSavedCryptoWallets();
    this.wallets.set(saved);
    if (saved[0]) {
      this.walletId = saved[0].id;
      this.addingWallet.set(false);
    } else {
      this.addingWallet.set(true);
    }

    void this.api
      .request<EligibleResponse>('/api/payouts/eligible')
      .then((res) => {
        this.data.set(res);
        const first = res.accounts[0];
        if (first) {
          this.challengeId = first.id;
          const max = accountWithdrawable(first);
          if (max > 0) this.amount = String(Math.min(max, Number(max.toFixed(2))));
        }
      })
      .catch((e: unknown) => this.err.set(e instanceof Error ? e.message : String(e)));
  }

  onAccountChange(id: string) {
    this.challengeId = id;
    const acc = this.data()?.accounts.find((a) => a.id === id);
    if (!acc) return;
    const max = accountWithdrawable(acc);
    this.amount = max > 0 ? String(Number(max.toFixed(2))) : '';
  }

  persistNewWallet(): SavedCryptoWallet | null {
    this.walletErr.set('');
    if (this.wallets().length >= 5) {
      this.walletErr.set('You can add up to 5 wallets.');
      return null;
    }
    if (!this.newAddress.trim()) {
      this.walletErr.set('Enter a wallet address.');
      return null;
    }
    const created: SavedCryptoWallet = {
      id: `w-${Date.now()}`,
      label: this.newLabel.trim() || this.newNetwork,
      network: this.newNetwork,
      address: this.newAddress.trim(),
    };
    const next = [...this.wallets(), created];
    this.wallets.set(next);
    saveCryptoWallets(next);
    this.walletId = created.id;
    this.newLabel = '';
    this.newAddress = '';
    this.newNetwork = CRYPTO_WALLET_NETWORKS[0];
    this.addingWallet.set(false);
    return created;
  }

  async submit() {
    this.err.set('');
    this.walletErr.set('');
    if (!this.challengeId) {
      this.err.set('Select an eligible account');
      return;
    }
    const n = Number(this.amount);
    if (!(n > 0)) {
      this.err.set('Enter a valid amount');
      return;
    }
    if (n > this.maxAmount()) {
      this.err.set(`Amount exceeds this account's profit share (${moneyPlain(this.maxAmount())})`);
      return;
    }

    let payoutWallet = this.wallets().find((w) => w.id === this.walletId) ?? null;
    if (this.method === 'crypto') {
      if (this.addingWallet() || !payoutWallet) {
        payoutWallet = this.persistNewWallet();
        if (!payoutWallet) return;
      }
    }

    this.busy.set(true);
    try {
      await this.api.request('/api/payouts/request', {
        method: 'POST',
        body: JSON.stringify({
          amount: n,
          challengeId: this.challengeId,
          method: this.method,
          cryptoNetwork:
            this.method === 'crypto' && payoutWallet
              ? toPayoutNetwork(payoutWallet.network)
              : undefined,
          cryptoAddress: this.method === 'crypto' && payoutWallet ? payoutWallet.address : undefined,
        }),
      });
      await this.router.navigateByUrl('/payouts');
    } catch (ex: unknown) {
      this.err.set(ex instanceof Error ? ex.message : 'request failed');
    } finally {
      this.busy.set(false);
    }
  }
}
