import express from 'express';
import { getNextNumbers } from '../utils/autoIncrement.js';

const router = express.Router();

// Get next available numbers for all document types
router.get('/next-numbers', async (req, res) => {
  try {
    const nextNumbers = await getNextNumbers();
    
    res.json({
      success: true,
      data: nextNumbers
    });
  } catch (error) {
    console.error('Get next numbers error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get next numbers', 
      error: error.message 
    });
  }
});

export default router;
