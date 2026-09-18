import dotenv from 'dotenv';
import mongoose from 'mongoose';
import BankingEntry from './models/BankingEntry.js';
import CashbookEntry from './models/CashbookEntry.js';
import LedgerEntry from './models/LedgerEntry.js';
import Memo from './models/Memo.js';
import Supplier from './models/Supplier.js';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/brc_management';

async function diagnoseMissingEntries() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        const targetSupplier = 'SHIVANSH TRAILER TRANSPORT';
        const targetDate = '2025-11-06';
        const targetAmount = 70000;

        console.log('🔍 SEARCHING FOR MISSING ENTRY:');
        console.log(`   Supplier: ${targetSupplier}`);
        console.log(`   Date: ${targetDate}`);
        console.log(`   Amount: ₹${targetAmount.toLocaleString('en-IN')}`);
        console.log('='.repeat(70));

        // Search in Banking Entries
        console.log('\n📋 1. Checking Banking Entries...');
        const bankingEntries = await BankingEntry.find({
            $or: [
                { reference_name: new RegExp(targetSupplier, 'i') },
                { narration: new RegExp(targetSupplier, 'i') }
            ],
            date: { $gte: new Date('2025-11-05'), $lte: new Date('2025-11-07') }
        });

        console.log(`   Found ${bankingEntries.length} banking entries around that date`);
        for (const entry of bankingEntries) {
            console.log(`\n   📄 Banking Entry ID: ${entry._id}`);
            console.log(`      Date: ${entry.date}`);
            console.log(`      Category: ${entry.category}`);
            console.log(`      Type: ${entry.type}`);
            console.log(`      Amount: ₹${entry.amount.toLocaleString('en-IN')}`);
            console.log(`      Reference Name: ${entry.reference_name || 'N/A'}`);
            console.log(`      Reference ID: ${entry.reference_id || 'N/A'}`);
            console.log(`      Narration: ${entry.narration || 'N/A'}`);

            // Check if ledger entry exists for this banking entry
            const ledgerEntry = await LedgerEntry.findOne({
                reference_id: entry._id.toString(),
                source_type: 'banking'
            });
            console.log(`      Ledger Entry: ${ledgerEntry ? '✅ EXISTS' : '❌ MISSING'}`);

            if (ledgerEntry) {
                console.log(`         Ledger Type: ${ledgerEntry.ledger_type}`);
                console.log(`         Debit: ₹${ledgerEntry.debit}`);
                console.log(`         Credit: ₹${ledgerEntry.credit}`);
            }
        }

        // Search in Cashbook Entries
        console.log('\n📋 2. Checking Cashbook Entries...');
        const cashbookEntries = await CashbookEntry.find({
            $or: [
                { reference_name: new RegExp(targetSupplier, 'i') },
                { narration: new RegExp(targetSupplier, 'i') }
            ],
            date: { $gte: new Date('2025-11-05'), $lte: new Date('2025-11-07') }
        });

        console.log(`   Found ${cashbookEntries.length} cashbook entries around that date`);
        for (const entry of cashbookEntries) {
            console.log(`\n   📄 Cashbook Entry ID: ${entry._id}`);
            console.log(`      Date: ${entry.date}`);
            console.log(`      Category: ${entry.category}`);
            console.log(`      Type: ${entry.type}`);
            console.log(`      Amount: ₹${entry.amount.toLocaleString('en-IN')}`);
            console.log(`      Reference Name: ${entry.reference_name || 'N/A'}`);
            console.log(`      Reference ID: ${entry.reference_id || 'N/A'}`);
            console.log(`      Narration: ${entry.narration || 'N/A'}`);

            // Check if ledger entry exists for this cashbook entry
            const ledgerEntry = await LedgerEntry.findOne({
                reference_id: entry._id.toString(),
                source_type: 'cashbook'
            });
            console.log(`      Ledger Entry: ${ledgerEntry ? '✅ EXISTS' : '❌ MISSING'}`);

            if (ledgerEntry) {
                console.log(`         Ledger Type: ${ledgerEntry.ledger_type}`);
                console.log(`         Debit: ₹${ledgerEntry.debit}`);
                console.log(`         Credit: ₹${ledgerEntry.credit}`);
            }
        }

        // Search in Memos
        console.log('\n📋 3. Checking Memos...');
        const memos = await Memo.find({
            supplier: new RegExp(targetSupplier, 'i'),
            date: { $gte: new Date('2025-11-05'), $lte: new Date('2025-11-07') }
        });

        console.log(`   Found ${memos.length} memos around that date`);
        for (const memo of memos) {
            console.log(`\n   📄 Memo: ${memo.memo_number}`);
            console.log(`      Date: ${memo.date}`);
            console.log(`      Supplier: ${memo.supplier}`);
            console.log(`      Freight: ₹${memo.freight.toLocaleString('en-IN')}`);
            console.log(`      Net Amount: ₹${memo.net_amount.toLocaleString('en-IN')}`);
            console.log(`      Advance Payments: ${memo.advance_payments?.length || 0}`);

            // Check if ledger entry exists for this memo
            const ledgerEntry = await LedgerEntry.findOne({
                memo_number: memo.memo_number,
                ledger_type: 'supplier'
            });
            console.log(`      Ledger Entry: ${ledgerEntry ? '✅ EXISTS' : '❌ MISSING'}`);
        }

        // Check all supplier ledger entries for this supplier
        console.log('\n📋 4. All Supplier Ledger Entries for ' + targetSupplier + '...');
        const allLedgerEntries = await LedgerEntry.find({
            ledger_type: 'supplier',
            reference_name: new RegExp(targetSupplier, 'i')
        }).sort({ date: 1 });

        console.log(`   Total ledger entries: ${allLedgerEntries.length}`);
        for (const entry of allLedgerEntries) {
            console.log(`\n   📄 ${entry.date} | ${entry.description}`);
            console.log(`      Debit: ₹${entry.debit} | Credit: ₹${entry.credit}`);
            console.log(`      Source: ${entry.source_type} | Ref ID: ${entry.reference_id}`);
        }

        // Search for ANY entries with amount 70000 around that date
        console.log('\n📋 5. Searching for ANY ₹70,000 entries around Nov 6, 2025...');

        const banking70k = await BankingEntry.find({
            amount: 70000,
            date: { $gte: new Date('2025-11-01'), $lte: new Date('2025-11-30') }
        });

        const cashbook70k = await CashbookEntry.find({
            amount: 70000,
            date: { $gte: new Date('2025-11-01'), $lte: new Date('2025-11-30') }
        });

        console.log(`   Banking entries with ₹70,000: ${banking70k.length}`);
        for (const entry of banking70k) {
            console.log(`      ${entry.date} | ${entry.category} | ${entry.reference_name || entry.narration}`);
        }

        console.log(`   Cashbook entries with ₹70,000: ${cashbook70k.length}`);
        for (const entry of cashbook70k) {
            console.log(`      ${entry.date} | ${entry.category} | ${entry.reference_name || entry.narration}`);
        }

        console.log('\n' + '='.repeat(70));
        console.log('✅ Diagnosis Complete!');
        console.log('='.repeat(70));

    } catch (error) {
        console.error('❌ Diagnosis failed:', error);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
}

diagnoseMissingEntries();
