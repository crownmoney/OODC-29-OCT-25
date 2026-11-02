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

const ComparisonBar: React.FC<{ label: string; typical: number; actual: number; actualLabel: string; unit?: string }> = ({ label, typical, actual, actualLabel, unit = '' }) => {
  const max = Math.max(typical, actual, 1) * 1.1;
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  const diff = actual - typical;
  const lowBy = typical - actual;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <p className="text-xs text-[#583d77] print:text-gray-600">Typical {label.toLowerCase()}</p>
          <p className="text-3xl font-black tracking-tight text-[var(--title-color)]">{formatCurrency(typical)}{unit && <span className="text-base font-semibold text-[#583d77] print:text-gray-600">{unit}</span>}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#583d77] print:text-gray-600">{actualLabel}</p>
          <p className="text-lg font-bold">{formatCurrency(actual)}{unit && <span className="text-sm font-medium text-[#583d77] print:text-gray-600">{unit}</span>}</p>
        </div>
      </div>
      <div className="mt-3 space-y-1.5 print:hidden" aria-hidden="true">
        <div className="flex items-center gap-2">
          <span className="w-14 text-[10px] font-bold uppercase tracking-wider text-[#583d77]">Typical</span>
          <div className="h-2.5 flex-1 rounded-full bg-[#ece6f3] overflow-hidden">
            <div className="h-full rounded-full bg-[var(--title-color)] transition-all duration-700" style={{ width: pct(typical) }} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-14 text-[10px] font-bold uppercase tracking-wider text-[#583d77]">You</span>
          <div className="h-2.5 flex-1 rounded-full bg-[#ece6f3] overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${lowBy > typical * 0.1 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: pct(actual) }} />
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs text-[#583d77] print:text-gray-700">
        {Math.abs(diff) < 1 ? 'Right on the typical figure.'
          : diff < 0 ? `${formatCurrency(-diff)}${unit} less than typical${lowBy > typical * 0.1 ? ', so it\'s worth double-checking nothing\'s been missed.' : '.'}`
          : `${formatCurrency(diff)}${unit} more than typical.`}
      </p>
    </div>
  );
};

const HouseholdBenchmarks: React.FC<Props> = ({ appState, setAppState }) => {
  const numberOfKids = appState.numberOfKids ?? 0;
  const r = getBenchmarkResult(appState, getMonthlyAmount);
  const { household, hasKids, band, annualIncome, row: match, clientMonthlyLiving: monthlyLiving, clientMonthlyFFF: monthlyFFF } = r;
  const autoBand = bandForIncome(annualIncome);


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
            <option value="other">Other (e.g. separated)</option>
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

      <div className="mt-4 rounded-2xl bg-[#f8f6fb] border border-[#e6deee] p-5 text-[#250B40] print:bg-transparent print:text-black print:border-gray-300">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--title-color)] print:text-gray-600">
          Households like yours · {HOUSEHOLD_LABELS[household]} {hasKids ? 'with kids' : 'with no kids'} · {band.label}
        </p>
        {match.monthlyExpenses === null ? (
          <p className="mt-3 text-sm text-[#583d77] print:text-black">
            We don't have a typical figure for this household type yet. Use your own numbers for this one.
          </p>
        ) : (
          <div className="mt-4 space-y-5">
            <ComparisonBar
              label="Monthly living expenses"
              typical={match.monthlyExpenses}
              actual={monthlyLiving}
              actualLabel="You've entered"
            />
            {match.averageFFF !== null && (
              <div className="border-t border-[#e6deee] pt-4 print:border-gray-200">
                <ComparisonBar
                  label="Food, fun & fuel"
                  typical={match.averageFFF}
                  actual={monthlyFFF * 12 / 52}
                  actualLabel="You've entered"
                  unit="/week"
                />
              </div>
            )}
          </div>
        )}
        <p className="mt-4 text-xs text-[#583d77] print:text-gray-500">Average mortgage in this bracket: {formatCurrency(band.averageMortgage)}</p>
      </div>

      <details className="mt-4 group print:hidden">
        <summary className="cursor-pointer select-none text-sm font-semibold text-[var(--title-color)] hover:opacity-80 list-none flex items-center gap-1">
          <span className="transition-transform group-open:rotate-90">›</span> See all household averages for this bracket
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-[var(--text-color-muted)]">
                <th className="py-1 pr-2 font-semibold">Household type</th>
                <th className="py-1 pr-2 font-semibold text-right">Monthly expenses</th>
                <th className="py-1 font-semibold text-right">Food, fun &amp; fuel / week</th>
              </tr>
            </thead>
            <tbody>
              {band.rows.map(r => {
                const isMatch = r === match;
                return (
                  <tr key={`${r.household}-${r.withKids}`} className={isMatch ? 'bg-[var(--title-color)]/10 font-bold' : 'border-t border-[var(--border-color)]'}>
                    <td className="py-1.5 px-2">{HOUSEHOLD_LABELS[r.household]} {r.withKids ? 'with kids' : 'with no kids'}</td>
                    <td className="py-1.5 pr-2 text-right">{r.monthlyExpenses === null ? '–' : formatCurrency(r.monthlyExpenses)}</td>
                    <td className="py-1.5 pr-2 text-right">{r.averageFFF === null ? '–' : formatCurrency(r.averageFFF)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-[var(--text-color-muted)]">
            Averages exclude interest and investment loan payments. All figures in AUD. "Other" includes separated households.
          </p>
        </div>
      </details>
    </Card>
  );
};

export default HouseholdBenchmarks;

// Small, non-blocking reminders shown inline in the Expenses card so reps
// don't under-quote. They never change what's entered.
export const BenchmarkHint: React.FC<{ appState: AppState; kind: 'total' | 'fff' }> = ({ appState, kind }) => {
  const r = getBenchmarkResult(appState, getMonthlyAmount);
  const label = `${HOUSEHOLD_LABELS[r.household].toLowerCase()} ${r.hasKids ? 'with kids' : 'with no kids'}, ${r.band.label}`;
  if (kind === 'fff') {
    if (r.row.averageFFF === null) return null;
    return (
      <div className="mb-2 rounded-lg bg-[var(--title-color)]/5 border border-[var(--title-color)]/15 px-3 py-2 text-xs text-[var(--text-color)] print:hidden">
        💡 Households like yours ({label}) typically spend about <strong>{formatCurrency(r.row.averageFFF)} a week</strong> on food, fun &amp; fuel.
        {' '}You've entered <strong>{formatCurrency(r.clientMonthlyFFF * 12 / 52)} a week</strong>.
        {r.clientMonthlyFFF * 12 / 52 < r.row.averageFFF * 0.9 && <> That's lower than usual, so it's worth double-checking each item.</>}
      </div>
    );
  }
  if (r.row.monthlyExpenses === null) return null;
  const under = r.row.monthlyExpenses - r.clientMonthlyLiving;
  const isLow = under > r.row.monthlyExpenses * 0.1;
  return (
    <div className={`mb-3 rounded-lg px-3 py-2 text-xs print:hidden ${isLow ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-[var(--title-color)]/5 border border-[var(--title-color)]/15 text-[var(--text-color)]'}`}>
      💡 Households like yours ({label}) typically spend about <strong>{formatCurrency(r.row.monthlyExpenses)}</strong> a month. You've entered <strong>{formatCurrency(r.clientMonthlyLiving)}</strong> so far.
      {isLow && <> That's {formatCurrency(under)} less than usual, so let's double-check nothing's been missed.</>}
    </div>
  );
};
