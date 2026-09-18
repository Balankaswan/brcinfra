import mongoose from 'mongoose';

const ledgerEntrySchema = new mongoose.Schema({
  referenceId: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    index: true
  },
  reference_id: {
    type: String,
    index: true
  },
  ledger_type: {
    type: String,
    enum: ['general', 'party', 'supplier', 'vehicle', 'vehicle_income', 'vehicle_expense', 'commission'],
    default: 'general'
  },
  reference_name: {
    type: String
  },
  source_type: {
    type: String,
    enum: ['memo', 'bill', 'banking', 'cashbook', 'fuel', 'manual', 'debit_note']
  },
  type: {
    type: String,
    required: true,
    enum: ['memo', 'payment', 'bill', 'expense', 'commission', 'party', 'on_account', 'adjustment']
  },
  vehicleNo: {
    type: String,
    index: true
  },
  vehicle_no: {
    type: String,
    index: true
  },
  partyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Party'
  },
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  description: {
    type: String,
    required: true
  },
  memoNumber: {
    type: String
  },
  memo_number: {
    type: String
  },
  debit: {
    type: Number,
    default: 0,
    min: 0
  },
  credit: {
    type: Number,
    default: 0,
    min: 0
  },
  balance: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
ledgerEntrySchema.index({ vehicleNo: 1, date: 1 });
ledgerEntrySchema.index({ partyId: 1, date: 1 });
ledgerEntrySchema.index({ supplierId: 1, date: 1 });

export default mongoose.model('LedgerEntry', ledgerEntrySchema);
