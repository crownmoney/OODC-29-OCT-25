import type { Config } from "@netlify/functions";
import { hasValidSession } from "../lib/session.mts";
import { HubSpotError, hs, findContactId, listDeals, defaultDeal } from "../lib/hubspot.mts";
import { writeDealProperties } from "../lib/dealWrite.mts";
import { renderReport } from "../lib/noteRender.mts";

// Posts the DNQ assessment as a note on the client's HubSpot DEAL and writes
// the "OODC Latest Scenario Info" deal property (oodc_latest_scenario_info).
// Runs alongside (not instead of) the Zapier upload.
//
// Flow: find contact by email -> the deal chosen in "Fetch from HubSpot" if
// it belongs to this client, else the newest open deal -> note + property.
// The HubSpot private app token lives only in Netlify (HUBSPOT_PRIVATE_KEY).
// Required private-app scopes: crm.objects.contacts.read,
// crm.objects.deals.read, crm.objects.deals.write (notes + deal property).

const NOTE_TO_DEAL = 214; // HubSpot-defined association type: note -> deal

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
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !p?.assessment || JSON.stringify(p).length > 250_000) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (p.override && (typeof p.override.reason !== "string" || p.override.reason.trim().length < 10)) {
    return Response.json({ error: "A reason is required when the verdict is changed." }, { status: 400 });
  }
  const wantedDeal = typeof p.dealId === "string" && /^\d{1,20}$/.test(p.dealId) ? p.dealId : "";
  const scenarioInfo = typeof p.scenarioInfo === "string" ? p.scenarioInfo.slice(0, 60_000) : "";

  try {
    // The client's contact and deal must already exist (the app never creates them).
    const contactId = await findContactId(email);
    if (!contactId) return Response.json({ error: `No HubSpot contact found for ${email}. This app only updates clients who are already in HubSpot with a deal; check the email on the Summary tab.` }, { status: 404 });
    const deals = await listDeals(contactId, email);
    const deal = (wantedDeal && deals.find(d => d.id === wantedDeal)) || defaultDeal(deals);
    if (!deal) return Response.json({ error: `${email} is in HubSpot but has no deal. Create the deal in HubSpot first, then upload again.` }, { status: 404 });

    const dryRun = p.dryRun === true;
    let scenarioSaved = false, scenarioError = "";
    let written: string[] = [], skipped: { name: string; reason: string }[] = [];
    let notesAdded = 0, noteError = "";
    if (!dryRun) {
      // 1) Write the calculator's fields (and the scenario summary) to the deal.
      const dealProps = { ...(p.dealProperties && typeof p.dealProperties === "object" ? p.dealProperties : {}), ...(scenarioInfo ? { oodc_latest_scenario_info: scenarioInfo } : {}) };
      try {
        const r = await writeDealProperties(deal.id, dealProps);
        written = r.written; skipped = r.skipped;
        scenarioSaved = r.written.includes("oodc_latest_scenario_info");
        if (scenarioInfo && !scenarioSaved) scenarioError = "HubSpot rejected it.";
      } catch (err) {
        scenarioError = err instanceof HubSpotError ? err.message : "Couldn't update the deal.";
        console.error("Deal property update failed:", err);
      }
      // 2) Crown Money branded note (split into parts only if it's too long for one note).
      const bodies = p.report && typeof p.report === "object"
        ? renderReport(p.report, Array.isArray(p.fieldRows) ? p.fieldRows : [], written, skipped)
        : [buildNote(p)]; // older app versions
      for (const body of bodies) {
        try {
          await hs("/crm/v3/objects/notes", {
            method: "POST",
            body: JSON.stringify({
              properties: { hs_timestamp: new Date().toISOString(), hs_note_body: body },
              associations: [{ to: { id: deal.id }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: NOTE_TO_DEAL }] }],
            }),
          });
          notesAdded++;
        } catch (err) {
          noteError = err instanceof HubSpotError ? err.message : "Couldn't add the note.";
          console.error("Note failed:", err);
          break;
        }
      }
    }
    return Response.json({ ok: true, dryRun, dealId: deal.id, dealName: deal.name, scenarioSaved, scenarioError, written: written.length, skipped, notesAdded, noteError });
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
