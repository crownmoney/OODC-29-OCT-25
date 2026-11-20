import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CloudDownload, X, Loader2, AlertTriangle, Check, Info } from 'lucide-react';
import { AppState } from '../types';
import { applyImport, buildImportItems, HubSpotFetchResult, ImportItem } from '../services/hubspotImport';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  onImported: (count: number) => void;
}

const GROUPS: ImportItem['group'][] = ['Client', 'Current loan', 'Income', 'Expenses', 'For reference'];

const HubSpotImport: React.FC<Props> = ({ isOpen, onClose, appState, setAppState, onImported }) => {
  const [email, setEmail] = useState(appState.clientEmail || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<HubSpotFetchResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const items = useMemo(() => (result ? buildImportItems(result) : []), [result]);
  const importable = items.filter(i => i.apply);

  const fetchData = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await fetch('/api/hubspot-fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HubSpot lookup failed (${res.status})`);
      const r = data as HubSpotFetchResult;
      setResult(r);
      setSelected(new Set(buildImportItems(r).filter(i => i.apply).map(i => i.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'HubSpot lookup failed.');
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const doImport = () => {
    const count = importable.filter(i => selected.has(i.id)).length;
    setAppState(s => applyImport(s, items, selected));
    onImported(count);
    onClose();
    setResult(null);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 print:hidden"
        role="dialog" aria-modal="true" aria-labelledby="hs-import-title">
        <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-[var(--card-bg-color)] shadow-2xl">
          <header className="flex items-center justify-between border-b border-[var(--border-color)] px-6 py-4">
            <h2 id="hs-import-title" className="flex items-center gap-2 text-lg font-black text-[var(--text-color)]">
              <CloudDownload className="h-5 w-5 text-[var(--title-color)]" /> Fetch from HubSpot
            </h2>
            <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 hover:bg-[var(--input-bg-color)]"><X className="h-5 w-5" /></button>
          </header>

          <form onSubmit={fetchData} className="flex flex-col gap-2 border-b border-[var(--border-color)] px-6 py-4 sm:flex-row">
            <label htmlFor="hs-email" className="sr-only">Client email</label>
            <input id="hs-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Client email address" autoFocus
              className="flex-1 rounded-xl border border-[var(--input-border-color)] bg-[var(--input-bg-color)] px-4 py-2.5 text-[var(--text-color)] focus:outline-none focus:ring-2 focus:ring-[var(--input-border-focus-color)]" />
            <button type="submit" disabled={loading || !email.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--title-color)] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
              {loading ? 'Fetching…' : 'Fetch'}
            </button>
          </form>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {error && <p className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800" role="alert"><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />{error}</p>}
            {!result && !error && !loading && (
              <p className="text-sm text-[var(--text-color-muted)]">
                Enter the client's email to load their details from HubSpot (contact and newest open deal). You'll see everything before it's added to the calculator.
              </p>
            )}
            {result && (
              <>
                <p className="mb-3 text-sm text-[var(--text-color-muted)]">
                  {result.deal ? <>Deal: <strong className="text-[var(--text-color)]">{result.deal.name || result.deal.id}</strong>. </> : 'No deal found, so only contact details are available. '}
                  Untick anything you don't want to import. Imported values replace what's in the calculator, and sample figures (or a previous client's imported figures) are cleared.
                </p>
                {importable.length === 0 && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">No calculator fields are filled in on this client's HubSpot deal yet.</p>}
                {GROUPS.map(g => {
                  const rows = items.filter(i => i.group === g);
                  if (!rows.length) return null;
                  const ref = g === 'For reference';
                  return (
                    <section key={g} className="mb-4">
                      <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-[var(--title-color)]">{g}{ref && <span className="ml-2 normal-case font-normal text-[var(--text-color-muted)]">(not imported)</span>}</h3>
                      <ul className="divide-y divide-[var(--border-color)] rounded-xl border border-[var(--border-color)]">
                        {rows.map(it => (
                          <li key={it.id} className="flex items-start gap-3 px-3 py-2">
                            {ref ? <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-color-muted)]" /> : (
                              <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggle(it.id)} className="mt-1 h-4 w-4 shrink-0 accent-[var(--title-color)]" aria-label={`Import ${it.label}`} />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                                <span className="text-sm font-semibold text-[var(--text-color)]">{it.label}</span>
                                <span className="text-sm font-bold text-[var(--text-color)]">{it.value}</span>
                              </div>
                              <p className="text-[11px] text-[var(--text-color-muted)]">From {it.source}</p>
                              {it.note && <p className="mt-0.5 flex items-start gap-1 text-[11px] font-semibold text-amber-700"><AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />{it.note}</p>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </>
            )}
          </div>

          {result && importable.length > 0 && (
            <footer className="flex items-center justify-between gap-3 border-t border-[var(--border-color)] px-6 py-4">
              <span className="text-sm text-[var(--text-color-muted)]">{importable.filter(i => selected.has(i.id)).length} of {importable.length} selected</span>
              <button onClick={doImport} disabled={!importable.some(i => selected.has(i.id))}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--title-color)] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                <Check className="h-4 w-4" /> Import into calculator
              </button>
            </footer>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default HubSpotImport;
