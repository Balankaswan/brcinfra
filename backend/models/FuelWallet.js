import mongoose from 'mongoose';

const fuelWalletSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

export default mongoose.model('FuelWallet', fuelWalletSchema);
