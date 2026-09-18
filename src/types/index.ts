export interface MaterialItem {
  material_name?: string;
  packing_type?: string;
  no_of_articles?: number;
  hsn_code?: string;
  invoice_number?: string;
  weight?: number;
  value_of_goods?: number;
}

export interface LRPdfOptions {
  show_dala_hamali?: boolean;
  hide_weight?: boolean;
  hide_rate?: boolean;
  hide_supplier?: boolean;
  hide_datetime?: boolean;
}

export interface LoadingSlip {
  id: string;
  slip_number: string;
  date: string;
  // Legacy fields (preserved for backward compat)
  party: string;
  vehicle_no: string;
  from_location: string;
  to_location: string;
  material?: string;
  dimension?: string;
  weight: number;
  supplier: string;
  freight: number;
  advance: number;
  balance: number;
  rto: number;
  total_freight: number;
  narration?: string;
  // Billing status (set when Memo/Bill is created)
  memo_number?: string | null;
  memo_id?: string | null;
  bill_number?: string | null;
  bill_id?: string | null;
  created_at: string;
  updated_at: string;

  // ─── NEW LR FIELDS ───
  lr_number?: string;
  branch_code?: string;
  financial_year?: string;

  // Consignor
  consignor_name?: string;
  consignor_contact?: string;
  consignor_gstin?: string;
  consignor_email?: string;
  consignor_bank?: string;
  consignor_address?: string;

  // Consignee
  consignee_name?: string;
  consignee_contact?: string;
  consignee_gstin?: string;
  consignee_email?: string;
  consignee_bank?: string;
  consignee_address?: string;
  delivery_address?: string;
  delivery_same_as_consignee?: boolean;

  // Vehicle
  vehicle_type?: 'Own Vehicle' | 'Market Vehicle' | '';
  vehicle_size?: string;
  seal_number?: string;
  eway_bill_number?: string;
  eway_bill_expiry?: string;

  // Driver
  driver_name?: string;
  driver_number?: string;
  dl_number?: string;

  // Owner / Supplier
  owner_name?: string;
  owner_number?: string;
  owner_pan?: string;
  owner_address?: string;

  // Insurance
  insurance_status?: 'not_insured' | 'insured';
  insurance_company?: string;
  policy_number?: string;
  insurance_amount?: number;
  insurance_date?: string;
  insurance_risk?: string;
  gate_pass_number?: string;

  // Demurrage
  demurrage_charge?: number;
  demurrage_per?: 'hour' | 'day' | '';
  demurrage_after?: string;

  // Materials
  material_type?: 'single' | 'multiple';
  materials?: MaterialItem[];
  packing_type?: string;
  no_of_articles?: number;
  hsn_code?: string;
  invoice_number?: string;
  invoice_date?: string;
  goods_value?: number;
  load_material_details?: string;

  // Weight
  actual_weight?: number;
  guarantee_weight?: number;
  weight_unit?: 'KG' | 'MT' | 'TON' | 'NOS' | '';
  total_weight?: number;

  // Freight / Charges
  freight_type?: 'to_be_billed' | 'to_pay' | 'paid';
  freight_rate?: number;
  freight_fixed?: boolean;
  freight_amount?: number;
  halting_charge?: number;
  door_to_door_charge?: number;
  service_charge?: number;
  other_charge?: number;
  total_amount?: number;
  advance_amount?: number;
  balance_amount?: number;

  // GST
  gst_paid_by?: 'consignor' | 'consignee' | 'transporter' | '';

  // Remarks
  remarks?: string;

  // PDF Options
  pdf_options?: LRPdfOptions;
}


export interface Memo {
  id: string;
  memo_number: string;
  loading_slip_id: string;
  loading_slip_ids?: string[];
  linked_lr_numbers?: string[];
  date: string;
  supplier: string;
  supplier_id?: string;
  supplier_name?: string;
  supplier_contact?: string;
  supplier_phone?: string;
  supplier_pan?: string;
  supplier_gstin?: string;
  supplier_address?: string;
  vehicle_no?: string;
  driver_name?: string;
  driver_number?: string;
  freight: number;
  commission: number;
  commission_rate?: number;
  mamool: number;
  detention: number;
  extra: number;
  rto: number;
  deduction: number;
  net_amount: number;
  advance_payments: AdvancePayment[];
  status: 'pending' | 'paid';
  paid_date?: string;
  paid_amount?: number;
  narration?: string;
  is_downloaded?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Bill {
  totalFreight: number;
  id: string;
  bill_number: string;
  loading_slip_id: string;
  // Multi-LR support (Point 44)
  loading_slip_ids?: string[];
  linked_lr_numbers?: string[];
  date: string;
  party: string;
  party_id?: string;
  party_name?: string;
  // Extended party details (auto-filled from LR)
  party_contact?: string;
  party_gstin?: string;
  party_address?: string;
  // Extended supplier / lorry owner details (auto-filled from LR)
  supplier?: string;
  supplier_id?: string;
  supplier_contact?: string;
  supplier_pan?: string;
  supplier_address?: string;
  vehicle_no?: string;
  driver_name?: string;
  dl_number?: string;
  // Invoice metadata
  branch_code?: string;
  financial_year?: string;
  bill_amount: number;
  detention: number;
  extra: number;
  rto: number;
  mamool: number;
  tds: number;
  penalties: number;
  party_commission_cut: number;
  commission: number;
  commission_rate: number;
  net_amount: number;
  // GST fields
  hsn_code?: string;
  gst_type?: 'forward_charge' | 'reverse_charge' | '';
  gst_percentage?: number;
  gst_payable_by?: string;
  gst_amount?: number;
  total_invoice_value?: number;
  status: 'pending' | 'received';
  received_date?: string;
  received_amount?: number;
  // pod_image removed to optimize storage
  advance_payments?: AdvancePayment[];
  narration?: string;
  is_downloaded?: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdvancePayment {
  id: string;
  memo_id?: string;
  bill_id?: string;
  date: string;
  amount: number;
  mode?: 'cash' | 'bank' | 'other';
  reference?: string;
  description?: string;
  created_at?: string;
}

// (Removed duplicate LedgerEntry; see unified interface at bottom)

export interface BankingEntry {
  id: string;
  _id?: string; // MongoDB ObjectId
  type: 'credit' | 'debit';
  category: 'bill_advance' | 'bill_payment' | 'memo_advance' | 'memo_payment' | 'expense' | 'fuel_wallet' | 'fuel_wallet_credit' | 'vehicle_expense' | 'vehicle_credit_note' | 'party_payment' | 'supplier_payment' | 'party_commission' | 'party_on_account' | 'supplier_on_account' | 'party_debit_note' | 'supplier_debit_note' | 'other';
  amount: number;
  date: string;
  reference_id?: string; // bill_number or memo_number
  reference_name?: string; // party or supplier name
  narration: string;
  vehicle_no?: string; // for vehicle expenses
  created_at: string;
  updated_at?: string;
  memo_advance_id?: string;
  bill_advance_id?: string;
  bank_account?: string;
  payment_mode?: 'cash' | 'bank' | 'cheque' | 'bank_transfer' | 'upi';
}

export interface CashbookEntry {
  id: string;
  _id?: string; // MongoDB ObjectId
  type: 'credit' | 'debit';
  category: 'vehicle_expense' | 'vehicle_credit_note' | 'office_expense' | 'fuel_expense' | 'maintenance' | 'salary' | 'party_on_account' | 'party_commission' | 'party_payment' | 'supplier_payment' | 'supplier_on_account' | 'bill_payment' | 'bill_advance' | 'memo_advance' | 'memo_payment' | 'other';
  amount: number;
  date: string;
  reference_id?: string;
  reference_name?: string;
  narration: string;
  vehicle_no?: string;
  party_id?: string;
  party_name?: string;
  supplier_id?: string;
  supplier_name?: string;
  memo_id?: string;
  bill_id?: string;
  trip_id?: string;
  payment_mode: 'cash';
  running_balance: number;
  created_at: string;
  updated_at?: string;
}

export interface Party {
  id: string;
  _id?: string;
  name: string;
  gstin?: string;
  gst_number?: string;
  address?: string;
  contact?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  _id?: string;
  name: string;
  address?: string;
  contact?: string;
  contact_person?: string;
  phone?: string;
  created_at: string;
}

export interface PODFile {
  id: string;
  filename: string;
  fileData: string; // Base64 encoded file data
  fileType: string; // MIME type
  billNo?: string;
  vehicleNo?: string;
  party?: string;
  uploadDate: string;
  created_at: string;
}

export interface LedgerEntry {
  id: string;
  _id?: string;
  referenceId?: string;
  type?: 'memo' | 'payment' | 'bill' | 'expense' | 'commission';
  vehicleNo?: string;
  partyId?: string;
  supplierId?: string;
  memoNumber?: string;
  ledger_type?: 'party' | 'supplier' | 'general' | 'fuel_wallet' | 'vehicle_fuel' | 'vehicle_income' | 'vehicle_expense' | 'commission' | 'mamul' | 'detention' | 'toll' | 'rto_fine' | 'pod_charges';
  reference_id?: string; // bill_number or memo_number or other ref
  reference_name?: string; // party or supplier name
  date: string;
  description?: string;
  narration?: string;
  debit: number;
  credit: number;
  debit_amount?: number;
  credit_amount?: number;
  balance?: number;
  source_type?: 'banking' | 'cashbook' | 'memo' | 'bill' | 'fuel';
  source_id?: string;
  created_at?: string;
  // Trip-related optional fields
  loading_slip_id?: string;
  memo_number?: string;
  bill_number?: string;
  from_location?: string;
  to_location?: string;
  vehicle_no?: string;
}


// Fuel Accounting Types
export interface FuelWallet {
  id: string;
  name: string; // e.g., 'BPCL', 'HPCL', 'IOCL'
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface FuelTransaction {
  id: string;
  type: 'wallet_credit' | 'fuel_allocation';
  wallet_name: string; // BPCL, HPCL, etc.
  amount: number;
  date: string;
  vehicle_no?: string; // For fuel allocation
  reference_id?: string;
  narration: string;
  supplier_name?: string; // For fuel allocation with supplier
  created_at: string;
}

export interface Vehicle {
  id: string;
  _id?: string;
  vehicle_no: string;
  vehicle_type?: string; // Truck, Trailer, etc.
  ownership_type?: 'own' | 'market';
  owner_name?: string;
  driver_name?: string;
  driver_phone?: string;
  fitness_expiry?: string;
  insurance_expiry?: string;
  permit_expiry?: string;
  puc_expiry?: string;
  tax_expiry?: string;
  created_at: string;
  updated_at: string;
}

export interface VehicleFuelExpense {
  id: string;
  vehicle_no: string;
  wallet_name: string;
  amount: number;
  date: string;
  fuel_quantity?: number;
  rate_per_liter?: number;
  odometer_reading?: number;
  narration?: string;
  created_at: string;
}