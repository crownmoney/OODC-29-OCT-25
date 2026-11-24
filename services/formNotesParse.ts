// Reads the Financial Health Check note and the setter handover note (as
// returned by /api/hubspot-fetch in `formNotes`) and turns them into the same
// HubSpot deal property names "Fetch from HubSpot" already maps. They only
// fill fields that are EMPTY on the deal.

export interface FormNotes {
  fhc: { date: string; text: string } | null;
  setter: { date: string; rows: { section: string; label: string; value: string }[] } | null;
  error?: string;
}

export interface NoteLine { category: 'FFF' | 'Hard Expenses' | 'Soft Expenses' | 'Other'; label: string; amount: number; freq: string }
export interface NoteDebt { name: string; amount: number }
export interface FromNotes {
  /** Deal property name -> value taken from a note. */
  props: Record<string, string>;
  /** Deal property name -> where it came from (for the review screen). */
  source: Record<string, string>;
  /** Health check lines that have no HubSpot property (e.g. Holidays). */
  extraLines: (NoteLine & { source: string })[];
  debts: (NoteDebt & { source: string })[];
  person2Name?: string;
  personSource?: string;
}

const num = (v: string) => {
  const x = parseFloat(String(v).replace(/[$,%\s]/g, ''));
  return isFinite(x) ? x : null;
};
const auDate = (iso: string) => (iso ? new Date(iso).toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' }) : '');

// Health check label (lower case) -> [amount property, frequency property | null]
const FHC_PROPS: Record<string, [string, string | null]> = {
  'food': ['food', 'food_frequency'], 'fuel': ['fuel', 'fuel_frequency'], 'fun': ['fun', null],
  'rates': ['rates', 'rates_frequency'], 'gas': ['gas', 'gas_frequency'],
  'elec': ['electricity', 'electricity_frequency'], 'electricity': ['electricity', 'electricity_frequency'],
  'water': ['water', 'water_frequency'],
  'car ins': ['car_insurance', 'car_insurance_frequency'], 'car insurance': ['car_insurance', 'car_insurance_frequency'],
  'house insur': ['house_insurance', 'house_insurance_frequency'], 'house insurance': ['house_insurance', 'house_insurance_frequency'],
  'health insurance': ['health_insurance', 'health_insurance_frequency2'],
  'medical': ['medical2', 'medical2_frequency'],
  'life insurance': ['life_insurance', 'life_insurance_frequency'],
  'pet insurance': ['pet_insurance', 'pet_insurance_frequency'],
  'income protection': ['income_protection', 'income_protection_frequency'],
  'phone': ['phone', 'phone_frequency'], 'internet': ['internet', 'internet_frequency'],
  'car rego': ['car_rego', 'car_rego_frequency'], 'car maintenance': ['car_maintenance', 'car_maintenance_frequency'],
  'boat/jetski/other rego': ['boatjetskiother_rego', 'boatjetskiother_rego_frequency'],
  'other maintenance': ['other_maintenance', 'other_maintenance_frequency'],
  'pool maint': ['pool_maint', 'pool_maintenance_frequency'], 'pool maintenance': ['pool_maint', 'pool_maintenance_frequency'],
  'gym': ['gym', 'gym_frequency'], 'subscriptions': ['subscriptions', 'subscriptions_frequency'],
  'childcare': ['childcare', 'childcare_frequency2'],
  'kids activities (netball...)': ['kids_activities_netball', 'kids_activities_netball_frequency'],
  'kids activities': ['kids_activities_netball', 'kids_activities_netball_frequency'],
  'kids excursions': ['kids_excursions', 'kids_excursions_frequency'],
  'private school/education': ['private_schooleducation', 'private_schooleducation_frequency'],
  'rent': ['rent', 'rent_frequency'], 'debt repay': ['debt_repay', 'debt_repay_frequency'],
  'additional expense 1': ['additional_expense1', 'additional_expense1_frequency'],
  'additional expense 2': ['additional_expense2', 'additional_expense2_frequency'],
  'additional expense 3': ['additional_expense3', 'additional_expense3_frequency'],
  'home costs': ['home_costs', null],
};

/** Parses the health check note text. */
export const parseFhc = (text: string) => {
  const people: { name: string; net?: [number, string]; other?: [number, string] }[] = [];
  const lines: NoteLine[] = [];
  let cat: NoteLine['category'] | 'income' = 'income';
  let person = -1;
  for (const raw of text.split('\n')) {
    const l = raw.replace(/^[•\-\*·\s]+/, '').trim();
    if (!l) continue;
    if (/^===\s*INCOME/i.test(l)) { cat = 'income'; continue; }
    if (/^===\s*EXPENSES/i.test(l)) { if (cat === 'income') cat = 'Other'; continue; }
    const pm = l.match(/^Person\s*(\d)\s*\(([^)]*)\)\s*:?\s*$/i);
    if (pm) { cat = 'income'; person = Number(pm[1]) - 1; people[person] = { name: pm[2].trim() }; continue; }
    if (/^Food\s*&\s*Fuel|\(FFF\)\s*:?$/i.test(l)) { cat = 'FFF'; continue; }
    if (/^Hard Expenses\s*:?$/i.test(l)) { cat = 'Hard Expenses'; continue; }
    if (/^Soft Expenses\s*:?$/i.test(l)) { cat = 'Soft Expenses'; continue; }
    if (/^Other( Expenses)?\s*:?$/i.test(l)) { cat = 'Other'; continue; }
    const m = l.match(/^(.+?):\s*\$?\s*(-?[\d,]+(?:\.\d+)?)\s*\(([A-Za-z]+)\)/);
    if (!m) continue;
    const label = m[1].trim(), amount = num(m[2]) ?? 0, f = m[3];
    if (cat === 'income' && person >= 0) {
      if (/^Net Income/i.test(label)) people[person].net = [amount, f];
      else if (/^Other/i.test(label)) people[person].other = [amount, f];
    } else if (cat !== 'income') {
      lines.push({ category: cat, label, amount, freq: f });
    }
  }
  return { people, lines };
};

const SETTER: Record<string, Record<string, string>> = {
  'home loan': {
    'property value': 'security_1_value', 'home loan balance': 'current_loan_balance', 'interest rate': 'current_interest_rate',
    'repayment a month': 'monthly_loan_repayments2', 'repayment frequency': 'repayment_frequency',
    'years left': 'years_left_on_current_loan', 'offset balance': 'offset_account_balance', 'offset': 'offset_account_balance',
    'current lender': 'current_lender__sales_', 'lender': 'current_lender__sales_',
  },
  'applicant 1': { 'age': 'loan_holder__1_age' },
  'applicant 2': { 'age': 'loan_holder__2_age' },
  'partner and household': { 'kids under 18': 'kids' },
};

/** Builds note-sourced values. `has(prop)` says whether the deal already has that field filled. */
export const fromFormNotes = (notes: FormNotes | null | undefined, has: (prop: string) => boolean): FromNotes => {
  const out: FromNotes = { props: {}, source: {}, extraLines: [], debts: [] };
  if (!notes) return out;
  const set = (prop: string, value: string | number, src: string) => {
    if (has(prop) || prop in out.props) return;
    out.props[prop] = String(value); out.source[prop] = src;
  };

  // Setter handover note: loan, ages, partner, kids, other debts
  if (notes.setter) {
    const src = `Setter note (${auDate(notes.setter.date)})`;
    for (const r of notes.setter.rows) {
      const sec = r.section.toLowerCase(), lab = r.label.toLowerCase();
      const prop = SETTER[sec]?.[lab];
      if (prop) {
        const v = prop === 'repayment_frequency' || prop === 'current_lender__sales_' ? r.value : num(r.value);
        if (v !== null && v !== '') set(prop, v, src);
      }
      if (((sec === 'applicant 2' && lab === 'name') || lab === 'partner name') && !out.person2Name) { out.person2Name = r.value; out.personSource = src; }
      const dm = sec === 'other debts' && r.label.match(/^(.+?)\s+owing$/i);
      if (dm && !/total/i.test(dm[1])) {
        const amount = num(r.value);
        if (amount) out.debts.push({ name: dm[1].replace(/^./, c => c.toUpperCase()), amount, source: src });
      }
    }
  }

  // Financial health check note: incomes and every expense line
  if (notes.fhc) {
    const src = `Health Check note (${auDate(notes.fhc.date)})`;
    const { people, lines } = parseFhc(notes.fhc.text);
    const inc = (i: number, kind: 'net' | 'other') => {
      const v = people[i]?.[kind];
      if (!v) return;
      const [amtProp, freqProp] = kind === 'net'
        ? [i === 0 ? 'net_income__1' : 'net_income__2', i === 0 ? 'net_income_1_frequency' : 'net_income_2_frequency']
        : [i === 0 ? 'net_income_1_other' : 'net_income_2_other', i === 0 ? 'net_income_1_other_frequency' : 'net_income_2_other_frequency'];
      if (has(amtProp)) return;
      set(amtProp, v[0], src); set(freqProp, v[1], src);
    };
    [0, 1].forEach(i => { inc(i, 'net'); inc(i, 'other'); });
    if (people[1]?.name) { out.person2Name = people[1].name; out.personSource = src; } // health check is the newer form
    for (const ln of lines) {
      const p = FHC_PROPS[ln.label.toLowerCase()];
      if (p) {
        if (has(p[0])) continue;
        set(p[0], ln.amount, src);
        if (p[1]) set(p[1], ln.freq, src);
      } else {
        out.extraLines.push({ ...ln, source: src });
      }
    }
  }
  return out;
};
