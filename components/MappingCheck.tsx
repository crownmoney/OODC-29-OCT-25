import React, { useMemo, useState } from 'react';
import { X, Network, Copy, Check } from 'lucide-react';
import { AppState } from '../types';
import { buildMapRows } from '../services/hubspotMap';

// "Check mapping": every calculator field, its current value and the HubSpot
// deal property it's fetched from / uploaded to, so the team can spot gaps.
const MappingCheck: React.FC<{ isOpen: boolean; onClose: () => void; appState: AppState }> = ({ isOpen, onClose, appState }) => {
  const [filter, setFilter] = useState<'all' | 'mapped' | 'unmapped'>('all');
  const [copied, setCopied] = useState(false);
  const rows = useMemo(() => (isOpen ? buildMapRows(appState) : []), [isOpen, appState]);
  if (!isOpen) return null;
  const shown = rows.filter(r => filter === 'all' || (filter === 'mapped') === !!r.props);
  const unmapped = rows.filter(r => !r.props).length;
  const copy = () => {
    const text = ['Section\tField\tValue\tHubSpot property\tNote', ...rows.map(r => [r.section, r.label, r.value, r.props ? [r.props.amount, r.props.freq].filter(Boolean).join(' + ') : 'NOT MAPPED', r.note ?? ''].join('\t'))].join('\n');
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm print:hidden" role="dialog" aria-modal="true" aria-labelledby="map-title">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-[var(--card-bg-color)] shadow-2xl">
        <header className="flex items-center justify-between border-b border-[var(--border-color)] px-6 py-4">
          <div>
            <h2 id="map-title" className="flex items-center gap-2 text-lg font-black text-[var(--text-color)]"><Network className="h-5 w-5 text-sky-600" /> Check mapping</h2>
            <p className="text-xs text-[var(--text-color-muted)]">Each field is fetched from, and on Upload Record written to, the HubSpot <strong>deal</strong> property shown. Everything also goes into the all-fields note on the deal.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 hover:bg-[var(--input-bg-color)]"><X className="h-5 w-5" /></button>
        </header>
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-color)] px-6 py-3">
          {(['all', 'mapped', 'unmapped'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-bold ${filter === f ? 'bg-sky-600 text-white' : 'bg-[var(--input-bg-color)] text-[var(--text-color)]'}`}>
              {f === 'all' ? `All (${rows.length})` : f === 'mapped' ? `Mapped (${rows.length - unmapped})` : `No HubSpot property (${unmapped})`}
            </button>
          ))}
          <button onClick={copy} className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[var(--border-color)] px-3 py-1 text-xs font-bold text-[var(--text-color)]">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy list (to send for fixing)'}
          </button>
        </div>
        <div className="flex-1 overflow-auto px-6 py-3">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-[var(--card-bg-color)] text-[10px] uppercase tracking-wider text-[var(--text-color-muted)]">
              <tr><th className="py-2 pr-3">Section</th><th className="py-2 pr-3">Field</th><th className="py-2 pr-3">Value now</th><th className="py-2 pr-3">HubSpot deal property</th><th className="py-2">Uploads as</th></tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {shown.map(r => (
                <tr key={r.key} className="align-top">
                  <td className="py-2 pr-3 text-xs text-[var(--text-color-muted)]">{r.section}</td>
                  <td className="py-2 pr-3 font-semibold text-[var(--text-color)]">{r.label}</td>
                  <td className="py-2 pr-3 text-[var(--text-color)]">{r.value}</td>
                  <td className="py-2 pr-3">
                    {r.props ? <code className="font-mono text-xs text-sky-700">{r.props.amount}{r.props.freq ? <><br />{r.props.freq}</> : null}</code>
                      : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">No property</span>}
                    {r.note && <p className="mt-1 text-[11px] text-[var(--text-color-muted)]">{r.note}</p>}
                  </td>
                  <td className="py-2 font-mono text-[11px] text-[var(--text-color)]">
                    {Object.keys(r.write).length ? Object.entries(r.write).map(([k, v]) => <div key={k}>{k} = {v}</div>) : <span className="font-sans text-[var(--text-color-muted)]">{r.props ? 'not sent (no value)' : 'scenario info + note'}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MappingCheck;
