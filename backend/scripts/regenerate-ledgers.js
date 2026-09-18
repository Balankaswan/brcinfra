import mongoose from 'mongoose';
import Bill from '../models/Bill.js';
import BankingEntry from '../models/BankingEntry.js';
import CashbookEntry from '../models/CashbookEntry.js';
import LedgerEntry from '../models/LedgerEntry.js';
import PartyCommissionLedger from '../models/PartyCommissionLedger.js';
import Party from '../models/Party.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/brc_transport';

async function regenerateLedgers() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // 1. Regenerate Party Commission Ledger from Bills
    console.log('🔄 Regenerating Party Commission Ledger from Bills...');
    const bills = await Bill.find({ party_commission_cut: { $gt: 0 } });
    
    for (const bill of bills) {
      const party = await Party.findOne({ name: bill.party });
      if (party) {
        const commissionEntry = new PartyCommissionLedger({
          party_id: party._id,
          party_name: bill.party,
          bill_id: bill._id,
          bill_number: bill.bill_number,
          reference_id: bill.bill_number,
          entry_type: 'credit',
          amount: bill.party_commission_cut,
          narration: `Commission Cut – Bill No. ${bill.bill_number}`,
          date: bill.date || new Date()
        });
        await commissionEntry.save();
        console.log(`✅ Bill ${bill.bill_number}: ₹${bill.party_commission_cut}`);
      }
    }

    // 2. Regenerate General/Vehicle Ledger from Banking
    console.log('🔄 Regenerating Ledger from Banking Entries...');
    const bankingEntries = await BankingEntry.find({});
    
    for (const entry of bankingEntries) {
      if (entry.category === 'party_commission' || entry.category === 'party_on_account') continue;
      
      let ledgerType = 'general';
      let referenceName = entry.reference_name || entry.category || 'Bank Transaction';
      let referenceId = entry._id;
      
      if (entry.category === 'vehicle_expense' && entry.vehicle_no) {
        ledgerType = 'vehicle_expense';
        referenceName = `Vehicle ${entry.vehicle_no} - Bank Expense`;
        referenceId = entry.vehicle_no;
      }
      
      const ledgerEntry = new LedgerEntry({
        referenceId: referenceId,
        reference_id: entry._id.toString(),
        ledger_type: ledgerType,
        reference_name: referenceName,
        source_type: 'banking',
        type: entry.type === 'debit' ? 'expense' : 'payment',
        date: entry.date,
        description: entry.narration || `Bank ${entry.type} - ${entry.category}`,
        debit: entry.type === 'debit' ? entry.amount : 0,
        credit: entry.type === 'credit' ? entry.amount : 0,
        balance: 0,
        vehicle_no: entry.vehicle_no || undefined,
      });
      
      await ledgerEntry.save();
    }

    // 3. Regenerate from Cashbook
    console.log('🔄 Regenerating Ledger from Cashbook Entries...');
    const cashbookEntries = await CashbookEntry.find({});
    
    for (const entry of cashbookEntries) {
      if (entry.category === 'party_commission' || entry.category === 'party_on_account') continue;
      
      let ledgerType = 'general';
      let referenceName = entry.reference_name || entry.category || 'Cash Transaction';
      let referenceId = entry._id;
      
      if (entry.category === 'vehicle_expense' && entry.vehicle_no) {
        ledgerType = 'vehicle_expense';
        referenceName = `Vehicle ${entry.vehicle_no} - Cash Expense`;
        referenceId = entry.vehicle_no;
      }
      
      const ledgerEntry = new LedgerEntry({
        referenceId: referenceId,
        reference_id: entry._id.toString(),
        ledger_type: ledgerType,
        reference_name: referenceName,
        source_type: 'cashbook',
        type: entry.type === 'debit' ? 'expense' : 'payment',
        date: entry.date,
        description: entry.narration || `Cash ${entry.type} - ${entry.category}`,
        debit: entry.type === 'debit' ? entry.amount : 0,
        credit: entry.type === 'credit' ? entry.amount : 0,
        balance: 0,
        vehicle_no: entry.vehicle_no || undefined,
      });
      
      await ledgerEntry.save();
    }

    console.log('✅ Ledger regeneration completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error regenerating ledgers:', error);
    process.exit(1);
  }
}

regenerateLedgers();
