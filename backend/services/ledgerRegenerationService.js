import LedgerEntry from '../models/LedgerEntry.js';

/**
 * Regenerate all ledger entries from existing data
 */
export const regenerateLedgers = async () => {
  try {
    console.log('🔄 Starting ledger regeneration...');
    
    const Bill = (await import('../models/Bill.js')).default;
    const BankingEntry = (await import('../models/BankingEntry.js')).default;
    const CashbookEntry = (await import('../models/CashbookEntry.js')).default;
    const Memo = (await import('../models/Memo.js')).default;
    const LoadingSlip = (await import('../models/LoadingSlip.js')).default;
    const Vehicle = (await import('../models/Vehicle.js')).default;
    const Party = (await import('../models/Party.js')).default;

    // Clear existing ledger entries
    await LedgerEntry.deleteMany({});
    console.log('🗑️ Cleared existing ledger entries');

    // Clear existing party commission ledger entries
    const PartyCommissionLedger = (await import('../models/PartyCommissionLedger.js')).default;
    await PartyCommissionLedger.deleteMany({});
    console.log('🗑️ Cleared existing party commission ledger entries');

    let createdCount = 0;

    // Process Banking Entries
    const bankingEntries = await BankingEntry.find({}).sort({ date: 1, created_at: 1 });
    console.log(`📊 Processing ${bankingEntries.length} banking entries...`);

    for (const entry of bankingEntries) {
      let ledgerType = 'general';
      let referenceName = entry.narration || 'Banking Transaction';
      let referenceId = entry._id;
      
      // Handle vehicle expenses specifically
      if (entry.category === 'vehicle_expense' && entry.vehicle_no) {
        ledgerType = 'vehicle_expense';
        referenceName = `Vehicle ${entry.vehicle_no} - Bank Expense`;
        referenceId = entry.vehicle_no;
      } else if (entry.category === 'party_on_account' && entry.reference_name) {
        // Find party by name
        const party = await Party.findOne({ name: entry.reference_name });
        if (party) {
          ledgerType = 'party';
          referenceName = entry.reference_name;
          referenceId = party._id.toString();
        }
      } else if (entry.category === 'party_commission' && entry.reference_name) {
        // Create party commission ledger entry for commission payments
        const PartyCommissionLedger = (await import('../models/PartyCommissionLedger.js')).default;
        const party = await Party.findOne({ name: entry.reference_name });
        if (party) {
          const commissionEntry = new PartyCommissionLedger({
            party_id: party._id,
            party_name: party.name,
            date: entry.date,
            bill_number: '',
            reference_id: entry._id.toString(),
            entry_type: entry.type,
            amount: entry.amount,
            narration: entry.narration || `Commission Payment – Bank Ref #${entry._id.toString().slice(-6)}`,
            banking_entry_id: entry._id,
            reference_type: 'banking'
          });
          await commissionEntry.save();
          createdCount++;
        }
        continue; // Skip creating regular ledger entry
      } else if (entry.category === 'supplier_payment' && entry.reference_name) {
        ledgerType = 'supplier';
        referenceName = entry.reference_name || 'Supplier Transaction';
        referenceId = entry.reference_name || entry._id;
      } else if (entry.category === 'fuel_wallet') {
        continue; // Skip - handled by Fuel system
      } else if (entry.category === 'expense' || entry.category === 'other') {
        // Only these go to General Ledger
        ledgerType = 'general';
        referenceName = entry.narration || 'General Expense';
        referenceId = entry._id;
      }

      const ledgerEntry = new LedgerEntry({
        referenceId: referenceId,
        reference_id: entry._id.toString(),
        ledger_type: ledgerType,
        reference_name: referenceName,
        source_type: 'banking',
        type: entry.type,
        date: entry.date,
        description: entry.narration,
        debit: entry.type === 'debit' ? entry.amount : 0,
        credit: entry.type === 'credit' ? entry.amount : 0,
        vehicle_no: entry.vehicle_no || null,
        created_at: entry.created_at || new Date()
      });

      await ledgerEntry.save();
      createdCount++;
    }

    // Process Cashbook Entries
    const cashbookEntries = await CashbookEntry.find({}).sort({ date: 1, created_at: 1 });
    console.log(`💰 Processing ${cashbookEntries.length} cashbook entries...`);

    for (const entry of cashbookEntries) {
      let ledgerType = 'general';
      let referenceName = entry.narration || 'Cash Transaction';
      let referenceId = entry._id;
      
      // Handle vehicle expenses specifically
      if (entry.category === 'vehicle_expense' && entry.vehicle_no) {
        ledgerType = 'vehicle_expense';
        referenceName = `Vehicle ${entry.vehicle_no} - Cash Expense`;
        referenceId = entry.vehicle_no;
      } else if (entry.category === 'party_commission' && entry.reference_name) {
        // Create party commission ledger entry for commission payments
        const PartyCommissionLedger = (await import('../models/PartyCommissionLedger.js')).default;
        const party = await Party.findOne({ name: entry.reference_name });
        if (party) {
          const commissionEntry = new PartyCommissionLedger({
            party_id: party._id,
            party_name: party.name,
            date: entry.date,
            bill_number: '',
            reference_id: entry._id.toString(),
            entry_type: entry.type,
            amount: entry.amount,
            narration: entry.narration || `Commission Payment – Cash Ref #${entry._id.toString().slice(-6)}`,
            cashbook_entry_id: entry._id,
            reference_type: 'cashbook'
          });
          await commissionEntry.save();
          createdCount++;
        }
        continue; // Skip creating regular ledger entry
      } else if (entry.category === 'supplier_payment' && entry.reference_name) {
        ledgerType = 'supplier';
        referenceName = entry.reference_name || 'Supplier Transaction';
        referenceId = entry.reference_name || entry._id;
      } else if (entry.category === 'fuel_wallet') {
        continue; // Skip - handled by Fuel system
      } else if (entry.category === 'expense' || entry.category === 'other') {
        // Only these go to General Ledger
        ledgerType = 'general';
        referenceName = entry.narration || 'General Expense';
        referenceId = entry._id;
      }

      const ledgerEntry = new LedgerEntry({
        referenceId: referenceId,
        reference_id: entry._id.toString(),
        ledger_type: ledgerType,
        reference_name: referenceName,
        source_type: 'cashbook',
        type: entry.type,
        date: entry.date,
        description: entry.narration,
        debit: entry.type === 'debit' ? entry.amount : 0,
        credit: entry.type === 'credit' ? entry.amount : 0,
        vehicle_no: entry.vehicle_no || null,
        created_at: entry.created_at || new Date()
      });

      await ledgerEntry.save();
      createdCount++;
    }

    // Process Memos for Own Vehicles
    const memos = await Memo.find({}).populate('loading_slip_id').sort({ date: 1, created_at: 1 });
    console.log(`📝 Processing ${memos.length} memos...`);

    for (const memo of memos) {
      if (!memo.loading_slip_id || !memo.loading_slip_id.vehicle_no) {
        console.log(`⚠️ Skipping memo ${memo.memo_number} - no vehicle info`);
        continue;
      }

      // Check if vehicle is own vehicle
      const vehicle = await Vehicle.findOne({ vehicle_no: memo.loading_slip_id.vehicle_no });
      const isOwnVehicle = vehicle?.ownership_type === 'own';

      if (isOwnVehicle) {
        // Create single consolidated entry for the memo (total amount)
        const totalAmount = memo.freight + (memo.detention || 0) + (memo.extra || 0) - (memo.commission || 0) - (memo.mamool || 0);
        
        if (totalAmount > 0) {
          await new LedgerEntry({
            referenceId: memo.loading_slip_id.vehicle_no,
            reference_id: memo._id.toString(),
            ledger_type: 'vehicle_expense',
            reference_name: `Vehicle ${memo.loading_slip_id.vehicle_no} - Memo Credit`,
            source_type: 'memo',
            type: 'payment',
            date: memo.date,
            description: `Memo ${memo.memo_number} - Total Amount (Freight: ₹${memo.freight}, Detention: ₹${memo.detention || 0}, Extra: ₹${memo.extra || 0}, Commission: -₹${memo.commission || 0}, Mamool: -₹${memo.mamool || 0})`,
            debit: 0,
            credit: totalAmount,
            vehicle_no: memo.loading_slip_id.vehicle_no,
            created_at: memo.created_at || new Date()
          }).save();
          createdCount++;
        }

        console.log(`✅ Processed own vehicle memo ${memo.memo_number} for ${memo.loading_slip_id.vehicle_no}`);
      } else {
        // Market vehicle - create supplier ledger entry
        const netAmount = memo.freight - (memo.commission || 0) - (memo.mamool || 0) + (memo.detention || 0) + (memo.extra || 0);
        
        if (netAmount > 0) {
          await new LedgerEntry({
            referenceId: memo.supplier || memo.supplier_id,
            reference_id: memo._id.toString(),
            ledger_type: 'supplier',
            reference_name: memo.supplier || 'Market Vehicle Supplier',
            source_type: 'memo',
            type: 'payment',
            date: memo.date,
            description: `Market vehicle memo ${memo.memo_number} - Amount payable`,
            debit: 0,
            credit: netAmount,
            vehicle_no: memo.loading_slip_id.vehicle_no,
            created_at: memo.created_at || new Date()
          }).save();
          createdCount++;
        }

        console.log(`✅ Processed market vehicle memo ${memo.memo_number} for supplier ${memo.supplier}`);
      }
    }

    // Process Bills for Party Commission Cuts
    const bills = await Bill.find({ party_commission_cut: { $gt: 0 } }).sort({ date: 1, created_at: 1 });
    console.log(`💰 Processing ${bills.length} bills with commission cuts...`);

    for (const bill of bills) {
      const party = await Party.findOne({ name: bill.party });
      if (party && bill.party_commission_cut > 0) {
        const commissionEntry = new PartyCommissionLedger({
          party_id: party._id,
          party_name: party.name,
          date: bill.date,
          bill_number: bill.bill_number,
          reference_id: bill.bill_number,
          entry_type: 'credit',
          amount: bill.party_commission_cut,
          narration: `Commission Cut – Bill No. ${bill.bill_number}`,
          bill_id: bill._id,
          reference_type: 'bill'
        });
        await commissionEntry.save();
        createdCount++;
        console.log(`✅ Created commission cut entry for bill ${bill.bill_number}: ₹${bill.party_commission_cut}`);
      }
    }

    console.log(`✅ Ledger regeneration completed! Created ${createdCount} entries`);
    return { success: true, createdCount };

  } catch (error) {
    console.error('❌ Ledger regeneration failed:', error);
    throw error;
  }
};
