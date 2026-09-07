import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CRYPTO_WALLET_NETWORKS,
  loadSavedCryptoWallets,
  saveCryptoWallets,
  type SavedCryptoWallet,
} from '../../lib/crypto-wallets';

@Component({
  selector: 'app-settings-crypto-wallets-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="settings-page">
      <header class="settings-page-head">
        <h1 class="settings-page-title">Crypto Wallets</h1>
        <button type="button" class="settings-save-btn scw-add" (click)="open.set(true)">
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
            <path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z" />
          </svg>
          Add Wallet
        </button>
      </header>

      @if (wallets().length === 0) {
        <div class="sb-empty">
          <svg width="40" height="40" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
            <path d="M216,64H56a8,8,0,0,1,0-16H192a8,8,0,0,0,0-16H56A24,24,0,0,0,32,56V184a24,24,0,0,0,24,24H216a16,16,0,0,0,16-16V80A16,16,0,0,0,216,64Zm0,128H56a8,8,0,0,1-8-8V78.63A23.84,23.84,0,0,0,56,80H216Zm-48-60a12,12,0,1,1,12,12A12,12,0,0,1,168,132Z" />
          </svg>
          <h3>No Crypto Wallets</h3>
          <p>
            Add your first crypto wallet to start receiving rewards via cryptocurrency. You can add up to 5 wallets.
            Saved wallets appear on the reward request form.
          </p>
        </div>
      } @else {
        <ul class="scw-list">
          @for (w of wallets(); track w.id) {
            <li class="scw-item">
              <div>
                <strong>{{ w.label }}</strong>
                <span class="scw-network">{{ w.network }}</span>
                <code>{{ w.address }}</code>
              </div>
              <button type="button" class="scw-remove" (click)="remove(w.id)">Remove</button>
            </li>
          }
        </ul>
      }

      @if (open()) {
        <div class="scw-modal" role="dialog" aria-modal="true" aria-labelledby="add-wallet-title">
          <button type="button" class="scw-backdrop" aria-label="Close" (click)="open.set(false)"></button>
          <form class="scw-dialog" (ngSubmit)="onAdd()">
            <h2 id="add-wallet-title">Add Wallet</h2>
            <div class="settings-field">
              <label for="wallet-label">Label (optional)</label>
              <input id="wallet-label" class="settings-input" name="label" [(ngModel)]="label" placeholder="e.g. Main USDT" />
            </div>
            <div class="settings-field">
              <label for="wallet-network">Network</label>
              <select id="wallet-network" class="settings-select" name="network" [(ngModel)]="network">
                @for (n of networks; track n) {
                  <option [value]="n">{{ n }}</option>
                }
              </select>
            </div>
            <div class="settings-field">
              <label for="wallet-address">Address</label>
              <input id="wallet-address" class="settings-input" name="address" [(ngModel)]="address" placeholder="Wallet address" required />
            </div>
            @if (error()) {
              <p class="ss-err">{{ error() }}</p>
            }
            <div class="scw-dialog-actions">
              <button type="button" class="scw-cancel" (click)="open.set(false)">Cancel</button>
              <button type="submit" class="settings-save-btn">Save Wallet</button>
            </div>
          </form>
        </div>
      }
    </div>
  `,
})
export class SettingsCryptoWalletsPage implements OnInit {
  readonly networks = CRYPTO_WALLET_NETWORKS;
  readonly wallets = signal<SavedCryptoWallet[]>([]);
  readonly open = signal(false);
  readonly error = signal<string | null>(null);
  label = '';
  network: string = CRYPTO_WALLET_NETWORKS[0];
  address = '';

  ngOnInit() {
    this.wallets.set(loadSavedCryptoWallets());
  }

  onAdd() {
    this.error.set(null);
    const wallets = this.wallets();
    if (wallets.length >= 5) {
      this.error.set('You can add up to 5 wallets.');
      return;
    }
    if (!this.address.trim()) {
      this.error.set('Enter a wallet address.');
      return;
    }
    const next = [
      ...wallets,
      {
        id: `w-${Date.now()}`,
        label: this.label.trim() || this.network,
        network: this.network,
        address: this.address.trim(),
      },
    ];
    this.wallets.set(next);
    saveCryptoWallets(next);
    this.label = '';
    this.address = '';
    this.network = CRYPTO_WALLET_NETWORKS[0];
    this.open.set(false);
  }

  remove(id: string) {
    const next = this.wallets().filter((w) => w.id !== id);
    this.wallets.set(next);
    saveCryptoWallets(next);
  }
}
