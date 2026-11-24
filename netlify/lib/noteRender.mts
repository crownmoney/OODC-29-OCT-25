// Crown Money branded HTML for the deal note posted on Upload Record.
// HubSpot notes keep inline styles and tables, so everything is inline.
// Every value from the browser is escaped and size-limited here.

const PURPLE = "#5B21B6", INK = "#1F1235", MUTED = "#6B5A8C", LINE = "#E9E3F7", SOFT = "#F7F4FD";
const TONE: Record<string, { fg: string; bg: string }> = {
  good: { fg: "#047857", bg: "#ECFDF5" },
  bad: { fg: "#B91C1C", bg: "#FEF2F2" },
  warn: { fg: "#B45309", bg: "#FFFBEB" },
  muted: { fg: MUTED, bg: SOFT },
};

const esc = (v: unknown, max = 2000) =>
  String(v ?? "").slice(0, max).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const tone = (t: unknown) => TONE[String(t)] ?? null;
const arr = <T,>(v: unknown, max: number): T[] => (Array.isArray(v) ? v.slice(0, max) : []);
const F = "font-family:Arial,Helvetica,sans-serif;";

const rowsTable = (rows: any[]) => `
<table style="width:100%;border-collapse:collapse;${F}font-size:13px;margin:0 0 6px 0;">${arr<any>(rows, 200).map((r, i) => {
  const t = tone(r?.tone);
  return `<tr style="background:${i % 2 ? "#FFFFFF" : SOFT};">
<td style="padding:6px 10px;color:${MUTED};width:45%;border-bottom:1px solid ${LINE};vertical-align:top;">${esc(r?.label, 300)}</td>
<td style="padding:6px 10px;color:${t ? t.fg : INK};font-weight:bold;border-bottom:1px solid ${LINE};vertical-align:top;">${esc(r?.value, 600)}</td></tr>`;
}).join("")}</table>`;

const sub = (s: any) => `
${s?.title ? `<p style="${F}font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${PURPLE};margin:12px 0 4px 0;">${esc(s.title, 200)}</p>` : ""}
${s?.rows ? rowsTable(s.rows) : ""}
${s?.bullets ? `<ul style="${F}font-size:13px;color:${INK};margin:0 0 6px 18px;padding:0;">${arr<any>(s.bullets, 60).map(b => `<li style="margin:2px 0;">${esc(b, 600)}</li>`).join("")}</ul>` : ""}
${s?.text ? `<p style="${F}font-size:13px;color:${INK};white-space:pre-wrap;background:${SOFT};border-left:3px solid ${PURPLE};padding:8px 10px;margin:0 0 6px 0;">${esc(s.text, 8000)}</p>` : ""}`;

const section = (s: any, n: number) => `
<h3 style="${F}font-size:16px;color:${PURPLE};margin:22px 0 6px 0;padding-bottom:4px;border-bottom:2px solid ${LINE};">${n}. ${esc(s?.title, 200)}</h3>
${arr<any>(s?.subs, 30).map(sub).join("")}`;

export interface FieldStatus { section: string; label: string; value: string; props: string; note?: string }

/** Full note body. `fields` + written/skipped describe the HubSpot properties this upload set. */
export const renderReport = (report: any, fields: FieldStatus[], written: string[], skipped: { name: string; reason: string }[]) => {
  const v = tone(report?.verdict?.tone) ?? TONE.muted;
  const when = new Date().toLocaleString("en-AU", { timeZone: "Australia/Sydney", dateStyle: "full", timeStyle: "short" });
  const stats = arr<any>(report?.headline, 4);
  const sections = arr<any>(report?.sections, 30);

  const ok = new Set(written), bad = new Map(skipped.map(s => [s.name, s.reason]));
  const groups = new Map<string, FieldStatus[]>();
  for (const f of fields.slice(0, 400)) groups.set(String(f.section), [...(groups.get(String(f.section)) ?? []), f]);
  const fieldsHtml = [...groups.entries()].map(([g, list]) => `
<p style="${F}font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${PURPLE};margin:12px 0 4px 0;">${esc(g, 200)}</p>
<table style="width:100%;border-collapse:collapse;${F}font-size:12px;">
<tr style="background:${PURPLE};color:#FFFFFF;"><td style="padding:5px 8px;">Field</td><td style="padding:5px 8px;">Value</td><td style="padding:5px 8px;">HubSpot property</td><td style="padding:5px 8px;">Status</td></tr>
${list.map((f, i) => {
  const names = String(f.props || "").split(" + ").filter(Boolean);
  const rejected = names.filter(n => bad.has(n));
  const st = !names.length ? { t: "No property – see OODC Latest Scenario Info", c: TONE.warn }
    : rejected.length ? { t: `Not saved: ${rejected.map(n => bad.get(n)).join("; ")}`, c: TONE.bad }
    : names.every(n => ok.has(n)) ? { t: "✓ Saved", c: TONE.good } : { t: "Not sent (no value)", c: TONE.muted };
  return `<tr style="background:${i % 2 ? "#FFFFFF" : SOFT};">
<td style="padding:5px 8px;border-bottom:1px solid ${LINE};color:${INK};">${esc(f.label, 200)}</td>
<td style="padding:5px 8px;border-bottom:1px solid ${LINE};color:${INK};">${esc(f.value, 300)}</td>
<td style="padding:5px 8px;border-bottom:1px solid ${LINE};color:${MUTED};font-family:Consolas,Menlo,monospace;font-size:11px;">${esc(f.props || "—", 200)}</td>
<td style="padding:5px 8px;border-bottom:1px solid ${LINE};color:${st.c.fg};font-weight:bold;">${esc(st.t, 300)}</td></tr>`;
}).join("")}</table>`).join("");

  return `
<table style="width:100%;border-collapse:collapse;${F}">
<tr><td style="background:${PURPLE};padding:16px 18px;">
<p style="${F}margin:0;color:#FFFFFF;font-size:20px;font-weight:bold;letter-spacing:4px;">CROWN MONEY</p>
<p style="${F}margin:4px 0 0 0;color:#DDD6FE;font-size:12px;letter-spacing:1px;">OUT OF DEBT CALCULATOR · CLIENT SCENARIO</p>
</td></tr>
<tr><td style="background:${SOFT};padding:12px 18px;border-bottom:1px solid ${LINE};">
<p style="${F}margin:0;color:${INK};font-size:17px;font-weight:bold;">${esc(report?.client, 200)}</p>
<p style="${F}margin:2px 0 0 0;color:${MUTED};font-size:12px;">Uploaded ${esc(when)} from oodc.net.au</p>
</td></tr></table>

<table style="width:100%;border-collapse:collapse;${F}margin:14px 0 0 0;">
<tr><td style="background:${v.bg};border-left:5px solid ${v.fg};padding:12px 16px;">
<p style="${F}margin:0;color:${v.fg};font-size:16px;font-weight:bold;">${esc(report?.verdict?.label, 200)}</p>
<p style="${F}margin:3px 0 0 0;color:${MUTED};font-size:12px;">${esc(report?.verdict?.detail, 300)}</p>
</td></tr></table>

${stats.length ? `<table style="width:100%;border-collapse:separate;border-spacing:6px;${F}margin:8px 0 0 0;"><tr>${stats.map(s => {
  const t = tone(s?.tone);
  return `<td style="background:#FFFFFF;border:1px solid ${LINE};border-radius:8px;padding:10px 12px;text-align:center;width:25%;">
<p style="${F}margin:0;color:${MUTED};font-size:10px;letter-spacing:1px;text-transform:uppercase;">${esc(s?.label, 100)}</p>
<p style="${F}margin:4px 0 0 0;color:${t ? t.fg : PURPLE};font-size:17px;font-weight:bold;">${esc(s?.value, 100)}</p></td>`;
}).join("")}</tr></table>` : ""}

${sections.map((s, i) => section(s, i + 1)).join("")}

<h3 style="${F}font-size:16px;color:${PURPLE};margin:22px 0 6px 0;padding-bottom:4px;border-bottom:2px solid ${LINE};">${sections.length + 1}. HubSpot fields updated by this upload</h3>
<p style="${F}font-size:13px;color:${INK};margin:0 0 4px 0;"><b>${written.length}</b> deal properties saved${skipped.length ? `, <b style="color:${TONE.bad.fg};">${skipped.length} rejected by HubSpot</b>` : ""}. Fields without a HubSpot property are in <b>OODC Latest Scenario Info</b>.</p>
${fieldsHtml}

<p style="${F}font-size:11px;color:${MUTED};margin:22px 0 0 0;padding-top:8px;border-top:1px solid ${LINE};">Posted automatically by the Crown Money Out of Debt Calculator · crownmoney.com.au</p>`;
};
