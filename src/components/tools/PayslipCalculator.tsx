'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Calculator, Calendar, DollarSign, FileText, Clock, Users } from 'lucide-react';

interface InputState {
  payFrequency: string;
  payDate: string;
  periodEndDate: string;
  annualSalary: string;
  employmentStartDate: string;
  taxYear: string;
  fullTimeHours: string;
  fte: string;
  hasPrivateHealthInsurance: boolean;
}

interface TaxBracket {
  min: number;
  max: number;
  rate: number;
  offset: number;
}

interface CalculationResults {
  grossPay: number;
  taxableIncome: number;
  tax: number;
  medicareLevy: number;
  medicareLevySurcharge: number;
  totalMedicareCharges: number;
  netIncome: number;
  superannuation: number;
  annualLeaveAccrual: number;
  hoursWorked: number;
  hourlyRate: number;
  ytd: {
    gross: number;
    tax: number;
    medicareLevy: number;
    medicareLevySurcharge: number;
    totalMedicareCharges: number;
    net: number;
    super: number;
  };
  periodsPerYear: number;
  payPeriodDays: number;
  periodsToDate: number;
  effectiveAnnualSalary: number;
  fte: number;
}

// Move these outside the component to satisfy linter
const taxBrackets: Record<string, TaxBracket[]> = {
  '2024-25': [
    { min: 0, max: 18200, rate: 0, offset: 0 },
    { min: 18201, max: 45000, rate: 0.19, offset: 0 },
    { min: 45001, max: 120000, rate: 0.325, offset: 5092 },
    { min: 120001, max: 180000, rate: 0.37, offset: 29467 },
    { min: 180001, max: Infinity, rate: 0.45, offset: 51667 }
  ],
  '2025-26': [
    { min: 0, max: 18200, rate: 0, offset: 0 },
    { min: 18201, max: 45000, rate: 0.16, offset: 0 },
    { min: 45001, max: 135000, rate: 0.30, offset: 4288 },
    { min: 135001, max: 190000, rate: 0.37, offset: 31288 },
    { min: 190001, max: Infinity, rate: 0.45, offset: 51638 }
  ]
};

const medicareLevy: Record<string, number> = {
  '2024-25': 0.02,
  '2025-26': 0.02
};

const superRates: Record<string, number> = {
  '2024-25': 0.115,
  '2025-26': 0.12
};

// Medicare Levy thresholds (below these amounts, reduced or no levy applies)
const medicareLevyThresholds: Record<string, { lower: number; upper: number }> = {
  '2024-25': { lower: 27222, upper: 34027 },
  '2025-26': { lower: 27222, upper: 34027 } // Same as previous year
};

// Medicare Levy Surcharge thresholds and rates
const mlsThresholds: Record<string, Array<{ min: number; max: number; rate: number }>> = {
  '2024-25': [
    { min: 0, max: 97000, rate: 0 },
    { min: 97001, max: 113000, rate: 0.01 },
    { min: 113001, max: 151000, rate: 0.0125 },
    { min: 151001, max: Infinity, rate: 0.015 }
  ],
  '2025-26': [
    { min: 0, max: 101000, rate: 0 },
    { min: 101001, max: 118000, rate: 0.01 },
    { min: 118001, max: 158000, rate: 0.0125 },
    { min: 158001, max: Infinity, rate: 0.015 }
  ]
};

const calculateTax = (taxableIncome: number, year: string): number => {
  const brackets = taxBrackets[year];
  let tax = 0;
  
  for (const bracket of brackets) {
    if (taxableIncome >= bracket.min && taxableIncome <= bracket.max) {
      tax = bracket.offset + (taxableIncome - bracket.min + 1) * bracket.rate;
      break;
    }
  }
  
  return tax;
};

const calculateMedicareLevy = (taxableIncome: number, year: string): number => {
  const thresholds = medicareLevyThresholds[year];
  const rate = medicareLevy[year];
  
  if (taxableIncome <= thresholds.lower) {
    return 0; // No Medicare levy for low income earners
  }
  
  if (taxableIncome <= thresholds.upper) {
    // Reduced Medicare levy for income between lower and upper thresholds
    const reduction = (thresholds.upper - taxableIncome) / (thresholds.upper - thresholds.lower);
    return taxableIncome * rate * (1 - reduction);
  }
  
  // Full Medicare levy for income above upper threshold
  return taxableIncome * rate;
};

const calculateMedicareLevySurcharge = (taxableIncome: number, year: string, hasInsurance: boolean): number => {
  if (hasInsurance) {
    return 0; // No surcharge if you have appropriate private health insurance
  }
  
  const thresholds = mlsThresholds[year];
  
  for (const threshold of thresholds) {
    if (taxableIncome >= threshold.min && taxableIncome <= threshold.max) {
      return taxableIncome * threshold.rate;
    }
  }
  
  return 0;
};

const getPayPeriodsPerYear = (frequency: string): number => {
  const periods: Record<string, number> = {
    'weekly': 52.18,
    'fortnightly': 26.09,
    'monthly': 12,
    'quarterly': 4
  };
  return periods[frequency] || 26.09;
};

const getPayPeriodDays = (frequency: string): number => {
  const days: Record<string, number> = {
    'weekly': 7,
    'fortnightly': 14,
    'monthly': 30.44,
    'quarterly': 91.33
  };
  return days[frequency] || 14;
};

const PayslipCalculator: React.FC = () => {
  const [inputs, setInputs] = useState<InputState>({
    payFrequency: 'fortnightly',
    payDate: '',
    periodEndDate: '',
    annualSalary: '',
    employmentStartDate: '',
    taxYear: '2025-26',
    fullTimeHours: '38',
    fte: '1.0',
    hasPrivateHealthInsurance: false
  });

  const [results, setResults] = useState<CalculationResults | null>(null);

  const calculateResults = useCallback((): void => {
    if (!inputs.annualSalary || !inputs.payDate || !inputs.periodEndDate || !inputs.employmentStartDate) {
      return;
    }

    const annualSalary = parseFloat(inputs.annualSalary);
    const fullTimeHours = parseFloat(inputs.fullTimeHours) || 38;
    const fte = parseFloat(inputs.fte) || 1.0;
    const periodsPerYear = getPayPeriodsPerYear(inputs.payFrequency);
    const payPeriodDays = getPayPeriodDays(inputs.payFrequency);
    
    // Adjust salary for FTE
    const effectiveAnnualSalary = annualSalary * fte;
    
    // Calculate current period amounts
    const grossPay = effectiveAnnualSalary / periodsPerYear;
    const annualTax = calculateTax(effectiveAnnualSalary, inputs.taxYear);
    const taxPerPeriod = annualTax / periodsPerYear;
    
    // Calculate Medicare charges
    const annualMedicareLevy = calculateMedicareLevy(effectiveAnnualSalary, inputs.taxYear);
    const annualMedicareLevySurcharge = calculateMedicareLevySurcharge(
      effectiveAnnualSalary, 
      inputs.taxYear, 
      inputs.hasPrivateHealthInsurance
    );
    const annualTotalMedicareCharges = annualMedicareLevy + annualMedicareLevySurcharge;
    
    const medicareLevyPerPeriod = annualMedicareLevy / periodsPerYear;
    const medicareLevySurchargePerPeriod = annualMedicareLevySurcharge / periodsPerYear;
    const totalMedicareChargesPerPeriod = annualTotalMedicareCharges / periodsPerYear;
    
    const netPay = grossPay - taxPerPeriod - totalMedicareChargesPerPeriod;
    
    // Superannuation
    const superRate = superRates[inputs.taxYear];
    const superannuation = grossPay * superRate;
    
    // Calculate hours worked this period
    const hoursPerPeriod = (fullTimeHours * fte * payPeriodDays) / 7;
    
    // Annual leave accrual (20 days per year for full-time, pro-rated for part-time)
    const annualLeaveDaysPerYear = 20 * fte;
    const workingDaysPerYear = 260.87;
    const annualLeaveAccrualRate = annualLeaveDaysPerYear / workingDaysPerYear;
    const workingDaysThisPeriod = (payPeriodDays * 5 / 7);
    const annualLeaveAccrualDays = workingDaysThisPeriod * annualLeaveAccrualRate;
    const hoursPerDay = fullTimeHours / 5;
    const annualLeaveAccrualHours = annualLeaveAccrualDays * hoursPerDay;
    
    // Calculate YTD figures
    const payDate = new Date(inputs.payDate);
    const employmentStart = new Date(inputs.employmentStartDate);
    const financialYearStart = new Date(payDate.getFullYear() - (payDate.getMonth() < 6 ? 1 : 0), 6, 1);
    
    const ytdStartDate = employmentStart > financialYearStart ? employmentStart : financialYearStart;
    
    const daysDiff = Math.floor((payDate.getTime() - ytdStartDate.getTime()) / (1000 * 60 * 60 * 24));
    const yearDays = 365.25;
    
    const ytdProportion = daysDiff / yearDays;
    const ytdMaxGross = effectiveAnnualSalary * ytdProportion;
    const ytdMaxTax = annualTax * ytdProportion;
    const ytdMaxMedicareLevy = annualMedicareLevy * ytdProportion;
    const ytdMaxMedicareLevySurcharge = annualMedicareLevySurcharge * ytdProportion;
    const ytdMaxTotalMedicareCharges = annualTotalMedicareCharges * ytdProportion;
    const ytdMaxNet = ytdMaxGross - ytdMaxTax - ytdMaxTotalMedicareCharges;
    const ytdMaxSuper = ytdMaxGross * superRate;
    
    const periodsToDate = Math.floor(daysDiff / payPeriodDays) + 1;
    
    const ytdGross = Math.min(grossPay * periodsToDate, ytdMaxGross);
    const ytdTax = Math.min(taxPerPeriod * periodsToDate, ytdMaxTax);
    const ytdMedicareLevy = Math.min(medicareLevyPerPeriod * periodsToDate, ytdMaxMedicareLevy);
    const ytdMedicareLevySurcharge = Math.min(medicareLevySurchargePerPeriod * periodsToDate, ytdMaxMedicareLevySurcharge);
    const ytdTotalMedicareCharges = Math.min(totalMedicareChargesPerPeriod * periodsToDate, ytdMaxTotalMedicareCharges);
    const ytdNet = Math.min(netPay * periodsToDate, ytdMaxNet);
    const ytdSuper = Math.min(superannuation * periodsToDate, ytdMaxSuper);

    const hourlyRate = effectiveAnnualSalary / (52.18 * fullTimeHours * fte);

    setResults({
      grossPay,
      taxableIncome: grossPay,
      tax: taxPerPeriod,
      medicareLevy: medicareLevyPerPeriod,
      medicareLevySurcharge: medicareLevySurchargePerPeriod,
      totalMedicareCharges: totalMedicareChargesPerPeriod,
      netIncome: netPay,
      superannuation,
      annualLeaveAccrual: annualLeaveAccrualHours,
      hoursWorked: hoursPerPeriod,
      hourlyRate,
      ytd: {
        gross: ytdGross,
        tax: ytdTax,
        medicareLevy: ytdMedicareLevy,
        medicareLevySurcharge: ytdMedicareLevySurcharge,
        totalMedicareCharges: ytdTotalMedicareCharges,
        net: ytdNet,
        super: ytdSuper
      },
      periodsPerYear,
      payPeriodDays,
      periodsToDate,
      effectiveAnnualSalary,
      fte
    });
  }, [inputs]);

  useEffect(() => {
    calculateResults();
  }, [calculateResults]);

  const handleInputChange = (field: keyof InputState, value: string | boolean): void => {
    setInputs(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatHours = (hours: number): string => {
    return hours?.toFixed(2) || '0.00';
  };

  const formatRate = (rate: number): string => {
    return rate?.toFixed(4) || '0.0000';
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white">
      <div className="flex items-center gap-3 mb-8">
        <Calculator className="w-8 h-8 text-blue-600" />
        <h1 className="text-3xl font-bold text-gray-900">Australian Payslip Calculator</h1>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Input Section */}
        <div className="xl:col-span-1">
          <div className="bg-gray-50 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Input Details
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tax Year
                </label>
                <select 
                  value={inputs.taxYear}
                  onChange={(e) => handleInputChange('taxYear', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="2024-25">2024-25</option>
                  <option value="2025-26">2025-26</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-3 bg-white rounded-md border border-gray-300">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    I have appropriate private patient hospital cover
                  </label>
                  <p className="text-xs text-gray-500">
                    Hospital cover with excess ≤ $750 (single) / $1,500 (family)
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inputs.hasPrivateHealthInsurance}
                    onChange={(e) => handleInputChange('hasPrivateHealthInsurance', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pay Frequency
                </label>
                <select 
                  value={inputs.payFrequency}
                  onChange={(e) => handleInputChange('payFrequency', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="weekly">Weekly</option>
                  <option value="fortnightly">Fortnightly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pay Date
                  </label>
                  <input
                    type="date"
                    value={inputs.payDate}
                    onChange={(e) => handleInputChange('payDate', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Period End Date
                  </label>
                  <input
                    type="date"
                    value={inputs.periodEndDate}
                    onChange={(e) => handleInputChange('periodEndDate', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Annual Salary (Full-Time Equivalent)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    value={inputs.annualSalary}
                    onChange={(e) => handleInputChange('annualSalary', e.target.value)}
                    placeholder="66000"
                    className="w-full pl-10 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employment Start Date
                </label>
                <input
                  type="date"
                  value={inputs.employmentStartDate}
                  onChange={(e) => handleInputChange('employmentStartDate', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Full-Time Hours/Week
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={inputs.fullTimeHours}
                    onChange={(e) => handleInputChange('fullTimeHours', e.target.value)}
                    placeholder="38"
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Users className="w-4 h-4 inline mr-1" />
                    FTE (0.0 - 1.0)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={inputs.fte}
                    onChange={(e) => handleInputChange('fte', e.target.value)}
                    placeholder="1.0"
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="xl:col-span-2">
          <div className="bg-blue-50 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              Calculated Results ({inputs.taxYear})
            </h2>

            {results ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Current Period */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">This Pay Period</h3>
                  <div className="bg-white p-4 rounded-md space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Hours Worked:</span>
                      <span className="font-medium">{formatHours(results.hoursWorked)} hrs</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Hourly Rate:</span>
                      <span className="font-medium">{formatCurrency(results.hourlyRate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Gross Pay:</span>
                      <span className="font-medium">{formatCurrency(results.grossPay)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Taxable Income:</span>
                      <span className="font-medium">{formatCurrency(results.taxableIncome)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Income Tax:</span>
                      <span className="font-medium text-red-600">-{formatCurrency(results.tax)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Medicare Levy (2%):</span>
                      <span className="font-medium text-red-600">-{formatCurrency(results.medicareLevy)}</span>
                    </div>
                    {results.medicareLevySurcharge > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Medicare Levy Surcharge:</span>
                        <span className="font-medium text-red-600">-{formatCurrency(results.medicareLevySurcharge)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-gray-900 font-semibold">Net Income:</span>
                      <span className="font-bold text-green-600">{formatCurrency(results.netIncome)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Superannuation ({(superRates[inputs.taxYear] * 100).toFixed(1)}%):</span>
                      <span className="font-medium">{formatCurrency(results.superannuation)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Annual Leave Accrual:</span>
                      <span className="font-medium">{formatHours(results.annualLeaveAccrual)} hrs</span>
                    </div>
                  </div>
                </div>

                {/* YTD Figures */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Year to Date</h3>
                  <div className="bg-white p-4 rounded-md space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">YTD Gross:</span>
                      <span className="font-medium">{formatCurrency(results.ytd.gross)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">YTD Income Tax:</span>
                      <span className="font-medium text-red-600">-{formatCurrency(results.ytd.tax)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">YTD Medicare Levy:</span>
                      <span className="font-medium text-red-600">-{formatCurrency(results.ytd.medicareLevy)}</span>
                    </div>
                    {results.ytd.medicareLevySurcharge > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">YTD Medicare Levy Surcharge:</span>
                        <span className="font-medium text-red-600">-{formatCurrency(results.ytd.medicareLevySurcharge)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">YTD Net:</span>
                      <span className="font-medium text-green-600">{formatCurrency(results.ytd.net)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">YTD Super:</span>
                      <span className="font-medium">{formatCurrency(results.ytd.super)}</span>
                    </div>
                  </div>

                  {/* Employment Summary */}
                  <h3 className="text-lg font-medium text-gray-900 mb-3 mt-6">Employment Summary</h3>
                  <div className="bg-white p-4 rounded-md space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Effective Annual Salary:</span>
                      <span className="font-medium">{formatCurrency(results.effectiveAnnualSalary)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">FTE:</span>
                      <span className="font-medium">{formatRate(results.fte)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Hours/Week:</span>
                      <span className="font-medium">{formatHours(parseFloat(inputs.fullTimeHours) * results.fte)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Pay Periods/Year:</span>
                      <span className="font-medium">{results.periodsPerYear.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Pay Periods to Date:</span>
                      <span className="font-medium">{results.periodsToDate}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-gray-500 text-center py-8">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Enter all required fields to see calculations</p>
              </div>
            )}

            {/* Calculation Notes */}
            {results && (
              <div className="mt-6 text-xs text-gray-500 bg-white p-3 rounded-md">
                <p><strong>Calculation Notes ({inputs.taxYear}):</strong></p>
                <p>• Income tax calculated using {inputs.taxYear} ATO rates</p>
                <p>• Medicare levy (2%) applies to taxable income above thresholds</p>
                {results.medicareLevySurcharge > 0 ? (
                  <p className="text-orange-600 font-medium">• Medicare levy surcharge applies - no appropriate private health insurance</p>
                ) : inputs.hasPrivateHealthInsurance ? (
                  <p className="text-green-600 font-medium">• No Medicare levy surcharge - you have private health insurance</p>
                ) : (
                  <p className="text-blue-600 font-medium">• No Medicare levy surcharge - income below threshold</p>
                )}
                <p>• Super at {(superRates[inputs.taxYear] * 100).toFixed(1)}% ({inputs.taxYear} rate)</p>
                <p>• Annual leave: 20 days/year (full-time), pro-rated for part-time</p>
                <p>• FTE of {formatRate(results.fte)} = {formatHours(parseFloat(inputs.fullTimeHours) * results.fte)} hours/week</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayslipCalculator;