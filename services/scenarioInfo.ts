import { AppState, Frequency } from '../types';
import { EXPENSE_PROPS, INCOME_PROPS, INSURANCE_PROPS } from './hubspotMap';

// Plain-text summary for the HubSpot deal property "OODC Latest Scenario Info"
// (oodc_latest_scenario_info). It holds what has no HubSpot field of its own:
// debts to consolidate, future income/expense changes, one-off amounts,
// income and expense lines that aren't mapped, investment properties and notes.

// Lines with a HubSpot property of their own come from the shared map.
const MAPPED_EXPENSES = { has: (n: string) => n in EXPENSE_PROPS };
const MAPPED_INCOMES = { has: (n: string) => n in INCOME_PROPS || n === 'household income' };

const money = (n: number | undefined | null) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 2 }).format(Number(n) || 0);
const per: Record<Frequency, string> = { weekly: 'week', fortnightly: 'fortnight', monthly: 'month', quarterly: 'quarter', annually: 'year' };
const auDate = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10).split('-').reverse().join('/') : s || 'no date');

export const buildScenarioInfo = (s: AppState): string => {
  const out: string[] = [];
  const section = (title: string, lines: string[]) => {
    if (lines.length) out.push('', title, ...lines.map(l => `- ${l}`));
  };

  section('OTHER DEBTS TO CONSOLIDATE', (s.otherDebts || []).filter(d => d.amount > 0 || d.name).map(d =>
    `${d.name || 'Debt'}: ${money(d.amount)} owing at ${d.interestRate}% | repayment ${money(d.repayment)} a ${per[d.frequency] ?? d.frequency}` +
    (d.remainingTerm ? ` | ${d.remainingTerm} yrs left` : '')));

  section('FUTURE INCOME / EXPENSE CHANGES', (s.futureChanges || []).filter(c => c.changeAmount).map(c => {
    const up = c.changeAmount >= 0;
    const what = c.type === 'income' ? (up ? 'Income up' : 'Income down') : (up ? 'Expenses up' : 'Expenses down');
    const until = c.isPermanent ? 'ongoing' : `until ${auDate(c.endDate)}`;
    return `${c.description || c.name || 'Change'}: ${what} ${money(Math.abs(c.changeAmount))} a ${per[c.frequency] ?? 'month'} from ${auDate(c.startDate)} (${until})`;
  }));

  section('FUTURE ONE-OFF AMOUNTS', (s.futureLumpSums || []).filter(l => l.amount).map(l =>
    `${l.description || l.name || 'One-off'}: ${l.type === 'income' ? 'in' : 'out'} ${money(Math.abs(l.amount))} on ${auDate(l.date)}`));

  section('OTHER INCOME (no HubSpot field)', (s.incomes || [])
    .filter(i => i.amount > 0 && !MAPPED_INCOMES.has((i.name || '').trim().toLowerCase()))
    .map(i => `${i.name || 'Income'}: ${money(i.amount)} a ${per[i.frequency] ?? i.frequency}`));

  section('OTHER EXPENSES (no HubSpot field)', (s.expenses || [])
    .filter(e => !e.managed && e.amount > 0 && !MAPPED_EXPENSES.has((e.name || '').trim().toLowerCase()))
    .map(e => `${e.name || 'Expense'} (${e.category}): ${money(e.amount)} a ${per[e.frequency] ?? e.frequency}`));

  section('OTHER INSURANCE (no HubSpot field)', (s.insurances || [])
    .filter(i => i.amount !== null && !(i.key in INSURANCE_PROPS))
    .map(i => `${i.name}: ${money(i.amount)} a ${per[i.frequency] ?? i.frequency}`));

  section('INVESTMENT PROPERTIES', (s.investmentProperties || []).map(p => {
    const value = p.propertyValue ?? p.value ?? 0;
    return `${p.name || p.address || 'Property'}${p.isFuture ? ` (future purchase${p.purchaseDate ? ` ${auDate(p.purchaseDate)}` : ''})` : ''}: value ${money(value)}, loan ${money(p.loanAmount)} at ${p.interestRate}%, rent ${money(p.rentalIncome)} a ${per[p.rentalIncomeFrequency] ?? p.rentalIncomeFrequency}`;
  }));

  if (s.incomeExpensesNotes?.trim()) out.push('', 'CONSULTANT NOTES', s.incomeExpensesNotes.trim());

  const when = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney', dateStyle: 'medium', timeStyle: 'short' });
  const body = out.length ? out.join('\n') : '\nNothing extra in this scenario (no other debts, future changes or unmapped items).';
  return `OODC scenario uploaded ${when}\n${body}`.slice(0, 60000);
};
