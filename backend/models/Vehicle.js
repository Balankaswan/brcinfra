import mongoose from 'mongoose';

const vehicleSchema = new mongoose.Schema({
  vehicle_no: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  vehicle_type: {
    type: String,
    trim: true,
    default: 'Truck'
  },
  ownership_type: {
    type: String,
    enum: ['own', 'market'],
    required: true,
    default: 'market'
  },
  owner_name: {
    type: String,
    trim: true
  },
  driver_name: {
    type: String,
    trim: true
  },
  driver_phone: {
    type: String,
    trim: true
  },
  capacity: {
    type: Number,
    min: 0
  },
  model: {
    type: String,
    trim: true
  },
  year: {
    type: Number
  },
  fitness_expiry: {
    type: Date
  },
  insurance_expiry: {
    type: Date
  },
  permit_expiry: {
    type: Date
  },
  puc_expiry: {
    type: Date
  },
  tax_expiry: {
    type: Date
  }
}, {
  timestamps: true
});

export default mongoose.model('Vehicle', vehicleSchema);
