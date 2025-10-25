'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Calculator, Calendar, DollarSign, FileText, Clock, Users, Download, Plus, Trash2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ============ TYPE EXTENSIONS ============

// Extend jsPDF to include autoTable properties
interface jsPDFWithAutoTable extends jsPDF {
  lastAutoTable?: {
    finalY: number;
  };
}

// ============ INTERFACES ============

interface PreTaxDeduction {
  id: string;
  name: string;
  amount: number;
  ytdAmount: number;
}

interface PostTaxDeduction {
  id: string;
  name: string;
  amount: number;
  ytdAmount: number;
}

interface AdditionalEarning {
  id: string;
  name: string;
  amount: number;
  hours?: number;
  rate?: number;
}

interface LeaveItem {
  id: string;
  type: string; // 'sick', 'personal', 'annual', 'unpaid'
  hours: number;
}

interface InputState {
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

interface TemplateConfig {
  id: string;
  name: string;
  description: string;
}

interface TaxBracket {
  min: number;
  max: number;
  rate: number;
  offset: number;
}

interface CalculationResults {
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

// ============ TAX CONSTANTS ============

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

const medicareLevyThresholds: Record<string, { lower: number; upper: number }> = {
  '2024-25': { lower: 27222, upper: 34027 },
  '2025-26': { lower: 27222, upper: 34027 }
};

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

// ============ TEMPLATE CONFIGURATIONS ============

const templates: TemplateConfig[] = [
  {
    id: 'xero-like',
    name: 'Xero-like',
    description: 'Modern, clean design with clear sections and gray highlights'
  },
  {
    id: 'sap-like',
    name: 'SAP-like',
    description: 'Corporate dense layout with detailed tables and borders'
  },
  {
    id: 'simple',
    name: 'Simple',
    description: 'Minimalist black and white design with single table'
  },
  {
    id: 'government',
    name: 'Government',
    description: 'Official, clean design suitable for public sector'
  }
];

// ============ CALCULATION FUNCTIONS ============

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
    return 0;
  }

  if (taxableIncome <= thresholds.upper) {
    const reduction = (thresholds.upper - taxableIncome) / (thresholds.upper - thresholds.lower);
    return taxableIncome * rate * (1 - reduction);
  }

  return taxableIncome * rate;
};

const calculateMedicareLevySurcharge = (taxableIncome: number, year: string, hasInsurance: boolean): number => {
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

// ============ MAIN COMPONENT ============

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
    hasPrivateHealthInsurance: false,
    basePayName: 'Ordinary Hours',
    companyName: '',
    employeeName: '',
    employeeNumber: '',
    numberOfPayslips: '1',
    pdfTemplate: 'xero-like',
    employeeAddress: '',
    companyAddress: '',
    companyABN: '',
    superFundName: '',
    bankName: '',
    bankBSB: '',
    bankAccountNumber: '',
    preTaxDeductions: [],
    postTaxDeductions: [],
    additionalEarnings: [],
    leaveItems: []
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

    const effectiveAnnualSalary = annualSalary * fte;
    const hourlyRate = effectiveAnnualSalary / (52.18 * fullTimeHours * fte);

    // Calculate leave hours taken this period
    const leaveHoursTaken = inputs.leaveItems.reduce((sum, leave) => sum + leave.hours, 0);

    // Calculate base hours (total hours minus leave hours)
    const totalHoursForPeriod = (fullTimeHours * fte * payPeriodDays) / 7;
    const basePayHours = Math.max(0, totalHoursForPeriod - leaveHoursTaken);
    const basePayAmount = basePayHours * hourlyRate;

    // Calculate additional earnings
    const additionalEarningsTotal = inputs.additionalEarnings.reduce((sum, earning) => {
      if (earning.hours && earning.rate) {
        return sum + (earning.hours * earning.rate);
      }
      return sum + earning.amount;
    }, 0);

    // Gross pay = base pay + additional earnings
    const grossPay = basePayAmount + additionalEarningsTotal;

    // Calculate pre-tax deductions
    const preTaxDeductionsTotal = inputs.preTaxDeductions.reduce((sum, ded) => sum + ded.amount, 0);

    // Taxable income = gross - pre-tax deductions
    const taxableIncome = grossPay - preTaxDeductionsTotal;

    // Scale taxable income to annual for tax calculation
    const annualTaxableIncome = taxableIncome * periodsPerYear;
    const annualTax = calculateTax(annualTaxableIncome, inputs.taxYear);
    const taxPerPeriod = annualTax / periodsPerYear;

    // Calculate Medicare charges
    const annualMedicareLevy = calculateMedicareLevy(annualTaxableIncome, inputs.taxYear);
    const annualMedicareLevySurcharge = calculateMedicareLevySurcharge(
      annualTaxableIncome,
      inputs.taxYear,
      inputs.hasPrivateHealthInsurance
    );
    const annualTotalMedicareCharges = annualMedicareLevy + annualMedicareLevySurcharge;

    const medicareLevyPerPeriod = annualMedicareLevy / periodsPerYear;
    const medicareLevySurchargePerPeriod = annualMedicareLevySurcharge / periodsPerYear;
    const totalMedicareChargesPerPeriod = annualTotalMedicareCharges / periodsPerYear;

    // Calculate post-tax deductions
    const postTaxDeductionsTotal = inputs.postTaxDeductions.reduce((sum, ded) => sum + ded.amount, 0);

    // Net pay = gross - tax - medicare - post-tax deductions
    const netPay = grossPay - taxPerPeriod - totalMedicareChargesPerPeriod - postTaxDeductionsTotal;

    // Superannuation (on gross pay before deductions)
    const superRate = superRates[inputs.taxYear];
    const superannuation = grossPay * superRate;

    // Annual leave accrual
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
    const periodsToDate = Math.floor(daysDiff / payPeriodDays) + 1;

    // YTD calculations
    const ytdGross = grossPay * periodsToDate;
    const ytdPreTaxDeductions = inputs.preTaxDeductions.reduce((sum, ded) =>
      sum + (ded.ytdAmount || ded.amount * periodsToDate), 0);
    const ytdTax = taxPerPeriod * periodsToDate;
    const ytdMedicareLevy = medicareLevyPerPeriod * periodsToDate;
    const ytdMedicareLevySurcharge = medicareLevySurchargePerPeriod * periodsToDate;
    const ytdTotalMedicareCharges = totalMedicareChargesPerPeriod * periodsToDate;
    const ytdPostTaxDeductions = inputs.postTaxDeductions.reduce((sum, ded) =>
      sum + (ded.ytdAmount || ded.amount * periodsToDate), 0);
    const ytdNet = netPay * periodsToDate;
    const ytdSuper = superannuation * periodsToDate;

    setResults({
      basePayHours,
      basePayAmount,
      additionalEarningsTotal,
      grossPay,
      preTaxDeductionsTotal,
      taxableIncome,
      tax: taxPerPeriod,
      medicareLevy: medicareLevyPerPeriod,
      medicareLevySurcharge: medicareLevySurchargePerPeriod,
      totalMedicareCharges: totalMedicareChargesPerPeriod,
      postTaxDeductionsTotal,
      netIncome: netPay,
      superannuation,
      annualLeaveAccrual: annualLeaveAccrualHours,
      hoursWorked: basePayHours,
      leaveHoursTaken,
      hourlyRate,
      ytd: {
        gross: ytdGross,
        preTaxDeductions: ytdPreTaxDeductions,
        tax: ytdTax,
        medicareLevy: ytdMedicareLevy,
        medicareLevySurcharge: ytdMedicareLevySurcharge,
        totalMedicareCharges: ytdTotalMedicareCharges,
        postTaxDeductions: ytdPostTaxDeductions,
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

  // ============ DYNAMIC LIST HANDLERS ============

  const addPreTaxDeduction = () => {
    const newDeduction: PreTaxDeduction = {
      id: Date.now().toString(),
      name: '',
      amount: 0,
      ytdAmount: 0
    };
    setInputs(prev => ({
      ...prev,
      preTaxDeductions: [...prev.preTaxDeductions, newDeduction]
    }));
  };

  const updatePreTaxDeduction = (id: string, field: keyof PreTaxDeduction, value: string | number) => {
    setInputs(prev => ({
      ...prev,
      preTaxDeductions: prev.preTaxDeductions.map(ded =>
        ded.id === id ? { ...ded, [field]: value } : ded
      )
    }));
  };

  const removePreTaxDeduction = (id: string) => {
    setInputs(prev => ({
      ...prev,
      preTaxDeductions: prev.preTaxDeductions.filter(ded => ded.id !== id)
    }));
  };

  const addPostTaxDeduction = () => {
    const newDeduction: PostTaxDeduction = {
      id: Date.now().toString(),
      name: '',
      amount: 0,
      ytdAmount: 0
    };
    setInputs(prev => ({
      ...prev,
      postTaxDeductions: [...prev.postTaxDeductions, newDeduction]
    }));
  };

  const updatePostTaxDeduction = (id: string, field: keyof PostTaxDeduction, value: string | number) => {
    setInputs(prev => ({
      ...prev,
      postTaxDeductions: prev.postTaxDeductions.map(ded =>
        ded.id === id ? { ...ded, [field]: value } : ded
      )
    }));
  };

  const removePostTaxDeduction = (id: string) => {
    setInputs(prev => ({
      ...prev,
      postTaxDeductions: prev.postTaxDeductions.filter(ded => ded.id !== id)
    }));
  };

  const addAdditionalEarning = () => {
    const newEarning: AdditionalEarning = {
      id: Date.now().toString(),
      name: '',
      amount: 0,
      hours: 0,
      rate: 0
    };
    setInputs(prev => ({
      ...prev,
      additionalEarnings: [...prev.additionalEarnings, newEarning]
    }));
  };

  const updateAdditionalEarning = (id: string, field: keyof AdditionalEarning, value: string | number) => {
    setInputs(prev => ({
      ...prev,
      additionalEarnings: prev.additionalEarnings.map(earning =>
        earning.id === id ? { ...earning, [field]: value } : earning
      )
    }));
  };

  const removeAdditionalEarning = (id: string) => {
    setInputs(prev => ({
      ...prev,
      additionalEarnings: prev.additionalEarnings.filter(earning => earning.id !== id)
    }));
  };

  const addLeaveItem = () => {
    const newLeave: LeaveItem = {
      id: Date.now().toString(),
      type: 'annual',
      hours: 0
    };
    setInputs(prev => ({
      ...prev,
      leaveItems: [...prev.leaveItems, newLeave]
    }));
  };

  const updateLeaveItem = (id: string, field: keyof LeaveItem, value: string | number) => {
    setInputs(prev => ({
      ...prev,
      leaveItems: prev.leaveItems.map(leave =>
        leave.id === id ? { ...leave, [field]: value } : leave
      )
    }));
  };

  const removeLeaveItem = (id: string) => {
    setInputs(prev => ({
      ...prev,
      leaveItems: prev.leaveItems.filter(leave => leave.id !== id)
    }));
  };

  // ============ PDF GENERATION ============

  // Helper function to mask bank account (show last 4 digits)
  const maskBankAccount = (account: string): string => {
    if (!account || account.length < 4) return account;
    return '*'.repeat(account.length - 4) + account.slice(-4);
  };

  // Xero-like Template (Modern with gray highlights)
  const generateXeroLikePDF = (doc: jsPDFWithAutoTable, currentPayDate: Date, currentPeriodEndDate: Date) => {
    if (!results) return 0;

    let yPos = 20;

    // Employee Name and Address (left side)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    if (inputs.employeeName) {
      doc.text(inputs.employeeName, 20, yPos);
      yPos += 5;
    }
    doc.setFont('helvetica', 'normal');
    if (inputs.employeeAddress) {
      const addressLines = inputs.employeeAddress.split(',');
      addressLines.forEach(line => {
        doc.text(line.trim(), 20, yPos);
        yPos += 4;
      });
    }

    // Company Details (right side in gray box)
    doc.setFillColor(240, 240, 240);
    doc.rect(120, 15, 70, 35, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('PAID BY', 125, 20);
    doc.setFont('helvetica', 'normal');
    yPos = 25;
    if (inputs.companyName) {
      doc.text(inputs.companyName, 125, yPos);
      yPos += 4;
    }
    if (inputs.companyAddress) {
      const companyAddrLines = inputs.companyAddress.split(',');
      companyAddrLines.forEach(line => {
        doc.text(line.trim(), 125, yPos);
        yPos += 4;
      });
    }
    if (inputs.companyABN) {
      doc.text(`ABN ${inputs.companyABN}`, 125, yPos);
    }

    // Employment Details box
    yPos = 60;
    doc.setFillColor(240, 240, 240);
    doc.rect(120, yPos, 70, 20, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('EMPLOYMENT DETAILS', 125, yPos + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Pay Frequency: ${inputs.payFrequency.charAt(0).toUpperCase() + inputs.payFrequency.slice(1)}`, 125, yPos + 10);
    doc.text(`Annual Salary: ${formatCurrency(parseFloat(inputs.annualSalary))}`, 125, yPos + 15);

    // Pay Period Summary bar
    yPos = 85;
    doc.setFillColor(220, 220, 220);
    doc.rect(20, yPos, 170, 8, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Pay Period: ${currentPayDate.toLocaleDateString('en-AU')} - ${currentPeriodEndDate.toLocaleDateString('en-AU')}`, 22, yPos + 5.5);
    doc.text(`Payment Date: ${currentPayDate.toLocaleDateString('en-AU')}`, 90, yPos + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Earnings: ${formatCurrency(results.grossPay)}`, 130, yPos + 5.5);
    doc.text(`Net Pay: ${formatCurrency(results.netIncome)}`, 165, yPos + 5.5);

    yPos += 15;

    // Salary & Wages Section
    const salaryData: string[][] = [];
    salaryData.push([
      inputs.basePayName,
      formatHours(results.basePayHours),
      formatCurrency(results.hourlyRate),
      formatCurrency(results.basePayAmount),
      formatCurrency(results.ytd.gross)
    ]);

    inputs.additionalEarnings.forEach(earning => {
      const earningAmount = earning.hours && earning.rate ? earning.hours * earning.rate : earning.amount;
      salaryData.push([
        earning.name,
        earning.hours ? formatHours(earning.hours) : '',
        earning.rate ? formatCurrency(earning.rate) : '',
        formatCurrency(earningAmount),
        formatCurrency(earningAmount)
      ]);
    });

    if (inputs.leaveItems.length > 0) {
      inputs.leaveItems.forEach(leave => {
        salaryData.push([
          `${leave.type.charAt(0).toUpperCase() + leave.type.slice(1)} Leave`,
          formatHours(leave.hours),
          formatCurrency(0),
          formatCurrency(0),
          formatCurrency(0)
        ]);
      });
    }

    autoTable(doc, {
      startY: yPos,
      head: [['SALARY & WAGES', '', 'RATE', 'THIS PAY', 'YTD']],
      body: salaryData,
      foot: [['', '', 'TOTAL', formatCurrency(results.grossPay), formatCurrency(results.ytd.gross)]],
      theme: 'plain',
      headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold', fontSize: 9 },
      footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { halign: 'right', cellWidth: 25 },
        2: { halign: 'right', cellWidth: 25 },
        3: { halign: 'right', cellWidth: 30 },
        4: { halign: 'right', cellWidth: 30 }
      }
    });

    yPos = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : yPos + 10;

    // Deductions Section
    if (inputs.preTaxDeductions.length > 0 || inputs.postTaxDeductions.length > 0) {
      const deductionsData: string[][] = [];
      inputs.preTaxDeductions.forEach(ded => {
        deductionsData.push([ded.name + ' (Salary Sacrifice)', formatCurrency(ded.amount), formatCurrency(ded.ytdAmount)]);
      });

      autoTable(doc, {
        startY: yPos,
        head: [['DEDUCTIONS', 'THIS PAY', 'YTD']],
        body: deductionsData,
        foot: [['TOTAL', formatCurrency(results.preTaxDeductionsTotal), formatCurrency(results.ytd.preTaxDeductions)]],
        theme: 'plain',
        headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold', fontSize: 9 },
        footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 130 },
          1: { halign: 'right', cellWidth: 30 },
          2: { halign: 'right', cellWidth: 30 }
        }
      });

      yPos = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : yPos + 10;
    }

    // Tax Section
    const taxData: string[][] = [
      ['PAYG', formatCurrency(results.tax), formatCurrency(results.ytd.tax)]
    ];
    if (results.medicareLevy > 0) {
      taxData.push(['Medicare Levy', formatCurrency(results.medicareLevy), formatCurrency(results.ytd.medicareLevy)]);
    }
    if (results.medicareLevySurcharge > 0) {
      taxData.push(['Medicare Levy Surcharge', formatCurrency(results.medicareLevySurcharge), formatCurrency(results.ytd.medicareLevySurcharge)]);
    }

    autoTable(doc, {
      startY: yPos,
      head: [['TAX', 'THIS PAY', 'YTD']],
      body: taxData,
      foot: [['TOTAL', formatCurrency(results.tax + results.totalMedicareCharges), formatCurrency(results.ytd.tax + results.ytd.totalMedicareCharges)]],
      theme: 'plain',
      headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold', fontSize: 9 },
      footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 130 },
        1: { halign: 'right', cellWidth: 30 },
        2: { halign: 'right', cellWidth: 30 }
      }
    });

    yPos = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : yPos + 10;

    // Superannuation Section
    const superData: string[][] = [];
    if (inputs.superFundName) {
      superData.push([`SGC - ${inputs.superFundName}`, formatCurrency(results.superannuation), formatCurrency(results.ytd.super)]);
    } else {
      superData.push(['SGC - Superannuation', formatCurrency(results.superannuation), formatCurrency(results.ytd.super)]);
    }

    autoTable(doc, {
      startY: yPos,
      head: [['SUPERANNUATION', 'THIS PAY', 'YTD']],
      body: superData,
      foot: [['TOTAL', formatCurrency(results.superannuation), formatCurrency(results.ytd.super)]],
      theme: 'plain',
      headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold', fontSize: 9 },
      footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 130 },
        1: { halign: 'right', cellWidth: 30 },
        2: { halign: 'right', cellWidth: 30 }
      }
    });

    yPos = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : yPos + 10;

    // Leave Section
    const leaveData: string[][] = [
      ['Annual Leave in Hours', formatHours(results.annualLeaveAccrual), formatHours(results.leaveHoursTaken), formatHours(results.annualLeaveAccrual)]
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['LEAVE', 'ACCRUED', 'USED', 'BALANCE']],
      body: leaveData,
      theme: 'plain',
      headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold', fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { halign: 'right', cellWidth: 30 },
        2: { halign: 'right', cellWidth: 30 },
        3: { halign: 'right', cellWidth: 30 }
      }
    });

    yPos = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : yPos + 10;

    // Payment Details Section
    if (inputs.bankBSB && inputs.bankAccountNumber) {
      const paymentData: string[][] = [
        [`(${inputs.bankBSB})${maskBankAccount(inputs.bankAccountNumber)}`, inputs.employeeName || '', `${inputs.companyName} Salary`, formatCurrency(results.netIncome)]
      ];

      autoTable(doc, {
        startY: yPos,
        head: [['PAYMENT DETAILS', 'REFERENCE', '', 'AMOUNT']],
        body: paymentData,
        theme: 'plain',
        headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold', fontSize: 9 },
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 50 },
          2: { cellWidth: 50 },
          3: { halign: 'right', cellWidth: 30 }
        }
      });

      yPos = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY : yPos;
    }

    return yPos;
  };

  // SAP-like Template (Corporate dense layout)
  const generateSAPLikePDF = (doc: jsPDFWithAutoTable, currentPayDate: Date, currentPeriodEndDate: Date) => {
    if (!results) return 0;

    let yPos = 20;

    // Employee Info (top left)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (inputs.employeeName) {
      doc.text(`MR ${inputs.employeeName.toUpperCase()}`, 20, yPos);
      yPos += 5;
    }
    if (inputs.employeeAddress) {
      const addressLines = inputs.employeeAddress.split(',');
      addressLines.forEach(line => {
        doc.text(line.trim(), 20, yPos);
        yPos += 4;
      });
    }

    // Company Logo area (top right - placeholder)
    if (inputs.companyName) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(inputs.companyName, 190, 25, { align: 'right' });
    }

    yPos = 50;

    // Employee Pay Details Header Table
    doc.rect(20, yPos, 170, 8);
    doc.setFillColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('EMPLOYEE PAY DETAILS', 105, yPos + 5.5, { align: 'center' });

    yPos += 8;

    // Details grid
    const detailsData: string[][] = [
      ['Month to', 'Pay Date', 'Emp No.', 'Name', 'Status'],
      [currentPeriodEndDate.toLocaleDateString('en-AU'), currentPayDate.toLocaleDateString('en-AU'), inputs.employeeNumber || '', `${inputs.employeeName || ''}`, 'Full Time']
    ];

    autoTable(doc, {
      startY: yPos,
      body: detailsData,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1 },
      columnStyles: {
        0: { cellWidth: 34 },
        1: { cellWidth: 34 },
        2: { cellWidth: 34 },
        3: { cellWidth: 34 },
        4: { cellWidth: 34 }
      }
    });

    yPos = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 5 : yPos + 15;

    // Elements and Allowances/Deductions Table
    const elementsData: string[][] = [];

    // Earnings
    elementsData.push([
      inputs.basePayName,
      formatRate(results.hourlyRate),
      formatHours(results.basePayHours),
      formatCurrency(results.basePayAmount),
      '',
      '',
      ''
    ]);

    inputs.additionalEarnings.forEach(earning => {
      const earningAmount = earning.hours && earning.rate ? earning.hours * earning.rate : earning.amount;
      elementsData.push([
        earning.name,
        earning.rate ? formatRate(earning.rate) : '',
        earning.hours ? formatHours(earning.hours) : '',
        formatCurrency(earningAmount),
        '',
        '',
        ''
      ]);
    });

    // Add empty rows for spacing
    while (elementsData.length < 3) {
      elementsData.push(['', '', '', '', '', '', '']);
    }

    // Deductions in right columns
    let deductionIndex = 0;
    inputs.preTaxDeductions.forEach(ded => {
      if (deductionIndex < elementsData.length) {
        elementsData[deductionIndex][4] = ded.name;
        elementsData[deductionIndex][5] = 'E';
        elementsData[deductionIndex][6] = formatCurrency(ded.amount);
      }
      deductionIndex++;
    });

    if (inputs.superFundName && deductionIndex < elementsData.length) {
      elementsData[deductionIndex][4] = inputs.superFundName;
      elementsData[deductionIndex][5] = 'E';
      elementsData[deductionIndex][6] = formatCurrency(results.superannuation);
    }

    autoTable(doc, {
      startY: yPos,
      head: [['Description', 'Rate', 'Hours', 'Value', 'Description', 'Tax Ind', 'Value']],
      body: elementsData,
      theme: 'grid',
      headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1 },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { halign: 'right', cellWidth: 20 },
        2: { halign: 'right', cellWidth: 20 },
        3: { halign: 'right', cellWidth: 25 },
        4: { cellWidth: 40 },
        5: { halign: 'center', cellWidth: 10 },
        6: { halign: 'right', cellWidth: 25 }
      }
    });

    yPos = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 5 : yPos + 40;

    // Summary of Earnings
    const summaryData: string[][] = [
      ['Gross', 'Taxable Income', 'Pre Tax Allows/Deds', 'Post Tax Allows/Deds', 'Tax', 'NET INCOME'],
      [formatCurrency(results.grossPay), formatCurrency(results.taxableIncome), formatCurrency(results.preTaxDeductionsTotal), formatCurrency(results.postTaxDeductionsTotal), formatCurrency(results.tax + results.totalMedicareCharges), formatCurrency(results.netIncome)]
    ];

    autoTable(doc, {
      startY: yPos,
      body: summaryData,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.1 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 28.33 },
        1: { halign: 'center', cellWidth: 28.33 },
        2: { halign: 'center', cellWidth: 28.33 },
        3: { halign: 'center', cellWidth: 28.33 },
        4: { halign: 'center', cellWidth: 28.33 },
        5: { halign: 'center', cellWidth: 28.35 }
      }
    });

    yPos = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 5 : yPos + 15;

    // Payment Disbursement
    if (inputs.bankName && inputs.bankBSB && inputs.bankAccountNumber) {
      const disbursementData: string[][] = [
        ['Method', 'Account No.', 'BSB Code', 'Bank', 'Amount'],
        ['EFT', maskBankAccount(inputs.bankAccountNumber), inputs.bankBSB, inputs.bankName, formatCurrency(results.netIncome)]
      ];

      autoTable(doc, {
        startY: yPos,
        head: [['PAY DISBURSEMENT DETAILS']],
        body: disbursementData,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1 },
        columnStyles: {
          0: { cellWidth: 34 },
          1: { cellWidth: 34 },
          2: { cellWidth: 34 },
          3: { cellWidth: 34 },
          4: { halign: 'right', cellWidth: 34 }
        }
      });

      yPos = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 5 : yPos + 15;
    }

    // YTD Details
    const ytdData: string[][] = [
      ['YTD Gross', 'YTD Taxable Income', 'YTD Deductions', 'YTD Tax', 'YTD Net'],
      [formatCurrency(results.ytd.gross), formatCurrency(results.ytd.gross - results.ytd.preTaxDeductions), formatCurrency(results.ytd.preTaxDeductions + results.ytd.postTaxDeductions), formatCurrency(results.ytd.tax + results.ytd.totalMedicareCharges), formatCurrency(results.ytd.net)]
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['YEAR TO DATE DETAILS']],
      body: ytdData,
      theme: 'grid',
      headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 34 },
        1: { halign: 'center', cellWidth: 34 },
        2: { halign: 'center', cellWidth: 34 },
        3: { halign: 'center', cellWidth: 34 },
        4: { halign: 'center', cellWidth: 34 }
      }
    });

    yPos = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY : yPos;

    // Footer
    if (inputs.companyABN) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(`${inputs.companyName} (ABN) ${inputs.companyABN}`, 190, 285, { align: 'right' });
    }

    return yPos;
  };

  // Simple Template (Minimalist black and white)
  const generateSimplePDF = (doc: jsPDFWithAutoTable, currentPayDate: Date, currentPeriodEndDate: Date) => {
    if (!results) return 0;

    // Company Name
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(inputs.companyName || 'Company Name', 105, 20, { align: 'center' });

    // Company Address
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (inputs.companyAddress) {
      doc.text(inputs.companyAddress, 105, 26, { align: 'center' });
    }
    if (inputs.companyABN) {
      doc.text(`A.B.N. ${inputs.companyABN}`, 105, 31, { align: 'center' });
    }

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Pay Slip', 105, 45, { align: 'center' });

    // Date Range
    doc.setFontSize(12);
    doc.text(`${currentPayDate.toLocaleDateString('en-AU')} To ${currentPeriodEndDate.toLocaleDateString('en-AU')}`, 105, 55, { align: 'center' });

    doc.setFontSize(9);
    doc.text('Page 1', 190, 55, { align: 'right' });

    let yPos = 70;

    // Employee and Company Details (left side)
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(inputs.companyName || '', 20, yPos);
    doc.text(`Cheque No: ${inputs.employeeNumber || 'N/A'}`, 140, yPos);
    yPos += 5;
    doc.text(inputs.companyABN ? `A.B.N. ${inputs.companyABN}` : '', 20, yPos);
    doc.text(`Payment Date: ${currentPayDate.toLocaleDateString('en-AU')}`, 140, yPos);
    yPos += 10;

    // Employee Details
    doc.setFont('helvetica', 'bold');
    doc.text(inputs.employeeName || '', 20, yPos);
    yPos += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(`Pay Frequency: ${inputs.payFrequency.charAt(0).toUpperCase() + inputs.payFrequency.slice(1)}`, 20, yPos);
    doc.text(`Employment Classification: ${inputs.fte === '1.0' ? 'Permanent Full Time' : 'Permanent Part Time'}`, 140, yPos);
    yPos += 5;
    doc.text(`Pay Period From: ${currentPayDate.toLocaleDateString('en-AU')} To ${currentPeriodEndDate.toLocaleDateString('en-AU')}`, 20, yPos);
    doc.text(`Annual Salary: ${formatCurrency(parseFloat(inputs.annualSalary))}`, 140, yPos);
    yPos += 5;
    doc.text(`Hourly Rate: ${formatCurrency(results.hourlyRate)}`, 20, yPos);
    doc.text(`Hourly Rate: ${formatCurrency(results.hourlyRate)}`, 140, yPos);
    yPos += 5;
    if (inputs.superFundName) {
      doc.text(`Superannuation Fund: ${inputs.superFundName}`, 20, yPos);
      yPos += 5;
    }

    yPos += 5;

    // Gross and Net Pay Summary
    doc.setFont('helvetica', 'bold');
    doc.text(`GROSS PAY: ${formatCurrency(results.grossPay)}`, 120, yPos);
    yPos += 5;
    doc.text(`NET PAY: ${formatCurrency(results.netIncome)}`, 120, yPos);
    yPos += 10;

    // Main Data Table
    const tableData: string[][] = [];

    // Base pay
    tableData.push([
      inputs.basePayName,
      formatHours(results.basePayHours),
      formatCurrency(results.hourlyRate),
      formatCurrency(results.basePayAmount),
      formatCurrency(results.ytd.gross),
      'Wages'
    ]);

    // Additional earnings
    inputs.additionalEarnings.forEach(earning => {
      const earningAmount = earning.hours && earning.rate ? earning.hours * earning.rate : earning.amount;
      tableData.push([
        earning.name,
        earning.hours ? formatHours(earning.hours) : '',
        earning.rate ? formatCurrency(earning.rate) : '',
        formatCurrency(earningAmount),
        formatCurrency(earningAmount),
        'Wages'
      ]);
    });

    // Leave items
    inputs.leaveItems.forEach(leave => {
      tableData.push([
        `${leave.type.charAt(0).toUpperCase() + leave.type.slice(1)} Leave`,
        formatHours(leave.hours),
        '',
        '',
        '',
        'Wages'
      ]);
    });

    // Tax
    tableData.push([
      'PAYG Withholding',
      '',
      '',
      '-' + formatCurrency(results.tax),
      '-' + formatCurrency(results.ytd.tax),
      'Tax'
    ]);

    // Leave accrual
    tableData.push([
      'Holiday Leave Accrual',
      formatHours(results.annualLeaveAccrual),
      '',
      '',
      formatHours(results.annualLeaveAccrual),
      'Entitlements'
    ]);

    // Super
    if (inputs.superFundName) {
      tableData.push([
        `${inputs.superFundName}`,
        '',
        '',
        formatCurrency(results.superannuation),
        formatCurrency(results.ytd.super),
        'Superannuation Expenses'
      ]);
    }

    autoTable(doc, {
      startY: yPos,
      head: [['DESCRIPTION', 'HOURS', 'CALC. RATE', 'AMOUNT', 'YTD', 'TYPE']],
      body: tableData,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { halign: 'right', cellWidth: 20 },
        2: { halign: 'right', cellWidth: 25 },
        3: { halign: 'right', cellWidth: 25 },
        4: { halign: 'right', cellWidth: 25 },
        5: { cellWidth: 35 }
      }
    });

    return doc.lastAutoTable?.finalY || yPos;
  };

  // Government Template (Official clean design)
  const generateGovernmentPDF = (doc: jsPDFWithAutoTable, currentPayDate: Date, currentPeriodEndDate: Date) => {
    if (!results) return 0;

    let yPos = 20;

    // Company Logo/Name (top right)
    if (inputs.companyName) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(inputs.companyName, 190, yPos, { align: 'right' });
      yPos += 15;
    }

    // Employee and Pay Details in boxes
    yPos = 40;

    // Left box - Staff Details
    doc.rect(20, yPos, 85, 25);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Staff Number: ' + (inputs.employeeNumber || ''), 22, yPos + 5);
    doc.setFont('helvetica', 'normal');
    doc.text((inputs.employeeName || '').toUpperCase(), 22, yPos + 10);
    doc.text('Salary Class: SOD', 22, yPos + 15);
    yPos += 5;

    // Right box - Pay Details
    doc.rect(105, 40, 85, 25);
    doc.setFont('helvetica', 'bold');
    doc.text('Pay Date: ' + currentPayDate.toLocaleDateString('en-AU'), 107, 45);
    doc.setFont('helvetica', 'normal');
    doc.text(`Pay Period: ${currentPayDate.toLocaleDateString('en-AU')} To ${currentPeriodEndDate.toLocaleDateString('en-AU')}`, 107, 50);
    doc.text('Pay Run Number: 001355', 107, 55);

    yPos = 75;

    // Main earnings/deductions table
    const mainData: string[][] = [];

    // Salary row
    mainData.push([
      'SALARY',
      formatHours(results.basePayHours),
      formatCurrency(results.hourlyRate),
      formatCurrency(results.basePayAmount),
      formatCurrency(results.ytd.gross)
    ]);

    // Additional earnings
    inputs.additionalEarnings.forEach(earning => {
      const earningAmount = earning.hours && earning.rate ? earning.hours * earning.rate : earning.amount;
      mainData.push([
        earning.name,
        earning.hours ? formatHours(earning.hours) : '',
        earning.rate ? formatCurrency(earning.rate) : '',
        formatCurrency(earningAmount),
        formatCurrency(earningAmount)
      ]);
    });

    // Empty rows for spacing
    if (mainData.length < 2) {
      mainData.push(['', '', '', '', '']);
    }

    // Deductions section label
    mainData.push(['Allowance', '', '', '', '']);
    mainData.push(['', '', '', '', '']);
    mainData.push(['Deductions', '', '', '', '']);
    mainData.push(['', '', '', '', '']);
    mainData.push(['Study & Training Loan Amount', '', '', '', '']);

    // Totals
    mainData.push(['', '', '', '', '']);
    mainData.push(['Gross', '', '', formatCurrency(results.grossPay), formatCurrency(results.ytd.gross)]);
    mainData.push(['', '', '', '', '']);
    mainData.push(['Taxable', '', '', formatCurrency(results.taxableIncome), formatCurrency(results.ytd.gross - results.ytd.preTaxDeductions)]);
    mainData.push(['', '', '', '', '']);
    mainData.push(['Tax', '', '', formatCurrency(results.tax + results.totalMedicareCharges), formatCurrency(results.ytd.tax + results.ytd.totalMedicareCharges)]);
    mainData.push(['', '', '', '', '']);
    mainData.push(['Net Pay', '', '', formatCurrency(results.netIncome), formatCurrency(results.ytd.net)]);

    autoTable(doc, {
      startY: yPos,
      head: [['Description', 'Hours', 'Rate', 'This Pay', 'Year To Date']],
      body: mainData,
      theme: 'grid',
      headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold', fontSize: 9, lineWidth: 0.1, lineColor: [0, 0, 0] },
      styles: { fontSize: 9, cellPadding: 2, lineWidth: 0.1, lineColor: [0, 0, 0] },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { halign: 'right', cellWidth: 20 },
        2: { halign: 'right', cellWidth: 25 },
        3: { halign: 'right', cellWidth: 30 },
        4: { halign: 'right', cellWidth: 35 }
      }
    });

    yPos = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : yPos + 100;

    // Superannuation
    const superData: string[][] = [
      ['AWARE SUPER - COY', '', '', formatCurrency(results.superannuation), formatCurrency(results.ytd.super)]
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['Superannuation', '', '', '', '']],
      body: superData,
      theme: 'grid',
      headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold', fontSize: 9, lineWidth: 0.1, lineColor: [0, 0, 0] },
      styles: { fontSize: 9, cellPadding: 2, lineWidth: 0.1, lineColor: [0, 0, 0] },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 20 },
        2: { cellWidth: 25 },
        3: { halign: 'right', cellWidth: 30 },
        4: { halign: 'right', cellWidth: 35 }
      }
    });

    yPos = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : yPos + 20;

    // Leave Balances
    const leaveData: string[][] = [
      ['ANNUAL LEAVE - TOTAL', 'HOURS', formatHours(results.annualLeaveAccrual)]
    ];

    autoTable(doc, {
      startY: yPos,
      body: leaveData,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2, fontStyle: 'bold', lineWidth: 0.1, lineColor: [0, 0, 0] },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { halign: 'center', cellWidth: 40 },
        2: { halign: 'center', cellWidth: 50 }
      }
    });

    yPos = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : yPos + 15;

    // Bank Information
    if (inputs.bankBSB && inputs.bankAccountNumber) {
      const bankData: string[][] = [
        ['BSB: ' + inputs.bankBSB, '', ''],
        ['Account: ' + maskBankAccount(inputs.bankAccountNumber), '', ''],
        ['Account Name: ' + (inputs.employeeName || ''), '', '']
      ];

      autoTable(doc, {
        startY: yPos,
        head: [['Bank Information', '', '']],
        body: bankData,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold', fontSize: 9, lineWidth: 0.1, lineColor: [0, 0, 0] },
        styles: { fontSize: 9, cellPadding: 2, lineWidth: 0.1, lineColor: [0, 0, 0] },
      });

      yPos = doc.lastAutoTable?.finalY || yPos;
    }

    // Footer
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    if (inputs.companyABN) {
      doc.text(`Official Copy of ${inputs.companyName} Payslip`, 105, 280, { align: 'center' });
      doc.text(`ABN ${inputs.companyABN}`, 105, 285, { align: 'center' });
    }

    return yPos;
  };

  // Main PDF Generation Function
  const generatePDF = () => {
    if (!results) return;

    const numberOfPayslips = parseInt(inputs.numberOfPayslips) || 1;
    const doc = new jsPDF() as jsPDFWithAutoTable;

    for (let i = 0; i < numberOfPayslips; i++) {
      if (i > 0) {
        doc.addPage();
      }

      // Calculate dates for this payslip
      const basePayDate = new Date(inputs.payDate);
      const basePeriodEndDate = new Date(inputs.periodEndDate);
      const payPeriodDays = getPayPeriodDays(inputs.payFrequency);

      const currentPayDate = new Date(basePayDate);
      currentPayDate.setDate(currentPayDate.getDate() + (i * payPeriodDays));

      const currentPeriodEndDate = new Date(basePeriodEndDate);
      currentPeriodEndDate.setDate(currentPeriodEndDate.getDate() + (i * payPeriodDays));

      // Generate based on selected template
      switch (inputs.pdfTemplate) {
        case 'xero-like':
          generateXeroLikePDF(doc, currentPayDate, currentPeriodEndDate);
          break;
        case 'sap-like':
          generateSAPLikePDF(doc, currentPayDate, currentPeriodEndDate);
          break;
        case 'simple':
          generateSimplePDF(doc, currentPayDate, currentPeriodEndDate);
          break;
        case 'government':
          generateGovernmentPDF(doc, currentPayDate, currentPeriodEndDate);
          break;
        default:
          generateXeroLikePDF(doc, currentPayDate, currentPeriodEndDate);
      }
    }

    // Save PDF
    const templateName = templates.find(t => t.id === inputs.pdfTemplate)?.name || 'payslip';
    const filename = numberOfPayslips > 1
      ? `${templateName}_payslips_${inputs.payDate}_x${numberOfPayslips}.pdf`
      : `${templateName}_payslip_${inputs.payDate}.pdf`;

    doc.save(filename);
  };

  // ============ FORMATTING FUNCTIONS ============

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

  // ============ RENDER ============

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Calculator className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Australian Payslip Calculator</h1>
        </div>

        {results && (
          <button
            onClick={generatePDF}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="w-5 h-5" />
            Generate PDF
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Input Section */}
        <div className="xl:col-span-1 space-y-6">
          {/* Basic Details */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Basic Details
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name (for PDF)
                </label>
                <input
                  type="text"
                  value={inputs.companyName}
                  onChange={(e) => handleInputChange('companyName', e.target.value)}
                  placeholder="Acme Corporation"
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee Name (for PDF)
                </label>
                <input
                  type="text"
                  value={inputs.employeeName}
                  onChange={(e) => handleInputChange('employeeName', e.target.value)}
                  placeholder="John Smith"
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee Number (for PDF)
                </label>
                <input
                  type="text"
                  value={inputs.employeeNumber}
                  onChange={(e) => handleInputChange('employeeNumber', e.target.value)}
                  placeholder="EMP001"
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee Address (for PDF)
                </label>
                <input
                  type="text"
                  value={inputs.employeeAddress}
                  onChange={(e) => handleInputChange('employeeAddress', e.target.value)}
                  placeholder="123 Main St, Suburb VIC 3000"
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Address (for PDF)
                </label>
                <input
                  type="text"
                  value={inputs.companyAddress}
                  onChange={(e) => handleInputChange('companyAddress', e.target.value)}
                  placeholder="456 Business Ave, Melbourne VIC 3000"
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company ABN (for PDF)
                </label>
                <input
                  type="text"
                  value={inputs.companyABN}
                  onChange={(e) => handleInputChange('companyABN', e.target.value)}
                  placeholder="12 345 678 901"
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PDF Template Style
                </label>
                <select
                  value={inputs.pdfTemplate}
                  onChange={(e) => handleInputChange('pdfTemplate', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {templates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name} - {template.description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Superannuation Fund Name
                </label>
                <input
                  type="text"
                  value={inputs.superFundName}
                  onChange={(e) => handleInputChange('superFundName', e.target.value)}
                  placeholder="e.g., Australian Super, IOOF, AMP"
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={inputs.bankName}
                  onChange={(e) => handleInputChange('bankName', e.target.value)}
                  placeholder="e.g., NAB, Commonwealth Bank, Westpac"
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    BSB
                  </label>
                  <input
                    type="text"
                    value={inputs.bankBSB}
                    onChange={(e) => handleInputChange('bankBSB', e.target.value)}
                    placeholder="082-451"
                    maxLength={7}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={inputs.bankAccountNumber}
                    onChange={(e) => handleInputChange('bankAccountNumber', e.target.value)}
                    placeholder="12345678"
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Base Pay / Earnings Name
                </label>
                <input
                  type="text"
                  value={inputs.basePayName}
                  onChange={(e) => handleInputChange('basePayName', e.target.value)}
                  placeholder="Ordinary Hours"
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  e.g., &quot;Workers Compensation&quot;, &quot;Maternity Leave Pay&quot;
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Consecutive Payslips to Generate
                </label>
                <input
                  type="number"
                  min="1"
                  max="52"
                  value={inputs.numberOfPayslips}
                  onChange={(e) => handleInputChange('numberOfPayslips', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

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

          {/* Pre-Tax Deductions */}
          <div className="bg-orange-50 p-6 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Pre-Tax Deductions
              </h2>
              <button
                onClick={addPreTaxDeduction}
                className="flex items-center gap-1 px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            <div className="space-y-3">
              {inputs.preTaxDeductions.length === 0 && (
                <p className="text-sm text-gray-500 italic">No pre-tax deductions added</p>
              )}

              {inputs.preTaxDeductions.map(deduction => (
                <div key={deduction.id} className="bg-white p-3 rounded-md border border-orange-200">
                  <div className="flex justify-between items-start mb-2">
                    <input
                      type="text"
                      value={deduction.name}
                      onChange={(e) => updatePreTaxDeduction(deduction.id, 'name', e.target.value)}
                      placeholder="e.g., Salary Sacrifice, Novated Lease"
                      className="flex-1 p-2 border border-gray-300 rounded text-sm"
                    />
                    <button
                      onClick={() => removePreTaxDeduction(deduction.id)}
                      className="ml-2 p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-600">This Period</label>
                      <input
                        type="number"
                        step="0.01"
                        value={deduction.amount}
                        onChange={(e) => updatePreTaxDeduction(deduction.id, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-full p-2 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">YTD Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        value={deduction.ytdAmount}
                        onChange={(e) => updatePreTaxDeduction(deduction.id, 'ytdAmount', parseFloat(e.target.value) || 0)}
                        className="w-full p-2 border border-gray-300 rounded text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Post-Tax Deductions */}
          <div className="bg-red-50 p-6 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Post-Tax Deductions
              </h2>
              <button
                onClick={addPostTaxDeduction}
                className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            <div className="space-y-3">
              {inputs.postTaxDeductions.length === 0 && (
                <p className="text-sm text-gray-500 italic">No post-tax deductions added</p>
              )}

              {inputs.postTaxDeductions.map(deduction => (
                <div key={deduction.id} className="bg-white p-3 rounded-md border border-red-200">
                  <div className="flex justify-between items-start mb-2">
                    <input
                      type="text"
                      value={deduction.name}
                      onChange={(e) => updatePostTaxDeduction(deduction.id, 'name', e.target.value)}
                      placeholder="e.g., Novated Lease Post-tax"
                      className="flex-1 p-2 border border-gray-300 rounded text-sm"
                    />
                    <button
                      onClick={() => removePostTaxDeduction(deduction.id)}
                      className="ml-2 p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-600">This Period</label>
                      <input
                        type="number"
                        step="0.01"
                        value={deduction.amount}
                        onChange={(e) => updatePostTaxDeduction(deduction.id, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-full p-2 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">YTD Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        value={deduction.ytdAmount}
                        onChange={(e) => updatePostTaxDeduction(deduction.id, 'ytdAmount', parseFloat(e.target.value) || 0)}
                        className="w-full p-2 border border-gray-300 rounded text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Additional Earnings */}
          <div className="bg-green-50 p-6 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Additional Earnings
              </h2>
              <button
                onClick={addAdditionalEarning}
                className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            <div className="space-y-3">
              {inputs.additionalEarnings.length === 0 && (
                <p className="text-sm text-gray-500 italic">No additional earnings added</p>
              )}

              {inputs.additionalEarnings.map(earning => (
                <div key={earning.id} className="bg-white p-3 rounded-md border border-green-200">
                  <div className="flex justify-between items-start mb-2">
                    <input
                      type="text"
                      value={earning.name}
                      onChange={(e) => updateAdditionalEarning(earning.id, 'name', e.target.value)}
                      placeholder="e.g., Overtime, Bonus, Commission"
                      className="flex-1 p-2 border border-gray-300 rounded text-sm"
                    />
                    <button
                      onClick={() => removeAdditionalEarning(earning.id)}
                      className="ml-2 p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-gray-600">Hours</label>
                      <input
                        type="number"
                        step="0.01"
                        value={earning.hours || ''}
                        onChange={(e) => updateAdditionalEarning(earning.id, 'hours', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full p-2 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Rate</label>
                      <input
                        type="number"
                        step="0.01"
                        value={earning.rate || ''}
                        onChange={(e) => updateAdditionalEarning(earning.id, 'rate', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full p-2 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Or Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        value={earning.amount}
                        onChange={(e) => updateAdditionalEarning(earning.id, 'amount', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full p-2 border border-gray-300 rounded text-sm"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Use Hours × Rate OR Amount</p>
                </div>
              ))}
            </div>
          </div>

          {/* Leave Items */}
          <div className="bg-purple-50 p-6 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Leave Taken This Period
              </h2>
              <button
                onClick={addLeaveItem}
                className="flex items-center gap-1 px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            <div className="space-y-3">
              {inputs.leaveItems.length === 0 && (
                <p className="text-sm text-gray-500 italic">No leave taken this period</p>
              )}

              {inputs.leaveItems.map(leave => (
                <div key={leave.id} className="bg-white p-3 rounded-md border border-purple-200">
                  <div className="flex justify-between items-start gap-2">
                    <select
                      value={leave.type}
                      onChange={(e) => updateLeaveItem(leave.id, 'type', e.target.value)}
                      className="flex-1 p-2 border border-gray-300 rounded text-sm"
                    >
                      <option value="annual">Annual Leave</option>
                      <option value="sick">Sick Leave</option>
                      <option value="personal">Personal Leave</option>
                      <option value="unpaid">Unpaid Leave</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      value={leave.hours}
                      onChange={(e) => updateLeaveItem(leave.id, 'hours', parseFloat(e.target.value) || 0)}
                      placeholder="Hours"
                      className="w-24 p-2 border border-gray-300 rounded text-sm"
                    />
                    <button
                      onClick={() => removeLeaveItem(leave.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {inputs.leaveItems.length > 0 && (
              <p className="text-xs text-gray-500 mt-3">
                Leave hours will be subtracted from {inputs.basePayName} for this period
              </p>
            )}
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
                    {/* Earnings */}
                    <div className="border-b pb-2 mb-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase">Earnings</p>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600">{inputs.basePayName}:</span>
                      <span className="font-medium">{formatHours(results.basePayHours)} hrs @ {formatCurrency(results.hourlyRate)}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600"></span>
                      <span className="font-medium">{formatCurrency(results.basePayAmount)}</span>
                    </div>

                    {inputs.additionalEarnings.map(earning => {
                      const earningAmount = earning.hours && earning.rate
                        ? earning.hours * earning.rate
                        : earning.amount;
                      return (
                        <div key={earning.id} className="flex justify-between text-sm">
                          <span className="text-gray-600">{earning.name}:</span>
                          <span className="font-medium text-green-600">+{formatCurrency(earningAmount)}</span>
                        </div>
                      );
                    })}

                    {results.additionalEarningsTotal > 0 && (
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-gray-600">Additional Earnings Total:</span>
                        <span className="font-medium text-green-600">+{formatCurrency(results.additionalEarningsTotal)}</span>
                      </div>
                    )}

                    <div className="flex justify-between border-t pt-2">
                      <span className="text-gray-900 font-semibold">Gross Pay:</span>
                      <span className="font-bold">{formatCurrency(results.grossPay)}</span>
                    </div>

                    {/* Deductions */}
                    <div className="border-b pb-2 mb-2 mt-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase">Deductions</p>
                    </div>

                    {inputs.preTaxDeductions.map(ded => (
                      <div key={ded.id} className="flex justify-between text-sm">
                        <span className="text-gray-600">{ded.name} (Pre-tax):</span>
                        <span className="font-medium text-red-600">-{formatCurrency(ded.amount)}</span>
                      </div>
                    ))}

                    {results.preTaxDeductionsTotal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Pre-Tax Deductions Total:</span>
                        <span className="font-medium text-red-600">-{formatCurrency(results.preTaxDeductionsTotal)}</span>
                      </div>
                    )}

                    {results.preTaxDeductionsTotal > 0 && (
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-gray-600">Taxable Income:</span>
                        <span className="font-medium">{formatCurrency(results.taxableIncome)}</span>
                      </div>
                    )}

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

                    {inputs.postTaxDeductions.map(ded => (
                      <div key={ded.id} className="flex justify-between text-sm">
                        <span className="text-gray-600">{ded.name}:</span>
                        <span className="font-medium text-red-600">-{formatCurrency(ded.amount)}</span>
                      </div>
                    ))}

                    <div className="flex justify-between border-t pt-2 mt-2">
                      <span className="text-gray-900 font-semibold">Net Income:</span>
                      <span className="font-bold text-green-600">{formatCurrency(results.netIncome)}</span>
                    </div>

                    <div className="flex justify-between border-t pt-2 mt-2">
                      <span className="text-gray-600">Superannuation ({(superRates[inputs.taxYear] * 100).toFixed(1)}%):</span>
                      <span className="font-medium">{formatCurrency(results.superannuation)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Annual Leave Accrual:</span>
                      <span className="font-medium">{formatHours(results.annualLeaveAccrual)} hrs</span>
                    </div>

                    {results.leaveHoursTaken > 0 && (
                      <div className="flex justify-between border-t pt-2 mt-2">
                        <span className="text-gray-600">Leave Hours Taken:</span>
                        <span className="font-medium text-orange-600">{formatHours(results.leaveHoursTaken)} hrs</span>
                      </div>
                    )}
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
                    {results.ytd.preTaxDeductions > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">YTD Pre-Tax Deductions:</span>
                        <span className="font-medium text-red-600">-{formatCurrency(results.ytd.preTaxDeductions)}</span>
                      </div>
                    )}
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
                    {results.ytd.postTaxDeductions > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">YTD Post-Tax Deductions:</span>
                        <span className="font-medium text-red-600">-{formatCurrency(results.ytd.postTaxDeductions)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-gray-600 font-semibold">YTD Net:</span>
                      <span className="font-medium text-green-600">{formatCurrency(results.ytd.net)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
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
                {results.leaveHoursTaken > 0 && (
                  <p className="text-orange-600 font-medium">• Leave hours taken ({formatHours(results.leaveHoursTaken)} hrs) subtracted from {inputs.basePayName}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayslipCalculator;
