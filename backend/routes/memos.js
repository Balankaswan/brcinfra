import express from 'express';
import mongoose from 'mongoose';
import Memo from '../models/Memo.js';
import LoadingSlip from '../models/LoadingSlip.js';
import LedgerEntry from '../models/LedgerEntry.js';
import { authenticateToken } from '../middleware/auth.js';
import { createMemoLedgerEntries } from '../services/ledgerService.js';
import { generateMemoNumber } from '../utils/autoIncrement.js';

const router = express.Router();

// Apply authentication to all routes - temporarily disabled for debugging
// router.use(authenticateToken);

// Get all memos
router.get('/', async (req, res) => {
  try {
    const { status, supplier, vehicle_no, page = 1, limit = 50 } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (supplier) filter.supplier = new RegExp(supplier, 'i');
    if (vehicle_no) filter.vehicle_no = new RegExp(vehicle_no, 'i');

    const memos = await Memo.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Memo.countDocuments(filter);

    // Ensure id field is present for frontend compatibility
    const memosWithId = memos.map(memo => {
      const memoObj = memo.toObject();
      memoObj.id = memoObj._id.toString();
      return memoObj;
    });

    res.json({
      memos: memosWithId,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get memos error:', error);
    res.status(500).json({ message: 'Failed to fetch memos', error: error.message });
  }
});

// Get memo by ID
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Memo not found (invalid ID)' });
    }
    const memo = await Memo.findById(req.params.id).populate({ path: 'loading_slip_id', model: 'LoadingSlip' });

    if (!memo) {
      return res.status(404).json({ message: 'Memo not found' });
    }

    const memoObj = memo.toObject();
    memoObj.id = memoObj._id.toString();
    res.json(memoObj);
  } catch (error) {
    console.error('Get memo error:', error);
    res.status(500).json({ message: 'Failed to fetch memo', error: error.message });
  }
});

// Create new memo
router.post('/', async (req, res) => {
  try {
    const memoData = req.body;

    let lrIds = [];
    if (memoData.loading_slip_ids && Array.isArray(memoData.loading_slip_ids) && memoData.loading_slip_ids.length > 0) {
      lrIds = memoData.loading_slip_ids.filter(id => mongoose.Types.ObjectId.isValid(id));
      memoData.loading_slip_id = lrIds[0];
    } else if (memoData.loading_slip_id && mongoose.Types.ObjectId.isValid(memoData.loading_slip_id)) {
      lrIds = [memoData.loading_slip_id];
    } else {
      return res.status(400).json({ message: 'Invalid or missing LR ID. Please refresh and try again.' });
    }

    if (lrIds.length === 0) {
      return res.status(400).json({ message: 'At least one LR must be selected to create a Freight Memo.' });
    }

    // Check if memo already exists for any of these loading slips
    const existingMemo = await Memo.findOne({
      $or: [
        { loading_slip_id: { $in: lrIds } },
        { loading_slip_ids: { $elemMatch: { $in: lrIds } } }
      ]
    });
    if (existingMemo) {
      return res.status(400).json({
        message: `Memo (${existingMemo.memo_number}) already exists for one or more selected LRs.`,
        existingMemo: {
          id: existingMemo._id,
          memo_number: existingMemo.memo_number
        }
      });
    }

    // Verify loading slips exist
    const linkedLRs = await LoadingSlip.find({ _id: { $in: lrIds } }).select('slip_number lr_number');
    if (linkedLRs.length !== lrIds.length) {
      return res.status(400).json({ message: 'One or more selected LRs could not be found.' });
    }

    memoData.loading_slip_ids = lrIds;
    memoData.linked_lr_numbers = linkedLRs.map(lr => lr.slip_number || lr.lr_number);

    // Auto-generate memo number if not provided
    if (!memoData.memo_number) {
      memoData.memo_number = await generateMemoNumber();
      console.log('🔢 Auto-generated memo number:', memoData.memo_number);
    }

    const memo = new Memo(memoData);
    await memo.save();

    // Mark all linked LRs in MongoDB with memo_number and memo_id
    if (lrIds.length > 0) {
      await LoadingSlip.updateMany(
        { _id: { $in: lrIds } },
        { $set: { memo_number: memo.memo_number, memo_id: memo._id } }
      );
      console.log(`✅ Marked ${lrIds.length} LR(s) in MongoDB with Memo No: ${memo.memo_number}`);
    }

    // Populate loading slip data
    await memo.populate({ path: 'loading_slip_id', model: 'LoadingSlip' });

    // Create ledger entries automatically for this memo
    try {
      await createMemoLedgerEntries(memo);
      console.log('✅ Created ledger entries for memo:', memo.memo_number);
    } catch (error) {
      console.error('⚠️ Failed to create ledger entries for memo:', error);
      // Don't fail memo creation if ledger creation fails
    }

    const memoObj = memo.toObject();
    memoObj.id = memoObj._id.toString();

    res.status(201).json({
      message: 'Memo created successfully',
      memo: memoObj
    });
  } catch (error) {
    console.error('Create memo error:', error);
    res.status(500).json({ message: 'Failed to create memo', error: error.message });
  }
});

// Update memo
router.put('/:id', async (req, res) => {
  try {
    console.log(`🔄 Updating memo ${req.params.id}`);

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Memo not found (invalid ID)' });
    }

    // Delete existing ledger entries for this memo (both old and new field names)
    const deleteResult = await LedgerEntry.deleteMany({
      $or: [
        { referenceId: req.params.id },
        { reference_id: req.params.id }
      ]
    });
    console.log(`🗑️ Deleted ${deleteResult.deletedCount} existing ledger entries for memo ${req.params.id}`);

    const memo = await Memo.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate({ path: 'loading_slip_id', model: 'LoadingSlip' });

    if (!memo) {
      return res.status(404).json({ message: 'Memo not found' });
    }

    // Update linked LoadingSlips in MongoDB
    let updateLrIds = [];
    if (memo.loading_slip_ids && Array.isArray(memo.loading_slip_ids)) {
      updateLrIds = memo.loading_slip_ids;
    } else if (memo.loading_slip_id) {
      updateLrIds = [memo.loading_slip_id];
    }
    await LoadingSlip.updateMany(
      { $or: [{ memo_id: memo._id }, { memo_number: memo.memo_number }] },
      { $unset: { memo_number: "", memo_id: "" } }
    );
    if (updateLrIds.length > 0) {
      await LoadingSlip.updateMany(
        { _id: { $in: updateLrIds } },
        { $set: { memo_number: memo.memo_number, memo_id: memo._id } }
      );
    }

    // Wait a moment to ensure deletion is complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Create new ledger entries with updated memo data
    console.log(`✨ Creating new ledger entries for updated memo ${memo.memo_number}`);
    await createMemoLedgerEntries(memo);

    const memoObj = memo.toObject();
    memoObj.id = memoObj._id.toString();

    res.json({
      message: 'Memo updated successfully',
      memo: memoObj
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete memo
router.delete('/:id', async (req, res) => {
  try {
    let memo;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      memo = await Memo.findById(req.params.id);
    }
    if (!memo) {
      memo = await Memo.findOne({ memo_number: req.params.id });
    }
    if (!memo) {
      return res.status(404).json({ message: 'Memo not found' });
    }

    const memoId = memo._id;

    // Delete associated ledger entries (by ID and by memo_number)
    const deleteResult = await LedgerEntry.deleteMany({
      $or: [
        { referenceId: memoId.toString() },
        { reference_id: memoId.toString() },
        { referenceId: memo.memo_number },
        { reference_id: memo.memo_number }
      ]
    });
    console.log(`🗑️ Deleted ${deleteResult.deletedCount} ledger entries for memo ${memo.memo_number}`);

    // Unlink associated LoadingSlips
    const linkedIds = [];
    if (memo.loading_slip_id) linkedIds.push(memo.loading_slip_id);
    if (memo.loading_slip_ids && Array.isArray(memo.loading_slip_ids)) {
      linkedIds.push(...memo.loading_slip_ids);
    }
    await LoadingSlip.updateMany(
      {
        $or: [
          { memo_number: memo.memo_number },
          { memo_id: memoId },
          { _id: { $in: linkedIds } }
        ]
      },
      { $unset: { memo_number: "", memo_id: "" } }
    );
    console.log(`🔗 Unlinked loading slips for deleted memo ${memo.memo_number}`);

    await Memo.findByIdAndDelete(memoId);

    res.json({ message: 'Memo deleted successfully' });
  } catch (error) {
    console.error('Delete memo error:', error);
    res.status(500).json({ message: 'Failed to delete memo', error: error.message });
  }
});

// Mark memo as paid
router.patch('/:id/paid', async (req, res) => {
  try {
    const { paid_date, paid_amount } = req.body;

    const memo = await Memo.findByIdAndUpdate(
      req.params.id,
      {
        status: 'paid',
        paid_date,
        paid_amount
      },
      { new: true }
    ).populate({ path: 'loading_slip_id', model: 'LoadingSlip' });

    if (!memo) {
      return res.status(404).json({ message: 'Memo not found' });
    }

    const memoObj = memo.toObject();
    memoObj.id = memoObj._id.toString();

    res.json({
      message: 'Memo marked as paid',
      memo: memoObj
    });
  } catch (error) {
    console.error('Mark memo paid error:', error);
    res.status(500).json({ message: 'Failed to mark memo as paid', error: error.message });
  }
});

// Add advance payment to memo
router.post('/:id/advance', async (req, res) => {
  try {
    const { date, amount, mode, reference, description } = req.body;

    const memo = await Memo.findById(req.params.id);
    if (!memo) {
      return res.status(404).json({ message: 'Memo not found' });
    }

    const advancePayment = {
      date,
      amount,
      mode,
      reference,
      description
    };

    memo.advance_payments.push(advancePayment);
    await memo.save();

    const memoObj = memo.toObject();
    memoObj.id = memoObj._id.toString();

    res.json({
      message: 'Advance payment added successfully',
      memo: memoObj
    });
  } catch (error) {
    console.error('Add advance payment error:', error);
    res.status(500).json({ message: 'Failed to add advance payment', error: error.message });
  }
});

export default router;
