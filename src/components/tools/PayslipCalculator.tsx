'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Calculator, DollarSign, FileText, Clock, Users, Download, Plus, Trash2 } from 'lucide-react';
import jsPDF from 'jspdf';
import {
  type InputState,
  type CalculationResults,
  type jsPDFWithAutoTable,
  type PreTaxDeduction,
  type PostTaxDeduction,
  type AdditionalEarning,
  type LeaveItem,
  formatCurrency,
  formatHours,
  formatRate,
  calculateTax,
  calculateMedicareLevy,
  calculateMedicareLevySurcharge,
  getPayPeriodsPerYear,
  getPayPeriodDays,
  superRates,
  generateXeroLikePDF,
  generateSAPLikePDF,
  generateSimplePDF,
  generateGovernmentPDF,
  templates
} from '@/lib/payslip';

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
          generateXeroLikePDF(doc, currentPayDate, currentPeriodEndDate, inputs, results);
          break;
        case 'sap-like':
          generateSAPLikePDF(doc, currentPayDate, currentPeriodEndDate, inputs, results);
          break;
        case 'simple':
          generateSimplePDF(doc, currentPayDate, currentPeriodEndDate, inputs, results);
          break;
        case 'government':
          generateGovernmentPDF(doc, currentPayDate, currentPeriodEndDate, inputs, results);
          break;
        default:
          generateXeroLikePDF(doc, currentPayDate, currentPeriodEndDate, inputs, results);
      }
    }

    // Save PDF
    const templateName = templates.find(t => t.id === inputs.pdfTemplate)?.name || 'payslip';
    const filename = numberOfPayslips > 1
      ? `${templateName}_payslips_${inputs.payDate}_x${numberOfPayslips}.pdf`
      : `${templateName}_payslip_${inputs.payDate}.pdf`;

    doc.save(filename);
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
