import React from 'react';
import { CloudDownload } from 'lucide-react';

/** Small tag showing a value was fetched from HubSpot. Renders nothing when title is null. */
const FetchedBadge: React.FC<{ title: string | null; className?: string }> = ({ title, className = '' }) =>
  title ? (
    <span title={title} aria-label={title}
      className={`inline-flex items-center gap-1 rounded-full border border-orange-300 bg-orange-50 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-orange-700 print:hidden ${className}`}>
      <CloudDownload className="h-2.5 w-2.5" aria-hidden="true" /> Fetched
    </span>
  ) : null;

export default FetchedBadge;
