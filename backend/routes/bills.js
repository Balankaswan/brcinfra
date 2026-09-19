import express from 'express';
import mongoose from 'mongoose';
import Bill from '../models/Bill.js';
import LoadingSlip from '../models/LoadingSlip.js';
import LedgerEntry from '../models/LedgerEntry.js';
import PartyCommissionLedger from '../models/PartyCommissionLedger.js';
import { authenticateToken } from '../middleware/auth.js';
import { createBillLedgerEntries } from '../services/ledgerService.js';
import { generateBillNumber } from '../utils/autoIncrement.js';

const router = express.Router();

// Apply authentication to all routes - temporarily disabled for debugging
// router.use(authenticateToken);

// Debug endpoint to check bill advance payments
router.get('/debug/:bill_number', async (req, res) => {
  try {
    const bill = await Bill.findOne({ bill_number: req.params.bill_number });
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    console.log('🔍 Debug Bill Data:', {
      bill_number: bill.bill_number,
      advance_payments_count: bill.advance_payments?.length || 0,
      advance_payments: bill.advance_payments
    });

    res.json({
      bill_number: bill.bill_number,
      advance_payments: bill.advance_payments,
      total_advance: bill.advance_payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0
    });
  } catch (error) {
    console.error('Debug bill error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all bills
router.get('/', async (req, res) => {
  try {
    const { status, party, vehicle_no, page = 1, limit = 50 } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (party) filter.party = new RegExp(party, 'i');
    if (vehicle_no) filter.vehicle_no = new RegExp(vehicle_no, 'i');

    const bills = await Bill.find(filter)
      .populate('loading_slip_id')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Bill.countDocuments(filter);

    // Ensure id field is present for frontend compatibility
    const billsWithId = bills.map(bill => {
      const billObj = bill.toObject();
      billObj.id = billObj._id.toString();
      return billObj;
    });

    res.json({
      bills: billsWithId,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get bills error:', error);
    res.status(500).json({ message: 'Failed to fetch bills', error: error.message });
  }
});

// Get bill by ID
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Bill not found (invalid ID)' });
    }
    const bill = await Bill.findById(req.params.id).populate('loading_slip_id');

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    const billObj = bill.toObject();
    billObj.id = billObj._id.toString();
    res.json(billObj);
  } catch (error) {
    console.error('Get bill error:', error);
    res.status(500).json({ message: 'Failed to fetch bill', error: error.message });
  }
});

// Helper function to create party commission ledger entry with duplicate prevention
const createPartyCommissionEntry = async (bill, entryType = 'credit') => {
  if (bill.party_commission_cut && bill.party_commission_cut > 0) {
    const PartyCommissionLedger = (await import('../models/PartyCommissionLedger.js')).default;

    // Check if entry already exists to prevent duplicates
    const existingEntry = await PartyCommissionLedger.findOne({
      bill_id: bill._id,
      entry_type: entryType
    });

    if (!existingEntry) {
      const narration = entryType === 'credit'
        ? `Commission Cut – Bill No. ${bill.bill_number}`
        : `Commission Cut Reversal – Bill No. ${bill.bill_number}`;

      // Find the party by name
      const Party = (await import('../models/Party.js')).default;
      const party = await Party.findOne({ name: bill.party });
      const partyId = party ? party._id : bill.party;

      const commissionEntry = new PartyCommissionLedger({
        party_id: partyId,
        party_name: bill.party,
        date: bill.date,
        bill_number: bill.bill_number,
        reference_id: bill.bill_number,
        entry_type: entryType,
        amount: bill.party_commission_cut,
        narration: narration,
        bill_id: bill._id,
        reference_type: 'bill'
      });

      await commissionEntry.save();
      console.log(`✅ Created party commission ${entryType} entry for bill ${bill.bill_number}: ₹${bill.party_commission_cut}`);
    } else {
      console.log(`⚠️ Party commission entry already exists for bill ${bill.bill_number}, skipping duplicate`);
    }
  }
};

// Create new bill
router.post('/', async (req, res) => {
  try {
    const billData = req.body;

    // ─── Multi-LR support (Point 44) ───
    let lrIds = [];
    if (billData.loading_slip_ids && billData.loading_slip_ids.length > 0) {
      lrIds = billData.loading_slip_ids.filter(id => mongoose.Types.ObjectId.isValid(id));
      billData.loading_slip_id = lrIds[0]; // backward compat
    } else if (billData.loading_slip_id && mongoose.Types.ObjectId.isValid(billData.loading_slip_id)) {
      lrIds = [billData.loading_slip_id];
    } else {
      return res.status(400).json({ message: 'Invalid or missing LR ID. Please refresh and try again.' });
    }

    if (lrIds.length === 0) {
      return res.status(400).json({ message: 'At least one LR must be selected to create a Bill.' });
    }

    // ─── Duplicate billing guard ───
    const alreadyBilledLRs = await LoadingSlip.find({
      _id: { $in: lrIds },
      bill_number: { $nin: [null, ''] }
    }).select('slip_number lr_number bill_number');

    if (alreadyBilledLRs.length > 0) {
      const details = alreadyBilledLRs.map(lr =>
        `${lr.slip_number || lr.lr_number} (already billed: ${lr.bill_number})`
      ).join(', ');
      return res.status(400).json({
        message: `The following LRs are already billed: ${details}`
      });
    }

    const existingBillForLR = await Bill.findOne({
      $or: [
        { loading_slip_id: { $in: lrIds } },
        { loading_slip_ids: { $elemMatch: { $in: lrIds } } }
      ]
    });
    if (existingBillForLR) {
      return res.status(400).json({
        message: `A bill (${existingBillForLR.bill_number}) already exists for one or more selected LRs.`
      });
    }

    // Verify all LRs exist and collect LR numbers
    const linkedLRs = await LoadingSlip.find({ _id: { $in: lrIds } }).select('slip_number lr_number');
    if (linkedLRs.length !== lrIds.length) {
      return res.status(400).json({ message: 'One or more selected LRs could not be found.' });
    }

    billData.loading_slip_ids = lrIds;
    billData.linked_lr_numbers = linkedLRs.map(lr => lr.slip_number || lr.lr_number);

    // For backward compat use first LR
    const loadingSlip = linkedLRs[0];


    // Auto-generate bill number if not provided
    if (!billData.bill_number) {
      billData.bill_number = await generateBillNumber();
      console.log('🔢 Auto-generated bill number:', billData.bill_number);
    }

    const bill = new Bill(billData);
    await bill.save();

    // ─── Mark all linked LRs as billed ───
    if (lrIds.length > 0) {
      await LoadingSlip.updateMany(
        { _id: { $in: lrIds } },
        { $set: { bill_number: bill.bill_number, bill_id: bill._id } }
      );
      console.log(`✅ Marked ${lrIds.length} LR(s) as billed with Bill No: ${bill.bill_number}`);
    }

    // Create party commission ledger entry if commission cut exists (with duplicate prevention)
    await createPartyCommissionEntry(bill, 'credit');

    // Create bill ledger entries (party ledger with debit notes)
    try {
      await createBillLedgerEntries(bill);
      console.log('✅ Created ledger entries for bill:', bill.bill_number);
    } catch (error) {
      console.error('⚠️ Failed to create ledger entries for bill:', error);
      // Don't fail bill creation if ledger creation fails
    }

    // Populate loading slip data
    await bill.populate('loading_slip_id');

    const billObj = bill.toObject();
    billObj.id = billObj._id.toString();

    res.status(201).json({
      message: 'Bill created successfully',
      bill: billObj

    });
  } catch (error) {
    console.error('Create bill error:', error);
    res.status(500).json({ message: 'Failed to create bill', error: error.message });
  }
});

// Update bill
router.put('/:id', async (req, res) => {
  try {
    console.log(`🔄 Updating bill ${req.params.id}`);

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Bill not found (invalid ID)' });
    }

    // Delete existing ledger entries for this bill (both old and new field names)
    const deleteResult = await LedgerEntry.deleteMany({
      $or: [
        { referenceId: req.params.id },
        { reference_id: req.params.id }
      ]
    });
    console.log(`🗑️ Deleted ${deleteResult.deletedCount} existing ledger entries for bill ${req.params.id}`);

    // Delete existing party commission entries
    await PartyCommissionLedger.deleteMany({
      bill_id: req.params.id
    });
    console.log(`🗑️ Deleted existing commission entries for bill ${req.params.id}`);

    // Use findById + save so the pre-save hook runs (computing GST totals)
    const bill = await Bill.findById(req.params.id);
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Apply all incoming fields onto the document
    Object.assign(bill, req.body);
    await bill.save();   // triggers pre-save hook → gross_invoice_amount, net_amount recalculated

    await bill.populate('loading_slip_id');

    // Update linked LoadingSlips in MongoDB
    let updateLrIds = [];
    if (bill.loading_slip_ids && Array.isArray(bill.loading_slip_ids)) {
      updateLrIds = bill.loading_slip_ids;
    } else if (bill.loading_slip_id) {
      updateLrIds = [bill.loading_slip_id];
    }
    await LoadingSlip.updateMany(
      { $or: [{ bill_id: bill._id }, { bill_number: bill.bill_number }] },
      { $unset: { bill_number: "", bill_id: "" } }
    );
    if (updateLrIds.length > 0) {
      await LoadingSlip.updateMany(
        { _id: { $in: updateLrIds } },
        { $set: { bill_number: bill.bill_number, bill_id: bill._id } }
      );
    }

    // Wait a moment to ensure deletion is complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Create new party commission entry if commission cut exists
    await createPartyCommissionEntry(bill, 'credit');

    // Create new bill ledger entries with updated bill data
    console.log(`✨ Creating new ledger entries for updated bill ${bill.bill_number}`);
    await createBillLedgerEntries(bill);

    const billObj = bill.toObject();
    billObj.id = billObj._id.toString();

    res.json({
      message: 'Bill updated successfully',
      bill: billObj
    });
  } catch (error) {
    console.error('Update bill error:', error);
    res.status(500).json({ message: 'Failed to update bill', error: error.message });
  }
});

// Delete bill
router.delete('/:id', async (req, res) => {
  try {
    let bill;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      bill = await Bill.findById(req.params.id);
    }
    if (!bill) {
      bill = await Bill.findOne({ bill_number: req.params.id });
    }
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    const billId = bill._id;

    // Delete associated ledger entries (both old and new field names)
    const deleteResult = await LedgerEntry.deleteMany({
      $or: [
        { referenceId: billId.toString() },
        { reference_id: billId.toString() },
        { referenceId: bill.bill_number },
        { reference_id: bill.bill_number }
      ]
    });
    console.log(`🗑️ Deleted ${deleteResult.deletedCount} ledger entries for bill ${bill.bill_number}`);

    // Delete associated party commission ledger entries
    await PartyCommissionLedger.deleteMany({
      $or: [
        { bill_id: billId },
        { bill_number: bill.bill_number }
      ]
    });
    console.log(`🗑️ Deleted commission ledger entries for bill ${bill.bill_number}`);

    // Unlink associated LoadingSlips
    const linkedIds = [];
    if (bill.loading_slip_id) linkedIds.push(bill.loading_slip_id);
    if (bill.loading_slip_ids && Array.isArray(bill.loading_slip_ids)) {
      linkedIds.push(...bill.loading_slip_ids);
    }
    await LoadingSlip.updateMany(
      {
        $or: [
          { bill_number: bill.bill_number },
          { bill_id: billId },
          { _id: { $in: linkedIds } }
        ]
      },
      { $unset: { bill_number: "", bill_id: "" } }
    );
    console.log(`🔗 Unlinked loading slips for deleted bill ${bill.bill_number}`);

    // Delete the bill
    await Bill.findByIdAndDelete(billId);

    res.json({ message: 'Bill deleted successfully' });
  } catch (error) {
    console.error('Delete bill error:', error);
    res.status(500).json({ message: 'Failed to delete bill', error: error.message });
  }
});

// Mark bill as received
router.patch('/:id/received', async (req, res) => {
  try {
    const { received_date, received_amount } = req.body;

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Bill not found (invalid ID)' });
    }

    const bill = await Bill.findByIdAndUpdate(
      req.params.id,
      {
        status: 'received',
        received_date,
        received_amount
      },
      { new: true }
    ).populate('loading_slip_id');

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    const billObj = bill.toObject();
    billObj.id = billObj._id.toString();

    res.json({
      message: 'Bill marked as received',
      bill: billObj
    });
  } catch (error) {
    console.error('Mark bill received error:', error);
    res.status(500).json({ message: 'Failed to mark bill as received', error: error.message });
  }
});

// Add advance payment to bill
router.post('/:id/advance', async (req, res) => {
  try {
    const { date, amount, mode, reference, description } = req.body;

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Bill not found (invalid ID)' });
    }

    const bill = await Bill.findById(req.params.id);
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    const advancePayment = {
      date,
      amount,
      mode,
      reference,
      description
    };

    bill.advance_payments.push(advancePayment);
    await bill.save();

    const billObj = bill.toObject();
    billObj.id = billObj._id.toString();

    res.json({
      message: 'Advance payment added successfully',
      bill: billObj
    });
  } catch (error) {
    console.error('Add advance payment error:', error);
    res.status(500).json({ message: 'Failed to add advance payment', error: error.message });
  }
});

export default router;
