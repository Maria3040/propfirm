import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  INSTRUMENTS,
  calculatePosition,
  findInstrument,
  formatLots,
  formatMoney,
  formatPips,
  type Direction,
  type PriceMode,
  type TpMode,
} from '../lib/risk-calculator';

const BALANCE_PRESETS = [5000, 10000, 25000, 50000];
const RISK_PRESETS = [0.5, 1, 2, 3];
const LEVERAGE_PRESETS = [2, 5, 10, 20, 30, 50, 100];

@Component({
  selector: 'app-tools-risk-calculator-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="rc-page">
      <div class="rc-back"><a routerLink="/tools">← Trading Tools</a></div>
      <div class="rc-layout">
        <div class="rc-form">
          <header class="rc-form-head">
            <div class="rc-title-row">
              <h2>Position Calculator</h2>
              <span class="tools-badge">Beta</span>
            </div>
            <p>Calculate your optimal position size based on risk parameters</p>
          </header>

          <div class="rc-section">
            <label class="rc-label">Instrument</label>
            <div class="rc-picker-wrap">
              <button type="button" class="rc-picker" [attr.aria-expanded]="pickerOpen()" (click)="pickerOpen.set(!pickerOpen())">
                {{ instrument().symbol }}
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 256 256" aria-hidden class="rc-chevrons">
                  <path d="M181.66,170.34a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-48-48a8,8,0,0,1,11.32-11.32L128,212.69l42.34-42.35A8,8,0,0,1,181.66,170.34Zm-96-84.68L128,43.31l42.34,42.35a8,8,0,0,0,11.32-11.32l-48-48a8,8,0,0,0-11.32,0l-48,48A8,8,0,0,0,85.66,85.66Z" />
                </svg>
              </button>
              @if (pickerOpen()) {
                <ul class="rc-picker-menu" role="listbox">
                  @for (i of instruments; track i.symbol) {
                    <li>
                      <button type="button" role="option" [attr.aria-selected]="i.symbol === symbol()" (click)="selectSymbol(i.symbol)">
                        <span>{{ i.symbol }}</span>
                        <span class="rc-muted">{{ i.type }}</span>
                      </button>
                    </li>
                  }
                </ul>
              }
            </div>
            <div class="rc-meta">
              <span>Pip: <strong>{{ instrument().pipSize }}</strong></span>
              <span>Type: <strong>{{ instrument().type }}</strong></span>
            </div>
          </div>

          <div class="rc-section">
            <label class="rc-label">Direction</label>
            <div role="radiogroup" aria-label="Direction" class="rc-direction">
              <button type="button" role="radio" class="rc-dir long" [class.on]="direction() === 'long'" [attr.aria-checked]="direction() === 'long'" (click)="direction.set('long')">Long</button>
              <button type="button" role="radio" class="rc-dir short" [class.on]="direction() === 'short'" [attr.aria-checked]="direction() === 'short'" (click)="direction.set('short')">Short</button>
            </div>
          </div>

          <hr class="rc-rule" />

          <div class="rc-grid-2">
            <div class="rc-section">
              <label class="rc-label" for="rc-balance">Balance</label>
              <div class="rc-input-affix">
                <span class="rc-prefix">$</span>
                <input id="rc-balance" class="rc-input has-prefix" type="number" min="0" step="100" [ngModel]="balance()" (ngModelChange)="balance.set(+$event || 0)" />
              </div>
            </div>
            <div class="rc-section">
              <label class="rc-label" for="rc-risk">Risk %</label>
              <div class="rc-input-affix">
                <input id="rc-risk" class="rc-input has-suffix" type="number" min="0.1" max="100" step="0.1" [ngModel]="risk()" (ngModelChange)="risk.set(+$event || 0)" />
                <span class="rc-suffix">%</span>
              </div>
            </div>
          </div>

          <div class="rc-grid-2">
            <div>
              <div class="rc-micro">Quick Balance</div>
              <div class="rc-presets">
                @for (b of balancePresets; track b) {
                  <button type="button" class="rc-preset" [class.on]="balance() === b" (click)="balance.set(b)">{{ '$' + (b / 1000) + 'k' }}</button>
                }
              </div>
            </div>
            <div>
              <div class="rc-micro">Risk Level</div>
              <div class="rc-presets">
                @for (r of riskPresets; track r) {
                  <button type="button" class="rc-preset" [class.on]="risk() === r" (click)="risk.set(r)">{{ r }}%</button>
                }
              </div>
            </div>
          </div>

          <hr class="rc-rule" />

          <div class="rc-section">
            <label class="rc-label" for="rc-leverage">Leverage</label>
            <div class="rc-leverage-row">
              <div class="rc-input-affix rc-lev-input">
                <span class="rc-prefix">1:</span>
                <input id="rc-leverage" class="rc-input has-prefix" type="number" min="1" max="500" step="1" [ngModel]="leverage()" (ngModelChange)="leverage.set(+$event || 1)" />
              </div>
              <div class="rc-presets wrap">
                @for (l of leveragePresets; track l) {
                  <button type="button" class="rc-preset" [class.on]="leverage() === l" (click)="leverage.set(l)">1:{{ l }}</button>
                }
              </div>
            </div>
          </div>

          <hr class="rc-rule" />

          <div class="rc-prices">
            <div class="rc-section">
              <label class="rc-label" for="rc-entry">Entry</label>
              <input id="rc-entry" class="rc-input" type="number" min="0" step="any" [placeholder]="instrument().placeholder" [ngModel]="entry()" (ngModelChange)="entry.set($event)" />
            </div>
            <div class="rc-section">
              <div class="rc-label-row">
                <label class="rc-label danger" for="rc-stop-loss">Stop Loss</label>
                <div role="radiogroup" aria-label="Stop loss input mode" class="rc-mode">
                  <button type="button" role="radio" [class.on]="stopMode() === 'price'" [attr.aria-checked]="stopMode() === 'price'" (click)="setStopMode('price')">Price</button>
                  <button type="button" role="radio" [class.on]="stopMode() === 'pips'" [attr.aria-checked]="stopMode() === 'pips'" (click)="setStopMode('pips')">Pips</button>
                </div>
              </div>
              <input id="rc-stop-loss" class="rc-input" type="number" min="0" step="any" [placeholder]="stopPlaceholder()" [ngModel]="stopLoss()" (ngModelChange)="stopLoss.set($event)" />
            </div>
            <div class="rc-section">
              <div class="rc-label-row">
                <div class="rc-label-group">
                  <label class="rc-label success" for="rc-take-profit">Take Profit</label>
                  <span class="rc-optional">(optional)</span>
                </div>
                <div role="radiogroup" aria-label="Take profit input mode" class="rc-mode">
                  <button type="button" role="radio" [class.on]="tpMode() === 'price'" (click)="setTpMode('price')">Price</button>
                  <button type="button" role="radio" [class.on]="tpMode() === 'pips'" (click)="setTpMode('pips')">Pips</button>
                  <button type="button" role="radio" [class.on]="tpMode() === 'rr'" (click)="setTpMode('rr')">R:R</button>
                </div>
              </div>
              <input id="rc-take-profit" class="rc-input" type="number" min="0" step="any" [placeholder]="tpPlaceholder()" [ngModel]="takeProfit()" (ngModelChange)="takeProfit.set($event)" />
            </div>
          </div>
        </div>

        <div class="rc-results">
          @if (!result()) {
            <div class="rc-empty">
              <h3>Enter Your Trade Details</h3>
              <p>Fill in the instrument, account balance, risk percentage, and price levels to calculate your position size.</p>
              <div class="rc-steps">
                <span>1. Select instrument</span>
                <span>2. Set balance &amp; risk</span>
                <span>3. Enter prices</span>
              </div>
            </div>
          } @else {
            <div class="rc-result-panel">
              <h3>Position size</h3>
              <p class="rc-lots">{{ formatLots(result()!.lots) }} <span>lots</span></p>
              <dl class="rc-stats">
                <div><dt>Risk amount</dt><dd class="danger">{{ formatMoney(result()!.riskAmount) }}</dd></div>
                <div><dt>Stop distance</dt><dd>{{ formatPips(result()!.stopPips) }} pips</dd></div>
                <div><dt>Stop price</dt><dd>{{ result()!.stopPrice.toFixed(instrument().pipSize < 0.01 ? 5 : 2) }}</dd></div>
                <div><dt>Required margin</dt><dd>{{ formatMoney(result()!.margin) }}</dd></div>
                <div><dt>Units</dt><dd>{{ Math.round(result()!.units).toLocaleString() }}</dd></div>
                @if (result()!.tpPrice != null) {
                  <div><dt>Take profit</dt><dd class="success">{{ result()!.tpPrice!.toFixed(instrument().pipSize < 0.01 ? 5 : 2) }}</dd></div>
                }
                @if (result()!.tpPips != null) {
                  <div><dt>TP distance</dt><dd>{{ formatPips(result()!.tpPips!) }} pips</dd></div>
                }
                @if (result()!.rewardAmount != null) {
                  <div><dt>Potential reward</dt><dd class="success">{{ formatMoney(result()!.rewardAmount!) }}</dd></div>
                }
                @if (result()!.riskReward != null) {
                  <div><dt>Risk : Reward</dt><dd>1 : {{ result()!.riskReward!.toFixed(2) }}</dd></div>
                }
              </dl>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class ToolsRiskCalculatorPage {
  readonly Math = Math;
  readonly instruments = INSTRUMENTS;
  readonly balancePresets = BALANCE_PRESETS;
  readonly riskPresets = RISK_PRESETS;
  readonly leveragePresets = LEVERAGE_PRESETS;
  readonly formatLots = formatLots;
  readonly formatMoney = formatMoney;
  readonly formatPips = formatPips;

  readonly symbol = signal('EURUSD');
  readonly pickerOpen = signal(false);
  readonly direction = signal<Direction>('long');
  readonly balance = signal(10000);
  readonly risk = signal(1);
  readonly leverage = signal(100);
  readonly entry = signal('');
  readonly stopLoss = signal('');
  readonly takeProfit = signal('');
  readonly stopMode = signal<PriceMode>('price');
  readonly tpMode = signal<TpMode>('price');

  readonly instrument = computed(() => findInstrument(this.symbol()));
  readonly result = computed(() => {
    const entryN = Number(this.entry());
    const stopN = Number(this.stopLoss());
    const tpRaw = this.takeProfit();
    const tpN = tpRaw === '' ? null : Number(tpRaw);
    return calculatePosition({
      instrument: this.instrument(),
      direction: this.direction(),
      balance: this.balance(),
      riskPercent: this.risk(),
      leverage: this.leverage(),
      entry: entryN,
      stopLoss: stopN,
      stopMode: this.stopMode(),
      takeProfit: tpN != null && Number.isFinite(tpN) ? tpN : null,
      tpMode: this.tpMode(),
    });
  });

  readonly stopPlaceholder = computed(() =>
    this.stopMode() === 'pips'
      ? '20'
      : this.instrument().placeholder.replace(/(\d)$/, (d) => String(Math.max(0, Number(d) - 5))),
  );
  readonly tpPlaceholder = computed(() => {
    if (this.tpMode() === 'pips') return '40';
    if (this.tpMode() === 'rr') return '2';
    return this.instrument().placeholder.replace(/(\d)$/, (d) => String(Number(d) + 5));
  });

  selectSymbol(sym: string) {
    this.symbol.set(sym);
    this.pickerOpen.set(false);
    this.entry.set('');
    this.stopLoss.set('');
    this.takeProfit.set('');
  }

  setStopMode(mode: PriceMode) {
    this.stopMode.set(mode);
    this.stopLoss.set('');
  }

  setTpMode(mode: TpMode) {
    this.tpMode.set(mode);
    this.takeProfit.set('');
  }
}
