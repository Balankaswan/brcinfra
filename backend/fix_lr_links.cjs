// Check collection names in each DB and fix loading_slip_ids
const { MongoClient } = require('mongodb');
const fs = require('fs');

const MONGO_URI = 'mongodb+srv://Brc-ShivanshTrailorTransport:shivansh4854@shivanshtrailortranspor.bw0ptox.mongodb.net/';
const DATABASES = ['test', 'brc_transport', 'BrcInfra'];

const excelRows = JSON.parse(fs.readFileSync('/tmp/all_527_excel_rows_complete.json', 'utf8'));

// Build bill->LRs mapping
const billToLRs = {};
for (const r of excelRows) {
  if (!r || r.length < 10) continue;
  const billNo = r[9];
  if (!billNo || billNo === 'N/A') continue;
  const lrNo = String(r[2]);
  if (!billToLRs[billNo]) billToLRs[billNo] = [];
  if (!billToLRs[billNo].includes(lrNo)) billToLRs[billNo].push(lrNo);
}

async function fixLinkedLRs(dbName, client) {
  const db = client.db(dbName);
  
  // List all collections
  const collections = await db.listCollections().toArray();
  console.log(`\n${dbName} collections:`, collections.map(c => c.name).join(', '));
  
  // Find the LRs collection
  let lrColName = null;
  for (const c of collections) {
    if (c.name.toLowerCase().includes('loading') || c.name.toLowerCase() === 'lrs') {
      lrColName = c.name;
      break;
    }
  }
  
  if (!lrColName) {
    console.log(`  ❌ No LRs collection found in ${dbName}`);
    return;
  }
  
  console.log(`  LRs collection: ${lrColName}`);
  const lrsCol = db.collection(lrColName);
  const billsCol = db.collection('bills');
  
  // Get sample LR to understand field names
  const sampleLR = await lrsCol.findOne({});
  if (sampleLR) {
    console.log(`  LR fields: ${Object.keys(sampleLR).join(', ')}`);
  }
  
  // Get all LRs indexed by lr_number
  const allLRs = await lrsCol.find({}, { projection: { lr_number: 1, _id: 1 } }).toArray();
  const lrByNum = {};
  for (const lr of allLRs) {
    lrByNum[String(lr.lr_number)] = lr._id;
  }
  console.log(`  Found ${allLRs.length} LRs`);
  
  // Update bills with correct loading_slip_ids
  let updated = 0;
  for (const [billNo, lrNums] of Object.entries(billToLRs)) {
    const linkedIds = lrNums.map(n => lrByNum[n]).filter(id => id);
    if (linkedIds.length > 0) {
      await billsCol.updateOne(
        { bill_number: billNo },
        { $set: { loading_slip_ids: linkedIds, linked_lr_numbers: lrNums, trip_count: lrNums.length } }
      );
      updated++;
    }
  }
  console.log(`  Updated ${updated} bills with LR links`);
  
  // Verify bill /11
  const bill11 = await billsCol.findOne({ bill_number: 'AHD/2026-27/11' });
  if (bill11) {
    console.log(`  Bill /11: amount=₹${bill11.bill_amount?.toLocaleString('en-IN')}, gross=₹${bill11.gross_invoice_amount?.toLocaleString('en-IN')}, LRs=${bill11.loading_slip_ids?.length || 0}, lr_numbers=${JSON.stringify(bill11.linked_lr_numbers)}`);
  }
  
  // Verify bill /282
  const bill282 = await billsCol.findOne({ bill_number: 'AHD/2026-27/282' });
  if (bill282) {
    console.log(`  Bill /282: amount=₹${bill282.bill_amount?.toLocaleString('en-IN')}, gross=₹${bill282.gross_invoice_amount?.toLocaleString('en-IN')}, LRs=${bill282.loading_slip_ids?.length || 0}`);
  }
}

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    console.log('✅ Connected');
    for (const dbName of DATABASES) {
      await fixLinkedLRs(dbName, client);
    }
    console.log('\n✅ DONE!');
  } finally {
    await client.close();
  }
}

main();
