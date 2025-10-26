import autoTable from 'jspdf-autotable';
import { jsPDFWithAutoTable, InputState, CalculationResults } from '../types';
import { formatCurrency, formatHours, maskBankAccount, formatRate } from '../formatters';

/**
 * Generates a Government-style PDF payslip template.
 * This official clean design features boxed staff and pay details,
 * a comprehensive earnings/deductions table, superannuation section,
 * leave balances, and bank information.
 */
export const generateGovernmentPDF = (
  doc: jsPDFWithAutoTable,
  currentPayDate: Date,
  currentPeriodEndDate: Date,
  inputs: InputState,
  results: CalculationResults
): number => {
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
