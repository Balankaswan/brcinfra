import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PendingBillRow {
  billNo: string;
  billDate: string;
  vehicleNo: string;
  fromLocation: string;
  toLocation: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
}

export interface PartyDetailExportOptions {
  partyName: string;
  contactPerson: string;
  phone: string;
  address: string;
  totalPartyBalance: number;
  activeTrips: number;
  pendingBills: PendingBillRow[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtINR = (n: number) => `₹${Math.abs(n).toLocaleString('en-IN')}`;
const fmtNum = (n: number) => Math.abs(n).toLocaleString('en-IN');
const fmtDate = (d: string) => {
  try {
    return new Date(d).toLocaleDateString('en-IN');
  } catch {
    return d;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// PDF EXPORT — Party Detail with Pending Bills
// ═══════════════════════════════════════════════════════════════════════════════

export const generatePartyDetailPDF = async (options: PartyDetailExportOptions) => {
  const doc = new jsPDF('l', 'mm', 'a4'); // Landscape
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = 0;
  let pageNum = 1;

  // ── Draw Header ──
  const drawHeader = () => {
    y = 12;

    // Company Name
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('BHAVISHYA ROAD CARRIERS', pageW / 2, y, { align: 'center' });
    y += 8;

    // Subtitle
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Transport & Logistics Management', pageW / 2, y, { align: 'center' });
    y += 6;

    // Divider
    doc.setDrawColor(59, 130, 246); // blue-500
    doc.setLineWidth(0.8);
    doc.line(15, y, pageW - 15, y);
    y += 8;

    // Party Name — big and bold
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(options.partyName.toUpperCase(), pageW / 2, y, { align: 'center' });
    y += 10;

    // ── Summary Cards Row ──
    const cardW = (pageW - 50) / 3;
    const cardH = 20;
    const cardY = y;

    // Card 1: Total Party Balance
    doc.setFillColor(254, 242, 242); // red-50
    doc.roundedRect(15, cardY, cardW, cardH, 3, 3, 'F');
    doc.setDrawColor(239, 68, 68); // red-500
    doc.setLineWidth(0.3);
    doc.roundedRect(15, cardY, cardW, cardH, 3, 3, 'S');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(127, 29, 29); // red-900
    doc.text('Total Party Balance', 20, cardY + 7);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38); // red-600
    doc.text(fmtINR(options.totalPartyBalance), 20, cardY + 15);

    // Card 2: Active Trips
    const card2X = 15 + cardW + 10;
    doc.setFillColor(239, 246, 255); // blue-50
    doc.roundedRect(card2X, cardY, cardW, cardH, 3, 3, 'F');
    doc.setDrawColor(59, 130, 246); // blue-500
    doc.roundedRect(card2X, cardY, cardW, cardH, 3, 3, 'S');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 58, 138); // blue-900
    doc.text('Active Trips / Pending Bills', card2X + 5, cardY + 7);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235); // blue-600
    doc.text(`${options.activeTrips}`, card2X + 5, cardY + 15);

    // Card 3: Contact Person
    const card3X = card2X + cardW + 10;
    doc.setFillColor(240, 253, 244); // green-50
    doc.roundedRect(card3X, cardY, cardW, cardH, 3, 3, 'F');
    doc.setDrawColor(34, 197, 94); // green-500
    doc.roundedRect(card3X, cardY, cardW, cardH, 3, 3, 'S');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20, 83, 45); // green-900
    doc.text('Contact Person', card3X + 5, cardY + 7);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 163, 74); // green-600
    doc.text(options.contactPerson || 'N/A', card3X + 5, cardY + 14);
    if (options.phone && options.phone !== 'N/A') {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(options.phone, card3X + 5, cardY + 18);
    }

    y = cardY + cardH + 10;

    // Page number
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.text(`Page ${pageNum}`, pageW - 15, 12, { align: 'right' });
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, pageW - 15, 17, { align: 'right' });
  };

  const addFooter = () => {
    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    doc.setFont('helvetica', 'italic');
    doc.text(
      'System Generated Report – Bhavishya Road Carriers | This is a computer-generated document',
      pageW / 2,
      pageH - 6,
      { align: 'center' }
    );
  };

  const newPage = () => {
    addFooter();
    doc.addPage();
    pageNum++;
    drawHeader();
  };

  // ── First page ──
  drawHeader();

  // ── Pending Bills Section Title ──
  doc.setFillColor(249, 250, 251); // gray-50
  doc.roundedRect(15, y, pageW - 30, 10, 2, 2, 'F');
  doc.setTextColor(17, 24, 39);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Pending Bills', 20, y + 7);

  // Badge
  const badgeText = `${options.pendingBills.length} Pending`;
  doc.setFillColor(254, 226, 226); // red-100
  const badgeW = doc.getTextWidth(badgeText) + 8;
  doc.roundedRect(pageW - 15 - badgeW, y + 1.5, badgeW, 7, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(153, 27, 27); // red-800
  doc.text(badgeText, pageW - 15 - badgeW + 4, y + 6.5);

  y += 14;

  // ── Table Header ──
  const cols = {
    sno: 15,
    billNo: 27,
    billDate: 62,
    vehicleNo: 95,
    trip: 133,
    totalAmt: 195,
    paidAmt: 225,
    pendingAmt: 260,
  };

  const drawTableHeader = () => {
    doc.setFillColor(31, 41, 55); // gray-800
    doc.rect(15, y, pageW - 30, 10, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');

    doc.text('S.No', cols.sno + 2, y + 7);
    doc.text('BILL NO', cols.billNo, y + 7);
    doc.text('BILL DATE', cols.billDate, y + 7);
    doc.text('VEHICLE NO', cols.vehicleNo, y + 7);
    doc.text('TRIP DETAILS', cols.trip, y + 7);
    doc.text('TOTAL AMOUNT (₹)', cols.totalAmt + 25, y + 7, { align: 'right' });
    doc.text('PAID AMOUNT (₹)', cols.paidAmt + 25, y + 7, { align: 'right' });
    doc.text('PENDING AMOUNT (₹)', cols.pendingAmt + 25, y + 7, { align: 'right' });

    y += 12;
  };

  drawTableHeader();

  // ── Table Rows ──
  let totalTotal = 0;
  let totalPaid = 0;
  let totalPending = 0;

  options.pendingBills.forEach((bill, idx) => {
    // Page break check
    if (y > pageH - 35) {
      newPage();
      // Re-draw section header
      doc.setTextColor(17, 24, 39);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Pending Bills (continued)', 20, y);
      y += 6;
      drawTableHeader();
    }

    // Alternate row background
    if (idx % 2 === 0) {
      doc.setFillColor(249, 250, 251); // gray-50
      doc.rect(15, y - 3, pageW - 30, 10, 'F');
    }

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    // S.No
    doc.text(`${idx + 1}`, cols.sno + 2, y + 3);

    // Bill No — blue, bold
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235); // blue-600
    doc.text(bill.billNo, cols.billNo, y + 3);

    // Bill Date
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(fmtDate(bill.billDate), cols.billDate, y + 3);

    // Vehicle No
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81); // gray-700
    doc.text(bill.vehicleNo || '—', cols.vehicleNo, y + 3);

    // Trip Details
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(75, 85, 99); // gray-600
    const tripText = bill.fromLocation && bill.toLocation
      ? `${bill.fromLocation} → ${bill.toLocation}`
      : '—';
    doc.text(tripText.substring(0, 28), cols.trip, y + 3);

    // Total Amount
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(17, 24, 39);
    doc.text(fmtNum(bill.totalAmount), cols.totalAmt + 25, y + 3, { align: 'right' });

    // Paid Amount
    doc.setTextColor(75, 85, 99);
    doc.text(fmtNum(bill.paidAmount), cols.paidAmt + 25, y + 3, { align: 'right' });

    // Pending Amount — red, bold
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38); // red-600
    doc.text(fmtNum(bill.pendingAmount), cols.pendingAmt + 25, y + 3, { align: 'right' });

    totalTotal += bill.totalAmount;
    totalPaid += bill.paidAmount;
    totalPending += bill.pendingAmount;

    y += 10;
  });

  // ── Totals Row ──
  if (y > pageH - 35) {
    newPage();
    drawTableHeader();
  }

  doc.setFillColor(229, 231, 235); // gray-200
  doc.rect(15, y - 3, pageW - 30, 12, 'F');

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('TOTAL', cols.billNo, y + 4);

  doc.setFontSize(9);
  doc.text(fmtNum(totalTotal), cols.totalAmt + 25, y + 4, { align: 'right' });
  doc.text(fmtNum(totalPaid), cols.paidAmt + 25, y + 4, { align: 'right' });
  doc.setTextColor(220, 38, 38);
  doc.setFontSize(10);
  doc.text(fmtNum(totalPending), cols.pendingAmt + 25, y + 4, { align: 'right' });

  y += 18;

  // ── Party Info Section ──
  if (y > pageH - 55) {
    newPage();
  }

  if (options.address || options.phone) {
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(15, y, pageW - 30, 8, 2, 2, 'F');
    doc.setTextColor(17, 24, 39);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Party Information', 20, y + 5.5);
    y += 12;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55, 65, 81);

    if (options.address && options.address !== 'N/A') {
      doc.setFont('helvetica', 'bold');
      doc.text('Address:', 20, y);
      doc.setFont('helvetica', 'normal');
      doc.text(options.address, 50, y);
      y += 6;
    }
    if (options.contactPerson && options.contactPerson !== 'N/A') {
      doc.setFont('helvetica', 'bold');
      doc.text('Contact:', 20, y);
      doc.setFont('helvetica', 'normal');
      doc.text(`${options.contactPerson}${options.phone && options.phone !== 'N/A' ? ' | ' + options.phone : ''}`, 50, y);
      y += 6;
    }
    y += 5;
  }

  // ── Signature Section ──
  if (y < pageH - 45) {
    y += 8;
    doc.setLineWidth(0.2);
    doc.setDrawColor(180, 180, 180);
    doc.line(30, y + 25, 110, y + 25);
    doc.line(pageW - 110, y + 25, pageW - 30, y + 25);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Prepared By', 70, y + 30, { align: 'center' });
    doc.text('Authorized Signatory', pageW - 70, y + 30, { align: 'center' });
  }

  addFooter();

  // Save
  const safeName = options.partyName.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  doc.save(`Party_Detail_${safeName}_${dateStr}.pdf`);
  return doc;
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXCEL EXPORT — Party Detail with Pending Bills
// ═══════════════════════════════════════════════════════════════════════════════

export const generatePartyDetailExcel = async (options: PartyDetailExportOptions) => {
  const wb = XLSX.utils.book_new();

  const data: any[][] = [
    ['BHAVISHYA ROAD CARRIERS'],
    ['Party Detail Report'],
    [],
    ['Party Name:', options.partyName],
    ['Total Party Balance:', options.totalPartyBalance],
    ['Active Trips:', options.activeTrips],
    ['Contact Person:', options.contactPerson || 'N/A'],
    ['Phone:', options.phone || 'N/A'],
    ['Address:', options.address || 'N/A'],
    [`Generated: ${new Date().toLocaleDateString('en-IN')}`],
    [],
    ['S.No', 'Bill No', 'Bill Date', 'Vehicle No', 'Trip Details', 'Total Amount (₹)', 'Paid Amount (₹)', 'Pending Amount (₹)'],
  ];

  options.pendingBills.forEach((bill, idx) => {
    const trip = bill.fromLocation && bill.toLocation
      ? `${bill.fromLocation} → ${bill.toLocation}`
      : '—';
    data.push([
      idx + 1,
      bill.billNo,
      fmtDate(bill.billDate),
      bill.vehicleNo || '—',
      trip,
      bill.totalAmount,
      bill.paidAmount,
      bill.pendingAmount,
    ]);
  });

  // Totals
  data.push([]);
  data.push([
    '',
    'TOTAL',
    '',
    '',
    '',
    options.pendingBills.reduce((s, b) => s + b.totalAmount, 0),
    options.pendingBills.reduce((s, b) => s + b.paidAmount, 0),
    options.pendingBills.reduce((s, b) => s + b.pendingAmount, 0),
  ]);

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    { wch: 6 },   // S.No
    { wch: 16 },  // Bill No
    { wch: 14 },  // Bill Date
    { wch: 16 },  // Vehicle No
    { wch: 28 },  // Trip Details
    { wch: 18 },  // Total Amount
    { wch: 18 },  // Paid Amount
    { wch: 20 },  // Pending Amount
  ];

  const sheetName = options.partyName.replace(/[\\\/\?\*\[\]:]/g, '').substring(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const safeName = options.partyName.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `Party_Detail_${safeName}_${dateStr}.xlsx`);
};
