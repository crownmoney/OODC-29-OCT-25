import { HubSpotError, hs } from "./hubspot.mts";

// Deal properties Upload Record may write. Must match services/hubspotMap.ts;
// anything else sent by the browser is ignored (e.g. dealstage, amount).
export const WRITABLE_DEAL_PROPS = new Set([
  "loan_holder__1_age", "loan_holder__2_age", "kids", "current_lender__sales_",
  "current_loan_balance", "current_interest_rate", "monthly_loan_repayments2", "repayment_frequency",
  "offset_account_balance", "security_1_value", "years_left_on_current_loan",
  "net_income__1", "net_income_1_frequency", "net_income__2", "net_income_2_frequency",
  "net_income_1_other", "net_income_1_other_frequency", "net_income_2_other", "net_income_2_other_frequency",
  "food", "food_frequency", "fun", "fuel", "fuel_frequency", "gas", "gas_frequency", "electricity", "electricity_frequency",
  "childcare", "childcare_frequency2", "kids_activities_netball", "kids_activities_netball_frequency",
  "phone", "phone_frequency", "internet", "internet_frequency", "rates", "rates_frequency", "water", "water_frequency",
  "boatjetskiother_rego", "boatjetskiother_rego_frequency", "other_maintenance", "other_maintenance_frequency",
  "kids_excursions", "kids_excursions_frequency", "rent", "rent_frequency", "debt_repay", "debt_repay_frequency",
  "additional_expense1", "additional_expense1_frequency", "additional_expense2", "additional_expense2_frequency",
  "additional_expense3", "additional_expense3_frequency", "gym", "gym_frequency", "subscriptions", "subscriptions_frequency",
  "pool_maint", "pool_maintenance_frequency", "private_schooleducation", "private_schooleducation_frequency",
  "medical2", "medical2_frequency", "home_costs",
  "health_insurance", "health_insurance_frequency2", "house_insurance", "house_insurance_frequency",
  "life_insurance", "life_insurance_frequency", "income_protection", "income_protection_frequency",
  "pet_insurance", "pet_insurance_frequency", "car_maintenance", "car_maintenance_frequency",
  "car_insurance", "car_insurance_frequency", "car_rego", "car_rego_frequency",
  "oodc_latest_scenario_info",
]);

/**
 * Writes the allowed properties to the deal. If HubSpot rejects some values
 * (e.g. a lender name that isn't one of the dropdown options), those are
 * dropped and the rest are written. Returns what was written and skipped.
 */
export const writeDealProperties = async (dealId: string, input: unknown) => {
  const props: Record<string, string> = {};
  const ignored: string[] = [];
  if (input && typeof input === "object") {
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (!WRITABLE_DEAL_PROPS.has(k)) { ignored.push(k); continue; }
      if (typeof v === "string" || typeof v === "number") props[k] = String(v).slice(0, 60_000);
    }
  }
  const skipped: { name: string; reason: string }[] = [];
  for (let attempt = 0; attempt < 4 && Object.keys(props).length; attempt++) {
    try {
      await hs(`/crm/v3/objects/deals/${dealId}`, { method: "PATCH", body: JSON.stringify({ properties: props }) });
      return { written: Object.keys(props), skipped, ignored };
    } catch (err) {
      if (!(err instanceof HubSpotError) || err.status !== 400) throw err;
      // HubSpot lists the bad properties in the message as ..."name":"<prop>"...
      const bad = [...err.raw.matchAll(/\\?"name\\?":\\?"([a-z0-9_]+)\\?"/g)].map(m => m[1]).filter(n => n in props);
      if (!bad.length) throw err;
      for (const n of bad) {
        skipped.push({ name: n, reason: /INVALID_OPTION|allowed options/i.test(err.raw) ? `"${props[n]}" isn't one of the dropdown options` : "HubSpot rejected the value" });
        delete props[n];
      }
    }
  }
  return { written: [] as string[], skipped, ignored };
};
