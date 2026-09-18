import dotenv from 'dotenv';
import mongoose from 'mongoose';
import BankingEntry from './models/BankingEntry.js';
import CashbookEntry from './models/CashbookEntry.js';
import LedgerEntry from './models/LedgerEntry.js';
import Memo from './models/Memo.js';
import Supplier from './models/Supplier.js';

// Load environment variables
dotenv.config();

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/brc_management';

async function testAdvanceLedgerMapping() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Test 1: Check for any existing memo advances
        console.log('📋 Test 1: Checking for existing memo advances...');
        const bankingMemoAdvances = await BankingEntry.find({ category: 'memo_advance' });
        const cashbookMemoAdvances = await CashbookEntry.find({ category: 'memo_advance' });

        console.log(`   Banking memo advances: ${bankingMemoAdvances.length}`);
        console.log(`   Cashbook memo advances: ${cashbookMemoAdvances.length}`);

        // Test 2: Check if ledger entries exist for these advances
        if (bankingMemoAdvances.length > 0 || cashbookMemoAdvances.length > 0) {
            console.log('\n📋 Test 2: Checking ledger entries for advances...');

            for (const advance of bankingMemoAdvances) {
                const ledgerEntry = await LedgerEntry.findOne({
                    reference_id: advance._id.toString(),
                    source_type: 'banking',
                    ledger_type: 'supplier'
                });

                console.log(`   Banking advance ${advance._id}:`);
                console.log(`      Reference: ${advance.reference_id}`);
                console.log(`      Amount: ₹${advance.amount}`);
                console.log(`      Ledger entry exists: ${ledgerEntry ? '✅ YES' : '❌ NO'}`);

                if (ledgerEntry) {
                    console.log(`      Ledger debit: ₹${ledgerEntry.debit}`);
                    console.log(`      Supplier: ${ledgerEntry.reference_name}`);
                }
            }

            for (const advance of cashbookMemoAdvances) {
                const ledgerEntry = await LedgerEntry.findOne({
                    reference_id: advance._id.toString(),
                    source_type: 'cashbook',
                    ledger_type: 'supplier'
                });

                console.log(`   Cashbook advance ${advance._id}:`);
                console.log(`      Reference: ${advance.reference_id}`);
                console.log(`      Amount: ₹${advance.amount}`);
                console.log(`      Ledger entry exists: ${ledgerEntry ? '✅ YES' : '❌ NO'}`);

                if (ledgerEntry) {
                    console.log(`      Ledger debit: ₹${ledgerEntry.debit}`);
                    console.log(`      Supplier: ${ledgerEntry.reference_name}`);
                }
            }
        }

        // Test 3: Show sample supplier ledger
        console.log('\n📋 Test 3: Sample supplier ledger entries...');
        const suppliers = await Supplier.find().limit(3);

        for (const supplier of suppliers) {
            const ledgerEntries = await LedgerEntry.find({
                ledger_type: 'supplier',
                reference_name: supplier.name
            }).sort({ date: -1 }).limit(5);

            console.log(`\n   Supplier: ${supplier.name}`);
            console.log(`   Recent ledger entries: ${ledgerEntries.length}`);

            for (const entry of ledgerEntries) {
                console.log(`      ${entry.date} | ${entry.description} | Debit: ₹${entry.debit} | Credit: ₹${entry.credit}`);
            }
        }

        // Test 4: Check memos with advances
        console.log('\n📋 Test 4: Checking memos with advance payments...');
        const memosWithAdvances = await Memo.find({
            'advance_payments.0': { $exists: true }
        }).limit(5);

        console.log(`   Memos with advances: ${memosWithAdvances.length}`);

        for (const memo of memosWithAdvances) {
            console.log(`\n   Memo: ${memo.memo_number}`);
            console.log(`   Supplier: ${memo.supplier}`);
            console.log(`   Advance payments: ${memo.advance_payments.length}`);

            for (const advance of memo.advance_payments) {
                console.log(`      ${advance.date} | ₹${advance.amount} | ${advance.mode} | ${advance.description}`);

                // Check if this advance has a corresponding ledger entry
                const refMatch = advance.reference?.match(/Entry: (.+)$/);
                if (refMatch) {
                    const entryId = refMatch[1];
                    const ledgerEntry = await LedgerEntry.findOne({
                        reference_id: entryId,
                        ledger_type: 'supplier',
                        memo_number: memo.memo_number
                    });

                    console.log(`         Ledger entry: ${ledgerEntry ? '✅ EXISTS' : '❌ MISSING'}`);
                }
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ Test Complete!');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
}

// Run the test
testAdvanceLedgerMapping();
