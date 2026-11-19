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

/** Newest open deal on the contact (else newest deal). */
export const pickDeal = async (contactId: string) => {
  const dealIds = await associatedIds("contacts", contactId, "deals");
  if (!dealIds.length) return null;
  const batch = await hs("/crm/v3/objects/deals/batch/read", {
    method: "POST",
    body: JSON.stringify({ properties: ["dealname", "createdate", "hs_is_closed"], inputs: dealIds.map(id => ({ id })) }),
  });
  const deals = (batch?.results ?? []).sort(
    (a: any, b: any) => new Date(b.properties?.createdate ?? 0).getTime() - new Date(a.properties?.createdate ?? 0).getTime(),
  );
  return deals.find((d: any) => d.properties?.hs_is_closed !== "true") ?? deals[0] ?? null;
};

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
