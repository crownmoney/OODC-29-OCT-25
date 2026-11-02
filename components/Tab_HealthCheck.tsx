import React from 'react';
import { AppState, HealthCheckState } from '../types';

interface Tab_HealthCheckProps {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  calculations: any;
}

interface Question {
  id: number;
  statement: string;
  category: string;
  subCategory: string;
}

export const QUESTIONS: Question[] = [
  // Your plan
  {
    id: 1,
    statement: 'I have a written plan with my exact debt-free date.',
    category: 'Your plan',
    subCategory: 'DIRECTION & DATES',
  },
  {
    id: 2,
    statement: "I know exactly how much interest I'll hand the bank over my loan.",
    category: 'Your plan',
    subCategory: 'DIRECTION & DATES',
  },
  {
    id: 3,
    statement: "I'll be debt-free comfortably before I retire.",
    category: 'Your plan',
    subCategory: 'DIRECTION & DATES',
  },
  {
    id: 4,
    statement: 'I have 3+ months of expenses saved as a buffer.',
    category: 'Your plan',
    subCategory: 'DIRECTION & DATES',
  },

  // Your money
  {
    id: 5,
    statement: 'My loan is structured to pay down faster than a standard bank loan.',
    category: 'Your money',
    subCategory: 'HOW HARD IT WORKS',
  },
  {
    id: 6,
    statement: 'If rates rose 2%, I know the cost and my plan still holds.',
    category: 'Your money',
    subCategory: 'HOW HARD IT WORKS',
  },
  {
    id: 7,
    statement: 'I track my money with real live data feeds and compare my bills every year.',
    category: 'Your money',
    subCategory: 'HOW HARD IT WORKS',
  },

  // Your support
  {
    id: 8,
    statement: 'My partner and I share one plan and the same debt-free goal.',
    category: 'Your support',
    subCategory: 'WHO IS IN YOUR CORNER',
  },
  {
    id: 9,
    statement: "I've had coaching built around my situation, not generic tips.",
    category: 'Your support',
    subCategory: 'WHO IS IN YOUR CORNER',
  },
  {
    id: 10,
    statement: 'I review my strategy with an expert as life changes.',
    category: 'Your support',
    subCategory: 'WHO IS IN YOUR CORNER',
  },
];

const Tab_HealthCheck: React.FC<Tab_HealthCheckProps> = ({ appState, setAppState, calculations }) => {
  const healthCheck: HealthCheckState = appState.healthCheck || {
    answers: {},
    financialWorryNote: '',
  };

  const answers = healthCheck.answers || {};

  // Compute calculated defaults for ages
  const youngestPersonAge = calculations?.people?.[0]?.age || 35;
  const bankTermYears = calculations?.bankLoanCalculation?.termInYears || 30;
  const calculatedDebtFreeAge = Math.round(youngestPersonAge + bankTermYears);
  const calculatedRetirementAge = appState.idealRetirementAge || 65;

  const currentDebtFreeAge = healthCheck.debtFreeAgeCurrentPath !== undefined 
    ? healthCheck.debtFreeAgeCurrentPath 
    : calculatedDebtFreeAge;

  const currentRetirementAge = healthCheck.retirementTargetAge !== undefined 
    ? healthCheck.retirementTargetAge 
    : calculatedRetirementAge;

  // Count YES answers for score
  const yesCount = Object.values(answers).filter((val) => val === true).length;

  // Determine Tier and Description
  let tierTitle = 'Building';
  let tierSubtitle = 'Good instincts, real gaps. A plan would close them fast.';

  if (yesCount <= 3) {
    tierTitle = 'At Risk';
    tierSubtitle = 'Significant financial exposure. Immediate strategy needed to protect your future.';
  } else if (yesCount <= 6) {
    tierTitle = 'Building';
    tierSubtitle = 'Good instincts, real gaps. A plan would close them fast.';
  } else if (yesCount <= 8) {
    tierTitle = 'On Track';
    tierSubtitle = 'Solid foundations in place. Minor optimizations will accelerate your goal.';
  } else {
    tierTitle = 'Thriving';
    tierSubtitle = 'Outstanding financial mastery. Fully structured to maximize wealth.';
  }

  const handleAnswerChange = (questionId: number, value: boolean) => {
    setAppState((prev) => ({
      ...prev,
      healthCheck: {
        ...(prev.healthCheck || { answers: {} }),
        answers: {
          ...(prev.healthCheck?.answers || {}),
          [questionId]: value,
        },
      },
    }));
  };

  const handleReset = () => {
    setAppState((prev) => ({
      ...prev,
      healthCheck: {
        answers: {},
        debtFreeAgeCurrentPath: undefined,
        retirementTargetAge: undefined,
        financialWorryNote: '',
      },
    }));
  };

  const handleAgeChange = (field: 'debtFreeAgeCurrentPath' | 'retirementTargetAge', value: string) => {
    const numVal = value === '' ? '' : parseInt(value, 10);
    setAppState((prev) => ({
      ...prev,
      healthCheck: {
        ...(prev.healthCheck || { answers: {} }),
        [field]: isNaN(numVal as number) ? value : numVal,
      },
    }));
  };

  const handleWorryNoteChange = (text: string) => {
    setAppState((prev) => ({
      ...prev,
      healthCheck: {
        ...(prev.healthCheck || { answers: {} }),
        financialWorryNote: text,
      },
    }));
  };

  // Group questions by category
  const categories = [
    { title: 'Your plan', subTitle: 'DIRECTION & DATES', items: QUESTIONS.filter((q) => q.category === 'Your plan') },
    { title: 'Your money', subTitle: 'HOW HARD IT WORKS', items: QUESTIONS.filter((q) => q.category === 'Your money') },
    { title: 'Your support', subTitle: 'WHO IS IN YOUR CORNER', items: QUESTIONS.filter((q) => q.category === 'Your support') },
  ];

  const debtFreeNum = typeof currentDebtFreeAge === 'number' ? currentDebtFreeAge : parseInt(String(currentDebtFreeAge), 10);
  const retireNum = typeof currentRetirementAge === 'number' ? currentRetirementAge : parseInt(String(currentRetirementAge), 10);
  const gapYears = (!isNaN(debtFreeNum) && !isNaN(retireNum)) ? debtFreeNum - retireNum : 0;

  return (
    <div className="max-w-4xl mx-auto font-sans pb-12">
      {/* CROWN MONEY Header Banner */}
      <div className="bg-[#250B40] text-white rounded-t-3xl p-8 sm:p-12 shadow-lg relative overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <div className="tracking-[0.25em] font-serif font-black text-xl sm:text-2xl uppercase text-white">
            CROWN MONEY
          </div>
          <div className="text-[10px] sm:text-xs tracking-[0.25em] uppercase font-bold text-purple-200/80">
            MOVE FORWARD FINANCIALLY
          </div>
        </div>

        <h1 className="text-3xl sm:text-5xl font-serif font-bold text-white mb-3 tracking-tight">
          Your money health check
        </h1>
        <p className="text-purple-200 text-sm sm:text-base font-medium">
          Ten statements. Answer yes or no for where you are today.
        </p>
      </div>

      {/* Score & Status Bar */}
      <div className="bg-white border-x border-b border-purple-100 p-6 sm:p-8 rounded-b-3xl shadow-sm mb-8 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6 w-full sm:w-auto">
          {/* Score Counter */}
          <div className="flex items-baseline">
            <span className="text-4xl sm:text-5xl font-serif font-black text-[#5B21B6]">
              {yesCount}
            </span>
            <span className="text-lg font-semibold text-gray-400 ml-1">/ 10</span>
          </div>

          {/* Status & Subtitle */}
          <div className="flex-1 min-w-[200px]">
            <div className="font-bold text-lg text-[#250B40]">{tierTitle}</div>
            <div className="text-xs sm:text-sm text-gray-500">{tierSubtitle}</div>
          </div>
        </div>

        {/* Progress Bar & Reset Button */}
        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
          <div className="w-36 sm:w-48 bg-purple-100 rounded-full h-3 overflow-hidden">
            <div
              className="bg-[#5B21B6] h-full transition-all duration-500 rounded-full"
              style={{ width: `${(yesCount / 10) * 100}%` }}
            />
          </div>

          <button
            onClick={handleReset}
            className="px-4 py-1.5 text-xs font-semibold text-gray-500 hover:text-[#5B21B6] bg-gray-50 hover:bg-purple-50 border border-gray-200 hover:border-purple-200 rounded-lg transition-colors focus:outline-none"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Statements List by Category */}
      <div className="space-y-10">
        {categories.map((cat, catIdx) => (
          <div key={catIdx} className="space-y-4">
            {/* Category Header */}
            <div className="flex items-baseline gap-3 pb-2 border-b border-purple-100">
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#5B21B6]">
                {cat.title}
              </h2>
              <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gray-400">
                {cat.subTitle}
              </span>
            </div>

            {/* Questions list */}
            <div className="space-y-3">
              {cat.items.map((q) => {
                const answer = answers[q.id];
                const isYes = answer === true;
                const isNo = answer === false;
                const isEven = q.id % 2 === 0;

                return (
                  <div
                    key={q.id}
                    className={`p-4 sm:p-5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isNo
                        ? 'bg-[#fcf9f2] border-amber-200/80 shadow-sm'
                        : isYes
                        ? 'bg-[#f8f5fd] border-purple-200/80 shadow-sm'
                        : isEven
                        ? 'bg-purple-50/40 border-purple-100/50'
                        : 'bg-white border-gray-100'
                    }`}
                  >
                    {/* Number Badge & Statement Text */}
                    <div className="flex items-start sm:items-center gap-4 flex-1">
                      <div className="w-8 h-8 rounded-full bg-purple-100/80 text-[#5B21B6] font-bold text-sm flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-0">
                        {q.id}
                      </div>
                      <p className="text-sm sm:text-base font-medium text-gray-800 leading-snug">
                        {q.statement}
                      </p>
                    </div>

                    {/* Yes / No Toggle Buttons */}
                    <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                      <button
                        onClick={() => handleAnswerChange(q.id, true)}
                        className={`w-16 sm:w-20 py-2 rounded-lg font-semibold text-sm transition-all focus:outline-none ${
                          isYes
                            ? 'bg-[#5B21B6] text-white shadow-md'
                            : 'bg-white text-gray-600 border border-gray-300 hover:border-purple-300 hover:text-purple-700'
                        }`}
                      >
                        Yes
                      </button>

                      <button
                        onClick={() => handleAnswerChange(q.id, false)}
                        className={`w-16 sm:w-20 py-2 rounded-lg font-semibold text-sm transition-all focus:outline-none ${
                          isNo
                            ? 'bg-white text-amber-900 border-2 border-amber-600 shadow-sm'
                            : 'bg-white text-gray-600 border border-gray-300 hover:border-amber-300 hover:text-amber-700'
                        }`}
                      >
                        No
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Section 1: THE GAP THAT LANDS */}
      <div className="mt-12 bg-[#faf5ff] border border-purple-200/80 rounded-2xl p-6 sm:p-8 shadow-sm">
        <h3 className="text-xs font-black tracking-[0.2em] uppercase text-[#5B21B6] mb-6">
          THE GAP THAT LANDS
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Debt-free age, current path
            </label>
            <input
              type="number"
              value={currentDebtFreeAge ?? ''}
              onChange={(e) => handleAgeChange('debtFreeAgeCurrentPath', e.target.value)}
              className="w-full bg-white border border-purple-200 rounded-xl p-3 text-lg font-semibold text-[#250B40] focus:outline-none focus:ring-2 focus:ring-[#5B21B6] focus:border-transparent shadow-sm"
              placeholder="e.g. 61"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Age you want to retire
            </label>
            <input
              type="number"
              value={currentRetirementAge ?? ''}
              onChange={(e) => handleAgeChange('retirementTargetAge', e.target.value)}
              className="w-full bg-white border border-purple-200 rounded-xl p-3 text-lg font-semibold text-[#250B40] focus:outline-none focus:ring-2 focus:ring-[#5B21B6] focus:border-transparent shadow-sm"
              placeholder="e.g. 55"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2">
          <p className="text-xs text-gray-500">
            Enter both ages to show the gap.
          </p>

          {debtFreeNum > 0 && retireNum > 0 && (
            gapYears > 0 ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100/80 border border-amber-300 rounded-xl text-amber-900 font-semibold text-sm">
                <span>⚠️ {gapYears} Year Gap</span>
                <span className="text-xs text-amber-800 font-normal">
                  (Paying debt {gapYears} {gapYears === 1 ? 'year' : 'years'} into retirement)
                </span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100/80 border border-emerald-300 rounded-xl text-emerald-900 font-semibold text-sm">
                <span>🎉 On Track!</span>
                <span className="text-xs text-emerald-800 font-normal">
                  (Debt-free {Math.abs(gapYears)} {Math.abs(gapYears) === 1 ? 'year' : 'years'} before retirement)
                </span>
              </div>
            )
          )}
        </div>
      </div>

      {/* Bottom Section 2: Financial Worry Callout */}
      <div className="mt-8 bg-[#f8f5fc] border-l-4 border-[#5B21B6] border-y border-r border-purple-100 rounded-xl p-6 sm:p-8 shadow-sm">
        <h3 className="text-lg sm:text-xl font-serif font-bold text-[#5B21B6] mb-4">
          What worries you most about where your money is heading?
        </h3>

        <textarea
          rows={3}
          value={healthCheck.financialWorryNote || ''}
          onChange={(e) => handleWorryNoteChange(e.target.value)}
          placeholder="Enter notes or client comments here..."
          className="w-full bg-white/80 border border-purple-100 rounded-lg p-4 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5B21B6] focus:border-transparent placeholder:text-gray-400 placeholder:italic resize-y shadow-inner"
        />
      </div>

      {/* Footer Credentials Branding */}
      <div className="mt-12 pt-6 border-t border-gray-200 flex justify-between items-center text-xs font-semibold text-gray-400 tracking-wider">
        <div>CROWN MONEY</div>
        <div>CROWNMONEY.COM.AU</div>
      </div>
    </div>
  );
};

export default Tab_HealthCheck;
