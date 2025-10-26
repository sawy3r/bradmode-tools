// ============ FORMATTING UTILITIES ============

/**
 * Format a number as Australian currency
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2
  }).format(amount || 0);
};

/**
 * Format hours with 2 decimal places
 */
export const formatHours = (hours: number): string => {
  return hours?.toFixed(2) || '0.00';
};

/**
 * Format rate with 4 decimal places
 */
export const formatRate = (rate: number): string => {
  return rate?.toFixed(4) || '0.0000';
};

/**
 * Mask bank account number (show last 4 digits only)
 */
export const maskBankAccount = (account: string): string => {
  if (!account || account.length < 4) return account;
  return '*'.repeat(account.length - 4) + account.slice(-4);
};
