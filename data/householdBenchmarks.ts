// Household expenses by income.
// Average monthly expenses exclude interest and other investment loan payments.
// FFF = Food, Fuel & Fun, per WEEK. All figures are in Australian dollars.
// Source: figures supplied by Adam Santangelo.
// Income brackets are household income BEFORE tax.

import { grossFromNet } from '../services/tax';

export type HouseholdType = 'couple' | 'single' | 'other';
export type IncomeBandId = 'under-120k' | '120k-150k' | '150k-180k' | '180k-plus';

export interface BenchmarkRow {
  household: HouseholdType;
  withKids: boolean;
  monthlyExpenses: number | null;
  /** Weekly food, fun & fuel. */
  averageFFF: number | null;
  note?: 1 | 2 | 3;
}

export interface IncomeBand {
  id: IncomeBandId;
  label: string;
  minIncome: number;
  maxIncome: number;
  averageMortgage: number;
  rows: BenchmarkRow[];
}

export const BENCHMARK_NOTES: Record<1 | 2 | 3, string> = {
  1: 'Figures not provided.',
  2: 'One data point only; not a reliable average.',
  3: 'No clients currently in this category.',
};

export const HOUSEHOLD_LABELS: Record<HouseholdType, string> = {
  couple: 'Couple',
  single: 'Single',
  other: 'Other',
};

export const INCOME_BANDS: IncomeBand[] = [
  {
    id: 'under-120k', label: 'Under $120,000', minIncome: 0, maxIncome: 120_000, averageMortgage: 317_000,
    rows: [
      { household: 'couple', withKids: true, monthlyExpenses: 8486, averageFFF: 571 },
      { household: 'couple', withKids: false, monthlyExpenses: 6388, averageFFF: 515 },
      { household: 'single', withKids: true, monthlyExpenses: 6349, averageFFF: 428 },
      { household: 'single', withKids: false, monthlyExpenses: 5386, averageFFF: 339 },
      { household: 'other', withKids: true, monthlyExpenses: 6944, averageFFF: 500 },
      { household: 'other', withKids: false, monthlyExpenses: 6815, averageFFF: 515 },
    ],
  },
  {
    id: '120k-150k', label: '$120,000 – $150,000', minIncome: 120_000, maxIncome: 150_000, averageMortgage: 387_000,
    rows: [
      { household: 'couple', withKids: true, monthlyExpenses: 10001, averageFFF: 665 },
      { household: 'couple', withKids: false, monthlyExpenses: 8027, averageFFF: 600 },
      { household: 'single', withKids: true, monthlyExpenses: 6962, averageFFF: 545 },
      { household: 'single', withKids: false, monthlyExpenses: 6370, averageFFF: 385 },
      { household: 'other', withKids: true, monthlyExpenses: 7572, averageFFF: 600 },
      { household: 'other', withKids: false, monthlyExpenses: 7336, averageFFF: 525 },
    ],
  },
  {
    id: '150k-180k', label: '$150,000 – $180,000', minIncome: 150_000, maxIncome: 180_000, averageMortgage: 418_045,
    rows: [
      { household: 'couple', withKids: true, monthlyExpenses: 10645, averageFFF: 672 },
      { household: 'couple', withKids: false, monthlyExpenses: 9278, averageFFF: 645 },
      { household: 'single', withKids: true, monthlyExpenses: null, averageFFF: null, note: 1 },
      { household: 'single', withKids: false, monthlyExpenses: 7083, averageFFF: 462 },
      { household: 'other', withKids: true, monthlyExpenses: 14006, averageFFF: 850, note: 2 },
      { household: 'other', withKids: false, monthlyExpenses: null, averageFFF: null, note: 3 },
    ],
  },
  {
    id: '180k-plus', label: '$180,000+', minIncome: 180_000, maxIncome: Infinity, averageMortgage: 579_000,
    rows: [
      { household: 'couple', withKids: true, monthlyExpenses: 12680, averageFFF: 715 },
      { household: 'couple', withKids: false, monthlyExpenses: 12450, averageFFF: 705 },
      { household: 'single', withKids: true, monthlyExpenses: 12542, averageFFF: 650 },
      { household: 'single', withKids: false, monthlyExpenses: 12540, averageFFF: 540 },
      { household: 'other', withKids: true, monthlyExpenses: 15912, averageFFF: 740 },
      { household: 'other', withKids: false, monthlyExpenses: 10769, averageFFF: 600 },
    ],
  },
];

export const bandForIncome = (annualIncome: number): IncomeBand =>
  INCOME_BANDS.find(b => annualIncome >= b.minIncome && annualIncome < b.maxIncome) ?? INCOME_BANDS[0];

// Shared by the Household Benchmarks card and the Zapier upload.
export interface BenchmarkResult {
  household: HouseholdType;
  hasKids: boolean;
  band: IncomeBand;
  bandIsAuto: boolean;
  /** Household income after tax, as entered. */
  annualNetIncome: number;
  /** Estimated household income before tax (each income grossed up separately). */
  annualIncome: number;
  row: BenchmarkRow;
  clientMonthlyLiving: number;
  clientMonthlyFFF: number;
}

export const getBenchmarkResult = (
  state: {
    incomes?: { amount: number; frequency: any }[];
    expenses?: { amount: number; frequency: any; category: string }[];
    people?: unknown[];
    numberOfKids?: number;
    householdType?: HouseholdType;
    benchmarkIncomeBand?: IncomeBandId;
  },
  toMonthly: (amount: number, frequency: any) => number,
): BenchmarkResult => {
  const household: HouseholdType = state.householdType ?? ((state.people?.length ?? 0) >= 2 ? 'couple' : 'single');
  const hasKids = (state.numberOfKids ?? 0) > 0;
  // Incomes are entered after tax; brackets are before tax. Each person is
  // taxed separately, so gross up each income line on its own.
  const netLines = (state.incomes ?? []).map(i => toMonthly(i.amount, i.frequency) * 12).filter(v => v > 0);
  const annualNetIncome = netLines.reduce((s, v) => s + v, 0);
  const annualIncome = netLines.reduce((s, v) => s + grossFromNet(v), 0);
  const chosen = INCOME_BANDS.find(b => b.id === state.benchmarkIncomeBand);
  const band = chosen ?? bandForIncome(annualIncome);
  const row = band.rows.find(r => r.household === household && r.withKids === hasKids)!;
  const expenses = state.expenses ?? [];
  return {
    household,
    hasKids,
    band,
    bandIsAuto: !chosen,
    annualNetIncome,
    annualIncome,
    row,
    clientMonthlyLiving: expenses.reduce((s, e) => s + toMonthly(e.amount, e.frequency), 0),
    clientMonthlyFFF: expenses.filter(e => e.category === 'FFF').reduce((s, e) => s + toMonthly(e.amount, e.frequency), 0),
  };
};
