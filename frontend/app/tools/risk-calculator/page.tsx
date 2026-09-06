'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
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
} from '@/lib/risk-calculator';

const BALANCE_PRESETS = [5000, 10000, 25000, 50000];
const RISK_PRESETS = [0.5, 1, 2, 3];
const LEVERAGE_PRESETS = [2, 5, 10, 20, 30, 50, 100];

function ArrowUp() {
  return (
    <svg width="16" height="16" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
      <path d="M205.66,117.66a8,8,0,0,1-11.32,0L136,59.31V216a8,8,0,0,1-16,0V59.31L61.66,117.66a8,8,0,0,1-11.32-11.32l72-72a8,8,0,0,1,11.32,0l72,72A8,8,0,0,1,205.66,117.66Z" />
    </svg>
  );
}

function ArrowDown() {
  return (
    <svg width="16" height="16" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
      <path d="M205.66,149.66l-72,72a8,8,0,0,1-11.32,0l-72-72a8,8,0,0,1,11.32-11.32L120,196.69V40a8,8,0,0,1,16,0V196.69l58.34-58.35a8,8,0,0,1,11.32,11.32Z" />
    </svg>
  );
}

function Chevrons() {
  return (
    <svg width="16" height="16" fill="currentColor" viewBox="0 0 256 256" aria-hidden className="rc-chevrons">
      <path d="M181.66,170.34a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-48-48a8,8,0,0,1,11.32-11.32L128,212.69l42.34-42.35A8,8,0,0,1,181.66,170.34Zm-96-84.68L128,43.31l42.34,42.35a8,8,0,0,0,11.32-11.32l-48-48a8,8,0,0,0-11.32,0l-48,48A8,8,0,0,0,85.66,85.66Z" />
    </svg>
  );
}

function ModeToggle({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="rc-mode">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          className={value === o.id ? 'on' : undefined}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function RiskCalculatorPage() {
  const [symbol, setSymbol] = useState('EURUSD');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [direction, setDirection] = useState<Direction>('long');
  const [balance, setBalance] = useState(10000);
  const [risk, setRisk] = useState(1);
  const [leverage, setLeverage] = useState(100);
  const [entry, setEntry] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [stopMode, setStopMode] = useState<PriceMode>('price');
  const [tpMode, setTpMode] = useState<TpMode>('price');

  const instrument = useMemo(() => findInstrument(symbol), [symbol]);

  const result = useMemo(() => {
    const entryN = Number(entry);
    const stopN = Number(stopLoss);
    const tpN = takeProfit === '' ? null : Number(takeProfit);
    return calculatePosition({
      instrument,
      direction,
      balance,
      riskPercent: risk,
      leverage,
      entry: entryN,
      stopLoss: stopN,
      stopMode,
      takeProfit: tpN != null && Number.isFinite(tpN) ? tpN : null,
      tpMode,
    });
  }, [instrument, direction, balance, risk, leverage, entry, stopLoss, takeProfit, stopMode, tpMode]);

  const stopPlaceholder =
    stopMode === 'pips' ? '20' : instrument.placeholder.replace(/(\d)$/, (d) => String(Math.max(0, Number(d) - 5)));
  const tpPlaceholder =
    tpMode === 'pips' ? '40' : tpMode === 'rr' ? '2' : instrument.placeholder.replace(/(\d)$/, (d) => String(Number(d) + 5));

  return (
    <div className="rc-page">
      <div className="rc-back">
        <Link href="/tools">← Trading Tools</Link>
      </div>

      <div className="rc-layout">
        <div className="rc-form">
          <header className="rc-form-head">
            <div className="rc-title-row">
              <h2>Position Calculator</h2>
              <span className="tools-badge">Beta</span>
            </div>
            <p>Calculate your optimal position size based on risk parameters</p>
          </header>

          <div className="rc-section">
            <label className="rc-label">Instrument</label>
            <div className="rc-picker-wrap">
              <button
                type="button"
                className="rc-picker"
                aria-expanded={pickerOpen}
                aria-haspopup="listbox"
                onClick={() => setPickerOpen((o) => !o)}
              >
                {instrument.symbol}
                <Chevrons />
              </button>
              {pickerOpen && (
                <ul className="rc-picker-menu" role="listbox">
                  {INSTRUMENTS.map((i) => (
                    <li key={i.symbol}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={i.symbol === symbol}
                        onClick={() => {
                          setSymbol(i.symbol);
                          setPickerOpen(false);
                          setEntry('');
                          setStopLoss('');
                          setTakeProfit('');
                        }}
                      >
                        <span>{i.symbol}</span>
                        <span className="rc-muted">{i.type}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rc-meta">
              <span>
                Pip: <strong>{instrument.pipSize}</strong>
              </span>
              <span>
                Type: <strong>{instrument.type}</strong>
              </span>
            </div>
          </div>

          <div className="rc-section">
            <label className="rc-label">Direction</label>
            <div role="radiogroup" aria-label="Direction" className="rc-direction">
              <button
                type="button"
                role="radio"
                aria-checked={direction === 'long'}
                className={`rc-dir long${direction === 'long' ? ' on' : ''}`}
                onClick={() => setDirection('long')}
              >
                <ArrowUp /> Long
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={direction === 'short'}
                className={`rc-dir short${direction === 'short' ? ' on' : ''}`}
                onClick={() => setDirection('short')}
              >
                <ArrowDown /> Short
              </button>
            </div>
          </div>

          <hr className="rc-rule" />

          <div className="rc-grid-2">
            <div className="rc-section">
              <label className="rc-label" htmlFor="rc-balance">
                Balance
              </label>
              <div className="rc-input-affix">
                <span className="rc-prefix">$</span>
                <input
                  id="rc-balance"
                  className="rc-input has-prefix"
                  type="number"
                  min={0}
                  step={100}
                  value={balance}
                  onChange={(e) => setBalance(Number(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="rc-section">
              <label className="rc-label" htmlFor="rc-risk">
                Risk %
              </label>
              <div className="rc-input-affix">
                <input
                  id="rc-risk"
                  className="rc-input has-suffix"
                  type="number"
                  min={0.1}
                  max={100}
                  step={0.1}
                  value={risk}
                  onChange={(e) => setRisk(Number(e.target.value) || 0)}
                />
                <span className="rc-suffix">%</span>
              </div>
            </div>
          </div>

          <div className="rc-grid-2">
            <div>
              <div className="rc-micro">Quick Balance</div>
              <div className="rc-presets">
                {BALANCE_PRESETS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    className={`rc-preset${balance === b ? ' on' : ''}`}
                    onClick={() => setBalance(b)}
                  >
                    ${b / 1000}k
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="rc-micro">Risk Level</div>
              <div className="rc-presets">
                {RISK_PRESETS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`rc-preset${risk === r ? ' on' : ''}`}
                    onClick={() => setRisk(r)}
                  >
                    {r}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          <hr className="rc-rule" />

          <div className="rc-section">
            <label className="rc-label" htmlFor="rc-leverage">
              Leverage
            </label>
            <div className="rc-leverage-row">
              <div className="rc-input-affix rc-lev-input">
                <span className="rc-prefix">1:</span>
                <input
                  id="rc-leverage"
                  className="rc-input has-prefix"
                  type="number"
                  min={1}
                  max={500}
                  step={1}
                  value={leverage}
                  onChange={(e) => setLeverage(Number(e.target.value) || 1)}
                />
              </div>
              <div className="rc-presets wrap">
                {LEVERAGE_PRESETS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    className={`rc-preset${leverage === l ? ' on' : ''}`}
                    onClick={() => setLeverage(l)}
                  >
                    1:{l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <hr className="rc-rule" />

          <div className="rc-prices">
            <div className="rc-section">
              <label className="rc-label" htmlFor="rc-entry">
                Entry
              </label>
              <input
                id="rc-entry"
                className="rc-input"
                type="number"
                min={0}
                step="any"
                placeholder={instrument.placeholder}
                value={entry}
                onChange={(e) => setEntry(e.target.value)}
              />
            </div>

            <div className="rc-section">
              <div className="rc-label-row">
                <label className="rc-label danger" htmlFor="rc-stop-loss">
                  Stop Loss
                </label>
                <ModeToggle
                  label="Stop loss input mode"
                  value={stopMode}
                  options={[
                    { id: 'price', label: 'Price' },
                    { id: 'pips', label: 'Pips' },
                  ]}
                  onChange={(id) => {
                    setStopMode(id as PriceMode);
                    setStopLoss('');
                  }}
                />
              </div>
              <input
                id="rc-stop-loss"
                className="rc-input"
                type="number"
                min={0}
                step="any"
                placeholder={stopPlaceholder}
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
              />
            </div>

            <div className="rc-section">
              <div className="rc-label-row">
                <div className="rc-label-group">
                  <label className="rc-label success" htmlFor="rc-take-profit">
                    Take Profit
                  </label>
                  <span className="rc-optional">(optional)</span>
                </div>
                <ModeToggle
                  label="Take profit input mode"
                  value={tpMode}
                  options={[
                    { id: 'price', label: 'Price' },
                    { id: 'pips', label: 'Pips' },
                    { id: 'rr', label: 'R:R' },
                  ]}
                  onChange={(id) => {
                    setTpMode(id as TpMode);
                    setTakeProfit('');
                  }}
                />
              </div>
              <input
                id="rc-take-profit"
                className="rc-input"
                type="number"
                min={0}
                step="any"
                placeholder={tpPlaceholder}
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="rc-results">
          {!result ? (
            <div className="rc-empty">
              <h3>Enter Your Trade Details</h3>
              <p>
                Fill in the instrument, account balance, risk percentage, and price levels to calculate your position
                size.
              </p>
              <div className="rc-steps">
                <span>1. Select instrument</span>
                <span>2. Set balance &amp; risk</span>
                <span>3. Enter prices</span>
              </div>
            </div>
          ) : (
            <div className="rc-result-panel">
              <h3>Position size</h3>
              <p className="rc-lots">
                {formatLots(result.lots)} <span>lots</span>
              </p>
              <dl className="rc-stats">
                <div>
                  <dt>Risk amount</dt>
                  <dd className="danger">{formatMoney(result.riskAmount)}</dd>
                </div>
                <div>
                  <dt>Stop distance</dt>
                  <dd>{formatPips(result.stopPips)} pips</dd>
                </div>
                <div>
                  <dt>Stop price</dt>
                  <dd>{result.stopPrice.toFixed(instrument.pipSize < 0.01 ? 5 : 2)}</dd>
                </div>
                <div>
                  <dt>Required margin</dt>
                  <dd>{formatMoney(result.margin)}</dd>
                </div>
                <div>
                  <dt>Units</dt>
                  <dd>{Math.round(result.units).toLocaleString()}</dd>
                </div>
                {result.tpPrice != null && (
                  <div>
                    <dt>Take profit</dt>
                    <dd className="success">{result.tpPrice.toFixed(instrument.pipSize < 0.01 ? 5 : 2)}</dd>
                  </div>
                )}
                {result.tpPips != null && (
                  <div>
                    <dt>TP distance</dt>
                    <dd>{formatPips(result.tpPips)} pips</dd>
                  </div>
                )}
                {result.rewardAmount != null && (
                  <div>
                    <dt>Potential reward</dt>
                    <dd className="success">{formatMoney(result.rewardAmount)}</dd>
                  </div>
                )}
                {result.riskReward != null && (
                  <div>
                    <dt>Risk : Reward</dt>
                    <dd>1 : {result.riskReward.toFixed(2)}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
