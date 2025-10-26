import autoTable from 'jspdf-autotable';
import { jsPDFWithAutoTable, InputState, CalculationResults } from '../types';
import { formatCurrency, formatHours, maskBankAccount, formatRate } from '../formatters';

/**
 * Generates a Simple PDF payslip template.
 * This minimalist black and white template features a centered header,
 * employee details, and a clean table layout with earnings, deductions, and leave.
 */
export const generateSimplePDF = (
  doc: jsPDFWithAutoTable,
  currentPayDate: Date,
  currentPeriodEndDate: Date,
  inputs: InputState,
  results: CalculationResults
): number => {
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
