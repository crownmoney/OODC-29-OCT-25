import React, { useState, useEffect, useMemo } from 'react';
import { askAI } from '../services/api';
import HouseholdBenchmarks, { BenchmarkHint } from './HouseholdBenchmarks';
import { grossFromNet, TAX_YEAR_LABEL } from '../services/tax';
import CarAndInsurance from './CarAndInsurance';
import { routeToManaged, syncManagedItems } from '../services/managedExpenses';
import Modal from './common/Modal';
import { AppState, IncomeItem, ExpenseItem, FutureChange, FutureLumpSum, LoanDetails, LoanSummary } from '../types';
import Card from './common/Card';
import Tooltip from './common/Tooltip';
import { InfoIcon, CalendarIcon } from './common/IconComponents';
import { calculateAmortization } from '../hooks/useMortgageCalculations';

const formatDateForDisplay = (isoDate: string): string => {
    if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
        return '';
    }
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
};

// --- New Component for FutureChange Impact Analysis ---
const FutureChangeImpactDisplay: React.FC<{
    appState: AppState;
    futureChange: FutureChange;
    calculations: any;
}> = React.memo(({ appState, futureChange, calculations }) => {
    const [showExplanation, setShowExplanation] = useState(false);
    
    const formatCurrency = (value: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
    const formatYears = (value: number) => {
        if (!isFinite(value) || isNaN(value)) return 'N/A';
        return `${value.toFixed(1)} years`;
    };

    const impact = useMemo(() => {
        if (!futureChange.startDate || futureChange.changeAmount === 0 || !futureChange.description) {
            return { bankText: '', crownText: '', isCalculable: false };
        }

        const { loan, futureChanges, futureLumpSums, crownMoneyInterestRate, otherDebts } = appState;
        const { crownSurplus } = calculations; // Uses Crown Surplus

        // The "impacted" calculation is the main one from the app, which includes everything.
        const crownImpactedCalc = calculations.crownMoneyLoanCalculation;

        // To get the "baseline", we manually calculate the scenario WITHOUT this specific future change.
        const baselineFutureChanges = futureChanges.filter(c => c.id !== futureChange.id);

        const consolidatedAmount = (otherDebts || []).reduce((sum, d) => sum + d.amount, 0);
        const crownLoanForCalc = {
            amount: (loan.amount + consolidatedAmount) - (loan.offsetBalance || 0),
            interestRate: crownMoneyInterestRate,
            repayment: crownSurplus,
            frequency: 'monthly' as const,
            offsetBalance: 0,
        };

        const crownBaselineCalc = calculateAmortization(crownLoanForCalc, {
            futureChanges: baselineFutureChanges,
            futureLumpSums: futureLumpSums,
            strategy: 'crown'
        });

        if (crownBaselineCalc.termInYears === Infinity || crownImpactedCalc.termInYears === Infinity) {
            return { bankText: 'Impact cannot be calculated (loan may not be payable).', crownText: '', isCalculable: false };
        }

        const createImpactText = (baseline: LoanSummary, impacted: LoanSummary, scenario: string) => {
            const termDiff = baseline.termInYears - impacted.termInYears;
            const interestDiff = baseline.totalInterest - impacted.totalInterest;

            if (Math.abs(termDiff) < 1/24 && Math.abs(interestDiff) < 100) {
                return `No significant impact for ${scenario}.`;
            }

            const termText = termDiff > 0 ? `saves ${formatYears(termDiff)}` : `adds ${formatYears(Math.abs(termDiff))}`;
            const interestText = interestDiff > 0 ? `saves ${formatCurrency(interestDiff)}` : `costs ${formatCurrency(Math.abs(interestDiff))}`;

            return `${scenario}: ${termText} & ${interestText}.`;
        };

        const bankText = "Bank: No significant impact."; // Hardcoded as bank scenario is unaffected by surplus changes.
        const crownText = createImpactText(crownBaselineCalc, crownImpactedCalc, "Crown");
        
        return { bankText, crownText, isCalculable: true };

    }, [appState, futureChange, calculations]);
    
    if (!impact.isCalculable) return null;

    // Determine if the change is positive (more surplus) or negative (less surplus)
    // Increase Income -> Positive
    // Decrease Expense -> Positive
    // Decrease Income -> Negative
    // Increase Expense -> Negative
    const isIncreaseAction = futureChange.changeAmount >= 0;
    const isPositiveChange = (futureChange.type === 'income' && isIncreaseAction) || (futureChange.type === 'expense' && !isIncreaseAction);

    const color = isPositiveChange ? 'var(--color-positive-text)' : 'var(--color-negative-text)';
    const bgColor = isPositiveChange ? 'var(--color-positive-bg)' : 'var(--color-negative-bg)';

    return (
        <div className="mt-2 p-3 text-left rounded-lg text-sm" style={{ backgroundColor: bgColor }}>
            <p className="font-bold text-center mb-2" style={{ color }}>Impact Analysis</p>
            <ul className="space-y-1 text-xs">
                <li style={{ color }}>{impact.bankText}</li>
                <li style={{ color }}>{impact.crownText}</li>
            </ul>
            <button 
                onClick={() => setShowExplanation(!showExplanation)}
                className="text-xs text-center w-full mt-2 font-semibold underline decoration-dotted"
                style={{ color }}
            >
                {showExplanation ? 'Hide Explanation' : 'Why are the impacts different?'}
            </button>
            {showExplanation && (
                <div className="mt-2 text-xs border-t pt-2 space-y-2" style={{ borderColor: `${color}80`, color }}>
                    <p className="font-bold">Why the Bank Scenario is unaffected:</p>
                    <p className="mt-1">
                        The Bank scenario assumes you continue to make only your standard, fixed repayments. Any extra income or expenses are handled separately and do not automatically affect the loan.
                    </p>
                    <p className="font-bold mt-2">Why the Crown Money Scenario changes:</p>
                    <p className="mt-1">
                        The Crown strategy uses your <strong>entire</strong> budget surplus to aggressively pay down debt. Any change to your income or expenses directly alters your monthly surplus, which in turn changes the repayment amount. This has a powerful and direct effect on how quickly you pay off the loan and how much interest you save.
                    </p>
                </div>
            )}
        </div>
    );
});


// --- Extracted Component for Future Changes ---
interface FutureChangesSectionProps {
    futureChanges: FutureChange[];
    incomes: IncomeItem[];
    expenses: ExpenseItem[];
    setAppState: React.Dispatch<React.SetStateAction<AppState>>;
    appState: AppState;
    calculations: any;
}

const FutureChangesSection: React.FC<FutureChangesSectionProps> = React.memo(({ futureChanges, incomes, expenses, setAppState, appState, calculations }) => {
    const [customEvent, setCustomEvent] = useState<Record<number, boolean>>({});
    const [focusedDateField, setFocusedDateField] = useState<string | null>(null);

    useEffect(() => {
        const allItems = new Set([...(incomes || []).map(i => i.name), ...(expenses || []).map(e => e.name)]);
        const initialCustomState = futureChanges.reduce((acc, change) => {
            if (!allItems.has(change.description)) {
                acc[change.id] = true;
            } else {
                acc[change.id] = false;
            }
            return acc;
        }, {} as Record<number, boolean>);
        setCustomEvent(initialCustomState);
    }, [futureChanges, incomes, expenses]);

    const handleListChange = (index: number, field: keyof FutureChange, value: any) => {
        setAppState(prev => {
            const newList = [...prev.futureChanges];
            const item = newList[index];
            let processedValue = value;
            if (field === 'isPermanent') {
                processedValue = Boolean(value);
            }
            newList[index] = { ...item, [field]: processedValue };
            return { ...prev, futureChanges: newList };
        });
    };

    const removeListItem = (id: number) => {
        setAppState(prev => ({
            ...prev,
            futureChanges: prev.futureChanges.filter(item => item.id !== id)
        }));
    };

    const handleDescriptionChange = (e: React.ChangeEvent<HTMLSelectElement>, index: number) => {
        const value = e.target.value;
        const isCustom = value === 'custom';

        setCustomEvent(prev => ({ ...prev, [futureChanges[index].id]: isCustom }));

        if (isCustom) {
            handleListChange(index, 'description', '');
        } else {
            const [type, name] = value.split(':');
            const newDescription = name || '';
            const newType = (type === 'income' || type === 'expense') ? type : 'expense';

            setAppState(prev => {
                const newList = [...prev.futureChanges];
                newList[index] = { ...newList[index], description: newDescription, type: newType };
                return { ...prev, futureChanges: newList };
            });
        }
    };
    
    const formatCurrency = (value: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
    
    const inputClasses = "w-full bg-[var(--input-bg-color)] p-2 rounded border border-[var(--input-border-color)] focus:outline-none focus:ring-2 focus:ring-[var(--input-border-focus-color)]";
    const selectClasses = `custom-select ${inputClasses}`;

    return (
        <div className="space-y-4">
            <p className="text-sm text-[var(--text-color-muted)] mb-4 -mt-2 print:hidden">
                Plan for known, ongoing changes to your budget. For example: a pay rise, a child's daycare fees stopping, or a temporary change in income. This helps create a more accurate long-term forecast.
            </p>
            {(futureChanges || []).map((change, index) => {
                if (change.managed) {
                    return (
                        <div key={change.id} className="p-3 rounded-lg border border-dashed border-[var(--border-color)] text-sm text-[var(--text-color-muted)] print:hidden">
                            <span className="font-semibold text-[var(--text-color)]">{change.description}</span>: {formatCurrency(change.changeAmount)}/month from {formatDateForDisplay(change.startDate)}. Edit in Hard Expenses › Car.
                        </div>
                    );
                }
                const startDateKey = `start-${change.id}`;
                const isStartDateFocused = focusedDateField === startDateKey;
                
                const endDateKey = `end-${change.id}`;
                const isEndDateFocused = focusedDateField === endDateKey;

                return (
                    <div key={change.id} className="p-4 bg-black/10 dark:bg-white/5 rounded-lg relative space-y-4 print:hidden">
                        <button onClick={() => removeListItem(change.id)} className="absolute top-2 right-2 text-red-400 hover:text-red-600 text-2xl font-bold z-10">×</button>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-color-muted)] mb-1">Description</label>
                                <select
                                    value={customEvent[change.id] ? 'custom' : `${change.type}:${change.description}`}
                                    onChange={e => handleDescriptionChange(e, index)}
                                    className={selectClasses}
                                >
                                    <option value="" disabled>Select or create an event...</option>
                                    <optgroup label="Incomes">
                                        {(incomes || []).map(i => <option key={`inc-${i.id}`} value={`income:${i.name}`}>{i.name}</option>)}
                                    </optgroup>
                                    <optgroup label="Expenses">
                                        {(expenses || []).map(e => <option key={`exp-${e.id}`} value={`expense:${e.name}`}>{e.name}</option>)}
                                    </optgroup>
                                    <option value="custom">— New Custom Event —</option>
                                </select>
                            </div>
                            {customEvent[change.id] && (
                                 <div>
                                    <label className="block text-xs font-medium text-[var(--text-color-muted)] mb-1">Custom Description</label>
                                    <input
                                        type="text"
                                        value={change.description}
                                        onChange={e => handleListChange(index, 'description', e.target.value)}
                                        className={inputClasses}
                                        placeholder="e.g. New Side Hustle"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-color-muted)] mb-1">Type</label>
                                <select
                                    value={change.type}
                                    onChange={e => handleListChange(index, 'type', e.target.value)}
                                    className={selectClasses}
                                    disabled={!customEvent[change.id]}
                                >
                                    <option value="income">Income</option>
                                    <option value="expense">Expense</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-color-muted)] mb-1">Action</label>
                                <select
                                    value={change.changeAmount >= 0 ? 'increase' : 'decrease'}
                                    onChange={e => {
                                        const newSign = e.target.value === 'increase' ? 1 : -1;
                                        const currentAmount = Math.abs(change.changeAmount);
                                        handleListChange(index, 'changeAmount', currentAmount * newSign);
                                    }}
                                    className={selectClasses}
                                >
                                    <option value="increase">Starts / Increases</option>
                                    <option value="decrease">Stops / Decreases</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-color-muted)] mb-1">By Amount</label>
                                <input
                                    type="number"
                                    value={Math.abs(change.changeAmount)}
                                    onChange={e => {
                                        const newAmount = parseFloat(e.target.value) || 0;
                                        const sign = change.changeAmount >= 0 ? 1 : -1;
                                        handleListChange(index, 'changeAmount', newAmount * sign);
                                    }}
                                    className={inputClasses}
                                    placeholder="e.g., 800"
                                    min="0"
                                />
                            </div>
                             <div>
                                <label className="block text-xs font-medium text-[var(--text-color-muted)] mb-1">Frequency</label>
                                <select
                                    value={change.frequency}
                                    onChange={e => handleListChange(index, 'frequency', e.target.value)}
                                    className={selectClasses}
                                >
                                    <option value="weekly">Weekly</option>
                                    <option value="fortnightly">Fortnightly</option>
                                    <option value="monthly">Monthly</option>
                                    <option value="quarterly">Quarterly</option>
                                    <option value="annually">Annually</option>
                                </select>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                             <div>
                                <label className="block text-xs font-medium text-[var(--text-color-muted)] mb-1">Start Date</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                        <CalendarIcon className="h-5 w-5 text-[var(--text-color-muted)]" />
                                    </div>
                                    <input
                                        type={isStartDateFocused ? 'date' : 'text'}
                                        value={isStartDateFocused ? change.startDate : formatDateForDisplay(change.startDate)}
                                        onFocus={() => setFocusedDateField(startDateKey)}
                                        onBlur={() => setFocusedDateField(null)}
                                        onChange={e => handleListChange(index, 'startDate', e.target.value)}
                                        placeholder="DD/MM/YYYY"
                                        className={`${inputClasses} custom-date-input pl-10`}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-color-muted)] mb-1">End Date</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                        <CalendarIcon className="h-5 w-5 text-[var(--text-color-muted)]" />
                                    </div>
                                    <input
                                        type={isEndDateFocused ? 'date' : 'text'}
                                        value={isEndDateFocused ? change.endDate : formatDateForDisplay(change.endDate)}
                                        onFocus={() => setFocusedDateField(endDateKey)}
                                        onBlur={() => setFocusedDateField(null)}
                                        onChange={e => handleListChange(index, 'endDate', e.target.value)}
                                        placeholder="DD/MM/YYYY"
                                        className={`${inputClasses} custom-date-input pl-10 disabled:opacity-50`}
                                        disabled={change.isPermanent}
                                    />
                                </div>
                            </div>
                            <div className="pt-5">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={change.isPermanent}
                                        onChange={e => handleListChange(index, 'isPermanent', e.target.checked)}
                                        className="h-4 w-4 rounded accent-[var(--input-border-focus-color)]"
                                    />
                                    <span className="text-sm font-medium text-[var(--text-color-muted)]">Permanent</span>
                                </label>
                            </div>
                        </div>
                        <FutureChangeImpactDisplay appState={appState} futureChange={change} calculations={calculations} />
                    </div>
                );
            })}
            <div className="hidden print:block space-y-2">
                {(futureChanges || []).map(change => (
                    <div key={`print-${change.id}`} className="grid grid-cols-12 text-black py-1 border-b border-gray-200 text-sm">
                        <span className="col-span-3">{change.description}</span>
                        <span className="col-span-1 capitalize">{change.type}</span>
                        <span className="col-span-3">
                            {change.changeAmount >= 0 ? 'Increase of ' : 'Decrease of '}
                            {formatCurrency(Math.abs(change.changeAmount))} / {change.frequency}
                        </span>
                        <span className="col-span-5">From: {change.startDate} To: {change.isPermanent ? 'Permanent' : change.endDate}</span>
                    </div>
                ))}
            </div>
        </div>
    );
});

// --- New Component for Impact Analysis ---
const LumpSumImpactDisplay: React.FC<{
    appState: AppState;
    lumpSum: FutureLumpSum;
    calculations: any;
}> = React.memo(({ appState, lumpSum, calculations }) => {
    const [showExplanation, setShowExplanation] = useState(false);
    
    const formatCurrency = (value: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
    const formatYears = (value: number) => {
        if (!isFinite(value) || isNaN(value)) return 'N/A';
        return `${value.toFixed(1)} years`;
    };

    const impact = useMemo(() => {
        if (!lumpSum.date || !lumpSum.amount || !lumpSum.description) {
            return { bankText: '', crownText: '', isCalculable: false };
        }

        const { loan, futureChanges, futureLumpSums, crownMoneyInterestRate, otherDebts } = appState;
        const { crownSurplus } = calculations; // Use Crown Surplus

        // The "impacted" calculation is the main one from the app, which includes everything.
        const crownImpactedCalc = calculations.crownMoneyLoanCalculation;

        // To get the "baseline", we manually calculate the scenario WITHOUT this specific lump sum.
        const baselineLumpSums = futureLumpSums.filter(l => l.id !== lumpSum.id);

        const consolidatedAmount = (otherDebts || []).reduce((sum, d) => sum + d.amount, 0);
        const crownLoanForCalc = {
            amount: (loan.amount + consolidatedAmount) - (loan.offsetBalance || 0),
            interestRate: crownMoneyInterestRate,
            repayment: crownSurplus,
            frequency: 'monthly' as const,
            offsetBalance: 0,
        };
        
        const crownBaselineCalc = calculateAmortization(crownLoanForCalc, {
            futureChanges: futureChanges,
            futureLumpSums: baselineLumpSums,
            strategy: 'crown'
        });
        
        if (crownBaselineCalc.termInYears === Infinity || crownImpactedCalc.termInYears === Infinity) {
            return { bankText: 'Impact cannot be calculated (loan may not be payable).', crownText: '', isCalculable: false };
        }

        // --- Helper to create text ---
        const createImpactText = (baseline: LoanSummary, impacted: LoanSummary, scenario: string) => {
            const termDiff = baseline.termInYears - impacted.termInYears;
            const interestDiff = baseline.totalInterest - impacted.totalInterest;

            if (Math.abs(termDiff) < 1/24 && Math.abs(interestDiff) < 100) {
                return `No significant impact for ${scenario}.`;
            }

            const termText = termDiff > 0 ? `saves ${formatYears(termDiff)}` : `adds ${formatYears(Math.abs(termDiff))}`;
            const interestText = interestDiff > 0 ? `saves ${formatCurrency(interestDiff)}` : `costs ${formatCurrency(Math.abs(interestDiff))}`;

            return `${scenario}: ${termText} & ${interestText}.`;
        };
        
        const bankText = "Bank: No significant impact."; // Hardcoded as per business logic
        const crownText = createImpactText(crownBaselineCalc, crownImpactedCalc, "Crown");
        
        return { bankText, crownText, isCalculable: true };

    }, [appState, lumpSum, calculations]);
    
    if (!impact.isCalculable) return null;

    const color = lumpSum.type === 'income' ? 'var(--color-positive-text)' : 'var(--color-negative-text)';
    const bgColor = lumpSum.type === 'income' ? 'var(--color-positive-bg)' : 'var(--color-negative-bg)';

    return (
        <div className="mt-2 p-3 text-left rounded-lg text-sm" style={{ backgroundColor: bgColor }}>
            <p className="font-bold text-center mb-2" style={{ color }}>Impact Analysis</p>
            <ul className="space-y-1 text-xs">
                <li style={{ color }}>{impact.bankText}</li>
                <li style={{ color }}>{impact.crownText}</li>
            </ul>
            <button 
                onClick={() => setShowExplanation(!showExplanation)}
                className="text-xs text-center w-full mt-2 font-semibold underline decoration-dotted"
                style={{ color }}
            >
                {showExplanation ? 'Hide Explanation' : 'Why are the impacts different?'}
            </button>
            {showExplanation && (
                <div className="mt-2 text-xs border-t pt-2 space-y-2" style={{ borderColor: `${color}80`, color }}>
                    <p className="font-bold">Why the Bank Scenario is unaffected:</p>
                    <p className="mt-1">
                        The Bank scenario assumes any lump sum events are handled with funds outside of your home loan. This means these one-off events do not impact the loan's repayment timeline or the total interest paid to the bank.
                    </p>
                    <p className="font-bold mt-2">Why the Crown Money Scenario changes:</p>
                    <p className="mt-1">
                        The Crown strategy uses your <strong>entire</strong> financial picture. An income event is used to pay down the loan principal <strong>immediately</strong>, making a big, instant impact on your interest costs. An expense directly increases the loan balance. This direct-to-principal approach is why you see a significant change in the Crown scenario.
                    </p>
                </div>
            )}
        </div>
    );
});

// --- Component for Future Lump Sums ---
interface FutureLumpSumSectionProps {
    futureLumpSums: FutureLumpSum[];
    setAppState: React.Dispatch<React.SetStateAction<AppState>>;
    appState: AppState;
    calculations: any;
}

const FutureLumpSumSection: React.FC<FutureLumpSumSectionProps> = React.memo(({ futureLumpSums, setAppState, appState, calculations }) => {
    const [focusedDateField, setFocusedDateField] = useState<string | null>(null);

    const handleListChange = (index: number, field: keyof FutureLumpSum, value: any) => {
        setAppState(prev => {
            const newList = [...prev.futureLumpSums];
            let processedValue = value;
            if (field === 'amount') {
                processedValue = Math.abs(parseFloat(value) || 0);
            }
            newList[index] = { ...newList[index], [field]: processedValue };
            return { ...prev, futureLumpSums: newList };
        });
    };

    const removeListItem = (id: number) => {
        setAppState(prev => ({
            ...prev,
            futureLumpSums: prev.futureLumpSums.filter(item => item.id !== id)
        }));
    };

    const formatCurrency = (value: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
    
    const inputClasses = "w-full bg-[var(--input-bg-color)] p-2 rounded border border-[var(--input-border-color)] focus:outline-none focus:ring-2 focus:ring-[var(--input-border-focus-color)]";
    const selectClasses = `custom-select ${inputClasses}`;

    return (
        <div className="space-y-4">
            {(futureLumpSums || []).map((lump, index) => {
                if (lump.managed) {
                    return (
                        <div key={lump.id} className="p-3 rounded-lg border border-dashed border-[var(--border-color)] text-sm text-[var(--text-color-muted)] print:hidden">
                            <span className="font-semibold text-[var(--text-color)]">{lump.description}</span>: {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(lump.amount)} on {formatDateForDisplay(lump.date)}. Edit in Hard Expenses › Car.
                        </div>
                    );
                }
                const dateKey = `lump-date-${lump.id}`;
                const isDateFocused = focusedDateField === dateKey;

                return (
                    <div key={lump.id} className="p-4 bg-black/10 dark:bg-white/5 rounded-lg relative space-y-4 print:hidden">
                        <button onClick={() => removeListItem(lump.id)} className="absolute top-2 right-2 text-red-400 hover:text-red-600 text-2xl font-bold z-10">×</button>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-color-muted)] mb-1">Description</label>
                                <input
                                    type="text"
                                    value={lump.description}
                                    onChange={e => handleListChange(index, 'description', e.target.value)}
                                    className={inputClasses}
                                    placeholder="e.g., Car Purchase, Inheritance"
                                />
                            </div>
                             <div>
                                <label className="block text-xs font-medium text-[var(--text-color-muted)] mb-1">Type</label>
                                <select
                                    value={lump.type}
                                    onChange={e => handleListChange(index, 'type', e.target.value)}
                                    className={selectClasses}
                                >
                                    <option value="expense">Expense</option>
                                    <option value="income">Income</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-color-muted)] mb-1 flex items-center gap-1">
                                    Amount
                                    <Tooltip text="Enter the value of the event. Select 'Income' for money in (e.g., inheritance) or 'Expense' for money out (e.g., car purchase). This amount will be added to or removed from your offset/savings on the specified date.">
                                        <InfoIcon className="h-3_3" />
                                    </Tooltip>
                                </label>
                                <input
                                    type="number"
                                    value={lump.amount}
                                    onChange={e => handleListChange(index, 'amount', e.target.value)}
                                    className={inputClasses}
                                    placeholder="30000"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-color-muted)] mb-1">Date of Event</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                        <CalendarIcon className="h-5 w-5 text-[var(--text-color-muted)]" />
                                    </div>
                                    <input
                                        type={isDateFocused ? 'date' : 'text'}
                                        value={isDateFocused ? lump.date : formatDateForDisplay(lump.date)}
                                        onFocus={() => setFocusedDateField(dateKey)}
                                        onBlur={() => setFocusedDateField(null)}
                                        onChange={e => handleListChange(index, 'date', e.target.value)}
                                        placeholder="DD/MM/YYYY"
                                        className={`${inputClasses} custom-date-input pl-10`}
                                    />
                                </div>
                            </div>
                        </div>
                        <LumpSumImpactDisplay appState={appState} lumpSum={lump} calculations={calculations} />
                    </div>
                );
            })}
             <div className="hidden print:block space-y-2">
                {(futureLumpSums || []).map(lump => (
                    <div key={`print-lump-${lump.id}`} className="grid grid-cols-12 text-black py-1 border-b border-gray-200 text-sm">
                        <span className="col-span-5">{lump.description}</span>
                        <span className="col-span-2 capitalize">{lump.type}</span>
                        <span className={`col-span-2 ${lump.type === 'income' ? 'text-green-700' : 'text-red-700'}`}>
                            {formatCurrency(lump.amount)}
                        </span>
                        <span className="col-span-3">On: {lump.date}</span>
                    </div>
                ))}
            </div>
        </div>
    );
});

interface Props {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  calculations: any;
}

const Tab3_IncomeExpenses: React.FC<Props> = ({ appState, setAppState, calculations }) => {
  const { incomes, expenses, futureChanges, futureLumpSums, loan, otherDebts, investmentCashflowScenario = 'crown' } = appState;
  
  // Custom highlight animation for zero-value fields imported from JSON
  const customStyles = `
    @keyframes highlight-fade {
      0% { background-color: rgba(254, 240, 138, 0.4); outline: 2px solid #eab308; box-shadow: 0 0 10px rgba(234, 179, 8, 0.5); }
      70% { background-color: rgba(254, 240, 138, 0.2); outline: 2px solid #eab308; box-shadow: 0 0 5px rgba(234, 179, 8, 0.2); }
      100% { background-color: var(--input-bg-color); outline: 1px solid transparent; box-shadow: none; }
    }
    .highlight-fade-input {
      animation: highlight-fade 8s ease-out forwards;
    }
  `;
  const { 
    bankInvestmentNetCashflow, 
    crownInvestmentNetCashflow, 
    totalMonthlyIncome: bankTotalIncome, 
    totalMonthlyExpenses: bankTotalExpenses, 
    bankSurplus, 
    crownSurplus,
    getMonthlyAmount 
  } = calculations;

  const activeInvestmentCashflow = investmentCashflowScenario === 'crown' ? crownInvestmentNetCashflow : bankInvestmentNetCashflow;
  const activeSurplus = investmentCashflowScenario === 'crown' ? crownSurplus : bankSurplus;

  const [isCopyExpensesOpen, setIsCopyExpensesOpen] = useState(false);
  const [copyExpensesText, setCopyExpensesText] = useState("");
  const [isParsingAI, setIsParsingAI] = useState(false);

  const handleListChange = <T,>(list: T[], setList: (list: T[]) => void, index: number, field: keyof T, value: any) => {
    const newList = [...list];
    const item = newList[index];

    let processedValue = value;
    if (field === 'isPermanent') {
        processedValue = Boolean(value);
    }

    newList[index] = { ...item, [field]: processedValue };
    setList(newList);
  };
  
  const addListItem = <T extends {id: number}>(list: T[], setList: (list: T[]) => void, newItem: Omit<T, 'id'>) => {
    const fullNewItem = { ...newItem, id: Date.now() } as T;
    setList([...list, fullNewItem]);
  };
  
  const removeListItem = <T extends {id: number}>(list: T[], setList: (list: T[]) => void, id: number) => {
    setList(list.filter(item => item.id !== id));
  };
  
  const processExtractedJson = (json: any, metadataFileName?: string) => {
    const details = json?.["Form Field Details"] || json?.["formFieldDetails"];
    if (!details) {
        throw new Error("Invalid Expenses JSON format - missing 'Form Field Details' or 'formFieldDetails'");
    }

    const newExpenses: ExpenseItem[] = [];
    let idCounter = Date.now();

    const parseAmount = (val: string | number): {amount: number, frequency: any} => {
        if (typeof val === 'number') return { amount: val, frequency: 'monthly' };
        if (!val) return { amount: 0, frequency: 'monthly' };
        
        const parts = String(val).toLowerCase().trim().split(' ');
        const amountStr = parts[0].replace(/[^0-9.]/g, '');
        const amount = parseFloat(amountStr) || 0;
        let frequency = 'monthly';
        if (parts.length > 1) {
            const freqStr = parts.slice(1).join(' ');
            if (freqStr.includes('week')) frequency = 'weekly';
            else if (freqStr.includes('fortnight')) frequency = 'fortnightly';
            else if (freqStr.includes('month')) frequency = 'monthly';
            else if (freqStr.includes('quarter')) frequency = 'quarterly';
            else if (freqStr.includes('annual') || freqStr.includes('year')) frequency = 'annually';
        }
        return { amount, frequency };
    };

    const addCategory = (targetCategory: ExpenseItem['category'], ...catNames: string[]) => {
        for (const catName of catNames) {
            if (details[catName]) {
                Object.entries(details[catName]).forEach(([name, val]) => {
                    const { amount, frequency } = parseAmount(val as string | number);
                    newExpenses.push({
                        id: idCounter++,
                        name,
                        amount,
                        category: targetCategory,
                        frequency: frequency as any,
                        isImported: true
                    });
                });
                break;
            }
        }
    };

    addCategory("FFF", "FOOD FUN FUEL", "foodFunFuel", "FFF");
    addCategory("Soft Expenses", "SOFT EXPENSES", "softExpenses", "Soft Expenses");
    addCategory("Hard Expenses", "HARD EXPENSES", "hardExpenses", "Hard Expenses");

    const incomesData = details["Incomes"] || details["incomes"];
    const newIncomes: IncomeItem[] = [];
    if (incomesData) {
        Object.entries(incomesData).forEach(([name, val]) => {
            const { amount, frequency } = parseAmount(val as string | number);
            newIncomes.push({
                id: idCounter++,
                name,
                amount,
                frequency: frequency as any,
                isImported: true
            });
        });
    }
    
    const person1Name = details["Person 1"] || details["person1"];
    const person2Name = details["Person 2"] || details["person2"];
    const email = details["Email"] || details["email"] || details["emailAddress"] || details["clientEmail"] || details["Client Email"];

    setAppState(rawPrev => {
        // Car and insurance items go into their dedicated sections instead.
        let prev = rawPrev;
        const genericNewExpenses = newExpenses.filter(newExp => {
            const routed = routeToManaged(prev, newExp);
            if (routed) { prev = routed; return false; }
            return true;
        });
        const mergedExpenses = [...(prev.expenses || [])];
        genericNewExpenses.forEach(newExp => {
            const existingIndex = mergedExpenses.findIndex(ex => 
                ex.name.toLowerCase() === newExp.name.toLowerCase() && 
                ex.category === newExp.category
            );
            if (existingIndex >= 0) {
                mergedExpenses[existingIndex] = {
                    ...mergedExpenses[existingIndex],
                    amount: newExp.amount,
                    frequency: newExp.frequency,
                    isImported: true
                };
            } else {
                mergedExpenses.push(newExp);
            }
        });

        const isDefaultIncomes = prev.incomes.length === 2 && 
            prev.incomes.some(inc => inc.name === 'Person 1 Income') && 
            prev.incomes.some(inc => inc.name === 'Person 2 Income');
        const mergedIncomes = isDefaultIncomes ? [] : [...(prev.incomes || [])];
        newIncomes.forEach(newInc => {
            const existingIndex = mergedIncomes.findIndex(inc => 
                inc.name.toLowerCase() === newInc.name.toLowerCase()
            );
            if (existingIndex >= 0) {
                mergedIncomes[existingIndex] = {
                    ...mergedIncomes[existingIndex],
                    amount: newInc.amount,
                    frequency: newInc.frequency,
                    isImported: true
                };
            } else {
                mergedIncomes.push(newInc);
            }
        });

        const newPeople = prev.people ? prev.people.map(p => ({...p})) : [];
        if (person1Name) {
            if (newPeople.length >= 1) newPeople[0].name = person1Name;
            else newPeople.push({ id: 1, name: person1Name, age: 30 });
        }
        if (person2Name) {
            if (newPeople.length >= 2) newPeople[1].name = person2Name;
            else if (newPeople.length === 1) newPeople.push({ id: 2, name: person2Name, age: 30 });
        }

        let finalEmail = email || prev.clientEmail;
        if (!email && metadataFileName && metadataFileName.includes('@')) {
           const potentialEmail = metadataFileName.replace('.json', '');
           if (potentialEmail.includes('@')) {
               finalEmail = potentialEmail;
           }
        }

        return syncManagedItems({
            ...prev,
            expenses: mergedExpenses,
            incomes: newIncomes.length > 0 ? mergedIncomes : prev.incomes,
            people: newPeople.length > 0 ? newPeople : prev.people,
            clientEmail: finalEmail || prev.clientEmail
        });
    });
  };

  const handleImportExpenses = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        processExtractedJson(json, file.name);
        
        // Reset file input
        event.target.value = '';
      } catch (error: any) {
        console.error("Failed to parse expenses scenario:", error);
        alert(`Error importing expenses: ${error.message}`);
      }
    };
    reader.readAsText(file);
  };

  const parseStructuredText = (text: string) => {
    const lines = text.split('\n');
    const details: any = {
        "Incomes": {},
        "FFF": {},
        "Hard Expenses": {},
        "Soft Expenses": {},
        "Person 1": "",
        "Person 2": ""
    };
    
    let currentSection = ""; // "income" or "expense"
    let currentCategory = ""; // "FFF", "Hard Expenses", "Soft Expenses", "Other"
    let currentPerson = ""; // e.g. "Lisa Blumears"
    
    for (let line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        // Section headers
        if (trimmed.includes("=== INCOME ===")) {
            currentSection = "income";
            continue;
        }
        if (trimmed.includes("=== EXPENSES ===")) {
            currentSection = "expense";
            continue;
        }
        
        if (currentSection === "income") {
            // Check for Person header: e.g., "Person 1 (Lisa Blumears):"
            const personMatch = trimmed.match(/^Person\s+(\d+)(?:\s*\(([^)]+)\))?\s*:/i);
            if (personMatch) {
                const personNum = personMatch[1];
                const personName = personMatch[2] ? personMatch[2].trim() : `Person ${personNum}`;
                details[`Person ${personNum}`] = personName;
                currentPerson = personName;
                continue;
            }
            
            // Check for income line: "• Net Income (After Tax): $1,092 (Weekly)"
            // or "• Other Net Income / Bonus: $0 (Monthly)"
            const incomeMatch = trimmed.match(/^[•\-*\s]*([^:]+?)\s*:\s*\$?([0-9,.]+)\s*\(([^)]+)\)/i);
            if (incomeMatch) {
                const sourceName = incomeMatch[1].trim();
                const amount = incomeMatch[2].replace(/,/g, '');
                const freq = incomeMatch[3].trim().toLowerCase();
                
                const key = currentPerson ? `${currentPerson} - ${sourceName}` : sourceName;
                details["Incomes"][key] = `${amount} ${freq}`;
            }
        } else if (currentSection === "expense") {
            // Check for expense category header:
            // "Food & Fuel (FFF):"
            // "Hard Expenses:"
            // "Soft Expenses:"
            if (trimmed.endsWith(":")) {
                const catName = trimmed.slice(0, -1).trim();
                if (catName.toLowerCase().includes("food & fuel") || catName.toLowerCase().includes("fff")) {
                    currentCategory = "FFF";
                } else if (catName.toLowerCase().includes("hard")) {
                    currentCategory = "Hard Expenses";
                } else if (catName.toLowerCase().includes("soft")) {
                    currentCategory = "Soft Expenses";
                } else {
                    currentCategory = "Hard Expenses"; // default/fallback
                }
                continue;
            }
            
            // Check for expense line: "• Food: $400 (Weekly)"
            const expenseMatch = trimmed.match(/^[•\-*\s]*([^:]+?)\s*:\s*\$?([0-9,.]+)\s*\(([^)]+)\)/i);
            if (expenseMatch) {
                const name = expenseMatch[1].trim();
                const amount = expenseMatch[2].replace(/,/g, '');
                const freq = expenseMatch[3].trim().toLowerCase();
                
                const cat = currentCategory || "Hard Expenses";
                if (!details[cat]) {
                    details[cat] = {};
                }
                details[cat][name] = `${amount} ${freq}`;
            }
        }
    }
    
    return { "Form Field Details": details };
  };

  const handleCopyExpensesAI = async () => {
    if (!copyExpensesText.trim()) return;
    setIsParsingAI(true);
    try {
        // first check if it's already pure json
        let parsed = null;
        try {
            parsed = JSON.parse(copyExpensesText);
        } catch(e) {}
        
        if (parsed && (parsed["Form Field Details"] || parsed["formFieldDetails"])) {
            processExtractedJson(parsed);
            setIsCopyExpensesOpen(false);
            setCopyExpensesText("");
            return;
        }

        // Check if it's the structured format with === INCOME === or === EXPENSES ===
        if (copyExpensesText.includes('=== INCOME ===') || copyExpensesText.includes('=== EXPENSES ===')) {
            const localParsed = parseStructuredText(copyExpensesText);
            if (localParsed && (localParsed["Form Field Details"]["Person 1"] || Object.keys(localParsed["Form Field Details"]["Incomes"]).length > 0 || Object.keys(localParsed["Form Field Details"]["Hard Expenses"]).length > 0)) {
                processExtractedJson(localParsed);
                setIsCopyExpensesOpen(false);
                setCopyExpensesText("");
                return;
            }
        }

        // if it's not valid json or structured text, use AI to extract
        // The extraction prompt lives server-side in netlify/functions/assistant.mts
        const aiText = await askAI({ mode: 'extract', context: '', question: copyExpensesText });

        let resultText = aiText.trim();
        if (resultText.startsWith("\`\`\`json")) {
            resultText = resultText.replace(/^\`\`\`json/i, '').replace(/\`\`\`$/i, '').trim();
        } else if (resultText.startsWith("\`\`\`")) {
            resultText = resultText.replace(/^\`\`\`/i, '').replace(/\`\`\`$/i, '').trim();
        }
        
        const aiParsed = JSON.parse(resultText);
        processExtractedJson(aiParsed);
        setIsCopyExpensesOpen(false);
        setCopyExpensesText("");
    } catch(e: any) {
        console.error("AI Extration Error", e);
        alert("Failed to parse the expenses using AI. Please modify the input text or ensure it matches the correct JSON format. Error: " + e.message);
    } finally {
        setIsParsingAI(false);
    }
  };

  const formatCurrency = (value: number, digits = 0) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

  const monthlyLoanRepayment = getMonthlyAmount(loan.repayment, loan.frequency);

  const inputClasses = "bg-[var(--input-bg-color)] p-2 rounded border border-[var(--input-border-color)] focus:outline-none focus:ring-2 focus:ring-[var(--input-border-focus-color)]";
  
  const expenseCategories: ExpenseItem['category'][] = ['FFF', 'Hard Expenses', 'Soft Expenses', 'Other'];

  const renderIncomeRows = () => (
    <>
      <style dangerouslySetInnerHTML={{ __html: customStyles }} />
      {(incomes || []).map((income, index) => (
        <div key={income.id} className="items-center relative mb-2">
            {income.isImported && <div className="absolute -top-2.5 -left-2 bg-indigo-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm z-10 uppercase tracking-wider print:hidden">Imported</div>}
            <div className="grid grid-cols-12 gap-2 print:hidden">
              <input type="text" value={income.name} onChange={e => handleListChange(incomes, (l) => setAppState(s => ({...s, incomes: l})), index, 'name', e.target.value)} className={`col-span-4 ${inputClasses} ${income.amount === 0 ? 'highlight-fade-input' : ''}`} placeholder="Income Source"/>
              <input type="number" value={income.amount || ''} onChange={e => handleListChange(incomes, (l) => setAppState(s => ({...s, incomes: l})), index, 'amount', parseFloat(e.target.value) || 0)} className={`col-span-4 ${inputClasses} ${income.amount === 0 ? 'highlight-fade-input' : ''}`} placeholder="Amount"/>
              <select value={income.frequency} onChange={e => handleListChange(incomes, (l) => setAppState(s => ({...s, incomes: l})), index, 'frequency', e.target.value)} className={`custom-select col-span-3 ${inputClasses} ${income.amount === 0 ? 'highlight-fade-input' : ''}`}>
                <option value="weekly">Weekly</option>
                <option value="fortnightly">Fortnightly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annually">Annually</option>
              </select>
              <button onClick={() => removeListItem(incomes, (l) => setAppState(s => ({...s, incomes: l})), income.id)} className="col-span-1 text-red-400 hover:text-red-600 self-center justify-self-center text-2xl font-bold">×</button>
            </div>
            {income.amount > 0 && income.frequency !== 'annually' && (
              <p className="mt-1 ml-1 text-xs font-semibold text-[var(--title-color)] print:hidden">
                = {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(getMonthlyAmount(income.amount, income.frequency) * 12)} a year
              </p>
            )}
             <div className="hidden print:grid print:grid-cols-12 col-span-12 text-black py-1 border-b border-gray-200">
                <span className="col-span-6">{income.name}</span>
                <span className="col-span-4 text-left">{formatCurrency(income.amount)}</span>
                <span className="col-span-2 text-left capitalize">{income.frequency}</span>
            </div>
        </div>
      ))}
    </>
  );

  const renderExpenseRows = (category: ExpenseItem['category']) => (
    <>
      {(expenses || []).filter(e => e.category === category && !e.managed).map((expense) => {
          const originalIndex = expenses.findIndex(e => e.id === expense.id);
          const expenseNameLower = (expense.name || '').toLowerCase();
          const isFood = expenseNameLower.includes('food') || expenseNameLower.includes('groceries');
          const isHoliday = expenseNameLower.includes('holiday') || expenseNameLower.includes('vacation');
          return (
            <div key={expense.id} className="items-center relative mb-2">
                {expense.isImported && <div className="absolute -top-2.5 -left-2 bg-indigo-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm z-10 uppercase tracking-wider print:hidden">Imported</div>}
                <div className="grid grid-cols-12 gap-2 print:hidden">
                  <input type="text" value={expense.name} onChange={e => handleListChange(expenses, (l) => setAppState(s => ({...s, expenses: l})), originalIndex, 'name', e.target.value)} className={`col-span-4 ${inputClasses} ${expense.amount === 0 ? 'highlight-fade-input' : ''}`} placeholder="Expense Item"/>
                  <input type="number" value={expense.amount || ''} onChange={e => handleListChange(expenses, (l) => setAppState(s => ({...s, expenses: l})), originalIndex, 'amount', parseFloat(e.target.value) || 0)} className={`col-span-4 ${inputClasses} ${expense.amount === 0 ? 'highlight-fade-input' : ''}`} placeholder="Amount"/>
                  <select value={expense.frequency} onChange={e => handleListChange(expenses, (l) => setAppState(s => ({...s, expenses: l})), originalIndex, 'frequency', e.target.value)} className={`custom-select col-span-3 ${inputClasses} ${expense.amount === 0 ? 'highlight-fade-input' : ''}`}>
                    <option value="weekly">Weekly</option>
                    <option value="fortnightly">Fortnightly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annually">Annually</option>
                  </select>
                  <button onClick={() => removeListItem(expenses, (l) => setAppState(s => ({...s, expenses: l})), expense.id)} className="col-span-1 text-red-400 hover:text-red-600 self-center justify-self-center text-2xl font-bold">×</button>
                </div>
                {isFood && expense.amount < 100 && (
                    <div className="text-[10px] text-red-500 mt-1 ml-1 font-medium print:hidden">
                        Hint: Minimum $100 for food
                    </div>
                )}
                {isHoliday && expense.amount < 500 && (
                    <div className="text-[10px] text-red-500 mt-1 ml-1 font-medium print:hidden">
                        Hint: Minimum $500 for holidays
                    </div>
                )}
                <div className="hidden print:grid print:grid-cols-12 col-span-12 text-black py-1 border-b border-gray-200">
                    <span className="col-span-6">{expense.name}</span>
                    <span className="col-span-3 text-left">{formatCurrency(expense.amount)}</span>
                    <span className="col-span-3 text-left capitalize">{expense.frequency}</span>
                </div>
            </div>
          );
      })}
    </>
  );
  
  const handleAddFutureChange = () => {
    const today = new Date();
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(today.getFullYear() + 1);
    
    const newChange: Omit<FutureChange, 'id'> = {
        description: '', 
        type: 'expense', 
        changeAmount: 0,
        frequency: 'monthly',
        startDate: today.toISOString().split('T')[0],
        endDate: oneYearFromNow.toISOString().split('T')[0],
        isPermanent: false
    };
    addListItem(futureChanges, l => setAppState(s => ({...s, futureChanges: l})), newChange);
  };

  const handleAddFutureLumpSum = () => {
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(new Date().getFullYear() + 1);

    const newLumpSum: Omit<FutureLumpSum, 'id'> = {
        description: 'Car Purchase',
        type: 'expense',
        amount: 30000,
        date: oneYearFromNow.toISOString().split('T')[0],
    };
    addListItem(futureLumpSums, l => setAppState(s => ({...s, futureLumpSums: l})), newLumpSum);
  };
  
  const PlannedChangesCardTitle = () => (
      <div className="flex items-center gap-2">
          <span>Plan for Future Budget Changes</span>
          <Tooltip text="Use this to model future events, like a pay rise or a child finishing daycare. These changes will affect the Crown Money calculation from the specified date onwards.">
              <InfoIcon className="h-4 w-4 text-[var(--text-color-muted)]"/>
          </Tooltip>
      </div>
  );

  const LumpSumCardTitle = () => (
    <div className="flex items-center gap-2">
        <span>Future Lump Sum Events</span>
        <Tooltip text="Model one-off capital events like a car purchase, inheritance, or large holiday. This will directly impact your offset/savings on the specified date, affecting both the Bank and Crown Money calculations. Select the event type and enter a positive amount.">
            <InfoIcon className="h-4 w-4 text-[var(--text-color-muted)]"/>
        </Tooltip>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
      {/* Left Column */}
      <div className="space-y-6">
        <Card title="Income (Net)">
          <div className="space-y-2">{renderIncomeRows()}</div>
          <button onClick={() => addListItem(incomes, (l) => setAppState(s => ({...s, incomes: l})), {name: '', amount: 0, frequency: 'weekly'})} className="mt-4 text-sm text-[var(--title-color)] hover:opacity-80 transition-opacity font-semibold print:hidden">+ Add Income</button>
          {(() => {
            const monthlyIncome = (incomes || []).reduce((sum, i) => sum + getMonthlyAmount(i.amount, i.frequency), 0);
            const grossAnnual = (incomes || []).reduce((sum, i) => {
              const netAnnual = getMonthlyAmount(i.amount, i.frequency) * 12;
              return sum + (netAnnual > 0 ? grossFromNet(netAnnual) : 0);
            }, 0);
            const fmt0 = (v: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(v);
            return (
              <div className="mt-5 rounded-2xl bg-[#f8f6fb] border border-[#e6deee] p-4 text-[#250B40] print:bg-transparent print:text-black print:border-gray-300">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--title-color)] print:text-gray-600">Total household income (after tax)</p>
                    <p className="text-3xl font-black tracking-tight text-[var(--title-color)]">{fmt0(monthlyIncome * 12)}<span className="text-base font-semibold text-[#583d77] print:text-gray-600"> a year</span></p>
                    {grossAnnual > 0 && <p className="text-xs text-[#583d77] mt-0.5">About <strong>{fmt0(grossAnnual)}</strong> a year before tax (estimate, {TAX_YEAR_LABEL} rates)</p>}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {[['Weekly', monthlyIncome * 12 / 52], ['Fortnightly', monthlyIncome * 12 / 26], ['Monthly', monthlyIncome]].map(([label, v]) => (
                    <div key={label as string} className="rounded-xl bg-white border border-[#e6deee] py-2 print:bg-transparent">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#583d77] print:text-gray-600">{label}</p>
                      <p className="text-sm font-bold">{fmt0(v as number)}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </Card>
        <HouseholdBenchmarks appState={appState} setAppState={setAppState} />
        <Card title={
            <div className="flex justify-between items-center w-full">
                <span>Expenses</span>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setIsCopyExpensesOpen(true)}
                        className="px-3 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-600/10 rounded-lg border border-emerald-600/20 hover:bg-emerald-600 hover:text-white transition-all print:hidden uppercase tracking-widest flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                        Paste Expenses
                    </button>
                    {/* Import JSON button is hidden as requested */}
                </div>
            </div>
        }>
            <BenchmarkHint appState={appState} kind="total" />
            <h4 className="text-md font-semibold text-[var(--text-color-muted)] mt-4 mb-2 print:text-black">FFF (Food, Fun, Fuel)</h4>
            <BenchmarkHint appState={appState} kind="fff" />
            <div className="text-xs text-[var(--text-color-muted)] mb-1">e.g. Food expenses, dining out, vehicle fuel, entertainment</div>
            <div className="space-y-2">{renderExpenseRows('FFF')}</div>
            <button onClick={() => addListItem(expenses, (l) => setAppState(s => ({...s, expenses: l})), {name: '', amount: 0, category: 'FFF', frequency: 'weekly'})} className="mt-2 text-sm text-[var(--title-color)] hover:opacity-80 transition-opacity font-semibold print:hidden">+ Add FFF</button>
            
            <h4 className="text-md font-semibold text-[var(--text-color-muted)] mt-4 mb-2 print:text-black">Hard Expenses</h4>
            <div className="text-xs text-[var(--text-color-muted)] mb-2">e.g. Utilities, insurances, council rates, body corporate</div>
            <div className="space-y-2">{renderExpenseRows('Hard Expenses')}</div>
            <button onClick={() => addListItem(expenses, (l) => setAppState(s => ({...s, expenses: l})), {name: '', amount: 0, category: 'Hard Expenses', frequency: 'monthly'})} className="mt-2 text-sm text-[var(--title-color)] hover:opacity-80 transition-opacity font-semibold print:hidden">+ Add Hard Expense</button>
            <CarAndInsurance appState={appState} setAppState={setAppState} />

            <h4 className="text-md font-semibold text-[var(--text-color-muted)] mt-4 mb-2 print:text-black">Soft Expenses</h4>
            <div className="text-xs text-[var(--text-color-muted)] mb-1">e.g. Holidays, clothing, gifts, medical, education</div>
            <div className="space-y-2">{renderExpenseRows('Soft Expenses')}</div>
            <button onClick={() => addListItem(expenses, (l) => setAppState(s => ({...s, expenses: l})), {name: '', amount: 0, category: 'Soft Expenses', frequency: 'monthly'})} className="mt-2 text-sm text-[var(--title-color)] hover:opacity-80 transition-opacity font-semibold print:hidden">+ Add Soft Expense</button>
            
            <h4 className="text-md font-semibold text-[var(--text-color-muted)] mt-4 mb-2 print:text-black">Other</h4>
            <div className="text-xs text-[var(--text-color-muted)] mb-2">e.g. Any other recurring expenses not covered above</div>
            <div className="space-y-2">{renderExpenseRows('Other')}</div>
            <button onClick={() => addListItem(expenses, (l) => setAppState(s => ({...s, expenses: l})), {name: '', amount: 0, category: 'Other', frequency: 'monthly'})} className="mt-2 text-sm text-[var(--title-color)] hover:opacity-80 transition-opacity font-semibold print:hidden">+ Add Other</button>
        </Card>
        <Card title="Income & Expenses Notes">
            <textarea
                value={appState.incomeExpensesNotes || ''}
                onChange={(e) => setAppState(prev => ({ ...prev, incomeExpensesNotes: e.target.value }))}
                className="w-full bg-[var(--input-bg-color)] p-3 rounded-xl border border-[var(--input-border-color)] focus:outline-none focus:ring-2 focus:ring-[var(--input-border-focus-color)] text-sm transition-all text-[var(--text-color)] resize-y min-h-[120px]"
                placeholder="Add notes about income and expenses here... (These notes will be sent to Zapier/HubSpot)"
            />
        </Card>
      </div>

      {/* Right Column */}
      <div className="space-y-6">
        <Card title={
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
            <span>Cashflow Summary</span>
            <div className="flex bg-gray-100 dark:bg-black/20 p-1 rounded-xl border border-[var(--border-color)]">
              <button 
                  onClick={() => setAppState(prev => ({...prev, investmentCashflowScenario: 'crown'}))}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${investmentCashflowScenario === 'crown' ? 'bg-[var(--title-color)] text-white shadow-sm' : 'text-gray-500'}`}
              >
                  Strategy 🏆
              </button>
              <button 
                  onClick={() => setAppState(prev => ({...prev, investmentCashflowScenario: 'bank'}))}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${investmentCashflowScenario === 'bank' ? 'bg-gray-500 text-white shadow-sm' : 'text-gray-500'}`}
              >
                  Bank
              </button>
            </div>
          </div>
        }>
            <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center p-2 rounded-lg" style={{ backgroundColor: 'var(--color-positive-bg)' }}>
                    <span className="font-medium flex items-center gap-1" style={{ color: 'var(--color-positive-text)'}}>Total Monthly Household Income
                        <Tooltip text="The net amount you earn per month across all income sources combined.">
                            <InfoIcon className="h-4 w-4 cursor-pointer text-white/70 hover:text-white"/>
                        </Tooltip>
                    </span>
                    <span className="font-semibold" style={{ color: 'var(--color-positive-text)'}}>{formatCurrency(incomes.reduce((s,i) => s + getMonthlyAmount(i.amount, i.frequency), 0))}</span>
                </div>
                 {activeInvestmentCashflow !== 0 && (
                    <div className={`flex justify-between items-center p-2 rounded-lg text-xs ${activeInvestmentCashflow > 0 ? 'print:bg-green-100' : 'print:bg-red-100'}`} style={{ backgroundColor: activeInvestmentCashflow > 0 ? 'var(--color-positive-bg)' : 'var(--color-negative-bg)' }}>
                    <div className="flex items-center gap-2">
                        <span className={`font-medium ${activeInvestmentCashflow > 0 ? 'print:text-green-800' : 'print:text-red-800'}`} style={{ color: activeInvestmentCashflow > 0 ? 'var(--color-positive-text)' : 'var(--color-negative-text)' }}>Net Investment Cashflow ({investmentCashflowScenario === 'crown' ? 'IO @ Crown Rate' : 'Bank Repay'})</span>
                        <Tooltip text="The combined monthly cashflow (income minus all expenses) from your investment properties. The Crown Strategy scenario always assumes Interest Only payments at the Crown Rate to maximize your primary home loan payoff speed.">
                            <InfoIcon className="h-4 w-4 text-[var(--text-color-muted)] print:hidden"/>
                        </Tooltip>
                    </div>
                    <span className={`font-semibold ${activeInvestmentCashflow > 0 ? 'print:text-green-800' : 'print:text-red-800'}`} style={{ color: activeInvestmentCashflow > 0 ? 'var(--color-positive-text)' : 'var(--color-negative-text)' }}>{formatCurrency(activeInvestmentCashflow)}</span>
                    </div>
                )}
                <div>
                    <div className="text-xs text-[var(--text-color-muted)] mt-1 pr-2 space-y-2 border-l-2 border-[var(--border-color)] pl-2 ml-auto w-fit text-right">
                        {(expenseCategories || []).map(category => {
                            const categoryExpenses = expenses.filter(exp => exp.category === category);
                            if (categoryExpenses.length === 0) return null;

                            const categoryTotal = categoryExpenses.reduce((sum, exp) => sum + getMonthlyAmount(exp.amount, exp.frequency), 0);
                            const categoryPercentage = activeSurplus + monthlyLoanRepayment > 0 ? (categoryTotal / (activeSurplus + monthlyLoanRepayment + activeInvestmentCashflow)) * 100 : 0; // rough approximation

                            return (
                                <div key={category} className="pl-2 pb-2">
                                    <h5 className="font-semibold text-[var(--text-color)] text-left mb-1 capitalize">{category.replace(' Expenses', '')}</h5>
                                    {(categoryExpenses || []).map(exp => {
                                        const monthlyAmount = getMonthlyAmount(exp.amount, exp.frequency);
                                        return (
                                            <div key={exp.id} className="flex justify-between gap-4 italic items-center">
                                                <span>{exp.name} ({formatCurrency(exp.amount,0)}/{exp.frequency.charAt(0)})</span>
                                                <div className="flex items-center gap-2">
                                                    <span>{formatCurrency(monthlyAmount, 2)}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div className="flex justify-between gap-4 font-semibold text-[var(--text-color)] pt-1 mt-1 border-t border-dashed border-[var(--border-color)] items-center">
                                        <span>Subtotal</span>
                                        <span>{formatCurrency(categoryTotal, 2)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-lg mt-2" style={{ backgroundColor: 'var(--color-negative-bg)' }}>
                        <span className="font-medium flex items-center gap-1" style={{ color: 'var(--color-negative-text)' }}>Total Monthly Living Expenses
                            <Tooltip text="The sum of all monthly FFF, Hard, Soft, and Other expenses.">
                                <InfoIcon className="h-4 w-4 cursor-pointer text-white/70 hover:text-white"/>
                            </Tooltip>
                        </span>
                        <span className="font-semibold" style={{ color: 'var(--color-negative-text)' }}>{formatCurrency(expenses.reduce((s,e) => s + getMonthlyAmount(e.amount, e.frequency), 0))}</span>
                    </div>

                    <div className="flex justify-between items-center p-2 rounded-lg mt-2" style={{ backgroundColor: 'var(--color-negative-bg)' }}>
                        <span className="font-medium flex items-center gap-1" style={{ color: 'var(--color-negative-text)' }}>
                            Home Loan Repayment
                            <Tooltip text="Your standard minimum home loan repayments from Tab 1.">
                                <InfoIcon className="h-4 w-4 cursor-pointer text-white/70 hover:text-white"/>
                            </Tooltip>
                        </span>
                        <span className="font-semibold" style={{ color: 'var(--color-negative-text)' }}>{formatCurrency(monthlyLoanRepayment)}</span>
                    </div>
                </div>
                
                <div>
                    <div className="flex justify-between items-center p-3 rounded-lg border mt-2" style={{ backgroundColor: 'var(--color-surplus-bg)', borderColor: 'var(--color-surplus-text)' }}>
                        <div className="flex items-center gap-2">
                            <span className="font-bold" style={{ color: 'var(--color-surplus-text)' }}>Surplus for Debt Reduction ({investmentCashflowScenario === 'crown' ? 'Strategy' : 'Bank'})</span>
                            <Tooltip text="This shows your leftover cashflow each month after all living expenses and home loan repayments.">
                                <InfoIcon className="h-4 w-4 text-blue-300 print:hidden"/>
                            </Tooltip>
                        </div>
                        <span className="font-bold text-lg" style={{ color: 'var(--color-surplus-text)' }}>{formatCurrency(activeSurplus)}</span>
                    </div>
                </div>

                <hr className="border-[var(--border-color)] border-dashed my-2" />

                {investmentCashflowScenario === 'crown' && (
                    <div>
                        <div className="flex flex-col gap-2 p-3 rounded-lg border-2 border-[var(--color-surplus-text)] bg-[var(--color-surplus-bg)]/20 shadow-sm text-center">
                            <span className="font-bold text-base" style={{ color: 'var(--color-surplus-text)' }}>
                                Crown Strategy Target Repayment: {formatCurrency(activeSurplus + monthlyLoanRepayment)}
                            </span>
                            <span className="text-sm" style={{ color: 'var(--text-color-muted)' }}>
                                Under the Crown Money strategy, <strong>all Surplus money</strong> AND your standard repayments are directly channelled into your main loan. Every dollar is working for you.
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </Card>
         <Card title={<PlannedChangesCardTitle />}>
            <FutureChangesSection
              futureChanges={futureChanges}
              incomes={incomes}
              expenses={expenses}
              setAppState={setAppState}
              appState={appState}
              calculations={calculations}
            />
            <button onClick={handleAddFutureChange} className="mt-4 text-sm text-[var(--title-color)] hover:opacity-80 transition-opacity font-semibold print:hidden">+ Add Future Change</button>
        </Card>
        <Card title={<LumpSumCardTitle />}>
            <FutureLumpSumSection
                futureLumpSums={futureLumpSums}
                setAppState={setAppState}
                appState={appState}
                calculations={calculations}
            />
            <button onClick={handleAddFutureLumpSum} className="mt-4 text-sm text-[var(--title-color)] hover:opacity-80 transition-opacity font-semibold print:hidden">+ Add Lump Sum Event</button>
        </Card>
      </div>

      <Modal isOpen={isCopyExpensesOpen} onClose={() => setIsCopyExpensesOpen(false)} title="Copy Raw Text or JSON">
        <div className="space-y-4">
            <p className="text-sm text-slate-500">Paste raw text or JSON data below. The system will use AI to automatically interpret and populate incomes and expenses, frequencies, and client details into the app.</p>
            <textarea
                value={copyExpensesText}
                onChange={(e) => setCopyExpensesText(e.target.value)}
                className="w-full h-64 p-3 font-mono text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Paste financial details here... e.g.&#10;Food: 300 weekly&#10;Incomes: John earns 5000 monthly..."
            />
            <div className="flex justify-end gap-2">
                <button
                    onClick={() => { setIsCopyExpensesOpen(false); setCopyExpensesText(""); }}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleCopyExpensesAI}
                    disabled={!copyExpensesText.trim() || isParsingAI}
                    className="px-4 py-2 text-sm font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 uppercase tracking-widest"
                >
                    {isParsingAI ? 'Populating...' : 'Populate Details'}
                </button>
            </div>
        </div>
      </Modal>
    </div>
  );
};

export default React.memo(Tab3_IncomeExpenses);
