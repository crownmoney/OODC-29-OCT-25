import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Clock, XCircle, Pencil, Undo2, Landmark, Crown, CalendarClock, Wallet, Info } from 'lucide-react';
import { AppState, DnqOverride } from '../types';
import { assessDnq, DnqVerdict, VERDICT_LABELS, VERDICT_SHORT, fmtYears, ScenarioResult } from '../services/dnq';

interface Props {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  calculations: any;
}

const money = (v: number) =>
  isFinite(v) ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(v) : '—';
const fmtDate = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10).split('-').reverse().join('/') : iso || '—');

const VERDICT_STYLE: Record<DnqVerdict, { bg: string; border: string; text: string; chip: string; icon: React.ElementType }> = {
  qualifies: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', chip: 'bg-emerald-600', icon: CheckCircle2 },
  qualifies_future: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', chip: 'bg-amber-500', icon: Clock },
  dnq: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800', chip: 'bg-rose-600', icon: XCircle },
};

const VerdictChip: React.FC<{ verdict: DnqVerdict; small?: boolean }> = ({ verdict, small }) => {
  const s = VERDICT_STYLE[verdict];
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full ${s.chip} text-white font-bold ${small ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'}`}>
      <Icon className={small ? 'h-3.5 w-3.5' : 'h-4 w-4'} /> {VERDICT_SHORT[verdict]}
    </span>
  );
};

const ScenarioCard: React.FC<{ title: string; subtitle: string; s: ScenarioResult; bankTerm: number; bankInterest: number; age: number | null }> = ({ title, subtitle, s, bankTerm, bankInterest, age }) => (
  <div className={`rounded-2xl border p-5 ${s.better ? 'border-emerald-200 bg-emerald-50/50' : 'border-rose-200 bg-rose-50/50'}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <h4 className="font-bold text-[var(--text-color)]">{title}</h4>
        <p className="text-xs text-[var(--text-color-muted)]">{subtitle}</p>
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold text-white ${s.better ? 'bg-emerald-600' : 'bg-rose-600'}`}>
        {s.better ? 'Crown better' : 'Bank better'}
      </span>
    </div>
    <table className="mt-4 w-full text-sm">
      <thead>
        <tr className="text-xs uppercase tracking-wider text-[var(--text-color-muted)]">
          <th className="text-left font-semibold pb-1"></th>
          <th className="text-right font-semibold pb-1"><span className="inline-flex items-center gap-1"><Landmark className="h-3.5 w-3.5" />Bank</span></th>
          <th className="text-right font-semibold pb-1"><span className="inline-flex items-center gap-1"><Crown className="h-3.5 w-3.5" />Crown</span></th>
        </tr>
      </thead>
      <tbody className="text-[var(--text-color)]">
        <tr className="border-t border-[var(--border-color)]">
          <td className="py-1.5">Debt-free in</td>
          <td className="py-1.5 text-right">{fmtYears(bankTerm)}</td>
          <td className="py-1.5 text-right font-bold">{fmtYears(s.term)}</td>
        </tr>
        {age !== null && (
          <tr className="border-t border-[var(--border-color)]">
            <td className="py-1.5">Debt-free at age</td>
            <td className="py-1.5 text-right">{isFinite(bankTerm) ? Math.round(age + bankTerm) : '—'}</td>
            <td className="py-1.5 text-right font-bold">{isFinite(s.term) ? Math.round(age + s.term) : '—'}</td>
          </tr>
        )}
        <tr className="border-t border-[var(--border-color)]">
          <td className="py-1.5">Total interest</td>
          <td className="py-1.5 text-right">{money(bankInterest)}</td>
          <td className="py-1.5 text-right font-bold">{money(s.interest)}</td>
        </tr>
      </tbody>
    </table>
    <div className="mt-3 grid grid-cols-2 gap-2 text-center">
      <div className="rounded-xl bg-white border border-[var(--border-color)] py-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-color-muted)]">Time saved</p>
        <p className={`font-black ${s.yearsSaved > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{isFinite(s.yearsSaved) ? fmtYears(s.yearsSaved) : s.yearsSaved > 0 ? 'Bank never' : 'None'}</p>
      </div>
      <div className="rounded-xl bg-white border border-[var(--border-color)] py-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-color-muted)]">Interest saved</p>
        <p className={`font-black ${s.interestSaved > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{isFinite(s.interestSaved) ? money(s.interestSaved) : s.interestSaved > 0 ? 'All' : 'None'}</p>
      </div>
    </div>
  </div>
);

const Tab_DNQ: React.FC<Props> = ({ appState, setAppState, calculations }) => {
  const a = useMemo(() => assessDnq(appState, calculations), [appState, calculations]);
  const override = appState.dnqOverride;
  const finalVerdict: DnqVerdict = override?.verdict ?? a.verdict;
  const style = VERDICT_STYLE[finalVerdict];
  const BigIcon = style.icon;
  const n = a.numbers;

  const [editing, setEditing] = useState(false);
  const [draftVerdict, setDraftVerdict] = useState<DnqVerdict>(override?.verdict ?? a.verdict);
  const [draftReason, setDraftReason] = useState(override?.reason ?? '');
  const [draftBy, setDraftBy] = useState(override?.by ?? '');
  const reasonOk = draftReason.trim().length >= 10;
  const changed = draftVerdict !== a.verdict;

  const saveOverride = () => {
    if (!changed) { setAppState(s => ({ ...s, dnqOverride: undefined })); setEditing(false); return; }
    if (!reasonOk) return;
    const o: DnqOverride = { verdict: draftVerdict, reason: draftReason.trim(), by: draftBy.trim() || undefined, at: new Date().toISOString() };
    setAppState(s => ({ ...s, dnqOverride: o }));
    setEditing(false);
  };
  const clearOverride = () => {
    setAppState(s => ({ ...s, dnqOverride: undefined }));
    setDraftVerdict(a.verdict); setDraftReason(''); setEditing(false);
  };

  return (
    <div className="space-y-6">
      {/* Verdict banner */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl border-2 ${style.border} ${style.bg} p-6`}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <BigIcon className={`h-14 w-14 shrink-0 ${style.text}`} strokeWidth={1.75} />
          <div className="flex-1">
            <p className={`text-xs font-bold uppercase tracking-[0.2em] ${style.text}`}>DNQ assessment</p>
            <h2 className={`text-2xl sm:text-3xl font-black ${style.text}`}>{VERDICT_LABELS[finalVerdict]}</h2>
            {override && (
              <p className="mt-1 text-sm text-[var(--text-color)]">
                Changed by consultant{override.by ? ` (${override.by})` : ''} on {new Date(override.at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}. Calculated verdict: <VerdictChip verdict={a.verdict} small />
              </p>
            )}
          </div>
          {!editing && (
            <button onClick={() => { setDraftVerdict(override?.verdict ?? a.verdict); setDraftReason(override?.reason ?? ''); setDraftBy(override?.by ?? ''); setEditing(true); }}
              className="inline-flex items-center gap-2 self-start rounded-xl border border-[var(--border-color)] bg-white px-4 py-2 text-sm font-bold text-[var(--title-color)] hover:shadow-md transition-shadow print:hidden">
              <Pencil className="h-4 w-4" /> {override ? 'Edit verdict' : 'Change verdict'}
            </button>
          )}
        </div>
        <ul className="mt-4 space-y-1.5 text-sm text-[var(--text-color)]">
          {a.reasons.map((r, i) => <li key={i} className="flex gap-2"><span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${style.chip}`} />{r}</li>)}
        </ul>
      </motion.section>

      {/* Original vs edited */}
      {(override || editing) && (
        <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg-color)] p-5 shadow-sm print:break-inside-avoid">
          <h3 className="font-bold text-[var(--text-color)]">Verdict history</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--border-color)] p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-color-muted)]">Original (calculated)</p>
              <div className="mt-2"><VerdictChip verdict={a.verdict} /></div>
              <p className="mt-2 text-xs text-[var(--text-color-muted)]">Worked out automatically from the numbers on the other tabs. Updates if the numbers change.</p>
            </div>
            <div className="rounded-xl border-2 border-[var(--title-color)]/30 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--title-color)]">Consultant's verdict</p>
              {editing ? (
                <div className="mt-2 space-y-3 print:hidden">
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Consultant's verdict">
                    {(['qualifies', 'qualifies_future', 'dnq'] as DnqVerdict[]).map(v => (
                      <button key={v} role="radio" aria-checked={draftVerdict === v} onClick={() => setDraftVerdict(v)}
                        className={`rounded-full px-3 py-1 text-sm font-bold border transition-all ${draftVerdict === v ? `${VERDICT_STYLE[v].chip} text-white border-transparent` : 'border-[var(--border-color)] text-[var(--text-color)] hover:border-[var(--title-color)]'}`}>
                        {VERDICT_SHORT[v]}
                      </button>
                    ))}
                  </div>
                  {changed && (
                    <>
                      <div>
                        <label htmlFor="dnq-reason" className="block text-xs font-semibold text-[var(--text-color-muted)] mb-1">Reason for changing the verdict <span className="text-rose-600">*</span></label>
                        <textarea id="dnq-reason" value={draftReason} onChange={e => setDraftReason(e.target.value)} rows={3}
                          className={`w-full rounded-xl border p-2.5 text-sm bg-[var(--input-bg-color)] text-[var(--text-color)] focus:outline-none focus:ring-2 focus:ring-[var(--input-border-focus-color)] ${reasonOk || !draftReason ? 'border-[var(--input-border-color)]' : 'border-rose-400'}`}
                          placeholder="e.g. Client confirmed a pay rise starting next month that isn't entered yet" />
                        {!reasonOk && <p className="mt-1 text-[11px] font-semibold text-rose-600">A reason is required (at least 10 characters).</p>}
                      </div>
                      <div>
                        <label htmlFor="dnq-by" className="block text-xs font-semibold text-[var(--text-color-muted)] mb-1">Your name (optional)</label>
                        <input id="dnq-by" value={draftBy} onChange={e => setDraftBy(e.target.value)}
                          className="w-full rounded-xl border border-[var(--input-border-color)] p-2.5 text-sm bg-[var(--input-bg-color)] text-[var(--text-color)] focus:outline-none focus:ring-2 focus:ring-[var(--input-border-focus-color)]" />
                      </div>
                    </>
                  )}
                  {!changed && <p className="text-xs text-[var(--text-color-muted)]">Same as the calculated verdict. Saving will remove any override.</p>}
                  <div className="flex gap-2">
                    <button onClick={saveOverride} disabled={changed && !reasonOk}
                      className="rounded-xl bg-[var(--title-color)] px-4 py-2 text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed">Save</button>
                    <button onClick={() => setEditing(false)} className="rounded-xl border border-[var(--border-color)] px-4 py-2 text-sm font-bold text-[var(--text-color)]">Cancel</button>
                  </div>
                </div>
              ) : override ? (
                <>
                  <div className="mt-2"><VerdictChip verdict={override.verdict} /></div>
                  <p className="mt-2 text-sm text-[var(--text-color)]"><strong>Reason:</strong> {override.reason}</p>
                  <button onClick={clearOverride} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[var(--title-color)] hover:opacity-80 print:hidden">
                    <Undo2 className="h-3.5 w-3.5" /> Go back to the calculated verdict
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </section>
      )}

      {/* Scenarios */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ScenarioCard title="Today" subtitle="Current income and expenses only" s={a.today} bankTerm={n.bankTerm} bankInterest={n.bankInterest} age={n.youngestAge} />
        <ScenarioCard title="With planned changes"
          subtitle={a.hasPlannedChanges ? 'Includes planned budget changes and one-off events' : 'No planned changes entered (same as today)'}
          s={a.withChanges} bankTerm={n.bankTerm} bankInterest={n.bankInterest} age={n.youngestAge} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Budget */}
        <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg-color)] p-5 shadow-sm">
          <h3 className="flex items-center gap-2 font-bold text-[var(--text-color)]"><Wallet className="h-5 w-5 text-[var(--title-color)]" />Monthly budget today</h3>
          <table className="mt-3 w-full text-sm text-[var(--text-color)]">
            <tbody>
              {[
                ['Household income (after tax)', n.monthlyIncome],
                ['Living expenses', -n.monthlyLivingExpenses],
                ['Home loan repayment', -n.monthlyHomeLoanRepayment],
              ].map(([l, v]) => (
                <tr key={l as string} className="border-t border-[var(--border-color)]"><td className="py-1.5">{l}</td><td className="py-1.5 text-right">{money(v as number)}</td></tr>
              ))}
              <tr className="border-t-2 border-[var(--border-color)] font-bold">
                <td className="py-2">Spare money each month</td>
                <td className={`py-2 text-right ${n.monthlySurplus > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{money(n.monthlySurplus)}</td>
              </tr>
            </tbody>
          </table>
          <table className="mt-4 w-full text-sm text-[var(--text-color)]">
            <tbody>
              <tr className="border-t border-[var(--border-color)]"><td className="py-1.5">Home loan</td><td className="py-1.5 text-right">{money(n.homeLoanAmount)}{n.offsetBalance ? ` (offset ${money(n.offsetBalance)})` : ''}</td></tr>
              <tr className="border-t border-[var(--border-color)]"><td className="py-1.5">Other debts consolidated</td><td className="py-1.5 text-right">{money(n.otherDebtsTotal)}</td></tr>
              <tr className="border-t border-[var(--border-color)]"><td className="py-1.5">Bank rate / Crown rate</td><td className="py-1.5 text-right">{n.bankRate}% / {n.crownRate}%</td></tr>
              <tr className="border-t border-[var(--border-color)]"><td className="py-1.5">Bank interest (home loan + other debts)</td><td className="py-1.5 text-right">{money(n.bankHomeInterest)} + {money(n.otherDebtsInterest)}</td></tr>
            </tbody>
          </table>
        </section>

        {/* Planned changes */}
        <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg-color)] p-5 shadow-sm">
          <h3 className="flex items-center gap-2 font-bold text-[var(--text-color)]"><CalendarClock className="h-5 w-5 text-[var(--title-color)]" />Planned changes</h3>
          {a.plannedChanges.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--text-color-muted)]">
              None entered. If income is going up or expenses are coming down (e.g. a pay rise, childcare or a car lease ending), add it under <strong>Income &amp; Expenses › Plan for Future Budget Changes</strong> and this assessment updates.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--border-color)] text-sm">
              {a.plannedChanges.map((c, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <p className="font-semibold text-[var(--text-color)]">{c.description}</p>
                    <p className="text-xs text-[var(--text-color-muted)]">{c.kind === 'lump' ? 'One-off' : 'From'} {fmtDate(c.startDate)}</p>
                  </div>
                  <span className={`font-bold ${c.monthlyEffect >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {c.monthlyEffect >= 0 ? '+' : '−'}{money(Math.abs(c.monthlyEffect))}{c.kind === 'change' ? '/mth' : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="flex gap-2 text-xs text-[var(--text-color-muted)]">
        <Info className="h-4 w-4 shrink-0" />
        "Better off with Crown Money" means Crown pays the debt off sooner and costs less total interest than staying with the bank (home loan plus other debts on their current terms). Fees are not included. The verdict and any change to it are added as a note on the client's HubSpot deal when the record is uploaded.
      </p>
    </div>
  );
};

export default Tab_DNQ;
