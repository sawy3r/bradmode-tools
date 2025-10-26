import autoTable from 'jspdf-autotable';
import { jsPDFWithAutoTable, InputState, CalculationResults } from '../types';
import { formatCurrency, formatHours, maskBankAccount, formatRate } from '../formatters';

/**
 * Generates a SAP-like PDF payslip template.
 * This template features a grid-based layout with employee details at top,
 * elements/allowances table, summary sections, and year-to-date details.
 */
export const generateSAPLikePDF = (
  doc: jsPDFWithAutoTable,
  currentPayDate: Date,
  currentPeriodEndDate: Date,
  inputs: InputState,
  results: CalculationResults
): number => {
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
