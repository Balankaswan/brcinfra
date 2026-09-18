import mongoose from 'mongoose';

const advancePaymentSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  amount: { type: Number, required: true, min: 0 },
  mode: { type: String, enum: ['cash', 'bank', 'other'], default: 'cash' },
  reference: { type: String, trim: true },
  description: { type: String, trim: true }
}, { _id: true });

const memoSchema = new mongoose.Schema({
  memo_number: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  loading_slip_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LoadingSlip',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  supplier: {
    type: String,
    required: true,
    trim: true
  },
  freight: {
    type: Number,
    required: true,
    min: 0
  },
  commission: {
    type: Number,
    default: 0,
    min: 0
  },
  mamool: {
    type: Number,
    default: 0,
    min: 0
  },
  detention: {
    type: Number,
    default: 0,
    min: 0
  },
  extra: {
    type: Number,
    default: 0,
    min: 0
  },
  rto: {
    type: Number,
    default: 0,
    min: 0
  },
  deduction: {
    type: Number,
    default: 0,
    min: 0
  },
  net_amount: {
    type: Number,
    default: 0
  },
  advance_payments: [advancePaymentSchema],
  status: {
    type: String,
    enum: ['pending', 'paid'],
    default: 'pending'
  },
  paid_date: {
    type: Date
  },
  paid_amount: {
    type: Number,
    min: 0
  },
  narration: {
    type: String,
    trim: true
  },
  is_downloaded: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Calculate net amount before saving
memoSchema.pre('save', function(next) {
  this.net_amount = this.freight - this.commission - this.mamool + this.detention + this.extra + this.rto - (this.deduction || 0);
  next();
});

export default mongoose.model('Memo', memoSchema);
