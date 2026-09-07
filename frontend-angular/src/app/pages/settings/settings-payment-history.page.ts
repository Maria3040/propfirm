import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import {
  buildListQuery,
  emptyAdminPage,
  normalizeAdminPage,
  type AdminPage,
} from '../../lib/admin-list';

type PaymentRow = {
  id: string;
  sku: string;
  price: number;
  status: string;
  paymentIntentId?: string | null;
  createdAt: string;
  paidAt?: string | null;
  accountSize?: number;
  platform?: string;
  listPrice?: number | null;
  couponCode?: string | null;
  discountAmount?: number | null;
};

@Component({
  selector: 'app-settings-payment-history-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="settings-page">
      <h1 class="settings-page-title">Payment History</h1>
      <p class="meta">Orders from challenge purchases (EF write path · Dapper read model).</p>

      <div class="admin-toolbar filters-only">
        <input
          class="settings-input"
          type="search"
          placeholder="Search SKU, order id, payment intent…"
          [ngModel]="search()"
          (ngModelChange)="onSearch($event)"
        />
        <select class="settings-select" [ngModel]="status()" (ngModelChange)="onStatus($event)">
          <option value="">All</option>
          <option value="Pending">Pending</option>
          <option value="Paid">Paid</option>
        </select>
      </div>

      @if (error()) {
        <p class="err">{{ error() }}</p>
      }

      @if (data().total === 0 && !loading()) {
        <div class="sph-empty">
          <h3>No payment history</h3>
          <p>Purchase your first challenge to get started</p>
          <a routerLink="/" class="sph-cta"><span>Buy Challenge</span></a>
        </div>
      } @else {
        <div class="rw-card rw-table-wrap hist-table-wrap hist-table-card">
          <div class="hist-table-scroll">
            <table class="rw-table">
              <thead>
                <tr>
                  <th>
                    <button type="button" class="hist-sort" (click)="toggleSort('createdAt')">
                      Order{{ sortHint('createdAt') }}
                    </button>
                  </th>
                  <th>
                    <button type="button" class="hist-sort" (click)="toggleSort('sku')">
                      SKU{{ sortHint('sku') }}
                    </button>
                  </th>
                  <th>
                    <button type="button" class="hist-sort" (click)="toggleSort('price')">
                      Amount{{ sortHint('price') }}
                    </button>
                  </th>
                  <th>Coupon</th>
                  <th>
                    <button type="button" class="hist-sort" (click)="toggleSort('status')">
                      Status{{ sortHint('status') }}
                    </button>
                  </th>
                  <th>Platform</th>
                  <th>Paid</th>
                </tr>
              </thead>
              <tbody>
                @for (r of data().items; track r.id) {
                  <tr>
                    <td>
                      <code>{{ r.id.slice(0, 8) }}…</code>
                      <div class="meta">{{ formatDate(r.createdAt) }}</div>
                    </td>
                    <td>{{ r.sku }}</td>
                    <td>
                      <strong>{{ '$' + asMoney(r.price) }}</strong>
                      @if (hasDiscount(r)) {
                        <div class="meta sph-discount">
                          <s>{{ '$' + asMoney(listOf(r)) }}</s>
                          · −{{ '$' + asMoney(discountOf(r)) }}
                        </div>
                      }
                    </td>
                    <td>{{ r.couponCode || '—' }}</td>
                    <td>{{ r.status }}</td>
                    <td>{{ r.platform || '—' }}</td>
                    <td>{{ formatDate(r.paidAt) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
        <div class="admin-pager">
          <button type="button" [disabled]="data().page <= 1 || loading()" (click)="setPage(data().page - 1)">Prev</button>
          <span>Page {{ data().page }} / {{ data().totalPages }}</span>
          <button type="button" [disabled]="data().page >= data().totalPages || loading()" (click)="setPage(data().page + 1)">Next</button>
          <select [ngModel]="pageSize()" (ngModelChange)="setPageSize(+$event)">
            <option [ngValue]="10">10</option>
            <option [ngValue]="20">20</option>
            <option [ngValue]="50">50</option>
          </select>
        </div>
      }
    </div>
  `,
})
export class SettingsPaymentHistoryPage implements OnInit {
  private readonly api = inject(ApiService);
  private searchTimer: number | undefined;

  readonly search = signal('');
  readonly status = signal('');
  readonly sortBy = signal('createdAt');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly data = signal<AdminPage<PaymentRow>>(emptyAdminPage({ pageSize: 10, sortBy: 'createdAt', sortDir: 'desc' }));

  ngOnInit() {
    void this.load();
  }

  formatDate(iso?: string | null) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '—';
    }
  }

  asMoney(n: number) {
    return Number(n).toFixed(2);
  }

  listOf(r: PaymentRow) {
    return Number(r.listPrice ?? r.price) || 0;
  }

  discountOf(r: PaymentRow) {
    if (r.discountAmount != null && Number(r.discountAmount) > 0) return Number(r.discountAmount);
    const list = this.listOf(r);
    return Math.max(0, list - Number(r.price || 0));
  }

  hasDiscount(r: PaymentRow) {
    return this.discountOf(r) > 0.009 || !!r.couponCode;
  }

  sortHint(col: string) {
    if (this.sortBy() !== col) return '';
    return this.sortDir() === 'asc' ? ' ↑' : ' ↓';
  }

  onSearch(v: string) {
    this.search.set(v);
    if (this.searchTimer) window.clearTimeout(this.searchTimer);
    this.searchTimer = window.setTimeout(() => {
      this.page.set(1);
      void this.load();
    }, 300);
  }

  onStatus(v: string) {
    this.status.set(v);
    this.page.set(1);
    void this.load();
  }

  toggleSort(col: string) {
    if (this.sortBy() === col) this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    else {
      this.sortBy.set(col);
      this.sortDir.set('desc');
    }
    void this.load();
  }

  setPage(p: number) {
    this.page.set(p);
    void this.load();
  }

  setPageSize(n: number) {
    this.pageSize.set(n);
    this.page.set(1);
    void this.load();
  }

  private async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const qs = buildListQuery({
        page: this.page(),
        pageSize: this.pageSize(),
        q: this.search(),
        sortBy: this.sortBy(),
        sortDir: this.sortDir(),
        filters: { status: this.status() },
      });
      const raw = await this.api.request<unknown>(`/api/payments/history?${qs}`);
      this.data.set(normalizeAdminPage<PaymentRow>(raw, { pageSize: this.pageSize(), sortBy: this.sortBy(), sortDir: this.sortDir() }));
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.loading.set(false);
    }
  }
}
