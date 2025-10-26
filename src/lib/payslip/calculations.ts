import { TaxBracket } from './types';

// ============ TAX CONSTANTS ============

export const taxBrackets: Record<string, TaxBracket[]> = {
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

export const medicareLevy: Record<string, number> = {
  '2024-25': 0.02,
  '2025-26': 0.02
};

export const superRates: Record<string, number> = {
  '2024-25': 0.115,
  '2025-26': 0.12
};

export const medicareLevyThresholds: Record<string, { lower: number; upper: number }> = {
  '2024-25': { lower: 27222, upper: 34027 },
  '2025-26': { lower: 27222, upper: 34027 }
};

export const mlsThresholds: Record<string, Array<{ min: number; max: number; rate: number }>> = {
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

// ============ CALCULATION FUNCTIONS ============

/**
 * Calculate PAYG tax for a given taxable income and year
 */
export const calculateTax = (taxableIncome: number, year: string): number => {
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

/**
 * Calculate Medicare Levy with phase-in threshold
 */
export const calculateMedicareLevy = (taxableIncome: number, year: string): number => {
  const thresholds = medicareLevyThresholds[year];
  const rate = medicareLevy[year];

  if (taxableIncome <= thresholds.lower) {
    return 0;
  }

  if (taxableIncome <= thresholds.upper) {
    const reduction = (thresholds.upper - taxableIncome) / (thresholds.upper - thresholds.lower);
    return taxableIncome * rate * (1 - reduction);
  }

  return taxableIncome * rate;
};

/**
 * Calculate Medicare Levy Surcharge based on income and insurance status
 */
export const calculateMedicareLevySurcharge = (
  taxableIncome: number,
  year: string,
  hasInsurance: boolean
): number => {
  if (hasInsurance) {
    return 0;
  }

  const thresholds = mlsThresholds[year];

  for (const threshold of thresholds) {
    if (taxableIncome >= threshold.min && taxableIncome <= threshold.max) {
      return taxableIncome * threshold.rate;
    }
  }

  return 0;
};

/**
 * Get number of pay periods per year based on frequency
 */
export const getPayPeriodsPerYear = (frequency: string): number => {
  const periods: Record<string, number> = {
    'weekly': 52.18,
    'fortnightly': 26.09,
    'monthly': 12,
    'quarterly': 4
  };
  return periods[frequency] || 26.09;
};

/**
 * Get number of days in a pay period based on frequency
 */
export const getPayPeriodDays = (frequency: string): number => {
  const days: Record<string, number> = {
    'weekly': 7,
    'fortnightly': 14,
    'monthly': 30.44,
    'quarterly': 91.33
  };
  return days[frequency] || 14;
};
