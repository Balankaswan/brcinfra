import dotenv from 'dotenv';
import mongoose from 'mongoose';
import BankingEntry from './models/BankingEntry.js';
import CashbookEntry from './models/CashbookEntry.js';
import LedgerEntry from './models/LedgerEntry.js';
import Memo from './models/Memo.js';
import Bill from './models/Bill.js';
import Supplier from './models/Supplier.js';
import Party from './models/Party.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/brc_management';

async function fixAllMissingLedgerEntries() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        let createdCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        // ========================================
        // Fix Banking Memo Payments (MISSING LEDGER ENTRIES)
        // ========================================
        console.log('📋 1. Processing Banking Memo Payments...');
        const bankingMemoPayments = await BankingEntry.find({ category: 'memo_payment' });
        console.log(`   Found ${bankingMemoPayments.length} banking memo payment entries\n`);

        for (const bankingEntry of bankingMemoPayments) {
            try {
                // Check if ledger entry already exists
                const existingLedger = await LedgerEntry.findOne({
                    reference_id: bankingEntry._id.toString(),
                    source_type: 'banking',
                    ledger_type: 'supplier'
                });

                if (existingLedger) {
                    skippedCount++;
                    continue;
                }

                if (!bankingEntry.reference_id) {
                    console.log(`   ⚠️  Skipping ${bankingEntry._id} - no reference_id (memo number)`);
                    skippedCount++;
                    continue;
                }

                // Find the memo
                const memo = await Memo.findOne({ memo_number: bankingEntry.reference_id });
                if (!memo) {
                    console.log(`   ❌ Memo not found: ${bankingEntry.reference_id}`);
                    errorCount++;
                    continue;
                }

                // Find the supplier
                const supplier = await Supplier.findOne({ name: memo.supplier });
                if (!supplier) {
                    console.log(`   ❌ Supplier not found: ${memo.supplier}`);
                    errorCount++;
                    continue;
                }

                // Create supplier ledger entry
                const supplierLedgerEntry = new LedgerEntry({
                    referenceId: supplier._id,
                    reference_id: bankingEntry._id.toString(),
                    ledger_type: 'supplier',
                    reference_name: memo.supplier,
                    source_type: 'banking',
                    type: 'payment',
                    date: bankingEntry.date,
                    description: `Memo Payment (Banking) – Memo No ${memo.memo_number}`,
                    narration: bankingEntry.narration || `Memo Payment (Banking) – Memo No ${memo.memo_number}`,
                    debit: bankingEntry.amount,
                    credit: 0,
                    balance: 0,
                    memo_number: memo.memo_number,
                    memo_id: memo._id,
                    supplier_id: supplier._id
                });

                await supplierLedgerEntry.save();
                console.log(`   ✅ Created ledger for banking memo payment: ${memo.memo_number} | ₹${bankingEntry.amount.toLocaleString('en-IN')} | ${memo.supplier}`);
                createdCount++;
            } catch (error) {
                console.error(`   ❌ Error processing banking entry ${bankingEntry._id}:`, error.message);
                errorCount++;
            }
        }

        // ========================================
        // Fix Cashbook Memo Payments (MISSING LEDGER ENTRIES)
        // ========================================
        console.log('\n📋 2. Processing Cashbook Memo Payments...');
        const cashbookMemoPayments = await CashbookEntry.find({ category: 'memo_payment' });
        console.log(`   Found ${cashbookMemoPayments.length} cashbook memo payment entries\n`);

        for (const cashbookEntry of cashbookMemoPayments) {
            try {
                // Check if ledger entry already exists
                const existingLedger = await LedgerEntry.findOne({
                    reference_id: cashbookEntry._id.toString(),
                    source_type: 'cashbook',
                    ledger_type: 'supplier'
                });

                if (existingLedger) {
                    skippedCount++;
                    continue;
                }

                if (!cashbookEntry.reference_id) {
                    console.log(`   ⚠️  Skipping ${cashbookEntry._id} - no reference_id (memo number)`);
                    skippedCount++;
                    continue;
                }

                // Find the memo
                const memo = await Memo.findOne({ memo_number: cashbookEntry.reference_id });
                if (!memo) {
                    console.log(`   ❌ Memo not found: ${cashbookEntry.reference_id}`);
                    errorCount++;
                    continue;
                }

                // Find the supplier
                const supplier = await Supplier.findOne({ name: memo.supplier });
                if (!supplier) {
                    console.log(`   ❌ Supplier not found: ${memo.supplier}`);
                    errorCount++;
                    continue;
                }

                // Create supplier ledger entry
                const supplierLedgerEntry = new LedgerEntry({
                    referenceId: supplier._id,
                    reference_id: cashbookEntry._id.toString(),
                    ledger_type: 'supplier',
                    reference_name: memo.supplier,
                    source_type: 'cashbook',
                    type: 'payment',
                    date: cashbookEntry.date,
                    description: `Memo Payment (Cash) – Memo No ${memo.memo_number}`,
                    narration: cashbookEntry.narration || `Memo Payment (Cash) – Memo No ${memo.memo_number}`,
                    debit: cashbookEntry.amount,
                    credit: 0,
                    balance: 0,
                    memo_number: memo.memo_number,
                    memo_id: memo._id,
                    supplier_id: supplier._id
                });

                await supplierLedgerEntry.save();
                console.log(`   ✅ Created ledger for cashbook memo payment: ${memo.memo_number} | ₹${cashbookEntry.amount.toLocaleString('en-IN')} | ${memo.supplier}`);
                createdCount++;
            } catch (error) {
                console.error(`   ❌ Error processing cashbook entry ${cashbookEntry._id}:`, error.message);
                errorCount++;
            }
        }

        // ========================================
        // Fix Banking Bill Payments (MISSING LEDGER ENTRIES)
        // ========================================
        console.log('\n📋 3. Processing Banking Bill Payments...');
        const bankingBillPayments = await BankingEntry.find({ category: 'bill_payment' });
        console.log(`   Found ${bankingBillPayments.length} banking bill payment entries\n`);

        for (const bankingEntry of bankingBillPayments) {
            try {
                // Check if ledger entry already exists
                const existingLedger = await LedgerEntry.findOne({
                    reference_id: bankingEntry._id.toString(),
                    source_type: 'banking',
                    ledger_type: 'party'
                });

                if (existingLedger) {
                    skippedCount++;
                    continue;
                }

                if (!bankingEntry.reference_id) {
                    console.log(`   ⚠️  Skipping ${bankingEntry._id} - no reference_id (bill number)`);
                    skippedCount++;
                    continue;
                }

                // Find the bill
                const bill = await Bill.findOne({ bill_number: bankingEntry.reference_id });
                if (!bill) {
                    console.log(`   ❌ Bill not found: ${bankingEntry.reference_id}`);
                    errorCount++;
                    continue;
                }

                // Find the party
                const party = await Party.findOne({ name: bill.party });
                if (!party) {
                    console.log(`   ❌ Party not found: ${bill.party}`);
                    errorCount++;
                    continue;
                }

                // Create party ledger entry
                const partyLedgerEntry = new LedgerEntry({
                    referenceId: party._id,
                    reference_id: bankingEntry._id.toString(),
                    ledger_type: 'party',
                    reference_name: bill.party,
                    source_type: 'banking',
                    type: 'payment',
                    date: bankingEntry.date,
                    description: `Bill Payment (Banking) – Bill No ${bill.bill_number}`,
                    narration: bankingEntry.narration || `Bill Payment (Banking) – Bill No ${bill.bill_number}`,
                    debit: 0,
                    credit: bankingEntry.amount,
                    balance: 0,
                    bill_number: bill.bill_number,
                    bill_id: bill._id,
                    party_id: party._id
                });

                await partyLedgerEntry.save();
                console.log(`   ✅ Created ledger for banking bill payment: ${bill.bill_number} | ₹${bankingEntry.amount.toLocaleString('en-IN')} | ${bill.party}`);
                createdCount++;
            } catch (error) {
                console.error(`   ❌ Error processing banking bill entry ${bankingEntry._id}:`, error.message);
                errorCount++;
            }
        }

        // ========================================
        // Summary
        // ========================================
        console.log('\n' + '='.repeat(70));
        console.log('✅ FIX COMPLETE!');
        console.log('='.repeat(70));
        console.log(`   ✅ Created: ${createdCount} new ledger entries`);
        console.log(`   ⏭️  Skipped: ${skippedCount} entries (already exist)`);
        console.log(`   ❌ Errors: ${errorCount} entries (missing data)`);
        console.log('='.repeat(70));

        if (createdCount > 0) {
            console.log('\n💡 NEXT STEPS:');
            console.log('   1. Refresh your Supplier Ledger page');
            console.log('   2. The missing entries should now appear');
            console.log('   3. Verify the running balance is correct');
        }

    } catch (error) {
        console.error('❌ Fix failed:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');
    }
}

fixAllMissingLedgerEntries();
