import React from 'react';
import Card from './common/Card';
import { AppState } from '../types';
import { getMonthlyAmount } from '../hooks/useMortgageCalculations';
import {
  BENCHMARK_NOTES,
  HOUSEHOLD_LABELS,
  HouseholdType,
  INCOME_BANDS,
  IncomeBandId,
  bandForIncome,
  getBenchmarkResult,
} from '../data/householdBenchmarks';

interface Props {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
}

const inputClasses = "w-full bg-[var(--input-bg-color)] p-2 rounded border border-[var(--input-border-color)] focus:outline-none focus:ring-2 focus:ring-[var(--input-border-focus-color)]";
const selectClasses = `custom-select ${inputClasses}`;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

const HouseholdBenchmarks: React.FC<Props> = ({ appState, setAppState }) => {
  const numberOfKids = appState.numberOfKids ?? 0;
  const r = getBenchmarkResult(appState, getMonthlyAmount);
  const { household, hasKids, band, annualIncome, row: match, clientMonthlyLiving: monthlyLiving, clientMonthlyFFF: monthlyFFF } = r;
  const autoBand = bandForIncome(annualIncome);

  const diff = match.monthlyExpenses !== null ? monthlyLiving - match.monthlyExpenses : null;

  return (
    <Card title="Household Benchmarks">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print:hidden">
        <div>
          <label htmlFor="hb-kids" className="block text-xs font-medium text-[var(--text-color-muted)] mb-1">How many kids?</label>
          <input
            id="hb-kids"
            type="number"
            min="0"
            value={numberOfKids}
            onChange={e => setAppState(s => ({ ...s, numberOfKids: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
            className={inputClasses}
          />
        </div>
        <div>
          <label htmlFor="hb-household" className="block text-xs font-medium text-[var(--text-color-muted)] mb-1">Household</label>
          <select
            id="hb-household"
            value={household}
            onChange={e => setAppState(s => ({ ...s, householdType: e.target.value as HouseholdType }))}
            className={selectClasses}
          >
            <option value="couple">Couple</option>
            <option value="single">Single</option>
            <option value="other">Other (e.g. divorced)</option>
          </select>
        </div>
        <div>
          <label htmlFor="hb-band" className="block text-xs font-medium text-[var(--text-color-muted)] mb-1">Income bracket</label>
          <select
            id="hb-band"
            value={appState.benchmarkIncomeBand ?? 'auto'}
            onChange={e => setAppState(s => ({ ...s, benchmarkIncomeBand: e.target.value === 'auto' ? undefined : e.target.value as IncomeBandId }))}
            className={selectClasses}
          >
            <option value="auto">Auto: {autoBand.label}</option>
            {INCOME_BANDS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </div>
      </div>
      <p className="text-xs text-[var(--text-color-muted)] mt-2 print:hidden">
        Auto bracket uses the income entered above: {formatCurrency(annualIncome)} a year.
      </p>

      <div className="mt-4 rounded-xl border border-[var(--border-color)] p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-color-muted)]">
          {HOUSEHOLD_LABELS[household]} {hasKids ? 'with kids' : 'with no kids'} · {band.label}
        </p>
        {match.monthlyExpenses === null ? (
          <p className="mt-2 text-sm text-[var(--text-color)]">
            No benchmark for this household: {BENCHMARK_NOTES[match.note!]}
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-[var(--text-color-muted)]">Average monthly expenses</p>
              <p className="text-2xl font-black text-[var(--title-color)]">{formatCurrency(match.monthlyExpenses)}</p>
              <p className="text-xs text-[var(--text-color-muted)] mt-1">
                Client: {formatCurrency(monthlyLiving)}/month
                {diff !== null && Math.abs(diff) >= 1 && (
                  <span className={diff > 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
                    {' '}({formatCurrency(Math.abs(diff))} {diff > 0 ? 'above' : 'below'} average)
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-color-muted)]">Average FFF</p>
              <p className="text-2xl font-black text-[var(--title-color)]">{formatCurrency(match.averageFFF!)}</p>
              <p className="text-xs text-[var(--text-color-muted)] mt-1">
                Client FFF: {formatCurrency(monthlyFFF)}/month ({formatCurrency(monthlyFFF * 12 / 52)}/week)
              </p>
            </div>
          </div>
        )}
        {match.note === 2 && (
          <p className="mt-2 text-xs text-amber-600 font-semibold">Note: {BENCHMARK_NOTES[2]}</p>
        )}
        <p className="mt-3 text-xs text-[var(--text-color-muted)]">Average mortgage in this bracket: {formatCurrency(band.averageMortgage)}</p>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-[var(--text-color-muted)]">
              <th className="py-1 pr-2 font-semibold">Household type</th>
              <th className="py-1 pr-2 font-semibold text-right">Monthly expenses</th>
              <th className="py-1 font-semibold text-right">Average FFF</th>
            </tr>
          </thead>
          <tbody>
            {band.rows.map(r => {
              const isMatch = r === match;
              return (
                <tr key={`${r.household}-${r.withKids}`} className={isMatch ? 'bg-[var(--title-color)]/10 font-bold' : 'border-t border-[var(--border-color)]'}>
                  <td className="py-1.5 pr-2">
                    {HOUSEHOLD_LABELS[r.household]} {r.withKids ? 'with kids' : 'with no kids'}
                    {r.note && <sup className="ml-0.5 text-[var(--text-color-muted)]">[{r.note}]</sup>}
                  </td>
                  <td className="py-1.5 pr-2 text-right">{r.monthlyExpenses === null ? '–' : formatCurrency(r.monthlyExpenses)}</td>
                  <td className="py-1.5 text-right">{r.averageFFF === null ? '–' : formatCurrency(r.averageFFF)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 space-y-0.5 text-[11px] text-[var(--text-color-muted)]">
        <p>Average monthly expenses exclude interest and other investment loan payments. FFF = Food, Fuel &amp; Fun. All figures in AUD.</p>
        {([1, 2, 3] as const).map(n => <p key={n}>[{n}] {BENCHMARK_NOTES[n]}</p>)}
        <p>"Other" generally refers to divorced clients. FFF frequency was not specified in the supplied figures.</p>
        <p>Source: figures supplied by Adam Santangelo.</p>
      </div>
    </Card>
  );
};

export default HouseholdBenchmarks;
