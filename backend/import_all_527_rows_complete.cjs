/**
 * import_all_527_rows_complete.cjs
 * 
 * Imports and synchronizes all 527 rows (including the previously missing 65 rows SR 365, 392-455)
 * across LoadingSlips, Memos, and Bills into MongoDB Atlas:
 * - BILL:
 *     Column K = BILL AMOUNT (summed for multi-LR bills)
 *     Columns L, M, N = IGST, CGST, SGST
 *     Gross Invoice = Bill Amount + IGST + CGST + SGST
 *     TDS = 0 (Do NOT auto-deduct TDS!)
 *     Net Amount = Gross Invoice
 * - LR:
 *     freight_amount / total_amount = Column K (BILL AMOUNT)
 *     freight = Column X (Supplier Freight)
 * - MEMO:
 *     Column X = FREIGHT
 *     Column Z = MAMUL
 *     Net Amount = Freight - Mamul
 */

const fs = require('fs');
const mongoose = require('mongoose');

const rawRows = JSON.parse(fs.readFileSync('/tmp/all_527_excel_rows_complete.json', 'utf8'));
console.log(`Loaded ${rawRows.length} rows from complete Excel export.`);

const MONGODB_BASE = 'mongodb+srv://Brc-ShivanshTrailorTransport:shivansh4854@shivanshtrailortranspor.bw0ptox.mongodb.net/';
const TARGET_DBS = ['test', 'brc_transport', 'BrcInfra'];

function parseDate(d) {
  if (!d || d === 'NA') return new Date('2026-04-01');
  const p = String(d).trim().split('-');
  if (p.length === 3) return new Date(`${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`);
  return new Date('2026-04-01');
}

async function syncDb(dbName) {
  const uri = `${MONGODB_BASE}${dbName}?appName=SHIVANSHTRAILORTRANSPORT&retryWrites=true&w=majority`;
  console.log(`\n========================================`);
  console.log(`Connecting to ${dbName}...`);
  const conn = await mongoose.createConnection(uri).asPromise();
  const db = conn.db;

  // 1. Process LoadingSlips
  console.log(`Synchronizing Loading Slips (${rawRows.length} rows)...`);
  const lrOps = [];
  for (const r of rawRows) {
    const sr = r[0];
    const date = parseDate(r[1]);
    const lrNo = String(r[2]).trim();
    const slipNumber = `LR-${lrNo}`;
    const consignor = String(r[3] || 'NOT MENTIONED').trim();
    const consignee = String(r[4] || 'NOT MENTIONED').trim();
    const fromLoc = String(r[5] || 'NOT MENTIONED').trim();
    const toLoc = String(r[6] || 'NOT MENTIONED').trim();
    const vehicle = String(r[7] || 'NOT MENTIONED').trim();
    const party = String(r[8] || 'NOT MENTIONED').trim();
    const billNo = String(r[9] || '').trim();
    const billAmt = parseFloat(r[10]) || 0;
    const memoNo = String(r[14] || '').trim();
    const broker = String(r[15] || 'NOT MENTIONED').trim();
    const freight = parseFloat(r[16]) || 0;
    const mamool = parseFloat(r[17]) || 0;

    lrOps.push({
      updateOne: {
        filter: { slip_number: slipNumber },
        update: {
          $set: {
            slip_number: slipNumber,
            lr_number: lrNo,
            date: date,
            party: party,
            consignor_name: consignor,
            consignee_name: consignee,
            from_location: fromLoc,
            to_location: toLoc,
            vehicle_no: vehicle,
            bill_number: billNo,
            memo_number: memoNo,
            supplier: broker,
            freight: freight,
            freight_amount: billAmt,
            total_amount: billAmt,
            balance_amount: billAmt,
            updatedAt: new Date()
          },
          $setOnInsert: {
            material: 'NOT MENTIONED',
            weight: 0,
            advance: 0,
            balance: freight,
            rto: 0,
            total_freight: freight,
            createdAt: new Date()
          }
        },
        upsert: true
      }
    });
  }

  const lrRes = await db.collection('loadingslips').bulkWrite(lrOps, { ordered: false });
  console.log(`Loading Slips: matched ${lrRes.matchedCount}, modified ${lrRes.modifiedCount}, upserted ${lrRes.upsertedCount}`);

  // Fetch all LoadingSlips to get their _id mapping
  const allSlips = await db.collection('loadingslips').find({}, { projection: { slip_number: 1, lr_number: 1 } }).toArray();
  const slipMap = {};
  for (const s of allSlips) {
    slipMap[s.slip_number] = s._id;
    slipMap[s.lr_number] = s._id;
  }

  // 2. Process Memos
  console.log(`Synchronizing Memos...`);
  const memoOps = [];
  const processedMemos = new Set();

  for (const r of rawRows) {
    const memoNo = String(r[14] || '').trim();
    if (!memoNo || memoNo === 'NA' || processedMemos.has(memoNo)) continue;
    processedMemos.add(memoNo);

    const lrNo = String(r[2]).trim();
    const slipId = slipMap[`LR-${lrNo}`] || slipMap[lrNo];
    const date = parseDate(r[1]);
    const broker = String(r[15] || 'NOT MENTIONED').trim();
    const freight = parseFloat(r[16]) || 0;
    const mamool = parseFloat(r[17]) || 0;
    const netAmount = freight - mamool;

    memoOps.push({
      updateOne: {
        filter: { memo_number: memoNo },
        update: {
          $set: {
            memo_number: memoNo,
            loading_slip_id: slipId,
            date: date,
            supplier: broker,
            freight: freight,
            mamool: mamool,
            commission: 0,
            detention: 0,
            extra: 0,
            rto: 0,
            deduction: 0,
            net_amount: netAmount,
            status: 'pending',
            updatedAt: new Date()
          },
          $setOnInsert: {
            advance_payments: [],
            is_downloaded: false,
            createdAt: new Date()
          }
        },
        upsert: true
      }
    });
  }

  const memoRes = await db.collection('memos').bulkWrite(memoOps, { ordered: false });
  console.log(`Memos: matched ${memoRes.matchedCount}, modified ${memoRes.modifiedCount}, upserted ${memoRes.upsertedCount}`);

  // 3. Process Bills
  console.log(`Synchronizing Bills...`);
  const billGroups = {};
  for (const r of rawRows) {
    const bno = String(r[9] || '').trim();
    if (!bno || bno === 'NA') continue;

    if (!billGroups[bno]) {
      billGroups[bno] = {
        bill_number: bno,
        date: parseDate(r[1]),
        party: String(r[8] || 'NOT MENTIONED').trim(),
        bill_amount: 0,
        igst: 0,
        cgst: 0,
        sgst: 0,
        lrs: []
      };
    }
    billGroups[bno].bill_amount += (parseFloat(r[10]) || 0);
    billGroups[bno].igst = Math.max(billGroups[bno].igst, parseFloat(r[11]) || 0);
    billGroups[bno].cgst = Math.max(billGroups[bno].cgst, parseFloat(r[12]) || 0);
    billGroups[bno].sgst = Math.max(billGroups[bno].sgst, parseFloat(r[13]) || 0);
    billGroups[bno].lrs.push(String(r[2]).trim());
  }

  const billOps = [];
  for (const [bno, data] of Object.entries(billGroups)) {
    const totalGst = data.igst + data.cgst + data.sgst;
    const grossInvoice = data.bill_amount + totalGst;
    const linkedSlips = data.lrs.map(l => `LR-${l}`);
    const slipIds = linkedSlips.map(s => slipMap[s]).filter(Boolean);

    billOps.push({
      updateOne: {
        filter: { bill_number: bno },
        update: {
          $set: {
            bill_number: bno,
            date: data.date,
            party: data.party,
            party_name: data.party,
            loading_slip_id: slipIds[0] || null,
            loading_slip_ids: slipIds,
            linked_lr_numbers: linkedSlips,
            bill_amount: data.bill_amount,
            igst_amount: data.igst,
            cgst_amount: data.cgst,
            sgst_amount: data.sgst,
            gst_amount: totalGst,
            taxable_value: data.bill_amount,
            gross_invoice_amount: grossInvoice,
            total_invoice_value: grossInvoice,
            mamool: 0,
            tds: 0,
            penalties: 0,
            net_amount: grossInvoice,
            status: 'pending',
            updatedAt: new Date()
          },
          $setOnInsert: {
            detention: 0,
            extra: 0,
            rto: 0,
            advance_payments: [],
            is_downloaded: false,
            createdAt: new Date()
          }
        },
        upsert: true
      }
    });
  }

  const billRes = await db.collection('bills').bulkWrite(billOps, { ordered: false });
  console.log(`Bills: matched ${billRes.matchedCount}, modified ${billRes.modifiedCount}, upserted ${billRes.upsertedCount}`);

  // Check counts
  const finalSlips = await db.collection('loadingslips').countDocuments();
  const finalMemos = await db.collection('memos').countDocuments();
  const finalBills = await db.collection('bills').countDocuments();
  console.log(`\nFinal Counts in ${dbName}:`);
  console.log(`  Loading Slips: ${finalSlips}`);
  console.log(`  Memos:         ${finalMemos}`);
  console.log(`  Bills:         ${finalBills}`);

  await conn.close();
}

async function main() {
  for (const db of TARGET_DBS) {
    try {
      await syncDb(db);
    } catch (e) {
      console.error(`Error syncing ${db}:`, e);
    }
  }
  console.log('\nAll databases synced successfully!');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
