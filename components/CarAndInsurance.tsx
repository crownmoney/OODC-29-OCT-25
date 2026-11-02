import React from 'react';
import { AppState, CarSetup, Frequency, InsuranceItem, RequiredCost } from '../types';
import { DEFAULT_CAR_SETUP, DEFAULT_INSURANCES, syncManagedItems } from '../services/managedExpenses';
import { Car, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
}

const inputBase = "bg-[var(--input-bg-color)] p-2 rounded border focus:outline-none focus:ring-2 focus:ring-[var(--input-border-focus-color)]";
const ok = "border-[var(--input-border-color)]";
const missing = "border-amber-500 ring-1 ring-amber-400";

const FREQUENCIES: Frequency[] = ['weekly', 'fortnightly', 'monthly', 'quarterly', 'annually'];

const parseAmount = (v: string): number | null => (v.trim() === '' ? null : Math.max(0, parseFloat(v) || 0));

const CostRow: React.FC<{
  label: string;
  cost: RequiredCost;
  onChange: (cost: RequiredCost) => void;
  hint?: string;
  optional?: boolean;
}> = ({ label, cost, onChange, hint, optional = false }) => {
  const unanswered = cost.amount === null && !optional;
  return (
    <div>
      <div className="grid grid-cols-12 gap-2 items-center print:hidden">
        <label className="col-span-4 text-sm font-medium text-[var(--text-color)]">
          {label} {!optional && <span className="text-amber-600">*</span>}
        </label>
        <input
          type="number"
          min="0"
          inputMode="decimal"
          aria-label={`${label} amount`}
          value={cost.amount ?? ''}
          onChange={e => onChange({ ...cost, amount: parseAmount(e.target.value) })}
          className={`col-span-4 ${inputBase} ${unanswered ? missing : ok}`}
          placeholder={optional ? 'Optional' : '0 if none'}
        />
        <select
          aria-label={`${label} frequency`}
          value={cost.frequency}
          onChange={e => onChange({ ...cost, frequency: e.target.value as Frequency })}
          className={`custom-select col-span-4 ${inputBase} ${ok}`}
        >
          {FREQUENCIES.map(f => <option key={f} value={f}>{f[0].toUpperCase() + f.slice(1)}</option>)}
        </select>
      </div>
      {unanswered && <p className="text-[10px] text-amber-600 font-semibold mt-1 ml-1 print:hidden">Required: enter an amount, or 0 if none{hint ? ` (${hint})` : ''}</p>}
      <p className="hidden print:block text-sm text-black">{label}: {cost.amount === null ? 'not entered' : `$${cost.amount} ${cost.frequency}`}</p>
    </div>
  );
};

const SectionHeader: React.FC<{ icon: React.ElementType; title: string; subtitle: string; remaining?: number; total?: number }> = ({ icon: Icon, title, subtitle, remaining, total }) => (
  <div className="flex items-start justify-between gap-3">
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--title-color)]/10 text-[var(--title-color)] print:hidden">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <h4 className="text-md font-bold text-[var(--text-color)] print:text-black">{title}</h4>
        <p className="text-xs text-[var(--text-color-muted)] print:hidden">{subtitle}</p>
      </div>
    </div>
    {total !== undefined && remaining !== undefined && <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider print:hidden ${remaining ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
      {remaining ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
      {remaining ? `${total - remaining} of ${total} answered` : 'All answered'}
    </span>}
  </div>
);

const CarAndInsurance: React.FC<Props> = ({ appState, setAppState }) => {
  const car = appState.carSetup ?? DEFAULT_CAR_SETUP;
  const insurances = appState.insurances ?? DEFAULT_INSURANCES;

  const update = (patch: Partial<AppState>) =>
    setAppState(prev => syncManagedItems({
      ...prev,
      carSetup: prev.carSetup ?? DEFAULT_CAR_SETUP,
      insurances: prev.insurances ?? DEFAULT_INSURANCES,
      ...patch,
    }));

  const updateCar = (patch: Partial<CarSetup>) => update({ carSetup: { ...car, ...patch } });
  const updateInsurance = (key: InsuranceItem['key'], patch: Partial<InsuranceItem>) =>
    update({ insurances: insurances.map(i => (i.key === key ? { ...i, ...patch } : i)) });

  const carUnanswered = [car.maintenance, car.insurance, car.rego].filter(c => c.amount === null).length;

  return (
    <div className="space-y-6 mt-6">
      {/* Car */}
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg-color)] p-5 space-y-3 shadow-sm">
        <SectionHeader icon={Car} title="Car" subtitle="Include all cars in the household. Enter 0 if a cost doesn't apply." remaining={carUnanswered + (car.hasLease === null ? 1 : 0)} total={4} />
        <CostRow label="Car Maintenance" cost={car.maintenance} onChange={c => updateCar({ maintenance: c })} />
        <CostRow label="Car Insurance" cost={car.insurance} onChange={c => updateCar({ insurance: c })} />
        <CostRow label="Car Rego" cost={car.rego} onChange={c => updateCar({ rego: c })} />

        <div className="pt-2 border-t border-dashed border-[var(--border-color)] print:hidden">
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={car.isFuture}
              onChange={e => updateCar({ isFuture: e.target.checked })}
              className="mt-1"
            />
            <span>
              <span className="font-semibold">Future change</span>
              <span className="block text-xs text-[var(--text-color-muted)]">
                Tick if these car costs don't apply yet (e.g. car lease finishing, or buying a car later). They'll start from the date below instead of now.
              </span>
            </span>
          </label>
          {car.isFuture && (
            <div className="mt-2 ml-6">
              <label className="block text-xs font-medium text-[var(--text-color-muted)] mb-1">Costs start from <span className="text-amber-600">*</span></label>
              <input
                type="date"
                value={car.futureStartDate}
                onChange={e => updateCar({ futureStartDate: e.target.value })}
                className={`custom-date-input ${inputBase} ${car.futureStartDate ? ok : missing}`}
              />
              {!car.futureStartDate && <p className="text-[10px] text-amber-600 font-semibold mt-1">Pick a start date. Until then these costs aren't counted.</p>}
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-dashed border-[var(--border-color)] print:hidden">
          <p className="text-sm font-semibold">Is there an existing car lease? <span className="text-amber-600">*</span></p>
          <div className="flex gap-4 mt-1">
            {([['Yes', true], ['No', false]] as const).map(([label, val]) => (
              <label key={label} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="radio" name="hasLease" checked={car.hasLease === val} onChange={() => updateCar({ hasLease: val })} />
                {label}
              </label>
            ))}
          </div>
          {car.hasLease === null && <p className="text-[10px] text-amber-600 font-semibold mt-1">Required: answer Yes or No</p>}
          {car.hasLease && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 ml-6">
              <div>
                <label className="block text-xs font-medium text-[var(--text-color-muted)] mb-1">Balloon payment amount <span className="text-amber-600">*</span></label>
                <input
                  type="number"
                  min="0"
                  value={car.balloonAmount ?? ''}
                  onChange={e => updateCar({ balloonAmount: parseAmount(e.target.value) })}
                  className={`w-full ${inputBase} ${car.balloonAmount === null ? missing : ok}`}
                  placeholder="Estimated balloon ($)"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-color-muted)] mb-1">Balloon payment date <span className="text-amber-600">*</span></label>
                <input
                  type="date"
                  value={car.balloonDate}
                  onChange={e => updateCar({ balloonDate: e.target.value })}
                  className={`custom-date-input w-full ${inputBase} ${car.balloonDate ? ok : missing}`}
                />
              </div>
              <p className="sm:col-span-2 text-xs text-[var(--text-color-muted)]">
                A rough estimate is fine. It's included as a one-off payment on that date.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Insurance */}
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg-color)] p-5 space-y-3 shadow-sm">
        <SectionHeader icon={ShieldCheck} title="Insurance" subtitle="Optional. Add any policies you hold." />
        {insurances.slice(0, 2).map(i => (
          <CostRow key={i.key} label={i.name} cost={i} onChange={c => updateInsurance(i.key, c)} optional />
        ))}
        <CostRow label="Car Insurance" cost={car.insurance} onChange={c => updateCar({ insurance: c })} optional />
        {insurances.slice(2).map(i => (
          <CostRow key={i.key} label={i.name} cost={i} onChange={c => updateInsurance(i.key, c)} optional />
        ))}
      </div>
    </div>
  );
};

export default CarAndInsurance;
