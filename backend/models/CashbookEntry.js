import mongoose from 'mongoose';

const cashbookEntrySchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['debit', 'credit']
  },
  category: {
    type: String,
    required: true,
    enum: [
      'vehicle_expense',
      'vehicle_credit_note',
      'office_expense', 
      'fuel_expense',
      'maintenance',
      'salary',
      'party_on_account',
      'party_commission',
      'supplier_payment',
      'supplier_on_account',
      'bill_advance',
      'bill_payment',
      'memo_advance',
      'memo_payment',
      'party_payment',
      'other'
    ]
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  reference_id: {
    type: String,
    index: true
  },
  reference_name: {
    type: String,
    index: true
  },
  narration: {
    type: String,
    required: true
  },
  vehicle_no: {
    type: String,
    index: true
  },
  party_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Party'
  },
  party_name: {
    type: String
  },
  supplier_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  supplier_name: {
    type: String
  },
  memo_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Memo'
  },
  bill_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill'
  },
  trip_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LoadingSlip'
  },
  payment_mode: {
    type: String,
    default: 'cash',
    enum: ['cash']
  },
  // Transaction ID for linking with ledger entries
  transaction_id: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  // Running balance tracking
  running_balance: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
cashbookEntrySchema.index({ date: -1, createdAt: -1 });
cashbookEntrySchema.index({ category: 1, date: -1 });
cashbookEntrySchema.index({ vehicle_no: 1, date: -1 });
cashbookEntrySchema.index({ party_id: 1, date: -1 });
cashbookEntrySchema.index({ supplier_id: 1, date: -1 });

// Pre-save middleware to calculate running balance
cashbookEntrySchema.pre('save', async function(next) {
  if (this.isNew) {
    // Get the last entry to calculate running balance
    const lastEntry = await this.constructor.findOne({}, {}, { sort: { date: -1, createdAt: -1 } });
    const previousBalance = lastEntry ? lastEntry.running_balance : 0;
    
    // Calculate new running balance
    if (this.type === 'credit') {
      this.running_balance = previousBalance + this.amount;
    } else {
      this.running_balance = previousBalance - this.amount;
    }
  }
  next();
});

export default mongoose.model('CashbookEntry', cashbookEntrySchema);
