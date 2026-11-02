import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeftRight, Landmark, Home, Info } from 'lucide-react';
import { Frequency } from '../../types';

// ---------------------------------------------------------------------------
// Australian resident tax, 2026–27 income year (1 July 2026 – 30 June 2027).
// Rates per the legislated Stage 3 schedule with the 15% bracket from
// 1 July 2026. Medicare levy 2% with the low-income phase-in (singles).
// Low Income Tax Offset (LITO) included. Excludes HELP/HECS repayments,
// Medicare levy surcharge, family thresholds and other offsets.
// ---------------------------------------------------------------------------
export const TAX_YEAR_LABEL = '2026–27';
const BRACKETS = [
  { from: 0, to: 18_200, rate: 0 },
  { from: 18_200, to: 45_000, rate: 0.15 },
  { from: 45_000, to: 135_000, rate: 0.30 },
  { from: 135_000, to: 190_000, rate: 0.37 },
  { from: 190_000, to: Infinity, rate: 0.45 },
];
const MEDICARE_RATE = 0.02;
const MEDICARE_LOWER = 27_222; // single low-income threshold (approx.)
const MEDICARE_UPPER = 34_027; // phase-in ends
const SUPER_GUARANTEE = 0.12;

const incomeTax = (taxable: number) =>
  BRACKETS.reduce((tax, b) => tax + Math.max(0, Math.min(taxable, b.to) - b.from) * b.rate, 0);

const lito = (taxable: number) => {
  if (taxable <= 37_500) return 700;
  if (taxable <= 45_000) return 700 - (taxable - 37_500) * 0.05;
  if (taxable <= 66_667) return 325 - (taxable - 45_000) * 0.015;
  return 0;
};

const medicare = (taxable: number) => {
  if (taxable <= MEDICARE_LOWER) return 0;
  if (taxable <= MEDICARE_UPPER) return (taxable - MEDICARE_LOWER) * 0.1;
  return taxable * MEDICARE_RATE;
};

export const takeHome = (grossAnnual: number) => {
  const gross = Math.max(0, grossAnnual);
  const tax = Math.max(0, incomeTax(gross) - lito(gross));
  const levy = medicare(gross);
  const net = gross - tax - levy;
  const marginal = BRACKETS.find(b => gross > b.from && gross <= b.to)?.rate ?? 0;
  return { gross, tax, levy, net, marginal, average: gross ? (tax + levy) / gross : 0 };
};

// Net -> gross by bisection (take-home is monotonic in gross).
const grossFromNet = (netAnnual: number) => {
  let lo = 0, hi = Math.max(1_000, netAnnual * 2.5);
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (takeHome(mid).net < netAnnual) lo = mid; else hi = mid;
  }
  return hi;
};

// ---------------------------------------------------------------------------
const PER_YEAR: Record<Frequency, number> = { weekly: 52, fortnightly: 26, monthly: 12, quarterly: 4, annually: 1 };
const FREQ_LABEL: Record<Frequency, string> = { weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly', quarterly: 'Quarterly', annually: 'Annually' };
const money = (v: number, dp = 0) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: dp, maximumFractionDigits: dp }).format(isFinite(v) ? v : 0);
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

const input = "w-full bg-[var(--input-bg-color)] p-2.5 rounded-xl border border-[var(--input-border-color)] focus:outline-none focus:ring-2 focus:ring-[var(--input-border-focus-color)] text-[var(--text-color)] font-semibold";
const select = `custom-select ${input}`;

const MoneyInput: React.FC<{ value: number; onChange: (v: number) => void; label: string; id: string }> = ({ value, onChange, label, id }) => (
  <div>
    <label htmlFor={id} className="block text-xs font-semibold text-[var(--text-color-muted)] mb-1">{label}</label>
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--text-color-muted)]">$</span>
      <input id={id} type="number" min="0" inputMode="decimal" value={value || ''} onChange={e => onChange(Math.max(0, parseFloat(e.target.value) || 0))} className={`${input} pl-7`} placeholder="0" />
    </div>
  </div>
);

const FreqSelect: React.FC<{ value: Frequency; onChange: (f: Frequency) => void; id: string; label?: string; omit?: Frequency[] }> = ({ value, onChange, id, label = 'Frequency', omit = [] }) => (
  <div>
    <label htmlFor={id} className="block text-xs font-semibold text-[var(--text-color-muted)] mb-1">{label}</label>
    <select id={id} value={value} onChange={e => onChange(e.target.value as Frequency)} className={select}>
      {(Object.keys(PER_YEAR) as Frequency[]).filter(f => !omit.includes(f)).map(f => <option key={f} value={f}>{FREQ_LABEL[f]}</option>)}
    </select>
  </div>
);

const ResultTile: React.FC<{ label: string; value: string; highlight?: boolean; sub?: string }> = ({ label, value, highlight, sub }) => (
  <div className={`rounded-xl p-3 ${highlight ? 'bg-gradient-to-br from-[#3B1470] to-[#5B21B6] text-white shadow-md' : 'bg-[var(--input-bg-color)] border border-[var(--border-color)]'}`}>
    <p className={`text-[11px] font-semibold uppercase tracking-wider ${highlight ? 'text-white/70' : 'text-[var(--text-color-muted)]'}`}>{label}</p>
    <p className={`text-lg font-black ${highlight ? '' : 'text-[var(--text-color)]'}`}>{value}</p>
    {sub && <p className={`text-[11px] ${highlight ? 'text-white/70' : 'text-[var(--text-color-muted)]'}`}>{sub}</p>}
  </div>
);

// --- 1. Pay converter ------------------------------------------------------
const PayConverter = () => {
  const [amount, setAmount] = useState(1500);
  const [freq, setFreq] = useState<Frequency>('weekly');
  const annual = amount * PER_YEAR[freq];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <MoneyInput id="pc-amount" label="Amount" value={amount} onChange={setAmount} />
        <FreqSelect id="pc-freq" value={freq} onChange={setFreq} label="Paid" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {(Object.keys(PER_YEAR) as Frequency[]).map(f => (
          <ResultTile key={f} label={FREQ_LABEL[f]} value={money(annual / PER_YEAR[f], 2)} highlight={f === freq} />
        ))}
      </div>
      <p className="text-[11px] text-[var(--text-color-muted)]">Based on 52 weeks, 26 fortnights and 12 months a year.</p>
    </div>
  );
};

// --- 2. Take-home pay ------------------------------------------------------
const TakeHomePay = () => {
  const [direction, setDirection] = useState<'gross' | 'net'>('gross');
  const [amount, setAmount] = useState(95_000);
  const [freq, setFreq] = useState<Frequency>('annually');
  const [out, setOut] = useState<Frequency>('weekly');

  const r = useMemo(() => {
    const annual = amount * PER_YEAR[freq];
    return takeHome(direction === 'gross' ? annual : grossFromNet(annual));
  }, [amount, freq, direction]);
  const per = (v: number) => v / PER_YEAR[out];
  const superAmt = r.gross * SUPER_GUARANTEE;
  const netShare = r.gross ? r.net / r.gross : 0;

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-xl bg-[var(--input-bg-color)] p-1 border border-[var(--border-color)]" role="tablist" aria-label="Calculate from">
        {([['gross', 'From salary (before tax)'], ['net', 'From take-home pay']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={direction === k} onClick={() => setDirection(k)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${direction === k ? 'bg-[var(--title-color)] text-white shadow' : 'text-[var(--text-color-muted)] hover:text-[var(--text-color)]'}`}>
            {l}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MoneyInput id="th-amount" label={direction === 'gross' ? 'Salary before tax' : 'Take-home pay'} value={amount} onChange={setAmount} />
        <FreqSelect id="th-freq" value={freq} onChange={setFreq} label="Per" omit={['quarterly']} />
        <FreqSelect id="th-out" value={out} onChange={setOut} label="Show results" omit={['quarterly']} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <ResultTile label="Take-home pay" value={money(per(r.net), 2)} highlight sub={FREQ_LABEL[out].toLowerCase()} />
        <ResultTile label="Salary before tax" value={money(per(r.gross), 2)} />
        <ResultTile label="Income tax" value={money(per(r.tax), 2)} />
        <ResultTile label="Medicare levy" value={money(per(r.levy), 2)} />
      </div>

      <div aria-hidden="true">
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--input-bg-color)]">
          <motion.div className="h-full bg-emerald-500" initial={false} animate={{ width: `${netShare * 100}%` }} transition={{ duration: 0.5 }} />
          <motion.div className="h-full bg-[var(--title-color)]" initial={false} animate={{ width: `${r.gross ? (r.tax / r.gross) * 100 : 0}%` }} transition={{ duration: 0.5 }} />
          <motion.div className="h-full bg-amber-400" initial={false} animate={{ width: `${r.gross ? (r.levy / r.gross) * 100 : 0}%` }} transition={{ duration: 0.5 }} />
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-color-muted)]">
          <span><span className="inline-block h-2 w-2 rounded-full bg-emerald-500 mr-1" />Take-home {pct(netShare)}</span>
          <span><span className="inline-block h-2 w-2 rounded-full bg-[var(--title-color)] mr-1" />Tax</span>
          <span><span className="inline-block h-2 w-2 rounded-full bg-amber-400 mr-1" />Medicare</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <ResultTile label="Marginal rate" value={pct(r.marginal)} />
        <ResultTile label="Average rate" value={pct(r.average)} />
        <ResultTile label="Employer super (12%)" value={money(per(superAmt), 2)} sub="paid on top" />
      </div>

      <details className="group text-xs text-[var(--text-color-muted)]">
        <summary className="cursor-pointer list-none flex items-center gap-1 font-semibold text-[var(--title-color)]">
          <span className="transition-transform group-open:rotate-90">›</span> {TAX_YEAR_LABEL} tax rates used
        </summary>
        <table className="mt-2 w-full">
          <tbody>
            {BRACKETS.map(b => (
              <tr key={b.from} className="border-t border-[var(--border-color)]">
                <td className="py-1">{money(b.from + (b.from ? 1 : 0))} – {isFinite(b.to) ? money(b.to) : 'and over'}</td>
                <td className="py-1 text-right font-semibold">{b.rate ? `${b.rate * 100}%` : 'Nil'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 flex gap-1"><Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />Australian resident estimate incl. 2% Medicare levy and the low income tax offset. Excludes HELP/HECS repayments, Medicare levy surcharge and other offsets or deductions.</p>
      </details>
    </div>
  );
};

// --- 3. Loan repayments ----------------------------------------------------
const LoanRepayments = () => {
  const [amount, setAmount] = useState(600_000);
  const [rate, setRate] = useState(6.0);
  const [years, setYears] = useState(30);
  const [freq, setFreq] = useState<Frequency>('monthly');

  const r = useMemo(() => {
    const n = PER_YEAR[freq];
    const i = rate / 100 / n;
    const periods = years * n;
    const payment = i === 0 ? amount / periods : (amount * i) / (1 - Math.pow(1 + i, -periods));
    const total = payment * periods;
    return { payment, total, interest: total - amount, interestOnly: amount * i };
  }, [amount, rate, years, freq]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MoneyInput id="lr-amount" label="Loan amount" value={amount} onChange={setAmount} />
        <div>
          <label htmlFor="lr-rate" className="block text-xs font-semibold text-[var(--text-color-muted)] mb-1">Interest rate %</label>
          <input id="lr-rate" type="number" step="0.01" min="0" value={rate || ''} onChange={e => setRate(Math.max(0, parseFloat(e.target.value) || 0))} className={input} />
        </div>
        <div>
          <label htmlFor="lr-years" className="block text-xs font-semibold text-[var(--text-color-muted)] mb-1">Term (years)</label>
          <input id="lr-years" type="number" min="1" max="40" value={years || ''} onChange={e => setYears(Math.min(40, Math.max(1, parseInt(e.target.value, 10) || 1)))} className={input} />
        </div>
        <FreqSelect id="lr-freq" value={freq} onChange={setFreq} label="Repayments" omit={['quarterly', 'annually']} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <ResultTile label="Repayment (P&I)" value={money(r.payment, 2)} highlight sub={FREQ_LABEL[freq].toLowerCase()} />
        <ResultTile label="Interest only" value={money(r.interestOnly, 2)} sub={FREQ_LABEL[freq].toLowerCase()} />
        <ResultTile label="Total interest" value={money(r.interest)} sub={`over ${years} years`} />
        <ResultTile label="Total repaid" value={money(r.total)} />
      </div>
      <p className="text-[11px] text-[var(--text-color-muted)]">Standard bank loan with a fixed rate for the whole term. Fees, offset and extra repayments not included.</p>
    </div>
  );
};

// ---------------------------------------------------------------------------
const TOOLS = [
  { id: 'pay', label: 'Pay converter', icon: ArrowLeftRight, component: <PayConverter /> },
  { id: 'tax', label: 'Take-home pay', icon: Landmark, component: <TakeHomePay /> },
  { id: 'loan', label: 'Loan repayments', icon: Home, component: <LoanRepayments /> },
] as const;

const AdvancedCalculator = () => {
  const [tool, setTool] = useState<(typeof TOOLS)[number]['id']>('tax');
  const active = TOOLS.find(t => t.id === tool)!;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Calculators">
        {TOOLS.map(({ id, label, icon: Icon }) => (
          <button key={id} role="tab" aria-selected={tool === id} onClick={() => setTool(id)}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs sm:text-sm font-bold transition-all border ${tool === id ? 'bg-[var(--title-color)] text-white border-transparent shadow-md' : 'bg-[var(--input-bg-color)] text-[var(--text-color)] border-[var(--border-color)] hover:border-[var(--title-color)]'}`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={tool} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
          {active.component}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default AdvancedCalculator;
