import { AppState, RequiredCost } from '../types';
import { getMonthlyAmount } from '../hooks/useMortgageCalculations';
import { HOUSEHOLD_LABELS, getBenchmarkResult } from '../data/householdBenchmarks';
import { DEFAULT_CAR_SETUP, DEFAULT_INSURANCES } from './managedExpenses';
import { QUESTIONS as HEALTH_CHECK_QUESTIONS } from '../components/Tab_HealthCheck';

// Flat, top-level fields for the Zapier webhook so each answer can be mapped
// to its own HubSpot property. Unanswered values are sent as "" (not 0) so
// they can be told apart from a real $0 answer. The full appState is still
// sent in jsonData as before.

const money = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n);

const costFields = (prefix: string, cost: RequiredCost) => ({
  [`${prefix}_amount`]: cost.amount ?? '',
  [`${prefix}_frequency`]: cost.amount === null ? '' : cost.frequency,
  [`${prefix}_monthly`]: cost.amount === null ? '' : money(getMonthlyAmount(cost.amount, cost.frequency)),
});

const costText = (label: string, cost: RequiredCost) =>
  `${label}: ${cost.amount === null ? 'not entered' : `${fmt(cost.amount)} ${cost.frequency}`}`;

export const buildZapierFields = (appState: AppState) => {
  const b = getBenchmarkResult(appState, getMonthlyAmount);
  const car = appState.carSetup ?? DEFAULT_CAR_SETUP;
  const insurances = appState.insurances ?? DEFAULT_INSURANCES;
  const benchmarkMonthly = b.row.monthlyExpenses;
  const diff = benchmarkMonthly === null ? null : b.clientMonthlyLiving - benchmarkMonthly;
  const householdLabel = `${HOUSEHOLD_LABELS[b.household]} ${b.hasKids ? 'with kids' : 'with no kids'}`;

  const fields: Record<string, string | number | boolean> = {
    // Household benchmarks
    number_of_kids: appState.numberOfKids ?? 0,
    household_type: HOUSEHOLD_LABELS[b.household],
    household_category: householdLabel,
    household_annual_income: money(b.annualNetIncome),
    household_annual_income_before_tax_est: Math.round(b.annualIncome),
    benchmark_income_bracket: b.band.label,
    benchmark_income_bracket_source: b.bandIsAuto ? 'auto' : 'manual',
    benchmark_average_mortgage: b.band.averageMortgage,
    benchmark_monthly_expenses: benchmarkMonthly ?? '',
    benchmark_average_fff_weekly: b.row.averageFFF ?? '',
    client_monthly_living_expenses: money(b.clientMonthlyLiving),
    client_monthly_fff: money(b.clientMonthlyFFF),
    client_weekly_fff: money(b.clientMonthlyFFF * 12 / 52),
    client_vs_benchmark_fff_weekly: b.row.averageFFF === null ? '' : money(b.clientMonthlyFFF * 12 / 52 - b.row.averageFFF),
    client_vs_benchmark_monthly: diff === null ? '' : money(diff),

    // Car
    ...costFields('car_maintenance', car.maintenance),
    ...costFields('car_insurance', car.insurance),
    ...costFields('car_rego', car.rego),
    car_costs_future_change: car.isFuture,
    car_costs_start_date: car.isFuture ? car.futureStartDate : '',
    has_car_lease: car.hasLease === null ? '' : car.hasLease ? 'Yes' : 'No',
    car_lease_balloon_amount: car.hasLease ? car.balloonAmount ?? '' : '',
    car_lease_balloon_date: car.hasLease ? car.balloonDate : '',
  };

  insurances.forEach(i => Object.assign(fields, costFields(`insurance_${i.key}`, i)));

  // Money Health Check (same tiers as the Health Check tab)
  const hc = appState.healthCheck;
  const answers = hc?.answers ?? {};
  const yesCount = Object.values(answers).filter(v => v === true).length;
  const answeredCount = Object.values(answers).filter(v => v !== null && v !== undefined).length;
  const tier = yesCount <= 3 ? 'At Risk' : yesCount <= 6 ? 'Building' : yesCount <= 8 ? 'On Track' : 'Thriving';
  HEALTH_CHECK_QUESTIONS.forEach(q => {
    const a = answers[q.id];
    fields[`health_check_q${q.id}`] = a === true ? 'Yes' : a === false ? 'No' : '';
  });
  Object.assign(fields, {
    health_check_score: answeredCount ? yesCount : '',
    health_check_answered: answeredCount,
    health_check_tier: answeredCount ? tier : '',
    health_check_debt_free_age_current_path: hc?.debtFreeAgeCurrentPath ?? '',
    health_check_retirement_target_age: hc?.retirementTargetAge ?? '',
    health_check_financial_worry_note: hc?.financialWorryNote ?? '',
  });

  const lines = [
    'OUT OF DEBT CALCULATOR – NEW QUESTIONS',
    `Household: ${householdLabel} (${appState.numberOfKids ?? 0} kids)`,
    `Income: ${fmt(b.annualNetIncome)} after tax (≈ ${fmt(b.annualIncome)} before tax)`,
    `Income bracket (before tax): ${b.band.label}${b.bandIsAuto ? ' (auto)' : ' (set manually)'}`,
    benchmarkMonthly === null
      ? 'Benchmark: no figures for this household type'
      : `Benchmark monthly expenses: ${fmt(benchmarkMonthly)} | Client: ${fmt(b.clientMonthlyLiving)} (${diff! >= 0 ? fmt(diff!) + ' above' : fmt(-diff!) + ' below'})`,
    b.row.averageFFF === null ? '' : `Benchmark FFF: ${fmt(b.row.averageFFF)}/week | Client FFF: ${fmt(b.clientMonthlyFFF * 12 / 52)}/week`,
    '',
    'CAR',
    costText('Maintenance', car.maintenance),
    costText('Insurance', car.insurance),
    costText('Rego', car.rego),
    car.isFuture ? `Future change: costs start ${car.futureStartDate || '(date not set)'}` : 'Costs apply now',
    `Existing car lease: ${car.hasLease === null ? 'not answered' : car.hasLease ? 'Yes' : 'No'}`,
    car.hasLease ? `Balloon payment: ${car.balloonAmount === null ? 'not entered' : fmt(car.balloonAmount)} on ${car.balloonDate || '(date not set)'}` : '',
    '',
    'INSURANCE (optional)',
    ...(() => {
      const entered = [...insurances, { name: 'Car Insurance', ...car.insurance }].filter(i => i.amount !== null);
      return entered.length ? entered.map(i => costText(i.name, i)) : ['None entered'];
    })(),
    '',
    'MONEY HEALTH CHECK',
    answeredCount ? `Score: ${yesCount}/10 (${tier}), ${answeredCount}/10 answered` : 'Not answered',
    ...HEALTH_CHECK_QUESTIONS.filter(q => answers[q.id] !== null && answers[q.id] !== undefined)
      .map(q => `${answers[q.id] ? 'YES' : 'NO'} – ${q.statement}`),
    hc?.financialWorryNote ? `Biggest financial worry: ${hc.financialWorryNote}` : '',
  ].filter(l => l !== null);

  return { fields, summaryNote: lines.join('\n').replace(/\n{3,}/g, '\n\n') };
};
