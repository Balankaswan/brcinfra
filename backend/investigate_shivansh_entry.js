import dotenv from 'dotenv';
import mongoose from 'mongoose';
import BankingEntry from './models/BankingEntry.js';
import LedgerEntry from './models/LedgerEntry.js';
import Memo from './models/Memo.js';
import Supplier from './models/Supplier.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/brc_management';

async function investigateShivanshEntry() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Find the specific entry
        console.log('🔍 Finding the ₹70,000 entry from Nov 6, 2025...\n');
        const bankingEntry = await BankingEntry.findOne({
            amount: 70000,
            date: new Date('2025-11-06')
        });

        if (!bankingEntry) {
            console.log('❌ Entry not found!');
            return;
        }

        console.log('✅ FOUND BANKING ENTRY:');
        console.log('='.repeat(70));
        console.log(`   ID: ${bankingEntry._id}`);
        console.log(`   Date: ${bankingEntry.date}`);
        console.log(`   Category: ${bankingEntry.category}`);
        console.log(`   Type: ${bankingEntry.type}`);
        console.log(`   Amount: ₹${bankingEntry.amount.toLocaleString('en-IN')}`);
        console.log(`   Reference Name: ${bankingEntry.reference_name}`);
        console.log(`   Reference ID (Memo): ${bankingEntry.reference_id}`);
        console.log(`   Narration: ${bankingEntry.narration}`);
        console.log('='.repeat(70));

        // Check if ledger entry exists
        console.log('\n🔍 Checking for Ledger Entry...');
        const ledgerEntry = await LedgerEntry.findOne({
            reference_id: bankingEntry._id.toString(),
            source_type: 'banking'
        });

        if (ledgerEntry) {
            console.log('✅ LEDGER ENTRY EXISTS:');
            console.log(`   ID: ${ledgerEntry._id}`);
            console.log(`   Ledger Type: ${ledgerEntry.ledger_type}`);
            console.log(`   Reference Name: ${ledgerEntry.reference_name}`);
            console.log(`   Debit: ₹${ledgerEntry.debit}`);
            console.log(`   Credit: ₹${ledgerEntry.credit}`);
            console.log(`   Description: ${ledgerEntry.description}`);
        } else {
            console.log('❌ NO LEDGER ENTRY FOUND!');
            console.log('   This is the problem - the ledger entry is missing.');
        }

        // Find the memo
        if (bankingEntry.reference_id) {
            console.log('\n🔍 Checking Memo...');
            const memo = await Memo.findOne({ memo_number: bankingEntry.reference_id });

            if (memo) {
                console.log('✅ MEMO FOUND:');
                console.log(`   Memo Number: ${memo.memo_number}`);
                console.log(`   Supplier: ${memo.supplier}`);
                console.log(`   Net Amount: ₹${memo.net_amount.toLocaleString('en-IN')}`);
                console.log(`   Advance Payments: ${memo.advance_payments?.length || 0}`);
            } else {
                console.log('❌ MEMO NOT FOUND!');
            }
        }

        // Check all suppliers with similar names
        console.log('\n🔍 Checking Supplier Names...');
        const suppliers = await Supplier.find({
            name: new RegExp('SHIVANSH', 'i')
        });

        console.log(`   Found ${suppliers.length} suppliers with "SHIVANSH":`);
        for (const supplier of suppliers) {
            console.log(`      - ${supplier.name}`);

            // Check ledger entries for this supplier
            const ledgerCount = await LedgerEntry.countDocuments({
                ledger_type: 'supplier',
                reference_name: supplier.name
            });
            console.log(`        Ledger entries: ${ledgerCount}`);
        }

        // Check if there are ledger entries with the wrong name
        console.log('\n🔍 Checking for ledger entries with TRAILOR spelling...');
        const trailorLedgers = await LedgerEntry.find({
            reference_name: new RegExp('SHIVANSH TRAILOR', 'i'),
            ledger_type: 'supplier'
        });

        console.log(`   Found ${trailorLedgers.length} ledger entries with "TRAILOR" spelling`);
        for (const entry of trailorLedgers) {
            console.log(`      ${entry.date} | ${entry.description} | Debit: ₹${entry.debit} | Credit: ₹${entry.credit}`);
        }

        console.log('\n' + '='.repeat(70));
        console.log('📊 DIAGNOSIS SUMMARY:');
        console.log('='.repeat(70));
        console.log(`Banking Entry: ${bankingEntry ? '✅ EXISTS' : '❌ MISSING'}`);
        console.log(`Ledger Entry: ${ledgerEntry ? '✅ EXISTS' : '❌ MISSING'}`);
        console.log(`Supplier Name in Banking: ${bankingEntry.reference_name}`);
        console.log('\n💡 LIKELY ISSUE:');
        if (!ledgerEntry) {
            console.log('   The banking entry exists but NO ledger entry was created.');
            console.log('   This happened because the entry was created BEFORE the fix.');
            console.log('   Solution: Run the migration script or manually create the ledger entry.');
        }
        console.log('='.repeat(70));

    } catch (error) {
        console.error('❌ Investigation failed:', error);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
}

investigateShivanshEntry();
