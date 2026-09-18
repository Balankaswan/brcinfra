import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { COMPANY_LOGO_BASE64, LOGO_CONFIG } from '../assets/logo';

// Helper: ensure PNG data URL for jsPDF.addImage
const ensurePngDataUrl = async (dataUrl: string): Promise<string> => {
  try {
    if (dataUrl.startsWith('data:image/png')) return dataUrl;
    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = dataUrl;
    });
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.src = dataUrl;
    const w = (img as any).naturalWidth || 256;
    const h = (img as any).naturalHeight || 256;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    return dataUrl;
  }
};

// Format currency helper function
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
};

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => void;
  }
}

interface LedgerEntry {
  date: string;
  reference: string;
  tripDetails: string;
  credit: number;
  debitPayment: number;
  debitAdvance: number;
  runningBalance: number;
  remarks: string;
}

interface SupplierLedgerEntry extends LedgerEntry {
  detention: number;
  extraWeight: number;
}

export const generatePartyLedgerPDF = async (
  partyName: string,
  entries: LedgerEntry[],
  totals: {
    credit: number;
    debitPayment: number;
    debitAdvance: number;
  },
  dateRange?: { from?: string; to?: string }
) => {
  const doc = new jsPDF();

  // Logo
  try {
    const logoPng = await ensurePngDataUrl(COMPANY_LOGO_BASE64);
    doc.addImage(logoPng, 'PNG', LOGO_CONFIG.x, LOGO_CONFIG.y, LOGO_CONFIG.width, LOGO_CONFIG.height);
  } catch (e) {
    console.warn('Could not add logo to Party Ledger PDF:', e);
  }
  
  // Company Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('BHAVISHYA ROAD CARRIERS', 105, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Transport & Logistics Services', 105, 28, { align: 'center' });
  
  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('PARTY LEDGER', 105, 45, { align: 'center' });
  
  // Party Details
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Party: ${partyName}`, 20, 60);
  
  if (dateRange?.from || dateRange?.to) {
    const fromDate = dateRange.from ? new Date(dateRange.from).toLocaleDateString('en-IN') : 'Beginning';
    const toDate = dateRange.to ? new Date(dateRange.to).toLocaleDateString('en-IN') : 'Present';
    doc.text(`Period: ${fromDate} to ${toDate}`, 20, 68);
  }
  
  doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, 20, 76);
  
  // Table
  const tableData = entries.map(entry => [
    new Date(entry.date).toLocaleDateString('en-IN'),
    entry.reference,
    entry.tripDetails,
    entry.credit > 0 ? formatCurrency(entry.credit) : '—',
    entry.debitPayment > 0 ? formatCurrency(entry.debitPayment) : '—',
    entry.debitAdvance > 0 ? formatCurrency(entry.debitAdvance) : '—',
    formatCurrency(Math.abs(entry.runningBalance)),
    entry.remarks
  ]);
  
  // Add totals row
  tableData.push([
    'TOTAL',
    '',
    '',
    formatCurrency(totals.credit),
    formatCurrency(totals.debitPayment),
    formatCurrency(totals.debitAdvance),
    formatCurrency(Math.abs(entries[entries.length - 1]?.runningBalance || 0)),
    ''
  ]);
  
  doc.autoTable({
    startY: 85,
    head: [[
      'Date',
      'Bill No',
      'Trip Details',
      'Credit (₹)',
      'Debit - Payment (₹)',
      'Debit - Advance (₹)',
      'Running Balance (₹)',
      'Remarks'
    ]],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: 'bold',
    },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
    didParseCell: function(data: any) {
      if (data.row.index === tableData.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [243, 244, 246];
      }
    }
  });
  
  // Save the PDF
  const fileName = `party-ledger-${partyName.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};

export const generateSupplierLedgerPDF = async (
  supplierName: string,
  entries: SupplierLedgerEntry[],
  totals: {
    credit: number;
    detention: number;
    extraWeight: number;
    debitPayment: number;
    debitAdvance: number;
  },
  dateRange?: { from?: string; to?: string }
) => {
  const doc = new jsPDF();

  // Logo
  try {
    const logoPng = await ensurePngDataUrl(COMPANY_LOGO_BASE64);
    doc.addImage(logoPng, 'PNG', LOGO_CONFIG.x, LOGO_CONFIG.y, LOGO_CONFIG.width, LOGO_CONFIG.height);
  } catch (e) {
    console.warn('Could not add logo to Supplier Ledger PDF:', e);
  }
  
  // Company Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('BHAVISHYA ROAD CARRIERS', 105, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Transport & Logistics Services', 105, 28, { align: 'center' });
  
  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('SUPPLIER LEDGER', 105, 45, { align: 'center' });
  
  // Supplier Details
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Supplier: ${supplierName}`, 20, 60);
  
  if (dateRange?.from || dateRange?.to) {
    const fromDate = dateRange.from ? new Date(dateRange.from).toLocaleDateString('en-IN') : 'Beginning';
    const toDate = dateRange.to ? new Date(dateRange.to).toLocaleDateString('en-IN') : 'Present';
    doc.text(`Period: ${fromDate} to ${toDate}`, 20, 68);
  }
  
  doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, 20, 76);
  
  // Table
  const tableData = entries.map(entry => [
    new Date(entry.date).toLocaleDateString('en-IN'),
    entry.reference,
    entry.tripDetails,
    entry.detention > 0 ? formatCurrency(entry.detention) : '—',
    entry.extraWeight > 0 ? formatCurrency(entry.extraWeight) : '—',
    entry.credit > 0 ? formatCurrency(entry.credit) : '—',
    entry.debitPayment > 0 ? formatCurrency(entry.debitPayment) : '—',
    entry.debitAdvance > 0 ? formatCurrency(entry.debitAdvance) : '—',
    formatCurrency(Math.abs(entry.runningBalance)),
    entry.remarks
  ]);
  
  // Add totals row
  tableData.push([
    'TOTAL',
    '',
    '',
    formatCurrency(totals.detention),
    formatCurrency(totals.extraWeight),
    formatCurrency(totals.credit),
    formatCurrency(totals.debitPayment),
    formatCurrency(totals.debitAdvance),
    formatCurrency(Math.abs(entries[entries.length - 1]?.runningBalance || 0)),
    ''
  ]);
  
  doc.autoTable({
    startY: 85,
    head: [[
      'Date',
      'Memo No',
      'Trip Details',
      'Detention (₹)',
      'Extra Weight (₹)',
      'Credit (₹)',
      'Debit - Payment (₹)',
      'Debit - Advance (₹)',
      'Running Balance (₹)',
      'Remarks'
    ]],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
    },
    headStyles: {
      fillColor: [234, 88, 12],
      textColor: 255,
      fontStyle: 'bold',
    },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
    },
    didParseCell: function(data: any) {
      if (data.row.index === tableData.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [243, 244, 246];
      }
    }
  });
  
  // Save the PDF
  const fileName = `supplier-ledger-${supplierName.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};
