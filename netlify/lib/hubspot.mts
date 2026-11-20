// Shared HubSpot API helpers for the Netlify functions.
// Token: HUBSPOT_PRIVATE_KEY (Netlify secret, never sent to the browser).

export const hubspotBase = () => Netlify.env.get("HUBSPOT_API_BASE") || "https://api.hubapi.com";

export class HubSpotError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const hs = async (path: string, init: RequestInit = {}) => {
  const res = await fetch(`${hubspotBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${Netlify.env.get("HUBSPOT_PRIVATE_KEY")}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text.slice(0, 200) }; }
  if (!res.ok) {
    const scopes = data?.errors?.[0]?.context?.requiredGranularScopes ?? data?.context?.requiredGranularScopes;
    const detail = scopes ? ` Missing HubSpot scope: ${[].concat(scopes).join(", ")}.` : "";
    throw new HubSpotError(res.status, `HubSpot ${res.status}: ${data?.message || res.statusText}.${detail}`);
  }
  return data;
};

export const findContactId = async (email: string): Promise<string | null> => {
  const search = await hs("/crm/v3/objects/contacts/search", {
    method: "POST",
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
      properties: ["email"],
      limit: 1,
    }),
  });
  return search?.results?.[0]?.id ?? null;
};

export const associatedIds = async (fromType: string, fromId: string, toType: string): Promise<string[]> => {
  const assoc = await hs(`/crm/v4/objects/${fromType}/${fromId}/associations/${toType}?limit=100`);
  return (assoc?.results ?? []).map((r: any) => String(r.toObjectId));
};

export interface DealSummary { id: string; name: string; stage: string; pipeline: string; closed: boolean; created: string }

/** Deal stage id -> label (and pipeline id -> label). Empty maps if not readable. */
const stageLabels = async () => {
  const stages = new Map<string, string>(), pipelines = new Map<string, string>();
  try {
    const data = await hs("/crm/v3/pipelines/deals");
    for (const p of data?.results ?? []) {
      pipelines.set(String(p.id), p.label);
      for (const st of p.stages ?? []) stages.set(String(st.id), st.label);
    }
  } catch { /* fall back to raw ids */ }
  return { stages, pipelines };
};

/** All deals on the contact, newest first, with stage names. */
export const listDeals = async (contactId: string): Promise<DealSummary[]> => {
  const dealIds = await associatedIds("contacts", contactId, "deals");
  if (!dealIds.length) return [];
  const [batch, labels] = await Promise.all([
    hs("/crm/v3/objects/deals/batch/read", {
      method: "POST",
      body: JSON.stringify({ properties: ["dealname", "createdate", "hs_is_closed", "dealstage", "pipeline"], inputs: dealIds.map(id => ({ id })) }),
    }),
    stageLabels(),
  ]);
  return (batch?.results ?? [])
    .map((d: any): DealSummary => ({
      id: String(d.id),
      name: d.properties?.dealname ?? "",
      stage: labels.stages.get(String(d.properties?.dealstage)) ?? d.properties?.dealstage ?? "",
      pipeline: labels.pipelines.get(String(d.properties?.pipeline)) ?? d.properties?.pipeline ?? "",
      closed: d.properties?.hs_is_closed === "true",
      created: d.properties?.createdate ?? "",
    }))
    .sort((a: DealSummary, b: DealSummary) => new Date(b.created).getTime() - new Date(a.created).getTime());
};

/** Newest open deal (else newest deal) from a list. */
export const defaultDeal = (deals: DealSummary[]) => deals.find(d => !d.closed) ?? deals[0] ?? null;

/** Reads specific properties of one record. */
export const readProperties = async (objectType: string, id: string, properties: string[]) => {
  const data = await hs(`/crm/v3/objects/${objectType}/batch/read`, {
    method: "POST",
    body: JSON.stringify({ properties, inputs: [{ id }] }),
  });
  const props: Record<string, string | null> = data?.results?.[0]?.properties ?? {};
  const out: Record<string, string> = {};
  for (const name of properties) {
    const v = props[name];
    if (v !== null && v !== undefined && String(v).trim() !== "") out[name] = String(v).trim();
  }
  return out;
};

/**
 * Finds "<X>" number fields that have a matching "<X> Frequency" dropdown on
 * deals. Needs the crm.schemas.deals.read scope; returns [] without it.
 */
export const discoverFrequencyPairs = async (): Promise<{ amountProp: string; freqProp: string; label: string }[]> => {
  try {
    const data = await hs("/crm/v3/properties/deals?archived=false");
    const props: { name: string; label: string; type: string }[] = data?.results ?? [];
    const byLabel = new Map(props.filter(p => p.type === "number").map(p => [p.label.trim().toLowerCase(), p]));
    const pairs: { amountProp: string; freqProp: string; label: string }[] = [];
    for (const f of props) {
      const m = f.label.trim().match(/^(.*)\s+frequency$/i);
      if (!m || f.type !== "enumeration") continue;
      const base = byLabel.get(m[1].trim().toLowerCase());
      if (base) pairs.push({ amountProp: base.name, freqProp: f.name, label: base.label.trim() });
    }
    return pairs;
  } catch {
    return [];
  }
};
