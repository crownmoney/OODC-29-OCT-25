// Crown Money branded HTML for the deal note posted on Upload Record.
// HubSpot notes keep inline styles and tables, but a note body is capped at
// 65,536 characters, so the markup is kept lean and the note is split into
// numbered parts if a big scenario still doesn't fit.
// Every value from the browser is escaped and size-limited here.

const PURPLE = "#5B21B6", INK = "#1F1235", MUTED = "#6B5A8C", LINE = "#E9E3F7", SOFT = "#F7F4FD";
const TONE: Record<string, string> = { good: "#047857", bad: "#B91C1C", warn: "#B45309", muted: MUTED };
const TONE_BG: Record<string, string> = { good: "#ECFDF5", bad: "#FEF2F2", warn: "#FFFBEB", muted: SOFT };
/** Safe size for one note (HubSpot's limit is 65,536). */
export const NOTE_LIMIT = 60_000;

const esc = (v: unknown, max = 2000) =>
  String(v ?? "").slice(0, max).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const arr = <T,>(v: unknown, max: number): T[] => (Array.isArray(v) ? v.slice(0, max) : []);
const color = (t: unknown) => TONE[String(t)] ?? INK;

// Short, reused styles keep each row small.
const WRAP = `font-family:Arial,Helvetica,sans-serif;color:${INK};font-size:13px;`;
const H3 = `color:${PURPLE};font-size:16px;margin:20px 0 6px;border-bottom:2px solid ${LINE};padding-bottom:3px;`;
const SUB = `color:${PURPLE};font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;margin:10px 0 3px;`;
const TBL = `width:100%;border-collapse:collapse;`;

const rowsTable = (rows: any[]) =>
  `<table cellpadding="5" style="${TBL}">${arr<any>(rows, 200).map((r, i) =>
    `<tr${i % 2 ? "" : ` style="background:${SOFT}"`}><td style="color:${MUTED};width:45%">${esc(r?.label, 300)}</td><td style="color:${color(r?.tone)}"><b>${esc(r?.value, 600)}</b></td></tr>`,
  ).join("")}</table>`;

const sub = (s: any) =>
  (s?.title ? `<p style="${SUB}">${esc(s.title, 200)}</p>` : "") +
  (s?.rows ? rowsTable(s.rows) : "") +
  (s?.bullets ? `<ul style="margin:0 0 6px 18px;padding:0">${arr<any>(s.bullets, 60).map(b => `<li>${esc(b, 600)}</li>`).join("")}</ul>` : "") +
  (s?.text ? `<p style="white-space:pre-wrap;background:${SOFT};border-left:3px solid ${PURPLE};padding:6px 10px;margin:0 0 6px">${esc(s.text, 8000)}</p>` : "");

export interface FieldStatus { section: string; label: string; value: string; props: string; note?: string }

const header = (report: any, part?: string) => {
  const when = new Date().toLocaleString("en-AU", { timeZone: "Australia/Sydney", dateStyle: "full", timeStyle: "short" });
  return `<table cellpadding="12" style="${TBL}"><tr><td style="background:${PURPLE}">` +
    `<p style="margin:0;color:#FFFFFF;font-size:20px;font-weight:bold;letter-spacing:4px">CROWN MONEY</p>` +
    `<p style="margin:3px 0 0;color:#DDD6FE;font-size:12px;letter-spacing:1px">OUT OF DEBT CALCULATOR · CLIENT SCENARIO${part ? ` · ${esc(part)}` : ""}</p></td></tr>` +
    `<tr><td style="background:${SOFT}"><p style="margin:0;font-size:17px;font-weight:bold">${esc(report?.client, 200)}</p>` +
    `<p style="margin:2px 0 0;color:${MUTED};font-size:12px">Uploaded ${esc(when)} from oodc.net.au</p></td></tr></table>`;
};

const summary = (report: any) => {
  const t = String(report?.verdict?.tone ?? "muted");
  const stats = arr<any>(report?.headline, 4);
  return `<table cellpadding="10" style="${TBL}margin-top:12px"><tr><td style="background:${TONE_BG[t] ?? SOFT};border-left:5px solid ${color(t)}">` +
    `<p style="margin:0;color:${color(t)};font-size:16px;font-weight:bold">${esc(report?.verdict?.label, 200)}</p>` +
    `<p style="margin:2px 0 0;color:${MUTED};font-size:12px">${esc(report?.verdict?.detail, 300)}</p></td></tr></table>` +
    (stats.length ? `<table cellpadding="8" style="${TBL}margin-top:6px;text-align:center"><tr>${stats.map(s =>
      `<td style="border:1px solid ${LINE};width:25%"><p style="margin:0;color:${MUTED};font-size:10px;text-transform:uppercase">${esc(s?.label, 100)}</p>` +
      `<p style="margin:3px 0 0;color:${s?.tone ? color(s.tone) : PURPLE};font-size:17px;font-weight:bold">${esc(s?.value, 100)}</p></td>`).join("")}</tr></table>` : "");
};

const fieldsBlocks = (fields: FieldStatus[], written: string[], skipped: { name: string; reason: string }[], n: number) => {
  const ok = new Set(written), bad = new Map(skipped.map(s => [s.name, s.reason]));
  const groups = new Map<string, FieldStatus[]>();
  for (const f of fields.slice(0, 400)) groups.set(String(f.section), [...(groups.get(String(f.section)) ?? []), f]);
  const intro = `<h3 style="${H3}">${n}. HubSpot fields updated by this upload</h3>` +
    `<p style="margin:0 0 4px"><b>${written.length}</b> deal properties saved${skipped.length ? `, <b style="color:${TONE.bad}">${skipped.length} rejected by HubSpot</b>` : ""}. Fields without a HubSpot property are in <b>OODC Latest Scenario Info</b>.</p>`;
  const blocks = [...groups.entries()].map(([g, list]) => `<p style="${SUB}">${esc(g, 200)}</p>` +
    `<table cellpadding="4" style="${TBL}font-size:12px"><tr style="background:${PURPLE};color:#FFFFFF"><td>Field</td><td>Value</td><td>HubSpot property</td><td>Status</td></tr>` +
    list.map((f, i) => {
      const names = String(f.props || "").split(" + ").filter(Boolean);
      const rejected = names.filter(x => bad.has(x));
      const [txt, tone] = !names.length ? ["No property (see OODC Latest Scenario Info)", "warn"]
        : rejected.length ? [`Not saved: ${rejected.map(x => bad.get(x)).join("; ")}`, "bad"]
        : names.every(x => ok.has(x)) ? ["✓ Saved", "good"] : ["Not sent (no value)", "muted"];
      return `<tr${i % 2 ? "" : ` style="background:${SOFT}"`}><td>${esc(f.label, 200)}</td><td>${esc(f.value, 300)}</td><td style="color:${MUTED}">${esc(f.props || "—", 200)}</td><td style="color:${TONE[tone]}"><b>${esc(txt, 300)}</b></td></tr>`;
    }).join("") + `</table>`);
  return [intro + (blocks[0] ?? ""), ...blocks.slice(1)];
};

const FOOTER = `<p style="font-size:11px;color:${MUTED};margin:18px 0 0;border-top:1px solid ${LINE};padding-top:6px">Posted automatically by the Crown Money Out of Debt Calculator · crownmoney.com.au</p>`;

/**
 * Note bodies for the upload (usually one; more, numbered "Part 1 of N",
 * only when a big scenario would go over HubSpot's size limit).
 */
export const renderReport = (report: any, fields: FieldStatus[], written: string[], skipped: { name: string; reason: string }[]): string[] => {
  const sections = arr<any>(report?.sections, 30);
  const blocks = [
    summary(report),
    ...sections.map((s, i) => `<h3 style="${H3}">${i + 1}. ${esc(s?.title, 200)}</h3>` + arr<any>(s?.subs, 30).map(sub).join("")),
    ...fieldsBlocks(fields, written, skipped, sections.length + 1),
  ];
  const wrap = (body: string, part?: string) => `<div style="${WRAP}">${header(report, part)}${body}${FOOTER}</div>`;

  const single = wrap(blocks.join(""));
  if (single.length <= NOTE_LIMIT) return [single];

  // Pack blocks into parts that each fit.
  const room = NOTE_LIMIT - wrap("", "Part 10 of 10").length;
  const parts: string[] = [];
  let cur = "";
  for (const b0 of blocks) {
    const b = b0.length > room ? b0.slice(0, room - 200) + `<p style="color:${TONE.warn}">(cut short: too long for one HubSpot note)</p>` : b0;
    if (cur && cur.length + b.length > room) { parts.push(cur); cur = ""; }
    cur += b;
  }
  if (cur) parts.push(cur);
  return parts.map((p, i) => wrap(p, `Part ${i + 1} of ${parts.length}`));
};
