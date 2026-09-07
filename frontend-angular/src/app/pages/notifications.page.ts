import { Component, OnInit, inject } from '@angular/core';
import { AdminListService } from '../core/admin-list.service';

type NotificationRow = {
  id: string;
  subject: string;
  body: string;
  status: string;
  createdAt?: string;
  createdat?: string;
};

@Component({
  selector: 'app-notifications-page',
  standalone: true,
  template: `
    <div class="rw-page notif-page">
      <div class="rw-heading">
        <h1>Notifications</h1>
        <p class="meta">Emails and system messages for your account (search is debounced).</p>
      </div>

      <div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-bottom:1rem">
        <label>
          Status
          <select
            [value]="list.params().filters['status'] || ''"
            (change)="list.setFilter('status', $any($event.target).value)"
          >
            <option value="">All</option>
            <option value="Queued">Queued</option>
            <option value="Sent">Sent</option>
            <option value="Failed">Failed</option>
          </select>
        </label>
        <label>
          Search
          <input
            type="search"
            [value]="list.searchInput()"
            (input)="list.onSearchChange($any($event.target).value)"
            placeholder="Search subject, body…"
          />
        </label>
      </div>

      @if (list.error()) {
        <p class="err">{{ list.error() }}</p>
      }

      <div class="notif-table-card">
        @if (list.data().total === 0 && !list.loading()) {
          <div class="rw-empty">
            <p class="rw-empty-title">No notifications yet</p>
            <p class="rw-empty-sub">
              Purchase, phase pass, competition join, and payout emails will show here.
            </p>
          </div>
        } @else {
          <div class="notif-table-scroll">
            <table class="rw-table notif-table">
              <thead>
                <tr>
                  <th>
                    <button type="button" class="hist-sort" (click)="list.toggleSort('createdAt')">
                      When{{ sortMark('createdAt') }}
                    </button>
                  </th>
                  <th>
                    <button type="button" class="hist-sort" (click)="list.toggleSort('subject')">
                      Subject{{ sortMark('subject') }}
                    </button>
                  </th>
                  <th>
                    <button type="button" class="hist-sort" (click)="list.toggleSort('status')">
                      Status{{ sortMark('status') }}
                    </button>
                  </th>
                  <th>Preview</th>
                </tr>
              </thead>
              <tbody>
                @for (n of list.data().items; track n.id) {
                  <tr>
                    <td class="notif-when">{{ formatDate(n.createdAt ?? n.createdat) }}</td>
                    <td>
                      <strong>{{ n.subject }}</strong>
                    </td>
                    <td>
                      <span [class]="'rw-status rw-status-' + (n.status || '').toLowerCase()">
                        {{ n.status }}
                      </span>
                    </td>
                    <td class="notif-preview">
                      {{ (n.body || '').slice(0, 120) }}{{ (n.body || '').length > 120 ? '…' : '' }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
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
    </div>
  `,
})
export class NotificationsPage implements OnInit {
  private readonly lists = inject(AdminListService);

  readonly list = this.lists.createList<NotificationRow>({
    path: '/api/notifications',
    defaultSortBy: 'createdAt',
    defaultSortDir: 'desc',
    pageSize: 10,
  });

  ngOnInit() {
    void this.list.reload();
  }

  sortMark(col: string) {
    const p = this.list.params();
    if (p.sortBy !== col) return '';
    return p.sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  formatDate(iso?: string | null) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
}
