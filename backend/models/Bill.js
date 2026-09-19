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
  // Multi-LR support
  loading_slip_ids: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LoadingSlip'
  }],
  linked_lr_numbers: [{ type: String, trim: true }],

  date: { type: Date, required: true },
  branch_code: { type: String, trim: true },
  financial_year: { type: String, trim: true },

  // Party (billing company)
  party: { type: String, required: true, trim: true },
  party_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: false },
  party_name: { type: String, trim: true, required: false },
  party_contact: { type: String, trim: true },
  party_gstin: { type: String, trim: true },
  party_address: { type: String, trim: true },

  // Supplier / Lorry Owner
  supplier: { type: String, trim: true },
  supplier_contact: { type: String, trim: true },
  supplier_pan: { type: String, trim: true },
  supplier_address: { type: String, trim: true },
  vehicle_no: { type: String, trim: true },
  driver_name: { type: String, trim: true },
  dl_number: { type: String, trim: true },

  // Core freight
  bill_amount: { type: Number, required: true, min: 0 },
  detention: { type: Number, default: 0, min: 0 },
  extra: { type: Number, default: 0, min: 0 },
  rto: { type: Number, default: 0, min: 0 },

  // Per-charge taxability flags
  detention_taxable: { type: Boolean, default: true },
  extra_taxable: { type: Boolean, default: true },
  rto_taxable: { type: Boolean, default: false },

  // GST fields — all stored persistently so PDF/ledger never recalculate
  hsn_code: { type: String, trim: true, default: '996511' },
  gst_type: {
    type: String,
    enum: ['forward_charge', 'reverse_charge', ''],
    default: 'forward_charge'
  },
  gst_percentage: { type: Number, default: 0, min: 0, max: 28 },
  gst_payable_by: { type: String, trim: true },

  // GST breakdown
  gst_amount: { type: Number, default: 0, min: 0 },       // total GST (cgst+sgst or igst)
  gst_tax_type: {
    type: String,
    enum: ['cgst_sgst', 'igst'],
    default: 'igst'
  },
  cgst_amount: { type: Number, default: 0, min: 0 },
  sgst_amount: { type: Number, default: 0, min: 0 },
  igst_amount: { type: Number, default: 0, min: 0 },
  taxable_value: { type: Number, default: 0, min: 0 },
  non_taxable_amount: { type: Number, default: 0, min: 0 },
  gross_invoice_amount: { type: Number, default: 0, min: 0 },
  total_invoice_value: { type: Number, default: 0, min: 0 },

  // Deductions
  mamool: { type: Number, default: 0, min: 0 },
  tds: { type: Number, default: 0, min: 0 },
  penalties: { type: Number, default: 0, min: 0 },
  party_commission_cut: { type: Number, default: 0, min: 0 },
  commission: { type: Number, default: 0, min: 0 },
  commission_rate: { type: Number, default: 0, min: 0, max: 100 },

  // Computed totals (authoritative values set by pre-save hook)
  net_amount: { type: Number, default: 0 },
  totalFreight: { type: Number, default: 0 },   // legacy compat

  status: {
    type: String,
    enum: ['pending', 'received'],
    default: 'pending'
  },
  received_date: { type: Date },
  received_amount: { type: Number, min: 0 },

  // pod_image removed to optimize storage
  advance_payments: [advancePaymentSchema],
  narration: { type: String, trim: true },
  is_downloaded: { type: Boolean, default: false }
}, {
  timestamps: true
});

// ─── Pre-save hook: compute gross_invoice_amount and net_amount including GST ───
billSchema.pre('save', function(next) {
  const isRCM = this.gst_type === 'reverse_charge';

  // Taxable portion of each charge
  const detentionTax = this.detention_taxable !== false ? (this.detention || 0) : 0;
  const extraTax     = this.extra_taxable     !== false ? (this.extra     || 0) : 0;
  const rtoTax       = this.rto_taxable       === true  ? (this.rto       || 0) : 0;
  const taxableVal   = (this.bill_amount || 0) + detentionTax + extraTax + rtoTax;

  this.taxable_value = taxableVal;

  // If frontend already sent gst_amount, trust it; otherwise compute from rate
  if (!(this.gst_amount > 0) && this.gst_percentage > 0) {
    const computedGst = (taxableVal * this.gst_percentage) / 100;
    this.gst_amount = computedGst;
    if (this.gst_tax_type === 'cgst_sgst') {
      this.cgst_amount = computedGst / 2;
      this.sgst_amount = computedGst / 2;
      this.igst_amount = 0;
    } else {
      this.igst_amount = computedGst;
      this.cgst_amount = 0;
      this.sgst_amount = 0;
    }
  }

  // Forward Charge: GST is charged to party → added to gross invoice
  // Reverse Charge (RCM): GST is NOT added to party's invoice amount
  const grossInvoice = taxableVal + (isRCM ? 0 : (this.gst_amount || 0));
  this.gross_invoice_amount = grossInvoice;
  this.total_invoice_value  = grossInvoice;

  // Net payable = gross invoice − deductions
  const deductions = (this.mamool || 0) + (this.commission || 0) + (this.tds || 0)
                   + (this.penalties || 0) + (this.party_commission_cut || 0);
  this.net_amount   = grossInvoice - deductions;
  this.totalFreight = this.net_amount;   // legacy

  next();
});

export default mongoose.model('Bill', billSchema);
