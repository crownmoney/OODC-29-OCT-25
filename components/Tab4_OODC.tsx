import React, { useState, useMemo } from 'react';
import { AppState, AmortizationDataPoint, LoanDetails } from '../types';
import Card from './common/Card';
import SliderInput from './common/SliderInput';
import { AreaChart, ComposedChart, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, CartesianGrid, Area, ReferenceArea, PieChart, Pie, Cell, Label } from 'recharts';
import Tooltip from './common/Tooltip';
import { InfoIcon, CalendarIcon, TrendingUpIcon } from './common/IconComponents';
import { calculateAmortization, getMonthlyAmount, calculatePIPayment, getAnnualAmount } from '../hooks/useMortgageCalculations';
import Accordion from './common/Accordion';

interface Props {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  calculations: any;
}

const formatCurrency = (value: number, digits = 0) => {
    if (isNaN(value) || !isFinite(value)) return 'N/A';
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
};

const formatChartCurrency = (tick: number): string => {
  if (Math.abs(tick) >= 1000000) return `$${(tick / 1000000).toFixed(1)}M`;
  if (Math.abs(tick) >= 1000) return `$${Math.round(tick / 1000)}k`;
  return `$${tick}`;
};

const getExactDate = (years: number): string => {
    if (!isFinite(years) || years <= 0) return 'N/A';
    const totalMonths = Math.ceil(years * 12);
    const date = new Date();
    date.setMonth(date.getMonth() + totalMonths);
    return date.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
};

// --- Tax Helpers for 2025-26 Slabs ---
const calculateTax = (gross: number): number => {
    if (gross <= 18200) return 0;
    if (gross <= 45000) return (gross - 18200) * 0.16;
    if (gross <= 135000) return 4288 + (gross - 45000) * 0.30;
    if (gross <= 190000) return 29088 + (gross - 135000) * 0.37;
    return 51638 + (gross - 190000) * 0.45;
};

const calculateGrossFromNet = (netAnnual: number): number => {
    if (netAnnual <= 0) return 0;
    let low = netAnnual;
    let high = netAnnual * 2.5; 
    for (let i = 0; i < 20; i++) {
        let mid = (low + high) / 2;
        if (mid - calculateTax(mid) < netAnnual) low = mid;
        else high = mid;
    }
    return (low + high) / 2;
};

const CustomDebtTooltip: React.FC<{ active?: boolean, payload?: any[], label?: string, formatter: (value: number) => string }> = ({ active, payload, label, formatter }) => {
    if (active && payload && payload.length) {
        const bankData = payload.find(p => p.dataKey === 'Bank');
        const crownData = payload.find(p => p.dataKey === 'Crown Money');
        const age = payload[0].payload.age;

        return (
            <div className="p-3 bg-[var(--tooltip-bg-color)] border border-[var(--border-color)] rounded-lg text-sm shadow-lg print:hidden space-y-2">
                <p className="label text-[var(--tooltip-text-color)] font-bold mb-1">{`Year: ${Number(label).toFixed(1)} (Age: ${Math.floor(age)})`}</p>
                 <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: '#9ca3af' }}></div>
                    <p className="font-semibold" style={{ color: 'var(--tooltip-text-color)' }}>{`Bank Balance: ${formatter(bankData?.value || 0)}`}</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: '#5B21B6' }}></div>
                    <p className="font-semibold" style={{ color: 'var(--tooltip-text-color)' }}>{`Crown Balance: ${formatter(crownData?.value || 0)}`}</p>
                </div>
            </div>
        );
    }
    return null;
};

const CustomSnapshotTooltip = ({ active, payload, type }: any) => {
    if (active && payload && payload.length) {
        const bankData = payload.find((p: any) => p.dataKey === 'Bank');
        const crownData = payload.find((p: any) => p.dataKey === 'Crown Money');
        const bankVal = bankData ? bankData.value : 0;
        const crownVal = crownData ? crownData.value : 0;
        const savings = bankVal - crownVal;
        const formatValue = (val: number) => type === 'currency' ? formatCurrency(val) : `${val.toFixed(1)} years`;

        return (
            <div className="p-3 bg-[var(--tooltip-bg-color)] border border-[var(--border-color)] rounded-lg text-sm shadow-lg print:hidden space-y-1 z-50">
                 <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: 'var(--chart-color-bank)' }}></div>
                    <p className="font-semibold" style={{ color: 'var(--tooltip-text-color)' }}>{`Bank: ${formatValue(bankVal)}`}</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: 'var(--chart-color-crown)' }}></div>
                    <p className="font-semibold" style={{ color: 'var(--tooltip-text-color)' }}>{`Crown Money: ${formatValue(crownVal)}`}</p>
                </div>
                <hr className="my-1 border-[var(--border-color)] opacity-50" />
                <p style={{ color: 'var(--tooltip-text-color-muted)' }}>
                    {`Savings: `}
                    <span className="font-semibold" style={{color: 'var(--chart-color-wealth)'}}>
                        {`${formatValue(savings)}`}
                    </span>
                </p>
            </div>
        );
    }
    return null;
};

const Tab4_OODC: React.FC<Props> = ({ appState, setAppState, calculations }) => {
  const [additionalMonthlyIncome, setAdditionalMonthlyIncome] = useState(0);
  const [showCalculationLogic, setShowCalculationLogic] = useState(false);

  const { loan, incomes, otherDebts, people } = appState;
  const { 
      bankLoanCalculation, 
      crownMoneyLoanCalculation: initialCrownLoanCalculation,
      otherDebtsBreakdown,
      otherDebtsStatusQuoInterest,
      totalMonthlyIncome,
      totalMonthlyExpenses,
      bankSurplus,
      crownSurplus
    } = calculations;
  
  const youngestPersonAge = Math.min(...(people || []).map((p: any) => p.age));

  // Optimized local simulation for "What If" scenario
  const crownMoneyLoanCalculation = useMemo(() => {
    if (additionalMonthlyIncome === 0) return initialCrownLoanCalculation;
    
    const { loan, futureChanges, futureLumpSums, crownMoneyInterestRate, otherDebts } = appState;
    const { crownSurplus: baseCrownSurplus } = calculations;
    
    // We must include consolidated debt in the base amount just like the hook does
    const consolidatedAmount = (otherDebts || []).reduce((sum, d) => sum + d.amount, 0);
    const totalDebtAmount = loan.amount + consolidatedAmount;
    
    const primaryLoanRepayment = getMonthlyAmount(loan.repayment, loan.frequency);
    
    // Create accurate parameters for simulation
    const simulatedLoanDetails = { 
        amount: totalDebtAmount, 
        interestRate: crownMoneyInterestRate, 
        repayment: baseCrownSurplus + primaryLoanRepayment + additionalMonthlyIncome, 
        frequency: 'monthly' as const, 
        offsetBalance: loan.offsetBalance 
    };

    const result = calculateAmortization(simulatedLoanDetails, {
        futureChanges, 
        futureLumpSums, 
        strategy: 'crown'
    });

    if (result.termInYears === Infinity) return result;

    return { 
        ...result, 
        amortizationSchedule: (result.amortizationSchedule || []).map(point => ({ 
            ...point, 
            totalRemainingBalance: point.remainingBalance 
        })) 
    };
  }, [appState, additionalMonthlyIncome, initialCrownLoanCalculation, calculations.crownSurplus]);
  
  const totalAnnualGrossIncome = useMemo(() => {
      if (!incomes || incomes.length === 0) return 0;
      return incomes.reduce((sum, inc) => sum + calculateGrossFromNet(getAnnualAmount(inc.amount, inc.frequency)), 0);
  }, [incomes]);

  const loanBalanceChartData = useMemo(() => {
    const bankSchedule = bankLoanCalculation.amortizationSchedule;
    const crownSchedule = crownMoneyLoanCalculation.amortizationSchedule;
    if (!bankSchedule || !crownSchedule) return [];
    
    const bankStart = loan.amount - (loan.offsetBalance || 0);
    const consolidatedDebt = (appState.otherDebts || []).reduce((sum, d) => sum + d.amount, 0);
    const crownStart = bankStart + consolidatedDebt;
    
    const data = [{ year: 0, age: youngestPersonAge, 'Bank': bankStart, 'Crown Money': crownStart }];
    const maxMonths = Math.max(bankSchedule.length, crownSchedule.length);
    
    let crownHasFinished = false;

    for (let i = 0; i < maxMonths; i++) {
        const month = i + 1;
        const bankPoint = bankSchedule[i];
        const bankBalNet = Math.max(0, (bankPoint?.remainingBalance ?? 0) - (bankPoint?.offsetBalance ?? 0));
        
        let crownVal: number | null = null;
        if (!crownHasFinished && i < crownSchedule.length) {
            const crownPoint = crownSchedule[i];
            const crownBalGross = (crownPoint as any)?.totalRemainingBalance ?? crownPoint?.remainingBalance ?? 0;
            const crownNet = Math.max(0, crownBalGross - (crownPoint?.offsetBalance ?? 0));
            
            crownVal = crownNet;
            if (crownNet <= 0.01) {
                crownHasFinished = true;
            }
        } else {
            // After Crown payoff hits zero, values are null to stop the line immediately
            crownVal = null;
        }
        
        data.push({ 
            year: month / 12, 
            age: youngestPersonAge + (month / 12), 
            'Bank': isFinite(bankBalNet) ? bankBalNet : 0, 
            'Crown Money': crownVal
        });
    }
    return data;
  }, [bankLoanCalculation, crownMoneyLoanCalculation, loan, appState.otherDebts, youngestPersonAge]);

  const yearlyReductionData = useMemo(() => {
      const bankSchedule = bankLoanCalculation.amortizationSchedule;
      const crownSchedule = crownMoneyLoanCalculation.amortizationSchedule;
      const data = [];
      const maxYears = Math.ceil(Math.max(bankSchedule.length, crownSchedule.length) / 12);
      for(let y = 1; y <= maxYears; y++) {
          const bankSlice = bankSchedule.slice((y-1)*12, y*12);
          const crownSlice = crownSchedule.slice((y-1)*12, y*12);
          data.push({
              year: `Year ${y}`,
              Bank: bankSlice.reduce((sum, p) => sum + p.principalPaid, 0),
              Crown: crownSlice.reduce((sum, p) => sum + p.principalPaid, 0)
          });
      }
      return data;
  }, [bankLoanCalculation, crownMoneyLoanCalculation]);

  const snapshotChartsData = useMemo(() => ({
      payoff: [{ name: 'Payoff Time', Bank: bankLoanCalculation.termInYears, 'Crown Money': crownMoneyLoanCalculation.termInYears }],
      interest: [{ name: 'Total Interest', Bank: bankLoanCalculation.totalInterest + (otherDebtsStatusQuoInterest || 0), 'Crown Money': crownMoneyLoanCalculation.totalInterest }]
  }), [bankLoanCalculation, crownMoneyLoanCalculation, otherDebtsStatusQuoInterest]);
  
  const isBankLoanValid = bankLoanCalculation.termInYears !== Infinity;
  const isCrownLoanValid = crownMoneyLoanCalculation.termInYears !== Infinity;
  
  // Update total interest saved to include the status-quo cost of other debts
  const totalInterestSaved = isBankLoanValid && isCrownLoanValid 
    ? (bankLoanCalculation.totalInterest + otherDebtsStatusQuoInterest) - crownMoneyLoanCalculation.totalInterest 
    : 0;

  const consolidationSavings = useMemo(() => {
      return (otherDebtsBreakdown || []).reduce((s: number, c: any) => s + c.savings, 0);
  }, [otherDebtsBreakdown]);
  const mortgageOptimizationSavings = totalInterestSaved - consolidationSavings;

  const { bankYear1, crownYear1, bankLifetime, crownLifetime } = useMemo(() => {
    const bankPrincipal = loan.amount - (loan.offsetBalance || 0);
    const consolidatedDebt = (appState.otherDebts || []).reduce((s, d) => s + d.amount, 0);
    const crownPrincipal = bankPrincipal + consolidatedDebt;
    // Bank lifetime interest should technically include the other debts too for a fair comparison in this tab's donut charts
    const bankInt = (bankLoanCalculation.totalInterest || 0) + (otherDebtsStatusQuoInterest || 0);
    const crownInt = crownMoneyLoanCalculation.totalInterest || 0;
    const getYear1 = (schedule: AmortizationDataPoint[]) => {
        const slice = schedule.slice(0, 12);
        return { interest: slice.reduce((sum, i) => sum + i.interestPaid, 0), principal: slice.reduce((sum, i) => sum + i.principalPaid, 0) };
    };
    return {
        bankYear1: getYear1(bankLoanCalculation.amortizationSchedule),
        crownYear1: getYear1(crownMoneyLoanCalculation.amortizationSchedule),
        bankLifetime: { principal: bankPrincipal + consolidatedDebt, homeLoanInterest: bankInt, totalCost: bankPrincipal + consolidatedDebt + bankInt, interestPercent: (bankPrincipal + consolidatedDebt) > 0 ? (bankInt / (bankPrincipal + consolidatedDebt)) * 100 : 0 },
        crownLifetime: { principal: crownPrincipal, homeLoanInterest: crownInt, totalCost: crownPrincipal + crownInt, interestPercent: crownPrincipal > 0 ? (crownInt / crownPrincipal) * 100 : 0 },
    };
  }, [bankLoanCalculation, crownMoneyLoanCalculation, loan, appState.otherDebts, otherDebtsStatusQuoInterest]);

  const DonutChartCard: React.FC<{
      title: string;
      totalPrincipal: number;
      totalInterest: number;
      displayMode?: 'default' | 'largePrincipal';
  }> = ({ title, totalPrincipal, totalInterest, displayMode = 'default' }) => {
      const totalAmount = totalPrincipal + totalInterest;
      const data = [{ name: 'Principal', value: Math.max(0.01, totalPrincipal) }, { name: 'Interest', value: Math.max(0.01, totalInterest) }];
      const percentage = displayMode === 'largePrincipal' 
        ? (totalAmount > 0 ? (totalPrincipal / totalAmount) * 100 : 0)
        : (totalPrincipal > 0 ? (totalInterest / totalPrincipal) * 100 : 0);
      const label = displayMode === 'largePrincipal' ? "Principal" : "Interest";

      return (
          <div className="text-center p-2 bg-black/5 dark:bg-white/5 rounded-lg flex flex-col justify-between">
              <h5 className={`font-semibold ${title.includes('Crown') ? 'text-lg' : 'text-base'}`}>{title}</h5>
              <div className={`w-full relative ${displayMode === 'largePrincipal' ? 'h-52' : 'h-40'}`}>
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="60%" outerRadius="80%" paddingAngle={2} startAngle={90} endAngle={-270}>
                              <Cell fill="var(--chart-color-principal)" />
                              <Cell fill="var(--chart-color-interest)" />
                          </Pie>
                      </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className={`font-bold ${displayMode === 'largePrincipal' ? 'text-3xl' : 'text-2xl'}`} style={{ color: displayMode === 'largePrincipal' ? 'var(--chart-color-principal)' : 'var(--chart-color-interest)' }}>{percentage.toFixed(0)}%</span>
                      <span className="text-xs text-[var(--text-color-muted)]">{label}</span>
                  </div>
              </div>
              <div className="text-xs text-left px-1 mt-1 space-y-1">
                    <div className="flex items-center">
                        <span className="text-[var(--text-color-muted)] flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{backgroundColor: 'var(--chart-color-principal)'}}></div>Principal</span>
                        <span className="font-semibold text-[var(--text-color)] ml-auto">{formatCurrency(totalPrincipal)}</span>
                    </div>
                    {displayMode !== 'largePrincipal' && (
                        <div className="flex items-center">
                            <span className="text-[var(--text-color-muted)] flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{backgroundColor: 'var(--chart-color-interest)'}}></div>Interest</span>
                            <span className="font-semibold text-[var(--text-color)] ml-auto">{formatCurrency(totalInterest)}</span>
                        </div>
                    )}
              </div>
          </div>
      );
  };
  
  return (
    <div className="animate-fade-in space-y-6">
      <Accordion items={[
        {
          title: "1. Setup & \"What If\" Scenario",
          content: (
            <div className="space-y-6">
                <SliderInput label="Crown Money Interest Rate" value={appState.crownMoneyInterestRate} onChange={(v) => setAppState(prev => ({ ...prev, crownMoneyInterestRate: v }))} min={1} max={15} step={0.05} unit="%" />
                <SliderInput label="Simulate Additional Monthly Income" value={additionalMonthlyIncome} onChange={setAdditionalMonthlyIncome} min={0} max={5000} step={50} unit="$" />
            </div>
          )
        }
      ]} defaultOpenIndices={[0]} />

      {!isCrownLoanValid ? (
        <Card>
          <div className="text-center text-yellow-500 p-4 bg-yellow-900/10 dark:bg-yellow-900/50 rounded-lg">
              <p className="font-bold text-lg">Unable to calculate Crown Money scenario.</p>
              {bankSurplus > 0 && crownSurplus <= 0 ? (
                  <div className="mt-2 space-y-2">
                      <p>Your <strong>Bank Surplus</strong> is positive ({formatCurrency(bankSurplus)}), but your <strong>Crown Surplus</strong> is negative ({formatCurrency(crownSurplus)}).</p>
                      <p className="font-semibold">Check Investment Property Target Repayments.</p>
                  </div>
              ) : crownSurplus > 0 ? (
                  <div className="mt-2 space-y-2">
                      <p>Your <strong>Crown Surplus</strong> is positive ({formatCurrency(crownSurplus)}), but it is not enough to cover the monthly interest on your total consolidated debt.</p>
                      <p className="text-sm">The minimum monthly interest calculation at your current <strong>{appState.crownMoneyInterestRate}%</strong> Crown rate is approximately <strong>{formatCurrency(((loan.amount + (appState.otherDebts || []).reduce((s, d) => s + d.amount, 0) - (loan.offsetBalance || 0)) * (appState.crownMoneyInterestRate / 100)) / 12)}</strong>.</p>
                      <p className="font-semibold">To see a viable scenario, you must either increase income, decrease expenses, lower the Crown rate, or increase the starting offset balance.</p>
                  </div>
              ) : (
                  <p>Monthly expenses exceed income. Please review your budget.</p>
              )}
          </div>
        </Card>
      ) : (
        <Accordion items={[
          {
          title: "2. Total Debt Trajectory",
          content: (
            (() => {
                const bankPrincipal = loan.amount - (loan.offsetBalance || 0);
                const consolidatedAmount = (appState.otherDebts || []).reduce((sum, d) => sum + d.amount, 0);
                const crownPrincipal = loan.amount + consolidatedAmount - (loan.offsetBalance || 0);
                const primaryLoanRepayment = getMonthlyAmount(loan.repayment, loan.frequency);
                const livingExpenses = totalMonthlyIncome - primaryLoanRepayment - crownSurplus;
                
                const yearlyData = [];
                const schedule = crownMoneyLoanCalculation.amortizationSchedule;
                if (schedule) {
                    for (let y = 1; y <= Math.ceil(schedule.length / 12); y++) {
                        const yearSlice = schedule.slice((y - 1) * 12, y * 12);
                        if (yearSlice.length > 0) {
                            yearlyData.push({
                                year: y,
                                balance: yearSlice[yearSlice.length - 1].totalRemainingBalance || yearSlice[yearSlice.length - 1].remainingBalance,
                                principalPaid: yearSlice.reduce((sum, p) => sum + p.principalPaid, 0),
                                interestPaid: yearSlice.reduce((sum, p) => sum + p.interestPaid, 0)
                            });
                        }
                    }
                }

                return (
                    <>
                        <p className="text-sm text-[var(--text-color-muted)] mb-6">
                            This chart shows the Bank's **home loan** trajectory vs. Crown Money's **total consolidated debt** trajectory.
                        </p>
                        <div style={{ width: '100%', height: 450 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={loanBalanceChartData} margin={{ top: 10, right: 30, left: 10, bottom: 40 }}>
                                    <defs>
                                        <linearGradient id="colorCrown" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#5B21B6" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#5B21B6" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="colorBank" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#9ca3af" stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor="#9ca3af" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.4} />
                                    <XAxis dataKey="year" type="number" stroke="var(--text-color)" tick={{ fontSize: 11, fontWeight: 'bold' }} tickFormatter={(val) => `${val.toFixed(0)}`} label={{ value: 'Years', position: 'bottom', offset: 20, fontSize: 12, fill: 'var(--text-color-muted)' }} />
                                    <YAxis stroke="var(--text-color)" tickFormatter={formatChartCurrency} tick={{ fontSize: 11, fontWeight: 'bold' }} />
                                    <RechartsTooltip content={<CustomDebtTooltip formatter={formatChartCurrency} />} />
                                    <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '30px', fontSize: '12px', fontWeight: 'bold' }} />
                                    
                                    {isCrownLoanValid && isBankLoanValid && crownMoneyLoanCalculation.termInYears < bankLoanCalculation.termInYears && (
                                        <ReferenceArea 
                                            x1={crownMoneyLoanCalculation.termInYears} 
                                            x2={bankLoanCalculation.termInYears} 
                                            fill="#10b981" 
                                            fillOpacity={0.12}
                                            {...({} as any)}
                                        >
                                            <Label value="Savings & Investment Period" angle={-90} position="inside" fill="#10b981" fontWeight="bold" fontSize={11} />
                                        </ReferenceArea>
                                    )}

                                    <Area type="linear" dataKey="Bank" stroke="#9ca3af" fill="url(#colorBank)" strokeWidth={2} name="Bank" />
                                    <Area type="linear" dataKey="Crown Money" stroke="#5B21B6" fill="url(#colorCrown)" strokeWidth={4} name="Crown Money" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                        
                        <div className="mt-6 flex flex-col items-center">
                            <button 
                                onClick={() => setShowCalculationLogic(!showCalculationLogic)}
                                className="flex items-center gap-2 text-sm text-[var(--chart-color-wealth)] hover:text-white transition-colors py-2 px-4 rounded-full border border-[var(--chart-color-wealth)]/30 hover:bg-[var(--chart-color-wealth)]/10"
                            >
                                <InfoIcon className="h-4 w-4" />
                                {showCalculationLogic ? 'Hide Calculation Logic' : 'Show how it is calculated'}
                            </button>
                            
                            {showCalculationLogic && (
                                <div className="mt-4 p-4 md:p-6 bg-[#1e293b] rounded-xl border border-white/10 shadow-lg animate-fade-in text-sm font-normal w-full">
                                    <h4 className="font-bold text-lg border-b border-white/20 pb-2 mb-4 text-white">Trajectory Calculation Logic</h4>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <p className="font-semibold text-gray-300 text-base">Bank Trajectory</p>
                                                <ul className="list-disc pl-5 text-sm text-slate-300 space-y-2">
                                                    <li><strong>Starting Balance:</strong> Home Loan ({formatCurrency(loan.amount)}) minus Offset ({formatCurrency(loan.offsetBalance || 0)}) = <strong>{formatCurrency(bankPrincipal)}</strong>.</li>
                                                    <li><strong>Repayments:</strong> Assumes you only pay the minimum required P&I ({formatCurrency(primaryLoanRepayment)}/mo).</li>
                                                    <li><strong>Interest:</strong> Standard daily calculation.</li>
                                                </ul>
                                            </div>
                                            
                                            <div className="space-y-2 mt-4">
                                                <p className="font-semibold text-purple-300 text-base">Crown Money Trajectory</p>
                                                <ul className="list-disc pl-5 text-sm text-slate-300 space-y-2">
                                                    <li><strong>Starting Balance:</strong> Home Loan ({formatCurrency(loan.amount)}) + Consolidated Debts ({formatCurrency(consolidatedAmount)}) minus Offset ({formatCurrency(loan.offsetBalance || 0)}) = <strong>{formatCurrency(crownPrincipal)}</strong>.</li>
                                                    <li><strong>The Strategy:</strong> Crown's strategy is to aggressively pay down the principal by utilising <strong>all your surplus cashflow</strong>. 
                                                        <div className="mt-2 p-3 bg-white/5 rounded-lg border border-white/10 space-y-1.5 font-mono text-xs shadow-inner">
                                                            <div className="flex justify-between"><span>Monthly Income:</span> <span>{formatCurrency(totalMonthlyIncome)}</span></div>
                                                            <div className="flex justify-between text-red-300"><span>Less Expenses:</span> <span>-{formatCurrency(livingExpenses)}</span></div>
                                                            <div className="flex justify-between text-red-300"><span>Less Min Repayment:</span> <span>-{formatCurrency(primaryLoanRepayment)}</span></div>
                                                            {additionalMonthlyIncome > 0 && <div className="flex justify-between text-green-300"><span>Plus Simulated Income:</span> <span>+{formatCurrency(additionalMonthlyIncome)}</span></div>}
                                                            <div className="flex justify-between border-t border-white/20 pt-2 mt-2 font-bold text-emerald-300 text-sm">
                                                                <span>Monthly Surplus:</span> <span>{formatCurrency(crownSurplus + additionalMonthlyIncome)}</span>
                                                            </div>
                                                        </div>
                                                        <div className="mt-2 text-slate-300">
                                                            This surplus ({formatCurrency(crownSurplus + additionalMonthlyIncome)}) is automatically applied on top of minimum repayments ({formatCurrency(primaryLoanRepayment)}), resulting in a total monthly contribution of <strong>{formatCurrency(crownSurplus + additionalMonthlyIncome + primaryLoanRepayment)}</strong> directly against your debt.
                                                        </div>
                                                    </li>
                                                    <li><strong>Principal Paydown:</strong> Crown Money's strategy actively pays down the principal loan amount using your surplus, instead of just parking the money in an offset account.</li>
                                                </ul>
                                            </div>
                                        </div>
                                        
                                        <div className="flex flex-col h-full">
                                            <p className="font-semibold text-purple-300 text-base mb-3">Crown Money Year-by-Year Breakdown</p>
                                            <div className="flex-1 min-h-[300px] max-h-[500px] overflow-y-auto bg-black/20 rounded-lg border border-white/10 custom-scrollbar shadow-inner">
                                                <table className="w-full text-xs text-right">
                                                    <thead className="sticky top-0 bg-[#1e293b] text-slate-300 border-b border-white/10 shadow-sm">
                                                        <tr>
                                                            <th className="text-left font-medium p-3 pl-4">Year</th>
                                                            <th className="font-medium p-3">Balance</th>
                                                            <th className="font-medium p-3">Principal Paid</th>
                                                            <th className="font-medium p-3 pr-4">Interest Paid</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="text-slate-400 divide-y divide-white/5">
                                                        {yearlyData.map((data, idx) => (
                                                            <tr key={idx} className="hover:bg-white/5 transition-colors">
                                                                <td className="text-left p-3 pl-4 font-mono">Year {data.year}</td>
                                                                <td className="p-3 font-mono text-slate-300">{formatCurrency(data.balance)}</td>
                                                                <td className="p-3 font-mono text-emerald-400">+{formatCurrency(data.principalPaid)}</td>
                                                                <td className="p-3 pr-4 font-mono text-red-400">-{formatCurrency(data.interestPaid)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                );
            })()
          )
      },
      {
          title: "3. Yearly Principal Reduction Breakdown",
          content: (
            <div style={{ width: '100%', height: 400 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yearlyReductionData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.3} />
                        <XAxis dataKey="year" stroke="var(--text-color)" tick={{fontSize: 10}} />
                        <YAxis stroke="var(--text-color)" tickFormatter={formatChartCurrency} tick={{fontSize: 10}} />
                        <RechartsTooltip formatter={(val: number) => formatCurrency(val)} />
                        <Legend verticalAlign="top" wrapperStyle={{paddingBottom: '20px'}} />
                        <Bar dataKey="Bank" fill="#9ca3af" radius={[4, 4, 0, 0]} name="Bank Principal Paid" />
                        <Bar dataKey="Crown" fill="#5B21B6" radius={[4, 4, 0, 0]} name="Strategy Principal Paid" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
          )
      },
      {
          title: "4. Your Savings Snapshot",
          content: (
            <div className="space-y-6">
                <div className="text-center">
                    <p className="text-lg text-[var(--text-color-muted)] font-semibold uppercase tracking-widest flex justify-center items-center gap-1.5">Total Savings Strategy
                        <Tooltip text="The absolute difference in total interest paid across all relevant debts between the existing Bank scenario and the optimized Crown Money scenario.">
                            <InfoIcon className="h-4 w-4 cursor-pointer text-gray-400 hover:text-gray-600"/>
                        </Tooltip>
                    </p>
                    <p className="text-6xl font-black my-4 animate-pulse" style={{color: 'var(--chart-color-wealth)'}}>{formatCurrency(totalInterestSaved)}</p>

                    <div className="max-w-md mx-auto mt-4 mb-6 p-5 bg-[var(--color-surplus-bg)] rounded-[2rem] border border-[var(--color-surplus-text)]/20 shadow-sm text-center">
                        <h4 className="text-xs font-black uppercase tracking-wider text-[var(--color-surplus-text)] mb-3 flex items-center justify-center gap-1.5">
                            Average Interest Saved
                            <Tooltip text="The average amount of interest saved under the Crown Money strategy compared to the Bank, calculated over the Crown Money payoff term.">
                                <InfoIcon className="h-3.5 w-3.5 text-[var(--color-surplus-text)]/70 hover:text-[var(--color-surplus-text)]" />
                            </Tooltip>
                        </h4>
                        <div className="grid grid-cols-2 gap-3 text-left">
                            <div className="p-3 bg-white/60 dark:bg-black/20 rounded-xl border border-[var(--color-surplus-text)]/10">
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Per Week</p>
                                <p className="text-lg font-extrabold text-[var(--color-surplus-text)] mt-0.5">{formatCurrency(crownMoneyLoanCalculation.termInYears > 0 ? totalInterestSaved / (crownMoneyLoanCalculation.termInYears * 52) : 0, 2)}</p>
                            </div>
                            <div className="p-3 bg-white/60 dark:bg-black/20 rounded-xl border border-[var(--color-surplus-text)]/10">
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Per Month</p>
                                <p className="text-lg font-extrabold text-[var(--color-surplus-text)] mt-0.5">{formatCurrency(crownMoneyLoanCalculation.termInYears > 0 ? totalInterestSaved / (crownMoneyLoanCalculation.termInYears * 12) : 0, 2)}</p>
                            </div>
                            <div className="p-3 bg-white/60 dark:bg-black/20 rounded-xl border border-[var(--color-surplus-text)]/10">
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Per Quarter</p>
                                <p className="text-lg font-extrabold text-[var(--color-surplus-text)] mt-0.5">{formatCurrency(crownMoneyLoanCalculation.termInYears > 0 ? totalInterestSaved / (crownMoneyLoanCalculation.termInYears * 4) : 0, 2)}</p>
                            </div>
                            <div className="p-3 bg-white/60 dark:bg-black/20 rounded-xl border border-[var(--color-surplus-text)]/10">
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Per Year</p>
                                <p className="text-lg font-extrabold text-[var(--color-surplus-text)] mt-0.5">{formatCurrency(crownMoneyLoanCalculation.termInYears > 0 ? totalInterestSaved / crownMoneyLoanCalculation.termInYears : 0, 0)}</p>
                            </div>
                        </div>
                    </div>
                    
                    {otherDebtsStatusQuoInterest > 0 && (
                        <div className="max-w-md mx-auto p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 mb-6">
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500 font-bold uppercase tracking-tighter flex items-center gap-1.5">Mortgage Optimization Savings
                                        <Tooltip text="The interest saved exclusively on your primary home loan by redirecting all surplus cashflow and offsets into it.">
                                            <InfoIcon className="h-4 w-4 cursor-pointer text-slate-400 hover:text-slate-600"/>
                                        </Tooltip>
                                    </span>
                                    <span className="font-black text-slate-700">{formatCurrency(mortgageOptimizationSavings)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm border-t border-emerald-200/50 pt-2">
                                    <span className="text-emerald-700 font-black uppercase tracking-tighter flex items-center gap-1">
                                        Savings from Debt Consolidation 🏆
                                        <Tooltip content={
                                            <div className="space-y-3 min-w-[300px]">
                                                <p className="font-bold border-b border-white/20 pb-1">Debt Consolidation Breakdown</p>
                                                {(otherDebtsBreakdown || []).map((c: any, idx: number) => (
                                                    <div key={idx} className="space-y-1 text-xs">
                                                        <p className="font-semibold text-emerald-300">{c.name}</p>
                                                        <div className="grid grid-cols-2 gap-x-4 opacity-90">
                                                            <span>Principal:</span>
                                                            <span className="text-right">{formatCurrency(c.amount)}</span>
                                                            <span>Bank Rate:</span>
                                                            <span className="text-right">{c.bankRate}%</span>
                                                            <span>Crown Rate:</span>
                                                            <span className="text-right">{appState.crownMoneyInterestRate}%</span>
                                                            <span>Term:</span>
                                                            <span className="text-right">{c.term} yrs</span>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-x-4 font-medium mt-1 pt-1 border-t border-white/10">
                                                            <span>Bank Interest:</span>
                                                            <span className="text-right">{formatCurrency(c.bankInterest)}</span>
                                                            <span>Crown Interest:</span>
                                                            <span className="text-right">{formatCurrency(c.crownInterest)}</span>
                                                            <span className="text-emerald-300">Interest Saved:</span>
                                                            <span className="text-right text-emerald-300">{formatCurrency(c.savings)}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                                <div className="pt-2 border-t border-white/30 font-bold flex justify-between text-emerald-300">
                                                    <span>Total Consolidation Savings:</span>
                                                    <span>{formatCurrency(consolidationSavings)}</span>
                                                </div>
                                                <p className="text-[10px] italic opacity-70 mt-2 leading-tight">
                                                    * Savings calculated by comparing the total interest of each debt at its current bank rate vs. the Crown Money rate over the same remaining term.
                                                </p>
                                            </div>
                                        }>
                                            <InfoIcon className="h-3.5 w-3.5 cursor-help" />
                                        </Tooltip>
                                    </span>
                                    <span className="font-black text-emerald-700">{formatCurrency(consolidationSavings)}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <p className="text-lg text-[var(--text-color-muted)] mt-4 flex justify-center items-center gap-1.5">Years Saved Off Your Life:
                        <Tooltip text="The total duration of your home loan under the Bank scenario minus the duration under the Crown Money scenario. Represents years of financial freedom gained.">
                            <InfoIcon className="h-4 w-4 cursor-pointer text-gray-400 hover:text-gray-600"/>
                        </Tooltip>
                    </p>
                    <p className="text-5xl font-black my-2" style={{color: 'var(--chart-color-wealth)'}}>{(bankLoanCalculation.termInYears - crownMoneyLoanCalculation.termInYears).toFixed(1)}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                    <div style={{ height: 300 }}>
                        <h4 className="text-center font-semibold text-[var(--text-color-muted)] mb-4 text-xs uppercase tracking-widest">Payoff Time comparison (Years)</h4>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={snapshotChartsData.payoff} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.3} />
                                <XAxis dataKey="name" hide />
                                <YAxis stroke="var(--text-color)" tick={{fontSize: 10}} />
                                <RechartsTooltip content={<CustomSnapshotTooltip type="years" />} />
                                <Legend verticalAlign="bottom" height={36}/>
                                <Bar dataKey="Bank" fill="#9ca3af" barSize={40} radius={[4, 4, 0, 0]} name="Bank" />
                                <Bar dataKey="Crown Money" fill="#5B21B6" barSize={40} radius={[4, 4, 0, 0]} name="Crown Money" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div style={{ height: 300 }}>
                        <h4 className="text-center font-semibold text-[var(--text-color-muted)] mb-4 text-xs uppercase tracking-widest">Total Interest Comparison ($)</h4>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={snapshotChartsData.interest} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.3} />
                                <XAxis dataKey="name" hide />
                                <YAxis stroke="var(--text-color)" tickFormatter={formatChartCurrency} tick={{fontSize: 10}} />
                                <RechartsTooltip content={<CustomSnapshotTooltip type="currency" />} />
                                <Legend verticalAlign="bottom" height={36}/>
                                <Bar dataKey="Bank" fill="#9ca3af" barSize={40} radius={[4, 4, 0, 0]} name="Bank" />
                                <Bar dataKey="Crown Money" fill="#5B21B6" barSize={40} radius={[4, 4, 0, 0]} name="Crown Money" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
          )
      },
      {
          title: "5. First Year Interest vs. Principal Comparison",
          content: (
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <DonutChartCard title="Bank" totalPrincipal={bankYear1.principal} totalInterest={bankYear1.interest} displayMode="largePrincipal" />
                    <DonutChartCard title="Crown Money 🏆" totalPrincipal={crownYear1.principal} totalInterest={crownYear1.interest} displayMode="largePrincipal" />
                </div>
            </div>
          )
      },
      {
          title: "6. Lifetime Interest vs. Principal Comparison",
          content: (
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <DonutChartCard title="Bank" totalPrincipal={bankLifetime.principal} totalInterest={bankLifetime.homeLoanInterest} />
                    <DonutChartCard title="Crown Money 🏆" totalPrincipal={crownLifetime.principal} totalInterest={crownLifetime.homeLoanInterest} />
                </div>
            </div>
          )
      },
      {
          title: "7. Detailed Advantage Comparison",
          content: (
            <div className="space-y-8">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[var(--border-color)]">
                                <th className="text-left pb-4 font-black uppercase tracking-wider text-[var(--text-color-muted)]">Comparison Metric</th>
                                <th className="text-right pb-4 font-black uppercase tracking-wider text-[var(--chart-color-bank)] pr-8">The Bank</th>
                                <th className="text-right pb-4 font-black uppercase tracking-wider text-[var(--title-color)]">Crown Money 🏆</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-color)] divide-dashed">
                            {/* Debt Free Date */}
                            <tr>
                                <td className="py-4 font-bold text-[var(--text-color)]">Debt Free Date</td>
                                <td className="py-4 text-right pr-8 text-[var(--text-color)]">{getExactDate(bankLoanCalculation.termInYears)}</td>
                                <td className="py-4 text-right font-black text-[var(--title-color)]">{getExactDate(crownMoneyLoanCalculation.termInYears)}</td>
                            </tr>
                            {/* Years Left */}
                            <tr>
                                <td className="py-4 font-bold text-[var(--text-color)]">Years to Pay Off</td>
                                <td className="py-4 text-right pr-8 text-[var(--text-color)]">{bankLoanCalculation.termInYears.toFixed(1)}</td>
                                <td className="py-4 text-right font-black text-[var(--title-color)]">{crownMoneyLoanCalculation.termInYears.toFixed(1)}</td>
                            </tr>
                            {/* Ages at Debt Free */}
                            {(people || []).map((p, idx) => (
                                <tr key={p.id}>
                                    <td className="py-4 font-bold text-[var(--text-color)]">{p.name || `Person ${idx + 1}`} Debt Free Age</td>
                                    <td className="py-4 text-right pr-8 text-[var(--text-color)]">{isBankLoanValid ? Math.ceil(p.age + bankLoanCalculation.termInYears) : 'N/A'}</td>
                                    <td className="py-4 text-right font-black text-[var(--title-color)]">{isCrownLoanValid ? Math.ceil(p.age + crownMoneyLoanCalculation.termInYears) : 'N/A'}</td>
                                </tr>
                            ))}
                            {/* Total Interest $ */}
                            <tr>
                                <td className="py-4 font-bold text-[var(--text-color)]">Total Interest Paid ($)</td>
                                <td className="py-4 text-right pr-8 text-[var(--text-color)]">{formatCurrency(bankLifetime.homeLoanInterest)}</td>
                                <td className="py-4 text-right font-black text-[var(--title-color)]">{formatCurrency(crownLifetime.homeLoanInterest)}</td>
                            </tr>
                            {/* Total Interest % */}
                            <tr>
                                <td className="py-4 font-bold text-[var(--text-color)]">Total Interest Paid (%)</td>
                                <td className="py-4 text-right pr-8 text-[var(--text-color)]">{bankLifetime.interestPercent.toFixed(1)}%</td>
                                <td className="py-4 text-right font-black text-[var(--title-color)]">{crownLifetime.interestPercent.toFixed(1)}%</td>
                            </tr>
                            {/* Total Cost Left to Pay */}
                            <tr>
                                <td className="py-4 font-bold text-[var(--text-color)]">
                                    Total Cost Left to Pay (P + I)
                                    <p className="text-[10px] text-[var(--text-color-muted)] font-normal italic">Includes original principal balance + total future interest</p>
                                </td>
                                <td className="py-4 text-right pr-8">
                                    <div className="font-bold text-[var(--text-color)]">{formatCurrency(bankLifetime.totalCost)}</div>
                                    <div className="text-[9px] text-[var(--text-color-muted)]">(P: {formatCurrency(bankLifetime.principal)} + I: {formatCurrency(bankLifetime.homeLoanInterest)})</div>
                                </td>
                                <td className="py-4 text-right font-black text-[var(--title-color)]">
                                    <div className="text-lg">{formatCurrency(crownLifetime.totalCost)}</div>
                                    <div className="text-[9px] text-[var(--title-color)]">(P: {formatCurrency(crownLifetime.principal)} + I: {formatCurrency(crownLifetime.homeLoanInterest)})</div>
                                </td>
                            </tr>
                            {/* Total Gross Income needed to pay */}
                            <tr className="bg-[var(--title-color)]/5">
                                <td className="py-6 font-black text-[var(--text-color)] pl-2">
                                    Life-Term Gross Income Required
                                    <p className="text-[10px] font-normal italic text-[var(--text-color-muted)]">Total earnings required during this period to clear debt and sustain lifestyle</p>
                                </td>
                                <td className="py-6 text-right pr-8 font-bold text-[var(--text-color)]">
                                    <div className="text-xl">{formatCurrency(totalAnnualGrossIncome * bankLoanCalculation.termInYears)}</div>
                                    <div className="text-[9px] text-[var(--text-color-muted)]">Over {bankLoanCalculation.termInYears.toFixed(1)} years</div>
                                </td>
                                <td className="py-6 text-right font-black text-[var(--title-color)]">
                                    <div className="text-2xl">{formatCurrency(totalAnnualGrossIncome * crownMoneyLoanCalculation.termInYears)}</div>
                                    <div className="text-[9px] text-[var(--title-color)]">Over {crownMoneyLoanCalculation.termInYears.toFixed(1)} years</div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                
                {/* Detailed Math Explanation Card */}
                <div className="p-6 bg-black/5 dark:bg-white/5 rounded-2xl border border-[var(--border-color)]">
                    <h5 className="font-bold text-[var(--text-color)] mb-4 flex items-center gap-2">
                        <InfoIcon className="h-5 w-5 text-[var(--title-color)]" />
                        How are these numbers calculated?
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs text-[var(--text-color)] leading-relaxed">
                        <div className="space-y-3">
                            <p><strong>Total Cost Left to Pay (P + I):</strong> This is the most accurate measure of your remaining debt commitment. It adds your current net principal balance (what you owe today) to every dollar of interest the bank will charge you over the remaining years of the loan.</p>
                            <p className="italic text-[var(--text-color-muted)] border-l-2 border-[var(--title-color)]/30 pl-3">
                                Check the math: Bank Principal ({formatCurrency(bankLifetime.principal)}) + Bank Interest ({formatCurrency(bankLifetime.homeLoanInterest)}) = {formatCurrency(bankLifetime.totalCost)}.
                            </p>
                        </div>
                        <div className="space-y-3">
                            <p><strong>Life-Term Gross Income Required:</strong> This shows the true cost of time. We take your current total annual gross income ({formatCurrency(totalAnnualGrossIncome)}) and multiply it by the years remaining on each strategy.</p>
                            <p>This tells you exactly how much pre-tax money you must earn in your career to reach the finish line. Because Crown saves you <strong>{(bankLoanCalculation.termInYears - crownMoneyLoanCalculation.termInYears).toFixed(1)} years</strong>, you keep {formatCurrency((totalAnnualGrossIncome * bankLoanCalculation.termInYears) - (totalAnnualGrossIncome * crownMoneyLoanCalculation.termInYears))} more of your lifetime earnings.</p>
                        </div>
                    </div>
                </div>
            </div>
          )
      },
      ]} />
      )}
    </div>
  );
};

export default React.memo(Tab4_OODC);