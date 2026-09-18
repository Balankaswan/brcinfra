import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

// Test function to verify libraries are working
export const testLibraries = () => {
  try {
    console.log('🧪 Testing jsPDF...');
    const testDoc = new jsPDF();
    console.log('✅ jsPDF working:', typeof testDoc);
    
    console.log('🧪 Testing XLSX...');
    const testWB = XLSX.utils.book_new();
    console.log('✅ XLSX working:', typeof testWB);
    
    console.log('🧪 Testing number formatting...');
    const testCurrency = `₹${(12345).toLocaleString('en-IN')}`;
    console.log('✅ Number formatting working:', testCurrency);
    
    return true;
  } catch (error) {
    console.error('❌ Library test failed:', error);
    return false;
  }
};

interface LedgerEntry {
  date: string;
  billNo?: string;
  memoNo?: string;
  tripDetails: string;
  credit?: number;
  debitPayment?: number;
  runningBalance: number;
  remarks?: string;
  // Party breakdown
  billAmount?: number;
  detention?: number;
  extra?: number;
  rto?: number;
  tds?: number;
  mamool?: number;
  commission?: number;
  penalties?: number;
  // Supplier breakdown
  freight?: number;
  netAmount?: number;
}

interface LedgerTotals {
  credit?: number;
  debitPayment?: number;
  balance?: number;
  // Party breakdown
  billAmount?: number;
  detention?: number;
  extra?: number;
  rto?: number;
  tds?: number;
  mamool?: number;
  commission?: number;
  penalties?: number;
  // Supplier breakdown
  freight?: number;
  netAmount?: number;
}

interface LedgerOptions {
  type: 'PARTY' | 'SUPPLIER';
  name: string;
  entries: LedgerEntry[];
  totals: LedgerTotals;
  currentBalance: number;
  dateRange?: {
    from?: string;
    to?: string;
  };
  logoBase64?: string;
}

export const generateProfessionalLedgerPDF = async (options: LedgerOptions) => {
  try {
    console.log('Starting PDF generation with FIXED FORMATTING...');
    console.log('VERSION: 2025-10-08 13:18 - COLUMN ALIGNMENT FIXED');
    console.log('Options received:', { 
      type: options.type, 
      name: options.name, 
      entriesCount: options.entries.length,
      totals: options.totals,
      currentBalance: options.currentBalance
    });
    // Create a new PDF document
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape for better table fit
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let currentY = 60;
    let currentPage = 1;
    
    // Debug page dimensions
    console.log(`📄 PDF Page dimensions: ${pageWidth} x ${pageHeight}`);
    
    // Add header
    const addHeader = () => {
      // Company Name - Bold & Uppercase
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('BHAVISHYA ROAD CARRIERS', pageWidth / 2, 20, { align: 'center' });
      
      // Sub-title
      doc.setFontSize(16);
      doc.setFont('helvetica', 'normal');
      doc.text(`${options.type} LEDGER`, pageWidth / 2, 30, { align: 'center' });
      
      // Party/Supplier Name
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      const entityLabel = options.type === 'PARTY' ? 'Party' : 'Supplier';
      doc.text(`${entityLabel}: ${options.name.toUpperCase()}`, 20, 45);
      
      // Balance
      doc.setFontSize(14);
      doc.setTextColor(options.currentBalance >= 0 ? 0 : 255, options.currentBalance >= 0 ? 100 : 0, 0);
      doc.text(`Balance: ${Math.abs(options.currentBalance).toLocaleString('en-IN')}`, pageWidth - 20, 45, { align: 'right' });
      
      // Ledger Period
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      if (options.dateRange?.from || options.dateRange?.to) {
        const fromDate = options.dateRange.from ? new Date(options.dateRange.from).toLocaleDateString('en-IN') : '01 Apr 2024';
        const toDate = options.dateRange.to ? new Date(options.dateRange.to).toLocaleDateString('en-IN') : '31 Mar 2025';
        doc.text(`Ledger Period: ${fromDate} - ${toDate}`, 20, 52);
      }
      
      // Page number
      doc.setFontSize(9);
      doc.text(`Page ${currentPage}`, pageWidth - 20, 52, { align: 'right' });
      
      // Horizontal line
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(10, 55, pageWidth - 10, 55);
    };
    
    // Add first page header
    addHeader();
    
    const isParty = options.type === 'PARTY';
    const partyCols = {
      date: 10, bill: 28, trip: 52, billAmt: 112, det: 127, extra: 142, rto: 157,
      tds: 172, mamool: 187, comm: 202, pen: 217, net: 232, pay: 247, bal: 262, remarks: 277
    };
    const supplierCols = {
      date: 10, memo: 28, trip: 52, freight: 112, comm: 132, mamool: 147, det: 162,
      extra: 177, rto: 192, net: 212, pay: 232, bal: 252, remarks: 272
    };
    const hasTds = isParty && options.entries.some(e => (e.tds ?? 0) !== 0);
    const hasMamool = isParty && options.entries.some(e => (e.mamool ?? 0) !== 0);
    const hasCommission = isParty && options.entries.some(e => (e.commission ?? 0) !== 0);
    const hasPenalties = isParty && options.entries.some(e => (e.penalties ?? 0) !== 0);
    const hasSupplierCommission = !isParty && options.entries.some(e => (e.commission ?? 0) !== 0);
    const hasSupplierMamool = !isParty && options.entries.some(e => (e.mamool ?? 0) !== 0);
    const hasSupplierDetention = !isParty && options.entries.some(e => (e.detention ?? 0) !== 0);
    const hasSupplierExtra = !isParty && options.entries.some(e => (e.extra ?? 0) !== 0);
    const hasSupplierRto = !isParty && options.entries.some(e => (e.rto ?? 0) !== 0);
    // Table Headers
    const drawTableHeader = () => {
      console.log(`📋 Drawing table header at currentY: ${currentY}`);
      doc.setFillColor(50, 50, 50);
      doc.rect(10, currentY, pageWidth - 20, 10, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      
      if (isParty) {
        doc.text('Date', partyCols.date, currentY + 7);
        doc.text('Bill No', partyCols.bill, currentY + 7);
        doc.text('Trip Details', partyCols.trip, currentY + 7);
        doc.text('Bill', partyCols.billAmt, currentY + 7, { align: 'right' });
        doc.text('Det.', partyCols.det, currentY + 7, { align: 'right' });
        doc.text('Extra', partyCols.extra, currentY + 7, { align: 'right' });
        doc.text('RTO', partyCols.rto, currentY + 7, { align: 'right' });
        if (hasTds) {
          doc.text('TDS', partyCols.tds, currentY + 7, { align: 'right' });
        }
        if (hasMamool) {
          doc.text('Mamool', partyCols.mamool, currentY + 7, { align: 'right' });
        }
        if (hasCommission) {
          doc.text('Comm.', partyCols.comm, currentY + 7, { align: 'right' });
        }
        if (hasPenalties) {
          doc.text('Penal.', partyCols.pen, currentY + 7, { align: 'right' });
        }
        doc.text('Net', partyCols.net, currentY + 7, { align: 'right' });
        doc.text('Payment', partyCols.pay, currentY + 7, { align: 'right' });
        doc.text('Balance', partyCols.bal, currentY + 7, { align: 'right' });
        doc.text('Remarks', partyCols.remarks, currentY + 7);
      } else {
        doc.text('Date', supplierCols.date, currentY + 7);
        doc.text('Memo No', supplierCols.memo, currentY + 7);
        doc.text('Trip Details', supplierCols.trip, currentY + 7);
        doc.text('Freight', supplierCols.freight, currentY + 7, { align: 'right' });
        if (hasSupplierCommission) {
          doc.text('Comm.', supplierCols.comm, currentY + 7, { align: 'right' });
        }
        if (hasSupplierMamool) {
          doc.text('Mamool', supplierCols.mamool, currentY + 7, { align: 'right' });
        }
        if (hasSupplierDetention) {
          doc.text('Det.', supplierCols.det, currentY + 7, { align: 'right' });
        }
        if (hasSupplierExtra) {
          doc.text('Extra', supplierCols.extra, currentY + 7, { align: 'right' });
        }
        if (hasSupplierRto) {
          doc.text('RTO', supplierCols.rto, currentY + 7, { align: 'right' });
        }
        doc.text('Net', supplierCols.net, currentY + 7, { align: 'right' });
        doc.text('Payment', supplierCols.pay, currentY + 7, { align: 'right' });
        doc.text('Balance', supplierCols.bal, currentY + 7, { align: 'right' });
        doc.text('Remarks', supplierCols.remarks, currentY + 7);
      }
      
      currentY += 12;
      console.log(`📋 Table header drawn, currentY updated to: ${currentY}`);
    };
    
    drawTableHeader();
    
    // Table Body
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    
    options.entries.forEach((entry, index) => {
      const wrapText = (text: string, maxLen: number, maxLines: number) => {
        const lines: string[] = [];
        let remaining = text || '-';
        while (remaining && lines.length < maxLines) {
          lines.push(remaining.substring(0, maxLen));
          remaining = remaining.substring(maxLen);
        }
        if (remaining.length > 0 && lines.length === maxLines) {
          const last = lines.pop() || '';
          lines.push((last.substring(0, Math.max(0, maxLen - 3))) + '...');
        }
        return lines.length ? lines : ['-'];
      };

      const tripLines = wrapText(entry.tripDetails || '-', 14, 3);
      const rowHeight = Math.max(12, 8 + (tripLines.length - 1) * 4);

      // Check if we need a new page considering dynamic row height
      if (currentY > pageHeight - (60 + rowHeight)) {
        console.log(`📄 Adding new page at entry ${index}, currentY: ${currentY}, pageHeight: ${pageHeight}`);
        doc.addPage();
        currentPage++;
        currentY = 60; // Reset Y position for new page
        addHeader();
        drawTableHeader();
        console.log(`📄 New page ${currentPage} created, currentY reset to: ${currentY}`);
        
        // Reset text styles after page break
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
      }
      
      // Alternating row colors
      if (index % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(10, currentY - 2, pageWidth - 20, rowHeight, 'F');
      }
      
      // Draw row data - improved positioning and sizing
      const baseY = currentY + 3;
      const col = isParty ? partyCols : supplierCols;
      const billMemoX = isParty ? partyCols.bill : supplierCols.memo;
      doc.text(new Date(entry.date).toLocaleDateString('en-IN'), col.date, baseY);
      doc.text((entry.billNo || entry.memoNo || '-').substring(0, 15), billMemoX, baseY);
      
      // Trip details - up to 3 lines
      doc.setFontSize(8);
      tripLines.forEach((line, i) => {
        doc.text(line, col.trip, currentY + 2 + i * 4);
      });
      
      // Reset font size for financial columns
      doc.setFontSize(9);
      
      // Financial columns WITHOUT currency symbols - just numbers
      const debitPaymentVal = entry.debitPayment ?? 0;
      const creditVal = entry.credit ?? entry.netAmount ?? 0;
      const billAmount = entry.billAmount ?? entry.freight ?? 0;
      const detention = entry.detention ?? 0;
      const extra = entry.extra ?? 0;
      const rto = entry.rto ?? 0;
      const tds = entry.tds ?? 0;
      const mamool = entry.mamool ?? 0;
      const commission = entry.commission ?? 0;
      const penalties = entry.penalties ?? 0;

      // For party, net = provided credit or recompute from breakdown
      const netParty = creditVal || (billAmount + detention + extra + rto - tds - mamool - commission - penalties);
      const netSupplier = creditVal || (billAmount + detention + extra + rto - mamool - commission);

      const creditText = (isParty ? netParty : netSupplier) > 0 ? (isParty ? netParty : netSupplier).toLocaleString('en-IN') : '-';
      const debitPaymentText = debitPaymentVal > 0 ? debitPaymentVal.toLocaleString('en-IN') : '-';
      const balanceText = Math.abs(entry.runningBalance).toLocaleString('en-IN');
      
      // Debug first few entries
      if (index < 3) {
        console.log(`🔍 Entry ${index + 1} formatting:`, {
          credit: entry.credit,
          creditText,
          debitPayment: entry.debitPayment,
          debitPaymentText,
          runningBalance: entry.runningBalance,
          balanceText
        });
      }
      
      if (isParty) {
        const billText = billAmount > 0 ? billAmount.toLocaleString('en-IN') : '-';
        const detentionText = detention > 0 ? detention.toLocaleString('en-IN') : '-';
        const extraText = extra > 0 ? extra.toLocaleString('en-IN') : '-';
        const rtoText = rto > 0 ? rto.toLocaleString('en-IN') : '-';
        const tdsText = tds > 0 ? tds.toLocaleString('en-IN') : '-';
        const mamoolText = mamool > 0 ? mamool.toLocaleString('en-IN') : '-';
        const commissionText = commission > 0 ? commission.toLocaleString('en-IN') : '-';
        const penaltiesText = penalties > 0 ? penalties.toLocaleString('en-IN') : '-';

        doc.text(billText, partyCols.billAmt, currentY + 3, { align: 'right' });
        doc.text(detentionText, partyCols.det, currentY + 3, { align: 'right' });
        doc.text(extraText, partyCols.extra, currentY + 3, { align: 'right' });
        doc.text(rtoText, partyCols.rto, currentY + 3, { align: 'right' });
        if (hasTds) {
          doc.text(tdsText, partyCols.tds, currentY + 3, { align: 'right' });
        }
        if (hasMamool) {
          doc.text(mamoolText, partyCols.mamool, currentY + 3, { align: 'right' });
        }
        if (hasCommission) {
          doc.text(commissionText, partyCols.comm, currentY + 3, { align: 'right' });
        }
        if (hasPenalties) {
          doc.text(penaltiesText, partyCols.pen, currentY + 3, { align: 'right' });
        }
        doc.text(creditText, partyCols.net, currentY + 3, { align: 'right' });
        doc.text(debitPaymentText, partyCols.pay, currentY + 3, { align: 'right' });
        doc.text(balanceText, partyCols.bal, currentY + 3, { align: 'right' });
      } else {
        const freightText = billAmount > 0 ? billAmount.toLocaleString('en-IN') : '-';
        const commissionText = commission > 0 ? commission.toLocaleString('en-IN') : '-';
        const mamoolText = mamool > 0 ? mamool.toLocaleString('en-IN') : '-';
        const detentionText = detention > 0 ? detention.toLocaleString('en-IN') : '-';
        const extraText = extra > 0 ? extra.toLocaleString('en-IN') : '-';
        const rtoText = rto > 0 ? rto.toLocaleString('en-IN') : '-';

        doc.text(freightText, supplierCols.freight, currentY + 3, { align: 'right' });
        if (hasSupplierCommission) {
          doc.text(commissionText, supplierCols.comm, currentY + 3, { align: 'right' });
        }
        if (hasSupplierMamool) {
          doc.text(mamoolText, supplierCols.mamool, currentY + 3, { align: 'right' });
        }
        if (hasSupplierDetention) {
          doc.text(detentionText, supplierCols.det, currentY + 3, { align: 'right' });
        }
        if (hasSupplierExtra) {
          doc.text(extraText, supplierCols.extra, currentY + 3, { align: 'right' });
        }
        if (hasSupplierRto) {
          doc.text(rtoText, supplierCols.rto, currentY + 3, { align: 'right' });
        }
        doc.text(creditText, supplierCols.net, currentY + 3, { align: 'right' });
        doc.text(debitPaymentText, supplierCols.pay, currentY + 3, { align: 'right' });
        doc.text(balanceText, supplierCols.bal, currentY + 3, { align: 'right' });
      }
      
      // Remarks with 2-line support for complete information
      const remarks = (entry.remarks || '-');
      const maxRemarksLineLength = 16; // Characters per line
      
      if (remarks.length > maxRemarksLineLength) {
        // Split into two lines
        const remarkLine1 = remarks.substring(0, maxRemarksLineLength);
        const remarkLine2 = remarks.substring(maxRemarksLineLength, maxRemarksLineLength * 2);
        const remarkX = isParty ? partyCols.remarks : supplierCols.remarks;
        doc.text(remarkLine1, remarkX, currentY + 2);
        doc.text(remarkLine2, remarkX, currentY + 6);
      } else {
        const remarkX = isParty ? partyCols.remarks : supplierCols.remarks;
        doc.text(remarks, remarkX, currentY + 3);
      }
      
      currentY += Math.max(12, rowHeight); // Respect dynamic height
      
      // Debug every 10 entries
      if ((index + 1) % 10 === 0) {
        console.log(`📊 Processed ${index + 1} entries, currentY: ${currentY}, page: ${currentPage}`);
      }
    });
    
    console.log(`📊 Finished processing ${options.entries.length} entries, final currentY: ${currentY}, final page: ${currentPage}`);
    
    // Totals Row - ensure enough space for totals and signatures
    if (currentY > pageHeight - 80) {
      console.log(`📄 Adding new page for totals, currentY: ${currentY}, pageHeight: ${pageHeight}`);
      doc.addPage();
      currentPage++;
      currentY = 60;
      addHeader();
      drawTableHeader();
      console.log(`📄 Totals page ${currentPage} created, currentY reset to: ${currentY}`);
      
      // Reset text styles after page break
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
    }
    
    doc.setFillColor(240, 240, 240);
    doc.rect(10, currentY - 2, pageWidth - 20, 10, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const tot = options.totals || {};
    doc.setFontSize(9);
    doc.text('TOTALS', 15, currentY + 4);
    if (isParty) {
      doc.text((tot.billAmount ?? 0).toLocaleString('en-IN'), partyCols.billAmt, currentY + 4, { align: 'right' });
      doc.text((tot.detention ?? 0).toLocaleString('en-IN'), partyCols.det, currentY + 4, { align: 'right' });
      doc.text((tot.extra ?? 0).toLocaleString('en-IN'), partyCols.extra, currentY + 4, { align: 'right' });
      doc.text((tot.rto ?? 0).toLocaleString('en-IN'), partyCols.rto, currentY + 4, { align: 'right' });
      if (hasTds) {
        doc.text((tot.tds ?? 0).toLocaleString('en-IN'), partyCols.tds, currentY + 4, { align: 'right' });
      }
      if (hasMamool) {
        doc.text((tot.mamool ?? 0).toLocaleString('en-IN'), partyCols.mamool, currentY + 4, { align: 'right' });
      }
      if (hasCommission) {
        doc.text((tot.commission ?? 0).toLocaleString('en-IN'), partyCols.comm, currentY + 4, { align: 'right' });
      }
      if (hasPenalties) {
        doc.text((tot.penalties ?? 0).toLocaleString('en-IN'), partyCols.pen, currentY + 4, { align: 'right' });
      }
      doc.text((tot.credit ?? 0).toLocaleString('en-IN'), partyCols.net, currentY + 4, { align: 'right' });
      doc.text((tot.debitPayment ?? 0).toLocaleString('en-IN'), partyCols.pay, currentY + 4, { align: 'right' });
      doc.text(Math.abs(options.currentBalance).toLocaleString('en-IN'), partyCols.bal, currentY + 4, { align: 'right' });
    } else {
      doc.text((tot.freight ?? 0).toLocaleString('en-IN'), supplierCols.freight, currentY + 4, { align: 'right' });
      if (hasSupplierCommission) {
        doc.text((tot.commission ?? 0).toLocaleString('en-IN'), supplierCols.comm, currentY + 4, { align: 'right' });
      }
      if (hasSupplierMamool) {
        doc.text((tot.mamool ?? 0).toLocaleString('en-IN'), supplierCols.mamool, currentY + 4, { align: 'right' });
      }
      if (hasSupplierDetention) {
        doc.text((tot.detention ?? 0).toLocaleString('en-IN'), supplierCols.det, currentY + 4, { align: 'right' });
      }
      if (hasSupplierExtra) {
        doc.text((tot.extra ?? 0).toLocaleString('en-IN'), supplierCols.extra, currentY + 4, { align: 'right' });
      }
      if (hasSupplierRto) {
        doc.text((tot.rto ?? 0).toLocaleString('en-IN'), supplierCols.rto, currentY + 4, { align: 'right' });
      }
      doc.text((tot.netAmount ?? tot.credit ?? 0).toLocaleString('en-IN'), supplierCols.net, currentY + 4, { align: 'right' });
      doc.text((tot.debitPayment ?? 0).toLocaleString('en-IN'), supplierCols.pay, currentY + 4, { align: 'right' });
      doc.text(Math.abs(options.currentBalance).toLocaleString('en-IN'), supplierCols.bal, currentY + 4, { align: 'right' });
    }
    
    currentY += 15;
    
    // Digital Signature Section
    if (currentY < pageHeight - 60) {
      doc.setLineWidth(0.1);
      doc.setDrawColor(200, 200, 200);
      
      // Signature boxes
      doc.line(30, currentY + 30, 100, currentY + 30);
      doc.line(pageWidth - 100, currentY + 30, pageWidth - 30, currentY + 30);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Prepared By', 65, currentY + 35, { align: 'center' });
      doc.text('Authorized Signatory', pageWidth - 65, currentY + 35, { align: 'center' });
    }
    
    // System footer
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'italic');
    doc.text('System Generated Ledger – Bhavishya Road Carriers', pageWidth / 2, pageHeight - 10, { align: 'center' });
    doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, pageWidth / 2, pageHeight - 6, { align: 'center' });
    
    // Generate filename
    const entityType = options.type.toLowerCase();
    const entityName = options.name.replace(/[^a-zA-Z0-9]/g, '_');
    const date = new Date().toISOString().split('T')[0];
    const filename = `${entityType}_ledger_${entityName}_${date}.pdf`;
    
    // Save the PDF - this will download directly
    doc.save(filename);
    
    return doc;
  } catch (error: any) {
    console.error('❌ PDF Generation Error Details:');
    console.error('Error object:', error);
    console.error('Error message:', error?.message || 'No message available');
    console.error('Error stack:', error?.stack || 'No stack trace available');
    console.error('Error name:', error?.name || 'Unknown error type');
    
    // Throw a more descriptive error
    const errorMessage = error?.message || `PDF generation failed: ${error?.toString() || 'Unknown error'}`;
    throw new Error(`PDF Export Failed: ${errorMessage}`);
  }
};

// Export to Excel function
export const exportLedgerToExcel = async (options: LedgerOptions) => {
  try {
    console.log('🔄 Starting Excel export with static import...');
    
    const isPartyExcel = options.type === 'PARTY';
    // Prepare data for Excel
    const worksheetData = [
      ['BHAVISHYA ROAD CARRIERS'],
      [`${options.type} LEDGER`],
      [`${options.type === 'PARTY' ? 'Party' : 'Supplier'}: ${options.name}`],
      [`Balance: ${Math.abs(options.currentBalance).toLocaleString('en-IN')}`],
      [],
      isPartyExcel
        ? ['Date', 'Bill No', 'Trip Details', 'Bill Amount', 'Detention', 'Extra', 'RTO', 'TDS', 'Mamool', 'Commission', 'Penalties', 'Net Bill', 'Debit-Payment', 'Balance', 'Remarks']
        : ['Date', 'Memo No', 'Trip Details', 'Freight', 'Commission', 'Mamool', 'Detention', 'Extra', 'RTO', 'Net Amount', 'Debit-Payment', 'Balance', 'Remarks']
    ];
    
    // Add entries
    options.entries.forEach(entry => {
      const billAmount = entry.billAmount ?? entry.freight ?? 0;
      const detention = entry.detention ?? 0;
      const extra = entry.extra ?? 0;
      const rto = entry.rto ?? 0;
      const tds = entry.tds ?? 0;
      const mamool = entry.mamool ?? 0;
      const commission = entry.commission ?? 0;
      const penalties = entry.penalties ?? 0;
      const netParty = entry.credit ?? entry.netAmount ?? (billAmount + detention + extra + rto - tds - mamool - commission - penalties);
      const netSupplier = entry.netAmount ?? entry.credit ?? (billAmount - commission - mamool + detention + extra + rto);
      const debitPayment = entry.debitPayment ?? 0;

      worksheetData.push(isPartyExcel ? [
        new Date(entry.date).toLocaleDateString('en-IN'),
        entry.billNo || '-',
        entry.tripDetails || '-',
        billAmount ? billAmount.toLocaleString('en-IN') : '-',
        detention ? detention.toLocaleString('en-IN') : '-',
        extra ? extra.toLocaleString('en-IN') : '-',
        rto ? rto.toLocaleString('en-IN') : '-',
        tds ? tds.toLocaleString('en-IN') : '-',
        mamool ? mamool.toLocaleString('en-IN') : '-',
        commission ? commission.toLocaleString('en-IN') : '-',
        penalties ? penalties.toLocaleString('en-IN') : '-',
        netParty ? netParty.toLocaleString('en-IN') : '-',
        debitPayment ? debitPayment.toLocaleString('en-IN') : '-',
        Math.abs(entry.runningBalance).toLocaleString('en-IN'),
        entry.remarks || '-'
      ] : [
        new Date(entry.date).toLocaleDateString('en-IN'),
        entry.memoNo || '-',
        entry.tripDetails || '-',
        billAmount ? billAmount.toLocaleString('en-IN') : '-',
        commission ? commission.toLocaleString('en-IN') : '-',
        mamool ? mamool.toLocaleString('en-IN') : '-',
        detention ? detention.toLocaleString('en-IN') : '-',
        extra ? extra.toLocaleString('en-IN') : '-',
        rto ? rto.toLocaleString('en-IN') : '-',
        netSupplier ? netSupplier.toLocaleString('en-IN') : '-',
        debitPayment ? debitPayment.toLocaleString('en-IN') : '-',
        Math.abs(entry.runningBalance).toLocaleString('en-IN'),
        entry.remarks || '-'
      ]);
    });
    
    // Add totals
    worksheetData.push(isPartyExcel ? [
      'TOTALS',
      '',
      '',
      (options.totals.billAmount ?? 0).toLocaleString('en-IN'),
      (options.totals.detention ?? 0).toLocaleString('en-IN'),
      (options.totals.extra ?? 0).toLocaleString('en-IN'),
      (options.totals.rto ?? 0).toLocaleString('en-IN'),
      (options.totals.tds ?? 0).toLocaleString('en-IN'),
      (options.totals.mamool ?? 0).toLocaleString('en-IN'),
      (options.totals.commission ?? 0).toLocaleString('en-IN'),
      (options.totals.penalties ?? 0).toLocaleString('en-IN'),
      (options.totals.credit ?? 0).toLocaleString('en-IN'),
      (options.totals.debitPayment ?? 0).toLocaleString('en-IN'),
      Math.abs(options.currentBalance).toLocaleString('en-IN'),
      ''
    ] : [
      'TOTALS',
      '',
      '',
      (options.totals.freight ?? options.totals.billAmount ?? 0).toLocaleString('en-IN'),
      (options.totals.commission ?? 0).toLocaleString('en-IN'),
      (options.totals.mamool ?? 0).toLocaleString('en-IN'),
      (options.totals.detention ?? 0).toLocaleString('en-IN'),
      (options.totals.extra ?? 0).toLocaleString('en-IN'),
      (options.totals.rto ?? 0).toLocaleString('en-IN'),
      (options.totals.netAmount ?? options.totals.credit ?? 0).toLocaleString('en-IN'),
      (options.totals.debitPayment ?? 0).toLocaleString('en-IN'),
      Math.abs(options.currentBalance).toLocaleString('en-IN'),
      ''
    ]);
    
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    
    // Set column widths
    ws['!cols'] = isPartyExcel ? [
      { wch: 12 }, // Date
      { wch: 15 }, // Bill No
      { wch: 30 }, // Trip Details
      { wch: 14 }, // Bill
      { wch: 12 }, // Detention
      { wch: 12 }, // Extra
      { wch: 12 }, // RTO
      { wch: 12 }, // TDS
      { wch: 12 }, // Mamool
      { wch: 12 }, // Commission
      { wch: 12 }, // Penalties
      { wch: 14 }, // Net
      { wch: 14 }, // Payment
      { wch: 14 }, // Balance
      { wch: 30 }  // Remarks
    ] : [
      { wch: 12 }, // Date
      { wch: 15 }, // Memo No
      { wch: 30 }, // Trip Details
      { wch: 15 }, // Freight
      { wch: 12 }, // Commission
      { wch: 12 }, // Mamool
      { wch: 12 }, // Detention
      { wch: 12 }, // Extra
      { wch: 12 }, // RTO
      { wch: 14 }, // Net
      { wch: 14 }, // Payment
      { wch: 14 }, // Balance
      { wch: 30 }  // Remarks
    ];
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Ledger');
    
    // Generate filename
    const entityType = options.type.toLowerCase();
    const entityName = options.name.replace(/[^a-zA-Z0-9]/g, '_');
    const date = new Date().toISOString().split('T')[0];
    const filename = `${entityType}_ledger_${entityName}_${date}.xlsx`;
    
    // Save the file
    XLSX.writeFile(wb, filename);
  } catch (error: any) {
    console.error('❌ Excel Export Error Details:');
    console.error('Error object:', error);
    console.error('Error message:', error?.message || 'No message available');
    console.error('Error stack:', error?.stack || 'No stack trace available');
    console.error('Error name:', error?.name || 'Unknown error type');
    
    // Throw a more descriptive error
    const errorMessage = error?.message || `Excel export failed: ${error?.toString() || 'Unknown error'}`;
    throw new Error(`Excel Export Failed: ${errorMessage}`);
  }
};
