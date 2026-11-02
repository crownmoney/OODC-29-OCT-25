import React, { useState, useMemo } from 'react';
import { Frequency } from '../../types';

// --- Section 1: Frequency Converter ---
const FrequencyConverter = () => {
  const [amount, setAmount] = useState<number>(1000);
  const [frequency, setFrequency] = useState<Frequency>('weekly');

  const conversions = useMemo(() => {
    if (isNaN(amount)) return { weekly: 0, fortnightly: 0, monthly: 0, quarterly: 0, annually: 0 };

    let monthlyAmount = 0;
    switch (frequency) {
      case 'weekly': monthlyAmount = amount * (52 / 12); break;
      case 'fortnightly': monthlyAmount = amount * (26 / 12); break;
      case 'monthly': monthlyAmount = amount; break;
      case 'quarterly': monthlyAmount = amount / 3; break;
      case 'annually': monthlyAmount = amount / 12; break;
    }

    return {
      weekly: monthlyAmount / (52 / 12),
      fortnightly: monthlyAmount / (26 / 12),
      monthly: monthlyAmount,
      quarterly: monthlyAmount * 3,
      annually: monthlyAmount * 12,
    };
  }, [amount, frequency]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

  return (
    <div className="space-y-4">
      <h4 className="font-bold text-[var(--text-color)]">Frequency Converter</h4>
      <div className="flex items-center gap-2">
        <div className="relative flex-grow">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--text-color-muted)]">$</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            className="w-full bg-[var(--input-bg-color)] p-2 pl-7 rounded-md border border-[var(--input-border-color)] focus:outline-none focus:ring-2 focus:ring-[var(--input-border-focus-color)]"
          />
        </div>
        <select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)} className="custom-select bg-[var(--input-bg-color)] p-2 rounded-md border border-[var(--input-border-color)] focus:outline-none focus:ring-2 focus:ring-[var(--input-border-focus-color)]">
          <option value="weekly">Weekly</option>
          <option value="fortnightly">Fortnightly</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="annually">Annually</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {Object.entries(conversions).map(([freq, val]) => (
          <div key={freq} className="flex justify-between p-2 bg-black/10 dark:bg-white/5 rounded-md">
            <span className="capitalize text-[var(--text-color-muted)]">{freq}</span>
            <span className="font-semibold text-[var(--text-color)]">{formatCurrency(Number(val))}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Section 2: Gross to Net Income Calculator (Australia) ---
const calculateAustralianTax = (grossAnnual: number): Record<string, number> => {
  if (isNaN(grossAnnual) || grossAnnual < 0) return { tax: 0, medicare: 0, total: 0, net: 0 };
  
  let tax = 0;
  // 2023-2024 tax brackets
  if (grossAnnual > 180000) {
    tax = 51667 + (grossAnnual - 180000) * 0.45;
  } else if (grossAnnual > 120000) {
    tax = 29467 + (grossAnnual - 120000) * 0.37;
  } else if (grossAnnual > 45000) {
    tax = 5092 + (grossAnnual - 45000) * 0.325;
  } else if (grossAnnual > 18200) {
    tax = (grossAnnual - 18200) * 0.19;
  }
  
  // Medicare Levy (standard 2%)
  const medicare = grossAnnual * 0.02;
  
  const total = tax + medicare;
  const net = grossAnnual - total;
  
  return { tax, medicare, total, net };
};

const IncomeTaxCalculator = () => {
    const [grossAnnual, setGrossAnnual] = useState<number>(100000);
    const results = calculateAustralianTax(Number(grossAnnual));

    const formatCurrency = (value: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

    return (
        <div className="space-y-4">
            <h4 className="font-bold text-[var(--text-color)]">Gross to Net Income Calculator (ATO 2023-24)</h4>
            <div>
                <label className="block text-sm font-medium text-[var(--text-color-muted)] mb-1">Gross Annual Income</label>
                 <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--text-color-muted)]">$</span>
                    <input
                        type="number"
                        value={grossAnnual}
                        onChange={(e) => setGrossAnnual(parseFloat(e.target.value) || 0)}
                        className="w-full bg-[var(--input-bg-color)] p-2 pl-7 rounded-md border border-[var(--input-border-color)] focus:outline-none focus:ring-2 focus:ring-[var(--input-border-focus-color)]"
                    />
                </div>
            </div>
            
            <div className="space-y-2 text-sm p-3 bg-black/10 dark:bg-white/5 rounded-lg">
                <div className="flex justify-between"><span className="text-[var(--text-color-muted)]">Estimated Income Tax:</span><span className="font-semibold">{formatCurrency(results.tax)}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-color-muted)]">Medicare Levy (2%):</span><span className="font-semibold">{formatCurrency(results.medicare)}</span></div>
                <div className="flex justify-between border-t border-[var(--border-color)] pt-2 mt-2"><span className="font-bold">Total Estimated Tax:</span><span className="font-bold">{formatCurrency(results.total)}</span></div>
            </div>
            
            <div className="p-3 bg-[var(--color-positive-bg)] rounded-lg">
                <div className="flex justify-between items-center">
                    <span className="font-bold text-[var(--color-positive-text)]">Net Annual Income:</span>
                    <span className="font-bold text-xl text-[var(--color-positive-text)]">{formatCurrency(results.net)}</span>
                </div>
            </div>

             <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 bg-black/10 dark:bg-white/5 rounded-md">
                    <p className="text-[var(--text-color-muted)]">Net Monthly</p>
                    <p className="font-semibold text-sm">{formatCurrency(results.net / 12)}</p>
                </div>
                <div className="p-2 bg-black/10 dark:bg-white/5 rounded-md">
                    <p className="text-[var(--text-color-muted)]">Net Fortnightly</p>
                    <p className="font-semibold text-sm">{formatCurrency(results.net / 26)}</p>
                </div>
                 <div className="p-2 bg-black/10 dark:bg-white/5 rounded-md">
                    <p className="text-[var(--text-color-muted)]">Net Weekly</p>
                    <p className="font-semibold text-sm">{formatCurrency(results.net / 52)}</p>
                </div>
            </div>
            <p className="text-xs text-[var(--text-color-muted)] text-center italic">This is an estimate for an Australian resident and does not include HECS/HELP, tax offsets, or Medicare levy surcharges. It should be used as a guide only.</p>
        </div>
    );
};

// --- Main Calculator Component ---
const AdvancedCalculator: React.FC = () => {
  return (
    <div className="space-y-6 text-sm text-[var(--text-color-muted)] max-h-[70vh] overflow-y-auto p-1">
      <FrequencyConverter />
      <hr className="border-[var(--border-color)]" />
      <IncomeTaxCalculator />
    </div>
  );
};

export default AdvancedCalculator;