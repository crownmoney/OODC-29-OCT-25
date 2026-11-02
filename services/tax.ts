// ---------------------------------------------------------------------------
// Australian resident tax, 2026–27 income year (1 July 2026 – 30 June 2027).
// Rates per the legislated Stage 3 schedule with the 15% bracket from
// 1 July 2026. Medicare levy 2% with the low-income phase-in (singles).
// Low Income Tax Offset (LITO) included. Excludes HELP/HECS repayments,
// Medicare levy surcharge, family thresholds and other offsets.
// ---------------------------------------------------------------------------
export const TAX_YEAR_LABEL = '2026–27';
export const BRACKETS = [
  { from: 0, to: 18_200, rate: 0 },
  { from: 18_200, to: 45_000, rate: 0.15 },
  { from: 45_000, to: 135_000, rate: 0.30 },
  { from: 135_000, to: 190_000, rate: 0.37 },
  { from: 190_000, to: Infinity, rate: 0.45 },
];
const MEDICARE_RATE = 0.02;
const MEDICARE_LOWER = 27_222; // single low-income threshold (approx.)
const MEDICARE_UPPER = 34_027; // phase-in ends
export const SUPER_GUARANTEE = 0.12;

const incomeTax = (taxable: number) =>
  BRACKETS.reduce((tax, b) => tax + Math.max(0, Math.min(taxable, b.to) - b.from) * b.rate, 0);

const lito = (taxable: number) => {
  if (taxable <= 37_500) return 700;
  if (taxable <= 45_000) return 700 - (taxable - 37_500) * 0.05;
  if (taxable <= 66_667) return 325 - (taxable - 45_000) * 0.015;
  return 0;
};

const medicare = (taxable: number) => {
  if (taxable <= MEDICARE_LOWER) return 0;
  if (taxable <= MEDICARE_UPPER) return (taxable - MEDICARE_LOWER) * 0.1;
  return taxable * MEDICARE_RATE;
};

export const takeHome = (grossAnnual: number) => {
  const gross = Math.max(0, grossAnnual);
  const tax = Math.max(0, incomeTax(gross) - lito(gross));
  const levy = medicare(gross);
  const net = gross - tax - levy;
  const marginal = BRACKETS.find(b => gross > b.from && gross <= b.to)?.rate ?? 0;
  return { gross, tax, levy, net, marginal, average: gross ? (tax + levy) / gross : 0 };
};

// Net -> gross by bisection (take-home is monotonic in gross).
export const grossFromNet = (netAnnual: number) => {
  let lo = 0, hi = Math.max(1_000, netAnnual * 2.5);
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (takeHome(mid).net < netAnnual) lo = mid; else hi = mid;
  }
  return hi;
};
