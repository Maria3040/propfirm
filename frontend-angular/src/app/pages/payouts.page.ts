import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AdminListService } from '../core/admin-list.service';

type Wallet = { availableBalance: number };
type PayoutRow = {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  method?: string;
  rewardType?: string;
};

@Component({
  selector: 'app-payouts-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="rw-page">
      <div class="rw-heading">
        <h1>Rewards</h1>
        <p class="rw-balance meta">
          Available balance:
          <strong>{{ '$' + wallet().availableBalance.toFixed(2) }}</strong>
        </p>
      </div>

      @if (err() || list.error()) {
        <p class="err">{{ err() || list.error() }}</p>
      }

      <div class="rw-top-grid">
        <div class="rw-card rw-cert">
          <h3>No Certificate Available</h3>
          <p>You'll earn your reward certificate once you start receiving rewards.</p>
          <p class="rw-muted">Keep trading to unlock your achievements!</p>
        </div>
        <div class="rw-card rw-request">
          <div>
            <h3>Ready to request your reward?</h3>
            <p>
              Please click on the request button then proceed to fill out the required information,
              our team will reach out to you for further advancements.
            </p>
          </div>
          <a routerLink="/payouts/request" class="rw-btn">Request Reward</a>
        </div>
      </div>

      <section class="rw-history">
        <div class="admin-toolbar" style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-bottom:1rem">
          <label>
            Status
            <select
              [value]="list.params().filters['status'] || ''"
              (change)="list.setFilter('status', $any($event.target).value)"
            >
              <option value="">All</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </label>
          <label>
            Search
            <input
              type="search"
              [value]="list.searchInput()"
              (input)="list.onSearchChange($any($event.target).value)"
              placeholder="Search payout id, method…"
            />
          </label>
        </div>

        <div class="rw-card hist-table-card">
          <div class="rw-table-head">
            <p class="rw-section-label">Payout history</p>
          </div>
          <div class="hist-table-scroll">
            <table class="rw-table">
              <thead>
                <tr>
                  <th>
                    <button type="button" class="hist-sort" (click)="list.toggleSort('createdAt')">
                      Reference{{ sortMark('createdAt') }}
                    </button>
                  </th>
                  <th>Reward Type</th>
                  <th>Requested On</th>
                  <th>
                    <button type="button" class="hist-sort" (click)="list.toggleSort('method')">
                      Method{{ sortMark('method') }}
                    </button>
                  </th>
                  <th>
                    <button type="button" class="hist-sort" (click)="list.toggleSort('status')">
                      Status{{ sortMark('status') }}
                    </button>
                  </th>
                  <th>
                    <button type="button" class="hist-sort" (click)="list.toggleSort('amount')">
                      Amount{{ sortMark('amount') }}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                @if (list.data().total === 0) {
                  <tr>
                    <td colspan="6">
                      <div class="rw-empty">
                        <p class="rw-empty-title">No reward history yet</p>
                        <p class="rw-empty-sub">Completed and pending reward requests will appear here.</p>
                      </div>
                    </td>
                  </tr>
                } @else {
                  @for (r of list.data().items; track r.id) {
                    <tr>
                      <td>{{ r.id.slice(0, 8) }}…</td>
                      <td>{{ r.rewardType || 'Profit share' }}</td>
                      <td>{{ formatDate(r.createdAt) }}</td>
                      <td>{{ methodLabel(r.method) }}</td>
                      <td>
                        <span [class]="'rw-status rw-status-' + (r.status || '').toLowerCase()">
                          {{ statusLabel(r.status) }}
                        </span>
                      </td>
                      <td>{{ '$' + asMoney(r.amount) }}</td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        </div>

        @if (list.data().total > 0) {
          <div class="notif-pager" style="display:flex;gap:0.75rem;align-items:center;margin-top:1rem">
            <button
              type="button"
              class="rw-btn rw-btn-secondary"
              [disabled]="list.data().page <= 1 || list.loading()"
              (click)="list.setPage(list.data().page - 1)"
            >
              Prev
            </button>
            <span class="meta"
              >Page {{ list.data().page }} / {{ list.data().totalPages }} ({{ list.data().total }})</span
            >
            <button
              type="button"
              class="rw-btn rw-btn-secondary"
              [disabled]="list.data().page >= list.data().totalPages || list.loading()"
              (click)="list.setPage(list.data().page + 1)"
            >
              Next
            </button>
          </div>
        }
      </section>
    </div>
  `,
})
export class PayoutsPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly lists = inject(AdminListService);

  readonly list = this.lists.createList<PayoutRow>({
    path: '/api/payouts',
    defaultSortBy: 'createdAt',
    defaultSortDir: 'desc',
    pageSize: 10,
  });

  readonly wallet = signal<Wallet>({ availableBalance: 0 });
  readonly err = signal('');

  ngOnInit() {
    void this.list.reload();
    void this.api
      .request<Wallet>('/api/payouts/wallet')
      .then((w) => this.wallet.set(w))
      .catch((e: unknown) => this.err.set(e instanceof Error ? e.message : String(e)));
  }

  sortMark(col: string) {
    const p = this.list.params();
    if (p.sortBy !== col) return '';
    return p.sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '—';
    }
  }

  methodLabel(method?: string) {
    const m = (method || '').toLowerCase();
    if (m === 'crypto') return 'Crypto';
    if (m === 'bank') return 'Bank transfer';
    if (m === 'rise') return 'Rise';
    return method || '—';
  }

  statusLabel(status: string) {
    const s = (status || '').toLowerCase();
    if (s === 'pending') return 'Pending';
    if (s === 'approved' || s === 'paid') return 'Approved';
    if (s === 'rejected') return 'Rejected';
    return status || '—';
  }

  asMoney(n: number) {
    return Number(n).toFixed(2);
  }
}
