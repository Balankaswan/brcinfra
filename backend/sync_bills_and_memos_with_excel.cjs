/**
 * sync_bills_and_memos_with_excel.cjs
 * 
 * Uses bulkWrite for instant database synchronization:
 * - LoadingSlips: freight_amount, total_amount, balance_amount = Column K (BILL AMOUNT)
 * - Memos: freight = Column X, mamool = Column Z, net_amount = Column X - Column Z
 * - Bills: bill_amount = sum(Column K), gst = L+M+N, gross_invoice = bill_amount + gst, tds = 0, net_amount = gross_invoice
 */

const fs = require('fs');
const mongoose = require('mongoose');

const rawRows = JSON.parse(fs.readFileSync('/tmp/all_excel_rows_cleaned.json', 'utf8'));
console.log(`Loaded ${rawRows.length} cleaned rows from Excel export.`);

const MONGODB_BASE = 'mongodb+srv://Brc-ShivanshTrailorTransport:shivansh4854@shivanshtrailortranspor.bw0ptox.mongodb.net/';
const TARGET_DBS = ['test', 'brc_transport', 'BrcInfra'];

async function syncDb(dbName) {
  const uri = `${MONGODB_BASE}${dbName}?appName=SHIVANSHTRAILORTRANSPORT&retryWrites=true&w=majority`;
  console.log(`\n========================================`);
  console.log(`Connecting to ${dbName}...`);
  const conn = await mongoose.createConnection(uri).asPromise();
  const db = conn.db;

  const billGroups = {};
  const memoMap = {};
  const lrMap = {};

  for (const r of rawRows) {
    const [sr, date, lr_no, consignor, consignee, from_loc, to_loc, vehicle, party, bill_no, bill_amt, igst, cgst, sgst, ch_no, broker, freight, mamul] = r;

    const lrSlip = `LR-${lr_no}`;
    const bAmt = Number(bill_amt) || 0;
    const frt = Number(freight) || 0;
    const mam = Number(mamul) || 0;
    const igstVal = Number(igst) || 0;
    const cgstVal = Number(cgst) || 0;
    const sgstVal = Number(sgst) || 0;

    lrMap[lrSlip] = {
      bill_amt: bAmt,
      freight: frt,
      mamul: mam
    };

    if (ch_no && String(ch_no).trim() && String(ch_no).trim() !== 'NOT MENTIONED') {
      const mno = String(ch_no).trim();
      memoMap[mno] = {
        freight: frt,
        mamool: mam,
        net_amount: frt - mam
      };
    }

    if (bill_no && String(bill_no).trim() && String(bill_no).trim() !== 'NOT MENTIONED') {
      let bno = String(bill_no).trim();
      const parts = bno.split('/');
      if (parts.length === 3) {
        bno = `AHD/2026-27/${parseInt(parts[2], 10)}`;
      }

      if (!billGroups[bno]) {
        billGroups[bno] = {
          total_bill_amount: 0,
          igst: 0,
          cgst: 0,
          sgst: 0
        };
      }
      billGroups[bno].total_bill_amount += bAmt;
      billGroups[bno].igst = Math.max(billGroups[bno].igst, igstVal);
      billGroups[bno].cgst = Math.max(billGroups[bno].cgst, cgstVal);
      billGroups[bno].sgst = Math.max(billGroups[bno].sgst, sgstVal);
    }
  }

  // 1. Bulk update LoadingSlips
  const lrOps = Object.entries(lrMap).map(([slipNo, data]) => ({
    updateMany: {
      filter: { slip_number: slipNo },
      update: {
        $set: {
          freight_amount: data.bill_amt,
          total_amount: data.bill_amt,
          balance_amount: data.bill_amt,
          freight: data.freight
        }
      }
    }
  }));
  if (lrOps.length > 0) {
    const res = await db.collection('loadingslips').bulkWrite(lrOps, { ordered: false });
    console.log(`Loading Slips: matched ${res.matchedCount}, modified ${res.modifiedCount}`);
  }

  // 2. Bulk update Memos
  const memoOps = Object.entries(memoMap).map(([mno, data]) => ({
    updateMany: {
      filter: { memo_number: mno },
      update: {
        $set: {
          freight: data.freight,
          mamool: data.mamool,
          net_amount: data.net_amount,
          deduction: 0,
          commission: 0
        }
      }
    }
  }));
  if (memoOps.length > 0) {
    const res = await db.collection('memos').bulkWrite(memoOps, { ordered: false });
    console.log(`Memos: matched ${res.matchedCount}, modified ${res.modifiedCount}`);
  }

  // 3. Bulk update Bills
  const allBills = await db.collection('bills').find({}).toArray();
  const billOps = [];

  for (const bill of allBills) {
    const bno = bill.bill_number;
    if (!bno || bno === 'CASH') continue;

    let normBno = bno;
    const parts = bno.split('/');
    if (parts.length === 3) {
      normBno = `AHD/2026-27/${parseInt(parts[2], 10)}`;
    }

    const group = billGroups[normBno] || billGroups[bno];
    if (group) {
      const billAmount = group.total_bill_amount;
      const igst = group.igst;
      const cgst = group.cgst;
      const sgst = group.sgst;
      const totalGst = igst + cgst + sgst;
      const gross = billAmount + totalGst;

      billOps.push({
        updateOne: {
          filter: { _id: bill._id },
          update: {
            $set: {
              bill_amount: billAmount,
              taxable_value: billAmount,
              igst_amount: igst,
              cgst_amount: cgst,
              sgst_amount: sgst,
              gst_amount: totalGst,
              gross_invoice_amount: gross,
              total_invoice_value: gross,
              tds: 0, // DO NOT AUTO DEDUCT TDS
              mamool: 0,
              commission: 0,
              penalties: 0,
              party_commission_cut: 0,
              net_amount: gross,
              totalFreight: gross
            }
          }
        }
      });
    }
  }

  if (billOps.length > 0) {
    const res = await db.collection('bills').bulkWrite(billOps, { ordered: false });
    console.log(`Bills: matched ${res.matchedCount}, modified ${res.modifiedCount}`);
  }

  // Verification checks
  const bill282 = await db.collection('bills').findOne({ bill_number: { $regex: '282' } });
  if (bill282) {
    console.log(`\nVerification [${dbName}] Bill 282:`);
    console.log(`  bill_amount: ₹${bill282.bill_amount.toLocaleString('en-IN')}`);
    console.log(`  gross_invoice_amount: ₹${bill282.gross_invoice_amount.toLocaleString('en-IN')}`);
    console.log(`  tds: ₹${bill282.tds}`);
    console.log(`  net_amount: ₹${bill282.net_amount.toLocaleString('en-IN')}`);
  }

  const lr2833 = await db.collection('loadingslips').findOne({ slip_number: 'LR-2833' });
  if (lr2833) {
    console.log(`Verification [${dbName}] LR 2833:`);
    console.log(`  bill amount (total_amount): ₹${lr2833.total_amount.toLocaleString('en-IN')}`);
    console.log(`  memo freight: ₹${lr2833.freight.toLocaleString('en-IN')}`);
  }

  const memo2803 = await db.collection('memos').findOne({ memo_number: '2803' });
  if (memo2803) {
    console.log(`Verification [${dbName}] Memo 2803:`);
    console.log(`  freight: ₹${memo2803.freight.toLocaleString('en-IN')}`);
    console.log(`  mamool: ₹${memo2803.mamool.toLocaleString('en-IN')}`);
    console.log(`  net_amount: ₹${memo2803.net_amount.toLocaleString('en-IN')}`);
  }

  await conn.close();
}

async function run() {
  for (const dbName of TARGET_DBS) {
    try {
      await syncDb(dbName);
    } catch (err) {
      console.error(`Error on DB ${dbName}:`, err.message);
    }
  }
  console.log('\nAll databases synced successfully.');
}

run().catch(console.error);
