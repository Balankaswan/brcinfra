import jsPDF from 'jspdf';
import { COMPANY_LOGO_BASE64 } from '../assets/logo';

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

// ─── GENERATE LR / BILTY PDF — 5 pages ───────────────────────────────────────
// Page 1: Consignor Copy | Page 2: Consignee Copy | Page 3: Transporter Copy
// Page 4: Driver Copy    | Page 5: Terms & Conditions
export const generateLRPDF = async (loadingSlip: any, options?: { preview?: boolean }): Promise<string | void> => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const W = 210; // page width mm
  const H = 297; // page height mm
  const M = 4;   // margin

  const lrNum        = loadingSlip.lr_number || loadingSlip.slip_number || '';
  const dateStr      = loadingSlip.date
    ? new Date(loadingSlip.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';
  const consignorName  = loadingSlip.consignor_name || loadingSlip.party || '';
  const consigneeName  = loadingSlip.consignee_name || '';
  const consignorAddr  = loadingSlip.consignor_address || '';
  const consigneeAddr  = loadingSlip.delivery_address || loadingSlip.consignee_address || '';
  const consignorGstin = loadingSlip.consignor_gstin || '';
  const consigneeGstin = loadingSlip.consignee_gstin || '';
  const consignorPhone = loadingSlip.consignor_contact || '';
  const consigneePhone = loadingSlip.consignee_contact || '';
  const vehicleNo      = loadingSlip.vehicle_no || '';
  const vehicleSize    = loadingSlip.vehicle_size || '';
  const sealNo         = loadingSlip.seal_number || '';
  const ewayBill       = loadingSlip.eway_bill_number || '';
  const deliveryAddr   = loadingSlip.delivery_address || consigneeAddr;
  const fromLoc        = loadingSlip.from_location || '';
  const toLoc          = loadingSlip.to_location || '';
  const driverName     = loadingSlip.driver_name || '';
  const driverNo       = loadingSlip.driver_number || '';
  const dlNo           = loadingSlip.dl_number || '';
  const ownerName      = loadingSlip.owner_name || '';
  const ownerNo        = loadingSlip.owner_number || '';
  const freightType    = (loadingSlip.freight_type || 'to_be_billed').replace(/_/g, ' ').toUpperCase();
  const freightAmt     = loadingSlip.freight_amount || loadingSlip.freight || 0;
  const haltingAmt     = loadingSlip.halting_charge || 0;
  const doorAmt        = loadingSlip.door_to_door_charge || 0;
  const serviceAmt     = loadingSlip.service_charge || 0;
  const otherAmt       = loadingSlip.other_charge || 0;
  const totalAmt       = loadingSlip.total_amount || loadingSlip.total_freight || 0;
  const advanceAmt     = loadingSlip.advance_amount || loadingSlip.advance || 0;
  const balanceAmt     = loadingSlip.balance_amount || 0;
  const freightRate    = loadingSlip.freight_rate || 0;
  const freightFixed   = loadingSlip.freight_fixed || false;
  const gstPaidBy      = loadingSlip.gst_paid_by || '';
  const insStatus      = loadingSlip.insurance_status || 'not_insured';
  const insCompany     = loadingSlip.insurance_company || '';
  const policyNo       = loadingSlip.policy_number || '';
  const insAmount      = loadingSlip.insurance_amount || 0;
  const insDate        = loadingSlip.insurance_date || '';
  const insRisk        = loadingSlip.insurance_risk || 'AT OWNER RISK';
  const gatePass       = loadingSlip.gate_pass_number || '';
  const demurrageCharge = loadingSlip.demurrage_charge || 0;
  const demurrageAfter  = loadingSlip.demurrage_after || '';
  const remarks        = loadingSlip.remarks || '';
  const narration      = loadingSlip.narration || '';
  const actualWeight   = loadingSlip.actual_weight || loadingSlip.weight || 0;
  const guaranteeWeight = loadingSlip.guarantee_weight || 0;
  const weightUnit     = loadingSlip.weight_unit || 'MT';
  const goodsValue     = loadingSlip.goods_value || 0;

  const materialsList: any[] = Array.isArray(loadingSlip.materials) && loadingSlip.materials.length > 0
    ? loadingSlip.materials
    : [{
        material_name: loadingSlip.material || '',
        packing_type: loadingSlip.packing_type || 'NOS',
        no_of_articles: loadingSlip.no_of_articles || 0,
        hsn_code: loadingSlip.hsn_code || '',
        invoice_number: loadingSlip.invoice_number || '',
        weight: actualWeight,
        value_of_goods: goodsValue,
      }];

  const totalArticles    = materialsList.reduce((s: number, m: any) => s + (Number(m.no_of_articles) || 0), 0);
  const totalGoodsValue  = materialsList.reduce((s: number, m: any) => s + (Number(m.value_of_goods) || 0), 0);

  // COMPANY CONFIG
  const CO = {
    name:    'BRC INFRA',
    tagline: 'FLEET OWNER / TRANSPORT CONTRACTOR',
    address: 'NAROL AHMEDABAD, AHMEDABAD, GUJARAT',
    mobile:  '9898907333',
    email:   'brcinfra84@gmail.com',
    pan:     'BXVPK3909H',
    gstin:   '24BXVPK3909H1Z4',
    bank:    'Punjab National Bank',
    acc:     '1960002100075937',
    ifsc:    'PUNB0196000',
    holder:  'BRC INFRA',
    branch:  'NAROL BRANCH, AHMEDABAD',
  };

  // ─── helpers ────────────────────────────────────────────────────────────────
  const hRule = (x: number, y: number, w: number, lw = 0.2) => {
    pdf.setLineWidth(lw);
    pdf.setDrawColor(0, 0, 0);
    pdf.line(x, y, x + w, y);
  };

  const vLine = (x: number, y1: number, y2: number, lw = 0.2) => {
    pdf.setLineWidth(lw);
    pdf.setDrawColor(0, 0, 0);
    pdf.line(x, y1, x, y2);
  };

  const fieldRow = (
    label: string,
    val: string,
    x: number,
    y: number,
    maxW: number
  ) => {
    pdf.setFontSize(5.5);
    pdf.setFont('helvetica', 'bold');
    pdf.text(label, x, y);
    const lw2 = pdf.getTextWidth(label);
    pdf.setFont('helvetica', 'normal');
    const truncated = val.substring(0, Math.floor(maxW / 1.5));
    pdf.text(truncated, x + lw2 + 1, y);
  };

  // ─── draw one copy page ──────────────────────────────────────────────────────
  const drawCopyPage = async (copyLabel: string) => {
    // Outer border
    pdf.setLineWidth(0.8);
    pdf.setDrawColor(0, 0, 0);
    pdf.rect(M, M, W - 2 * M, H - 2 * M);

    // ══════════════════════════════════════════════════
    // ROW 1: HEADER  (y: M .. M+28)
    // ══════════════════════════════════════════════════
    const headerH = 28;
    const headerY = M;

    // Logo
    try {
      const logoPng = await ensurePngDataUrl(COMPANY_LOGO_BASE64);
      pdf.addImage(logoPng, 'PNG', M + 1, headerY + 1, 22, 22);
    } catch { /* ignore */ }

    // Jurisdiction (blue, centred)
    pdf.setFontSize(6);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 180);
    pdf.text(`Subject To ${CO.address.split(',').pop()?.trim() || 'AHMEDABAD'} jurisdiction`, W / 2, headerY + 5, { align: 'center' });

    // Company name (red bold)
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(210, 20, 20);
    pdf.text(CO.name, W / 2, headerY + 12, { align: 'center' });

    // Tagline + address
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);
    pdf.text(CO.tagline, W / 2, headerY + 17, { align: 'center' });
    pdf.text(CO.address, W / 2, headerY + 21, { align: 'center' });
    pdf.text(
      `Transport Reg. No. :     E-mail : ${CO.email}    Website :    Mob: ${CO.mobile}`,
      W / 2, headerY + 25, { align: 'center' }
    );

    // Right panel: copy label + PAN + GSTIN
    pdf.setFontSize(7.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text(copyLabel, W - M - 2, headerY + 7, { align: 'right' });
    pdf.setFontSize(6);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`PAN NO : ${CO.pan}`, W - M - 2, headerY + 12, { align: 'right' });
    pdf.text(`GSTIN : ${CO.gstin}`, W - M - 2, headerY + 17, { align: 'right' });

    hRule(M, headerY + headerH, W - 2 * M, 0.4);

    // ══════════════════════════════════════════════════
    // ROW 2: DEMURRAGE | INSURANCE | OWNER RISK | BILTY+VEHICLE | FROM-TO
    // ══════════════════════════════════════════════════
    const r2Y = headerY + headerH;
    const r2H = 62;

    // column boundaries
    const c1X = M;        const c1W = 38;
    const c2X = c1X+c1W; const c2W = 50;
    const c3X = c2X+c2W; const c3W = 38;
    const c4X = c3X+c3W; const c4W = 44;  // bilty no / vehicle / date
    const c5X = c4X+c4W; const c5W = W - 2*M - c1W - c2W - c3W - c4W; // from-to

    // vertical separators for row 2
    [c2X, c3X, c4X, c5X].forEach(x => vLine(x, r2Y, r2Y + r2H));
    hRule(M, r2Y + r2H, W - 2 * M, 0.4);

    // ── COL 1: Demurrage + Notice ─────────────────────
    pdf.setFillColor(200, 200, 200);
    pdf.rect(c1X, r2Y, c1W, 5, 'F');
    pdf.setFontSize(6); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(0, 0, 0);
    pdf.text('SCHEDULE OF DEMURRAGE', c1X + c1W / 2, r2Y + 3.5, { align: 'center' });

    pdf.setFontSize(5.2); pdf.setFont('helvetica', 'normal');
    const demText = demurrageCharge
      ? `Demurrage Chargeable After ${demurrageAfter} from the date of arrival Rs. ${demurrageCharge}/-`
      : 'Demurrage Chargeable After from the date of arrival Rs.___';
    const demLines = pdf.splitTextToSize(demText, c1W - 2);
    pdf.text(demLines, c1X + 1, r2Y + 9);

    hRule(c1X, r2Y + 24, c1W);
    pdf.setFillColor(200, 200, 200);
    pdf.rect(c1X, r2Y + 24, c1W, 5, 'F');
    pdf.setFontSize(6); pdf.setFont('helvetica', 'bold');
    pdf.text('NOTICE', c1X + c1W / 2, r2Y + 27.5, { align: 'center' });

    pdf.setFontSize(5); pdf.setFont('helvetica', 'normal');
    const noticeText = `We are sending Vehicle no ${vehicleNo} as per your order. Please arrange to load the same and check up yourself all the paper of the vehicle before loading. You are requested to insure the goods otherwise the company is not liable for any loss or damages.`;
    pdf.text(pdf.splitTextToSize(noticeText, c1W - 2), c1X + 1, r2Y + 32);

    // ── COL 2: Insurance ─────────────────────────────
    pdf.setFillColor(200, 200, 200);
    pdf.rect(c2X, r2Y, c2W, 5, 'F');
    pdf.setFontSize(6); pdf.setFont('helvetica', 'bold');
    pdf.text('INSURANCE', c2X + c2W / 2, r2Y + 3.5, { align: 'center' });

    pdf.setFontSize(5.2); pdf.setFont('helvetica', 'normal');
    pdf.text('THE CUSTOMER HAS STATED THAT:', c2X + 1, r2Y + 9);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`STATUS : ${insStatus === 'insured' ? 'INSURED' : 'NON INSURED'}`, c2X + 1, r2Y + 13.5);
    pdf.setFont('helvetica', 'normal');

    const insRows: [string, string][] = [
      ['COMPANY',     insCompany],
      ['POLICY NO',   policyNo],
      ['AMOUNT',      insAmount ? String(insAmount) : ''],
      ['DATE',        insDate ? new Date(insDate).toLocaleDateString('en-IN') : ''],
      ['RISK',        insStatus === 'insured' ? (insRisk || 'INSURED') : 'AT OWNER RISK'],
      ['GATE PASS NO.', gatePass],
    ];
    let insRowY = r2Y + 18;
    insRows.forEach(([label, val]) => {
      pdf.setFontSize(5); pdf.setFont('helvetica', 'bold');
      pdf.text(label, c2X + 1, insRowY);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`: ${val}`, c2X + 20, insRowY);
      insRowY += 5;
    });

    // ── COL 3: AT OWNER RISK ─────────────────────────
    pdf.setFillColor(200, 200, 200);
    pdf.rect(c3X, r2Y, c3W, 5, 'F');
    pdf.setFontSize(6); pdf.setFont('helvetica', 'bold');
    pdf.text('AT OWNER RISK', c3X + c3W / 2, r2Y + 3.5, { align: 'center' });

    pdf.setFontSize(5); pdf.setFont('helvetica', 'normal');
    const ownerRiskText = 'This consignment will not be Detained, re-route, diverted or re-book without consignees / consignor bank written permission. It will be delivered at the destination.';
    pdf.text(pdf.splitTextToSize(ownerRiskText, c3W - 3), c3X + 1, r2Y + 9);

    // ── COL 4: Bilty No / Date / Vehicle Size / Seal / Delivery ──────
    const c4LW = Math.floor(c4W / 2);
    const c4RX = c4X + c4LW;
    vLine(c4RX, r2Y, r2Y + r2H);

    // LEFT half: bilty metadata
    const metaRows: [string, string][] = [
      ['BILTY NO :',      lrNum],
      ['DATE :',          dateStr],
      ['Vehicle Size :',  vehicleSize],
      ['SEAL NUMBER :',   sealNo],
    ];
    let metaY = r2Y + 5;
    metaRows.forEach(([label, val]) => {
      pdf.setFontSize(5.5); pdf.setFont('helvetica', 'bold');
      pdf.text(label, c4X + 1, metaY);
      pdf.setFont('helvetica', 'normal');
      pdf.text(val.substring(0, 12), c4X + 1, metaY + 4);
      metaY += 9;
      hRule(c4X, metaY - 1, c4LW);
    });
    // Delivery address
    pdf.setFontSize(5.5); pdf.setFont('helvetica', 'bold');
    pdf.text('DELIVERY ADDRESS :', c4X + 1, metaY + 1);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(5);
    pdf.text(pdf.splitTextToSize(deliveryAddr, c4LW - 2).slice(0, 4), c4X + 1, metaY + 5);

    // RIGHT half: vehicle no + from-to
    pdf.setFontSize(5.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(0, 0, 0);
    pdf.text('VEHICLE NUMBER :', c4RX + 1, r2Y + 6);
    pdf.setFontSize(9); pdf.setTextColor(210, 20, 20);
    pdf.text(vehicleNo, c4RX + 1, r2Y + 13);
    pdf.setTextColor(0, 0, 0);

    hRule(c4RX, r2Y + 16, c4W - c4LW);
    pdf.setFontSize(5.5); pdf.setFont('helvetica', 'bold');
    pdf.text('From', c4RX + 1, r2Y + 21);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); pdf.setTextColor(0, 0, 180);
    pdf.text(pdf.splitTextToSize(fromLoc, c4W - c4LW - 2).slice(0, 2), c4RX + 1, r2Y + 26);
    pdf.setTextColor(0, 0, 0);

    hRule(c4RX, r2Y + 36, c4W - c4LW);
    pdf.setFontSize(5.5); pdf.setFont('helvetica', 'bold');
    pdf.text('To', c4RX + 1, r2Y + 41);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); pdf.setTextColor(0, 0, 180);
    pdf.text(pdf.splitTextToSize(toLoc, c4W - c4LW - 2).slice(0, 2), c4RX + 1, r2Y + 46);
    pdf.setTextColor(0, 0, 0);

    // ══════════════════════════════════════════════════
    // ROW 3: CONSIGNOR | CONSIGNEE | DRIVER INFO
    // ══════════════════════════════════════════════════
    const r3Y = r2Y + r2H;
    const r3H = 32;

    const consFrac = Math.floor((W - 2 * M) * 0.36);
    const driverFrac = W - 2 * M - consFrac * 2;

    const consignorX2 = M;
    const consigneeX2 = M + consFrac;
    const driverX2    = M + consFrac * 2;

    vLine(consigneeX2, r3Y, r3Y + r3H);
    vLine(driverX2, r3Y, r3Y + r3H);
    hRule(M, r3Y + r3H, W - 2 * M, 0.4);

    // Headers (salmon background)
    const salmonFill: [number, number, number] = [255, 180, 180];
    pdf.setFillColor(...salmonFill);
    pdf.rect(consignorX2, r3Y, consFrac, 5, 'F');
    pdf.rect(consigneeX2, r3Y, consFrac, 5, 'F');
    pdf.setFontSize(6); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(0, 0, 0);
    pdf.text("CONSIGNOR'S DETAILS", consignorX2 + consFrac / 2, r3Y + 3.5, { align: 'center' });
    pdf.text("CONSIGNEE'S / BUYER'S DETAILS", consigneeX2 + consFrac / 2, r3Y + 3.5, { align: 'center' });

    const cFY = r3Y + 8;
    const cRows: [string, string][] = [
      ['NAME ',    consignorName],
      ['ADDRESS ', consignorAddr.substring(0, 40)],
      ['EMAIL ',   loadingSlip.consignor_email || ''],
      ['GSTIN ',   consignorGstin],
      ['CONTACT ', consignorPhone],
    ];
    cRows.forEach(([lbl, val], i) => fieldRow(lbl, val, consignorX2 + 1, cFY + i * 4.5, consFrac - 2));

    const eRows: [string, string][] = [
      ['NAME ',    consigneeName],
      ['ADDRESS ', consigneeAddr.substring(0, 40)],
      ['EMAIL ',   loadingSlip.consignee_email || ''],
      ['GSTIN ',   consigneeGstin],
      ['CONTACT ', consigneePhone],
    ];
    eRows.forEach(([lbl, val], i) => fieldRow(lbl, val, consigneeX2 + 1, cFY + i * 4.5, consFrac - 2));

    // Driver panel
    pdf.setFontSize(6); pdf.setFont('helvetica', 'bold');
    pdf.text('E WAY BILL NO :', driverX2 + 1, r3Y + 6);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(5.5);
    pdf.text(ewayBill, driverX2 + 24, r3Y + 6);
    hRule(driverX2, r3Y + 8, driverFrac);

    const dFY = r3Y + 11;
    const dRows: [string, string][] = [
      ['DRIVER NAME ',   driverName],
      ['DRIVER NUM ',    driverNo],
      ['DL NUMBER ',     dlNo],
      ['OWNER NAME ',    ownerName],
      ['OWNER NUMBER ',  ownerNo],
    ];
    dRows.forEach(([lbl, val], i) => fieldRow(lbl, val, driverX2 + 1, dFY + i * 4, driverFrac - 2));

    hRule(driverX2, r3Y + 28, driverFrac);
    pdf.setFontSize(5.5); pdf.setFont('helvetica', 'bold');
    pdf.text('GSTIN PAID BY', driverX2 + 1, r3Y + 31);
    pdf.setFont('helvetica', 'normal');
    pdf.text(gstPaidBy.toUpperCase(), driverX2 + 25, r3Y + 31);

    // ══════════════════════════════════════════════════
    // ROW 4: MATERIALS TABLE (left) + AMOUNT SUMMARY (right)
    // ══════════════════════════════════════════════════
    const r4Y  = r3Y + r3H;
    const amtW = 44;
    const matW = W - 2 * M - amtW;
    const amtX = M + matW;

    // Material table header
    pdf.setFillColor(200, 200, 200);
    pdf.rect(M, r4Y, matW, 5, 'F');

    const mcols: { label: string; x: number; w: number }[] = [
      { label: 'MATERIAL NAME',    x: M,       w: 42 },
      { label: 'PACKAGING TYPE',   x: M + 42,  w: 22 },
      { label: 'NO. OF ARTICLE',   x: M + 64,  w: 18 },
      { label: 'HSN CODE',         x: M + 82,  w: 18 },
      { label: 'BILL INVOICE NO.', x: M + 100, w: 28 },
      { label: 'WEIGHT',           x: M + 128, w: 20 },
      { label: 'VALUE OF\nGOODS',  x: M + 148, w: matW - 148 },
    ];

    pdf.setFontSize(5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(0, 0, 0);
    mcols.forEach(col => {
      vLine(col.x, r4Y, r4Y + 5);
      col.label.split('\n').forEach((line, li) => {
        pdf.text(line, col.x + 1, r4Y + 3 + li * 2.5);
      });
    });
    vLine(M + matW, r4Y, r4Y + 5);
    hRule(M, r4Y + 5, matW);

    // Amount header
    pdf.setFillColor(200, 200, 200);
    pdf.rect(amtX, r4Y, amtW, 5, 'F');
    pdf.setFontSize(6); pdf.setFont('helvetica', 'bold');
    pdf.text('AMOUNT', amtX + amtW / 2, r4Y + 3.5, { align: 'center' });
    vLine(amtX, r4Y, r4Y + 5);
    vLine(W - M, r4Y, r4Y + 5);
    hRule(amtX, r4Y + 5, amtW);

    // Material rows
    let matRowY = r4Y + 5;
    const matRowH = 7;
    pdf.setFont('helvetica', 'normal');

    materialsList.forEach((item: any) => {
      pdf.setFontSize(5.5);
      const cols2: [number, string][] = [
        [M + 1,   String(item.material_name || item.material || '').substring(0, 22)],
        [M + 43,  String(item.packing_type || '').substring(0, 10)],
        [M + 65,  String(item.no_of_articles || '')],
        [M + 83,  String(item.hsn_code || '')],
        [M + 101, String(item.invoice_number || '').substring(0, 14)],
        [M + 129, `${item.weight || 0} ${weightUnit}`],
        [M + 149, `${(item.value_of_goods || 0).toLocaleString('en-IN')}`],
      ];
      cols2.forEach(([x, text]) => pdf.text(text, x, matRowY + 4.5));
      hRule(M, matRowY + matRowH, matW);
      matRowY += matRowH;
    });

    // Totals / guarantee weight row
    pdf.setFontSize(5.5); pdf.setFont('helvetica', 'bold');
    pdf.text(`TOTAL ARTICLES : ${totalArticles}`, M + 1, matRowY + 4.5);
    pdf.text(`TOTAL WEIGHT : ${actualWeight} ${weightUnit}`, M + 64, matRowY + 4.5);
    pdf.text(`GUARANTEE WEIGHT : ${guaranteeWeight}`, M + 128, matRowY + 4.5);
    hRule(M, matRowY + matRowH, matW);
    matRowY += matRowH;

    // Rate row
    pdf.setFont('helvetica', 'normal');
    pdf.text('RATE :', M + 129, matRowY + 4.5);
    pdf.text(freightFixed ? 'FIXED' : (freightRate ? String(freightRate) : ''), M + 143, matRowY + 4.5);
    hRule(M, matRowY + matRowH, matW);
    matRowY += matRowH;

    // Amount column rows (right side)
    const amtRows: [string, string][] = [
      ['FREIGHT',           freightType === 'TO BE BILLED' ? 'TO BE BILLED' : String(freightAmt)],
      ['HALTING CHARGE',    String(haltingAmt)],
      ['Door To Door Charge', String(doorAmt)],
      ['Service Charge',    String(serviceAmt)],
      ['OTHER CHARGE',      String(otherAmt)],
      ['TOTAL AMOUNT',      String(totalAmt)],
      ['BALANCE AMOUNT',    String(balanceAmt)],
      ['ADVANCE AMOUNT',    String(advanceAmt)],
    ];
    let amtRowY = r4Y + 5;
    const amtRowH = 7;
    amtRows.forEach(([label, val]) => {
      vLine(amtX, amtRowY, amtRowY + amtRowH);
      vLine(W - M, amtRowY, amtRowY + amtRowH);
      pdf.setFontSize(5.5);
      pdf.setFont('helvetica', 'bold');
      pdf.text(label, amtX + 1, amtRowY + 4.5);
      pdf.setFont('helvetica', 'normal');
      pdf.text(val, W - M - 1, amtRowY + 4.5, { align: 'right' });
      hRule(amtX, amtRowY + amtRowH, amtW);
      amtRowY += amtRowH;
    });

    const r4EndY = Math.max(matRowY, amtRowY);
    // Complete borders
    hRule(M, r4EndY, W - 2 * M, 0.4);
    vLine(amtX, r4Y + 5, r4EndY);
    vLine(W - M, r4Y + 5, r4EndY);
    // Left border of material table
    vLine(M, r4Y, r4EndY);

    // ══════════════════════════════════════════════════
    // ROW 5: RECEIVING USE ONLY
    // ══════════════════════════════════════════════════
    const r5Y = r4EndY;
    const r5H = 18;
    hRule(M, r5Y + r5H, W - 2 * M, 0.4);
    vLine(M, r5Y, r5Y + r5H);
    vLine(W - M, r5Y, r5Y + r5H);

    const r5Cols = ['RECEIVING USE ONLY', 'REMARK', 'STATUS', 'AUTHENTICATION'];
    const r5ColW = (W - 2 * M) / r5Cols.length;
    pdf.setFillColor(200, 200, 200);
    pdf.rect(M, r5Y, W - 2 * M, 4.5, 'F');
    pdf.setFontSize(6); pdf.setFont('helvetica', 'bold');
    r5Cols.forEach((label, i) => {
      const rx = M + i * r5ColW;
      pdf.text(label, rx + r5ColW / 2, r5Y + 3.2, { align: 'center' });
      if (i > 0) vLine(rx, r5Y, r5Y + r5H);
    });

    pdf.setFontSize(5.5); pdf.setFont('helvetica', 'normal');
    pdf.text('RECEIVER NAME :', M + 1, r5Y + 8);
    pdf.text('RECEIVER NUMBER :', M + 1, r5Y + 13);
    pdf.text('In Transit', M + r5ColW * 2 + 2, r5Y + 10);
    pdf.text('RECEIVER SIGN', M + r5ColW * 3 + r5ColW / 2, r5Y + 11, { align: 'center' });

    // ══════════════════════════════════════════════════
    // ROW 6: VALUES OF GOODS | REMARK
    // ══════════════════════════════════════════════════
    const r6Y = r5Y + r5H;
    const r6H = 10;
    hRule(M, r6Y + r6H, W - 2 * M, 0.4);
    vLine(M, r6Y, r6Y + r6H);
    vLine(W - M, r6Y, r6Y + r6H);

    const r6Split = Math.floor((W - 2 * M) / 2);
    vLine(M + r6Split, r6Y, r6Y + r6H);
    pdf.setFontSize(6); pdf.setFont('helvetica', 'bold');
    pdf.text(`VALUES OF GOODS : ${totalGoodsValue.toLocaleString('en-IN')}`, M + 1, r6Y + 4.5);
    pdf.text('REMARK :', M + r6Split + 1, r6Y + 4.5);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(5.5);
    pdf.text(
      pdf.splitTextToSize(remarks || narration || '', r6Split - 20),
      M + r6Split + 18, r6Y + 4.5
    );

    // ══════════════════════════════════════════════════
    // ROW 7: BANK ACCOUNT DETAILS + SIGNATURE
    // ══════════════════════════════════════════════════
    const r7Y = r6Y + r6H;
    const r7H = 24;
    hRule(M, r7Y + r7H, W - 2 * M, 0.4);
    vLine(M, r7Y, r7Y + r7H);
    vLine(W - M, r7Y, r7Y + r7H);

    const bankW = Math.floor((W - 2 * M) * 0.65);
    const sigW  = (W - 2 * M) - bankW;
    vLine(M + bankW, r7Y, r7Y + r7H);

    pdf.setFillColor(200, 200, 200);
    pdf.rect(M, r7Y, bankW, 4.5, 'F');
    pdf.setFontSize(6); pdf.setFont('helvetica', 'bold');
    pdf.text('BANK ACCOUNT DETAILS', M + 1, r7Y + 3.2);

    pdf.setFontSize(5.5); pdf.setFont('helvetica', 'normal');
    const bankRows: [string, string][] = [
      [`BANK ACCOUNT NUMBER : ${CO.acc}`,  `A/C HOLDER NAME : ${CO.holder}`],
      [`IFSC CODE :         ${CO.ifsc}`,   `BANK NAME :  ${CO.bank}`],
      [`PAN CARD NAME :`,                  `PAN CARD NUMBER :  ${CO.pan}`],
      [`BRANCH OFFICE ADDRESS : ${CO.branch}`, ''],
    ];
    let bankRowY = r7Y + 7;
    bankRows.forEach(([left, right]) => {
      pdf.text(left, M + 1, bankRowY);
      if (right) pdf.text(right, M + bankW / 2 + 2, bankRowY);
      bankRowY += 4;
    });

    // Signature block
    const sigX = M + bankW;
    pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold');
    pdf.text(`FOR, ${CO.name}`, sigX + sigW / 2, r7Y + 6, { align: 'center' });
    hRule(sigX + 4, r7Y + 17, sigW - 8);
    pdf.setFontSize(5.5); pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 180);
    pdf.text('AUTHORIZE SIGNATURE', sigX + sigW / 2, r7Y + 21, { align: 'center' });
    pdf.setTextColor(0, 0, 0);

    // ══════════════════════════════════════════════════
    // ROW 8: Electronic note
    // ══════════════════════════════════════════════════
    const r8Y = r7Y + r7H;
    const now = new Date();
    pdf.setFontSize(5.5); pdf.setFont('helvetica', 'italic'); pdf.setTextColor(80, 80, 80);
    pdf.text(
      `This electronic generated pdf does not require any physical signature.  Date : ${now.toLocaleDateString('en-IN')} ${now.toLocaleTimeString('en-IN')}`,
      M + 1, r8Y + 4
    );
    pdf.setTextColor(0, 0, 0);
  };

  // ─── TERMS & CONDITIONS PAGE ─────────────────────────────────────────────────
  const drawTermsPage = () => {
    // Outer border
    pdf.setLineWidth(0.8);
    pdf.setDrawColor(0, 0, 0);
    pdf.rect(M, M, W - 2 * M, H - 2 * M);

    // Header
    pdf.setFontSize(14); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(210, 20, 20);
    pdf.text(CO.name, W / 2, 15, { align: 'center' });
    pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(0, 0, 0);
    pdf.text(CO.tagline, W / 2, 21, { align: 'center' });
    pdf.text(CO.address, W / 2, 26, { align: 'center' });

    pdf.setLineWidth(0.4);
    pdf.line(M, 30, W - M, 30);

    pdf.setFontSize(11); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(0, 0, 0);
    pdf.text('TERMS AND CONDITIONS', W / 2, 38, { align: 'center' });

    pdf.setLineWidth(0.4);
    pdf.line(M, 41, W - M, 41);

    const terms = [
      '1.  JURISDICTION: All disputes shall be subject to AHMEDABAD jurisdiction only.',
      '2.  LIABILITY: The company shall not be liable for any loss, damage, or delay caused due to acts of God, government restrictions, strikes, fires, floods, or any other circumstances beyond the control of the company.',
      '3.  INSURANCE: Unless specifically requested and paid for, goods are carried at owner\'s risk. The company does not provide insurance coverage unless separately agreed upon in writing. In case of insurance, the claim shall be payable only as per the insured amount and policy terms.',
      '4.  DELIVERY: Goods will be delivered to the consignee or authorized representative only. The company is not responsible for goods delivered to unauthorized persons due to misrepresentation.',
      '5.  CLAIMS: Any claim for shortage, damage, or loss must be reported in writing within 24 hours of delivery. Claims after 24 hours will not be entertained by the company.',
      '6.  DETENTION / DEMURRAGE: Detention charges will be levied as per the schedule mentioned on the front of this document. The consignor/consignee is responsible for providing adequate loading/unloading facilities.',
      '7.  FREIGHT PAYMENT: Freight charges are due and payable as per the terms mentioned on the face of this receipt. Delay in payment will attract interest at 18% per annum from the due date.',
      '8.  DANGEROUS GOODS: The consignor must declare all dangerous goods. The company reserves the right to refuse carriage of goods that are not properly declared or packaged as per the applicable regulations.',
      '9.  PROHIBITED ITEMS: The company will not transport any items that are illegal, counterfeit, hazardous without proper declaration, or prohibited by applicable laws and regulations.',
      '10. RE-ROUTING: The company reserves the right to re-route consignments for operational reasons without prior notice, provided delivery timelines are not significantly impacted.',
      '11. FORCE MAJEURE: The company shall not be held responsible for delays or non-delivery due to circumstances beyond its control, including but not limited to natural disasters, civil unrest, government actions, or road blockages.',
      '12. INDEMNITY: The consignor/consignee agrees to indemnify and hold harmless the company from any claims, damages, or liabilities arising from incorrect or incomplete information provided at the time of booking.',
      '13. RISK OF TRANSIT: The consignor shall bear all risks of damage or deterioration in respect of goods of a perishable nature, goods that may be affected by temperature or weather conditions.',
      '14. GOVERNING LAW: This consignment note shall be governed by the laws of India, particularly the Carriage by Road Act, 2007, and the related legislations in force from time to time.',
      '15. ENTIRE AGREEMENT: This consignment note, together with these terms and conditions, constitutes the entire agreement between the parties with respect to the carriage of goods described herein.',
    ];

    let termY = 48;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    terms.forEach(term => {
      const lines = pdf.splitTextToSize(term, W - 2 * M - 8);
      if (termY + lines.length * 4.5 > H - 20) return; // avoid overflow
      pdf.text(lines, M + 4, termY);
      termY += lines.length * 4.5 + 2;
    });

    // Footer signature
    pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(0, 0, 0);
    pdf.text(`FOR ${CO.name}`, W - M - 4, H - M - 16, { align: 'right' });
    pdf.setLineWidth(0.3);
    pdf.line(W - M - 52, H - M - 12, W - M - 4, H - M - 12);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Authorised Signatory', W - M - 4, H - M - 8, { align: 'right' });

    pdf.setFontSize(5.5); pdf.setFont('helvetica', 'italic'); pdf.setTextColor(80, 80, 80);
    const now = new Date();
    pdf.text(
      `This electronic generated pdf does not require any physical signature.  Date : ${now.toLocaleDateString('en-IN')} ${now.toLocaleTimeString('en-IN')}`,
      M + 1, H - M - 4
    );
    pdf.setTextColor(0, 0, 0);
  };

  // ─── Render all 5 pages ──────────────────────────────────────────────────────
  const copies = [
    'CONSIGNOR COPY',
    'CONSIGNEE COPY',
    'TRANSPORTER COPY',
    'DRIVER COPY',
  ];

  for (let i = 0; i < copies.length; i++) {
    if (i > 0) pdf.addPage();
    await drawCopyPage(copies[i]);
  }

  // Page 5: Terms & Conditions
  pdf.addPage();
  drawTermsPage();

  // ─── Save or preview ─────────────────────────────────────────────────────────
  const filename = `BILTY_${lrNum.replace(/[^a-zA-Z0-9]/g, '_')}_BRC_INFRA.pdf`;
  if (options?.preview) {
    return pdf.output('datauristring');
  } else {
    pdf.save(filename);
  }
};
