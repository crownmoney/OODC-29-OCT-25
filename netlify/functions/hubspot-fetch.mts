import type { Config } from "@netlify/functions";
import { hasValidSession } from "../lib/session.mts";
import { HubSpotError, findContactId, pickDeal, readProperties } from "../lib/hubspot.mts";

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
  "net_income__1", "net_income__2", "total_monthly_after_tax_income__current_",
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
  "total_monthly_expenses__current_", "monthly_expenses__without_mortgage_",
  // Other debts & savings (reference only)
  "total_of_other_debts", "debts_being_consolidated", "total_savings",
];

export default async (req: Request) => {
  if (!hasValidSession(req)) return Response.json({ error: "Please log in again." }, { status: 401 });
  if (!Netlify.env.get("HUBSPOT_PRIVATE_KEY")) return Response.json({ error: "HubSpot is not configured." }, { status: 500 });

  let email = "";
  try {
    const body = await req.json();
    email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch { /* fall through */ }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });

  try {
    const contactId = await findContactId(email);
    if (!contactId) return Response.json({ error: `No HubSpot contact found for ${email}.` }, { status: 404 });
    const [contact, deal] = await Promise.all([readProperties("contacts", contactId, CONTACT_PROPS), pickDeal(contactId)]);
    const dealProps = deal ? await readProperties("deals", deal.id, DEAL_PROPS) : {};
    return Response.json({
      email,
      contact,
      deal: deal ? { id: deal.id, name: deal.properties?.dealname ?? "", properties: dealProps } : null,
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
