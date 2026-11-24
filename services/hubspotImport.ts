import { AppState, ExpenseItem, Frequency, IncomeItem } from '../types';

import { DEFAULT_CAR_SETUP, DEFAULT_INSURANCES, syncManagedItems } from './managedExpenses';
import { FormNotes, fromFormNotes } from './formNotesParse';

// Maps the fields returned by /api/hubspot-fetch (HubSpot deal fact-find
// fields + contact basics) onto calculator fields. Each item is shown to the
// consultant with its HubSpot source before anything is applied.

export interface HubSpotFetchResult {
  email: string;
  contact: Record<string, string>;
  deal: { id: string; name: string; stage?: string; properties: Record<string, string> } | null;
  /** Every deal on the contact, newest first, so the consultant can pick one. */
  deals?: { id: string; name: string; stage: string; pipeline: string; closed: boolean; created: string; linked?: boolean }[];
  /** Amount + frequency pairs found in HubSpot that have no specific mapping yet. */
  extraPairs?: { amountProp: string; freqProp: string; label: string }[];
  /** Health check + setter form answers saved as notes on the deal. */
  formNotes?: FormNotes | null;
}

export interface ImportItem {
  id: string;
  group: 'Client' | 'Current loan' | 'Other debts' | 'Income' | 'Expenses' | 'For reference';
  label: string;
  value: string;          // display
  source: string;         // HubSpot property name(s)
  note?: string;          // shown as a caution
  apply?: (s: AppState) => AppState; // undefined = reference only
}

const FREQ: Record<string, Frequency> = { weekly: 'weekly', fortnightly: 'fortnightly', monthly: 'monthly', quarterly: 'quarterly', yearly: 'annually', annually: 'annually' };
const freq = (v: string | undefined, fallback: Frequency): Frequency => FREQ[(v || '').toLowerCase()] ?? fallback;
const n = (v: string | undefined): number | null => {
  if (v === undefined) return null;
  const x = parseFloat(String(v).replace(/[$,\s]/g, ''));
  return isFinite(x) ? x : null;
};
const money = (v: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 2 }).format(v);
const freqLabel = (f: Frequency) => f === 'annually' ? 'a year' : f === 'monthly' ? 'a month' : f === 'weekly' ? 'a week' : f === 'fortnightly' ? 'a fortnight' : 'a quarter';

const withPerson = (s: AppState, index: number, patch: { name?: string; age?: number }): AppState => {
  const people = [...(s.people || [])];
  while (people.length <= index) people.push({ id: Date.now() + people.length, name: `Person ${people.length + 1}`, age: 35 });
  people[index] = { ...people[index], ...patch };
  return { ...s, people };
};

const upsertExpense = (s: AppState, item: Omit<ExpenseItem, 'id'>, aliases: string[] = []): AppState => {
  const names = [item.name, ...aliases].map(x => x.toLowerCase());
  const expenses = [...(s.expenses || [])];
  const i = expenses.findIndex(e => !e.managed && names.includes((e.name || '').toLowerCase()));
  if (i >= 0) expenses[i] = { ...expenses[i], amount: item.amount, frequency: item.frequency, category: item.category, isImported: true };
  else expenses.push({ ...item, id: Date.now() + Math.floor(Math.random() * 1e6), isImported: true });
  return { ...s, expenses };
};

const setInsurance = (s: AppState, key: 'health' | 'house' | 'pet' | 'income' | 'life' | 'other', amount: number, frequency: Frequency): AppState => {
  const list = (s.insurances ?? DEFAULT_INSURANCES).map(i => (i.key === key ? { ...i, amount, frequency } : i));
  return { ...s, insurances: list };
};

export const buildImportItems = (r: HubSpotFetchResult): ImportItem[] => {
  const c = r.contact || {};
  const dealProps = r.deal?.properties || {};
  // Deal fields win; empty ones are filled from the health check / setter notes.
  const fn = fromFormNotes(r.formNotes, p => dealProps[p] !== undefined && String(dealProps[p]).trim() !== '');
  const d: Record<string, string> = { ...fn.props, ...dealProps };
  if (!d.client_first_names && fn.person2Name) {
    d.client_first_names = `${c.firstname || 'Person 1'} & ${fn.person2Name}`;
    fn.source.client_first_names = fn.personSource ?? 'note';
  }
  const items: ImportItem[] = [];

  // --- Client ---------------------------------------------------------------
  const p1 = [c.firstname, c.lastname].filter(Boolean).join(' ');
  if (p1) items.push({ id: 'p1name', group: 'Client', label: 'Person 1 name', value: p1, source: 'contact: firstname, lastname', apply: s => withPerson(s, 0, { name: p1 }) });
  const firstNames = (d.client_first_names || '').split(/\s*(?:&|\band\b|,|\/)\s*/i).map(x => x.trim()).filter(Boolean);
  if (firstNames.length > 1) {
    const p2 = firstNames[1];
    items.push({ id: 'p2name', group: 'Client', label: 'Person 2 name', value: p2, source: 'deal: client_first_names', apply: s => withPerson(s, 1, { name: p2 }) });
  }
  const a1 = n(d.loan_holder__1_age), a2 = n(d.loan_holder__2_age);
  if (a1 !== null) items.push({ id: 'p1age', group: 'Client', label: 'Person 1 age', value: String(a1), source: 'deal: loan_holder__1_age', apply: s => withPerson(s, 0, { age: a1 }) });
  if (a2 !== null) items.push({ id: 'p2age', group: 'Client', label: 'Person 2 age', value: String(a2), source: 'deal: loan_holder__2_age', apply: s => withPerson(s, 1, { age: a2 }) });
  const phone = c.mobilephone || c.phone;
  if (phone) items.push({ id: 'phone', group: 'Client', label: 'Phone', value: phone, source: c.mobilephone ? 'contact: mobilephone' : 'contact: phone', apply: s => ({ ...s, clientPhone: phone }) });
  items.push({ id: 'email', group: 'Client', label: 'Email', value: r.email, source: 'contact: email', apply: s => ({ ...s, clientEmail: r.email }) });
  const kids = n(d.kids) ?? n(d.kids_under_18);
  if (kids !== null) items.push({ id: 'kids', group: 'Client', label: 'Number of kids', value: String(kids), source: d.kids !== undefined ? 'deal: kids' : 'deal: kids_under_18', apply: s => ({ ...s, numberOfKids: kids }) });

  // --- Current loan -----------------------------------------------------------
  let lender = d.current_lender__sales_;
  if ((!lender || lender === 'Other') && d.bank_name) lender = d.bank_name;
  if (lender) items.push({ id: 'lender', group: 'Current loan', label: 'Current lender', value: lender, source: d.current_lender__sales_ && d.current_lender__sales_ !== 'Other' ? 'deal: current_lender__sales_' : 'deal: bank_name', apply: s => ({ ...s, currentLender: lender! }) });
  const bal = n(d.current_loan_balance);
  if (bal !== null) items.push({ id: 'loanAmount', group: 'Current loan', label: 'Loan balance', value: money(bal), source: 'deal: current_loan_balance', apply: s => ({ ...s, loan: { ...s.loan, amount: bal } }) });
  const rate = n(d.current_interest_rate);
  if (rate !== null) items.push({ id: 'rate', group: 'Current loan', label: 'Interest rate', value: `${rate}%`, source: 'deal: current_interest_rate', apply: s => ({ ...s, loan: { ...s.loan, interestRate: rate } }) });
  const repSrc = d.monthly_loan_repayments2 !== undefined ? 'monthly_loan_repayments2' : 'total_monthly_repayments__current_';
  const rep = n(d[repSrc]);
  if (rep !== null) items.push({ id: 'repayment', group: 'Current loan', label: 'Repayment', value: `${money(rep)} a month`, source: `deal: ${repSrc}`, apply: s => ({ ...s, loan: { ...s.loan, repayment: rep, frequency: 'monthly' } }) });
  const off = n(d.offset_account_balance);
  if (off !== null) items.push({ id: 'offset', group: 'Current loan', label: 'Offset balance', value: money(off), source: 'deal: offset_account_balance', apply: s => ({ ...s, loan: { ...s.loan, offsetBalance: off } }) });
  const pvSrc = d.security_1_value !== undefined ? 'security_1_value' : 'total_security_property_values';
  const pv = n(d[pvSrc]);
  if (pv !== null) items.push({ id: 'propertyValue', group: 'Current loan', label: 'Property value', value: money(pv), source: `deal: ${pvSrc}`, apply: s => ({ ...s, loan: { ...s.loan, propertyValue: pv } }) });
  const yrs = n(d.years_left_on_current_loan);
  if (yrs !== null) items.push({ id: 'term', group: 'Current loan', label: 'Years left on loan', value: String(yrs), source: 'deal: years_left_on_current_loan', apply: s => ({ ...s, loan: { ...s.loan, loanTerm: yrs } }) });

  // --- Income -------------------------------------------------------------------
  const i1 = n(d.net_income__1), i2 = n(d.net_income__2);
  const incomeNote = 'HubSpot labels this "Net Income" but its description says "gross before expenses". Check it is after tax.';
  const incomeLines: { name: string; amount: number; src: string; freqSrc: string }[] = [];
  if (i1) incomeLines.push({ name: 'Primary Borrower Income', amount: i1, src: 'net_income__1', freqSrc: 'net_income_1_frequency' });
  if (i2) incomeLines.push({ name: 'Partner Income', amount: i2, src: 'net_income__2', freqSrc: 'net_income_2_frequency' });
  const o1 = n(d.net_income_1_other), o2 = n(d.net_income_2_other);
  if (o1) incomeLines.push({ name: 'Primary Borrower Other Income', amount: o1, src: 'net_income_1_other', freqSrc: 'net_income_1_other_frequency' });
  if (o2) incomeLines.push({ name: 'Partner Other Income', amount: o2, src: 'net_income_2_other', freqSrc: 'net_income_2_other_frequency' });
  if (incomeLines.length) {
    for (const l of incomeLines) {
      const f = freq(d[l.freqSrc], 'monthly');
      const hasF = !!d[l.freqSrc];
      items.push({
        id: `inc-${l.src}`, group: 'Income', label: l.name, value: `${money(l.amount)} ${freqLabel(f)}`, source: `deal: ${l.src}${hasF ? `, ${l.freqSrc}` : ''}`,
        note: hasF ? incomeNote : `${incomeNote} No frequency set in HubSpot (assumed monthly).`,
        apply: s => {
          const others = (s.incomes || []).filter(x => (x.name || '').toLowerCase() !== l.name.toLowerCase());
          const inc: IncomeItem = { ...(s.incomes?.[0] ?? {}), id: Date.now() + Math.floor(Math.random() * 1e6), name: l.name, amount: l.amount, frequency: f, isImported: true } as IncomeItem;
          return { ...s, incomes: [...others, inc] };
        },
      });
    }
  } else {
    const tm = n(d.total_monthly_after_tax_income__current_);
    if (tm) items.push({
      id: 'inc-total', group: 'Income', label: 'Household income (after tax)', value: `${money(tm)} a month`, source: 'deal: total_monthly_after_tax_income__current_',
      apply: s => ({ ...s, incomes: [{ id: Date.now(), name: 'Household Income', amount: tm, frequency: 'monthly', isImported: true } as IncomeItem] }),
    });
  }

  // --- Expenses -------------------------------------------------------------------
  const exp = (id: string, label: string, amtProp: string, freqProp: string | null, fallback: Frequency, category: ExpenseItem['category'], aliases: string[] = [], note?: string) => {
    const amt = n(d[amtProp]);
    if (amt === null) return;
    // Frequency comes from the paired "<field>_frequency" property when filled.
    const fp = freqProp ?? `${amtProp}_frequency`;
    const f = freq(d[fp], fallback);
    items.push({
      id, group: 'Expenses', label, value: `${money(amt)} ${freqLabel(f)}`, source: `deal: ${amtProp}${d[fp] ? `, ${fp}` : ''}`,
      note: note ?? (!d[fp] ? `No frequency in HubSpot (${fp}); assumed ${f}.` : undefined),
      apply: s => upsertExpense(s, { name: label, amount: amt, frequency: f, category }, aliases),
    });
  };
  exp('food', 'Food', 'food', null, 'weekly', 'FFF', ['groceries']);
  exp('fun', 'Fun', 'fun', null, 'weekly', 'FFF');
  exp('fuel', 'Fuel', 'fuel', null, 'weekly', 'FFF');
  exp('gas', 'Gas', 'gas', null, 'quarterly', 'Hard Expenses', ['gas etc']);
  exp('electricity', 'Electricity', 'electricity', null, 'quarterly', 'Hard Expenses', ['power']);
  // Newer HubSpot fields take priority over the older equivalents.
  if (n(d.childcare) !== null) exp('childcare', 'Childcare', 'childcare', 'childcare_frequency2', 'fortnightly', 'Hard Expenses');
  else exp('childcare', 'Childcare', 'childcare_amount', 'childcare_frequency', 'fortnightly', 'Hard Expenses');
  exp('kidsact', 'Kids Activities', 'kids_activities_netball', 'kids_activities_netball_frequency', 'monthly', 'Hard Expenses', ['kids activities (netball...)']);
  if (n(d.phone) !== null) exp('phone', 'Phone etc', 'phone', 'phone_frequency', 'monthly', 'Hard Expenses', ['phone', 'phone & internet']);
  else exp('phone', 'Phone etc', 'mobile_phone', 'phone___internet_frequency', 'monthly', 'Hard Expenses', ['phone', 'phone & internet']);
  exp('internet', 'Internet', 'internet', 'internet_frequency', 'monthly', 'Hard Expenses', ['internet/media']);
  exp('rates', 'Rates', 'rates', 'rates_frequency', 'quarterly', 'Hard Expenses', ['council rates']);
  exp('water', 'Water', 'water', 'water_frequency', 'quarterly', 'Hard Expenses');
  exp('boatrego', 'Boat/Jetski/Other Rego', 'boatjetskiother_rego', 'boatjetskiother_rego_frequency', 'annually', 'Hard Expenses');
  exp('othermaint', 'Other Maintenance', 'other_maintenance', 'other_maintenance_frequency', 'annually', 'Hard Expenses');
  exp('kidsexc', 'Kids Excursions', 'kids_excursions', 'kids_excursions_frequency', 'annually', 'Soft Expenses');
  exp('rent', 'Rent', 'rent', 'rent_frequency', 'weekly', 'Hard Expenses');
  exp('debtrepay', 'Debt Repay', 'debt_repay', 'debt_repay_frequency', 'monthly', 'Hard Expenses');
  // Additional Expense 1-3 (no description field in HubSpot).
  for (const i of [1, 2, 3]) exp(`addexp${i}`, `Additional Expense ${i}`, `additional_expense${i}`, `additional_expense${i}_frequency`, 'monthly', 'Other', [],
    d[`additional_expense${i}_frequency`] ? undefined : 'No frequency set in HubSpot (assumed monthly).');
  exp('gym', 'Gym', 'gym', 'gym_frequency', 'monthly', 'Soft Expenses');
  exp('subs', 'Subs', 'subscriptions', 'subscriptions_frequency', 'monthly', 'Hard Expenses', ['subscriptions']);
  // Any other "<X>" + "<X> Frequency" pairs added in HubSpot later.
  for (const x of (r.extraPairs ?? []).filter(x => !/income/i.test(x.label))) exp(`extra-${x.amountProp}`, x.label, x.amountProp, x.freqProp, 'monthly', 'Other');
  exp('poolmaint', 'Pool Maintenance', 'pool_maint', 'pool_maintenance_frequency', 'monthly', 'Hard Expenses', ['pool maint', 'pool']);
  if (n(d.private_schooleducation) !== null) exp('school', 'School/Education', 'private_schooleducation', 'private_schooleducation_frequency', 'annually', 'Hard Expenses', ['school', 'education', 'private school/education']);
  else exp('school', 'School/Education', 'monthly_school', 'education_cost_frequency', 'monthly', 'Hard Expenses', ['school', 'education']);
  if (n(d.medical2) !== null) exp('medical', 'Medical', 'medical2', 'medical2_frequency', 'monthly', 'Soft Expenses');
  else exp('medical', 'Medical', 'medical', 'medical_cost_frequency', 'monthly', 'Soft Expenses');
  exp('homecosts', 'Home costs', 'home_costs', null, 'monthly', 'Hard Expenses');

  const ins = (id: string, label: string, amtProp: string, freqProp: string, apply: (s: AppState, amt: number, f: Frequency) => AppState, fallback: Frequency = 'monthly') => {
    const amt = n(d[amtProp]);
    if (amt === null) return;
    const f = freq(d[freqProp], fallback);
    items.push({
      id, group: 'Expenses', label, value: `${money(amt)} ${freqLabel(f)}`, source: `deal: ${amtProp}${d[freqProp] ? `, ${freqProp}` : ''}`,
      note: d[freqProp] ? undefined : `No frequency in HubSpot (${freqProp}); assumed ${fallback}.`,
      apply: s => apply(s, amt, f),
    });
  };
  const healthNew = n(d.health_insurance) !== null;
  ins('health', 'Health insurance', healthNew ? 'health_insurance' : 'health_insurance_amount', healthNew ? 'health_insurance_frequency2' : 'health_insurance_frequency', (s, a, f) => setInsurance(s, 'health', a, f));
  const houseNew = n(d.house_insurance) !== null;
  ins('house', 'House insurance', houseNew ? 'house_insurance' : 'home_insurance_amount', houseNew ? 'house_insurance_frequency' : 'home_insurance_frequency', (s, a, f) => setInsurance(s, 'house', a, f), 'annually');
  ins('life', 'Life insurance', 'life_insurance', 'life_insurance_frequency', (s, a, f) => setInsurance(s, 'life', a, f));
  ins('incomeprot', 'Income protection', 'income_protection', 'income_protection_frequency', (s, a, f) => setInsurance(s, 'income', a, f));
  ins('pet', 'Pet insurance', 'pet_insurance', 'pet_insurance_frequency', (s, a, f) => setInsurance(s, 'pet', a, f));
  const carInsNew = n(d.car_insurance) !== null;
  ins('carins', 'Car insurance', carInsNew ? 'car_insurance' : 'motor_vehicle_insurance_amount', carInsNew ? 'car_insurance_frequency' : 'motor_vehicle_frequency',
    (s, a, f) => ({ ...s, carSetup: { ...(s.carSetup ?? DEFAULT_CAR_SETUP), insurance: { amount: a, frequency: f } } }));
  const carMaintNew = n(d.car_maintenance) !== null;
  ins('carmaint', carMaintNew ? 'Car maintenance' : 'Car running costs (→ Car maintenance)', carMaintNew ? 'car_maintenance' : 'car_running_costs', carMaintNew ? 'car_maintenance_frequency' : 'car_cost_frequency',
    (s, a, f) => ({ ...s, carSetup: { ...(s.carSetup ?? DEFAULT_CAR_SETUP), maintenance: { amount: a, frequency: f } } }), 'annually');
  ins('carrego', 'Car rego', 'car_rego', 'car_rego_frequency',
    (s, a, f) => ({ ...s, carSetup: { ...(s.carSetup ?? DEFAULT_CAR_SETUP), rego: { amount: a, frequency: f } } }), 'annually');

  // --- From the notes only: lines with no HubSpot field, and other debts ------------
  for (const ln of fn.extraLines) {
    const f = freq(ln.freq, 'monthly');
    items.push({
      id: `note-${ln.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, group: 'Expenses', label: ln.label, value: `${money(ln.amount)} ${freqLabel(f)}`,
      source: ln.source, note: 'No HubSpot field for this line; taken from the note.',
      apply: s => upsertExpense(s, { name: ln.label, amount: ln.amount, frequency: f, category: ln.category }),
    });
  }
  for (const debt of fn.debts) {
    items.push({
      id: `debt-${debt.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, group: 'Other debts', label: debt.name, value: `${money(debt.amount)} owing`,
      source: debt.source, note: "Interest rate, repayment and term weren't given; fill them in on the Current Loan tab.",
      apply: s => {
        const list = [...(s.otherDebts || [])];
        const i = list.findIndex(x => (x.name || '').toLowerCase() === debt.name.toLowerCase());
        const item = { id: i >= 0 ? list[i].id : Date.now() + Math.floor(Math.random() * 1e6), name: debt.name, amount: debt.amount,
          interestRate: i >= 0 ? list[i].interestRate : 0, repayment: i >= 0 ? list[i].repayment : 0, frequency: (i >= 0 ? list[i].frequency : 'monthly') as Frequency, remainingTerm: i >= 0 ? list[i].remainingTerm : 0 };
        if (i >= 0) list[i] = item; else list.push(item);
        return { ...s, otherDebts: list };
      },
    });
  }

  // --- Reference only -------------------------------------------------------------
  const ref = (id: string, label: string, prop: string, fmt: (v: string) => string = v => v) => {
    if (d[prop] !== undefined) items.push({ id, group: 'For reference', label, value: fmt(d[prop]), source: `deal: ${prop}` });
  };
  const m = (v: string) => (n(v) !== null ? money(n(v)!) : v);
  ref('otherdebts', 'Total of other debts (add each debt on Current Loan)', 'total_of_other_debts', m);
  ref('debtsconsol', 'Debts being consolidated', 'debts_being_consolidated');
  ref('savings', 'Savings', 'total_savings', m);
  ref('othexp', 'Other expenses (notes)', 'other_expenses_text');
  ref('oodcinfo', 'OODC Latest Scenario Info (last upload)', 'oodc_latest_scenario_info');
  ref('totexp', 'Total monthly expenses in HubSpot', 'total_monthly_expenses__current_', m);

  // Say where note-sourced values came from.
  for (const it of items) {
    if (!it.source.startsWith('deal:')) continue;
    const props = it.source.slice(5).split(',').map(x => x.trim());
    const fromNote = props.map(p => fn.source[p]).find(Boolean);
    if (fromNote) {
      it.source = `${fromNote} · deal field ${props[0]} is empty`;
      if (it.group === 'Income' && /^Health Check note/.test(fromNote)) it.note = 'From the health check form (after tax).';
      if (/^\$1(\.00)? /.test(it.value)) it.note = [it.note, 'Entered as $1 on the form; this often means "none".'].filter(Boolean).join(' ');
    }
  }
  return items;
};

/** Applies the selected items, then re-syncs Car/Insurance-managed expenses. */
// The calculator starts with sample figures (App.tsx initialAppState). When
// HubSpot data comes in, those samples must not be left mixed in with it.
const SAMPLE_INCOME_NAMES = ['person 1 income', 'person 2 income'];
const SAMPLE_EXPENSES: Record<string, [number, Frequency]> = {
  food: [200, 'weekly'], fun: [125, 'weekly'], fuel: [75, 'weekly'], holidays: [3000, 'annually'], misc: [200, 'monthly'],
  gifts: [500, 'annually'], clothes: [100, 'monthly'], 'gas etc': [300, 'quarterly'], 'phone etc': [150, 'monthly'],
  rates: [500, 'quarterly'], subs: [50, 'monthly'],
};

// Import item id -> the calculator field it fills (for the "Fetched" tags).
const insVal = (key: string) => (s: AppState) => s.insurances?.find(i => i.key === key)?.amount ?? undefined;
export const FETCHED_FIELDS: Record<string, (s: AppState) => string | number | null | undefined> = {
  p1name: s => s.people?.[0]?.name, p2name: s => s.people?.[1]?.name,
  p1age: s => s.people?.[0]?.age, p2age: s => s.people?.[1]?.age,
  phone: s => s.clientPhone, email: s => s.clientEmail, kids: s => s.numberOfKids, lender: s => s.currentLender,
  loanAmount: s => s.loan?.amount, rate: s => s.loan?.interestRate, repayment: s => s.loan?.repayment,
  offset: s => s.loan?.offsetBalance, propertyValue: s => s.loan?.propertyValue, term: s => s.loan?.loanTerm,
  health: insVal('health'), house: insVal('house'), life: insVal('life'), incomeprot: insVal('income'), pet: insVal('pet'),
  carins: s => s.carSetup?.insurance.amount, carmaint: s => s.carSetup?.maintenance.amount, carrego: s => s.carSetup?.rego.amount,
};

/** Tooltip text if this field still holds the value fetched from HubSpot, else null. */
export const fetchedTitle = (s: AppState, key: string, current: unknown): string | null => {
  const f = s.hubspotFetched;
  if (!f || !(key in f.values) || current === undefined || current === null || String(f.values[key]) !== String(current)) return null;
  return fetchedFrom(f);
};
export const fetchedFrom = (f: AppState['hubspotFetched']) =>
  f ? `Fetched from HubSpot${f.deal ? ` (deal: ${f.deal})` : ''} on ${new Date(f.at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Fetched from HubSpot';

export const applyImport = (state: AppState, items: ImportItem[], selected: Set<string>, dealName = '', dealId = '', email = ''): AppState => {
  // Remember what an earlier import put in, then clear the flags so only
  // rows set by THIS import end up flagged.
  const prevIncome = new Set((state.incomes || []).filter(i => i.isImported).map(i => i.id));
  const prevExpense = new Set((state.expenses || []).filter(e => e.isImported && !e.managed).map(e => e.id));
  let s: AppState = {
    ...state,
    incomes: (state.incomes || []).map(i => ({ ...i, isImported: false })),
    expenses: (state.expenses || []).map(e => (e.managed ? e : { ...e, isImported: false })),
  };
  const chosen = items.filter(it => it.apply && selected.has(it.id));
  for (const it of chosen) s = it.apply!(s);
  // Always clear samples / a previous client's figures, even if this deal has none,
  // so nothing that didn't come from this client is left looking real.
  if (chosen.length) {
    // Drop sample incomes and incomes from a previous client's import.
    s = { ...s, incomes: (s.incomes || []).filter(i => i.isImported || !(prevIncome.has(i.id) || SAMPLE_INCOME_NAMES.includes((i.name || '').toLowerCase()))) };
  }
  // Sample offset ($50,000) isn't the client's: clear it unless HubSpot gave one.
  if (chosen.length && !chosen.some(it => it.id === 'offset') && s.loan?.offsetBalance === 50000) s = { ...s, loan: { ...s.loan, offsetBalance: 0 } };
  if (chosen.length) {
    // Blank sample figures and a previous client's imported figures that this client doesn't have.
    s = { ...s, expenses: (s.expenses || []).map(e => {
      if (e.managed || e.isImported) return e;
      const sample = SAMPLE_EXPENSES[(e.name || '').toLowerCase()];
      const isSample = sample && e.amount === sample[0] && e.frequency === sample[1];
      return isSample || prevExpense.has(e.id) ? { ...e, amount: 0 } : e;
    }) };
  }
  if (s.carSetup || s.insurances) {
    s = syncManagedItems({ ...s, carSetup: s.carSetup ?? DEFAULT_CAR_SETUP, insurances: s.insurances ?? DEFAULT_INSURANCES });
  }
  // Record what came from HubSpot so the fields can show a "Fetched" tag.
  const values: Record<string, string | number> = {};
  for (const it of chosen) {
    const v = FETCHED_FIELDS[it.id]?.(s);
    if (v !== undefined && v !== null && v !== '') values[it.id] = v;
  }
  return {
    ...s,
    incomes: (s.incomes || []).map(i => ({ ...i, fromHubSpot: !!i.isImported })),
    expenses: (s.expenses || []).map(e => (e.managed ? e : { ...e, fromHubSpot: !!e.isImported })),
    hubspotFetched: { deal: dealName, dealId, email, at: new Date().toISOString(), values },
  };
};
