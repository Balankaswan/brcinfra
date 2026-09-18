import mongoose from 'mongoose';

const partyCommissionLedgerSchema = new mongoose.Schema({
  party_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Party',
    required: true
  },
  party_name: {
    type: String,
    required: true
  },
  bill_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill',
    required: false
  },
  banking_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankingEntry',
    required: false
  },
  bill_number: {
    type: String,
    required: false
  },
  reference_id: {
    type: String,
    required: false
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  entry_type: {
    type: String,
    enum: ['credit', 'debit'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  narration: {
    type: String,
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient querying by party
partyCommissionLedgerSchema.index({ party_id: 1, date: 1 });
partyCommissionLedgerSchema.index({ party_id: 1, bill_number: 1 });
partyCommissionLedgerSchema.index({ date: 1 });
partyCommissionLedgerSchema.index({ bill_number: 1 });

export default mongoose.model('PartyCommissionLedger', partyCommissionLedgerSchema);
