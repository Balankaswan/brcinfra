import mongoose from 'mongoose';

// Sub-schema for multiple material items
const materialItemSchema = new mongoose.Schema({
  material_name: { type: String, trim: true },
  packing_type: { type: String, trim: true },
  no_of_articles: { type: Number, default: 0 },
  hsn_code: { type: String, trim: true },
  invoice_number: { type: String, trim: true },
  weight: { type: Number, default: 0 },
  value_of_goods: { type: Number, default: 0 }
}, { _id: false });

const loadingSlipSchema = new mongoose.Schema({

  // ─── EXISTING FIELDS (preserved, required relaxed for new LR flow) ───
  slip_number: { type: String, required: true, unique: true, trim: true },
  date: { type: Date, required: true },
  party: { type: String, trim: true, default: '' },
  vehicle_no: { type: String, trim: true, default: '' },
  from_location: { type: String, trim: true, default: '' },
  to_location: { type: String, trim: true, default: '' },
  material: { type: String, trim: true },
  dimension: { type: String, trim: true },
  weight: { type: Number, default: 0, min: 0 },
  supplier: { type: String, trim: true, default: '' },
  freight: { type: Number, default: 0, min: 0 },
  advance: { type: Number, default: 0, min: 0 },
  balance: { type: Number, default: 0 },
  rto: { type: Number, default: 0, min: 0 },
  total_freight: { type: Number, default: 0, min: 0 },
  narration: { type: String, trim: true },

  // ─── NEW LR FIELDS ───

  // LR Identity
  lr_number: { type: String, trim: true },
  branch_code: { type: String, trim: true, default: 'AHD' },
  financial_year: { type: String, trim: true },

  // Consignor Details
  consignor_name: { type: String, trim: true },
  consignor_contact: { type: String, trim: true },
  consignor_gstin: { type: String, trim: true },
  consignor_email: { type: String, trim: true },
  consignor_bank: { type: String, trim: true },
  consignor_address: { type: String, trim: true },

  // Consignee Details
  consignee_name: { type: String, trim: true },
  consignee_contact: { type: String, trim: true },
  consignee_gstin: { type: String, trim: true },
  consignee_email: { type: String, trim: true },
  consignee_bank: { type: String, trim: true },
  consignee_address: { type: String, trim: true },
  delivery_address: { type: String, trim: true },
  delivery_same_as_consignee: { type: Boolean, default: false },

  // Vehicle / Truck Details
  vehicle_type: { type: String, enum: ['Own Vehicle', 'Market Vehicle', ''], default: '' },
  vehicle_size: { type: String, trim: true },
  seal_number: { type: String, trim: true },
  eway_bill_number: { type: String, trim: true },
  eway_bill_expiry: { type: Date },

  // Driver Details
  driver_name: { type: String, trim: true },
  driver_number: { type: String, trim: true },
  dl_number: { type: String, trim: true },

  // Owner / Supplier Details
  owner_name: { type: String, trim: true },
  owner_number: { type: String, trim: true },
  owner_pan: { type: String, trim: true },
  owner_address: { type: String, trim: true },

  // Insurance
  insurance_status: { type: String, enum: ['not_insured', 'insured'], default: 'not_insured' },
  insurance_company: { type: String, trim: true },
  policy_number: { type: String, trim: true },
  insurance_amount: { type: Number, default: 0 },
  insurance_date: { type: Date },
  insurance_risk: { type: String, trim: true },
  gate_pass_number: { type: String, trim: true },

  // Demurrage
  demurrage_charge: { type: Number, default: 0 },
  demurrage_per: { type: String, enum: ['hour', 'day', ''], default: '' },
  demurrage_after: { type: String, trim: true },

  // Material Details
  material_type: { type: String, enum: ['single', 'multiple'], default: 'single' },
  materials: [materialItemSchema],

  // Single-item fields (used when material_type = 'single')
  packing_type: { type: String, trim: true },
  no_of_articles: { type: Number, default: 0 },
  hsn_code: { type: String, trim: true },
  invoice_number: { type: String, trim: true },
  invoice_date: { type: Date },
  goods_value: { type: Number, default: 0 },
  load_material_details: { type: String, trim: true },

  // Weight
  actual_weight: { type: Number, default: 0 },
  guarantee_weight: { type: Number, default: 0 },
  weight_unit: { type: String, enum: ['KG', 'MT', 'TON', 'NOS', ''], default: 'MT' },
  total_weight: { type: Number, default: 0 },

  // Freight / Charges
  freight_type: { type: String, enum: ['to_be_billed', 'to_pay', 'paid'], default: 'to_be_billed' },
  freight_rate: { type: Number, default: 0 },
  freight_fixed: { type: Boolean, default: false },
  freight_amount: { type: Number, default: 0 },
  halting_charge: { type: Number, default: 0 },
  door_to_door_charge: { type: Number, default: 0 },
  service_charge: { type: Number, default: 0 },
  other_charge: { type: Number, default: 0 },
  total_amount: { type: Number, default: 0 },
  advance_amount: { type: Number, default: 0 },
  balance_amount: { type: Number, default: 0 },

  // GST
  gst_paid_by: { type: String, enum: ['consignor', 'consignee', 'transporter', ''], default: '' },

  // Remarks
  remarks: { type: String, trim: true },

  // Billing status (set when Bill is created from this LR)
  bill_number: { type: String, trim: true, default: null },
  memo_number: { type: String, trim: true, default: null },

  // PDF Display Options
  pdf_options: {
    show_dala_hamali: { type: Boolean, default: false },
    hide_weight: { type: Boolean, default: false },
    hide_rate: { type: Boolean, default: false },
    hide_supplier: { type: Boolean, default: false },
    hide_datetime: { type: Boolean, default: false }
  }

}, {
  timestamps: true
});

// Calculate balance before saving
loadingSlipSchema.pre('save', function(next) {
  // Legacy balance
  this.balance = (this.freight || 0) - (this.advance || 0);

  // LR total amount and balance
  if (this.freight_amount) {
    this.total_amount = (this.freight_amount || 0)
      + (this.halting_charge || 0)
      + (this.door_to_door_charge || 0)
      + (this.service_charge || 0)
      + (this.other_charge || 0);
    this.balance_amount = this.total_amount - (this.advance_amount || 0);
  }

  // Mirror lr_number = slip_number for convenience
  if (!this.lr_number && this.slip_number) {
    this.lr_number = this.slip_number;
  }

  next();
});

export default mongoose.model('LoadingSlip', loadingSlipSchema);

