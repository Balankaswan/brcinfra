import mongoose from 'mongoose';

const advancePaymentSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  amount: { type: Number, required: true, min: 0 },
  mode: { type: String, enum: ['cash', 'bank', 'other'], default: 'cash' },
  reference: { type: String, trim: true },
  description: { type: String, trim: true }
}, { _id: true });

const billSchema = new mongoose.Schema({
  bill_number: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  loading_slip_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LoadingSlip',
    required: false   // relaxed so multi-LR bills can skip the single ID
  },
  // Multi-LR support (Point 44)
  loading_slip_ids: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LoadingSlip'
  }],
  linked_lr_numbers: [{ type: String, trim: true }],
  date: {
    type: Date,
    required: true
  },
  party: {
    type: String,
    required: true,
    trim: true
  },
  party_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Party',
    required: false
  },
  party_name: {
    type: String,
    trim: true,
    required: false
  },
  bill_amount: {
    type: Number,
    required: true,
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
  mamool: {
    type: Number,
    default: 0,
    min: 0
  },
  tds: {
    type: Number,
    default: 0,
    min: 0
  },
  penalties: {
    type: Number,
    default: 0,
    min: 0
  },
  party_commission_cut: {
    type: Number,
    default: 0,
    min: 0
  },
  commission: {
    type: Number,
    default: 0,
    min: 0
  },
  commission_rate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  net_amount: {
    type: Number,
    default: 0
  },
  totalFreight: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'received'],
    default: 'pending'
  },
  received_date: {
    type: Date
  },
  received_amount: {
    type: Number,
    min: 0
  },
  // pod_image removed to optimize storage
  advance_payments: [advancePaymentSchema],
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

// Calculate net amount and total freight before saving
billSchema.pre('save', function(next) {
  // Total freight: freight - mamool - commission + detention + rto + extra - tds - penalties
  this.totalFreight = this.bill_amount - this.mamool - this.commission + this.detention + this.rto + this.extra - this.tds - this.penalties;
  
  // Net amount for supplier payment (total freight minus party commission cut)
  this.net_amount = this.totalFreight - this.party_commission_cut;
  
  next();
});

export default mongoose.model('Bill', billSchema);
