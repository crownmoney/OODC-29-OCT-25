
export enum Tab {
  HealthCheck = 'health-check',
  CurrentLoan = 'current-loan',
  InterestBreakdown = 'interest-breakdown',
  InvestmentProperties = 'investment-properties',
  IncomeExpenses = 'income-expenses',
  OODC = 'oodc',
  InvestmentOODC = 'investment-oodc',
  DebtRecycling = 'debt-recycling',
  In2Wealth = 'in2wealth',
  Reports = 'reports',
  Summary = 'summary',
}

export interface HealthCheckState {
  answers: Record<number, boolean | null>;
  debtFreeAgeCurrentPath?: number | string;
  retirementTargetAge?: number | string;
  financialWorryNote?: string;
}

export type Frequency = 'weekly' | 'fortnightly' | 'monthly' | 'annually' | 'quarterly';
export type LoanFrequency = 'weekly' | 'fortnightly' | 'monthly';

export interface ExpenseItem {
  id: number;
  name: string;
  amount: number;
  category: string;
  frequency: Frequency;
  isImported?: boolean;
  /** Set on items generated from the Car / Insurance sections; edited there, not in the generic list. */
  managed?: 'car' | 'insurance';
}

/** A cost the agent must answer; null = not answered yet (0 is a valid answer). */
export interface RequiredCost {
  amount: number | null;
  frequency: Frequency;
}

export interface CarSetup {
  maintenance: RequiredCost;
  insurance: RequiredCost;
  rego: RequiredCost;
  /** Car costs don't exist yet; they start on futureStartDate. */
  isFuture: boolean;
  futureStartDate: string;
  hasLease: boolean | null;
  balloonAmount: number | null;
  balloonDate: string;
}

export interface InsuranceItem {
  key: 'health' | 'house' | 'pet' | 'income' | 'life' | 'other';
  name: string;
  amount: number | null;
  frequency: Frequency;
}

export interface CustomSection {
  id: string;
  tab: string;
  title: string;
  html: string;
}

export interface Person {
  id: number;
  name: string;
  age: number;
}

export interface IncomeItem {
  id: number;
  name: string;
  amount: number;
  frequency: Frequency;
  isImported?: boolean;
}

export interface OtherDebt {
  id: number;
  name: string;
  amount: number;
  interestRate: number;
  repayment: number;
  frequency: Frequency;
  remainingTerm: number;
}

export interface FutureChange {
  id: number;
  type: 'income' | 'expense';
  startDate: string;
  endDate: string;
  isPermanent: boolean;
  changeAmount: number;
  frequency: Frequency;
  description: string;
  name?: string;
  amount?: number;
  startYear?: number;
  duration?: number;
  managed?: 'car' | 'insurance';
}

export interface FutureLumpSum {
  id: number;
  amount: number;
  date: string;
  description?: string;
  type: 'income' | 'expense';
  name?: string;
  year?: number;
  managed?: 'car' | 'insurance';
}

export interface InvestmentPropertyExpense {
  id: number;
  name: string;
  amount: number;
  frequency: Frequency;
}

export interface InvestmentProperty {
  id: number;
  name?: string;
  value?: number;
  propertyValue?: number;
  loanAmount: number;
  interestRate: number;
  rent?: number;
  rentalIncome: number;
  rentalIncomeFrequency: Frequency;
  expenses: InvestmentPropertyExpense[];
  growthRate?: number;
  rentalGrowthRate?: number;
  address?: string;
  purchaseDate?: string;
  isFuture?: boolean;
  crownSettings?: {
    interestRate?: number;
    loanType?: 'P&I' | 'IO';
    repayment?: number;
    interestOnlyTerm?: number;
    repaymentFrequency?: Frequency;
  };
  offsetBalance?: number;
  repayment: number;
  repaymentFrequency: Frequency;
  loanType?: 'P&I' | 'IO';
  loanTerm?: number;
  interestOnlyTerm?: number;
  loanStartDate?: string;
}

export interface LoanDetails {
  amount: number;
  propertyValue: number;
  interestRate: number;
  repayment: number;
  frequency: Frequency;
  offsetBalance: number;
  loanType?: 'P&I' | 'IO';
  loanTerm?: number;
  interestOnlyTerm?: number;
  propertyName?: string;
}

export interface AmortizationDataPoint {
  month: number;
  balance?: number;
  remainingBalance: number;
  interest?: number;
  interestPaid: number;
  principal?: number;
  principalPaid: number;
  offsetBenefit?: number;
  cumulativeInterest?: number;
  offsetBalance: number;
}

export interface LoanSummary {
  termInYears: number;
  totalInterest: number;
  totalPrincipal?: number;
  totalPaid: number;
  payoffMonths?: number;
  payoffYears?: number;
  monthlyRepayment?: number;
  amortizationSchedule: AmortizationDataPoint[];
  errorMessage?: string;
}

export interface AppState {
  loan: LoanDetails;
  people: Person[];
  incomes: IncomeItem[];
  expenses: ExpenseItem[];
  otherDebts: OtherDebt[];
  futureChanges: FutureChange[];
  futureLumpSums: FutureLumpSum[];
  investmentProperties: InvestmentProperty[];
  crownMoneyInterestRate: number;
  clientEmail: string;
  clientPhone: string;
  investmentAmountPercentage: number;
  investmentGrowthRate: number;
  investmentRate: number;
  idealRetirementAge: number;
  propertyGrowthRate: number;
  payoffStrategy: string;
  currentLender: string;
  numberOfKids: number;
  allPartiesInAttendance: string;
  debtRecyclingEnabled: boolean;
  debtRecyclingInvestmentRate: number;
  debtRecyclingLoanInterestRate: number;
  marginalTaxRate: number;
  debtRecyclingPercentage: number;
  notepadContent: string;
  incomeExpensesNotes: string;
  investmentCashflowScenario: 'bank' | 'crown' | string;
  customSections: CustomSection[];
  investmentPropertyTaxRate: number;
  healthCheck?: HealthCheckState;
  householdType?: 'couple' | 'single' | 'other';
  carSetup?: CarSetup;
  insurances?: InsuranceItem[];
  benchmarkIncomeBand?: 'under-120k' | '120k-150k' | '150k-180k' | '180k-plus';
}

