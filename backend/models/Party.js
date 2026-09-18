import mongoose from 'mongoose';

const partySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  contact: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  gst_number: {
    type: String,
    trim: true
  },
  pan_number: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

export default mongoose.model('Party', partySchema);
