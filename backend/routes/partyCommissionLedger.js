import express from 'express';
import PartyCommissionLedger from '../models/PartyCommissionLedger.js';
import Bill from '../models/Bill.js';
import Party from '../models/Party.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all party commission ledger entries with optional filtering
router.get('/', async (req, res) => {
  try {
    const { date_from, date_to, bill_number, party_id } = req.query;
    
    // Build filter object
    const filter = {};
    
    // Filter by party if specified
    if (party_id) {
      filter.party_id = party_id;
    }
    
    if (date_from || date_to) {
      filter.date = {};
      if (date_from) filter.date.$gte = new Date(date_from);
      if (date_to) filter.date.$lte = new Date(date_to);
    }
    
    if (bill_number) {
      filter.bill_number = { $regex: bill_number, $options: 'i' };
    }
    
    const entries = await PartyCommissionLedger.find(filter)
      .populate('party_id', 'name')
      .sort({ date: -1, created_at: -1 });
    
    res.json(entries);
  } catch (error) {
    console.error('Error fetching party commission ledger entries:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get ledger summary (party-wise or overall)
router.get('/summary', async (req, res) => {
  try {
    const { date_from, date_to, party_id } = req.query;
    
    const filter = {};
    
    // Filter by party if specified
    if (party_id) {
      filter.party_id = party_id;
    }
    
    if (date_from || date_to) {
      filter.date = {};
      if (date_from) filter.date.$gte = new Date(date_from);
      if (date_to) filter.date.$lte = new Date(date_to);
    }

    const summary = await PartyCommissionLedger.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalCredits: {
            $sum: {
              $cond: [{ $eq: ['$entry_type', 'credit'] }, '$amount', 0]
            }
          },
          totalDebits: {
            $sum: {
              $cond: [{ $eq: ['$entry_type', 'debit'] }, '$amount', 0]
            }
          },
          totalEntries: { $sum: 1 }
        }
      }
    ]);

    const result = summary[0] || { totalCredits: 0, totalDebits: 0, totalEntries: 0 };
    result.balance = result.totalCredits - result.totalDebits;

    res.json(result);
  } catch (error) {
    console.error('Error fetching party commission ledger summary:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get list of parties with commission entries
router.get('/parties', async (req, res) => {
  try {
    const parties = await PartyCommissionLedger.aggregate([
      {
        $group: {
          _id: '$party_id',
          party_name: { $first: '$party_name' },
          totalCredits: {
            $sum: {
              $cond: [{ $eq: ['$entry_type', 'credit'] }, '$amount', 0]
            }
          },
          totalDebits: {
            $sum: {
              $cond: [{ $eq: ['$entry_type', 'debit'] }, '$amount', 0]
            }
          },
          entryCount: { $sum: 1 },
          lastEntryDate: { $max: '$date' }
        }
      },
      {
        $addFields: {
          balance: { $subtract: ['$totalCredits', '$totalDebits'] }
        }
      },
      {
        $sort: { party_name: 1 }
      }
    ]);

    res.json(parties);
  } catch (error) {
    console.error('Error fetching parties with commission entries:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete all party commission ledger entries (bulk delete) - must be before /:id route
router.delete('/all', async (req, res) => {
  try {
    const deleteResult = await PartyCommissionLedger.deleteMany({});
    console.log(`🗑️ Bulk deleted ${deleteResult.deletedCount} party commission ledger entries`);
    
    res.json({
      message: `Successfully deleted ${deleteResult.deletedCount} party commission ledger entries`,
      deletedCount: deleteResult.deletedCount
    });
  } catch (error) {
    console.error('Bulk delete party commission ledger entries error:', error);
    res.status(500).json({ message: 'Failed to delete party commission ledger entries', error: error.message });
  }
});

// Create party commission ledger entry (internal use)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const entry = new PartyCommissionLedger(req.body);
    await entry.save();
    res.status(201).json({ entry });
  } catch (error) {
    console.error('Error creating party commission ledger entry:', error);
    res.status(400).json({ message: 'Error creating entry', error: error.message });
  }
});

// Delete party commission ledger entry (internal use)
router.delete('/:id', async (req, res) => {
  try {
    const entry = await PartyCommissionLedger.findByIdAndDelete(req.params.id);
    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' });
    }
    res.json({ message: 'Entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting party commission ledger entry:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Import commission cuts from bills for MODERN TRANSPORT COMPANY-RAJKUMAR
router.post('/import-commission-cuts', async (req, res) => {
  try {
    console.log('🔄 Starting commission import for MODERN TRANSPORT COMPANY-RAJKUMAR...');
    
    // Find all bills for MODERN TRANSPORT COMPANY-RAJKUMAR with commission cuts
    const billsWithCommission = await Bill.find({
      $and: [
        { party_commission_cut: { $gt: 0 } },
        { 
          $or: [
            { party_name: { $regex: /MODERN TRANSPORT COMPANY.*RAJKUMAR/i } },
            { party: { $regex: /MODERN TRANSPORT COMPANY.*RAJKUMAR/i } }
          ]
        }
      ]
    });
    
    console.log(`📊 Found ${billsWithCommission.length} bills for MODERN TRANSPORT COMPANY-RAJKUMAR with commission cuts`);
    
    let importedCount = 0;
    let skippedCount = 0;
    const errors = [];
    const importedEntries = [];
    
    for (const bill of billsWithCommission) {
      try {
        // Check if commission entry already exists for this bill
        const existingEntry = await PartyCommissionLedger.findOne({
          $or: [
            { bill_id: bill._id },
            { bill_number: bill.bill_number, reference_id: bill.bill_number }
          ]
        });
        
        if (existingEntry) {
          console.log(`⚠️ Commission entry already exists for bill ${bill.bill_number}, skipping`);
          skippedCount++;
          continue;
        }
        
        // Get party information
        let partyId = bill.party_id;
        let partyName = bill.party_name || bill.party || 'MODERN TRANSPORT COMPANY-RAJKUMAR';
        
        // If no party_id, try to find party by name
        if (!partyId && partyName) {
          const party = await Party.findOne({ 
            name: { $regex: /MODERN TRANSPORT COMPANY.*RAJKUMAR/i }
          });
          if (party) {
            partyId = party._id;
            partyName = party.name;
          }
        }
        
        // Create commission ledger entry
        const commissionEntry = new PartyCommissionLedger({
          party_id: partyId,
          party_name: partyName,
          bill_id: bill._id,
          bill_number: bill.bill_number,
          reference_id: bill.bill_number,
          reference_type: 'bill',
          date: bill.date,
          entry_type: 'credit', // Commission cut is a credit to party
          amount: bill.party_commission_cut,
          narration: `Commission Cut – Bill No. ${bill.bill_number}`
        });
        
        const savedEntry = await commissionEntry.save();
        importedCount++;
        importedEntries.push(savedEntry);
        
        console.log(`✅ Created commission entry for bill ${bill.bill_number}: ₹${bill.party_commission_cut}`);
        
      } catch (error) {
        console.error(`❌ Error processing bill ${bill.bill_number}:`, error);
        errors.push({
          bill_number: bill.bill_number,
          error: error.message
        });
      }
    }
    
    console.log(`🎯 Commission import completed: ${importedCount} imported, ${skippedCount} skipped`);
    
    // Broadcast change to all connected clients for real-time sync
    if (global.broadcastChange) {
      global.broadcastChange('create', 'party-commission-ledger', { 
        importedCount, 
        skippedCount,
        party: 'MODERN TRANSPORT COMPANY-RAJKUMAR',
        message: 'Commission entries imported from bills'
      });
    }
    
    res.json({
      message: 'Commission import completed successfully for MODERN TRANSPORT COMPANY-RAJKUMAR',
      party: 'MODERN TRANSPORT COMPANY-RAJKUMAR',
      imported: importedCount,
      skipped: skippedCount,
      total_bills_processed: billsWithCommission.length,
      imported_entries: importedEntries,
      errors: errors
    });
    
  } catch (error) {
    console.error('❌ Error importing commission from bills:', error);
    res.status(500).json({ 
      message: 'Failed to import commission from bills', 
      error: error.message 
    });
  }
});

export default router;
