import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs/operators';
import { ConfirmDialogComponent } from '../../components/confirm-dialog.component';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import {
  accountNo,
  ChallengeRow,
  isArchived,
  money,
  phaseLabel,
  sizeLabel,
  statusClass,
  typeLabel,
} from '../../core/models';
import { AccountDetailPanelComponent } from './account-detail-panel.component';

type Wallet = { traderId: string; availableBalance: number };

const TYPE_OPTS = [
  { value: 'all', label: 'All Types' },
  { value: '1step', label: '1 Step' },
  { value: '2step', label: '2 Step' },
  { value: 'zero', label: 'Zero' },
  { value: 'competition', label: 'Competition' },
];

const STATE_OPTS = [
  { value: 'live', label: 'Active, Funded & Passed' },
  { value: 'all', label: 'All States' },
  { value: 'Active', label: 'Active' },
  { value: 'Funded', label: 'Funded' },
  { value: 'Passed', label: 'Passed' },
  { value: 'Failed', label: 'Failed' },
  { value: 'Closed', label: 'Closed' },
];

const PHASE_OPTS = [
  { value: 'all', label: 'All Phases' },
  { value: '1', label: 'Phase 1' },
  { value: '2', label: 'Phase 2' },
  { value: 'funded', label: 'Funded' },
];

const ROCKET_PATH =
  'M223.85,47.12a16,16,0,0,0-15-15c-12.58-.75-44.73.4-71.41,27.07L132.69,64H74.36A15.91,15.91,0,0,0,63,68.68L28.7,103a16,16,0,0,0,9.07,27.16l38.47,5.37,44.21,44.21,5.37,38.49a15.94,15.94,0,0,0,10.78,12.92,16.11,16.11,0,0,0,5.1.83A15.91,15.91,0,0,0,153,227.3L187.32,193A15.91,15.91,0,0,0,192,181.64V123.31l4.77-4.77C223.45,91.86,224.6,59.71,223.85,47.12ZM74.36,80h42.33L77.16,119.52,40,114.34Zm74.41-9.45a76.65,76.65,0,0,1,59.11-22.47,76.46,76.46,0,0,1-22.42,59.16L128,164.68,91.32,128ZM176,181.64,141.67,216l-5.19-37.17L176,139.31Zm-74.16,9.5C97.34,201,82.29,224,40,224a8,8,0,0,1-8-8c0-42.29,23-57.34,32.86-61.85a8,8,0,0,1,6.64,14.56c-6.43,2.93-20.62,12.36-23.12,38.91,26.55-2.5,36-16.69,38.91-23.12a8,8,0,1,1,14.56,6.64Z';

const PHASE_ICON_PATH =
  'M192,32H64A32,32,0,0,0,32,64V192a32,32,0,0,0,32,32H192a32,32,0,0,0,32-32V64A32,32,0,0,0,192,32Zm16,160a16,16,0,0,1-16,16H64a16,16,0,0,1-16-16V64A16,16,0,0,1,64,48H192a16,16,0,0,1,16,16ZM104,92A12,12,0,1,1,92,80,12,12,0,0,1,104,92Zm72,0a12,12,0,1,1-12-12A12,12,0,0,1,176,92Zm-72,72a12,12,0,1,1-12-12A12,12,0,0,1,104,164Zm36-36a12,12,0,1,1-12-12A12,12,0,0,1,140,128Zm36,36a12,12,0,1,1-12-12A12,12,0,0,1,176,164Z';

const BRIEFCASE_PATH =
  'M216,56H176V48a24,24,0,0,0-24-24H104A24,24,0,0,0,80,48v8H40A16,16,0,0,0,24,72V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V72A16,16,0,0,0,216,56ZM96,48a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96ZM216,72v41.61A184,184,0,0,1,128,136a184.07,184.07,0,0,1-88-22.38V72Zm0,128H40V131.64A200.19,200.19,0,0,0,128,152a200.25,200.25,0,0,0,88-20.37V200ZM104,112a8,8,0,0,1,8-8h32a8,8,0,0,1,0,16H112A8,8,0,0,1,104,112Z';

const ARCHIVE_PATH =
  'M224,48H32A16,16,0,0,0,16,64V88a16,16,0,0,0,16,16v88a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V104a16,16,0,0,0,16-16V64A16,16,0,0,0,224,48ZM208,192H48V104H208ZM224,88H32V64H224V88Z';

const COMPACT_PATH =
  'M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z';

function matchesType(c: { sku?: string; kind?: string }, filter: string) {
  if (filter === 'all') return true;
  if (filter === 'competition') {
    return c.kind === 'competition' || (c.sku || '').toLowerCase().includes('compet');
  }
  const s = (c.sku || '').toLowerCase();
  if (filter === '1step') return s.includes('1step') || s.includes('1_step') || s.includes('one');
  if (filter === '2step') return s.includes('2step') || s.includes('2_step') || s.includes('two');
  if (filter === 'zero') return s.includes('zero');
  return true;
}

@Component({
  selector: 'app-account-menu',
  standalone: true,
  imports: [ConfirmDialogComponent],
  template: `
    <div class="acc-menu" (click)="$event.preventDefault(); $event.stopPropagation()">
      <button
        type="button"
        class="acc-menu-btn"
        aria-label="Account actions"
        [attr.aria-expanded]="open()"
        (click)="$event.preventDefault(); $event.stopPropagation(); open.update((v) => !v)"
      >
        ⋮
      </button>
      @if (open()) {
        <button
          type="button"
          class="acc-menu-scrim"
          aria-label="Close menu"
          (click)="$event.preventDefault(); $event.stopPropagation(); open.set(false)"
        ></button>
        <div class="acc-menu-pop" role="menu">
          @if (!archived()) {
            <button type="button" role="menuitem" [disabled]="busy()" (click)="askArchive($event)">
              Archive
            </button>
          } @else {
            <span class="acc-menu-muted">Already archived</span>
          }
        </div>
      }
      <app-confirm-dialog
        [open]="confirmOpen()"
        title="Archive this account?"
        [description]="
          '#' + (login() || id().slice(0, 9)) + ' will be closed. We’ll email you a link to undo.'
        "
        confirmLabel="Archive"
        [danger]="true"
        [busy]="busy()"
        (cancel)="!busy() && confirmOpen.set(false)"
        (confirm)="doArchive()"
      />
      @if (menuErr()) {
        <p class="err acc-menu-err">{{ menuErr() }}</p>
      }
    </div>
  `,
})
export class AccountMenuComponent {
  private readonly api = inject(ApiService);

  readonly id = input.required<string>();
  readonly login = input<string>();
  readonly archived = input(false);
  readonly archivedChange = output<void>();

  readonly open = signal(false);
  readonly busy = signal(false);
  readonly confirmOpen = signal(false);
  readonly menuErr = signal('');

  askArchive(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    if (this.archived() || this.busy()) return;
    this.menuErr.set('');
    this.confirmOpen.set(true);
    this.open.set(false);
  }

  async doArchive() {
    this.busy.set(true);
    this.menuErr.set('');
    try {
      await this.api.request(`/api/challenges/${this.id()}/archive`, {
        method: 'POST',
        body: '{}',
      });
      this.confirmOpen.set(false);
      this.archivedChange.emit();
    } catch (ex: unknown) {
      this.menuErr.set(ex instanceof Error ? ex.message : 'Archive failed');
    } finally {
      this.busy.set(false);
    }
  }
}

@Component({
  selector: 'app-accounts-workspace',
  standalone: true,
  imports: [RouterLink, FormsModule, AccountDetailPanelComponent, AccountMenuComponent],
  template: `
    <div
      class="acc-desk"
      [class.has-selection]="!!selectedId()"
      [class.sidebar-collapsed]="collapsed()"
    >
      <div class="acc-sidebar" [class.is-collapsed]="collapsed()">
        <div class="acc-sidebar-inner">
          <div class="acc-list-pad">
            <div class="acc-list-inset">
              <section class="acc-header">
                <div class="acc-header-glow" aria-hidden="true"></div>
                <div class="acc-header-top">
                  <h1>Hey, {{ name() }}</h1>
                  <p>Your PropFirm account overview</p>
                </div>
                <div class="acc-metrics">
                  <div>
                    <div class="acc-metric-label">Trader Rank</div>
                    <div class="acc-tier">Bronze Tier</div>
                  </div>
                  <div>
                    <div class="acc-metric-label">Reward Count</div>
                    <div class="acc-metric-value">{{ rewardCount() }}</div>
                  </div>
                  <div>
                    <div class="acc-metric-label">Total Rewards</div>
                    <div class="acc-metric-value">
                      {{
                        '$' +
                          totalRewards().toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                      }}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <div class="acc-list-body">
            <div class="acc-buy-wrap">
              <a routerLink="/new-challenge" class="acc-buy">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="currentColor"
                  viewBox="0 0 256 256"
                  aria-hidden="true"
                >
                  <path [attr.d]="rocketPath" />
                </svg>
                <span>Buy Challenge</span>
              </a>
            </div>

            <div class="acc-filters">
              <label class="acc-select">
                <span class="sr-only">All Types</span>
                <select [value]="typeF()" (change)="setType($any($event.target).value)">
                  @for (o of typeOpts; track o.value) {
                    <option [value]="o.value">{{ o.label }}</option>
                  }
                </select>
              </label>
              <label class="acc-select">
                <span class="sr-only">States</span>
                <select [value]="stateF()" (change)="setState($any($event.target).value)">
                  @for (o of stateOpts; track o.value) {
                    <option [value]="o.value">{{ o.label }}</option>
                  }
                </select>
              </label>
              <label class="acc-select">
                <span class="sr-only">All Phases</span>
                <select [value]="phaseF()" (change)="setPhase($any($event.target).value)">
                  @for (o of phaseOpts; track o.value) {
                    <option [value]="o.value">{{ o.label }}</option>
                  }
                </select>
              </label>
            </div>

            <div class="acc-toolbar">
              <div></div>
              <div class="acc-toggles">
                <button
                  type="button"
                  class="acc-toggle"
                  [class.on]="showArchived()"
                  [attr.aria-pressed]="showArchived()"
                  aria-label="Show Archived"
                  title="Show Archived"
                  (click)="showArchived.update((v) => !v)"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    fill="currentColor"
                    viewBox="0 0 256 256"
                    aria-hidden="true"
                  >
                    <path [attr.d]="archivePath" />
                  </svg>
                  <span class="acc-dot" [class.on]="showArchived()"></span>
                </button>
                <button
                  type="button"
                  class="acc-toggle"
                  [class.on]="compact()"
                  [attr.aria-pressed]="compact()"
                  aria-label="Compact View"
                  title="Compact View"
                  (click)="compact.update((v) => !v)"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    fill="currentColor"
                    viewBox="0 0 256 256"
                    aria-hidden="true"
                  >
                    <path [attr.d]="compactPath" />
                  </svg>
                  <span class="acc-dot" [class.on]="compact()"></span>
                </button>
              </div>
            </div>

            @if (err()) {
              <p class="err acc-list-err">{{ err() }}</p>
            }

            <div class="acc-scroll">
              @if (filtered().length === 0) {
                <div class="acc-empty">
                  <p>{{ noAccounts() ? 'No accounts yet.' : 'No accounts match these filters.' }}</p>
                  <span>Buy a challenge or join a competition to get started.</span>
                </div>
              } @else {
                @for (c of filtered(); track c.id) {
                  <div
                    class="acc-card"
                    [class.is-active]="selectedId() === c.id"
                    [class.is-compact]="compact()"
                    role="link"
                    tabindex="0"
                    (click)="openAccount(c.id)"
                    (keydown.enter)="openAccount(c.id)"
                  >
                    @if (selectedId() === c.id) {
                      <span class="acc-active-bar" aria-hidden="true"></span>
                    }
                    <div class="acc-card-top">
                      <div class="acc-card-id">
                        <svg
                          class="acc-phase-icon"
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          fill="currentColor"
                          viewBox="0 0 256 256"
                          aria-hidden="true"
                        >
                          <path [attr.d]="phaseIconPath" />
                        </svg>
                        <div>
                          <div class="acc-card-title">
                            {{
                              c.kind === 'competition' && c.competitionTitle
                                ? c.competitionTitle
                                : '#' + accountNo(c)
                            }}
                          </div>
                          <div class="acc-card-sub">
                            <span>{{ sizeLabel(c.accountSize) }}</span>
                            <span aria-hidden="true">•</span>
                            <span>{{ typeLabel(c.sku) }}</span>
                            <span aria-hidden="true">•</span>
                            <span>{{ phaseLabel(c) }}</span>
                          </div>
                        </div>
                      </div>
                      <div class="acc-card-right">
                        <span [class]="statusClass(c.status)">{{ c.status }}</span>
                        @if (c.kind !== 'competition') {
                          <app-account-menu
                            [id]="c.id"
                            [login]="accountNo(c)"
                            [archived]="isArchived(c)"
                            (archivedChange)="onArchived(c.id)"
                          />
                        }
                      </div>
                    </div>
                    @if (!compact()) {
                      <div class="acc-card-grid">
                        <div>
                          <div class="acc-metric-label">Balance</div>
                          <div class="acc-metric-value">
                            {{
                              '$' +
                                (c.equity ?? c.accountSize).toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                })
                            }}
                          </div>
                        </div>
                        <div>
                          <div class="acc-metric-label">Account Type</div>
                          <div class="acc-metric-value">{{ typeLabel(c.sku) }}</div>
                        </div>
                        <div>
                          <div class="acc-metric-label">P&amp;L</div>
                          <div
                            class="acc-metric-value"
                            [class.up]="pnlOf(c) >= 0"
                            [class.down]="pnlOf(c) < 0"
                          >
                            {{ money(pnlOf(c)) }}
                          </div>
                        </div>
                        <div>
                          <div class="acc-metric-label">Profit %</div>
                          <div
                            class="acc-metric-value"
                            [class.up]="pctOf(c) >= 0"
                            [class.down]="pctOf(c) < 0"
                          >
                            {{ pctOf(c) >= 0 ? '+' : '' }}{{ pctOf(c).toFixed(1) }}%
                          </div>
                        </div>
                      </div>
                    }
                  </div>
                }
              }
            </div>
          </div>
        </div>
        <button
          type="button"
          class="acc-collapse-btn"
          [attr.aria-label]="collapsed() ? 'Expand sidebar' : 'Collapse sidebar'"
          (click)="collapsed.update((v) => !v)"
        >
          {{ collapsed() ? '›' : '‹' }}
        </button>
      </div>

      <div class="acc-main">
        @if (selectedId(); as id) {
          <app-account-detail-panel [challengeId]="id" (archived)="onArchived(id)" />
        } @else {
          <div class="acc-select-empty">
            <div class="acc-select-empty-icon" aria-hidden="true">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                fill="currentColor"
                viewBox="0 0 256 256"
              >
                <path [attr.d]="briefcasePath" />
              </svg>
            </div>
            <h3>Select an Account to View Details</h3>
            <p>
              Choose a trading account from the list to see its detailed information and performance
              metrics.
            </p>
            <div class="acc-select-empty-cta">
              <p>
                @if (noAccounts()) {
                  Don't have an account yet?
                  <br />
                  Trade up to $400,000 in simulated capital.
                } @else {
                  Need another account?
                  <br />
                  Trade up to $400,000 in simulated capital.
                }
              </p>
              <a routerLink="/new-challenge" class="acc-buy-challenge-btn">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="currentColor"
                  viewBox="0 0 256 256"
                  aria-hidden="true"
                >
                  <path [attr.d]="rocketPath" />
                </svg>
                Buy Challenge
              </a>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class AccountsWorkspaceComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly selectedId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id') || undefined)),
    { initialValue: undefined as string | undefined },
  );

  readonly typeOpts = TYPE_OPTS;
  readonly stateOpts = STATE_OPTS;
  readonly phaseOpts = PHASE_OPTS;
  readonly rocketPath = ROCKET_PATH;
  readonly phaseIconPath = PHASE_ICON_PATH;
  readonly briefcasePath = BRIEFCASE_PATH;
  readonly archivePath = ARCHIVE_PATH;
  readonly compactPath = COMPACT_PATH;
  readonly accountNo = accountNo;
  readonly sizeLabel = sizeLabel;
  readonly typeLabel = typeLabel;
  readonly phaseLabel = phaseLabel;
  readonly statusClass = statusClass;
  readonly money = money;
  readonly isArchived = isArchived;

  readonly rows = signal<ChallengeRow[]>([]);
  readonly wallet = signal<Wallet | null>(null);
  readonly err = signal('');
  readonly name = signal('Trader');
  readonly showArchived = signal(false);
  readonly compact = signal(false);
  readonly collapsed = signal(false);

  readonly typeF = signal('all');
  readonly stateF = signal('live');
  readonly phaseF = signal('all');

  readonly rewardCount = computed(() => this.rows().filter((r) => r.status === 'Funded').length);
  readonly totalRewards = computed(() => this.wallet()?.availableBalance ?? 0);
  readonly noAccounts = computed(() => this.rows().filter((r) => !isArchived(r)).length === 0);

  readonly filtered = computed(() => {
    const rows = this.rows();
    const showArchived = this.showArchived();
    const typeF = this.typeF();
    const stateF = this.stateF();
    const phaseF = this.phaseF();
    return rows.filter((c) => {
      if (!matchesType(c, typeF)) return false;

      const archived = isArchived(c);
      // Archive toggle: only archived rows. Explicit Closed filter also includes archived.
      if (showArchived) {
        if (!archived) return false;
      } else if (archived && stateF !== 'Closed') {
        return false;
      }

      if (stateF === 'live') {
        if (!(c.status === 'Active' || c.status === 'Funded' || c.status === 'Passed')) return false;
      } else if (stateF !== 'all' && c.status !== stateF) {
        return false;
      }

      // Competitions are not challenge phases — ignore phase filter for them unless "all".
      const isComp = c.kind === 'competition' || (c.sku || '').toLowerCase().includes('compet');
      if (!isComp) {
        if (phaseF === 'funded') {
          if (!(c.status === 'Funded' || c.currentPhase > c.phases)) return false;
        } else if (phaseF !== 'all' && String(c.currentPhase ?? '') !== phaseF) {
          return false;
        }
      } else if (phaseF === 'funded') {
        return false;
      }

      return true;
    });
  });

  ngOnInit() {
    void this.load();
  }

  setType(v: string) {
    this.typeF.set(v || 'all');
  }

  setState(v: string) {
    this.stateF.set(v || 'live');
  }

  setPhase(v: string) {
    this.phaseF.set(v || 'all');
  }

  openAccount(id: string) {
    void this.router.navigate(['/accounts', id]);
  }

  async onArchived(id: string) {
    this.rows.update((list) =>
      list.map((r) =>
        r.id === id ? { ...r, status: 'Closed', archived: true } : r,
      ),
    );
    if (this.selectedId() === id) {
      await this.router.navigateByUrl('/accounts');
    }
    await this.load();
  }

  pnlOf(c: ChallengeRow) {
    return c.pnl ?? (c.equity ?? c.accountSize) - c.accountSize;
  }

  pctOf(c: ChallengeRow) {
    return (
      c.profitPct ??
      (c.accountSize ? (((c.equity ?? c.accountSize) - c.accountSize) / c.accountSize) * 100 : 0)
    );
  }

  async load() {
    this.err.set('');
    try {
      const [ch, w, me] = await Promise.all([
        this.api.request<ChallengeRow[]>('/api/challenges').catch(() => [] as ChallengeRow[]),
        this.api.request<Wallet>('/api/payouts/wallet').catch(() => null),
        this.api
          .request<{ displayName?: string; email?: string }>('/api/users/me')
          .catch(() => null),
      ]);
      this.rows.set(Array.isArray(ch) ? ch : []);
      this.wallet.set(w);
      const session = this.auth.user();
      const display = me?.displayName || session?.displayName || '';
      const email = me?.email || session?.email || '';
      if (display) this.name.set(display.split(' ')[0] || 'Trader');
      else if (email) this.name.set(email.split('@')[0] || 'Trader');
    } catch (e: unknown) {
      this.err.set(e instanceof Error ? e.message : String(e));
    }
  }
}
