import { AppState, Frequency } from '../types';
import { calculateAmortization, getMonthlyAmount } from '../hooks/useMortgageCalculations';

// ---------------------------------------------------------------------------
// DNQ (Do Not Qualify) assessment.
//
// "Better off with Crown Money" = Crown pays the debt off sooner AND costs
// less total interest than staying with the bank (home loan + other debts on
// their current terms). Checked twice:
//   * Today: current income and expenses only (no planned changes or one-off
//     events).
//   * With planned changes: the full projection used on the OODC tab
//     (planned budget changes + one-off lump sums).
// ---------------------------------------------------------------------------

/** Minimums Crown must beat the bank by. Raise these to make DNQ stricter. */
export const DNQ_THRESHOLDS = {
  minYearsSaved: 0,
  minInterestSaved: 0,
};

export type DnqVerdict = 'qualifies' | 'qualifies_future' | 'dnq';

export const VERDICT_LABELS: Record<DnqVerdict, string> = {
  qualifies: 'Crown Money can help',
  qualifies_future: 'Crown Money can help once planned changes happen',
  dnq: 'DNQ: better off with the bank for now',
};

export const VERDICT_SHORT: Record<DnqVerdict, string> = {
  qualifies: 'Qualifies',
  qualifies_future: 'Qualifies (future)',
  dnq: 'DNQ',
};

export interface ScenarioResult {
  term: number;           // years, Infinity if never paid off
  interest: number;       // total interest, Infinity if never paid off
  yearsSaved: number;     // vs bank (negative = worse)
  interestSaved: number;  // vs bank (negative = worse)
  better: boolean;
}

export interface PlannedChangeSummary {
  description: string;
  startDate: string;
  monthlyEffect: number; // + improves surplus, - reduces it
  kind: 'change' | 'lump';
}

export interface DnqAssessment {
  verdict: DnqVerdict;
  reasons: string[];
  numbers: {
    monthlyIncome: number;
    monthlyLivingExpenses: number;
    monthlyHomeLoanRepayment: number;
    monthlyOtherDebtRepayments: number;
    monthlySurplus: number;
    homeLoanAmount: number;
    offsetBalance: number;
    otherDebtsTotal: number;
    bankRate: number;
    crownRate: number;
    bankTerm: number;
    bankInterest: number;          // home loan + other debts
    bankHomeInterest: number;
    otherDebtsInterest: number;
    youngestAge: number | null;
  };
  today: ScenarioResult;
  withChanges: ScenarioResult;
  hasPlannedChanges: boolean;
  plannedChanges: PlannedChangeSummary[];
}

const scenario = (term: number, interest: number, bankTerm: number, bankInterest: number): ScenarioResult => {
  const finite = isFinite(term) && isFinite(interest);
  const yearsSaved = finite ? (isFinite(bankTerm) ? bankTerm - term : Infinity) : -Infinity;
  const interestSaved = finite ? (isFinite(bankInterest) ? bankInterest - interest : Infinity) : -Infinity;
  return {
    term, interest, yearsSaved, interestSaved,
    better: finite && yearsSaved > DNQ_THRESHOLDS.minYearsSaved && interestSaved > DNQ_THRESHOLDS.minInterestSaved,
  };
};

const auDate = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso || '') ? iso.slice(0, 10).split('-').reverse().join('/') : iso || '');

const money = (v: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(v);

export const assessDnq = (appState: AppState, calculations: any): DnqAssessment => {
  const { loan, otherDebts = [], futureChanges = [], futureLumpSums = [], crownMoneyInterestRate, people = [] } = appState;
  const bankCalc = calculations?.bankLoanCalculation ?? { termInYears: Infinity, totalInterest: Infinity };
  const crownMain = calculations?.crownMoneyLoanCalculation ?? { termInYears: Infinity, totalInterest: Infinity };
  const otherDebtsInterest: number = calculations?.otherDebtsStatusQuoInterest ?? 0;
  const crownSurplus: number = calculations?.crownSurplus ?? 0;

  const monthlyHomeLoanRepayment = getMonthlyAmount(loan.repayment, loan.frequency as Frequency);
  const monthlyOtherDebtRepayments = otherDebts.reduce((s, d) => s + getMonthlyAmount(d.repayment, d.frequency), 0);
  const otherDebtsTotal = otherDebts.reduce((s, d) => s + d.amount, 0);
  const bankTerm: number = bankCalc.termInYears;
  const bankInterest = bankCalc.totalInterest + otherDebtsInterest;

  const crownLoan = {
    amount: loan.amount + otherDebtsTotal,
    interestRate: crownMoneyInterestRate,
    repayment: crownSurplus + monthlyHomeLoanRepayment,
    frequency: 'monthly' as Frequency,
    offsetBalance: loan.offsetBalance || 0,
  };

  // Today only: no planned changes, no one-off events.
  const todayCalc = crownLoan.repayment > 0
    ? calculateAmortization(crownLoan, { strategy: 'crown' })
    : { termInYears: Infinity, totalInterest: Infinity };

  // With planned changes: the OODC projection. If today's surplus can't
  // service the loan the main projection gives up early, so re-run it here
  // to see whether the planned changes rescue it.
  const hasPlannedChanges = futureChanges.length > 0 || futureLumpSums.length > 0;
  const withChangesCalc = isFinite(crownMain.termInYears) || !hasPlannedChanges
    ? crownMain
    : calculateAmortization(crownLoan, { strategy: 'crown', futureChanges, futureLumpSums });

  const today = scenario(todayCalc.termInYears, todayCalc.totalInterest, bankTerm, bankInterest);
  const withChanges = hasPlannedChanges
    ? scenario(withChangesCalc.termInYears, withChangesCalc.totalInterest, bankTerm, bankInterest)
    : today;

  const verdict: DnqVerdict = withChanges.better ? (today.better ? 'qualifies' : 'qualifies_future') : 'dnq';

  const plannedChanges: PlannedChangeSummary[] = [
    ...futureChanges.map(c => ({
      description: c.description || c.name || (c.type === 'income' ? 'Income change' : 'Expense change'),
      startDate: c.startDate,
      monthlyEffect: getMonthlyAmount(c.changeAmount, c.frequency) * (c.type === 'income' ? 1 : -1),
      kind: 'change' as const,
    })),
    ...futureLumpSums.map(l => ({
      description: l.description || l.name || (l.type === 'income' ? 'One-off income' : 'One-off expense'),
      startDate: l.date,
      monthlyEffect: Math.abs(l.amount) * (l.type === 'income' ? 1 : -1),
      kind: 'lump' as const,
    })),
  ].sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));

  // Plain-English reasons (client-safe wording).
  const reasons: string[] = [];
  if (crownSurplus <= 0) {
    reasons.push(`There's no spare money each month right now: after living costs and the current repayment, the budget is ${money(crownSurplus)} a month.`);
  }
  if (crownMoneyInterestRate > (loan.interestRate || 0)) {
    reasons.push(`The Crown Money rate (${crownMoneyInterestRate}%) is higher than the current bank rate (${loan.interestRate}%).`);
  }
  if (!today.better && isFinite(today.term)) {
    if (today.yearsSaved <= DNQ_THRESHOLDS.minYearsSaved) reasons.push(`With today's numbers, Crown Money would not pay the debt off sooner than the bank.`);
    if (today.interestSaved <= DNQ_THRESHOLDS.minInterestSaved) reasons.push(`With today's numbers, Crown Money would not save interest compared with the bank.`);
  }
  if (!isFinite(today.term)) reasons.push(`With today's numbers, the combined loan could not be paid off.`);
  if (verdict === 'qualifies_future') {
    const helpful = plannedChanges.filter(c => c.monthlyEffect > 0).map(c => `${c.description} (from ${auDate(c.startDate)})`);
    reasons.push(`Planned changes improve the budget enough for Crown Money to come out ahead${helpful.length ? `: ${helpful.join(', ')}` : ''}.`);
  }
  if (verdict === 'dnq' && today.better && hasPlannedChanges) {
    reasons.push(`Today's numbers work, but the planned changes reduce the budget enough that the bank comes out ahead.`);
  }
  if (verdict !== 'dnq') {
    reasons.unshift(`Debt-free ${fmtYears(withChanges.yearsSaved)} sooner and ${money(withChanges.interestSaved)} less interest than staying with the bank.`);
  }

  const youngestAge = people.length ? Math.min(...people.map(p => p.age).filter(a => isFinite(a))) : null;

  return {
    verdict,
    reasons,
    numbers: {
      monthlyIncome: calculations?.totalMonthlyIncome ?? 0,
      monthlyLivingExpenses: calculations?.totalMonthlyLivingExpenses ?? 0,
      monthlyHomeLoanRepayment,
      monthlyOtherDebtRepayments,
      monthlySurplus: crownSurplus,
      homeLoanAmount: loan.amount,
      offsetBalance: loan.offsetBalance || 0,
      otherDebtsTotal,
      bankRate: loan.interestRate,
      crownRate: crownMoneyInterestRate,
      bankTerm,
      bankInterest,
      bankHomeInterest: bankCalc.totalInterest,
      otherDebtsInterest,
      youngestAge: youngestAge !== null && isFinite(youngestAge) ? youngestAge : null,
    },
    today,
    withChanges,
    hasPlannedChanges,
    plannedChanges,
  };
};

export const fmtYears = (y: number) => {
  if (!isFinite(y)) return 'never';
  const whole = Math.floor(Math.abs(y));
  const months = Math.round((Math.abs(y) - whole) * 12);
  const parts = [whole ? `${whole} yr${whole === 1 ? '' : 's'}` : '', months ? `${months} mth${months === 1 ? '' : 's'}` : ''].filter(Boolean);
  return (y < 0 ? '-' : '') + (parts.join(' ') || '0 mths');
};
