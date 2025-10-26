import autoTable from 'jspdf-autotable';
import { jsPDFWithAutoTable, InputState, CalculationResults } from '../types';
import { formatCurrency, formatHours, maskBankAccount } from '../formatters';

/**
 * Generate Xero-like PDF template
 * Modern, clean design with clear sections and gray highlights
 */
export const generateXeroLikePDF = (
  doc: jsPDFWithAutoTable,
  currentPayDate: Date,
  currentPeriodEndDate: Date,
  inputs: InputState,
  results: CalculationResults
): number => {
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
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.5);
  const summaryBarHeight = 8;
  doc.rect(20, yPos, 190, summaryBarHeight, 'FD'); // Full width bar to match tables

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Pay Period: ${currentPayDate.toLocaleDateString('en-AU')} - ${currentPeriodEndDate.toLocaleDateString('en-AU')}`, 22, yPos + 5.5);
  doc.text(`Payment Date: ${currentPayDate.toLocaleDateString('en-AU')}`, 85, yPos + 5.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Earnings: ${formatCurrency(results.grossPay)}`, 125, yPos + 5.5);
  doc.text(`Net Pay: ${formatCurrency(results.netIncome)}`, 162, yPos + 5.5);

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
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: 0,
      fontStyle: 'bold',
      fontSize: 9
    },
    footStyles: {
      fillColor: [240, 240, 240],
      textColor: 0,
      fontStyle: 'bold'
    },
    styles: { fontSize: 9, cellPadding: 1 },
    columnStyles: {
      0: { cellWidth: 80, halign: 'left' },
      1: { halign: 'right', cellWidth: 25 },
      2: { halign: 'right', cellWidth: 25 },
      3: { halign: 'right', cellWidth: 30 },
      4: { halign: 'right', cellWidth: 30 }
    },
    didParseCell: function(data) {
      // Right-align numeric column headers
      if (data.section === 'head' && data.column.index > 0) {
        data.cell.styles.halign = 'right';
      }
    },
    didDrawCell: function(data) {
      const darkGrey = [180, 180, 180];
      doc.setDrawColor(...darkGrey);
      doc.setLineWidth(0.5);

      // Bottom border on heading rows
      if (data.section === 'head') {
        doc.line(
          data.cell.x,
          data.cell.y + data.cell.height,
          data.cell.x + data.cell.width,
          data.cell.y + data.cell.height
        );
      }

      // Top and bottom borders on footer rows
      if (data.section === 'foot') {
        doc.line(
          data.cell.x,
          data.cell.y,
          data.cell.x + data.cell.width,
          data.cell.y
        );
        doc.line(
          data.cell.x,
          data.cell.y + data.cell.height,
          data.cell.x + data.cell.width,
          data.cell.y + data.cell.height
        );
      }
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
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: 0,
        fontStyle: 'bold',
        fontSize: 9
      },
      footStyles: {
        fillColor: [240, 240, 240],
        textColor: 0,
        fontStyle: 'bold'
      },
      styles: { fontSize: 9, cellPadding: 1 },
      columnStyles: {
        0: { cellWidth: 130, halign: 'left' },
        1: { halign: 'right', cellWidth: 30 },
        2: { halign: 'right', cellWidth: 30 }
      },
      didParseCell: function(data) {
        if (data.section === 'head' && data.column.index > 0) {
          data.cell.styles.halign = 'right';
        }
      },
      didDrawCell: function(data) {
        const darkGrey = [180, 180, 180];
        doc.setDrawColor(...darkGrey);
        doc.setLineWidth(0.5);

        // Bottom border on heading rows
        if (data.section === 'head') {
          doc.line(
            data.cell.x,
            data.cell.y + data.cell.height,
            data.cell.x + data.cell.width,
            data.cell.y + data.cell.height
          );
        }

        // Top and bottom borders on footer rows
        if (data.section === 'foot') {
          doc.line(
            data.cell.x,
            data.cell.y,
            data.cell.x + data.cell.width,
            data.cell.y
          );
          doc.line(
            data.cell.x,
            data.cell.y + data.cell.height,
            data.cell.x + data.cell.width,
            data.cell.y + data.cell.height
          );
        }
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
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: 0,
      fontStyle: 'bold',
      fontSize: 9
    },
    footStyles: {
      fillColor: [240, 240, 240],
      textColor: 0,
      fontStyle: 'bold'
    },
    styles: { fontSize: 9, cellPadding: 1 },
    columnStyles: {
      0: { cellWidth: 130, halign: 'left' },
      1: { halign: 'right', cellWidth: 30 },
      2: { halign: 'right', cellWidth: 30 }
    },
    didParseCell: function(data) {
      if (data.section === 'head' && data.column.index > 0) {
        data.cell.styles.halign = 'right';
      }
    },
    didDrawCell: function(data) {
      const darkGrey = [180, 180, 180];
      doc.setDrawColor(...darkGrey);
      doc.setLineWidth(0.5);

      // Bottom border on heading rows
      if (data.section === 'head') {
        doc.line(
          data.cell.x,
          data.cell.y + data.cell.height,
          data.cell.x + data.cell.width,
          data.cell.y + data.cell.height
        );
      }

      // Top and bottom borders on footer rows
      if (data.section === 'foot') {
        doc.line(
          data.cell.x,
          data.cell.y,
          data.cell.x + data.cell.width,
          data.cell.y
        );
        doc.line(
          data.cell.x,
          data.cell.y + data.cell.height,
          data.cell.x + data.cell.width,
          data.cell.y + data.cell.height
        );
      }
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
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: 0,
      fontStyle: 'bold',
      fontSize: 9
    },
    footStyles: {
      fillColor: [240, 240, 240],
      textColor: 0,
      fontStyle: 'bold'
    },
    styles: { fontSize: 9, cellPadding: 1 },
    columnStyles: {
      0: { cellWidth: 130, halign: 'left' },
      1: { halign: 'right', cellWidth: 30 },
      2: { halign: 'right', cellWidth: 30 }
    },
    didParseCell: function(data) {
      // Right-align numeric column headers
      if (data.section === 'head' && data.column.index > 0) {
        data.cell.styles.halign = 'right';
      }
    },
    didDrawCell: function(data) {
      const darkGrey = [180, 180, 180];
      doc.setDrawColor(...darkGrey);
      doc.setLineWidth(0.5);

      // Bottom border on heading rows
      if (data.section === 'head') {
        doc.line(
          data.cell.x,
          data.cell.y + data.cell.height,
          data.cell.x + data.cell.width,
          data.cell.y + data.cell.height
        );
      }

      // Top and bottom borders on footer rows
      if (data.section === 'foot') {
        doc.line(
          data.cell.x,
          data.cell.y,
          data.cell.x + data.cell.width,
          data.cell.y
        );
        doc.line(
          data.cell.x,
          data.cell.y + data.cell.height,
          data.cell.x + data.cell.width,
          data.cell.y + data.cell.height
        );
      }
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
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: 0,
      fontStyle: 'bold',
      fontSize: 9
    },
    styles: { fontSize: 9, cellPadding: 1 },
    columnStyles: {
      0: { cellWidth: 100, halign: 'left' },
      1: { halign: 'right', cellWidth: 30 },
      2: { halign: 'right', cellWidth: 30 },
      3: { halign: 'right', cellWidth: 30 }
    },
    didParseCell: function(data) {
      // Right-align numeric column headers
      if (data.section === 'head' && data.column.index > 0) {
        data.cell.styles.halign = 'right';
      }
    },
    didDrawCell: function(data) {
      const darkGrey = [180, 180, 180];
      doc.setDrawColor(...darkGrey);
      doc.setLineWidth(0.5);

      // Bottom border on heading rows
      if (data.section === 'head') {
        doc.line(
          data.cell.x,
          data.cell.y + data.cell.height,
          data.cell.x + data.cell.width,
          data.cell.y + data.cell.height
        );
      }
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
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: 0,
        fontStyle: 'bold',
        fontSize: 9
      },
      styles: { fontSize: 9, cellPadding: 1 },
      columnStyles: {
        0: { cellWidth: 60, halign: 'left' },
        1: { cellWidth: 50, halign: 'left' },
        2: { cellWidth: 50, halign: 'left' },
        3: { halign: 'right', cellWidth: 30 }
      },
      didParseCell: function(data) {
        // Right-align numeric column headers (only last column)
        if (data.section === 'head' && data.column.index === 3) {
          data.cell.styles.halign = 'right';
        }
      },
      didDrawCell: function(data) {
        const darkGrey = [180, 180, 180];
        doc.setDrawColor(...darkGrey);
        doc.setLineWidth(0.5);

        // Bottom border on heading rows
        if (data.section === 'head') {
          doc.line(
            data.cell.x,
            data.cell.y + data.cell.height,
            data.cell.x + data.cell.width,
            data.cell.y + data.cell.height
          );
        }
      }
    });

    yPos = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY : yPos;
  }

  return yPos;
};
