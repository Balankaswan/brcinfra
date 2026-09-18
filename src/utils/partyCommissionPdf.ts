import jsPDF from 'jspdf';

// Company information
const COMPANY_INFO = {
  name: 'BHAVISHYA ROAD CARRIERS',
  address: 'Specialist in Heavy ODC, Hydraulic, Low Bed Trailer, Flat Bed Trailer Transport & Commission Agent',
  address2: 'FLEET OWNERS, TRANSPORT CONTRACTORS & COMMISSION AGENTS',
  address3: 'MEMBER OF ALL INDIA MOTOR TRANSPORT CONGRESS',
  phone: 'MOB: 9824026578, 9824900776',
  pan: 'PAN NO: BNDPK7173D',
  location: '404, Parijaat Business Center, Nr. SP Ring Road, Aslali, Ahmedabad - 382405',
  tagline: 'DIRECT TO AHMEDABAD JURISDICTION'
};

// Utility function to format currency for PDFs
const formatCurrencyForPDF = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Utility function to format date
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

interface PartyCommissionPDFOptions {
  partyName: string;
  entries: any[];
  summary: {
    totalCredits: number;
    totalDebits: number;
    balance: number;
    totalEntries: number;
  };
  dateRange?: {
    from?: string;
    to?: string;
  };
}

export const generatePartyCommissionPDF = (options: PartyCommissionPDFOptions) => {
  try {
    console.log('🔄 Starting generatePartyCommissionPDF function...');
    console.log('📋 Options received:', {
      partyName: options.partyName,
      entriesCount: options.entries?.length || 0,
      summaryExists: !!options.summary,
      dateRangeExists: !!options.dateRange
    });

    const doc = new jsPDF('p', 'mm', 'a4'); // Portrait A4 (210mm x 297mm)
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let currentY = 20;
    let currentPage = 1;

    console.log(`📄 Starting Party Commission PDF - Page dimensions: ${pageWidth} x ${pageHeight}`);

  // Header function
  const addHeader = () => {
    // Company information (removed logo placeholder)
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(COMPANY_INFO.name, pageWidth / 2, currentY + 8, { align: 'center' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(COMPANY_INFO.address, pageWidth / 2, currentY + 14, { align: 'center' });
    doc.text(COMPANY_INFO.address2, pageWidth / 2, currentY + 18, { align: 'center' });
    doc.text(COMPANY_INFO.address3, pageWidth / 2, currentY + 22, { align: 'center' });
    
    doc.setFontSize(7);
    doc.text(COMPANY_INFO.phone, pageWidth / 2, currentY + 26, { align: 'center' });
    doc.text(COMPANY_INFO.pan, pageWidth / 2, currentY + 30, { align: 'center' });
    doc.text(COMPANY_INFO.location, pageWidth / 2, currentY + 34, { align: 'center' });
    doc.text(COMPANY_INFO.tagline, pageWidth / 2, currentY + 38, { align: 'center' });

    // Horizontal line
    doc.setLineWidth(0.5);
    doc.line(15, currentY + 42, pageWidth - 15, currentY + 42);

    currentY += 50;
  };

  // Add initial header
  addHeader();

  // Report title and party information
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text('PARTY COMMISSION LEDGER', pageWidth / 2, currentY, { align: 'center' });
  
  currentY += 10;
  
  // Party and date information box
  doc.setFillColor(248, 249, 250);
  doc.rect(15, currentY, pageWidth - 30, 20, 'F');
  doc.setLineWidth(0.3);
  doc.rect(15, currentY, pageWidth - 30, 20);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Party Name:', 20, currentY + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(options.partyName, 50, currentY + 8);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Report Generated:', 20, currentY + 15);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(new Date().toISOString()), 65, currentY + 15);
  
  if (options.dateRange?.from && options.dateRange?.to) {
    doc.setFont('helvetica', 'bold');
    doc.text('Period:', pageWidth - 80, currentY + 8);
    doc.setFont('helvetica', 'normal');
    doc.text(`${formatDate(options.dateRange.from)} to ${formatDate(options.dateRange.to)}`, pageWidth - 60, currentY + 8);
  }
  
  doc.setFont('helvetica', 'bold');
  doc.text('Total Entries:', pageWidth - 80, currentY + 15);
  doc.setFont('helvetica', 'normal');
  doc.text(options.summary.totalEntries.toString(), pageWidth - 50, currentY + 15);
  
  currentY += 25;

  // Summary section
  doc.setFillColor(52, 144, 220);
  doc.rect(15, currentY, pageWidth - 30, 15, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('COMMISSION SUMMARY', 20, currentY + 10);
  
  currentY += 18;
  
  // Summary details
  doc.setFillColor(248, 249, 250);
  doc.rect(15, currentY, pageWidth - 30, 12, 'F');
  doc.setLineWidth(0.3);
  doc.rect(15, currentY, pageWidth - 30, 12);
  
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  const summaryY = currentY + 8;
  doc.text(`Total Commission Paid: ₹${formatCurrencyForPDF(options.summary.totalDebits)}`, 20, summaryY);
  doc.text(`Outstanding Balance: ₹${formatCurrencyForPDF(Math.abs(options.summary.balance))}`, pageWidth / 2, summaryY);
  doc.text(`Balance Type: ${options.summary.balance >= 0 ? 'Receivable' : 'Payable'}`, pageWidth - 80, summaryY);
  
  currentY += 20;

  // Table header - 6 columns as per requirement
  const drawTableHeader = () => {
    console.log(`📋 Drawing table header at currentY: ${currentY}`);
    doc.setFillColor(50, 50, 50);
    doc.rect(15, currentY, pageWidth - 30, 12, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    
    // 6 Column headers optimized for A4 portrait (210mm width)
    // Available width: 180mm (210 - 30mm margins) - Fixed spacing to prevent overlapping
    doc.text('Date', 15, currentY + 8);                    // 25mm
    doc.text('Bill No', 45, currentY + 8);                 // 30mm  
    doc.text('Narration (Trip Detail)', 80, currentY + 8); // 60mm
    doc.text('Credit', 145, currentY + 8, { align: 'right' }); // 30mm
    doc.text('Debit', 175, currentY + 8, { align: 'right' });  // 30mm
    doc.text('Balance', 200, currentY + 8, { align: 'right' }); // 25mm
    
    currentY += 15;
    console.log(`📋 Table header drawn, currentY updated to: ${currentY}`);
  };

  // Draw initial table header
  drawTableHeader();

  // Process entries
  let runningBalance = 0;
  console.log(`📊 Processing ${options.entries.length} commission entries`);

  options.entries.forEach((entry, index) => {
    // Check if we need a new page
    if (currentY > pageHeight - 40) {
      console.log(`📄 Adding new page at entry ${index}, currentY: ${currentY}`);
      doc.addPage();
      currentPage++;
      currentY = 20;
      addHeader();
      drawTableHeader();
      console.log(`📄 New page ${currentPage} created, currentY reset to: ${currentY}`);
    }

    // Update running balance
    runningBalance += (entry.credit || 0) - (entry.debit || 0);

    // Alternate row colors
    if (index % 2 === 0) {
      doc.setFillColor(248, 248, 248);
      doc.rect(15, currentY - 2, pageWidth - 30, 10, 'F');
    }

    // Row data - 6 columns layout
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    
    // Date (25mm column)
    doc.text(formatDate(entry.date), 15, currentY + 5);
    
    // Bill Number (30mm column)
    const billNo = entry.bill_number || entry.memo_number || entry.reference_id || '-';
    doc.text(billNo.length > 10 ? billNo.substring(0, 10) + '...' : billNo, 45, currentY + 5);
    
    // Narration (Trip Detail) (60mm column) - Increased width for better visibility
    const tripDetail = entry.trip_route || entry.route || entry.narration || entry.description || 'Commission Payment';
    doc.text(tripDetail.length > 30 ? tripDetail.substring(0, 27) + '...' : tripDetail, 80, currentY + 5);
    
    // Credit (30mm column) - For commission received/adjustments
    const creditAmount = entry.credit || 0;
    if (creditAmount > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(34, 197, 94); // Green for credit
      doc.text(`₹${formatCurrencyForPDF(creditAmount)}`, 145, currentY + 5, { align: 'right' });
    } else {
      doc.setTextColor(0, 0, 0);
      doc.text('-', 145, currentY + 5, { align: 'right' });
    }
    
    // Debit (30mm column) - For commission payments
    const debitAmount = entry.debit || entry.commission_amount || 0;
    if (debitAmount > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(220, 38, 127); // Pink for debit/commission
      doc.text(`₹${formatCurrencyForPDF(debitAmount)}`, 175, currentY + 5, { align: 'right' });
    } else {
      doc.setTextColor(0, 0, 0);
      doc.text('-', 175, currentY + 5, { align: 'right' });
    }
    
    // Balance (25mm column)
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(runningBalance >= 0 ? 34 : 239, runningBalance >= 0 ? 197 : 68, runningBalance >= 0 ? 94 : 68);
    doc.text(`₹${formatCurrencyForPDF(Math.abs(runningBalance))}`, 200, currentY + 5, { align: 'right' });
    
    currentY += 10;
    
    // Debug every 10 entries
    if ((index + 1) % 10 === 0) {
      console.log(`📊 Processed ${index + 1} entries, currentY: ${currentY}, page: ${currentPage}`);
    }
  });

  console.log(`📊 Finished processing ${options.entries.length} entries, final currentY: ${currentY}, final page: ${currentPage}`);

  // Final summary section
  if (currentY > pageHeight - 60) {
    console.log(`📄 Adding new page for final summary`);
    doc.addPage();
    currentPage++;
    currentY = 20;
    addHeader();
  }

  currentY += 10;

  // Final totals box
  doc.setFillColor(240, 240, 240);
  doc.rect(15, currentY, pageWidth - 30, 25, 'F');
  doc.setLineWidth(0.5);
  doc.rect(15, currentY, pageWidth - 30, 25);

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('FINAL SUMMARY', 20, currentY + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Total Commission Payments: ₹${formatCurrencyForPDF(options.summary.totalDebits)}`, 20, currentY + 15);
  doc.text(`Final Balance: ₹${formatCurrencyForPDF(Math.abs(options.summary.balance))} ${options.summary.balance >= 0 ? '(Receivable)' : '(Payable)'}`, 20, currentY + 20);
  
  doc.text(`Report Generated: ${formatDate(new Date().toISOString())}`, pageWidth - 80, currentY + 15);
  doc.text(`Total Pages: ${currentPage}`, pageWidth - 80, currentY + 20);

  // Footer
  currentY += 35;
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text('This is a computer generated report. No signature required.', pageWidth / 2, currentY, { align: 'center' });
  doc.text(`Generated by BRC Transport Management System on ${new Date().toLocaleString('en-IN')}`, pageWidth / 2, currentY + 5, { align: 'center' });

  // Page numbers
  for (let i = 1; i <= currentPage; i++) {
    if (i > 1) doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`Page ${i} of ${currentPage}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
  }

    console.log('✅ Party Commission PDF generation completed successfully');
    return doc;
  } catch (error: any) {
    console.error('❌ Error in generatePartyCommissionPDF:', error);
    console.error('❌ Error details:', {
      message: error?.message || 'Unknown error',
      stack: error?.stack || 'No stack trace',
      name: error?.name || 'Unknown error type'
    });
    throw error; // Re-throw to be caught by the calling function
  }
};

// Test function to verify libraries are working
export const testPartyCommissionPDFLibraries = () => {
  try {
    console.log('🧪 Testing Party Commission PDF libraries...');
    
    // Test jsPDF
    const testDoc = new jsPDF();
    testDoc.text('Test', 10, 10);
    console.log('✅ jsPDF is working');
    
    return true;
  } catch (error) {
    console.error('❌ Party Commission PDF libraries test failed:', error);
    return false;
  }
};
