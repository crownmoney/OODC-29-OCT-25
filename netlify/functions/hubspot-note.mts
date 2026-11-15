import type { Config } from "@netlify/functions";
import { hasValidSession } from "../lib/session.mts";

// Posts the DNQ assessment as a note on the client's HubSpot DEAL.
// Runs alongside (not instead of) the Zapier upload.
//
// Flow: find contact by email -> associated deals -> newest open deal
// (else newest deal) -> create note associated to that deal.
// The HubSpot private app token lives only in Netlify (HUBSPOT_PRIVATE_KEY).
// Required private-app scopes: crm.objects.contacts.read,
// crm.objects.deals.read, crm.objects.deals.write (notes on deals).

const API = () => Netlify.env.get("HUBSPOT_API_BASE") || "https://api.hubapi.com";
const NOTE_TO_DEAL = 214; // HubSpot-defined association type: note -> deal

class HubSpotError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const hs = async (path: string, init: RequestInit = {}) => {
  const res = await fetch(`${API()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${Netlify.env.get("HUBSPOT_PRIVATE_KEY")}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const scopes = data?.errors?.[0]?.context?.requiredGranularScopes ?? data?.context?.requiredGranularScopes;
    const detail = scopes ? ` Missing HubSpot scope: ${[].concat(scopes).join(", ")}.` : "";
    throw new HubSpotError(res.status, `HubSpot ${res.status}: ${data?.message || res.statusText}.${detail}`);
  }
  return data;
};

const findDeal = async (email: string) => {
  const search = await hs("/crm/v3/objects/contacts/search", {
    method: "POST",
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
      properties: ["email", "firstname", "lastname"],
      limit: 1,
    }),
  });
  const contact = search?.results?.[0];
  if (!contact) return { contact: null, deal: null };

  const assoc = await hs(`/crm/v4/objects/contacts/${contact.id}/associations/deals?limit=100`);
  const dealIds: string[] = (assoc?.results ?? []).map((r: any) => String(r.toObjectId));
  if (!dealIds.length) return { contact, deal: null };

  const batch = await hs("/crm/v3/objects/deals/batch/read", {
    method: "POST",
    body: JSON.stringify({ properties: ["dealname", "createdate", "hs_is_closed"], inputs: dealIds.map(id => ({ id })) }),
  });
  const deals = (batch?.results ?? []).sort(
    (a: any, b: any) => new Date(b.properties?.createdate ?? 0).getTime() - new Date(a.properties?.createdate ?? 0).getTime(),
  );
  const open = deals.find((d: any) => d.properties?.hs_is_closed !== "true");
  return { contact, deal: open ?? deals[0] ?? null };
};

// ---------------------------------------------------------------------------
// Note formatting (server-side, escaped)
// ---------------------------------------------------------------------------
const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : null);
const money = (v: unknown) => {
  const n = num(v);
  return n === null ? "n/a" : new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);
};
const years = (v: unknown) => {
  const n = num(v);
  if (n === null) return "never";
  const w = Math.floor(Math.abs(n)), m = Math.round((Math.abs(n) - w) * 12);
  return `${n < 0 ? "-" : ""}${w} yrs ${m} mths`;
};
const auDate = (v: unknown) => {
  const s = String(v ?? "");
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10).split("-").reverse().join("/") : esc(s);
};
const LABELS: Record<string, string> = {
  qualifies: "QUALIFIES - Crown Money can help",
  qualifies_future: "QUALIFIES (FUTURE) - Crown Money can help once planned changes happen",
  dnq: "DNQ - better off with the bank for now",
};
const label = (v: unknown) => esc(LABELS[String(v)] ?? String(v));

const buildNote = (p: any) => {
  const a = p.assessment ?? {};
  const n = a.numbers ?? {};
  const o = p.override;
  const scen = (title: string, s: any) => {
    const crownOk = num(s?.term) !== null && num(s?.interest) !== null;
    const saved = (v: unknown, fmt: (x: unknown) => string) => (num(v) === null ? "" : ` (${num(v)! >= 0 ? "saves" : "costs"} ${fmt(Math.abs(num(v)!))})`);
    return `
    <p><strong>${title}:</strong> ${s?.better ? "Crown better" : "Bank better"}<br>
    ${crownOk
      ? `Debt-free: bank ${years(n.bankTerm)} vs Crown ${years(s.term)}${saved(s.yearsSaved, years)}<br>
    Total interest: bank ${money(n.bankInterest)} vs Crown ${money(s.interest)}${saved(s.interestSaved, money)}`
      : `Debt-free: bank ${years(n.bankTerm)}, total interest ${money(n.bankInterest)}<br>
    Crown: can't be paid off with these numbers`}</p>`;
  };
  const changes = Array.isArray(a.plannedChanges) && a.plannedChanges.length
    ? `<ul>${a.plannedChanges.slice(0, 30).map((c: any) =>
        `<li>${esc(c.description)}: ${num(c.monthlyEffect)! >= 0 ? "+" : "-"}${money(Math.abs(num(c.monthlyEffect) ?? 0))}${c.kind === "change" ? "/mth" : " one-off"} from ${auDate(c.startDate)}</li>`).join("")}</ul>`
    : "<p>None entered.</p>";
  const reasons = Array.isArray(a.reasons) ? `<ul>${a.reasons.slice(0, 20).map((r: unknown) => `<li>${esc(r)}</li>`).join("")}</ul>` : "";
  const finalVerdict = o?.verdict ?? a.verdict;

  return `
<h3>OODC DNQ Check: ${label(finalVerdict)}</h3>
<p><strong>Calculated verdict:</strong> ${label(a.verdict)}<br>
<strong>Consultant's verdict:</strong> ${o ? `${label(o.verdict)} (changed${o.by ? ` by ${esc(o.by)}` : ""} on ${esc(new Date(o.at).toLocaleString("en-AU", { timeZone: "Australia/Sydney" }))})` : "Not changed"}</p>
${o ? `<p><strong>Reason for change:</strong> ${esc(o.reason)}</p>` : ""}
<p><strong>Why:</strong></p>${reasons}
${scen("Today (current income & expenses)", a.today)}
${scen("With planned changes", a.withChanges)}
<p><strong>Monthly budget today:</strong> income ${money(n.monthlyIncome)}, living expenses ${money(n.monthlyLivingExpenses)}, home loan repayment ${money(n.monthlyHomeLoanRepayment)}, spare each month ${money(n.monthlySurplus)}</p>
<p><strong>Loan:</strong> home loan ${money(n.homeLoanAmount)} (offset ${money(n.offsetBalance)}), other debts ${money(n.otherDebtsTotal)}, bank rate ${esc(n.bankRate)}%, Crown rate ${esc(n.crownRate)}%</p>
<p><strong>Planned changes:</strong></p>${changes}
<p><em>Posted automatically by the Out of Debt Calculator (oodc.net.au).</em></p>`.trim();
};

// ---------------------------------------------------------------------------
export default async (req: Request) => {
  if (!hasValidSession(req)) return Response.json({ error: "Please log in again." }, { status: 401 });
  if (!Netlify.env.get("HUBSPOT_PRIVATE_KEY")) return Response.json({ error: "HubSpot is not configured." }, { status: 500 });

  let p: any;
  try {
    p = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const email = typeof p?.email === "string" ? p.email.trim().toLowerCase() : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !p?.assessment || JSON.stringify(p).length > 50_000) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (p.override && (typeof p.override.reason !== "string" || p.override.reason.trim().length < 10)) {
    return Response.json({ error: "A reason is required when the verdict is changed." }, { status: 400 });
  }

  try {
    // Single attempt; the browser retries a few times while Zapier may
    // still be creating the contact/deal.
    const found = await findDeal(email);
    if (!found.contact) return Response.json({ error: `No HubSpot contact found for ${email}.`, retry: true }, { status: 404 });
    if (!found.deal) return Response.json({ error: `No deal found on the HubSpot contact for ${email}.`, retry: true }, { status: 404 });

    const dryRun = p.dryRun === true;
    if (!dryRun) {
      await hs("/crm/v3/objects/notes", {
        method: "POST",
        body: JSON.stringify({
          properties: { hs_timestamp: new Date().toISOString(), hs_note_body: buildNote(p) },
          associations: [{ to: { id: found.deal.id }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: NOTE_TO_DEAL }] }],
        }),
      });
    }
    return Response.json({ ok: true, dryRun, dealId: found.deal.id, dealName: found.deal.properties?.dealname ?? "" });
  } catch (error) {
    const msg = error instanceof HubSpotError ? error.message : "Couldn't reach HubSpot.";
    console.error("HubSpot note failed:", error);
    return Response.json({ error: msg }, { status: 502 });
  }
};

export const config: Config = {
  path: "/api/hubspot-note",
  method: "POST",
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
