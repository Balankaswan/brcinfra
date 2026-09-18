import dotenv from 'dotenv';
import mongoose from 'mongoose';
import BankingEntry from './models/BankingEntry.js';
import CashbookEntry from './models/CashbookEntry.js';
import LedgerEntry from './models/LedgerEntry.js';
import Memo from './models/Memo.js';
import Bill from './models/Bill.js';
import Supplier from './models/Supplier.js';
import Party from './models/Party.js';

// Load environment variables
dotenv.config();

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/brc_management';

async function fixMissingAdvanceLedgerEntries() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        let createdCount = 0;
        let skippedCount = 0;

        // ========================================
        // Fix Banking Memo Advances
        // ========================================
        console.log('\n📋 Processing Banking Memo Advances...');
        const bankingMemoAdvances = await BankingEntry.find({ category: 'memo_advance' });
        console.log(`Found ${bankingMemoAdvances.length} banking memo advance entries`);

        for (const bankingEntry of bankingMemoAdvances) {
            if (!bankingEntry.reference_id) {
                console.log(`⚠️  Skipping banking entry ${bankingEntry._id} - no reference_id`);
                skippedCount++;
                continue;
            }

            // Check if ledger entry already exists
            const existingLedger = await LedgerEntry.findOne({
                reference_id: bankingEntry._id.toString(),
                source_type: 'banking',
                ledger_type: 'supplier'
            });

            if (existingLedger) {
                console.log(`⏭️  Ledger entry already exists for banking memo advance ${bankingEntry._id}`);
                skippedCount++;
                continue;
            }

            // Find the memo
            const memo = await Memo.findOne({ memo_number: bankingEntry.reference_id });
            if (!memo) {
                console.log(`❌ Memo not found for reference_id: ${bankingEntry.reference_id}`);
                skippedCount++;
                continue;
            }

            // Find the supplier
            const supplier = await Supplier.findOne({ name: memo.supplier });
            if (!supplier) {
                console.log(`❌ Supplier not found: ${memo.supplier}`);
                skippedCount++;
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
                description: `Memo Advance (Banking) – Memo No ${memo.memo_number}`,
                narration: bankingEntry.narration || `Memo Advance (Banking) – Memo No ${memo.memo_number}`,
                debit: bankingEntry.amount,
                credit: 0,
                balance: 0,
                memo_number: memo.memo_number,
                memo_id: memo._id,
                supplier_id: supplier._id
            });

            await supplierLedgerEntry.save();
            console.log(`✅ Created supplier ledger entry for banking memo advance ${bankingEntry._id}`);
            createdCount++;
        }

        // ========================================
        // Fix Cashbook Memo Advances
        // ========================================
        console.log('\n📋 Processing Cashbook Memo Advances...');
        const cashbookMemoAdvances = await CashbookEntry.find({ category: 'memo_advance' });
        console.log(`Found ${cashbookMemoAdvances.length} cashbook memo advance entries`);

        for (const cashbookEntry of cashbookMemoAdvances) {
            if (!cashbookEntry.reference_id) {
                console.log(`⚠️  Skipping cashbook entry ${cashbookEntry._id} - no reference_id`);
                skippedCount++;
                continue;
            }

            // Check if ledger entry already exists
            const existingLedger = await LedgerEntry.findOne({
                reference_id: cashbookEntry._id.toString(),
                source_type: 'cashbook',
                ledger_type: 'supplier'
            });

            if (existingLedger) {
                console.log(`⏭️  Ledger entry already exists for cashbook memo advance ${cashbookEntry._id}`);
                skippedCount++;
                continue;
            }

            // Find the memo
            const memo = await Memo.findOne({ memo_number: cashbookEntry.reference_id });
            if (!memo) {
                console.log(`❌ Memo not found for reference_id: ${cashbookEntry.reference_id}`);
                skippedCount++;
                continue;
            }

            // Find the supplier
            const supplier = await Supplier.findOne({ name: memo.supplier });
            if (!supplier) {
                console.log(`❌ Supplier not found: ${memo.supplier}`);
                skippedCount++;
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
                description: `Memo Advance (Cash) – Memo No ${memo.memo_number}`,
                narration: cashbookEntry.narration || `Memo Advance (Cash) – Memo No ${memo.memo_number}`,
                debit: cashbookEntry.amount,
                credit: 0,
                balance: 0,
                memo_number: memo.memo_number,
                memo_id: memo._id,
                supplier_id: supplier._id
            });

            await supplierLedgerEntry.save();
            console.log(`✅ Created supplier ledger entry for cashbook memo advance ${cashbookEntry._id}`);
            createdCount++;
        }

        // ========================================
        // Fix Banking Bill Advances
        // ========================================
        console.log('\n📋 Processing Banking Bill Advances...');
        const bankingBillAdvances = await BankingEntry.find({ category: 'bill_advance' });
        console.log(`Found ${bankingBillAdvances.length} banking bill advance entries`);

        for (const bankingEntry of bankingBillAdvances) {
            if (!bankingEntry.reference_id) {
                console.log(`⚠️  Skipping banking entry ${bankingEntry._id} - no reference_id`);
                skippedCount++;
                continue;
            }

            // Check if ledger entry already exists
            const existingLedger = await LedgerEntry.findOne({
                reference_id: bankingEntry._id.toString(),
                source_type: 'banking',
                ledger_type: 'party'
            });

            if (existingLedger) {
                console.log(`⏭️  Ledger entry already exists for banking bill advance ${bankingEntry._id}`);
                skippedCount++;
                continue;
            }

            // Find the bill
            const bill = await Bill.findOne({ bill_number: bankingEntry.reference_id });
            if (!bill) {
                console.log(`❌ Bill not found for reference_id: ${bankingEntry.reference_id}`);
                skippedCount++;
                continue;
            }

            // Find the party
            const party = await Party.findOne({ name: bill.party });
            if (!party) {
                console.log(`❌ Party not found: ${bill.party}`);
                skippedCount++;
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
                description: `Bill Advance (Banking) – Bill No ${bill.bill_number}`,
                narration: bankingEntry.narration || `Bill Advance (Banking) – Bill No ${bill.bill_number}`,
                debit: 0,
                credit: bankingEntry.amount,
                balance: 0,
                bill_number: bill.bill_number,
                bill_id: bill._id,
                party_id: party._id
            });

            await partyLedgerEntry.save();
            console.log(`✅ Created party ledger entry for banking bill advance ${bankingEntry._id}`);
            createdCount++;
        }

        // ========================================
        // Fix Cashbook Bill Advances
        // ========================================
        console.log('\n📋 Processing Cashbook Bill Advances...');
        const cashbookBillAdvances = await CashbookEntry.find({ category: 'bill_advance' });
        console.log(`Found ${cashbookBillAdvances.length} cashbook bill advance entries`);

        for (const cashbookEntry of cashbookBillAdvances) {
            if (!cashbookEntry.reference_id) {
                console.log(`⚠️  Skipping cashbook entry ${cashbookEntry._id} - no reference_id`);
                skippedCount++;
                continue;
            }

            // Check if ledger entry already exists
            const existingLedger = await LedgerEntry.findOne({
                reference_id: cashbookEntry._id.toString(),
                source_type: 'cashbook',
                ledger_type: 'party'
            });

            if (existingLedger) {
                console.log(`⏭️  Ledger entry already exists for cashbook bill advance ${cashbookEntry._id}`);
                skippedCount++;
                continue;
            }

            // Find the bill
            const bill = await Bill.findOne({ bill_number: cashbookEntry.reference_id });
            if (!bill) {
                console.log(`❌ Bill not found for reference_id: ${cashbookEntry.reference_id}`);
                skippedCount++;
                continue;
            }

            // Find the party
            const party = await Party.findOne({ name: bill.party });
            if (!party) {
                console.log(`❌ Party not found: ${bill.party}`);
                skippedCount++;
                continue;
            }

            // Create party ledger entry
            const partyLedgerEntry = new LedgerEntry({
                referenceId: party._id,
                reference_id: cashbookEntry._id.toString(),
                ledger_type: 'party',
                reference_name: bill.party,
                source_type: 'cashbook',
                type: 'payment',
                date: cashbookEntry.date,
                description: `Bill Advance (Cash) – Bill No ${bill.bill_number}`,
                narration: cashbookEntry.narration || `Bill Advance (Cash) – Bill No ${bill.bill_number}`,
                debit: 0,
                credit: cashbookEntry.amount,
                balance: 0,
                bill_number: bill.bill_number,
                bill_id: bill._id,
                party_id: party._id
            });

            await partyLedgerEntry.save();
            console.log(`✅ Created party ledger entry for cashbook bill advance ${cashbookEntry._id}`);
            createdCount++;
        }

        // ========================================
        // Summary
        // ========================================
        console.log('\n' + '='.repeat(60));
        console.log('✅ Migration Complete!');
        console.log(`   Created: ${createdCount} new ledger entries`);
        console.log(`   Skipped: ${skippedCount} entries (already exist or missing data)`);
        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
}

// Run the migration
fixMissingAdvanceLedgerEntries();
