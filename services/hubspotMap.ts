import { AppState, Frequency } from '../types';
import { DEFAULT_CAR_SETUP, DEFAULT_INSURANCES } from './managedExpenses';

// ONE place that says which HubSpot DEAL property each calculator field is
// fetched from AND written back to on Upload Record. Used by the (i) info
// icons, the "Check mapping" screen, the upload itself and the deal note.
// To fix a mapping, change it here.

/** amount property, its frequency dropdown, and (if there's no dropdown) the period HubSpot expects. */
export interface PropPair { amount: string; freq?: string; unit?: Frequency }
export interface MapRow {
  key: string;
  section: string;
  label: string;
  value: string;
  /** null = this field has no HubSpot property of its own. */
  props: PropPair | null;
  /** Values written to HubSpot on upload (empty if not written). */
  write: Record<string, string>;
  note?: string;
}

export const HS_FREQ: Record<Frequency, string> = { weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly', quarterly: 'Quarterly', annually: 'Yearly' };
const PER: Record<Frequency, string> = { weekly: 'a week', fortnightly: 'a fortnight', monthly: 'a month', quarterly: 'a quarter', annually: 'a year' };
const TO_MONTHLY: Record<Frequency, number> = { weekly: 52 / 12, fortnightly: 26 / 12, monthly: 1, quarterly: 1 / 3, annually: 1 / 12 };
const money = (n: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 2 }).format(n);
const num = (n: number) => String(Math.round(n * 100) / 100);

/** Expense line name (lower case) -> HubSpot deal properties. */
export const EXPENSE_PROPS: Record<string, PropPair> = {};
const addExp = (names: string[], amount: string, freq?: string, unit?: Frequency) => names.forEach(n => (EXPENSE_PROPS[n] = { amount, freq, unit }));
addExp(['food', 'groceries'], 'food', 'food_frequency');
addExp(['fun'], 'fun', undefined, 'weekly');
addExp(['fuel'], 'fuel', 'fuel_frequency');
addExp(['gas', 'gas etc'], 'gas', 'gas_frequency');
addExp(['electricity', 'power'], 'electricity', 'electricity_frequency');
addExp(['childcare'], 'childcare', 'childcare_frequency2');
addExp(['kids activities', 'kids activities (netball...)'], 'kids_activities_netball', 'kids_activities_netball_frequency');
addExp(['phone', 'phone etc', 'phone & internet', 'mobile phone'], 'phone', 'phone_frequency');
addExp(['internet', 'internet/media'], 'internet', 'internet_frequency');
addExp(['rates', 'council rates'], 'rates', 'rates_frequency');
addExp(['water'], 'water', 'water_frequency');
addExp(['boat/jetski/other rego'], 'boatjetskiother_rego', 'boatjetskiother_rego_frequency');
addExp(['other maintenance'], 'other_maintenance', 'other_maintenance_frequency');
addExp(['kids excursions'], 'kids_excursions', 'kids_excursions_frequency');
addExp(['rent'], 'rent', 'rent_frequency');
addExp(['debt repay'], 'debt_repay', 'debt_repay_frequency');
addExp(['additional expense 1'], 'additional_expense1', 'additional_expense1_frequency');
addExp(['additional expense 2'], 'additional_expense2', 'additional_expense2_frequency');
addExp(['additional expense 3'], 'additional_expense3', 'additional_expense3_frequency');
addExp(['gym'], 'gym', 'gym_frequency');
addExp(['subs', 'subscriptions'], 'subscriptions', 'subscriptions_frequency');
addExp(['pool maintenance', 'pool maint', 'pool'], 'pool_maint', 'pool_maintenance_frequency');
addExp(['school/education', 'school', 'education', 'private school/education'], 'private_schooleducation', 'private_schooleducation_frequency');
addExp(['medical'], 'medical2', 'medical2_frequency');
addExp(['home costs'], 'home_costs', undefined, 'monthly');

/** Income line name (lower case) -> HubSpot deal properties. */
export const INCOME_PROPS: Record<string, PropPair> = {
  'primary borrower income': { amount: 'net_income__1', freq: 'net_income_1_frequency' },
  'person 1 income': { amount: 'net_income__1', freq: 'net_income_1_frequency' },
  'partner income': { amount: 'net_income__2', freq: 'net_income_2_frequency' },
  'person 2 income': { amount: 'net_income__2', freq: 'net_income_2_frequency' },
  'primary borrower other income': { amount: 'net_income_1_other', freq: 'net_income_1_other_frequency' },
  'partner other income': { amount: 'net_income_2_other', freq: 'net_income_2_other_frequency' },
};

export const INSURANCE_PROPS: Record<string, PropPair> = {
  health: { amount: 'health_insurance', freq: 'health_insurance_frequency2' },
  house: { amount: 'house_insurance', freq: 'house_insurance_frequency' },
  life: { amount: 'life_insurance', freq: 'life_insurance_frequency' },
  income: { amount: 'income_protection', freq: 'income_protection_frequency' },
  pet: { amount: 'pet_insurance', freq: 'pet_insurance_frequency' },
};
export const CAR_PROPS: Record<'maintenance' | 'insurance' | 'rego', PropPair> = {
  maintenance: { amount: 'car_maintenance', freq: 'car_maintenance_frequency' },
  insurance: { amount: 'car_insurance', freq: 'car_insurance_frequency' },
  rego: { amount: 'car_rego', freq: 'car_rego_frequency' },
};
/** Single-value fields: key -> property. */
export const SCALAR_PROPS: Record<string, PropPair> = {
  p1age: { amount: 'loan_holder__1_age' },
  p2age: { amount: 'loan_holder__2_age' },
  kids: { amount: 'kids' },
  lender: { amount: 'current_lender__sales_' },
  loanAmount: { amount: 'current_loan_balance' },
  rate: { amount: 'current_interest_rate' },
  repayment: { amount: 'monthly_loan_repayments2', freq: 'repayment_frequency' },
  offset: { amount: 'offset_account_balance' },
  propertyValue: { amount: 'security_1_value' },
  term: { amount: 'years_left_on_current_loan' },
};
export const SCENARIO_INFO_PROP = 'oodc_latest_scenario_info';

const NOT_MAPPED = 'No HubSpot property of its own. On upload it goes into "OODC Latest Scenario Info" and the upload note on the deal.';

/** Every calculator field with its HubSpot mapping and the values Upload Record writes. */
export const buildMapRows = (s: AppState): MapRow[] => {
  const rows: MapRow[] = [];
  const pairWrite = (p: PropPair, amount: number, f: Frequency) =>
    p.freq ? { [p.amount]: num(amount), [p.freq]: HS_FREQ[f] } : { [p.amount]: num(amount * TO_MONTHLY[f] / TO_MONTHLY[p.unit ?? 'monthly']) };

  // Client & loan
  const people = s.people || [];
  const scalar = (key: string, section: string, label: string, value: unknown, write: string | null) => {
    const p = SCALAR_PROPS[key];
    rows.push({ key, section, label, value: value === undefined || value === null || value === '' ? '—' : String(value), props: p, write: write === null ? {} : { [p.amount]: write } });
  };
  if (people[0]) scalar('p1age', 'Borrowers', `${people[0].name || 'Person 1'} age`, people[0].age, people[0].age ? String(people[0].age) : null);
  if (people[1]) scalar('p2age', 'Borrowers', `${people[1].name || 'Person 2'} age`, people[1].age, people[1].age ? String(people[1].age) : null);
  scalar('kids', 'Household', 'Number of kids', s.numberOfKids ?? 0, String(s.numberOfKids ?? 0));
  scalar('lender', 'Current loan', 'Current lender', s.currentLender, s.currentLender || null);
  const l = s.loan;
  scalar('propertyValue', 'Current loan', 'Property value', l.propertyValue ? money(l.propertyValue) : '', l.propertyValue ? num(l.propertyValue) : null);
  scalar('loanAmount', 'Current loan', 'Loan amount', l.amount ? money(l.amount) : '', l.amount ? num(l.amount) : null);
  scalar('offset', 'Current loan', 'Offset balance', money(l.offsetBalance || 0), num(l.offsetBalance || 0));
  scalar('rate', 'Current loan', 'Interest rate', `${l.interestRate}%`, String(l.interestRate));
  if (l.repayment) {
    const p = SCALAR_PROPS.repayment;
    const f = (l.frequency || 'monthly') as Frequency;
    rows.push({ key: 'repayment', section: 'Current loan', label: 'Repayments', value: `${money(l.repayment)} ${PER[f]}`, props: p,
      write: { [p.amount]: num(l.repayment * TO_MONTHLY[f]), [p.freq!]: HS_FREQ[f] },
      note: 'HubSpot "Monthly Loan Repayments" gets the monthly equivalent; "Repayment Frequency" gets how often they actually pay.' });
  }
  if (l.loanTerm) scalar('term', 'Current loan', 'Years left on loan', l.loanTerm, String(l.loanTerm));

  // Income
  for (const i of s.incomes || []) {
    const p = INCOME_PROPS[(i.name || '').trim().toLowerCase()] ?? null;
    rows.push({ key: `income:${i.id}`, section: 'Income', label: i.name || 'Income', value: `${money(i.amount)} ${PER[i.frequency]}`, props: p,
      write: p ? pairWrite(p, i.amount, i.frequency) : {}, note: p ? undefined : NOT_MAPPED });
  }

  // Expenses (generic lines; car & insurance come from their own sections)
  const byProp = new Map<string, { amount: number; f: Frequency; count: number }>();
  for (const e of (s.expenses || []).filter(e => !e.managed)) {
    const p = EXPENSE_PROPS[(e.name || '').trim().toLowerCase()] ?? null;
    rows.push({ key: `expense:${e.id}`, section: `Expenses · ${e.category}`, label: e.name || 'Expense', value: `${money(e.amount)} ${PER[e.frequency]}`, props: p, write: {}, note: p ? undefined : NOT_MAPPED });
    if (p) {
      const prev = byProp.get(p.amount);
      // Two lines on one property (e.g. "Gas" and "Gas etc") are added together as a monthly figure.
      if (!prev) byProp.set(p.amount, { amount: e.amount, f: e.frequency, count: 1 });
      else byProp.set(p.amount, { amount: prev.amount * TO_MONTHLY[prev.f] + e.amount * TO_MONTHLY[e.frequency], f: 'monthly', count: prev.count + 1 });
    }
  }
  for (const r of rows.filter(r => r.key.startsWith('expense:') && r.props)) {
    const agg = byProp.get(r.props!.amount)!;
    if (agg.count > 1) r.note = `${agg.count} lines share this HubSpot property, so their monthly total is uploaded.`;
    r.write = pairWrite(r.props!, agg.amount, agg.f);
  }

  // Car & insurance
  const car = s.carSetup ?? DEFAULT_CAR_SETUP;
  (['maintenance', 'insurance', 'rego'] as const).forEach(k => {
    const c = car[k], p = CAR_PROPS[k];
    rows.push({ key: `car:${k}`, section: 'Car', label: `Car ${k}`, value: c.amount === null ? 'not entered' : `${money(c.amount)} ${PER[c.frequency]}`, props: p,
      write: c.amount === null ? {} : pairWrite(p, c.amount, c.frequency) });
  });
  for (const i of s.insurances ?? DEFAULT_INSURANCES) {
    const p = INSURANCE_PROPS[i.key] ?? null;
    if (!p && i.amount === null) continue;
    rows.push({ key: `ins:${i.key}`, section: 'Insurance', label: i.name, value: i.amount === null ? 'not entered' : `${money(i.amount)} ${PER[i.frequency]}`, props: p,
      write: p && i.amount !== null ? pairWrite(p, i.amount, i.frequency) : {}, note: p ? undefined : NOT_MAPPED });
  }

  // Everything without a property of its own
  const extra = (label: string, count: number) => count && rows.push({ key: `extra:${label}`, section: 'Other', label, value: `${count} item${count > 1 ? 's' : ''}`, props: null, write: {}, note: NOT_MAPPED });
  extra('Other debts to consolidate', (s.otherDebts || []).length);
  extra('Future income / expense changes', (s.futureChanges || []).length);
  extra('Future one-off amounts', (s.futureLumpSums || []).length);
  extra('Investment properties', (s.investmentProperties || []).length);
  return rows;
};

/** All deal properties Upload Record writes (later lines win on a clash). */
export const buildDealWrite = (s: AppState): Record<string, string> =>
  Object.assign({}, ...buildMapRows(s).map(r => r.write));

/** Text for the (i) popover of one field. */
export const describeMapping = (p: PropPair | null | undefined): string =>
  p ? `HubSpot deal property: ${p.amount}${p.freq ? ` + ${p.freq}` : ` (${PER[p.unit ?? 'monthly']}, no frequency field)`}\nFetched from and uploaded to this property.` : NOT_MAPPED;

/** Plain-text list of every field for the deal note. */
export const buildMappingNoteRows = (s: AppState) =>
  buildMapRows(s).map(r => ({ section: r.section, label: r.label, value: r.value, props: r.props ? [r.props.amount, r.props.freq].filter(Boolean).join(' + ') : '', note: r.note ?? '' }));
