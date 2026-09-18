import express from 'express';
import PODFile from '../models/PODFile.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all POD files
router.get('/', async (req, res) => {
  try {
    const { billNo, vehicleNo, party, page = 1, limit = 50 } = req.query;
    
    const filter = {};
    if (billNo) filter.billNo = new RegExp(billNo, 'i');
    if (vehicleNo) filter.vehicleNo = new RegExp(vehicleNo, 'i');
    if (party) filter.party = new RegExp(party, 'i');

    const podFiles = await PODFile.find(filter)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await PODFile.countDocuments(filter);

    res.json({
      podFiles,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get POD files error:', error);
    res.status(500).json({ message: 'Failed to fetch POD files', error: error.message });
  }
});

// Get POD file by ID
router.get('/:id', async (req, res) => {
  try {
    const podFile = await PODFile.findById(req.params.id);
    
    if (!podFile) {
      return res.status(404).json({ message: 'POD file not found' });
    }

    res.json(podFile);
  } catch (error) {
    console.error('Get POD file error:', error);
    res.status(500).json({ message: 'Failed to fetch POD file', error: error.message });
  }
});

// Upload new POD file
router.post('/', async (req, res) => {
  try {
    const podFile = new PODFile(req.body);
    await podFile.save();

    res.status(201).json({
      message: 'POD file uploaded successfully',
      podFile
    });
  } catch (error) {
    console.error('Upload POD file error:', error);
    res.status(500).json({ message: 'Failed to upload POD file', error: error.message });
  }
});

// Delete POD file
router.delete('/:id', async (req, res) => {
  try {
    const podFile = await PODFile.findByIdAndDelete(req.params.id);

    if (!podFile) {
      return res.status(404).json({ message: 'POD file not found' });
    }

    res.json({ message: 'POD file deleted successfully' });
  } catch (error) {
    console.error('Delete POD file error:', error);
    res.status(500).json({ message: 'Failed to delete POD file', error: error.message });
  }
});

export default router;
