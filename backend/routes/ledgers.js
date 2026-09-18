import express from 'express';
import LedgerEntry from '../models/LedgerEntry.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Disable authentication for all routes temporarily for debugging
router.use((req, res, next) => {
  console.log(`Ledger route: ${req.method} ${req.path}`);
  next(); // Skip authentication completely
});

// Get all ledger entries
router.get('/', async (req, res) => {
  try {
    const { vehicleNo, partyId, supplierId, type, page = 1, limit = 100 } = req.query;

    const filter = {};
    if (vehicleNo) filter.vehicleNo = vehicleNo;
    if (partyId) filter.partyId = partyId;
    if (supplierId) filter.supplierId = supplierId;
    if (type) filter.type = type;

    const ledgerEntries = await LedgerEntry.find(filter)
      .sort({ date: 1, createdAt: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await LedgerEntry.countDocuments(filter);

    // Ensure id field is present for frontend compatibility
    const entriesWithId = ledgerEntries.map(entry => {
      const entryObj = entry.toObject();
      entryObj.id = entryObj._id.toString();
      return entryObj;
    });

    res.json({
      ledgerEntries: entriesWithId,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get ledger entries error:', error);
    res.status(500).json({ message: 'Failed to fetch ledger entries', error: error.message });
  }
});



// Delete all ledger entries (bulk delete)
router.delete('/all', async (req, res) => {
  try {
    const deleteResult = await LedgerEntry.deleteMany({});
    console.log(`🗑️ Bulk deleted ${deleteResult.deletedCount} ledger entries`);

    res.json({
      message: `Successfully deleted ${deleteResult.deletedCount} ledger entries`,
      deletedCount: deleteResult.deletedCount
    });
  } catch (error) {
    console.error('Bulk delete ledger entries error:', error);
    res.status(500).json({ message: 'Failed to delete ledger entries', error: error.message });
  }
});

// Regenerate ledgers from existing data
router.post('/regenerate', async (req, res) => {
  try {
    const Bill = (await import('../models/Bill.js')).default;
    const BankingEntry = (await import('../models/BankingEntry.js')).default;
    const CashbookEntry = (await import('../models/CashbookEntry.js')).default;
    const PartyCommissionLedger = (await import('../models/PartyCommissionLedger.js')).default;
    const Party = (await import('../models/Party.js')).default;

    let count = 0;

    // Regenerate from Bills
    const bills = await Bill.find({ party_commission_cut: { $gt: 0 } });
    for (const bill of bills) {
      const party = await Party.findOne({ name: bill.party });
      if (party) {
        await new PartyCommissionLedger({
          party_id: party._id,
          party_name: bill.party,
          bill_id: bill._id,
          bill_number: bill.bill_number,
          reference_id: bill.bill_number,
          entry_type: 'credit',
          amount: bill.party_commission_cut,
          narration: `Commission Cut – Bill No. ${bill.bill_number}`,
          date: bill.date || new Date()
        }).save();
        count++;
      }
    }

    // Regenerate from Banking
    const bankingEntries = await BankingEntry.find({});
    for (const entry of bankingEntries) {
      let ledgerType = null;
      let referenceName = entry.reference_name || 'Bank Transaction';
      let referenceId = entry._id;

      // Categorize based on banking category
      if (entry.category === 'party_commission') {
        continue; // Skip - handled by Party Commission Ledger
      } else if (entry.category === 'party_on_account') {
        continue; // Skip - handled by Party Ledger separately
      } else if (entry.category === 'bill_advance' || entry.category === 'bill_payment') {
        ledgerType = 'party';
        referenceName = entry.reference_name || 'Party Transaction';
        referenceId = entry.reference_name || entry._id;
      } else if (entry.category === 'memo_advance' || entry.category === 'memo_payment' || entry.category === 'supplier_payment') {
        ledgerType = 'supplier';
        referenceName = entry.reference_name || 'Supplier Transaction';
        referenceId = entry.reference_name || entry._id;
      } else if (entry.category === 'vehicle_expense') {
        if (entry.vehicle_no) {
          ledgerType = 'vehicle_expense';
          referenceName = `Vehicle ${entry.vehicle_no} - Bank Expense`;
          referenceId = entry.vehicle_no;
        }
      } else if (entry.category === 'fuel_wallet') {
        continue; // Skip - handled by Fuel system
      } else if (entry.category === 'expense' || entry.category === 'other') {
        // Only these go to General Ledger
        ledgerType = 'general';
        referenceName = entry.reference_name || 'General Transaction';
        referenceId = entry._id;
      } else {
        // Unknown categories go to general for now
        ledgerType = 'general';
        referenceName = entry.reference_name || 'General Transaction';
        referenceId = entry._id;
      }

      // Skip if no ledger type assigned
      if (!ledgerType) continue;

      await new LedgerEntry({
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
      }).save();
      count++;
    }

    // Regenerate from Cashbook
    const cashbookEntries = await CashbookEntry.find({});
    for (const entry of cashbookEntries) {
      let ledgerType = null;
      let referenceName = entry.reference_name || 'Cash Transaction';
      let referenceId = entry._id;

      // Categorize based on cashbook category (same logic as banking)
      switch (entry.category) {
        case 'party_commission':
          continue; // Skip - handled by Party Commission Ledger

        case 'party_on_account':
          continue; // Skip - handled by Party Ledger separately

        case 'bill_advance':
        case 'bill_payment':
          ledgerType = 'party';
          referenceName = entry.reference_name || 'Party Transaction';
          referenceId = entry.reference_name || entry._id;
          break;

        case 'memo_advance':
        case 'memo_payment':
        case 'supplier_payment':
          ledgerType = 'supplier';
          referenceName = entry.reference_name || 'Supplier Transaction';
          referenceId = entry.reference_name || entry._id;
          break;

        case 'vehicle_expense':
          if (entry.vehicle_no) {
            ledgerType = 'vehicle_expense';
            referenceName = `Vehicle ${entry.vehicle_no} - Cash Expense`;
            referenceId = entry.vehicle_no;
          }
          break;

        case 'fuel_wallet':
          continue; // Skip - handled by Fuel system

        case 'expense':
        case 'other':
          // Only these go to General Ledger
          ledgerType = 'general';
          referenceName = entry.reference_name || 'General Transaction';
          referenceId = entry._id;
          break;

        default:
          // Unknown categories go to general for now
          ledgerType = 'general';
          referenceName = entry.reference_name || 'General Transaction';
          referenceId = entry._id;
          break;
      }

      // Skip if no ledger type assigned
      if (!ledgerType) continue;

      await new LedgerEntry({
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
      }).save();
      count++;
    }

    // 4. Regenerate from Memos (for vehicle ledger credits)
    console.log('🔄 Regenerating Vehicle Ledger from Memos...');
    const Memo = (await import('../models/Memo.js')).default;
    const Vehicle = (await import('../models/Vehicle.js')).default;
    const LoadingSlip = (await import('../models/LoadingSlip.js')).default;

    const memos = await Memo.find({}).populate('loading_slip_id');

    for (const memo of memos) {
      if (memo.loading_slip_id && memo.loading_slip_id.vehicle_no) {
        const vehicle = await Vehicle.findOne({ vehicle_no: memo.loading_slip_id.vehicle_no });
        const isOwnVehicle = vehicle?.ownership_type === 'own';

        if (isOwnVehicle) {
          // Calculate net amount after deductions
          const netAmount = memo.freight - (memo.commission || 0) - (memo.mamool || 0);

          // Main freight entry
          if (netAmount > 0) {
            await new LedgerEntry({
              referenceId: memo.loading_slip_id.vehicle_no,
              reference_id: memo._id.toString(),
              ledger_type: 'vehicle_expense',
              reference_name: `Vehicle ${memo.loading_slip_id.vehicle_no} - Memo Credit`,
              source_type: 'memo',
              type: 'payment',
              date: memo.date,
              description: `Memo ${memo.memo_number} - Freight after deductions`,
              debit: 0,
              credit: netAmount,
              balance: 0,
              vehicle_no: memo.loading_slip_id.vehicle_no,
            }).save();
            count++;
          }

          // Detention entry
          if (memo.detention && memo.detention > 0) {
            await new LedgerEntry({
              referenceId: memo.loading_slip_id.vehicle_no,
              reference_id: memo._id.toString(),
              ledger_type: 'vehicle_expense',
              reference_name: `Vehicle ${memo.loading_slip_id.vehicle_no} - Memo Credit`,
              source_type: 'memo',
              type: 'payment',
              date: memo.date,
              description: `Memo ${memo.memo_number} - Detention charges`,
              debit: 0,
              credit: memo.detention,
              balance: 0,
              vehicle_no: memo.loading_slip_id.vehicle_no,
            }).save();
            count++;
          }

          // Extra charges entry
          if (memo.extra && memo.extra > 0) {
            await new LedgerEntry({
              referenceId: memo.loading_slip_id.vehicle_no,
              reference_id: memo._id.toString(),
              ledger_type: 'vehicle_expense',
              reference_name: `Vehicle ${memo.loading_slip_id.vehicle_no} - Memo Credit`,
              source_type: 'memo',
              type: 'payment',
              date: memo.date,
              description: `Memo ${memo.memo_number} - Extra charges`,
              debit: 0,
              credit: memo.extra,
              balance: 0,
              vehicle_no: memo.loading_slip_id.vehicle_no,
            }).save();
            count++;
          }
        }
      }
    }

    res.json({ message: 'Regenerated successfully', count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get ledger summary by reference name
router.get('/summary/:referenceName', async (req, res) => {
  try {
    const { referenceName } = req.params;
    const { ledger_type } = req.query;

    const filter = { reference_name: referenceName };
    if (ledger_type) filter.ledger_type = ledger_type;

    const entries = await LedgerEntry.find(filter).sort({ date: 1 });

    let balance = 0;
    const entriesWithBalance = entries.map(entry => {
      balance += entry.debit - entry.credit;
      return {
        ...entry.toObject(),
        runningBalance: balance
      };
    });

    const summary = {
      reference_name: referenceName,
      total_debit: entries.reduce((sum, entry) => sum + entry.debit, 0),
      total_credit: entries.reduce((sum, entry) => sum + entry.credit, 0),
      balance: balance,
      entries: entriesWithBalance
    };

    res.json(summary);
  } catch (error) {
    console.error('Get ledger summary error:', error);
    res.status(500).json({ message: 'Failed to fetch ledger summary', error: error.message });
  }
});

// Clear all ledger entries (for testing)
router.delete('/clear', async (req, res) => {
  try {
    await LedgerEntry.deleteMany({});
    res.json({ message: 'All ledger entries cleared' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to clear ledger entries', error: error.message });
  }
});

// Create new ledger entry
router.post('/', async (req, res) => {
  try {
    const ledgerData = req.body;

    const ledgerEntry = new LedgerEntry(ledgerData);
    await ledgerEntry.save();

    const entryObj = ledgerEntry.toObject();
    entryObj.id = entryObj._id.toString();

    res.status(201).json({
      message: 'Ledger entry created successfully',
      ledgerEntry: entryObj
    });
  } catch (error) {
    console.error('Create ledger entry error:', error);
    res.status(500).json({ message: 'Failed to create ledger entry', error: error.message });
  }
});

// Update ledger entry
router.put('/:id', async (req, res) => {
  try {
    const ledgerEntry = await LedgerEntry.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!ledgerEntry) {
      return res.status(404).json({ message: 'Ledger entry not found' });
    }

    res.json({
      message: 'Ledger entry updated successfully',
      ledgerEntry
    });
  } catch (error) {
    console.error('Update ledger entry error:', error);
    res.status(500).json({ message: 'Failed to update ledger entry', error: error.message });
  }
});

// Clean up duplicate memo entries
router.post('/cleanup-duplicates', async (req, res) => {
  try {
    console.log('🧹 Starting duplicate memo ledger cleanup...');

    // Find all vehicle income entries from memos
    const memoEntries = await LedgerEntry.find({
      ledger_type: 'vehicle_income',
      source_type: 'memo'
    }).sort({ createdAt: 1 });

    console.log(`📊 Found ${memoEntries.length} memo ledger entries`);

    // Group by reference_id (memo ID) and vehicle_no
    const groupedEntries = {};
    memoEntries.forEach(entry => {
      const key = `${entry.reference_id}-${entry.vehicle_no || 'unknown'}`;
      if (!groupedEntries[key]) {
        groupedEntries[key] = [];
      }
      groupedEntries[key].push(entry);
    });

    let duplicatesRemoved = 0;
    let duplicateGroups = 0;

    // Remove duplicates (keep the first one, delete the rest)
    for (const [key, entries] of Object.entries(groupedEntries)) {
      if (entries.length > 1) {
        duplicateGroups++;
        console.log(`🔍 Found ${entries.length} duplicates for ${key}:`);
        entries.forEach((entry, index) => {
          console.log(`  ${index + 1}. ${entry._id} - ${entry.description} (${entry.createdAt})`);
        });

        // Keep the first entry, delete the rest
        for (let i = 1; i < entries.length; i++) {
          await LedgerEntry.findByIdAndDelete(entries[i]._id);
          duplicatesRemoved++;
          console.log(`🗑️ Deleted duplicate: ${entries[i]._id}`);
        }
      }
    }

    console.log(`✅ Cleanup completed: ${duplicatesRemoved} duplicates removed from ${duplicateGroups} groups`);

    res.json({
      message: 'Duplicate memo ledger entries cleaned up successfully',
      duplicateGroups,
      duplicatesRemoved,
      totalEntriesChecked: memoEntries.length
    });
  } catch (error) {
    console.error('Cleanup duplicates error:', error);
    res.status(500).json({ message: 'Failed to cleanup duplicate entries', error: error.message });
  }
});

// Clear all ledger entries (for debugging) - must be before /:id route
router.delete('/clear-all', async (req, res) => {
  try {
    const result = await LedgerEntry.deleteMany({});
    console.log(`🗑️ Cleared ${result.deletedCount} ledger entries`);

    // Also clear party commission ledger entries
    const PartyCommissionLedger = (await import('../models/PartyCommissionLedger.js')).default;
    const commissionResult = await PartyCommissionLedger.deleteMany({});
    console.log(`🗑️ Cleared ${commissionResult.deletedCount} party commission entries`);

    res.json({
      message: 'All ledger entries cleared successfully',
      deletedLedgerEntries: result.deletedCount,
      deletedCommissionEntries: commissionResult.deletedCount
    });
  } catch (error) {
    console.error('Clear all ledger entries error:', error);
    res.status(500).json({ message: 'Failed to clear ledger entries', error: error.message });
  }
});

// Delete ledger entry by ID
router.delete('/:id', async (req, res) => {
  try {
    const ledgerEntry = await LedgerEntry.findByIdAndDelete(req.params.id);

    if (!ledgerEntry) {
      return res.status(404).json({ message: 'Ledger entry not found' });
    }

    res.json({ message: 'Ledger entry deleted successfully' });
  } catch (error) {
    console.error('Delete ledger entry error:', error);
    res.status(500).json({ message: 'Failed to delete ledger entry', error: error.message });
  }
});

export default router;
