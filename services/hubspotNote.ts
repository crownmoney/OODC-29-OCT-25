import { AppState, Frequency } from '../types';
import { getMonthlyAmount } from '../hooks/useMortgageCalculations';
import { HOUSEHOLD_LABELS, getBenchmarkResult } from '../data/householdBenchmarks';
import { DEFAULT_CAR_SETUP, DEFAULT_INSURANCES } from './managedExpenses';
import { QUESTIONS as HEALTH_CHECK_QUESTIONS } from '../components/Tab_HealthCheck';
import { DnqAssessment, ScenarioResult } from './dnq';

// Content of the Crown Money branded note posted on the HubSpot deal on
// Upload Record. The browser builds the content (sections > sub-sections >
// rows); the server (netlify/functions/hubspot-note.mts) lays it out with
// inline styles and escapes every value.

export type Tone = 'good' | 'bad' | 'warn' | 'muted';
export interface ReportRow { label: string; value: string; tone?: Tone }
export interface ReportSub { title?: string; rows?: ReportRow[]; bullets?: string[]; text?: string }
export interface ReportSection { title: string; subs: ReportSub[] }
export interface UploadReport {
  client: string;
  headline: { label: string; value: string; tone?: Tone }[];
  verdict: { label: string; tone: Tone; detail: string };
  sections: ReportSection[];
}

const money = (n: number | null | undefined, dp = 0) =>
  n === null || n === undefined || !isFinite(n) ? '—'
    : new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: dp, maximumFractionDigits: dp }).format(n);
const per: Record<Frequency, string> = { weekly: 'a week', fortnightly: 'a fortnight', monthly: 'a month', quarterly: 'a quarter', annually: 'a year' };
const amt = (a: number, f: Frequency) => `${money(a, a % 1 ? 2 : 0)} ${per[f] ?? f}`;
const monthly = (a: number, f: Frequency) => getMonthlyAmount(a, f);
const years = (n: number) => {
  if (!isFinite(n)) return 'Never paid off';
  const w = Math.floor(Math.abs(n)), m = Math.round((Math.abs(n) - w) * 12);
  return `${n < 0 ? '-' : ''}${w} yrs ${m} mths`;
};
const auDate = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10).split('-').reverse().join('/') : s || '—');

const VERDICT: Record<string, { label: string; tone: Tone }> = {
  qualifies: { label: 'QUALIFIES – Crown Money can help', tone: 'good' },
  qualifies_future: { label: 'QUALIFIES (FUTURE) – once planned changes happen', tone: 'warn' },
  dnq: { label: 'DNQ – better off with the bank for now', tone: 'bad' },
};

const scenarioRows = (s: ScenarioResult, a: DnqAssessment): ReportRow[] => {
  const n = a.numbers;
  if (!isFinite(s.term)) return [
    { label: 'Bank: debt-free in', value: years(n.bankTerm) },
    { label: 'Bank: total interest', value: money(n.bankInterest) },
    { label: 'Crown Money', value: "Can't be paid off with these numbers", tone: 'bad' },
  ];
  return [
    { label: 'Debt-free (bank → Crown)', value: `${years(n.bankTerm)} → ${years(s.term)}` },
    { label: s.yearsSaved >= 0 ? 'Time saved' : 'Extra time', value: years(Math.abs(s.yearsSaved)), tone: s.yearsSaved >= 0 ? 'good' : 'bad' },
    { label: 'Total interest (bank → Crown)', value: `${money(n.bankInterest)} → ${money(s.interest)}` },
    { label: s.interestSaved >= 0 ? 'Interest saved' : 'Extra interest', value: money(Math.abs(s.interestSaved)), tone: s.interestSaved >= 0 ? 'good' : 'bad' },
    { label: 'Result', value: s.better ? 'Crown Money better' : 'Bank better', tone: s.better ? 'good' : 'bad' },
  ];
};

export const buildUploadReport = (s: AppState, calc: any, a: DnqAssessment): UploadReport => {
  const people = s.people || [];
  const client = people.map(p => p.name).filter(Boolean).join(' & ') || s.clientEmail || 'Client';
  const o = s.dnqOverride;
  const finalVerdict = o?.verdict ?? a.verdict;
  const best = a.hasPlannedChanges && a.withChanges.better && !a.today.better ? a.withChanges : a.today;
  const sections: ReportSection[] = [];

  // --- DNQ -------------------------------------------------------------
  const dnqSubs: ReportSub[] = [{
    title: 'Verdict',
    rows: [
      { label: 'Calculated verdict', value: VERDICT[a.verdict]?.label ?? a.verdict, tone: VERDICT[a.verdict]?.tone },
      { label: "Consultant's verdict", value: o ? `${VERDICT[o.verdict]?.label ?? o.verdict} (changed${o.by ? ` by ${o.by}` : ''} ${new Date(o.at).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', dateStyle: 'medium', timeStyle: 'short' })})` : 'Not changed', tone: o ? 'warn' : 'muted' },
      ...(o ? [{ label: 'Reason for change', value: o.reason }] : []),
    ],
  }];
  if (a.reasons?.length) dnqSubs.push({ title: 'Why', bullets: a.reasons });
  dnqSubs.push({ title: 'Today (current income & expenses)', rows: scenarioRows(a.today, a) });
  if (a.hasPlannedChanges) {
    dnqSubs.push({ title: 'With planned changes', rows: scenarioRows(a.withChanges, a) });
    dnqSubs.push({ title: 'Planned changes', bullets: a.plannedChanges.map(c => `${c.description}: ${c.monthlyEffect >= 0 ? '+' : '−'}${money(Math.abs(c.monthlyEffect))}${c.kind === 'change' ? '/mth' : ' one-off'} from ${auDate(c.startDate)}`) });
  }
  sections.push({ title: 'DNQ check', subs: dnqSubs });

  // --- Client & household ---------------------------------------------------
  const b = getBenchmarkResult(s, getMonthlyAmount);
  sections.push({ title: 'Client & household', subs: [
    { title: 'Borrowers', rows: people.map((p, i) => ({ label: i === 0 ? 'Primary borrower' : i === 1 ? 'Partner' : `Borrower ${i + 1}`, value: `${p.name || '—'}, age ${p.age ?? '—'}` })) },
    { title: 'Contact & household', rows: [
      { label: 'Email', value: s.clientEmail || '—' },
      { label: 'Phone', value: s.clientPhone || '—' },
      { label: 'Kids', value: String(s.numberOfKids ?? 0) },
      { label: 'Household type', value: `${HOUSEHOLD_LABELS[b.household]} ${b.hasKids ? 'with kids' : 'with no kids'}` },
      { label: 'All parties in attendance', value: String(s.allPartiesInAttendance ?? '—') },
    ] },
  ] });

  // --- Current loan -------------------------------------------------------------
  const l = s.loan;
  const lvr = l.propertyValue ? (l.amount / l.propertyValue) * 100 : null;
  sections.push({ title: 'Current home loan', subs: [{ rows: [
    { label: 'Current lender', value: s.currentLender || '—' },
    { label: 'Loan balance', value: money(l.amount) },
    { label: 'Property value', value: money(l.propertyValue) },
    { label: 'LVR', value: lvr === null ? '—' : `${lvr.toFixed(1)}%`, tone: lvr !== null && lvr > 80 ? 'warn' : undefined },
    { label: 'Interest rate (bank)', value: `${l.interestRate}%` },
    { label: 'Crown Money rate', value: `${s.crownMoneyInterestRate}%` },
    { label: 'Repayments', value: `${amt(l.repayment, l.frequency as Frequency)} (${money(monthly(l.repayment, l.frequency as Frequency))} a month)` },
    { label: 'Offset balance', value: money(l.offsetBalance || 0) },
    ...(l.loanTerm ? [{ label: 'Years left on loan', value: String(l.loanTerm) }] : []),
  ] }] });

  // --- Income ----------------------------------------------------------------------
  const incomes = (s.incomes || []).filter(i => i.amount);
  const monthlyIncome = incomes.reduce((t, i) => t + monthly(i.amount, i.frequency), 0);
  sections.push({ title: 'Income (after tax)', subs: [{
    rows: [
      ...incomes.map(i => ({ label: i.name || 'Income', value: `${amt(i.amount, i.frequency)} · ${money(monthly(i.amount, i.frequency) * 12)} a year` })),
      { label: 'Total household income', value: `${money(monthlyIncome)} a month · ${money(monthlyIncome * 12)} a year`, tone: 'good' as Tone },
      { label: 'Estimated before tax', value: `${money(b.annualIncome)} a year`, tone: 'muted' as Tone },
    ],
  }] });

  // --- Expenses -----------------------------------------------------------------
  const exp = (s.expenses || []).filter(e => !e.managed);
  const cat = (c: string) => exp.filter(e => e.category === c);
  const catSub = (title: string, c: string): ReportSub | null => {
    const list = cat(c).filter(e => e.amount);
    if (!list.length) return null;
    const total = list.reduce((t, e) => t + monthly(e.amount, e.frequency), 0);
    return { title: `${title} · ${money(total)} a month`, rows: list.map(e => ({ label: e.name || 'Expense', value: amt(e.amount, e.frequency) })) };
  };
  const car = s.carSetup ?? DEFAULT_CAR_SETUP;
  const carRow = (label: string, c: { amount: number | null; frequency: Frequency }) => ({ label, value: c.amount === null ? 'Not entered' : amt(c.amount, c.frequency), tone: c.amount === null ? 'warn' as Tone : undefined });
  const ins = [...(s.insurances ?? DEFAULT_INSURANCES), { name: 'Car Insurance', ...car.insurance }].filter(i => i.amount !== null);
  const blank = exp.filter(e => !e.amount).map(e => e.name).filter(Boolean);
  sections.push({ title: 'Living expenses', subs: [
    catSub('Food, fun & fuel', 'FFF'), catSub('Hard expenses', 'Hard Expenses'), catSub('Soft expenses', 'Soft Expenses'), catSub('Other', 'Other'),
    { title: 'Car', rows: [
      carRow('Maintenance', car.maintenance), carRow('Rego', car.rego),
      { label: 'Costs start', value: car.isFuture ? `From ${auDate(car.futureStartDate)}` : 'Now' },
      { label: 'Car lease', value: car.hasLease === null ? 'Not answered' : car.hasLease ? `Yes – balloon ${money(car.balloonAmount)} on ${auDate(car.balloonDate)}` : 'No' },
    ] },
    { title: 'Insurance (optional)', ...(ins.length ? { rows: ins.map(i => ({ label: i.name, value: amt(i.amount!, i.frequency) })) } : { text: 'None entered.' }) },
    ...(blank.length ? [{ title: 'Left blank', text: blank.join(', ') }] : []),
  ].filter(Boolean) as ReportSub[] });

  // --- Cashflow ----------------------------------------------------------------------
  sections.push({ title: 'Monthly cashflow', subs: [{ rows: [
    { label: 'Income', value: money(a.numbers.monthlyIncome) },
    { label: 'Living expenses', value: money(a.numbers.monthlyLivingExpenses) },
    { label: 'Home loan repayment', value: money(a.numbers.monthlyHomeLoanRepayment) },
    ...(a.numbers.monthlyOtherDebtRepayments ? [{ label: 'Other debt repayments', value: money(a.numbers.monthlyOtherDebtRepayments) }] : []),
    { label: 'Surplus (bank)', value: money(calc?.bankSurplus), tone: (calc?.bankSurplus ?? 0) >= 0 ? 'good' as Tone : 'bad' as Tone },
    { label: 'Surplus for debt reduction (Crown)', value: money(calc?.crownSurplus), tone: (calc?.crownSurplus ?? 0) >= 0 ? 'good' as Tone : 'bad' as Tone },
  ] }] });

  // --- Other debts ---------------------------------------------------------------------
  const debts = (s.otherDebts || []).filter(d => d.amount || d.name);
  if (debts.length) sections.push({ title: 'Other debts to consolidate', subs: [{
    rows: [
      ...debts.map(d => ({ label: d.name || 'Debt', value: `${money(d.amount)} at ${d.interestRate}% · ${amt(d.repayment, d.frequency)}${d.remainingTerm ? ` · ${d.remainingTerm} yrs left` : ''}` })),
      { label: 'Total other debts', value: money(debts.reduce((t, d) => t + d.amount, 0)), tone: 'warn' as Tone },
    ],
  }] });

  // --- Future changes -------------------------------------------------------------------
  const changes = (s.futureChanges || []).filter(c => c.changeAmount);
  const lumps = (s.futureLumpSums || []).filter(x => x.amount);
  if (changes.length || lumps.length) sections.push({ title: 'Future changes', subs: [
    ...(changes.length ? [{ title: 'Income & expense changes', rows: changes.map(c => ({
      label: c.description || c.name || 'Change',
      value: `${c.type === 'income' ? 'Income' : 'Expenses'} ${c.changeAmount >= 0 ? 'up' : 'down'} ${money(Math.abs(c.changeAmount))} ${per[c.frequency] ?? 'a month'} from ${auDate(c.startDate)}${c.isPermanent ? ' (ongoing)' : ` until ${auDate(c.endDate)}`}`,
      tone: ((c.type === 'income') === (c.changeAmount >= 0) ? 'good' : 'bad') as Tone,
    })) }] : []),
    ...(lumps.length ? [{ title: 'One-off amounts', rows: lumps.map(x => ({ label: x.description || x.name || 'One-off', value: `${x.type === 'income' ? 'In' : 'Out'} ${money(Math.abs(x.amount))} on ${auDate(x.date)}`, tone: (x.type === 'income' ? 'good' : 'bad') as Tone })) }] : []),
  ] });

  // --- Investment properties -----------------------------------------------------------------
  const props = s.investmentProperties || [];
  if (props.length) sections.push({ title: 'Investment properties', subs: props.map(p => ({
    title: p.name || p.address || 'Property',
    rows: [
      { label: 'Value', value: money(p.propertyValue ?? p.value ?? 0) },
      { label: 'Loan', value: `${money(p.loanAmount)} at ${p.interestRate}%` },
      { label: 'Rent', value: amt(p.rentalIncome, p.rentalIncomeFrequency) },
      ...(p.isFuture ? [{ label: 'Future purchase', value: auDate(p.purchaseDate) }] : []),
    ],
  })) });

  // --- Benchmarks -------------------------------------------------------------------------------
  const bm = b.row.monthlyExpenses;
  sections.push({ title: 'Household benchmarks', subs: [{ rows: [
    { label: 'Income bracket (before tax)', value: `${b.band.label}${b.bandIsAuto ? ' (auto)' : ' (set manually)'}` },
    { label: 'Living expenses: client vs benchmark', value: bm === null ? `${money(b.clientMonthlyLiving)} a month (no benchmark)` : `${money(b.clientMonthlyLiving)} vs ${money(bm)} a month`, tone: bm !== null && b.clientMonthlyLiving < bm * 0.8 ? 'warn' : undefined },
    ...(b.row.averageFFF !== null ? [{ label: 'FFF: client vs benchmark', value: `${money(b.clientMonthlyFFF * 12 / 52)} vs ${money(b.row.averageFFF)} a week` }] : []),
  ] }] });

  // --- Money health check -------------------------------------------------------------------------
  const answers = s.healthCheck?.answers ?? {};
  const answered = HEALTH_CHECK_QUESTIONS.filter(q => answers[q.id] !== null && answers[q.id] !== undefined);
  if (answered.length) {
    const yes = answered.filter(q => answers[q.id]).length;
    const tier = yes <= 3 ? 'At Risk' : yes <= 6 ? 'Building' : yes <= 8 ? 'On Track' : 'Thriving';
    sections.push({ title: 'Money health check', subs: [
      { rows: [{ label: 'Score', value: `${yes}/10 · ${tier}`, tone: yes <= 3 ? 'bad' : yes <= 6 ? 'warn' : 'good' }] },
      { title: 'Answers', rows: answered.map(q => ({ label: q.statement, value: answers[q.id] ? 'Yes' : 'No', tone: answers[q.id] ? 'good' as Tone : 'bad' as Tone })) },
      ...(s.healthCheck?.financialWorryNote ? [{ title: 'Biggest financial worry', text: s.healthCheck.financialWorryNote }] : []),
    ] });
  }

  if (s.incomeExpensesNotes?.trim()) sections.push({ title: 'Consultant notes', subs: [{ text: s.incomeExpensesNotes.trim() }] });

  const v = VERDICT[finalVerdict] ?? { label: finalVerdict, tone: 'muted' as Tone };
  return {
    client,
    verdict: { label: v.label, tone: v.tone, detail: o ? 'Verdict changed by the consultant (see DNQ check).' : 'Calculated by the Out of Debt Calculator.' },
    headline: [
      { label: 'Debt-free with Crown', value: years(best.term), tone: best.better ? 'good' : 'bad' },
      { label: 'Time saved', value: isFinite(best.yearsSaved) ? years(Math.max(0, best.yearsSaved)) : '—', tone: best.yearsSaved > 0 ? 'good' : undefined },
      { label: 'Interest saved', value: isFinite(best.interestSaved) ? money(Math.max(0, best.interestSaved)) : '—', tone: best.interestSaved > 0 ? 'good' : undefined },
      { label: 'Monthly surplus', value: money(calc?.crownSurplus), tone: (calc?.crownSurplus ?? 0) >= 0 ? 'good' : 'bad' },
    ],
    sections,
  };
};
