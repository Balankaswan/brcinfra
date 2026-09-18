import jsPDF from 'jspdf';
import { COMPANY_LOGO_BASE64 } from '../assets/logo';
import type { LoadingSlip, Memo, Bill } from '../types';
import { isFuelAdvance } from '../components/Memo';

// Signature base64 - Add your actual signature image here
const SIGNATURE_BASE64: string = ''; // Empty until you add your actual signature base64

// Helper: ensure PNG data URL for jsPDF.addImage
const ensurePngDataUrl = async (dataUrl: string): Promise<string> => {
  try {
    if (dataUrl.startsWith('data:image/png')) return dataUrl;
    // Convert other formats (e.g., SVG/JPEG) to PNG via canvas
    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = dataUrl;
    });
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.src = dataUrl;
    // Default canvas size based on image natural size; fallback if 0
    const w = (img as any).naturalWidth || 256;
    const h = (img as any).naturalHeight || 256;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl; // fallback
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    return dataUrl; // fallback, jsPDF may still try
  }
};

// Company details - you can modify these
export const COMPANY_INFO = {
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
export const formatCurrencyForPDF = (amount: number): string => {
  return `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Utility function to format date
export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

// Generate Memo PDF - Portrait Format for single page fit
export const generateMemoPDF = async (memo: Memo, loadingSlip: LoadingSlip | LoadingSlip[], bankingEntries?: any[], cashbookEntries?: any[], options?: { preview?: boolean }): Promise<string | void> => {
  const pdf = new jsPDF('p', 'mm', 'a4'); // Portrait orientation for better fit
  const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm in portrait
  const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm in portrait

  const slips: LoadingSlip[] = Array.isArray(loadingSlip) ? loadingSlip : [loadingSlip];
  const primarySlip = slips[0];

  // Add logo with proper positioning to avoid collision
  try {
    const logoPng = await ensurePngDataUrl(COMPANY_LOGO_BASE64);
    pdf.addImage(logoPng, 'PNG', 15, 8, 25, 25); // Positioned on left side
  } catch (error) {
    console.warn('Could not add logo to PDF:', error);
  }

  // Company Header - Professional Layout with blue accent
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(25, 118, 210); // Professional blue color
  pdf.text(COMPANY_INFO.name, pageWidth / 2, 15, { align: 'center' });

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(0, 0, 0);
  pdf.text(COMPANY_INFO.address, pageWidth / 2, 21, { align: 'center' });
  pdf.text(COMPANY_INFO.address2, pageWidth / 2, 25, { align: 'center' });
  pdf.text(COMPANY_INFO.location, pageWidth / 2, 29, { align: 'center' });

  // Contact details in header
  pdf.setFontSize(7);
  pdf.text(COMPANY_INFO.phone, 15, 37);
  pdf.text(COMPANY_INFO.pan, pageWidth - 15, 37, { align: 'right' });
  pdf.text(COMPANY_INFO.tagline, pageWidth / 2, 41, { align: 'center' });

  // Header border - black color
  pdf.setLineWidth(1);
  pdf.setDrawColor(0, 0, 0);
  pdf.rect(10, 5, pageWidth - 20, 40);

  // Document title with blue background - matching the image style
  pdf.setFillColor(52, 144, 220); // Exact blue color from image
  pdf.rect(10, 50, pageWidth - 20, 12, 'F');
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('MEMO', pageWidth / 2, 58, { align: 'center' });
  pdf.setTextColor(0, 0, 0);

  // Document details box - matching image layout
  pdf.setLineWidth(0.5);
  pdf.setDrawColor(0, 0, 0);
  pdf.setTextColor(0, 0, 0);
  
  const suppPhone = memo.supplier_contact || memo.supplier_phone || (primarySlip as any).owner_number || '';
  const suppPan = memo.supplier_pan || (primarySlip as any).owner_pan || '';
  const vehicleStr = memo.vehicle_no || primarySlip.vehicle_no || (primarySlip as any).truck_number || 'N/A';
  const hasExtraSuppDetails = !!(suppPhone || suppPan);
  const boxH = hasExtraSuppDetails ? 20 : 15;

  pdf.rect(10, 67, pageWidth - 20, boxH);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Memo No: ${memo.memo_number}`, 15, 72);
  pdf.text(`Date: ${formatDate(memo.date)}`, pageWidth - 15, 72, { align: 'right' });
  pdf.text(`Supplier: ${memo.supplier}`, 15, 78);
  pdf.text(`Vehicle No: ${vehicleStr}`, pageWidth - 15, 78, { align: 'right' });
  
  if (hasExtraSuppDetails) {
    const contactLine = [
      suppPhone ? `Phone: ${suppPhone}` : '',
      suppPan ? `PAN: ${suppPan}` : ''
    ].filter(Boolean).join('  |  ');
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(60, 60, 60);
    pdf.text(contactLine, 15, 84);
    pdf.setTextColor(0, 0, 0);
  }

  // Transport Details Section with blue background - matching image
  pdf.setFillColor(52, 144, 220);
  pdf.rect(10, 87, pageWidth - 20, 8, 'F');
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('TRANSPORT DETAILS', 15, 93);
  pdf.setTextColor(0, 0, 0);

  // Transport details table - matching image layout
  pdf.setLineWidth(0.5);
  const transportY = 100;

  // From/To section with proper borders
  pdf.rect(10, transportY, (pageWidth - 20) / 2, 12);
  pdf.rect(10 + (pageWidth - 20) / 2, transportY, (pageWidth - 20) / 2, 12);

  const fromLocs = Array.from(new Set(slips.map(s => s.from_location).filter(Boolean))).join(', ');
  const toLocs = Array.from(new Set(slips.map(s => s.to_location).filter(Boolean))).join(', ');
  const materials = Array.from(new Set(slips.map(s => s.material || (s as any).load_material_details || 'MACHINERY').filter(Boolean))).join(', ');
  const totalWeight = slips.reduce((sum, s) => sum + (s.weight || (s as any).actual_weight || (s as any).guarantee_weight || 0), 0);

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.text('FROM:', 15, transportY + 4);
  pdf.text('TO:', 15 + (pageWidth - 20) / 2, transportY + 4);

  pdf.setFont('helvetica', 'normal');
  pdf.text(fromLocs || primarySlip.from_location, 15, transportY + 8, { maxWidth: (pageWidth - 30) / 2 });
  pdf.text(toLocs || primarySlip.to_location, 15 + (pageWidth - 20) / 2, transportY + 8, { maxWidth: (pageWidth - 30) / 2 });

  // Material and weight section
  pdf.rect(10, transportY + 12, (pageWidth - 20) / 2, 10);
  pdf.rect(10 + (pageWidth - 20) / 2, transportY + 12, (pageWidth - 20) / 2, 10);

  pdf.setFont('helvetica', 'bold');
  pdf.text('MATERIAL:', 15, transportY + 17);
  pdf.text('WEIGHT / LRs:', 15 + (pageWidth - 20) / 2, transportY + 17);

  pdf.setFont('helvetica', 'normal');
  pdf.text(materials || 'MACHINERY', 15, transportY + 21, { maxWidth: (pageWidth - 30) / 2 });
  const lrDetail = slips.length > 1 ? `${totalWeight} MT (${slips.length} LRs)` : `${totalWeight} MT`;
  pdf.text(lrDetail, 15 + (pageWidth - 20) / 2, transportY + 21);

  // Financial Breakdown Section with blue background - matching image
  pdf.setFillColor(52, 144, 220);
  pdf.rect(10, 127, pageWidth - 20, 8, 'F');
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('FINANCIAL BREAKDOWN', 15, 133);
  pdf.setTextColor(0, 0, 0);

  const financialY = 140;
  pdf.setLineWidth(0.5);

  // Calculate total advances from banking and cashbook entries (actual advances paid)
  const bankingAdvances = bankingEntries
    ? bankingEntries.filter(e => (e.category === 'memo_advance' || e.category === 'memo_payment') && e.reference_id === memo.memo_number)
      .reduce((sum, e) => sum + e.amount, 0)
    : 0;

  const cashbookAdvances = cashbookEntries
    ? cashbookEntries.filter(e => (e.category === 'memo_advance' || e.category === 'memo_payment') && e.reference_id === memo.memo_number)
      .reduce((sum, e) => sum + e.amount, 0)
    : 0;

  // Count fuel-tagged advance_payments separately from banking/cashbook
  const fuelAdvances = (memo.advance_payments || []).filter(isFuelAdvance).reduce((sum, a) => sum + (a.amount || 0), 0);
  const totalAdvances = bankingAdvances + cashbookAdvances + fuelAdvances;

  // Financial table - matching image style with proper borders
  const financialRows = [
    ['Freight Amount:', formatCurrencyForPDF(memo.freight)],
    ['Add: Detention:', formatCurrencyForPDF(memo.detention || 0)],
    ['Add: Extra Weight:', formatCurrencyForPDF(memo.extra || 0)],
    ['Add: RTO:', formatCurrencyForPDF(memo.rto || 0)],
    ['Less: Commission:', formatCurrencyForPDF(memo.commission || 0)],
    ['Less: Mamool:', formatCurrencyForPDF(memo.mamool || 0)],
    ['Less: Advance Paid:', formatCurrencyForPDF(totalAdvances)]
  ];

  financialRows.forEach((row, index) => {
    const rowY = financialY + (index * 7);
    pdf.rect(10, rowY, pageWidth - 20, 7);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text(row[0], 15, rowY + 5);
    pdf.text(row[1], pageWidth - 15, rowY + 5, { align: 'right' });
  });

  // Net Amount Payable with blue background - matching image
  const netAmountY = financialY + (financialRows.length * 7);
  pdf.setFillColor(52, 144, 220);
  pdf.rect(10, netAmountY, pageWidth - 20, 8, 'F');
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('NET AMOUNT PAYABLE:', 15, netAmountY + 5);
  const actualNetAmount = memo.net_amount - totalAdvances;
  pdf.text(formatCurrencyForPDF(actualNetAmount), pageWidth - 15, netAmountY + 5, { align: 'right' });
  pdf.setTextColor(0, 0, 0);

  // Advance Details Section with blue background
  const advanceY = netAmountY + 15;
  pdf.setFillColor(25, 118, 210);
  pdf.rect(10, advanceY - 5, pageWidth - 20, 8, 'F');
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('ADVANCE DETAILS', 15, advanceY);
  pdf.setTextColor(0, 0, 0);

  let currentAdvanceY = advanceY;

  // Get actual advance payments from both banking and cashbook entries
  const bankingAdvancePayments = bankingEntries
    ? bankingEntries.filter(e =>
      (e.category === 'memo_advance' || e.category === 'memo_payment') &&
      e.reference_id === memo.memo_number
    ).map(e => ({ ...e, source: 'BANK' }))
    : [];

  const cashbookAdvancePayments = cashbookEntries
    ? cashbookEntries.filter(e =>
      (e.category === 'memo_advance' || e.category === 'memo_payment') &&
      e.reference_id === memo.memo_number
    ).map(e => ({ ...e, source: 'CASH' }))
    : [];

  // Include fuel-tagged advance_payments from the memo
  const memoFuelPayments = (memo.advance_payments || [])
    .filter(isFuelAdvance)
    .map(a => ({ ...a, date: a.date, amount: a.amount, source: a.reference || a.description || 'BPCL' }));

  const allAdvancePayments = [...bankingAdvancePayments, ...cashbookAdvancePayments, ...memoFuelPayments]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Display advance payments if any exist
  if (allAdvancePayments.length > 0) {
    pdf.setFontSize(8);
    allAdvancePayments.forEach((payment, index) => {
      currentAdvanceY += 6;
      const paymentMode = payment.source || payment.mode || 'CASH';
      pdf.text(`${index + 1}. Date: ${formatDate(payment.date)} - Amount: ${formatCurrencyForPDF(payment.amount)} - Mode: ${paymentMode.toUpperCase()}`, 15, currentAdvanceY);
    });
  } else {
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text('No advance payments recorded', 15, advanceY + 5);
  }

  // Notes / Narration section (if present)
  let notesEndY = advanceY + 22;
  if (memo.narration && memo.narration.trim()) {
    const notesBoxY = advanceY + 18;
    pdf.setFillColor(255, 243, 205); // Light yellow background
    pdf.rect(10, notesBoxY, pageWidth - 20, 8, 'F');
    pdf.setLineWidth(0.5);
    pdf.setDrawColor(0, 0, 0);
    pdf.rect(10, notesBoxY, pageWidth - 20, 8);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text('NOTES:', 15, notesBoxY + 5);

    const notesTextY = notesBoxY + 8;
    const wrappedNotes = pdf.splitTextToSize(memo.narration, pageWidth - 30);
    const notesContentH = wrappedNotes.length * 5 + 4;
    pdf.setFillColor(255, 255, 255);
    pdf.rect(10, notesTextY, pageWidth - 20, notesContentH);
    pdf.setLineWidth(0.3);
    pdf.rect(10, notesTextY, pageWidth - 20, notesContentH);
    pdf.setFontSize(8.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(30, 30, 30);
    wrappedNotes.forEach((line: string, i: number) => {
      pdf.text(line, 15, notesTextY + 4 + i * 5);
    });
    notesEndY = notesTextY + notesContentH + 6;
  }

  // Signature section - portrait layout
  const signatureY = notesEndY;
  pdf.setTextColor(0, 0, 0);
  pdf.setLineWidth(0.5);
  pdf.line(20, signatureY, 90, signatureY);
  pdf.line(pageWidth - 90, signatureY, pageWidth - 20, signatureY);

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text('SUPPLIER SIGNATURE', 55, signatureY + 5, { align: 'center' });
  pdf.text('AUTHORISED SIGNATORY', pageWidth - 55, signatureY + 5, { align: 'center' });

  pdf.setFont('helvetica', 'bold');
  pdf.text(`FOR ${COMPANY_INFO.name}`, pageWidth - 55, signatureY + 10, { align: 'center' });

  // Footer with system info
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'italic');
  pdf.setTextColor(100, 100, 100);
  pdf.text('GENERATED FROM BHAVISHYA ROAD CARRIER SYSTEM', pageWidth / 2, pageHeight - 10, { align: 'center' });

  // Save or Preview the PDF
  const filename = `Memo_${memo.memo_number}_${memo.supplier.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  if (options?.preview) {
    return pdf.output('bloburl') as unknown as string;
  }
  pdf.save(filename);
};

// Generate Loading Slip PDF - Exact format matching the professional template
export const generateLoadingSlipPDF = async (loadingSlip: LoadingSlip, options?: { preview?: boolean }): Promise<string | void> => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Main border around entire document
  pdf.setLineWidth(1.5);
  pdf.setDrawColor(0, 0, 0);
  pdf.rect(10, 10, pageWidth - 20, pageHeight - 30);

  // Add logo with exact positioning as in image
  try {
    const logoPng = await ensurePngDataUrl(COMPANY_LOGO_BASE64);
    pdf.addImage(logoPng, 'PNG', 15, 15, 30, 30); // Larger logo on left
  } catch (error) {
    console.warn('Could not add logo to PDF:', error);
  }

  // Company Header - Exact layout matching image
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(52, 144, 220); // Exact blue color from image
  pdf.text(COMPANY_INFO.name, pageWidth / 2, 25, { align: 'center' });

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(0, 0, 0);
  pdf.text(COMPANY_INFO.address, pageWidth / 2, 32, { align: 'center' });
  pdf.text(COMPANY_INFO.address2, pageWidth / 2, 37, { align: 'center' });
  pdf.text(COMPANY_INFO.location, pageWidth / 2, 42, { align: 'center' });

  // Contact details in header - exact positioning
  pdf.setFontSize(8);
  pdf.text(COMPANY_INFO.phone, 15, 52);
  pdf.text(COMPANY_INFO.tagline, pageWidth / 2, 52, { align: 'center' });
  pdf.text(COMPANY_INFO.pan, pageWidth - 15, 52, { align: 'right' });

  // LORRY RECEIPT (LR) title with blue background and white text
  pdf.setFillColor(52, 144, 220); // Blue background
  pdf.rect(10, 60, pageWidth - 20, 12, 'F');
  pdf.setLineWidth(0.5);
  pdf.setDrawColor(0, 0, 0);
  pdf.rect(10, 60, pageWidth - 20, 12); // Add border
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255); // White text
  pdf.text('LORRY RECEIPT (LR)', pageWidth / 2, 69, { align: 'center' });

  // LR details box - exact layout
  pdf.setLineWidth(0.5);
  pdf.setDrawColor(0, 0, 0);
  pdf.setTextColor(0, 0, 0);
  pdf.rect(10, 77, pageWidth - 20, 20);

  const lrNum = (loadingSlip as any).lr_number || loadingSlip.slip_number || 'N/A';
  const consignorName = (loadingSlip as any).consignor_name || loadingSlip.party || 'N/A';
  const consigneeName = (loadingSlip as any).consignee_name || 'N/A';
  const vehicleNum = (loadingSlip as any).vehicle_no || 'N/A';
  const weightVal = (loadingSlip as any).actual_weight || loadingSlip.weight || 0;
  const weightUnit = (loadingSlip as any).weight_unit || 'MT';

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`LR No: ${lrNum}`, 15, 83);
  pdf.text(`Date: ${formatDate(loadingSlip.date)}`, pageWidth - 15, 83, { align: 'right' });
  pdf.text(`Vehicle No: ${vehicleNum}`, 15, 88);
  pdf.text(`Weight: ${weightVal} ${weightUnit}`, pageWidth - 15, 88, { align: 'right' });
  pdf.text(`Consignor: ${consignorName}`, 15, 93);
  pdf.text(`Consignee: ${consigneeName}`, pageWidth - 15, 93, { align: 'right' });

  // M/S section with darker gray background - left aligned
  pdf.setFillColor(200, 200, 200); // Darker gray
  pdf.rect(10, 102, pageWidth - 20, 10, 'F');
  pdf.setLineWidth(0.5);
  pdf.setDrawColor(0, 0, 0);
  pdf.rect(10, 102, pageWidth - 20, 10); // Add border
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal'); // Unbold
  pdf.setTextColor(0, 0, 0);
  pdf.text(`M/S: ${consignorName}`, 15, 109);

  // From/To section with proper table layout - exact match
  const transportY = 117;
  pdf.setLineWidth(0.5);
  pdf.setDrawColor(0, 0, 0);
  pdf.setTextColor(0, 0, 0);

  const fromLoc = (loadingSlip as any).from_location || 'N/A';
  const toLoc = (loadingSlip as any).to_location || 'N/A';

  // Draw table borders
  pdf.rect(10, transportY, (pageWidth - 20) / 2, 15);
  pdf.rect(10 + (pageWidth - 20) / 2, transportY, (pageWidth - 20) / 2, 15);

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('FROM:', 15, transportY + 6);
  pdf.text('TO:', 15 + (pageWidth - 20) / 2, transportY + 6);

  pdf.setFont('helvetica', 'normal');
  pdf.text(fromLoc, 15, transportY + 11);
  pdf.text(toLoc, 15 + (pageWidth - 20) / 2, transportY + 11);

  // Material and Dimensions section - exact match
  const materialY = transportY + 15;
  const matName = (loadingSlip as any).material ||
    ((loadingSlip as any).materials && (loadingSlip as any).materials.length > 0
      ? (loadingSlip as any).materials.map((m: any) => m.material_name).filter(Boolean).join(', ')
      : 'GOODS TRANSPORT');
  const dimStr = (loadingSlip as any).dimension || (loadingSlip as any).vehicle_size || '-';

  pdf.rect(10, materialY, (pageWidth - 20) / 2, 12);
  pdf.rect(10 + (pageWidth - 20) / 2, materialY, (pageWidth - 20) / 2, 12);

  pdf.setFont('helvetica', 'bold');
  pdf.text('MATERIAL:', 15, materialY + 5);
  pdf.text('VEHICLE SIZE:', 15 + (pageWidth - 20) / 2, materialY + 5);

  pdf.setFont('helvetica', 'normal');
  pdf.text(matName, 15, materialY + 9, { maxWidth: (pageWidth - 20) / 2 - 5 });
  pdf.text(dimStr, 15 + (pageWidth - 20) / 2, materialY + 9);

  // FINANCIAL DETAILS section with darker gray background - left aligned
  const financialY = materialY + 17;
  pdf.setFillColor(200, 200, 200); // Darker gray
  pdf.rect(10, financialY, pageWidth - 20, 10, 'F');
  pdf.setLineWidth(0.5);
  pdf.setDrawColor(0, 0, 0);
  pdf.rect(10, financialY, pageWidth - 20, 10); // Add border
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal'); // Unbold
  pdf.setTextColor(0, 0, 0);
  pdf.text('FINANCIAL DETAILS', 15, financialY + 7);

  // Financial table - exact layout matching image
  const financeTableY = financialY + 15;
  const rowHeight = 7;

  // NOTE: Freight amount is intentionally hidden on LR PDF ("TO BE BILLED").
  // The actual amount is stored in DB and used downstream for Bills/Memos.
  const financialData = [
    ['Freight Amount:', 'TO BE BILLED'],
    ['Advance Amount:', formatCurrencyForPDF(loadingSlip.advance || loadingSlip.advance_amount || 0)],
    ['RTO Amount:', formatCurrencyForPDF(loadingSlip.rto || 0)],
    ['Balance Amount:', 'TO BE BILLED']
  ];

  pdf.setFontSize(9);
  pdf.setTextColor(0, 0, 0);

  financialData.forEach((row, index) => {
    const rowY = financeTableY + (index * rowHeight);

    // Draw full width row
    pdf.setLineWidth(0.5);
    pdf.rect(10, rowY, pageWidth - 20, rowHeight);

    // Add text
    pdf.setFont('helvetica', 'normal');
    pdf.text(row[0], 15, rowY + 5);
    pdf.text(row[1], pageWidth - 15, rowY + 5, { align: 'right' });
  });

  // BANK DETAILS section with darker gray background - left aligned
  const bankY = financeTableY + (financialData.length * rowHeight) + 10;
  pdf.setFillColor(200, 200, 200); // Darker gray
  pdf.rect(10, bankY, pageWidth - 20, 10, 'F');
  pdf.setLineWidth(0.5);
  pdf.setDrawColor(0, 0, 0);
  pdf.rect(10, bankY, pageWidth - 20, 10); // Add border
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal'); // Unbold
  pdf.setTextColor(0, 0, 0);
  pdf.text('BANK DETAILS', 15, bankY + 7);

  // Bank details - exact layout
  pdf.setFontSize(9);
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'bold');

  const bankDetailsY = bankY + 15;
  pdf.text('Beneficiary Name:', 15, bankDetailsY);
  pdf.setFont('helvetica', 'normal');
  pdf.text('BHAVISHYA ROAD CARRIERS', 80, bankDetailsY);

  pdf.setFont('helvetica', 'bold');
  pdf.text('Account No:', 15, bankDetailsY + 6);
  pdf.setFont('helvetica', 'normal');
  pdf.text('231005501207', 80, bankDetailsY + 6);

  pdf.setFont('helvetica', 'bold');
  pdf.text('IFSC Code:', 15, bankDetailsY + 12);
  pdf.setFont('helvetica', 'normal');
  pdf.text('ICIC0002310', 80, bankDetailsY + 12);

  pdf.setFont('helvetica', 'bold');
  pdf.text('Branch:', 15, bankDetailsY + 18);
  pdf.setFont('helvetica', 'normal');
  pdf.text('GHODASAR, AHMEDABAD', 80, bankDetailsY + 18);

  // Terms and Conditions - exact positioning
  const termsY = bankDetailsY + 30;
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.text('TERMS & CONDITIONS:', 15, termsY);

  pdf.setFont('helvetica', 'normal');
  const terms = [
    '• We are not responsible for accident, leakage & breakage during transit',
    '• Loading/Unloading charges extra as applicable',
    '• Payment to be made within 15 days of delivery',
    '• Subject: AHMEDABAD JURISDICTION',
    '• One day halting charges Rs.4000'
  ];

  terms.forEach((term, index) => {
    pdf.text(term, 15, termsY + 5 + (index * 4));
  });

  // Signature section - only authorized signatory
  const signatureY = Math.min(termsY + 25, pageHeight - 50); // Ensure enough space from bottom
  pdf.setLineWidth(0.5);

  // Single signature line for authorized signatory only
  pdf.line(pageWidth - 85, signatureY, pageWidth - 15, signatureY);

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text('AUTHORISED SIGNATORY', pageWidth - 50, signatureY + 5, { align: 'center' });

  pdf.setFont('helvetica', 'bold');
  pdf.text('FOR BHAVISHYA ROAD CARRIERS', pageWidth - 50, signatureY + 10, { align: 'center' });

  // Footer - positioned to avoid collision with signature
  const footerY = Math.max(signatureY + 20, pageHeight - 25);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'italic');
  pdf.setTextColor(100, 100, 100);
  pdf.text('GENERATED FROM BHAVISHYA ROAD CARRIER SYSTEM', pageWidth / 2, footerY, { align: 'center' });

  // Save or Preview the PDF
  const lrDocNum = (loadingSlip as any).lr_number || loadingSlip.slip_number || 'LR';
  const lrParty = ((loadingSlip as any).consignor_name || loadingSlip.party || 'Party').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `LR_${lrDocNum}_${lrParty}.pdf`;
  if (options?.preview) {
    return pdf.output('bloburl') as unknown as string;
  }
  pdf.save(filename);
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: convert number to Indian words
// ─────────────────────────────────────────────────────────────────────────────
const numberToWords = (num: number): string => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convert = (n: number): string => {
    if (n === 0) return '';
    if (n < 20) return ones[n] + ' ';
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '') + ' ';
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred ' + convert(n % 100);
    if (n < 100000) return convert(Math.floor(n / 1000)) + 'Thousand ' + convert(n % 1000);
    if (n < 10000000) return convert(Math.floor(n / 100000)) + 'Lakh ' + convert(n % 100000);
    return convert(Math.floor(n / 10000000)) + 'Crore ' + convert(n % 10000000);
  };

  const intPart = Math.floor(Math.abs(num));
  const decPart = Math.round((Math.abs(num) - intPart) * 100);
  let result = convert(intPart).trim() + ' Rupees';
  if (decPart > 0) result += ' and ' + convert(decPart).trim() + ' Paise';
  return result + ' Only';
};

// ─────────────────────────────────────────────────────────────────────────────
// Generate Invoice / Bill PDF  — Portrait A4, matches BRC INFRA reference
// ─────────────────────────────────────────────────────────────────────────────
export const generateBillPDF = async (
  bill: Bill,
  loadingSlip: LoadingSlip | LoadingSlip[],
  bankingEntries?: any[],
  cashbookEntries?: any[],
  options?: { preview?: boolean }
): Promise<string | void> => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm
  const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm

  const slips: LoadingSlip[] = Array.isArray(loadingSlip) ? loadingSlip : [loadingSlip];
  const primarySlip = slips[0];

  // Theme Colors
  const primaryRed = [180, 40, 40]; // Deep maroon red
  const headerDarkBlue = [26, 54, 93]; // Deep navy blue
  const textDark = [30, 30, 30];
  const borderGray = [180, 180, 180];

  // 1. Outer Frame Border
  pdf.setLineWidth(0.6);
  pdf.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  pdf.rect(8, 8, pageWidth - 16, pageHeight - 16);

  let currentY = 12;

  // 2. Header Section
  try {
    const logoPng = await ensurePngDataUrl(COMPANY_LOGO_BASE64);
    pdf.addImage(logoPng, 'PNG', 12, 12, 24, 24);
  } catch (error) {
    console.warn('Could not add logo to PDF:', error);
  }

  // Company Name & Subtitles
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(primaryRed[0], primaryRed[1], primaryRed[2]);
  pdf.text(COMPANY_INFO.name, 40, currentY + 6);

  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(headerDarkBlue[0], headerDarkBlue[1], headerDarkBlue[2]);
  pdf.text(COMPANY_INFO.address2, 40, currentY + 11);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(60, 60, 60);
  pdf.text(COMPANY_INFO.address, 40, currentY + 15);
  pdf.text(COMPANY_INFO.location, 40, currentY + 19);
  pdf.text(`${COMPANY_INFO.phone}  |  ${COMPANY_INFO.pan}`, 40, currentY + 23);

  // Document Title Badge
  pdf.setFillColor(primaryRed[0], primaryRed[1], primaryRed[2]);
  pdf.rect(pageWidth - 65, 12, 57, 10, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(255, 255, 255);
  pdf.text('TAX INVOICE / BILL', pageWidth - 36.5, 18.5, { align: 'center' });

  // GSTIN & HSN Note under badge
  pdf.setFontSize(7);
  pdf.setTextColor(0, 0, 0);
  pdf.text(`GSTIN: ${bill.party_gstin || primarySlip?.consignor_gstin || '24AAACF1234A1Z1'}`, pageWidth - 65, 26);
  pdf.text(`SAC Code: ${bill.hsn_code || '996511 (GTA)'}`, pageWidth - 65, 30);

  currentY = 38;

  // Horizontal Divider Line
  pdf.setLineWidth(0.5);
  pdf.setDrawColor(200, 200, 200);
  pdf.line(8, currentY, pageWidth - 8, currentY);

  currentY += 2;

  // 3. Invoice Metadata & Party Info Grid (2 Columns Box)
  const boxWidth = (pageWidth - 20) / 2; // 95mm each
  const boxHeight = 32;

  // Left Box: Consignee / Party Details (Billed To)
  pdf.setLineWidth(0.4);
  pdf.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  pdf.setFillColor(245, 247, 250);
  pdf.rect(10, currentY, boxWidth, 7, 'FD'); // Header bar
  pdf.rect(10, currentY + 7, boxWidth, boxHeight - 7); // Main box

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(headerDarkBlue[0], headerDarkBlue[1], headerDarkBlue[2]);
  pdf.text('BILLED TO / PARTY DETAILS', 13, currentY + 5);

  const partyName = bill.party_name || bill.party || primarySlip?.party || primarySlip?.consignee || 'N/A';
  const partyGstin = bill.party_gstin || primarySlip?.consignee_gstin || primarySlip?.consignor_gstin || 'N/A';
  const partyAddress = bill.party_address || primarySlip?.to_location || 'N/A';
  const partyContact = bill.party_contact || primarySlip?.consignee_phone || 'N/A';

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(textDark[0], textDark[1], textDark[2]);
  pdf.text('Name:', 13, currentY + 12);
  pdf.setFont('helvetica', 'normal');
  pdf.text(partyName, 32, currentY + 12, { maxWidth: boxWidth - 25 });

  pdf.setFont('helvetica', 'bold');
  pdf.text('GSTIN:', 13, currentY + 17);
  pdf.setFont('helvetica', 'normal');
  pdf.text(partyGstin, 32, currentY + 17);

  pdf.setFont('helvetica', 'bold');
  pdf.text('Address:', 13, currentY + 22);
  pdf.setFont('helvetica', 'normal');
  pdf.text(partyAddress, 32, currentY + 22, { maxWidth: boxWidth - 25 });

  pdf.setFont('helvetica', 'bold');
  pdf.text('Phone:', 13, currentY + 27);
  pdf.setFont('helvetica', 'normal');
  pdf.text(partyContact, 32, currentY + 27);


  // Right Box: Invoice Meta Data
  const rightX = 10 + boxWidth + 2;
  pdf.setFillColor(245, 247, 250);
  pdf.rect(rightX, currentY, boxWidth, 7, 'FD');
  pdf.rect(rightX, currentY + 7, boxWidth, boxHeight - 7);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(headerDarkBlue[0], headerDarkBlue[1], headerDarkBlue[2]);
  pdf.text('INVOICE INFORMATION', rightX + 3, currentY + 5);

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(textDark[0], textDark[1], textDark[2]);

  pdf.text('Invoice No:', rightX + 3, currentY + 12);
  pdf.setFont('helvetica', 'normal');
  pdf.text(bill.bill_number || 'N/A', rightX + 28, currentY + 12);

  pdf.setFont('helvetica', 'bold');
  pdf.text('Date:', rightX + 3, currentY + 17);
  pdf.setFont('helvetica', 'normal');
  pdf.text(formatDate(bill.date), rightX + 28, currentY + 17);

  pdf.setFont('helvetica', 'bold');
  pdf.text('Branch / FY:', rightX + 3, currentY + 22);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${bill.branch_code || 'AHM'} / ${bill.financial_year || '2024-25'}`, rightX + 28, currentY + 22);

  pdf.setFont('helvetica', 'bold');
  pdf.text('GST Payable:', rightX + 3, currentY + 27);
  pdf.setFont('helvetica', 'normal');
  const gstP = bill.gst_payable_by || (bill.gst_type === 'reverse_charge' ? 'Reverse Charge (RCM)' : 'Forward Charge');
  pdf.text(gstP, rightX + 28, currentY + 27, { maxWidth: boxWidth - 30 });

  currentY += boxHeight + 4;

  // 4. Particulars Table Header
  const colWidths = [10, 32, 28, 40, 32, 22, 28];
  const colAligns: ('left' | 'center' | 'right')[] = ['center', 'left', 'left', 'left', 'left', 'right', 'right'];
  const colHeaders = ['S.N.', 'LR No. & Date', 'Vehicle No.', 'Route (From - To)', 'Material', 'Weight', 'Freight (Rs)'];

  const tableStartX = 9;
  const tableTotalWidth = pageWidth - 18; // 192mm

  // Draw Table Header
  pdf.setFillColor(headerDarkBlue[0], headerDarkBlue[1], headerDarkBlue[2]);
  pdf.rect(tableStartX, currentY, tableTotalWidth, 8, 'F');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(255, 255, 255);

  let currColX = tableStartX;
  colHeaders.forEach((hdr, i) => {
    const w = colWidths[i];
    const align = colAligns[i];
    let txtX = currColX + (align === 'center' ? w / 2 : align === 'right' ? w - 2 : 2);
    pdf.text(hdr, txtX, currentY + 5.5, { align });
    currColX += w;
  });

  currentY += 8;

  // Table Body Rows
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(textDark[0], textDark[1], textDark[2]);

  let totalFreightSum = 0;

  slips.forEach((slip, idx) => {
    const rowHeight = 8;
    if (idx % 2 === 1) {
      pdf.setFillColor(248, 249, 250);
      pdf.rect(tableStartX, currentY, tableTotalWidth, rowHeight, 'F');
    }

    pdf.setLineWidth(0.3);
    pdf.setDrawColor(220, 220, 220);
    pdf.rect(tableStartX, currentY, tableTotalWidth, rowHeight);

    const lrNo = slip.slip_number || 'N/A';
    const lrDate = slip.date ? formatDate(slip.date) : '';
    const lrNoDateStr = lrDate ? `${lrNo} (${lrDate})` : lrNo;
    const vehicleNo = slip.truck_number || 'N/A';
    const routeStr = `${slip.from_location || ''} to ${slip.to_location || ''}`;
    const materialStr = slip.load_material_details || 'Goods Transport';
    const weightStr = slip.actual_weight ? `${slip.actual_weight} ${slip.weight_unit || 'MT'}` : (slip.guarantee_weight ? `${slip.guarantee_weight} ${slip.weight_unit || 'MT'}` : '-');
    const freightVal = slip.freight_amount || slip.freight || 0;
    totalFreightSum += freightVal;

    const rowData = [
      (idx + 1).toString(),
      lrNoDateStr,
      vehicleNo,
      routeStr,
      materialStr,
      weightStr,
      freightVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })
    ];

    let xPos = tableStartX;
    rowData.forEach((val, i) => {
      const w = colWidths[i];
      const align = colAligns[i];
      let txtX = xPos + (align === 'center' ? w / 2 : align === 'right' ? w - 2 : 2);
      pdf.text(val.toString(), txtX, currentY + 5.5, { align, maxWidth: w - 3 });
      xPos += w;
    });

    currentY += rowHeight;
  });

  // Basic Freight Subtotal Row
  const totalRowHeight = 8;
  pdf.setFillColor(240, 243, 246);
  pdf.rect(tableStartX, currentY, tableTotalWidth, totalRowHeight, 'F');
  pdf.setLineWidth(0.4);
  pdf.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  pdf.rect(tableStartX, currentY, tableTotalWidth, totalRowHeight);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(textDark[0], textDark[1], textDark[2]);
  pdf.text('BASIC FREIGHT TOTAL', tableStartX + 5, currentY + 5.5);

  const displayFreightTotal = bill.totalFreight || bill.bill_amount || totalFreightSum;
  pdf.text(
    `Rs. ${displayFreightTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    tableStartX + tableTotalWidth - 2,
    currentY + 5.5,
    { align: 'right' }
  );

  currentY += totalRowHeight + 5;

  // 5. Two-Column Financial Summary & Bank Details Section
  const leftColW = 95;
  const rightColW = 95;
  const summaryBoxY = currentY;

  // Right Box: Full Financial Calculation Breakdown
  pdf.setFillColor(250, 252, 255);
  pdf.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  pdf.rect(pageWidth - 9 - rightColW, summaryBoxY, rightColW, 58, 'FD');

  pdf.setFillColor(headerDarkBlue[0], headerDarkBlue[1], headerDarkBlue[2]);
  pdf.rect(pageWidth - 9 - rightColW, summaryBoxY, rightColW, 7, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(255, 255, 255);
  pdf.text('BILL AMOUNT BREAKDOWN', pageWidth - 9 - rightColW + 3, summaryBoxY + 5);

  let calcY = summaryBoxY + 11;
  const addCalcLine = (label: string, value: number, isDeduction = false, isBold = false) => {
    pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(isDeduction ? 180 : textDark[0], isDeduction ? 40 : textDark[1], isDeduction ? 40 : textDark[2]);
    pdf.text(label, pageWidth - 9 - rightColW + 3, calcY);
    const prefix = isDeduction ? '- Rs. ' : 'Rs. ';
    pdf.text(
      `${prefix}${Math.abs(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      pageWidth - 12,
      calcY,
      { align: 'right' }
    );
    calcY += 5;
  };

  addCalcLine('Basic Freight Amount:', displayFreightTotal);
  if (bill.detention > 0) addCalcLine('Halting / Detention Charge:', bill.detention);
  if ((bill.extra || 0) + (bill.rto || 0) + (bill.mamool || 0) > 0) {
    const addl = (bill.extra || 0) + (bill.rto || 0) + (bill.mamool || 0);
    addCalcLine('Extra / RTO / Service Charges:', addl);
  }

  const grossTotal = displayFreightTotal + (bill.detention || 0) + (bill.extra || 0) + (bill.rto || 0) + (bill.mamool || 0);

  if (bill.party_commission_cut > 0) addCalcLine('Party Commission Cut:', bill.party_commission_cut, true);
  if (bill.tds > 0) addCalcLine('TDS Deducted:', bill.tds, true);
  if (bill.penalties > 0) addCalcLine('Shortage / Penalties:', bill.penalties, true);

  if (bill.gst_amount && bill.gst_amount > 0) {
    addCalcLine(`GST (${bill.gst_percentage || 5}%):`, bill.gst_amount);
  }

  // Divider Line before Net Amount
  pdf.setLineWidth(0.4);
  pdf.setDrawColor(0, 0, 0);
  pdf.line(pageWidth - 9 - rightColW + 2, calcY, pageWidth - 11, calcY);
  calcY += 4.5;

  // NET AMOUNT HIGHLIGHT BOX
  const finalNet = bill.net_amount || bill.total_invoice_value || (grossTotal - (bill.party_commission_cut || 0) - (bill.tds || 0) - (bill.penalties || 0) + (bill.gst_amount || 0));

  pdf.setFillColor(primaryRed[0], primaryRed[1], primaryRed[2]);
  pdf.rect(pageWidth - 9 - rightColW + 2, calcY - 3, rightColW - 4, 8, 'F');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(255, 255, 255);
  pdf.text('NET INVOICE VALUE:', pageWidth - 9 - rightColW + 5, calcY + 2.5);
  pdf.text(`Rs. ${finalNet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pageWidth - 12, calcY + 2.5, { align: 'right' });


  // Left Box: Bank Details & GST Note
  pdf.setLineWidth(0.4);
  pdf.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  pdf.setFillColor(250, 252, 255);
  pdf.rect(9, summaryBoxY, leftColW, 58, 'FD');

  pdf.setFillColor(headerDarkBlue[0], headerDarkBlue[1], headerDarkBlue[2]);
  pdf.rect(9, summaryBoxY, leftColW, 7, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(255, 255, 255);
  pdf.text('BANK & PAYMENT DETAILS', 12, summaryBoxY + 5);

  let bankY = summaryBoxY + 12;
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(textDark[0], textDark[1], textDark[2]);

  pdf.text('Account Name:', 12, bankY);
  pdf.setFont('helvetica', 'normal');
  pdf.text('BHAVISHYA ROAD CARRIERS', 42, bankY);

  pdf.setFont('helvetica', 'bold');
  pdf.text('Bank Name:', 12, bankY + 6);
  pdf.setFont('helvetica', 'normal');
  pdf.text('ICICI BANK LTD', 42, bankY + 6);

  pdf.setFont('helvetica', 'bold');
  pdf.text('Account No:', 12, bankY + 12);
  pdf.setFont('helvetica', 'normal');
  pdf.text('231005501207', 42, bankY + 12);

  pdf.setFont('helvetica', 'bold');
  pdf.text('IFSC Code:', 12, bankY + 18);
  pdf.setFont('helvetica', 'normal');
  pdf.text('ICIC0002310', 42, bankY + 18);

  pdf.setFont('helvetica', 'bold');
  pdf.text('Branch:', 12, bankY + 24);
  pdf.setFont('helvetica', 'normal');
  pdf.text('GHODASAR, AHMEDABAD', 42, bankY + 24);

  // GST Declaration / Note
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'italic');
  pdf.setTextColor(100, 100, 100);
  pdf.text('Note: Goods Transport Agency (GTA) Services.', 12, bankY + 32);
  pdf.text('GST payable under Reverse Charge Mechanism (RCM)', 12, bankY + 36);
  pdf.text('by the Recipient of Service as per Notification No. 13/2017.', 12, bankY + 40);

  currentY = summaryBoxY + 62;

  // 6. Amount in Words Box
  pdf.setFillColor(245, 247, 250);
  pdf.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  pdf.rect(9, currentY, tableTotalWidth, 8, 'FD');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(headerDarkBlue[0], headerDarkBlue[1], headerDarkBlue[2]);
  pdf.text('Amount in Words:', 13, currentY + 5.5);

  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(textDark[0], textDark[1], textDark[2]);
  pdf.text(numberToWords(finalNet), 45, currentY + 5.5, { maxWidth: tableTotalWidth - 40 });

  currentY += 12;

  // 7. Terms & Signature Footer Section
  const termsY = currentY;
  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(headerDarkBlue[0], headerDarkBlue[1], headerDarkBlue[2]);
  pdf.text('TERMS & CONDITIONS:', 12, termsY);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.5);
  pdf.setTextColor(80, 80, 80);
  const termsList = [
    '1. Payment must be made by A/C payee cheque / RTGS / NEFT in favour of BHAVISHYA ROAD CARRIERS.',
    '2. Interest @ 18% per annum will be charged if the bill is not paid within the due period.',
    '3. We are not responsible for shortage, leakage, or damage during transit unless endorsed on POD.',
    '4. All disputes subject to AHMEDABAD Jurisdiction only.'
  ];

  termsList.forEach((term, index) => {
    pdf.text(term, 12, termsY + 4 + (index * 3.5));
  });

  // Right Side: Signatory Box
  const sigX = pageWidth - 70;
  const sigY = termsY + 12;

  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(textDark[0], textDark[1], textDark[2]);
  pdf.text('For BHAVISHYA ROAD CARRIERS', sigX, termsY + 2, { align: 'center' });

  pdf.setLineWidth(0.4);
  pdf.setDrawColor(0, 0, 0);
  pdf.line(sigX - 25, sigY, sigX + 25, sigY);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.text('Authorised Signatory', sigX, sigY + 4, { align: 'center' });

  // System Footer
  pdf.setFontSize(6.5);
  pdf.setFont('helvetica', 'italic');
  pdf.setTextColor(120, 120, 120);
  pdf.text('This is a Computer Generated Tax Invoice / Freight Bill.', pageWidth / 2, pageHeight - 11, { align: 'center' });

  // Save or Preview
  const filename = `Bill_${bill.bill_number.replace(/[^a-zA-Z0-9]/g, '_')}_${(bill.party || 'Party').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  if (options?.preview) {
    return pdf.output('bloburl') as unknown as string;
  }
  pdf.save(filename);
};

// Generate PDF from HTML element (alternative method)
export const generatePDFFromHTML = async (elementId: string, filename: string): Promise<void> => {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with id "${elementId}" not found`);
  }

  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const imgWidth = 210;
  const pageHeight = 295;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let heightLeft = imgHeight;

  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft >= 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(filename);
};

// Generate Party Commission Ledger PDF
export const generatePartyCommissionLedgerPDF = async (entries: any[], summary: any, filters: any, selectedParty?: any): Promise<void> => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Add logo
  try {
    const logoPng = await ensurePngDataUrl(COMPANY_LOGO_BASE64);
    pdf.addImage(logoPng, 'PNG', 15, 8, 25, 25);
  } catch (error) {
    console.warn('Could not add logo to PDF:', error);
  }

  // Company Header
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(25, 118, 210);
  pdf.text(COMPANY_INFO.name, pageWidth / 2, 15, { align: 'center' });

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(0, 0, 0);
  pdf.text(COMPANY_INFO.address, pageWidth / 2, 21, { align: 'center' });
  pdf.text(COMPANY_INFO.location, pageWidth / 2, 25, { align: 'center' });

  // Header border
  pdf.setLineWidth(1);
  pdf.setDrawColor(0, 0, 0);
  pdf.rect(10, 5, pageWidth - 20, 25);

  // Document title
  pdf.setFillColor(52, 144, 220);
  pdf.rect(10, 35, pageWidth - 20, 12, 'F');
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  const title = selectedParty ? `PARTY COMMISSION LEDGER - ${selectedParty.party_name.toUpperCase()}` : 'PARTY COMMISSION LEDGER';
  pdf.text(title, pageWidth / 2, 43, { align: 'center' });
  pdf.setTextColor(0, 0, 0);

  // Date range and filters
  let currentY = 52;
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  if (filters.date_from || filters.date_to) {
    const dateRange = `Period: ${filters.date_from ? formatDate(filters.date_from) : 'Start'} to ${filters.date_to ? formatDate(filters.date_to) : 'End'}`;
    pdf.text(dateRange, 15, currentY);
    currentY += 5;
  }
  if (filters.bill_number) {
    pdf.text(`Bill Filter: ${filters.bill_number}`, 15, currentY);
    currentY += 5;
  }

  // Summary section
  currentY += 5;
  pdf.setFillColor(240, 240, 240);
  pdf.rect(10, currentY, pageWidth - 20, 20, 'F');
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('SUMMARY', 15, currentY + 6);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text(`Total Credits: ${formatCurrencyForPDF(summary.totalCredits)}`, 15, currentY + 12);
  pdf.text(`Total Debits: ${formatCurrencyForPDF(summary.totalDebits)}`, 15, currentY + 16);
  pdf.text(`Outstanding Balance: ${formatCurrencyForPDF(summary.balance)}`, pageWidth - 15, currentY + 12, { align: 'right' });
  pdf.text(`Total Entries: ${summary.totalEntries}`, pageWidth - 15, currentY + 16, { align: 'right' });

  // Table header
  currentY += 25;
  const tableHeaders = ['Date', 'Bill No/Ref', 'Narration', 'Credit', 'Debit', 'Balance'];
  const colWidths = [25, 30, 70, 25, 25, 25];
  let colX = [15];
  for (let i = 1; i < colWidths.length; i++) {
    colX[i] = colX[i - 1] + colWidths[i - 1];
  }

  pdf.setFillColor(52, 144, 220);
  pdf.rect(10, currentY, pageWidth - 20, 8, 'F');
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);

  tableHeaders.forEach((header, index) => {
    const align = index >= 3 ? 'right' : 'left';
    const x = align === 'right' ? colX[index] + colWidths[index] - 2 : colX[index] + 2;
    pdf.text(header, x, currentY + 5, { align });
  });

  // Table data
  currentY += 8;
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);

  entries.forEach((entry, index) => {
    if (currentY > pageHeight - 30) {
      pdf.addPage();
      currentY = 20;
    }

    const rowData = [
      new Date(entry.date).toLocaleDateString('en-GB'),
      entry.bill_number || entry.reference_id || '',
      entry.narration.length > 35 ? entry.narration.substring(0, 32) + '...' : entry.narration,
      entry.entry_type === 'credit' ? formatCurrencyForPDF(entry.amount) : '-',
      entry.entry_type === 'debit' ? formatCurrencyForPDF(entry.amount) : '-',
      formatCurrencyForPDF(entry.running_balance)
    ];

    // Alternate row colors
    if (index % 2 === 0) {
      pdf.setFillColor(248, 248, 248);
      pdf.rect(10, currentY, pageWidth - 20, 6, 'F');
    }

    rowData.forEach((data, colIndex) => {
      const align = colIndex >= 3 ? 'right' : 'left';
      const x = align === 'right' ? colX[colIndex] + colWidths[colIndex] - 2 : colX[colIndex] + 2;
      pdf.text(data, x, currentY + 4, { align });
    });

    currentY += 6;
  });

  // Footer
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'italic');
  pdf.setTextColor(100, 100, 100);
  pdf.text('GENERATED FROM BHAVISHYA ROAD CARRIER SYSTEM', pageWidth / 2, pageHeight - 10, { align: 'center' });

  // Save the PDF
  const partyName = selectedParty ? selectedParty.party_name.replace(/[^a-zA-Z0-9]/g, '_') : 'All_Parties';
  const filename = `Party_Commission_Ledger_${partyName}_${new Date().toISOString().split('T')[0]}.pdf`;
  pdf.save(filename);
};

// Generate LR (Lorry Receipt / Consignment Note) PDF — 5 pages
// Full implementation in lrPdfGenerator.ts
export { generateLRPDF } from './lrPdfGenerator';
