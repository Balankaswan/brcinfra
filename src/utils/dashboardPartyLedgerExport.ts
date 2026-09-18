import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PartyLedgerRow {
  date: string;
  billNo: string;
  tripDetails: string;
  billAmount: number;
  detention: number;
  extra: number;
  rto: number;
  tds: number;
  mamool: number;
  commission: number;
  penalties: number;
  netBill: number;
  debitPayment: number;
  runningBalance: number;
  remarks: string;
}

export interface PartyLedgerSummary {
  partyName: string;
  totalBills: number;
  totalNetBillAmount: number;
  totalPayments: number;
  outstandingBalance: number;
  entries: PartyLedgerRow[];
}

export interface DashboardExportOptions {
  parties: PartyLedgerSummary[];
  grandTotalOutstanding: number;
  exportDate: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtINR = (n: number) => Math.abs(n).toLocaleString('en-IN');
const fmtDate = (d: string) => {
  try {
    return new Date(d).toLocaleDateString('en-IN');
  } catch {
    return d;
  }
};

// ─── PDF EXPORT ──────────────────────────────────────────────────────────────

export const generateDashboardPartyLedgerPDF = async (
  options: DashboardExportOptions
) => {
  const doc = new jsPDF('l', 'mm', 'a4'); // Landscape
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = 0;
  let pageNum = 1;

  // ── Header ──
  const drawHeader = (title: string) => {
    y = 15;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('BHAVISHYA ROAD CARRIERS', pageW / 2, y, { align: 'center' });
    y += 10;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(title, pageW / 2, y, { align: 'center' });
    y += 8;

    // Date and page
    doc.setFontSize(9);
    doc.text(`Generated: ${fmtDate(options.exportDate)}`, 15, y);
    doc.text(`Page ${pageNum}`, pageW - 15, y, { align: 'right' });
    y += 3;

    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(10, y, pageW - 10, y);
    y += 5;
  };

  const addFooter = () => {
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'italic');
    doc.text(
      'System Generated Report – Bhavishya Road Carriers',
      pageW / 2,
      pageH - 8,
      { align: 'center' }
    );
    doc.text(
      `Generated on: ${new Date().toLocaleString('en-IN')}`,
      pageW / 2,
      pageH - 4,
      { align: 'center' }
    );
  };

  const newPage = (title: string) => {
    doc.addPage();
    pageNum++;
    drawHeader(title);
  };

  const checkPageBreak = (needed: number, title: string) => {
    if (y + needed > pageH - 20) {
      addFooter();
      newPage(title);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 1+: SUMMARY OF ALL PARTIES
  // ═══════════════════════════════════════════════════════════════════════════
  drawHeader('PARTY LEDGER – ALL PARTIES SUMMARY');

  // Grand total
  doc.setFillColor(220, 38, 38); // red-600
  doc.roundedRect(15, y, pageW - 30, 14, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL OUTSTANDING:', 25, y + 9);
  doc.text(`₹ ${fmtINR(options.grandTotalOutstanding)}`, pageW - 25, y + 9, {
    align: 'right',
  });
  y += 20;

  // Summary table header
  const summCols = { sno: 15, name: 25, bills: 100, netBill: 130, payments: 170, balance: 215 };
  const drawSummaryHeader = () => {
    doc.setFillColor(50, 50, 50);
    doc.rect(10, y, pageW - 20, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('S.No', summCols.sno, y + 7);
    doc.text('Party Name', summCols.name, y + 7);
    doc.text('Bills', summCols.bills, y + 7, { align: 'right' });
    doc.text('Net Bill Amount (₹)', summCols.netBill + 30, y + 7, { align: 'right' });
    doc.text('Total Payments (₹)', summCols.payments + 30, y + 7, { align: 'right' });
    doc.text('Outstanding (₹)', summCols.balance + 40, y + 7, { align: 'right' });
    y += 12;
  };

  drawSummaryHeader();

  // Sort parties by outstanding balance descending
  const sortedParties = [...options.parties].sort(
    (a, b) => b.outstandingBalance - a.outstandingBalance
  );

  sortedParties.forEach((party, idx) => {
    checkPageBreak(12, 'PARTY LEDGER – ALL PARTIES SUMMARY');
    if (y <= 45) drawSummaryHeader(); // redraw header after page break

    // Alternate rows
    if (idx % 2 === 0) {
      doc.setFillColor(248, 248, 248);
      doc.rect(10, y - 2, pageW - 20, 10, 'F');
    }

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    doc.text(`${idx + 1}`, summCols.sno, y + 4);
    doc.text(party.partyName.substring(0, 35), summCols.name, y + 4);
    doc.text(`${party.totalBills}`, summCols.bills, y + 4, { align: 'right' });
    doc.text(fmtINR(party.totalNetBillAmount), summCols.netBill + 30, y + 4, { align: 'right' });
    doc.text(fmtINR(party.totalPayments), summCols.payments + 30, y + 4, { align: 'right' });

    // Outstanding in red/green
    const bal = party.outstandingBalance;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(bal > 0 ? 220 : 34, bal > 0 ? 38 : 197, bal > 0 ? 38 : 94);
    doc.text(fmtINR(bal), summCols.balance + 40, y + 4, { align: 'right' });

    y += 10;
  });

  // Grand totals row
  checkPageBreak(14, 'PARTY LEDGER – ALL PARTIES SUMMARY');
  doc.setFillColor(230, 230, 230);
  doc.rect(10, y - 2, pageW - 20, 10, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('GRAND TOTAL', summCols.name, y + 4);
  doc.setFontSize(9);
  const grandBills = sortedParties.reduce((s, p) => s + p.totalBills, 0);
  const grandNet = sortedParties.reduce((s, p) => s + p.totalNetBillAmount, 0);
  const grandPay = sortedParties.reduce((s, p) => s + p.totalPayments, 0);
  doc.text(`${grandBills}`, summCols.bills, y + 4, { align: 'right' });
  doc.text(fmtINR(grandNet), summCols.netBill + 30, y + 4, { align: 'right' });
  doc.text(fmtINR(grandPay), summCols.payments + 30, y + 4, { align: 'right' });
  doc.setTextColor(220, 38, 38);
  doc.text(fmtINR(options.grandTotalOutstanding), summCols.balance + 40, y + 4, { align: 'right' });
  y += 15;

  addFooter();

  // ═══════════════════════════════════════════════════════════════════════════
  // DETAILED LEDGER FOR EACH PARTY (with entries)
  // ═══════════════════════════════════════════════════════════════════════════
  sortedParties
    .filter(p => p.entries.length > 0)
    .forEach(party => {
      newPage(`PARTY LEDGER – ${party.partyName.toUpperCase()}`);

      // Party summary bar
      doc.setFillColor(59, 130, 246); // blue-500
      doc.roundedRect(15, y, pageW - 30, 12, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`${party.partyName}`, 25, y + 8);
      doc.text(
        `Bills: ${party.totalBills}  |  Net: ₹${fmtINR(party.totalNetBillAmount)}  |  Paid: ₹${fmtINR(party.totalPayments)}  |  Outstanding: ₹${fmtINR(party.outstandingBalance)}`,
        pageW - 25,
        y + 8,
        { align: 'right' }
      );
      y += 17;

      // Detail table columns
      const cols = {
        date: 12,
        bill: 30,
        trip: 52,
        billAmt: 112,
        det: 127,
        extra: 140,
        rto: 153,
        tds: 166,
        mamool: 179,
        comm: 192,
        pen: 205,
        net: 220,
        pay: 237,
        bal: 254,
        remarks: 268,
      };

      const drawDetailHeader = () => {
        doc.setFillColor(50, 50, 50);
        doc.rect(10, y, pageW - 20, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');

        doc.text('Date', cols.date, y + 7);
        doc.text('Bill No', cols.bill, y + 7);
        doc.text('Trip Details', cols.trip, y + 7);
        doc.text('Bill', cols.billAmt, y + 7, { align: 'right' });
        doc.text('Det.', cols.det, y + 7, { align: 'right' });
        doc.text('Extra', cols.extra, y + 7, { align: 'right' });
        doc.text('RTO', cols.rto, y + 7, { align: 'right' });
        doc.text('TDS', cols.tds, y + 7, { align: 'right' });
        doc.text('Mamool', cols.mamool, y + 7, { align: 'right' });
        doc.text('Comm.', cols.comm, y + 7, { align: 'right' });
        doc.text('Penal.', cols.pen, y + 7, { align: 'right' });
        doc.text('Net', cols.net, y + 7, { align: 'right' });
        doc.text('Payment', cols.pay, y + 7, { align: 'right' });
        doc.text('Balance', cols.bal, y + 7, { align: 'right' });
        doc.text('Remarks', cols.remarks, y + 7);
        y += 12;
      };

      drawDetailHeader();

      party.entries.forEach((entry, idx) => {
        checkPageBreak(12, `PARTY LEDGER – ${party.partyName.toUpperCase()}`);
        if (y <= 50) drawDetailHeader();

        if (idx % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.rect(10, y - 2, pageW - 20, 10, 'F');
        }

        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);

        doc.text(fmtDate(entry.date), cols.date, y + 4);
        doc.text((entry.billNo || '-').substring(0, 15), cols.bill, y + 4);

        // Trip details (truncated)
        const tripText = (entry.tripDetails || '-').substring(0, 15);
        doc.text(tripText, cols.trip, y + 4);

        const v = (n: number) => (n > 0 ? fmtINR(n) : '-');

        doc.text(v(entry.billAmount), cols.billAmt, y + 4, { align: 'right' });
        doc.text(v(entry.detention), cols.det, y + 4, { align: 'right' });
        doc.text(v(entry.extra), cols.extra, y + 4, { align: 'right' });
        doc.text(v(entry.rto), cols.rto, y + 4, { align: 'right' });
        doc.text(v(entry.tds), cols.tds, y + 4, { align: 'right' });
        doc.text(v(entry.mamool), cols.mamool, y + 4, { align: 'right' });
        doc.text(v(entry.commission), cols.comm, y + 4, { align: 'right' });
        doc.text(v(entry.penalties), cols.pen, y + 4, { align: 'right' });

        // Net bill
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(22, 163, 74);
        doc.text(v(entry.netBill), cols.net, y + 4, { align: 'right' });

        // Payment
        doc.setTextColor(37, 99, 235);
        doc.text(v(entry.debitPayment), cols.pay, y + 4, { align: 'right' });

        // Balance
        const balColor = entry.runningBalance >= 0 ? [220, 38, 38] : [22, 163, 74];
        doc.setTextColor(balColor[0], balColor[1], balColor[2]);
        doc.text(fmtINR(entry.runningBalance), cols.bal, y + 4, { align: 'right' });

        // Remarks
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.text((entry.remarks || '-').substring(0, 18), cols.remarks, y + 4);

        y += 10;
      });

      // Party totals row
      checkPageBreak(12, `PARTY LEDGER – ${party.partyName.toUpperCase()}`);
      doc.setFillColor(230, 230, 230);
      doc.rect(10, y - 2, pageW - 20, 10, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.text('TOTAL', cols.date, y + 4);
      doc.text(fmtINR(party.totalNetBillAmount), cols.net, y + 4, { align: 'right' });
      doc.text(fmtINR(party.totalPayments), cols.pay, y + 4, { align: 'right' });
      doc.setTextColor(220, 38, 38);
      doc.text(fmtINR(party.outstandingBalance), cols.bal, y + 4, { align: 'right' });
      y += 15;

      addFooter();
    });

  // Signature Section on last page
  if (y < pageH - 60) {
    y += 10;
    doc.setLineWidth(0.1);
    doc.setDrawColor(200, 200, 200);
    doc.setTextColor(0, 0, 0);
    doc.line(30, y + 30, 100, y + 30);
    doc.line(pageW - 100, y + 30, pageW - 30, y + 30);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Prepared By', 65, y + 35, { align: 'center' });
    doc.text('Authorized Signatory', pageW - 65, y + 35, { align: 'center' });
  }

  // Save
  const dateStr = new Date().toISOString().split('T')[0];
  doc.save(`dashboard_party_ledger_all_parties_${dateStr}.pdf`);
  return doc;
};

// ─── EXCEL EXPORT ────────────────────────────────────────────────────────────

export const generateDashboardPartyLedgerExcel = async (
  options: DashboardExportOptions
) => {
  const wb = XLSX.utils.book_new();

  // ─── Sheet 1: Summary ────
  const summaryData: any[][] = [
    ['BHAVISHYA ROAD CARRIERS'],
    ['PARTY LEDGER – ALL PARTIES SUMMARY'],
    [`Generated: ${fmtDate(options.exportDate)}`],
    [`Total Outstanding: ₹${fmtINR(options.grandTotalOutstanding)}`],
    [],
    ['S.No', 'Party Name', 'Total Bills', 'Net Bill Amount (₹)', 'Total Payments (₹)', 'Outstanding Balance (₹)'],
  ];

  const sortedParties = [...options.parties].sort(
    (a, b) => b.outstandingBalance - a.outstandingBalance
  );

  sortedParties.forEach((party, idx) => {
    summaryData.push([
      idx + 1,
      party.partyName,
      party.totalBills,
      party.totalNetBillAmount,
      party.totalPayments,
      party.outstandingBalance,
    ]);
  });

  // Grand total row
  summaryData.push([]);
  summaryData.push([
    '',
    'GRAND TOTAL',
    sortedParties.reduce((s, p) => s + p.totalBills, 0),
    sortedParties.reduce((s, p) => s + p.totalNetBillAmount, 0),
    sortedParties.reduce((s, p) => s + p.totalPayments, 0),
    options.grandTotalOutstanding,
  ]);

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
  summaryWs['!cols'] = [
    { wch: 6 },
    { wch: 30 },
    { wch: 12 },
    { wch: 20 },
    { wch: 20 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, summaryWs, 'All Parties Summary');

  // ─── Sheet per Party with entries ────
  sortedParties
    .filter(p => p.entries.length > 0)
    .forEach(party => {
      // Excel sheet name max 31 chars, no special chars
      const sheetName = party.partyName
        .replace(/[\\\/\?\*\[\]:]/g, '')
        .substring(0, 31);

      const partyData: any[][] = [
        ['BHAVISHYA ROAD CARRIERS'],
        [`PARTY LEDGER – ${party.partyName}`],
        [`Outstanding Balance: ₹${fmtINR(party.outstandingBalance)}`],
        [`Total Bills: ${party.totalBills}  |  Net Bill Amount: ₹${fmtINR(party.totalNetBillAmount)}  |  Total Payments: ₹${fmtINR(party.totalPayments)}`],
        [],
        [
          'Date',
          'Bill No',
          'Trip Details',
          'Bill Amount (₹)',
          'Detention (₹)',
          'Extra (₹)',
          'RTO (₹)',
          'TDS (₹)',
          'Mamool (₹)',
          'Commission (₹)',
          'Penalties (₹)',
          'Net Bill (₹)',
          'Payment (₹)',
          'Running Balance (₹)',
          'Remarks',
        ],
      ];

      party.entries.forEach(entry => {
        partyData.push([
          fmtDate(entry.date),
          entry.billNo || '-',
          entry.tripDetails || '-',
          entry.billAmount || 0,
          entry.detention || 0,
          entry.extra || 0,
          entry.rto || 0,
          entry.tds || 0,
          entry.mamool || 0,
          entry.commission || 0,
          entry.penalties || 0,
          entry.netBill || 0,
          entry.debitPayment || 0,
          entry.runningBalance || 0,
          entry.remarks || '-',
        ]);
      });

      // Totals row
      partyData.push([
        'TOTAL',
        '',
        '',
        party.entries.reduce((s, e) => s + e.billAmount, 0),
        party.entries.reduce((s, e) => s + e.detention, 0),
        party.entries.reduce((s, e) => s + e.extra, 0),
        party.entries.reduce((s, e) => s + e.rto, 0),
        party.entries.reduce((s, e) => s + e.tds, 0),
        party.entries.reduce((s, e) => s + e.mamool, 0),
        party.entries.reduce((s, e) => s + e.commission, 0),
        party.entries.reduce((s, e) => s + e.penalties, 0),
        party.totalNetBillAmount,
        party.totalPayments,
        party.outstandingBalance,
        '',
      ]);

      const ws = XLSX.utils.aoa_to_sheet(partyData);
      ws['!cols'] = [
        { wch: 12 },
        { wch: 15 },
        { wch: 30 },
        { wch: 15 },
        { wch: 12 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 12 },
        { wch: 14 },
        { wch: 12 },
        { wch: 15 },
        { wch: 14 },
        { wch: 18 },
        { wch: 30 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `dashboard_party_ledger_all_parties_${dateStr}.xlsx`);
};
