import { hs, associatedIds } from "./hubspot.mts";

// The Financial Health Check form and the setter form save their answers as
// NOTES on the deal (not in deal fields). These helpers find the latest of
// each and turn them into plain data for "Fetch from HubSpot".

const decode = (s: string) =>
  s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
const toText = (html: string) =>
  decode(html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|tr|h\d)>/gi, "\n").replace(/<[^>]+>/g, ""))
    .split("\n").map(l => l.trim()).filter(Boolean).join("\n");

/** Setter note: sequence of (section, label, value) rows from its tables. */
const setterRows = (html: string) => {
  const rows: { section: string; label: string; value: string }[] = [];
  let section = "";
  for (const tr of html.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => toText(m[1]));
    // Section header bars read "<Section> | 8 of 12 answered" (older notes: dark purple bar).
    if (cells.length === 2 && /^\d+ of \d+ answered$/i.test(cells[1])) { section = cells[0]; continue; }
    if (/background:#250B40/i.test(tr) && cells.length === 1) { section = cells[0]; continue; }
    if (cells.length === 2 && cells[0] && cells[1]) rows.push({ section, label: cells[0], value: cells[1] });
  }
  return rows;
};

export interface FormNotes {
  fhc: { date: string; text: string } | null;
  setter: { date: string; rows: { section: string; label: string; value: string }[] } | null;
  error?: string;
}

export const readFormNotes = async (dealId: string, contactId: string): Promise<FormNotes> => {
  try {
    const [onDeal, onContact] = await Promise.all([
      associatedIds("deals", dealId, "notes").catch(() => [] as string[]),
      associatedIds("contacts", contactId, "notes").catch(() => [] as string[]),
    ]);
    const ids = [...new Set([...onDeal, ...onContact])].slice(-200);
    const notes: { body: string; ts: string }[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      const data = await hs("/crm/v3/objects/notes/batch/read", {
        method: "POST",
        body: JSON.stringify({ properties: ["hs_note_body", "hs_timestamp"], inputs: ids.slice(i, i + 100).map(id => ({ id })) }),
      });
      for (const n of data?.results ?? []) notes.push({ body: n.properties?.hs_note_body ?? "", ts: n.properties?.hs_timestamp ?? "" });
    }
    notes.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    const fhc = notes.find(n => /===\s*INCOME\s*===/i.test(n.body) || /Financial Health Check form/i.test(n.body) && /EXPENSES/i.test(n.body));
    const setter = notes.find(n => /Setter handover/i.test(n.body));
    return {
      fhc: fhc ? { date: fhc.ts, text: toText(fhc.body).slice(0, 20_000) } : null,
      setter: setter ? { date: setter.ts, rows: setterRows(setter.body).slice(0, 600) } : null,
    };
  } catch (err) {
    console.error("Reading form notes failed:", err);
    return { fhc: null, setter: null, error: err instanceof Error ? err.message : "Couldn't read notes." };
  }
};
