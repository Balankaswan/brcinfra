import express from 'express';
import mongoose from 'mongoose';
import { authenticateToken } from '../middleware/auth.js';
import LoadingSlip from '../models/LoadingSlip.js';
import Memo from '../models/Memo.js';
import Bill from '../models/Bill.js';
import { generateLRNumber } from '../utils/autoIncrement.js';

const router = express.Router();

// ─── GET /next-number — returns next LR number for frontend form auto-fill ───
router.get('/next-number', async (req, res) => {
  try {
    const { branch_code = 'AHD' } = req.query;
    const nextLRNumber = await generateLRNumber(branch_code);
    res.json({ nextLRNumber });
  } catch (error) {
    console.error('Error generating next LR number:', error);
    res.status(500).json({ message: 'Failed to generate LR number', error: error.message });
  }
});

// ─── GET /available-for-billing — LRs that have not been billed yet ───
router.get('/available-for-billing', async (req, res) => {
  try {
    const { party, consignor_name, consignee_name, search, exclude_ids } = req.query;

    // Fetch all active bill LR IDs
    const activeBills = await Bill.find({}).select('loading_slip_id loading_slip_ids');
    const billedLrIdSet = new Set();
    activeBills.forEach(b => {
      if (b.loading_slip_id) billedLrIdSet.add(b.loading_slip_id.toString());
      if (b.loading_slip_ids && Array.isArray(b.loading_slip_ids)) {
        b.loading_slip_ids.forEach(id => billedLrIdSet.add(id.toString()));
      }
    });

    const billedIds = Array.from(billedLrIdSet)
      .filter(id => mongoose.Types.ObjectId.isValid(id))
      .map(id => new mongoose.Types.ObjectId(id));

    const filter = {
      _id: { $nin: billedIds }
    };

    if (party) filter.party = new RegExp(party, 'i');
    if (consignor_name) filter.consignor_name = new RegExp(consignor_name, 'i');
    if (consignee_name) filter.consignee_name = new RegExp(consignee_name, 'i');

    if (search) {
      filter.$and = [{
        $or: [
          { slip_number: new RegExp(search, 'i') },
          { lr_number: new RegExp(search, 'i') },
          { consignor_name: new RegExp(search, 'i') },
          { consignee_name: new RegExp(search, 'i') },
          { party: new RegExp(search, 'i') },
          { vehicle_no: new RegExp(search, 'i') }
        ]
      }];
    }

    if (exclude_ids) {
      const excludeArr = exclude_ids.split(',').filter(id => mongoose.Types.ObjectId.isValid(id));
      if (excludeArr.length > 0) {
        filter._id.$nin.push(...excludeArr.map(id => new mongoose.Types.ObjectId(id)));
      }
    }

    const lrs = await LoadingSlip.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .select('slip_number lr_number date party consignor_name consignee_name vehicle_no from_location to_location freight freight_amount total_amount advance advance_amount balance balance_amount');

    const enriched = lrs.map(lr => {
      const obj = lr.toObject();
      obj.id = obj._id.toString();
      return obj;
    });

    res.json({ loadingSlips: enriched, total: enriched.length });
  } catch (error) {
    console.error('Get available-for-billing error:', error);
    res.status(500).json({ message: 'Failed to fetch LRs available for billing', error: error.message });
  }
});

// Get all LRs
router.get('/', async (req, res) => {
  try {
    const { party, vehicle_no, supplier, consignor_name, consignee_name, page = 1, limit = 50 } = req.query;

    const filter = {};
    if (party) filter.party = new RegExp(party, 'i');
    if (vehicle_no) filter.vehicle_no = new RegExp(vehicle_no, 'i');
    if (supplier) filter.supplier = new RegExp(supplier, 'i');
    if (consignor_name) filter.consignor_name = new RegExp(consignor_name, 'i');
    if (consignee_name) filter.consignee_name = new RegExp(consignee_name, 'i');

    const loadingSlips = await LoadingSlip.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await LoadingSlip.countDocuments(filter);

    const enrichedLoadingSlips = await Promise.all(
      loadingSlips.map(async (slip) => {
        const slipObj = slip.toObject();
        try {
          const memo = await Memo.findOne({
            $or: [
              { loading_slip_id: slip._id },
              { loading_slip_id: slip._id.toString() },
              { loading_slip_ids: slip._id },
              { loading_slip_ids: slip._id.toString() }
            ]
          });
          const bill = await Bill.findOne({
            $or: [
              { loading_slip_id: slip._id },
              { loading_slip_id: slip._id.toString() },
              { loading_slip_ids: slip._id },
              { loading_slip_ids: slip._id.toString() }
            ]
          });
          slipObj.memo_number = memo ? memo.memo_number : null;
          slipObj.memo_id = memo ? memo._id.toString() : null;
          slipObj.bill_number = bill ? bill.bill_number : null;
          slipObj.bill_id = bill ? bill._id.toString() : null;
        } catch (err) {
          slipObj.memo_number = null;
          slipObj.bill_number = null;
        }
        slipObj.id = slipObj._id.toString();
        return slipObj;
      })
    );

    res.json({
      loadingSlips: enrichedLoadingSlips,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get LRs error:', error);
    res.status(500).json({ message: 'Failed to fetch LRs', error: error.message });
  }
});

// Get LR by ID
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'LR not found (invalid ID)' });
    }
    const loadingSlip = await LoadingSlip.findById(req.params.id);
    if (!loadingSlip) return res.status(404).json({ message: 'LR not found' });
    const slipObj = loadingSlip.toObject();
    slipObj.id = slipObj._id.toString();
    res.json(slipObj);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch LR', error: error.message });
  }
});

// Create new LR
router.post('/', async (req, res) => {
  try {
    const loadingSlipData = req.body;

    if (!loadingSlipData.slip_number) {
      const branchCode = loadingSlipData.branch_code || 'AHD';
      loadingSlipData.slip_number = await generateLRNumber(branchCode);
      loadingSlipData.lr_number = loadingSlipData.slip_number;
    }

    // Sync legacy fields from LR fields
    if (!loadingSlipData.party && loadingSlipData.consignor_name) {
      loadingSlipData.party = loadingSlipData.consignor_name;
    }
    if (!loadingSlipData.supplier && loadingSlipData.owner_name) {
      loadingSlipData.supplier = loadingSlipData.owner_name;
    }
    if (!loadingSlipData.freight && loadingSlipData.freight_amount) {
      loadingSlipData.freight = loadingSlipData.freight_amount;
    }
    if (!loadingSlipData.total_freight) {
      loadingSlipData.total_freight = loadingSlipData.total_amount || loadingSlipData.freight_amount || 0;
    }

    const loadingSlip = new LoadingSlip(loadingSlipData);
    await loadingSlip.save();

    const slipObj = loadingSlip.toObject();
    slipObj.id = slipObj._id.toString();

    res.status(201).json({ message: 'LR created successfully', loadingSlip: slipObj });
  } catch (error) {
    console.error('Create LR error:', error);
    res.status(500).json({ message: 'Failed to create LR', error: error.message });
  }
});

// Update LR
router.put('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'LR not found (invalid ID)' });
    }
    const loadingSlip = await LoadingSlip.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!loadingSlip) return res.status(404).json({ message: 'LR not found' });
    const slipObj = loadingSlip.toObject();
    slipObj.id = slipObj._id.toString();
    res.json({ message: 'LR updated successfully', loadingSlip: slipObj });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update LR', error: error.message });
  }
});

// Delete LR
router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'LR not found (invalid ID)' });
    }
    const loadingSlip = await LoadingSlip.findByIdAndDelete(req.params.id);
    if (!loadingSlip) return res.status(404).json({ message: 'LR not found' });
    res.json({ message: 'LR deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete LR', error: error.message });
  }
});

export default router;
