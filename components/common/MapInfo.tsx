import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import { PropPair } from '../../services/hubspotMap';

/**
 * (i) button showing which HubSpot deal property a field is fetched from and
 * uploaded to. `props` null = the field has no property of its own.
 */
const MapInfo: React.FC<{ props: PropPair | null | undefined; label?: string; className?: string }> = ({ props, label, className = '' }) => {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const open = pos !== null;
  const ref = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLSpanElement>(null);
  const place = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left - 8, window.innerWidth - 300)) });
  };
  const toggle = () => (open ? setPos(null) : place());
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (ref.current?.contains(e.target as Node) || popRef.current?.contains(e.target as Node)) return;
      setPos(null);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setPos(null);
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); document.removeEventListener('keydown', esc); };
  }, [open]);
  const mapped = !!props;
  return (
    <span ref={ref} className={`${/\babsolute\b/.test(className) ? '' : 'relative '}inline-flex print:hidden ${className}`}>
      <button type="button" onClick={toggle} aria-expanded={open}
        aria-label={`HubSpot mapping${label ? ` for ${label}` : ''}`}
        className={`rounded-full p-0.5 transition-colors ${mapped ? 'text-sky-600 hover:bg-sky-50' : 'text-slate-400 hover:bg-slate-100'}`}>
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && createPortal(
        <span ref={popRef} role="dialog" style={{ top: pos!.top, left: pos!.left }} className="fixed z-[200] w-72 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg-color)] p-3 text-left text-xs font-normal normal-case tracking-normal text-[var(--text-color)] shadow-xl">
          <span className="mb-1 block font-bold">{label ? `${label} ↔ HubSpot` : 'HubSpot mapping'}</span>
          {mapped ? (
            <>
              <span className="block text-[var(--text-color-muted)]">Deal property (fetched from and uploaded to):</span>
              <code className="mt-1 block rounded bg-[var(--input-bg-color)] px-1.5 py-1 font-mono text-[11px]">{props!.amount}</code>
              {props!.freq
                ? <code className="mt-1 block rounded bg-[var(--input-bg-color)] px-1.5 py-1 font-mono text-[11px]">{props!.freq} <span className="font-sans text-[var(--text-color-muted)]">(frequency)</span></code>
                : props!.unit && <span className="mt-1 block text-[var(--text-color-muted)]">No frequency field: sent as a {props!.unit === 'weekly' ? 'weekly' : 'monthly'} amount.</span>}
            </>
          ) : (
            <span className="block text-amber-700">No HubSpot property of its own. On Upload Record it goes into "OODC Latest Scenario Info" and the all-fields note on the deal.</span>
          )}
          <span className="mt-2 block text-[10px] text-[var(--text-color-muted)]">Wrong or missing? Use "Check mapping" for the full list.</span>
        </span>, document.body
      )}
    </span>
  );
};

export default MapInfo;
