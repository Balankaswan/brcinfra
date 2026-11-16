/**
 * COMPREHENSIVE BILL FIX SCRIPT
 * 
 * Uses the EXCEL data (all_527_excel_rows_complete.json) as the SINGLE SOURCE OF TRUTH
 * to fix ALL bills in ALL 3 databases:
 * - test, brc_transport, BrcInfra
 * 
 * Key fixes:
 * 1. Bill amounts = SUM of bill_amt column for all LRs under same bill number
 * 2. GST = igst/cgst/sgst from the Excel row (taken from row that has non-zero values)
 * 3. gross_invoice_amount = bill_amount + igst + cgst + sgst
 * 4. All linked LR numbers properly listed
 * 5. Bill /282 = ₹2,00,000 (not ₹10,00,000)
 * 6. Bill /11 = ₹1,21,000 (5 LRs)
 */

const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');

const MONGO_URI = 'mongodb+srv://Brc-ShivanshTrailorTransport:shivansh4854@shivanshtrailortranspor.bw0ptox.mongodb.net/';
const DATABASES = ['test', 'brc_transport', 'BrcInfra'];

// Load Excel rows
const excelRows = JSON.parse(fs.readFileSync('/tmp/all_527_excel_rows_complete.json', 'utf8'));
// Format: [sr, date, lr_no, party_col_I, party_col_H, from, to, vehicle, supplier, bill_no, bill_amt, igst, cgst, sgst, memo_no, broker, freight, mamul]

// Build correct bill mapping from Excel
function buildBillMapping() {
  const bills = {};

  for (const r of excelRows) {
    if (!r || r.length < 10) continue;
    const billNo = r[9];
    if (!billNo || billNo === 'N/A' || billNo === null) continue;

    const lrNo = String(r[2]);
    const billAmt = parseFloat(r[10]) || 0;
    const igst = parseFloat(r[11]) || 0;
    const cgst = parseFloat(r[12]) || 0;
    const sgst = parseFloat(r[13]) || 0;
    const partyName = (r[4] && r[4] !== 'NOT MENTIONED') ? r[4] : (r[3] || 'NOT MENTIONED');
    const date = r[1];

    if (!bills[billNo]) {
      bills[billNo] = {
        bill_number: billNo,
        party_name: partyName,
        bill_date: date,
        lrs: [],
        total_bill_amt: 0,
        igst: 0,
        cgst: 0,
        sgst: 0
      };
    }

    // Add LR if not already there
    if (!bills[billNo].lrs.includes(lrNo)) {
      bills[billNo].lrs.push(lrNo);
      bills[billNo].total_bill_amt += billAmt;
    }

    // Take GST from first row that has it (GST only appears in one row per bill)
    if (igst > 0 && bills[billNo].igst === 0) bills[billNo].igst = igst;
    if (cgst > 0 && bills[billNo].cgst === 0) bills[billNo].cgst = cgst;
    if (sgst > 0 && bills[billNo].sgst === 0) bills[billNo].sgst = sgst;

    // Update party if currently NOT MENTIONED
    if (bills[billNo].party_name === 'NOT MENTIONED' && partyName !== 'NOT MENTIONED') {
      bills[billNo].party_name = partyName;
    }
  }

  // Calculate gross invoice
  for (const key in bills) {
    const b = bills[key];
    b.gross_invoice = b.total_bill_amt + b.igst + b.cgst + b.sgst;
    b.gst_total = b.igst + b.cgst + b.sgst;
  }

  return bills;
}

async function fixDatabase(dbName, client, billMapping) {
  const db = client.db(dbName);
  const billsCol = db.collection('bills');
  const lrsCol = db.collection('loading_slips');

  console.log(`\n=== Processing ${dbName} ===`);

  // Get all LRs to find their ObjectIds
  const allLRs = await lrsCol.find({}, { projection: { lr_number: 1, _id: 1, bill_number: 1 } }).toArray();
  const lrByNumber = {};
  for (const lr of allLRs) {
    const lrNum = String(lr.lr_number);
    lrByNumber[lrNum] = lr;
  }
  console.log(`Found ${allLRs.length} LRs in DB`);

  // Get all existing bills
  const existingBills = await billsCol.find({}, { projection: { bill_number: 1, bill_amount: 1, gross_invoice_amount: 1, loading_slip_ids: 1 } }).toArray();
  const billByNumber = {};
  for (const b of existingBills) {
    if (b.bill_number) billByNumber[b.bill_number] = b;
  }
  console.log(`Found ${existingBills.length} bills in DB`);

  let updated = 0;
  let inserted = 0;
  let errors = 0;
  const wrongAmountBills = [];

  for (const [billNo, mapping] of Object.entries(billMapping)) {
    try {
      // Find linked LR ObjectIds
      const linkedLRIds = [];
      const linkedLRNumbers = mapping.lrs;
      
      for (const lrNum of mapping.lrs) {
        if (lrByNumber[lrNum]) {
          linkedLRIds.push(lrByNumber[lrNum]._id);
        }
      }

      const updateData = {
        bill_amount: mapping.total_bill_amt,
        igst_amount: mapping.igst,
        cgst_amount: mapping.cgst,
        sgst_amount: mapping.sgst,
        gst_amount: mapping.gst_total,
        gross_invoice_amount: mapping.gross_invoice,
        net_amount: mapping.gross_invoice,  // TDS=0
        tds_amount: 0,
        loading_slip_ids: linkedLRIds,
        linked_lr_numbers: linkedLRNumbers,
        trip_count: mapping.lrs.length,
        party_name: mapping.party_name,
        updated_at: new Date()
      };

      if (billByNumber[billNo]) {
        // Update existing bill
        const existing = billByNumber[billNo];
        const existingAmt = existing.bill_amount || 0;
        const correctAmt = mapping.total_bill_amt;
        
        if (Math.abs(existingAmt - correctAmt) > 1 || (existing.loading_slip_ids || []).length !== linkedLRIds.length) {
          wrongAmountBills.push({
            bill: billNo,
            existingAmt,
            correctAmt,
            existingLRs: (existing.loading_slip_ids || []).length,
            correctLRs: linkedLRIds.length
          });
        }

        await billsCol.updateOne(
          { _id: existing._id },
          { $set: updateData }
        );
        updated++;
      } else {
        // Insert new bill
        const newBill = {
          bill_number: billNo,
          bill_date: mapping.bill_date ? new Date(mapping.bill_date.split('-').reverse().join('-')) : new Date(),
          ...updateData,
          payment_status: 'pending',
          amount_received: 0,
          advances: 0,
          remarks: '',
          created_at: new Date()
        };
        await billsCol.insertOne(newBill);
        inserted++;
        console.log(`  ✅ Inserted new bill: ${billNo}`);
      }
    } catch (err) {
      console.error(`  ❌ Error processing ${billNo}:`, err.message);
      errors++;
    }
  }

  console.log(`\n${dbName} Results:`);
  console.log(`  Updated: ${updated} bills`);
  console.log(`  Inserted: ${inserted} new bills`);
  console.log(`  Errors: ${errors}`);
  
  if (wrongAmountBills.length > 0) {
    console.log(`\n  Bills with WRONG amounts (now fixed):`);
    for (const w of wrongAmountBills.slice(0, 20)) {
      console.log(`    ${w.bill}: was ₹${w.existingAmt.toLocaleString('en-IN')} → now ₹${w.correctAmt.toLocaleString('en-IN')} | LRs: ${w.existingLRs} → ${w.correctLRs}`);
    }
    if (wrongAmountBills.length > 20) {
      console.log(`    ... and ${wrongAmountBills.length - 20} more`);
    }
  }

  // Verify totals after update
  const totalAfter = await billsCol.aggregate([
    { $group: { _id: null, totalBill: { $sum: '$bill_amount' }, totalGross: { $sum: '$gross_invoice_amount' }, count: { $sum: 1 } } }
  ]).toArray();
  
  if (totalAfter.length > 0) {
    const t = totalAfter[0];
    console.log(`\n  ${dbName} TOTALS AFTER FIX:`);
    console.log(`    Total Bills: ${t.count}`);
    console.log(`    Total Bill Amount: ₹${t.totalBill.toLocaleString('en-IN')}`);
    console.log(`    Total Gross Invoice: ₹${t.totalGross.toLocaleString('en-IN')}`);
  }

  return { updated, inserted, errors };
}

async function main() {
  const billMapping = buildBillMapping();
  
  console.log('\n=== EXCEL BILL MAPPING SUMMARY ===');
  console.log(`Total unique bills from Excel: ${Object.keys(billMapping).length}`);
  
  let totalGross = 0;
  let totalBill = 0;
  for (const b of Object.values(billMapping)) {
    totalBill += b.total_bill_amt;
    totalGross += b.gross_invoice;
  }
  console.log(`Total Bill Amount: ₹${totalBill.toLocaleString('en-IN')}`);
  console.log(`Total Gross Invoice: ₹${totalGross.toLocaleString('en-IN')}`);
  
  // Show key bills
  const keyBills = ['AHD/2026-27/11', 'AHD/2026-27/282', 'AHD/2026-27/26', 'AHD/2026-27/27', 'AHD/2026-27/185'];
  console.log('\nKey bill amounts from Excel:');
  for (const k of keyBills) {
    if (billMapping[k]) {
      const b = billMapping[k];
      console.log(`  ${k}: LRs=[${b.lrs.join(',')}], bill_amt=₹${b.total_bill_amt.toLocaleString('en-IN')}, gross=₹${b.gross_invoice.toLocaleString('en-IN')}`);
    }
  }

  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log('\n✅ Connected to MongoDB Atlas');

    for (const dbName of DATABASES) {
      await fixDatabase(dbName, client, billMapping);
    }

    console.log('\n\n✅ ALL DATABASES FIXED SUCCESSFULLY!');
    
  } catch (err) {
    console.error('Fatal error:', err);
  } finally {
    await client.close();
  }
}

main();
