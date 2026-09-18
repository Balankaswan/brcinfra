import mongoose from 'mongoose';

const podFileSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
    trim: true
  },
  fileData: {
    type: String,
    required: true // Base64 encoded file data
  },
  fileType: {
    type: String,
    required: true,
    trim: true
  },
  billNo: {
    type: String,
    trim: true
  },
  vehicleNo: {
    type: String,
    trim: true
  },
  party: {
    type: String,
    trim: true
  },
  uploadDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Add index to improve query performance and avoid sort memory issues
podFileSchema.index({ uploadDate: -1 });

export default mongoose.model('PODFile', podFileSchema);
