// Find ALL bills from Excel that are MISSING from the DB
const { MongoClient } = require('mongodb');
const fs = require('fs');

const MONGO_URI = 'mongodb+srv://Brc-ShivanshTrailorTransport:shivansh4854@shivanshtrailortranspor.bw0ptox.mongodb.net/';
const excelRows = JSON.parse(fs.readFileSync('/tmp/all_527_excel_rows_complete.json', 'utf8'));

// Build all unique bill numbers from Excel
const excelBills = {};
for (const r of excelRows) {
  if (!r || r.length < 10) continue;
  const billNo = r[9];
  if (!billNo || billNo === 'N/A' || billNo === null) continue;
  const lrNo = String(r[2]);
  const billAmt = parseFloat(r[10]) || 0;
  const igst = parseFloat(r[11]) || 0;
  const cgst = parseFloat(r[12]) || 0;
  const sgst = parseFloat(r[13]) || 0;
  const party = (r[4] && r[4] !== 'NOT MENTIONED') ? r[4] : (r[3] || 'NOT MENTIONED');
  const date = r[1];

  if (!excelBills[billNo]) {
    excelBills[billNo] = { bill_number: billNo, lrs: [], total_bill_amt: 0, igst: 0, cgst: 0, sgst: 0, party, date };
  }
  if (!excelBills[billNo].lrs.includes(lrNo)) {
    excelBills[billNo].lrs.push(lrNo);
    excelBills[billNo].total_bill_amt += billAmt;
  }
  if (igst > 0 && excelBills[billNo].igst === 0) excelBills[billNo].igst = igst;
  if (cgst > 0 && excelBills[billNo].cgst === 0) excelBills[billNo].cgst = cgst;
  if (sgst > 0 && excelBills[billNo].sgst === 0) excelBills[billNo].sgst = sgst;
}

console.log('=== EXCEL BILLS SUMMARY ===');
console.log('Total unique bills in Excel:', Object.keys(excelBills).length);

// Show all bills for AEGIOS CERA LLP
console.log('\n=== AEGIOS CERA LLP BILLS IN EXCEL ===');
for (const [k, v] of Object.entries(excelBills)) {
  if (v.party.includes('AEGIOS')) {
    const gross = v.total_bill_amt + v.igst + v.cgst + v.sgst;
    console.log(`  ${k}: LRs=${v.lrs.join(',')}, bill_amt=₹${v.total_bill_amt.toLocaleString('en-IN')}, gross=₹${gross.toLocaleString('en-IN')}`);
  }
}

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db('test');
    const billsCol = db.collection('bills');
    const lrsCol = db.collection('loadingslips');

    // Get all bills from DB
    const dbBills = await billsCol.find({}, { projection: { bill_number: 1, bill_amount: 1, gross_invoice_amount: 1, party_name: 1, loading_slip_ids: 1 } }).toArray();
    const dbBillNumbers = new Set(dbBills.map(b => b.bill_number));
    console.log('\n=== DB STATE ===');
    console.log('Total bills in DB (test):', dbBills.length);

    // Find MISSING bills
    const missingBills = Object.entries(excelBills).filter(([k]) => !dbBillNumbers.has(k));
    console.log('\n=== MISSING BILLS (in Excel but NOT in DB) ===');
    console.log('Count:', missingBills.length);
    for (const [k, v] of missingBills.sort()) {
      const gross = v.total_bill_amt + v.igst + v.cgst + v.sgst;
      console.log(`  ${k}: LRs=[${v.lrs.join(',')}], bill_amt=₹${v.total_bill_amt.toLocaleString('en-IN')}, gross=₹${gross.toLocaleString('en-IN')}, party=${v.party}`);
    }

    // Find AEGIOS bills in DB
    console.log('\n=== AEGIOS CERA LLP BILLS IN DB ===');
    const aegiosBills = dbBills.filter(b => b.party_name && b.party_name.includes('AEGIOS'));
    for (const b of aegiosBills) {
      console.log(`  ${b.bill_number}: bill_amt=₹${b.bill_amount?.toLocaleString('en-IN')}, gross=₹${b.gross_invoice_amount?.toLocaleString('en-IN')}, LRs=${b.loading_slip_ids?.length || 0}`);
    }
    if (aegiosBills.length === 0) {
      console.log('  NO AEGIOS BILLS FOUND IN DB!');
      // Check by searching for bill numbers that have AEGIOS in excel
      const aegiosKeys = Object.keys(excelBills).filter(k => excelBills[k].party.includes('AEGIOS'));
      console.log('  AEGIOS bill numbers in Excel:', aegiosKeys.join(', '));
      for (const k of aegiosKeys) {
        const dbBill = dbBills.find(b => b.bill_number === k);
        if (dbBill) {
          console.log(`    ${k} EXISTS in DB as party: ${dbBill.party_name}`);
        } else {
          console.log(`    ${k} MISSING from DB!`);
        }
      }
    }

    // Get all LRs indexed by lr_number for linking
    const allLRs = await lrsCol.find({}, { projection: { lr_number: 1, _id: 1 } }).toArray();
    const lrByNum = {};
    for (const lr of allLRs) lrByNum[String(lr.lr_number)] = lr._id;

    if (missingBills.length > 0) {
      console.log('\n=== CREATING MISSING BILLS ===');
      let created = 0;
      for (const [billNo, mapping] of missingBills) {
        const gstTotal = mapping.igst + mapping.cgst + mapping.sgst;
        const grossInvoice = mapping.total_bill_amt + gstTotal;
        const linkedIds = mapping.lrs.map(n => lrByNum[n]).filter(id => id);
        
        const dateStr = mapping.date; // format: DD-MM-YYYY
        let billDate = new Date();
        if (dateStr) {
          const parts = dateStr.split('-');
          if (parts.length === 3) {
            billDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
          }
        }

        const newBill = {
          bill_number: billNo,
          bill_date: billDate,
          party_name: mapping.party,
          bill_amount: mapping.total_bill_amt,
          igst_amount: mapping.igst,
          cgst_amount: mapping.cgst,
          sgst_amount: mapping.sgst,
          gst_amount: gstTotal,
          gross_invoice_amount: grossInvoice,
          net_amount: grossInvoice,
          tds_amount: 0,
          loading_slip_ids: linkedIds,
          linked_lr_numbers: mapping.lrs,
          trip_count: mapping.lrs.length,
          payment_status: 'pending',
          amount_received: 0,
          advances: 0,
          remarks: '',
          created_at: new Date(),
          updated_at: new Date()
        };

        // Insert into all 3 DBs
        for (const dbName of ['test', 'brc_transport', 'BrcInfra']) {
          try {
            const targetDb = client.db(dbName);
            const targetBills = targetDb.collection('bills');
            const targetLRs = targetDb.collection('loadingslips');
            
            // Check if already exists
            const exists = await targetBills.findOne({ bill_number: billNo });
            if (!exists) {
              // Get LR IDs for this specific DB
              const dbLRs = await targetLRs.find({ lr_number: { $in: mapping.lrs.map(n => parseInt(n)) } }, { projection: { lr_number: 1, _id: 1 } }).toArray();
              const dbLrByNum = {};
              for (const lr of dbLRs) dbLrByNum[String(lr.lr_number)] = lr._id;
              const dbLinkedIds = mapping.lrs.map(n => dbLrByNum[n]).filter(id => id);
              
              await targetBills.insertOne({ ...newBill, loading_slip_ids: dbLinkedIds, _id: undefined });
              console.log(`  ✅ Created ${billNo} in ${dbName} (LRs: ${mapping.lrs.join(',')}, ₹${grossInvoice.toLocaleString('en-IN')})`);
              created++;
            } else {
              console.log(`  ℹ️  ${billNo} already exists in ${dbName}`);
            }
          } catch(e) {
            console.log(`  ❌ Error creating ${billNo} in ${dbName}: ${e.message}`);
          }
        }
      }
      console.log(`\nCreated ${created} new bill records across all DBs`);
    }

    // Final count
    const finalCount = await db.collection('bills').countDocuments();
    const finalTotal = await db.collection('bills').aggregate([
      { $group: { _id: null, total: { $sum: '$gross_invoice_amount' }, count: { $sum: 1 } } }
    ]).toArray();
    console.log(`\n=== FINAL STATE (test DB) ===`);
    console.log(`Total bills: ${finalCount}`);
    if (finalTotal[0]) {
      console.log(`Total Gross Invoice: ₹${finalTotal[0].total.toLocaleString('en-IN')}`);
    }

  } finally {
    await client.close();
  }
}

main();
