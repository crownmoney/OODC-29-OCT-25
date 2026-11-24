import type { Config } from "@netlify/functions";
import { hasValidSession } from "../lib/session.mts";
import { HubSpotError, findContactId, listDeals, defaultDeal, readProperties, discoverFrequencyPairs } from "../lib/hubspot.mts";

// "Fetch from HubSpot": returns the client's contact basics and the fact-find
// fields on their newest open deal. The app maps them onto calculator fields
// (services/hubspotImport.ts) and the consultant reviews before importing.
// HubSpot scopes needed: crm.objects.contacts.read, crm.objects.deals.read.

const CONTACT_PROPS = ["firstname", "lastname", "email", "phone", "mobilephone"];

export const DEAL_PROPS = [
  // People & household
  "client_first_names", "loan_holder__1_age", "loan_holder__2_age", "kids", "kids_under_18",
  // Current loan
  "current_lender__sales_", "bank_name", "current_loan_balance", "current_interest_rate",
  "monthly_loan_repayments2", "total_monthly_repayments__current_", "repayment_frequency",
  "offset_account_balance", "years_left_on_current_loan", "security_1_value", "total_security_property_values",
  // Income
  "net_income__1", "net_income__2", "net_income_1_frequency", "net_income_2_frequency",
  "net_income_1_other", "net_income_1_other_frequency", "net_income_2_other", "net_income_2_other_frequency", "total_monthly_after_tax_income__current_",
  // Expenses (amount + frequency)
  "food", "fun", "fuel",
  "childcare_amount", "childcare_frequency",
  "health_insurance_amount", "health_insurance_frequency",
  "home_insurance_amount", "home_insurance_frequency",
  "motor_vehicle_insurance_amount", "motor_vehicle_frequency",
  "car_running_costs", "car_cost_frequency",
  "mobile_phone", "phone___internet_frequency",
  "monthly_school", "education_cost_frequency",
  "medical", "medical_cost_frequency",
  "home_costs", "other_expenses_text",
  // Expense fields with a paired "<field>_frequency" dropdown
  ...["gas", "electricity", "car_insurance", "car_maintenance", "car_rego", "boatjetskiother_rego",
    "house_insurance", "income_protection", "life_insurance", "pet_insurance", "internet", "phone",
    "other_maintenance", "rates", "water", "gym", "subscriptions", "kids_activities_netball", "medical2", "private_schooleducation", "kids_excursions", "rent", "debt_repay", "additional_expense1", "additional_expense2", "additional_expense3"].flatMap(p => [p, `${p}_frequency`]),
  "pool_maint", "pool_maintenance_frequency", "childcare", "childcare_frequency2", "health_insurance", "health_insurance_frequency2",
  // Frequency fields not created yet; ignored until they exist.
  "food_frequency", "fun_frequency", "fuel_frequency", "home_costs_frequency",
  "total_monthly_expenses__current_", "monthly_expenses__without_mortgage_",
  // Other debts & savings (reference only)
  "total_of_other_debts", "debts_being_consolidated", "total_savings", "oodc_latest_scenario_info",
];

const BASE_FREQ = new Set(["gas_frequency", "electricity_frequency", "car_insurance_frequency", "car_maintenance_frequency", "car_rego_frequency", "boatjetskiother_rego_frequency", "house_insurance_frequency", "income_protection_frequency", "life_insurance_frequency", "pet_insurance_frequency", "internet_frequency", "phone_frequency", "other_maintenance_frequency", "rates_frequency", "water_frequency", "gym_frequency", "subscriptions_frequency", "kids_activities_netball_frequency", "medical2_frequency", "private_schooleducation_frequency", "childcare_frequency2", "health_insurance_frequency2", "kids_excursions_frequency", "rent_frequency", "debt_repay_frequency", "additional_expense1_frequency", "additional_expense2_frequency", "additional_expense3_frequency", "pool_maintenance_frequency", "childcare_frequency", "health_insurance_frequency", "home_insurance_frequency", "motor_vehicle_frequency", "car_cost_frequency", "phone___internet_frequency", "education_cost_frequency", "medical_cost_frequency", "repayment_frequency", "food_frequency", "fuel_frequency", "net_income_1_frequency", "net_income_2_frequency", "net_income_1_other_frequency", "net_income_2_other_frequency"]);

export default async (req: Request) => {
  if (!hasValidSession(req)) return Response.json({ error: "Please log in again." }, { status: 401 });
  if (!Netlify.env.get("HUBSPOT_PRIVATE_KEY")) return Response.json({ error: "HubSpot is not configured." }, { status: 500 });

  let email = "", dealId = "";
  try {
    const body = await req.json();
    email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    dealId = typeof body?.dealId === "string" && /^\d{1,20}$/.test(body.dealId) ? body.dealId : "";
  } catch { /* fall through */ }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });

  try {
    const contactId = await findContactId(email);
    if (!contactId) return Response.json({ error: `No HubSpot contact found for ${email}.` }, { status: 404 });
    const [contact, deals, pairs] = await Promise.all([readProperties("contacts", contactId, CONTACT_PROPS), listDeals(contactId, email), discoverFrequencyPairs()]);
    // A chosen deal must belong to this contact.
    const deal = dealId ? deals.find(d => d.id === dealId) ?? null : defaultDeal(deals);
    if (dealId && !deal) return Response.json({ error: "That deal isn't linked to this client." }, { status: 400 });
    // Any "<X>" + "<X> Frequency" pair added in HubSpot that the app doesn't map yet.
    const known = new Set(DEAL_PROPS);
    const extraPairs = pairs.filter(p => !known.has(p.amountProp) && !known.has(p.freqProp));
    const propsToRead = [...DEAL_PROPS, ...extraPairs.flatMap(p => [p.amountProp, p.freqProp])];
    // If HubSpot rejects a not-yet-created *_frequency field, retry without them.
    const dealProps = deal
      ? await readProperties("deals", deal.id, propsToRead).catch(err => {
          if (err instanceof HubSpotError && err.status === 400) return readProperties("deals", deal.id, propsToRead.filter(p => !p.endsWith("_frequency") || BASE_FREQ.has(p) || extraPairs.some(x => x.freqProp === p)));
          throw err;
        })
      : {};
    return Response.json({
      email,
      contact,
      deal: deal ? { id: deal.id, name: deal.name, stage: deal.stage, properties: dealProps } : null,
      deals,
      extraPairs,
    });
  } catch (error) {
    console.error("HubSpot fetch failed:", error);
    const msg = error instanceof HubSpotError ? error.message : "Couldn't reach HubSpot.";
    return Response.json({ error: msg }, { status: 502 });
  }
};

export const config: Config = {
  path: "/api/hubspot-fetch",
  method: "POST",
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
