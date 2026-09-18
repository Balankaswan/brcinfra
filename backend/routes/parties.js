import express from 'express';
import Party from '../models/Party.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Disable authentication for debugging
router.use((req, res, next) => {
  console.log(`Parties route: ${req.method} ${req.path}`);
  next(); // Skip authentication completely
});

// Get all parties
router.get('/', async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    
    const filter = {};
    if (search) {
      filter.$or = [
        { name: new RegExp(search, 'i') },
        { contact: new RegExp(search, 'i') },
        { phone: new RegExp(search, 'i') }
      ];
    }

    const parties = await Party.find(filter)
      .sort({ name: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Party.countDocuments(filter);

    res.json({
      parties,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get parties error:', error);
    res.status(500).json({ message: 'Failed to fetch parties', error: error.message });
  }
});

// Get party by ID
router.get('/:id', async (req, res) => {
  try {
    const party = await Party.findById(req.params.id);
    
    if (!party) {
      return res.status(404).json({ message: 'Party not found' });
    }

    res.json(party);
  } catch (error) {
    console.error('Get party error:', error);
    res.status(500).json({ message: 'Failed to fetch party', error: error.message });
  }
});

// Create new party
router.post('/', async (req, res) => {
  try {
    const party = new Party(req.body);
    await party.save();

    res.status(201).json({
      message: 'Party created successfully',
      party
    });
  } catch (error) {
    console.error('Create party error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Party with this name already exists' });
    }
    res.status(500).json({ message: 'Failed to create party', error: error.message });
  }
});

// Update party
router.put('/:id', async (req, res) => {
  try {
    const party = await Party.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!party) {
      return res.status(404).json({ message: 'Party not found' });
    }

    res.json({
      message: 'Party updated successfully',
      party
    });
  } catch (error) {
    console.error('Update party error:', error);
    res.status(500).json({ message: 'Failed to update party', error: error.message });
  }
});

// Delete party
router.delete('/:id', async (req, res) => {
  try {
    const party = await Party.findByIdAndDelete(req.params.id);

    if (!party) {
      return res.status(404).json({ message: 'Party not found' });
    }

    res.json({ message: 'Party deleted successfully' });
  } catch (error) {
    console.error('Delete party error:', error);
    res.status(500).json({ message: 'Failed to delete party', error: error.message });
  }
});

// Create party debit note (accounting adjustment only - no banking entry)
router.post('/debit-note', async (req, res) => {
  try {
    const { party_name, amount, narration, date } = req.body;
    
    console.log('🔄 Creating party debit note (ledger only):', { party_name, amount, narration, date });
    
    // Validate required fields
    if (!party_name || !amount || !narration || !date) {
      return res.status(400).json({ message: 'Missing required fields: party_name, amount, narration, date' });
    }
    
    if (amount <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than 0' });
    }
    
    // Find party to get ID
    const party = await Party.findOne({ name: party_name });
    if (!party) {
      return res.status(404).json({ message: 'Party not found' });
    }
    
    // Create only ledger entry (no banking entry)
    const LedgerEntry = (await import('../models/LedgerEntry.js')).default;
    
    const ledgerEntry = new LedgerEntry({
      referenceId: party._id,
      reference_id: `DEBIT-${Date.now()}`, // Unique reference for debit note
      ledger_type: 'party',
      reference_name: party_name,
      source_type: 'debit_note',
      type: 'adjustment',
      date: new Date(date),
      description: `Party Debit Note - ${narration}`,
      debit: 0,
      credit: amount, // Debit note reduces party balance (credit to party account)
      balance: 0,
      created_at: new Date()
    });
    
    await ledgerEntry.save();
    
    console.log('✅ Created party debit note ledger entry:', ledgerEntry._id);
    
    res.status(201).json({
      message: 'Party debit note created successfully',
      ledgerEntry: {
        id: ledgerEntry._id,
        party_name,
        amount,
        narration,
        date,
        reference_id: ledgerEntry.reference_id
      }
    });
    
  } catch (error) {
    console.error('Create party debit note error:', error);
    res.status(500).json({ message: 'Failed to create party debit note', error: error.message });
  }
});

export default router;
