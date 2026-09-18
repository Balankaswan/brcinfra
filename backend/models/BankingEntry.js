import mongoose from 'mongoose';

const bankingEntrySchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['credit', 'debit'],
    required: true
  },
  category: {
    type: String,
    enum: [
      'bill_advance', 'bill_payment', 'memo_advance', 'memo_payment', 
      'expense', 'fuel_wallet', 'fuel_wallet_credit', 'vehicle_expense', 
      'vehicle_credit_note', 'party_payment', 'supplier_payment', 'party_commission', 
      'party_on_account', 'supplier_on_account', 'party_debit_note', 'supplier_debit_note', 'other'
    ],
    required: true
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
  reference_id: {
    type: String,
    trim: true
  },
  reference_name: {
    type: String,
    trim: true
  },
  narration: {
    type: String,
    required: true,
    trim: true
  },
  vehicle_no: {
    type: String,
    trim: true
  },
  bank_account: {
    type: String,
    trim: true
  },
  payment_mode: {
    type: String,
    enum: ['cash', 'bank', 'cheque', 'bank_transfer', 'upi'],
    default: 'bank'
  },
  memo_advance_id: {
    type: String
  },
  bill_advance_id: {
    type: String
  }
}, {
  timestamps: true
});

export default mongoose.model('BankingEntry', bankingEntrySchema);
