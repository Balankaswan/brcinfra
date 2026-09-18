import mongoose from 'mongoose';

const fuelTransactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['wallet_credit', 'fuel_allocation'],
    required: true
  },
  wallet_name: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  date: {
    type: Date,
    required: true
  },
  vehicle_no: {
    type: String,
    trim: true
  },
  reference_id: {
    type: String,
    trim: true
  },
  narration: {
    type: String,
    required: true,
    trim: true
  },
  fuel_quantity: {
    type: Number,
    min: 0
  },
  rate_per_liter: {
    type: Number,
    min: 0
  },
  odometer_reading: {
    type: Number,
    min: 0
  },
  fuel_type: {
    type: String,
    enum: ['Diesel', 'Petrol', 'CNG', 'Other'],
    default: 'Diesel'
  },
  allocated_by: {
    type: String,
    trim: true
  },
  supplier_name: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

export default mongoose.model('FuelTransaction', fuelTransactionSchema);
