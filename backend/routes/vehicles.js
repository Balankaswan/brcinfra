import express from 'express';
import Vehicle from '../models/Vehicle.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Disable authentication for debugging
router.use((req, res, next) => {
  console.log(`Vehicles route: ${req.method} ${req.path}`);
  next(); // Skip authentication completely
});

// Get all vehicles
router.get('/', async (req, res) => {
  try {
    const { ownership_type, search, page = 1, limit = 50 } = req.query;
    
    const filter = {};
    if (ownership_type) filter.ownership_type = ownership_type;
    if (search) {
      filter.$or = [
        { vehicle_no: new RegExp(search, 'i') },
        { owner_name: new RegExp(search, 'i') },
        { driver_name: new RegExp(search, 'i') }
      ];
    }

    const vehicles = await Vehicle.find(filter)
      .sort({ vehicle_no: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Vehicle.countDocuments(filter);

    res.json({
      vehicles,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get vehicles error:', error);
    res.status(500).json({ message: 'Failed to fetch vehicles', error: error.message });
  }
});

// Get vehicle by ID
router.get('/:id', async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    res.json(vehicle);
  } catch (error) {
    console.error('Get vehicle error:', error);
    res.status(500).json({ message: 'Failed to fetch vehicle', error: error.message });
  }
});

// Create new vehicle
router.post('/', async (req, res) => {
  try {
    const vehicle = new Vehicle(req.body);
    await vehicle.save();

    res.status(201).json({
      message: 'Vehicle created successfully',
      vehicle
    });
  } catch (error) {
    console.error('Create vehicle error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Vehicle with this number already exists' });
    }
    res.status(500).json({ message: 'Failed to create vehicle', error: error.message });
  }
});

// Update vehicle
router.put('/:id', async (req, res) => {
  try {
    const vehicle = await Vehicle.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    res.json({
      message: 'Vehicle updated successfully',
      vehicle
    });
  } catch (error) {
    console.error('Update vehicle error:', error);
    res.status(500).json({ message: 'Failed to update vehicle', error: error.message });
  }
});

// Delete vehicle
router.delete('/:id', async (req, res) => {
  try {
    const vehicle = await Vehicle.findByIdAndDelete(req.params.id);

    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    res.json({ message: 'Vehicle deleted successfully' });
  } catch (error) {
    console.error('Delete vehicle error:', error);
    res.status(500).json({ message: 'Failed to delete vehicle', error: error.message });
  }
});

export default router;
