import express from 'express';
import Supplier from '../models/Supplier.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all routes - temporarily disabled for debugging
// router.use(authenticateToken);

// Get all suppliers
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

    const suppliers = await Supplier.find(filter)
      .sort({ name: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Supplier.countDocuments(filter);

    res.json({
      suppliers,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({ message: 'Failed to fetch suppliers', error: error.message });
  }
});

// Get supplier by ID
router.get('/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    
    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    res.json(supplier);
  } catch (error) {
    console.error('Get supplier error:', error);
    res.status(500).json({ message: 'Failed to fetch supplier', error: error.message });
  }
});

// Create new supplier
router.post('/', async (req, res) => {
  try {
    const supplier = new Supplier(req.body);
    await supplier.save();

    res.status(201).json({
      message: 'Supplier created successfully',
      supplier
    });
  } catch (error) {
    console.error('Create supplier error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Supplier with this name already exists' });
    }
    res.status(500).json({ message: 'Failed to create supplier', error: error.message });
  }
});

// Update supplier
router.put('/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    res.json({
      message: 'Supplier updated successfully',
      supplier
    });
  } catch (error) {
    console.error('Update supplier error:', error);
    res.status(500).json({ message: 'Failed to update supplier', error: error.message });
  }
});

// Delete supplier
router.delete('/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndDelete(req.params.id);

    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    res.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    console.error('Delete supplier error:', error);
    res.status(500).json({ message: 'Failed to delete supplier', error: error.message });
  }
});

// Create supplier debit note (accounting adjustment only - no banking entry)
router.post('/debit-note', async (req, res) => {
  try {
    const { supplier_name, amount, narration, date } = req.body;
    
    console.log('🔄 Creating supplier debit note (ledger only):', { supplier_name, amount, narration, date });
    
    // Validate required fields
    if (!supplier_name || !amount || !narration || !date) {
      return res.status(400).json({ message: 'Missing required fields: supplier_name, amount, narration, date' });
    }
    
    if (amount <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than 0' });
    }
    
    // Find supplier to get ID
    const supplier = await Supplier.findOne({ name: supplier_name });
    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }
    
    // Create only ledger entry (no banking entry)
    const LedgerEntry = (await import('../models/LedgerEntry.js')).default;
    
    const ledgerEntry = new LedgerEntry({
      referenceId: supplier._id,
      reference_id: `DEBIT-${Date.now()}`, // Unique reference for debit note
      ledger_type: 'supplier',
      reference_name: supplier_name,
      source_type: 'debit_note',
      type: 'adjustment',
      date: new Date(date),
      description: `Supplier Debit Note - ${narration}`,
      debit: amount, // Debit note reduces supplier balance (debit to supplier account)
      credit: 0,
      balance: 0,
      created_at: new Date()
    });
    
    await ledgerEntry.save();
    
    console.log('✅ Created supplier debit note ledger entry:', ledgerEntry._id);
    
    res.status(201).json({
      message: 'Supplier debit note created successfully',
      ledgerEntry: {
        id: ledgerEntry._id,
        supplier_name,
        amount,
        narration,
        date,
        reference_id: ledgerEntry.reference_id
      }
    });
    
  } catch (error) {
    console.error('Create supplier debit note error:', error);
    res.status(500).json({ message: 'Failed to create supplier debit note', error: error.message });
  }
});

export default router;
