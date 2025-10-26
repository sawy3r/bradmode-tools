import jsPDF from 'jspdf';

// ============ TYPE EXTENSIONS ============

// Extend jsPDF to include autoTable properties
export interface jsPDFWithAutoTable extends jsPDF {
  lastAutoTable?: {
    finalY: number;
  };
}

// ============ INTERFACES ============

export interface PreTaxDeduction {
  id: string;
  name: string;
  amount: number;
  ytdAmount: number;
}

export interface PostTaxDeduction {
  id: string;
  name: string;
  amount: number;
  ytdAmount: number;
}

export interface AdditionalEarning {
  id: string;
  name: string;
  amount: number;
  hours?: number;
  rate?: number;
}

export interface LeaveItem {
  id: string;
  type: string; // 'sick', 'personal', 'annual', 'unpaid'
  hours: number;
}

export interface InputState {
  // Basic Details
  payFrequency: string;
  payDate: string;
  periodEndDate: string;
  annualSalary: string;
  employmentStartDate: string;
  taxYear: string;
  fullTimeHours: string;
  fte: string;
  hasPrivateHealthInsurance: boolean;

  // New Fields
  basePayName: string;
  companyName: string;
  employeeName: string;
  employeeNumber: string;
  numberOfPayslips: string;
  pdfTemplate: string;
  employeeAddress: string;
  companyAddress: string;
  companyABN: string;
  superFundName: string;
  bankName: string;
  bankBSB: string;
  bankAccountNumber: string;

  // Dynamic Lists
  preTaxDeductions: PreTaxDeduction[];
  postTaxDeductions: PostTaxDeduction[];
  additionalEarnings: AdditionalEarning[];
  leaveItems: LeaveItem[];
}

export interface TemplateConfig {
  id: string;
  name: string;
  description: string;
}

export interface TaxBracket {
  min: number;
  max: number;
  rate: number;
  offset: number;
}

export interface CalculationResults {
  // Base calculations
  basePayHours: number;
  basePayAmount: number;

  // Additional earnings
  additionalEarningsTotal: number;

  // Gross and taxable
  grossPay: number;
  preTaxDeductionsTotal: number;
  taxableIncome: number;

  // Tax and levies
  tax: number;
  medicareLevy: number;
  medicareLevySurcharge: number;
  totalMedicareCharges: number;

  // Post-tax
  postTaxDeductionsTotal: number;
  netIncome: number;

  // Super and leave
  superannuation: number;
  annualLeaveAccrual: number;

  // Hours and rates
  hoursWorked: number;
  leaveHoursTaken: number;
  hourlyRate: number;

  // YTD
  ytd: {
    gross: number;
    preTaxDeductions: number;
    tax: number;
    medicareLevy: number;
    medicareLevySurcharge: number;
    totalMedicareCharges: number;
    postTaxDeductions: number;
    net: number;
    super: number;
  };

  // Period info
  periodsPerYear: number;
  payPeriodDays: number;
  periodsToDate: number;
  effectiveAnnualSalary: number;
  fte: number;
}
