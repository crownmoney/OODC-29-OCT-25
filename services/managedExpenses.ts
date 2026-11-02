import { AppState, CarSetup, ExpenseItem, Frequency, FutureChange, FutureLumpSum, InsuranceItem } from '../types';
import { getMonthlyAmount } from '../hooks/useMortgageCalculations';

// The Car and Insurance sections on the Income & Expenses tab are the source
// of truth (appState.carSetup / appState.insurances). syncManagedItems turns
// them into ordinary expenses, a Planned Change and a one-off payment, tagged
// `managed`, so every existing calculation, report and the Zapier upload pick
// them up without special handling.

export const DEFAULT_CAR_SETUP: CarSetup = {
  maintenance: { amount: null, frequency: 'annually' },
  insurance: { amount: null, frequency: 'annually' },
  rego: { amount: null, frequency: 'annually' },
  isFuture: false,
  futureStartDate: '',
  hasLease: null,
  balloonAmount: null,
  balloonDate: '',
};

export const DEFAULT_INSURANCES: InsuranceItem[] = [
  { key: 'health', name: 'Health Insurance', amount: null, frequency: 'monthly' },
  { key: 'house', name: 'House Insurance', amount: null, frequency: 'annually' },
  { key: 'pet', name: 'Pet Insurance', amount: null, frequency: 'monthly' },
  { key: 'income', name: 'Income Protection', amount: null, frequency: 'monthly' },
  { key: 'life', name: 'Life Insurance', amount: null, frequency: 'monthly' },
  { key: 'other', name: 'Other Insurance', amount: null, frequency: 'monthly' },
];

const CAR_FIELDS = [
  { field: 'maintenance', name: 'Car Maintenance', id: -1001 },
  { field: 'insurance', name: 'Car Insurance', id: -1002 },
  { field: 'rego', name: 'Car Rego', id: -1003 },
] as const;

const INSURANCE_ID_BASE = -1100;

export const syncManagedItems = (state: AppState): AppState => {
  const car = state.carSetup;
  const insurances = state.insurances ?? [];

  const expenses: ExpenseItem[] = (state.expenses ?? []).filter(e => !e.managed);
  const futureChanges: FutureChange[] = (state.futureChanges ?? []).filter(c => !c.managed);
  const futureLumpSums: FutureLumpSum[] = (state.futureLumpSums ?? []).filter(l => !l.managed);

  if (car) {
    const carStartsLater = car.isFuture && !!car.futureStartDate;
    if (!carStartsLater) {
      // Current costs: count them now (only once answered).
      CAR_FIELDS.forEach(({ field, name, id }) => {
        const cost = car[field];
        if (cost.amount !== null) {
          expenses.push({ id, name, amount: cost.amount, frequency: cost.frequency, category: 'Hard Expenses', managed: 'car' });
        }
      });
    } else {
      // Future costs: add the combined monthly amount from the chosen date.
      const monthly = CAR_FIELDS.reduce((sum, { field }) => {
        const cost = car[field];
        return sum + (cost.amount ? getMonthlyAmount(cost.amount, cost.frequency) : 0);
      }, 0);
      if (monthly > 0) {
        futureChanges.push({
          id: -1010,
          type: 'expense',
          description: 'Future car costs (maintenance, insurance, rego)',
          changeAmount: Math.round(monthly * 100) / 100,
          frequency: 'monthly',
          startDate: car.futureStartDate,
          endDate: '2099-12-31',
          isPermanent: true,
          managed: 'car',
        });
      }
    }

    if (car.hasLease && car.balloonAmount && car.balloonAmount > 0 && car.balloonDate) {
      futureLumpSums.push({
        id: -1020,
        type: 'expense',
        amount: car.balloonAmount,
        date: car.balloonDate,
        description: 'Car lease balloon payment',
        managed: 'car',
      });
    }
  }

  insurances.forEach((ins, i) => {
    if (ins.amount !== null) {
      expenses.push({
        id: INSURANCE_ID_BASE - i,
        name: ins.name,
        amount: ins.amount,
        frequency: ins.frequency,
        category: 'Hard Expenses',
        managed: 'insurance',
      });
    }
  });

  return { ...state, expenses, futureChanges, futureLumpSums };
};

// Routes a pasted/imported expense into the Car or Insurance section when its
// name clearly matches one of those fields, so it isn't counted twice.
const CAR_NAME_MATCHERS: [RegExp, 'maintenance' | 'insurance' | 'rego'][] = [
  [/car.*(maint|servic|repair)/i, 'maintenance'],
  [/car.*insur|insur.*car|vehicle.*insur/i, 'insurance'],
  [/rego|registration/i, 'rego'],
];
const INSURANCE_NAME_MATCHERS: [RegExp, InsuranceItem['key']][] = [
  [/health/i, 'health'],
  [/(house|home|contents|building).*insur|insur.*(house|home|contents)/i, 'house'],
  [/pet/i, 'pet'],
  [/income\s*protection/i, 'income'],
  [/life/i, 'life'],
];

export const routeToManaged = (
  state: AppState,
  item: { name: string; amount: number; frequency: Frequency },
): AppState | null => {
  const name = item.name || '';
  const carMatch = CAR_NAME_MATCHERS.find(([re]) => re.test(name));
  if (carMatch) {
    const car = state.carSetup ?? DEFAULT_CAR_SETUP;
    return { ...state, carSetup: { ...car, [carMatch[1]]: { amount: item.amount, frequency: item.frequency } } };
  }
  if (/insur|protection/i.test(name)) {
    const key = INSURANCE_NAME_MATCHERS.find(([re]) => re.test(name))?.[1];
    if (key) {
      const list = state.insurances ?? DEFAULT_INSURANCES;
      return { ...state, insurances: list.map(i => (i.key === key ? { ...i, amount: item.amount, frequency: item.frequency } : i)) };
    }
  }
  return null;
};
