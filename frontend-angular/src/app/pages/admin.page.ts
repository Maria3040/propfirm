import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AdminListService, AdminListHandle } from '../core/admin-list.service';
import {
  AdminPagerComponent,
  AdminSortThComponent,
  AdminTableToolbarComponent,
} from './admin-table-toolbar.component';

type Tab =
  | 'overview'
  | 'payouts'
  | 'verifications'
  | 'traders'
  | 'challenges'
  | 'catalog'
  | 'audit'
  | 'mail';

type Overview = {
  traders: number;
  challengesActive: number;
  challengesFunded: number;
  challengesFailed: number;
  payoutsPending: number;
  payoutsNeedsVpsInvoice?: number;
  ordersPaid: number;
  productsActive: number;
  generatedAt?: string;
};

type PayoutRow = {
  id: string;
  amount: number;
  status: string;
  vpsInvoiceStatus?: string | null;
  traderEmail?: string | null;
  traderId?: string;
  method?: string;
  cryptoNetwork?: string | null;
  cryptoAddress?: string | null;
  canApprove?: boolean;
  approveBlockedReason?: string | null;
  ipRisk?: {
    hasViolation?: boolean;
    summary?: string;
    lastIp?: string | null;
    requiresVpsInvoice?: boolean;
  } | null;
};

type VerificationRow = {
  traderId: string;
  email: string;
  displayName?: string | null;
  status: string;
  requestedAt?: string | null;
  adminComment?: string | null;
};

type TraderRow = {
  id: string;
  email: string;
  displayName?: string;
  role: string;
  walletBalance?: number;
  challengeCount?: number;
  createdAt?: string;
};

type ChallengeRow = {
  id: string;
  sku: string;
  status: string;
  traderEmail?: string;
  equity?: number;
  currentPhase?: number;
  failReason?: string | null;
};

type ProductRow = {
  id: string;
  sku: string;
  accountSize: number;
  price: number;
  profitSplitPct: number;
  isActive: boolean;
};

type AuditRow = {
  id: string;
  occurredAt: string;
  eventType: string;
  source: string;
  summary: string;
};

type MailRow = {
  id: string;
  createdAt: string;
  toEmail: string;
  subject: string;
  status: string;
  deliveryDetail?: string | null;
};

const TABS: Tab[] = [
  'overview',
  'payouts',
  'verifications',
  'traders',
  'challenges',
  'catalog',
  'audit',
  'mail',
];

function isTab(v: string | null): v is Tab {
  return !!v && (TABS as string[]).includes(v);
}

function canDecidePayout(status: string) {
  return status === 'Pending' || status === 'NeedsVpsInvoice';
}

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [AdminTableToolbarComponent, AdminPagerComponent, AdminSortThComponent],
  template: `
    <div class="admin-panel">
      @if (closeId()) {
        <div
          class="pf-dialog-backdrop"
          role="presentation"
          (click)="!busy() && closeId.set(null)"
        >
          <div
            class="pf-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="close-challenge-title"
            (click)="$event.stopPropagation()"
          >
            <div class="pf-dialog-header">
              <h2 id="close-challenge-title">Force-close this challenge?</h2>
              <p class="pf-dialog-desc">
                The trading account will be locked and the challenge marked Closed.
              </p>
            </div>
            <div class="pf-dialog-footer">
              <button
                type="button"
                class="pf-dialog-cancel"
                [disabled]="busy()"
                (click)="closeId.set(null)"
              >
                Cancel
              </button>
              <button
                type="button"
                class="pf-dialog-confirm danger"
                [disabled]="busy()"
                (click)="confirmCloseChallenge()"
              >
                {{ busy() ? 'Closing…' : 'Close challenge' }}
              </button>
            </div>
            <button
              type="button"
              class="pf-dialog-x"
              aria-label="Close"
              [disabled]="busy()"
              (click)="closeId.set(null)"
            >
              ×
            </button>
          </div>
        </div>
      }

      <header class="admin-panel-head">
        <div>
          <h1>Admin panel</h1>
          <p class="lead">
            Manage traders, challenges, catalog, payouts, and audit. Lists load from the server with
            search, filters, sort, and pagination.
          </p>
        </div>
        <button
          type="button"
          class="btn"
          [disabled]="busy()"
          [attr.aria-busy]="busy()"
          (click)="refreshActive()"
        >
          {{ busy() ? 'Working…' : 'Refresh' }}
        </button>
      </header>

      @if (err()) {
        <p class="err" role="alert">{{ err() }}</p>
      }
      @if (commentFlash()) {
        <p class="settings-saved">{{ commentFlash() }}</p>
      }

      <div class="admin-tabs" role="tablist" aria-label="Admin sections">
        @for (t of tabDefs; track t.id) {
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="tab() === t.id"
            [class.on]="tab() === t.id"
            (click)="goTab(t.id)"
          >
            {{ t.label
            }}{{
              t.id === 'payouts' && (overview()?.payoutsPending ?? 0)
                ? ' (' + (overview()?.payoutsPending ?? 0) + ')'
                : ''
            }}
          </button>
        }
      </div>

      @if (tab() === 'overview' && overview(); as o) {
        <section class="admin-cards" aria-label="Overview">
          <button type="button" class="admin-card" (click)="goTab('traders')">
            <span>Traders</span>
            <strong>{{ o.traders }}</strong>
          </button>
          <button
            type="button"
            class="admin-card"
            (click)="goTab('challenges', { status: 'Active' })"
          >
            <span>Active challenges</span>
            <strong>{{ o.challengesActive }}</strong>
          </button>
          <button
            type="button"
            class="admin-card"
            (click)="goTab('challenges', { status: 'Funded' })"
          >
            <span>Funded</span>
            <strong>{{ o.challengesFunded }}</strong>
          </button>
          <button
            type="button"
            class="admin-card"
            (click)="goTab('challenges', { status: 'Failed' })"
          >
            <span>Failed</span>
            <strong>{{ o.challengesFailed }}</strong>
          </button>
          <button
            type="button"
            class="admin-card"
            (click)="goTab('payouts', { status: 'Pending' })"
          >
            <span>Pending payouts</span>
            <strong>{{ o.payoutsPending }}</strong>
          </button>
          <button
            type="button"
            class="admin-card"
            (click)="goTab('payouts', { status: 'NeedsVpsInvoice' })"
          >
            <span>Needs VPS invoice</span>
            <strong>{{ o.payoutsNeedsVpsInvoice ?? 0 }}</strong>
          </button>
          <button type="button" class="admin-card" disabled>
            <span>Paid orders</span>
            <strong>{{ o.ordersPaid }}</strong>
          </button>
          <button type="button" class="admin-card" (click)="goTab('catalog')">
            <span>Active SKUs</span>
            <strong>{{ o.productsActive }}</strong>
          </button>
          @if (o.generatedAt) {
            <p class="meta" style="grid-column: 1 / -1">
              Aggregated on server · {{ formatDate(o.generatedAt) }}
            </p>
          }
        </section>
      }

      @if (tab() === 'payouts') {
        <section>
          <h2>Payout queue</h2>
          <p class="rw-form-hint">
            Filter by <strong>Pending</strong> to approve/reject. Already Approved/Rejected rows keep
            the buttons visible but disabled. Comment emails the trader.
          </p>
          <app-admin-table-toolbar
            [search]="payouts.searchInput()"
            searchPlaceholder="Search email, id, address…"
            [filters]="[
              {
                key: 'status',
                label: 'Status',
                value: payouts.params().filters['status'] || '',
                options: [
                  { value: '', label: 'All' },
                  { value: 'Pending', label: 'Pending' },
                  { value: 'NeedsVpsInvoice', label: 'Needs VPS invoice' },
                  { value: 'Approved', label: 'Approved' },
                  { value: 'Rejected', label: 'Rejected' },
                ],
              },
            ]"
            [page]="payouts.data().page"
            [pageSize]="payouts.params().pageSize"
            [total]="payouts.data().total"
            [totalPages]="payouts.data().totalPages"
            [loading]="payouts.loading()"
            (searchChange)="payouts.onSearchChange($event)"
            (filterChange)="onPayoutStatusFilter($event.value)"
            (pageChange)="payouts.setPage($event)"
            (pageSizeChange)="payouts.setPageSize($event)"
          />
          @if (payouts.error()) {
            <p class="err">{{ payouts.error() }}</p>
          }
          <div class="stack admin-list-body" [class.is-loading]="payouts.loading()">
            @if (payouts.data().items.length === 0 && !payouts.loading()) {
              <p class="meta">No payouts match.</p>
            }
            @for (p of payouts.data().items; track p.id) {
              <div class="card row admin-row">
                <div>
                  <strong>{{ money(p.amount) }}</strong> · {{ p.status
                  }}{{ p.vpsInvoiceStatus ? ' · VPS: ' + p.vpsInvoiceStatus : '' }}
                  <div class="meta">
                    {{ p.traderEmail || p.traderId }} · {{ p.method }} ·
                    {{ p.cryptoNetwork || '—' }}
                  </div>
                  @if (p.cryptoAddress) {
                    <code class="admin-code">{{ p.cryptoAddress }}</code>
                  }
                  @if (p.ipRisk?.hasViolation) {
                    <p class="err" style="margin-top: 0.5rem">
                      IP violation: {{ p.ipRisk?.summary
                      }}{{ p.ipRisk?.lastIp ? ' (IP ' + p.ipRisk?.lastIp + ')' : '' }}
                    </p>
                  } @else {
                    <p class="meta" style="margin-top: 0.35rem">
                      {{ p.ipRisk?.summary || 'No IP risk flags' }}
                    </p>
                  }
                  @if (!canDecide(p.status)) {
                    <p class="meta">Already decided — Approve / Reject are disabled.</p>
                  }
                  @if (canDecide(p.status) && !p.canApprove && p.approveBlockedReason) {
                    <p class="meta">Approve blocked: {{ p.approveBlockedReason }}</p>
                  }
                </div>
                <div class="admin-actions" style="flex-wrap: wrap">
                  <button type="button" class="btn" [disabled]="busy()" (click)="openComment(p)">
                    Comment
                  </button>
                  @if (
                    canDecide(p.status) &&
                    p.ipRisk?.requiresVpsInvoice &&
                    p.vpsInvoiceStatus !== 'Received'
                  ) {
                    <button
                      type="button"
                      class="btn"
                      [disabled]="busy()"
                      (click)="requestVpsInvoice(p.id)"
                    >
                      Request VPS invoice
                    </button>
                  }
                  @if (canDecide(p.status) && p.vpsInvoiceStatus === 'Requested') {
                    <button
                      type="button"
                      class="btn"
                      [disabled]="busy()"
                      (click)="markVpsReceived(p.id)"
                    >
                      Mark invoice received
                    </button>
                  }
                  <button
                    type="button"
                    class="btn"
                    [disabled]="busy() || !canDecide(p.status) || !p.canApprove"
                    [attr.aria-busy]="busy()"
                    [title]="
                      !canDecide(p.status)
                        ? 'Already decided'
                        : p.approveBlockedReason || 'Approve and send reward'
                    "
                    (click)="decidePayout(p.id, true)"
                  >
                    {{ busy() ? 'Approving…' : 'Approve & send' }}
                  </button>
                  <button
                    type="button"
                    class="btn danger"
                    [disabled]="busy() || !canDecide(p.status)"
                    [attr.aria-busy]="busy()"
                    [title]="!canDecide(p.status) ? 'Already decided' : 'Reject payout'"
                    (click)="decidePayout(p.id, false)"
                  >
                    {{ busy() ? 'Rejecting…' : 'Reject' }}
                  </button>
                </div>
              </div>
            }
          </div>
          <app-admin-pager
            [page]="payouts.data().page"
            [pageSize]="payouts.params().pageSize"
            [total]="payouts.data().total"
            [totalPages]="payouts.data().totalPages"
            [loading]="payouts.loading()"
            (pageChange)="payouts.setPage($event)"
            (pageSizeChange)="payouts.setPageSize($event)"
          />
        </section>
      }

      @if (tab() === 'verifications') {
        <section>
          <h2>Identity verifications</h2>
          <p class="meta">
            Approve / reject pending KYC requests. Traders get an email via Mailpit.
          </p>
          <label class="settings-field" style="max-width: 480px; margin-bottom: 1rem; display: block">
            Comment (optional for decide · required-ish for email)
            <textarea
              class="settings-input"
              rows="3"
              [value]="verifyComment()"
              (input)="verifyComment.set(($any($event.target)).value)"
              placeholder="Optional note to the trader…"
            ></textarea>
          </label>
          @if (commentFlash()) {
            <p class="settings-saved">{{ commentFlash() }}</p>
          }
          @if (verifications().length === 0) {
            <p class="meta">No verification requests yet.</p>
          } @else {
            <div class="stack">
              @for (v of verifications(); track v.traderId) {
                <div class="card row admin-row">
                  <div>
                    <strong>{{ v.displayName || v.email }}</strong>
                    <div class="meta">
                      {{ v.email }} · {{ v.status
                      }}{{
                        v.requestedAt ? ' · requested ' + formatDate(v.requestedAt) : ''
                      }}
                    </div>
                    @if (v.adminComment) {
                      <p class="meta">Last comment: {{ v.adminComment }}</p>
                    }
                  </div>
                  <div class="admin-actions" style="flex-wrap: wrap">
                    <button
                      type="button"
                      class="btn"
                      [disabled]="!!verifyBusy()"
                      [attr.aria-busy]="verifyBusy() === v.traderId"
                      (click)="commentVerification(v.traderId, v.email)"
                    >
                      {{ verifyBusy() === v.traderId ? 'Sending…' : 'Email comment' }}
                    </button>
                    @if (v.status === 'Pending') {
                      <button
                        type="button"
                        class="btn"
                        [disabled]="verifyBusy() === v.traderId"
                        [attr.aria-busy]="verifyBusy() === v.traderId"
                        (click)="decideVerification(v.traderId, true)"
                      >
                        {{ verifyBusy() === v.traderId ? 'Saving…' : 'Approve' }}
                      </button>
                      <button
                        type="button"
                        class="btn danger"
                        [disabled]="verifyBusy() === v.traderId"
                        [attr.aria-busy]="verifyBusy() === v.traderId"
                        (click)="decideVerification(v.traderId, false)"
                      >
                        {{ verifyBusy() === v.traderId ? 'Saving…' : 'Reject' }}
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </section>
      }

      @if (tab() === 'traders') {
        <section>
          <h2>Traders</h2>
          <app-admin-table-toolbar
            [search]="traders.searchInput()"
            searchPlaceholder="Search email or name…"
            [filters]="[
              {
                key: 'role',
                label: 'Role',
                value: traders.params().filters['role'] || '',
                options: [
                  { value: '', label: 'All' },
                  { value: 'Trader', label: 'Trader' },
                  { value: 'Admin', label: 'Admin' },
                ],
              },
            ]"
            [page]="traders.data().page"
            [pageSize]="traders.params().pageSize"
            [total]="traders.data().total"
            [totalPages]="traders.data().totalPages"
            [loading]="traders.loading()"
            (searchChange)="traders.onSearchChange($event)"
            (filterChange)="traders.setFilter($event.key, $event.value)"
            (pageChange)="traders.setPage($event)"
            (pageSizeChange)="traders.setPageSize($event)"
          />
          @if (traders.error()) {
            <p class="err">{{ traders.error() }}</p>
          }
          <div class="admin-list-body" [class.is-loading]="traders.loading()">
            <table class="table">
              <thead>
                <tr>
                  <th
                    appAdminSort
                    label="Email"
                    column="email"
                    [sortBy]="traders.params().sortBy"
                    [sortDir]="traders.params().sortDir"
                    (sort)="traders.toggleSort($event)"
                  ></th>
                  <th
                    appAdminSort
                    label="Role"
                    column="role"
                    [sortBy]="traders.params().sortBy"
                    [sortDir]="traders.params().sortDir"
                    (sort)="traders.toggleSort($event)"
                  ></th>
                  <th>Wallet</th>
                  <th>Challenges</th>
                  <th
                    appAdminSort
                    label="Created"
                    column="createdAt"
                    [sortBy]="traders.params().sortBy"
                    [sortDir]="traders.params().sortDir"
                    (sort)="traders.toggleSort($event)"
                  ></th>
                </tr>
              </thead>
              <tbody>
                @for (t of traders.data().items; track t.id) {
                  <tr>
                    <td>
                      {{ t.displayName }}
                      <div class="meta">{{ t.email }}</div>
                    </td>
                    <td>{{ t.role }}</td>
                    <td>{{ money(t.walletBalance || 0) }}</td>
                    <td>{{ t.challengeCount }}</td>
                    <td class="meta">{{ t.createdAt ? formatDate(t.createdAt) : '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-admin-pager
            [page]="traders.data().page"
            [pageSize]="traders.params().pageSize"
            [total]="traders.data().total"
            [totalPages]="traders.data().totalPages"
            [loading]="traders.loading()"
            (pageChange)="traders.setPage($event)"
            (pageSizeChange)="traders.setPageSize($event)"
          />
        </section>
      }

      @if (tab() === 'challenges') {
        <section>
          <h2>Challenges</h2>
          <app-admin-table-toolbar
            [search]="challenges.searchInput()"
            searchPlaceholder="Search SKU, email, id…"
            [filters]="[
              {
                key: 'status',
                label: 'Status',
                value: challenges.params().filters['status'] || '',
                options: [
                  { value: '', label: 'All' },
                  { value: 'Active', label: 'Active' },
                  { value: 'Funded', label: 'Funded' },
                  { value: 'Failed', label: 'Failed' },
                  { value: 'Closed', label: 'Closed' },
                ],
              },
            ]"
            [page]="challenges.data().page"
            [pageSize]="challenges.params().pageSize"
            [total]="challenges.data().total"
            [totalPages]="challenges.data().totalPages"
            [loading]="challenges.loading()"
            (searchChange)="challenges.onSearchChange($event)"
            (filterChange)="onChallengeStatusFilter($event.value)"
            (pageChange)="challenges.setPage($event)"
            (pageSizeChange)="challenges.setPageSize($event)"
          />
          @if (challenges.error()) {
            <p class="err">{{ challenges.error() }}</p>
          }
          <div class="stack admin-list-body" [class.is-loading]="challenges.loading()">
            @for (c of challenges.data().items; track c.id) {
              <div class="card row admin-row">
                <div>
                  <strong>{{ c.sku }} · {{ c.status }}</strong>
                  <div class="meta">
                    {{ c.traderEmail }} · equity {{ money(c.equity ?? 0) }} · phase
                    {{ c.currentPhase }}{{ c.failReason ? ' · ' + c.failReason : '' }}
                  </div>
                </div>
                @if (c.status !== 'Closed' && c.status !== 'Failed') {
                  <button
                    type="button"
                    class="btn danger"
                    [disabled]="busy()"
                    [attr.aria-busy]="busy() && closeId() === c.id"
                    (click)="closeId.set(c.id)"
                  >
                    {{ busy() && closeId() === c.id ? 'Closing…' : 'Force close' }}
                  </button>
                }
              </div>
            }
          </div>
          <app-admin-pager
            [page]="challenges.data().page"
            [pageSize]="challenges.params().pageSize"
            [total]="challenges.data().total"
            [totalPages]="challenges.data().totalPages"
            [loading]="challenges.loading()"
            (pageChange)="challenges.setPage($event)"
            (pageSizeChange)="challenges.setPageSize($event)"
          />
        </section>
      }

      @if (tab() === 'catalog') {
        <section>
          <h2>Catalog products</h2>
          <app-admin-table-toolbar
            [search]="products.searchInput()"
            searchPlaceholder="Search SKU or name…"
            [filters]="[
              {
                key: 'isActive',
                label: 'Active',
                value: products.params().filters['isActive'] || '',
                options: [
                  { value: '', label: 'All' },
                  { value: 'true', label: 'Active' },
                  { value: 'false', label: 'Inactive' },
                ],
              },
            ]"
            [page]="products.data().page"
            [pageSize]="products.params().pageSize"
            [total]="products.data().total"
            [totalPages]="products.data().totalPages"
            [loading]="products.loading()"
            (searchChange)="products.onSearchChange($event)"
            (filterChange)="products.setFilter($event.key, $event.value)"
            (pageChange)="products.setPage($event)"
            (pageSizeChange)="products.setPageSize($event)"
          />
          @if (products.error()) {
            <p class="err">{{ products.error() }}</p>
          }
          <div class="admin-list-body" [class.is-loading]="products.loading()">
            <table class="table">
              <thead>
                <tr>
                  <th
                    appAdminSort
                    label="SKU"
                    column="sku"
                    [sortBy]="products.params().sortBy"
                    [sortDir]="products.params().sortDir"
                    (sort)="products.toggleSort($event)"
                  ></th>
                  <th
                    appAdminSort
                    label="Size"
                    column="accountSize"
                    [sortBy]="products.params().sortBy"
                    [sortDir]="products.params().sortDir"
                    (sort)="products.toggleSort($event)"
                  ></th>
                  <th
                    appAdminSort
                    label="Price"
                    column="price"
                    [sortBy]="products.params().sortBy"
                    [sortDir]="products.params().sortDir"
                    (sort)="products.toggleSort($event)"
                  ></th>
                  <th
                    appAdminSort
                    label="Split"
                    column="profitSplitPct"
                    [sortBy]="products.params().sortBy"
                    [sortDir]="products.params().sortDir"
                    (sort)="products.toggleSort($event)"
                  ></th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                @for (p of products.data().items; track p.id) {
                  <tr>
                    <td>{{ p.sku }}</td>
                    <td>{{ '$' + p.accountSize.toLocaleString() }}</td>
                    <td>{{ money(p.price) }}</td>
                    <td>{{ p.profitSplitPct }}%</td>
                    <td>
                      <button
                        type="button"
                        class="btn"
                        [disabled]="busy()"
                        [attr.aria-busy]="busy()"
                        (click)="toggleProduct(p.id, !p.isActive)"
                      >
                        {{ busy() ? 'Saving…' : p.isActive ? 'Deactivate' : 'Activate' }}
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-admin-pager
            [page]="products.data().page"
            [pageSize]="products.params().pageSize"
            [total]="products.data().total"
            [totalPages]="products.data().totalPages"
            [loading]="products.loading()"
            (pageChange)="products.setPage($event)"
            (pageSizeChange)="products.setPageSize($event)"
          />
        </section>
      }

      @if (tab() === 'audit') {
        <section>
          <h2>Audit timeline</h2>
          <app-admin-table-toolbar
            [search]="audit.searchInput()"
            searchPlaceholder="Search type, source, summary…"
            [page]="audit.data().page"
            [pageSize]="audit.params().pageSize"
            [total]="audit.data().total"
            [totalPages]="audit.data().totalPages"
            [loading]="audit.loading()"
            (searchChange)="audit.onSearchChange($event)"
            (pageChange)="audit.setPage($event)"
            (pageSizeChange)="audit.setPageSize($event)"
          />
          @if (audit.error()) {
            <p class="err">{{ audit.error() }}</p>
          }
          <div class="admin-list-body" [class.is-loading]="audit.loading()">
            <table class="table">
              <thead>
                <tr>
                  <th
                    appAdminSort
                    label="When"
                    column="occurredAt"
                    [sortBy]="audit.params().sortBy"
                    [sortDir]="audit.params().sortDir"
                    (sort)="audit.toggleSort($event)"
                  ></th>
                  <th
                    appAdminSort
                    label="Type"
                    column="eventType"
                    [sortBy]="audit.params().sortBy"
                    [sortDir]="audit.params().sortDir"
                    (sort)="audit.toggleSort($event)"
                  ></th>
                  <th
                    appAdminSort
                    label="Source"
                    column="source"
                    [sortBy]="audit.params().sortBy"
                    [sortDir]="audit.params().sortDir"
                    (sort)="audit.toggleSort($event)"
                  ></th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                @for (a of audit.data().items; track a.id) {
                  <tr>
                    <td>{{ formatDate(a.occurredAt) }}</td>
                    <td>{{ a.eventType }}</td>
                    <td>{{ a.source }}</td>
                    <td>{{ a.summary }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-admin-pager
            [page]="audit.data().page"
            [pageSize]="audit.params().pageSize"
            [total]="audit.data().total"
            [totalPages]="audit.data().totalPages"
            [loading]="audit.loading()"
            (pageChange)="audit.setPage($event)"
            (pageSizeChange)="audit.setPageSize($event)"
          />
        </section>
      }

      @if (tab() === 'mail') {
        <section>
          <h2>Notification outbox</h2>
          <app-admin-table-toolbar
            [search]="mail.searchInput()"
            searchPlaceholder="Search to / subject…"
            [filters]="[
              {
                key: 'status',
                label: 'Status',
                value: mail.params().filters['status'] || '',
                options: [
                  { value: '', label: 'All' },
                  { value: 'Sent', label: 'Sent' },
                  { value: 'Failed', label: 'Failed' },
                ],
              },
            ]"
            [page]="mail.data().page"
            [pageSize]="mail.params().pageSize"
            [total]="mail.data().total"
            [totalPages]="mail.data().totalPages"
            [loading]="mail.loading()"
            (searchChange)="mail.onSearchChange($event)"
            (filterChange)="mail.setFilter($event.key, $event.value)"
            (pageChange)="mail.setPage($event)"
            (pageSizeChange)="mail.setPageSize($event)"
          />
          @if (mail.error()) {
            <p class="err">{{ mail.error() }}</p>
          }
          <div class="admin-list-body" [class.is-loading]="mail.loading()">
            <table class="table">
              <thead>
                <tr>
                  <th
                    appAdminSort
                    label="When"
                    column="createdAt"
                    [sortBy]="mail.params().sortBy"
                    [sortDir]="mail.params().sortDir"
                    (sort)="mail.toggleSort($event)"
                  ></th>
                  <th
                    appAdminSort
                    label="To"
                    column="toEmail"
                    [sortBy]="mail.params().sortBy"
                    [sortDir]="mail.params().sortDir"
                    (sort)="mail.toggleSort($event)"
                  ></th>
                  <th
                    appAdminSort
                    label="Subject"
                    column="subject"
                    [sortBy]="mail.params().sortBy"
                    [sortDir]="mail.params().sortDir"
                    (sort)="mail.toggleSort($event)"
                  ></th>
                  <th
                    appAdminSort
                    label="Status"
                    column="status"
                    [sortBy]="mail.params().sortBy"
                    [sortDir]="mail.params().sortDir"
                    (sort)="mail.toggleSort($event)"
                  ></th>
                </tr>
              </thead>
              <tbody>
                @for (m of mail.data().items; track m.id) {
                  <tr>
                    <td>{{ formatDate(m.createdAt) }}</td>
                    <td>{{ m.toEmail }}</td>
                    <td>{{ m.subject }}</td>
                    <td>
                      {{ m.status }}{{ m.deliveryDetail ? ' · ' + m.deliveryDetail : '' }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-admin-pager
            [page]="mail.data().page"
            [pageSize]="mail.params().pageSize"
            [total]="mail.data().total"
            [totalPages]="mail.data().totalPages"
            [loading]="mail.loading()"
            (pageChange)="mail.setPage($event)"
            (pageSizeChange)="mail.setPageSize($event)"
          />
        </section>
      }

      @if (commentFor(); as cf) {
        <div
          class="admin-modal-backdrop"
          role="presentation"
          (click)="!busy() && commentFor.set(null)"
        >
          <div
            class="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payout-comment-title"
            (click)="$event.stopPropagation()"
          >
            <h3 id="payout-comment-title">Email trader</h3>
            <p class="meta">To: {{ cf.email || 'unknown' }}</p>
            <label class="admin-field" for="payout-comment-subject">
              Subject
              <input
                id="payout-comment-subject"
                [value]="commentSubject()"
                (input)="commentSubject.set(($any($event.target)).value)"
                maxlength="200"
              />
            </label>
            <label class="admin-field" for="payout-comment-message">
              Message
              <textarea
                id="payout-comment-message"
                [value]="commentMessage()"
                (input)="commentMessage.set(($any($event.target)).value)"
                rows="6"
                maxlength="4000"
                placeholder="Write your message to the trader…"
              ></textarea>
            </label>
            <div class="admin-actions">
              <button
                type="button"
                class="btn"
                [disabled]="busy()"
                (click)="commentFor.set(null)"
              >
                Cancel
              </button>
              <button
                type="button"
                class="btn"
                [disabled]="busy() || !commentMessage().trim()"
                (click)="sendComment()"
              >
                {{ busy() ? 'Sending…' : 'Send email' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class AdminPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly lists = inject(AdminListService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private sub?: Subscription;
  private lastKey = '';

  readonly tabDefs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'payouts', label: 'Payouts' },
    { id: 'verifications', label: 'Verifications' },
    { id: 'traders', label: 'Traders' },
    { id: 'challenges', label: 'Challenges' },
    { id: 'catalog', label: 'Catalog' },
    { id: 'audit', label: 'Audit' },
    { id: 'mail', label: 'Mail' },
  ];

  readonly tab = signal<Tab>('overview');
  readonly err = signal('');
  readonly overview = signal<Overview | null>(null);
  readonly busy = signal(false);
  readonly commentFor = signal<{ id: string; email: string | null } | null>(null);
  readonly commentSubject = signal('Regarding your payout request');
  readonly commentMessage = signal('');
  readonly commentFlash = signal('');
  readonly closeId = signal<string | null>(null);
  readonly verifications = signal<VerificationRow[]>([]);
  readonly verifyBusy = signal('');
  readonly verifyComment = signal('');

  readonly traders: AdminListHandle<TraderRow> = this.lists.createList({
    path: '/api/admin/traders',
  });
  readonly challenges: AdminListHandle<ChallengeRow> = this.lists.createList({
    path: '/api/admin/challenges',
  });
  readonly payouts: AdminListHandle<PayoutRow> = this.lists.createList({
    path: '/api/admin/payouts',
  });
  readonly products: AdminListHandle<ProductRow> = this.lists.createList({
    path: '/api/admin/catalog/products',
    defaultSortBy: 'accountSize',
    defaultSortDir: 'asc',
  });
  readonly audit: AdminListHandle<AuditRow> = this.lists.createList({
    path: '/api/admin/audit',
    defaultSortBy: 'occurredAt',
  });
  readonly mail: AdminListHandle<MailRow> = this.lists.createList({
    path: '/api/admin/notifications',
  });

  ngOnInit() {
    this.sub = this.route.queryParamMap.subscribe((q) => {
      const tabParam = q.get('tab');
      const next: Tab = isTab(tabParam) ? tabParam : 'overview';
      const status = q.get('status') || '';
      const key = `${next}|${status}`;
      this.tab.set(next);
      this.err.set('');
      if (key === this.lastKey) return;
      this.lastKey = key;

      if (next === 'payouts') {
        this.payouts.setFilters({ status });
      } else if (next === 'challenges') {
        this.challenges.setFilters({ status });
      } else {
        void this.loadTab(next);
      }
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  canDecide(status: string) {
    return canDecidePayout(status);
  }

  money(n: number) {
    return Number(n).toFixed(2);
  }

  formatDate(v: string) {
    try {
      return new Date(v).toLocaleString();
    } catch {
      return v;
    }
  }

  goTab(next: Tab, extra?: Record<string, string>) {
    this.replaceAdminUrl(next, extra);
  }

  onPayoutStatusFilter(value: string) {
    this.replaceAdminUrl('payouts', value ? { status: value } : undefined);
  }

  onChallengeStatusFilter(value: string) {
    this.replaceAdminUrl('challenges', value ? { status: value } : undefined);
  }

  private replaceAdminUrl(next: Tab, extra?: Record<string, string>) {
    const queryParams: Record<string, string> = {};
    if (next !== 'overview') queryParams['tab'] = next;
    if (extra) {
      for (const [k, v] of Object.entries(extra)) {
        if (v) queryParams[k] = v;
      }
    }
    void this.router.navigate(['/admin'], { queryParams });
  }

  private async loadTab(t: Tab) {
    if (t === 'overview') await this.loadOverview();
    else if (t === 'verifications') await this.loadVerifications();
    else if (t === 'traders') await this.traders.reload();
    else if (t === 'challenges') await this.challenges.reload();
    else if (t === 'payouts') await this.payouts.reload();
    else if (t === 'catalog') await this.products.reload();
    else if (t === 'audit') await this.audit.reload();
    else if (t === 'mail') await this.mail.reload();
  }

  async refreshActive() {
    await this.loadTab(this.tab());
  }

  async loadOverview() {
    this.err.set('');
    try {
      this.overview.set(await this.api.request<Overview>('/api/admin/overview'));
    } catch (e: unknown) {
      this.err.set(e instanceof Error ? e.message : 'Failed to load overview');
    }
  }

  async loadVerifications() {
    this.err.set('');
    try {
      const res = await this.api.request<{ items: VerificationRow[] }>('/api/admin/verifications');
      this.verifications.set(Array.isArray(res.items) ? res.items : []);
    } catch (e: unknown) {
      this.err.set(e instanceof Error ? e.message : 'Failed to load verifications');
    }
  }

  async decideVerification(traderId: string, approve: boolean) {
    this.verifyBusy.set(traderId);
    this.err.set('');
    try {
      await this.api.request(`/api/admin/verifications/${traderId}/${approve ? 'approve' : 'reject'}`, {
        method: 'POST',
        body: JSON.stringify({ comment: this.verifyComment() || undefined }),
      });
      this.verifyComment.set('');
      await this.loadVerifications();
    } catch (e: unknown) {
      this.err.set(e instanceof Error ? e.message : 'Verification decision failed');
    } finally {
      this.verifyBusy.set('');
    }
  }

  async commentVerification(traderId: string, email: string) {
    this.verifyBusy.set(traderId);
    this.err.set('');
    try {
      await this.api.request(`/api/admin/verifications/${traderId}/comment`, {
        method: 'POST',
        body: JSON.stringify({
          subject: 'Regarding your identity verification',
          message: this.verifyComment() || 'Please provide clearer ID documentation.',
        }),
      });
      this.commentFlash.set(`Email sent to ${email}`);
      this.verifyComment.set('');
    } catch (e: unknown) {
      this.err.set(e instanceof Error ? e.message : 'Comment failed');
    } finally {
      this.verifyBusy.set('');
    }
  }

  openComment(p: PayoutRow) {
    this.err.set('');
    this.commentFlash.set('');
    this.commentFor.set({ id: p.id, email: p.traderEmail ?? null });
    this.commentSubject.set(`Regarding your payout ${String(p.id).slice(0, 8)}`);
    this.commentMessage.set('');
  }

  async decidePayout(id: string, approve: boolean) {
    this.busy.set(true);
    this.err.set('');
    try {
      await this.api.request(`/api/admin/payouts/${id}/${approve ? 'approve' : 'reject'}`, {
        method: 'POST',
      });
      await this.payouts.reload();
      await this.loadOverview();
    } catch (e: unknown) {
      this.err.set(e instanceof Error ? e.message : 'payout decision failed');
    } finally {
      this.busy.set(false);
    }
  }

  async requestVpsInvoice(id: string) {
    this.busy.set(true);
    this.err.set('');
    try {
      await this.api.request(`/api/admin/payouts/${id}/request-vps-invoice`, { method: 'POST' });
      await this.payouts.reload();
    } catch (e: unknown) {
      this.err.set(e instanceof Error ? e.message : 'VPS invoice request failed');
    } finally {
      this.busy.set(false);
    }
  }

  async markVpsReceived(id: string) {
    this.busy.set(true);
    this.err.set('');
    try {
      await this.api.request(`/api/admin/payouts/${id}/vps-invoice-received`, { method: 'POST' });
      await this.payouts.reload();
    } catch (e: unknown) {
      this.err.set(e instanceof Error ? e.message : 'mark invoice received failed');
    } finally {
      this.busy.set(false);
    }
  }

  async sendComment() {
    const cf = this.commentFor();
    if (!cf) return;
    if (!this.commentMessage().trim()) {
      this.err.set('Message is required');
      return;
    }
    this.busy.set(true);
    this.commentFlash.set('');
    this.err.set('');
    try {
      const res = await this.api.request<{ ok: boolean; toEmail?: string }>(
        `/api/admin/payouts/${cf.id}/comment`,
        {
          method: 'POST',
          body: JSON.stringify({
            subject: this.commentSubject().trim() || 'Regarding your payout request',
            message: this.commentMessage().trim(),
          }),
        },
      );
      this.commentFlash.set(`Email queued to ${res.toEmail || cf.email || 'trader'}`);
      this.commentFor.set(null);
      this.commentMessage.set('');
      if (this.tab() === 'mail') await this.mail.reload();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'comment email failed';
      this.err.set(
        msg === 'Not Found' || /not found/i.test(msg)
          ? `${msg} — restart the .NET API on :6080, then try again.`
          : msg,
      );
    } finally {
      this.busy.set(false);
    }
  }

  async confirmCloseChallenge() {
    const id = this.closeId();
    if (!id) return;
    this.busy.set(true);
    this.err.set('');
    try {
      await this.api.request(`/api/admin/challenges/${id}/close`, { method: 'POST' });
      this.closeId.set(null);
      await this.challenges.reload();
    } catch (e: unknown) {
      this.err.set(e instanceof Error ? e.message : 'close failed');
    } finally {
      this.busy.set(false);
    }
  }

  async toggleProduct(id: string, isActive: boolean) {
    this.busy.set(true);
    this.err.set('');
    try {
      await this.api.request(`/api/admin/catalog/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      });
      await this.products.reload();
    } catch (e: unknown) {
      this.err.set(e instanceof Error ? e.message : 'catalog update failed');
    } finally {
      this.busy.set(false);
    }
  }
}
