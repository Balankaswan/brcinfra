import React, { useState, useEffect, useMemo } from 'react';
import { X, Calculator, Upload, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { formatCurrency } from '../../utils/numberGenerator';
import PDFGenerator from '../PDFGenerator';
import { apiService } from '../../lib/api';
import { useDataStore } from '../../lib/store';
import { COMPANY_CONFIG } from '../../config/companyConfig';
import type { LoadingSlip, Bill } from '../../types';

interface BillFormProps {
  loadingSlip?: LoadingSlip;
  selectedSlips?: LoadingSlip[];
  nextBillNumber: string;
  initialData?: Bill | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

// Helper: compute current financial year string e.g. "26-27"
const getCurrentFinancialYear = (): string => {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();
  const fy = month >= 4 ? year : year - 1;
  return `${String(fy).slice(-2)}-${String(fy + 1).slice(-2)}`;
};

// Detect intra vs inter state from party GSTIN
const detectGstTaxType = (partyGstin: string): 'cgst_sgst' | 'igst' => {
  if (!partyGstin || partyGstin.length < 2) return 'igst';
  const partyState = partyGstin.substring(0, 2);
  return partyState === COMPANY_CONFIG.stateCode ? 'cgst_sgst' : 'igst';
};

const SectionHeader: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <div className="flex items-center justify-between bg-gray-100 border border-gray-200 rounded px-3 py-2 mb-4">
    <span className="text-sm font-semibold text-gray-700">{title}</span>
    {children}
  </div>
);

const BillForm: React.FC<BillFormProps> = ({ loadingSlip, selectedSlips, nextBillNumber, initialData, onSubmit, onCancel }) => {
  const { parties, loadingSlips: allSlips } = useDataStore();
  const [showShipping, setShowShipping] = useState(false);
  const [podFileName, setPodFileName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedLrIds, setSelectedLrIds] = useState<string[]>(() => {
    if (selectedSlips && selectedSlips.length > 0) {
      return selectedSlips.map(s => String(s.id || (s as any)._id));
    }
    if (loadingSlip) {
      return [String(loadingSlip.id || (loadingSlip as any)._id)];
    }
    if (initialData) {
      const ids = initialData.loading_slip_ids && initialData.loading_slip_ids.length > 0
        ? initialData.loading_slip_ids
        : (initialData.loading_slip_id ? [typeof initialData.loading_slip_id === 'object' ? (initialData.loading_slip_id as any)._id || (initialData.loading_slip_id as any).id : initialData.loading_slip_id] : []);
      return ids.map(id => String(id));
    }
    return [];
  });
  const [showLrManager, setShowLrManager] = useState(false);

  const activeSlips = useMemo(() => {
    if (!allSlips) return [];
    return allSlips.filter(s => {
      const id = String(s.id || (s as any)._id);
      return selectedLrIds.includes(id);
    });
  }, [allSlips, selectedLrIds]);

  const primarySlip = activeSlips[0];

  // eligibleLrsForParty is declared AFTER formData state to avoid TDZ crash

  const handleToggleLrSelection = (lrId: string) => {
    const nextSelected = selectedLrIds.includes(lrId)
      ? selectedLrIds.filter(id => id !== lrId)
      : [...selectedLrIds, lrId];

    setSelectedLrIds(nextSelected);

    const newActiveSlips = (allSlips || []).filter(s => {
      const sId = String(s.id || (s as any)._id);
      return nextSelected.includes(sId);
    });

    const newFreight = newActiveSlips.reduce((sum, s) => sum + (s.total_amount || s.total_freight || s.freight || 0), 0);
    const newDetention = newActiveSlips.reduce((sum, s) => sum + (s.demurrage_charge || 0), 0);
    const newRto = newActiveSlips.reduce((sum, s) => sum + (s.rto || 0), 0);
    const newVehicles = Array.from(new Set(newActiveSlips.map(s => s.vehicle_no).filter(Boolean))).join(', ');

    setFormData(prev => ({
      ...prev,
      loading_slip_id: newActiveSlips[0]?.id || '',
      loading_slip_ids: nextSelected,
      linked_lr_numbers: newActiveSlips.map(s => s.lr_number || s.slip_number),
      bill_amount: newFreight,
      detention: newDetention,
      rto: newRto,
      vehicle_no: newVehicles || prev.vehicle_no,
    }));
  };

  // Build party master lookup
  const knownParties = useMemo(() => {
    const map = new Map<string, { name: string; gstin: string; address: string; contact: string }>();
    (parties || []).forEach(p => {
      if (p.name) {
        map.set(p.name.trim().toLowerCase(), {
          name: p.name,
          gstin: p.gstin || p.gst_number || '',
          address: p.address || '',
          contact: p.contact || p.phone || '',
        });
      }
    });
    (allSlips || []).forEach(ls => {
      if (ls.consignor_name && !map.has(ls.consignor_name.trim().toLowerCase())) {
        map.set(ls.consignor_name.trim().toLowerCase(), {
          name: ls.consignor_name,
          gstin: ls.consignor_gstin || '',
          address: ls.consignor_address || '',
          contact: ls.consignor_contact || '',
        });
      }
    });
    return Array.from(map.values());
  }, [parties, allSlips]);

  // ── Form state ──
  const [formData, setFormData] = useState({
    // Invoice metadata
    bill_number: initialData ? initialData.bill_number : nextBillNumber,
    date: primarySlip?.date
      ? new Date(primarySlip.date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    branch_code: initialData?.branch_code || COMPANY_CONFIG.defaultBranchCode,
    financial_year: initialData?.financial_year || getCurrentFinancialYear(),

    // LR references
    loading_slip_id: primarySlip?.id || '',
    loading_slip_ids: activeSlips.map(s => s.id),
    linked_lr_numbers: activeSlips.map(s => s.lr_number || s.slip_number),

    // Billing party (auto-filled from LR consignor)
    party: initialData?.party || primarySlip?.consignor_name || primarySlip?.party || '',
    party_contact: initialData?.party_contact || primarySlip?.consignor_contact || '',
    party_gstin: initialData?.party_gstin || primarySlip?.consignor_gstin || '',
    party_address: initialData?.party_address || primarySlip?.consignor_address || '',

    // Supplier / Lorry Owner details (auto-filled from LR)
    supplier: initialData?.supplier || primarySlip?.supplier || primarySlip?.owner_name || '',
    supplier_contact: initialData?.supplier_contact || primarySlip?.owner_number || primarySlip?.driver_number || '',
    supplier_pan: initialData?.supplier_pan || primarySlip?.owner_pan || '',
    supplier_address: initialData?.supplier_address || primarySlip?.owner_address || '',
    vehicle_no: initialData?.vehicle_no || primarySlip?.vehicle_no || (primarySlip as any)?.truck_number || '',
    driver_name: initialData?.driver_name || primarySlip?.driver_name || '',
    dl_number: initialData?.dl_number || primarySlip?.dl_number || '',

    // Freight (base taxable)
    bill_amount: initialData?.bill_amount
      ?? activeSlips.reduce((sum, s) => sum + (s.total_amount || s.total_freight || s.freight || 0), 0),

    // Additional charges
    detention: initialData?.detention ?? activeSlips.reduce((sum, s) => sum + (s.demurrage_charge || 0), 0),
    extra: initialData?.extra ?? 0,
    rto: initialData?.rto ?? activeSlips.reduce((sum, s) => sum + (s.rto || 0), 0),

    // Taxability flags — freight always taxable; rto default non-taxable
    detention_taxable: initialData?.detention_taxable ?? true,
    extra_taxable: initialData?.extra_taxable ?? true,
    rto_taxable: initialData?.rto_taxable ?? false,

    // GST
    hsn_code: initialData?.hsn_code || primarySlip?.hsn_code || COMPANY_CONFIG.sacCode,
    gst_type: (initialData?.gst_type || COMPANY_CONFIG.defaultGstType) as 'forward_charge' | 'reverse_charge',
    gst_percentage: initialData?.gst_percentage ?? 5,
    gst_payable_by: initialData?.gst_payable_by || primarySlip?.gst_paid_by || '',
    // Intra/Inter-state detection
    gst_tax_type: (initialData?.gst_tax_type ||
      detectGstTaxType(initialData?.party_gstin || primarySlip?.consignor_gstin || '')) as 'cgst_sgst' | 'igst',

    // Computed (auto-calculated)
    taxable_value: initialData?.taxable_value ?? 0,
    non_taxable_amount: initialData?.non_taxable_amount ?? 0,
    gst_amount: initialData?.gst_amount ?? 0,
    cgst_amount: initialData?.cgst_amount ?? 0,
    sgst_amount: initialData?.sgst_amount ?? 0,
    igst_amount: initialData?.igst_amount ?? 0,
    gross_invoice_amount: initialData?.gross_invoice_amount ?? 0,
    total_invoice_value: initialData?.total_invoice_value ?? 0,

    // Deductions
    mamool: initialData?.mamool ?? 0,
    tds: initialData?.tds ?? 0,
    penalties: initialData?.penalties ?? 0,
    party_commission_cut: initialData?.party_commission_cut ?? 0,
    commission: initialData?.commission ?? 0,

    // Result
    net_amount: initialData?.net_amount ?? 0,

    // Misc
    pod_image: '',
    status: (initialData?.status || 'pending') as 'pending' | 'received',
    narration: initialData?.narration || '',
  });

  // ── Eligible LRs for the current party (must be AFTER formData state to avoid TDZ) ──
  const eligibleLrsForParty = useMemo(() => {
    if (!allSlips) return [];
    const partyName = (formData.party || '').trim().toLowerCase();
    return allSlips.filter(s => {
      const id = String(s.id || (s as any)._id);
      const isAlreadySelected = selectedLrIds.includes(id);
      const sParty = (s.consignor_name || s.party || '').trim().toLowerCase();
      const matchesParty = !partyName || sParty === partyName;
      const isUnbilled = !s.bill_number || s.bill_number === formData.bill_number;
      return isAlreadySelected || (matchesParty && isUnbilled);
    });
  }, [allSlips, formData.party, formData.bill_number, selectedLrIds]);

  // ── Auto-calculate GST + invoice values ──
  useEffect(() => {
    const freight = formData.bill_amount;
    const detentionAmt = formData.detention_taxable ? formData.detention : 0;
    const extraAmt = formData.extra_taxable ? formData.extra : 0;
    const rtoAmt = formData.rto_taxable ? formData.rto : 0;

    // Non-taxable portion
    const detentionNT = formData.detention_taxable ? 0 : formData.detention;
    const extraNT = formData.extra_taxable ? 0 : formData.extra;
    const rtoNT = formData.rto_taxable ? 0 : formData.rto;
    const nonTaxable = detentionNT + extraNT + rtoNT;

    const taxableVal = freight + detentionAmt + extraAmt + rtoAmt;
    const gstAmt = (taxableVal * (formData.gst_percentage || 0)) / 100;

    let cgst = 0, sgst = 0, igst = 0;
    if (formData.gst_tax_type === 'cgst_sgst') {
      cgst = gstAmt / 2;
      sgst = gstAmt / 2;
    } else {
      igst = gstAmt;
    }

    // For Forward Charge: GST is added to gross invoice
    // For RCM: GST is NOT added to gross invoice (shown as disclosure only)
    const grossInvoice = formData.gst_type === 'forward_charge'
      ? taxableVal + gstAmt
      : taxableVal;

    // Net payable = gross invoice - deductions (TDS + mamool + commission + penalties + party_commission_cut)
    const deductions = formData.mamool + formData.commission + formData.tds + formData.penalties + formData.party_commission_cut;
    const net = grossInvoice - deductions;

    setFormData(prev => ({
      ...prev,
      taxable_value: taxableVal,
      non_taxable_amount: nonTaxable,
      gst_amount: gstAmt,
      cgst_amount: cgst,
      sgst_amount: sgst,
      igst_amount: igst,
      gross_invoice_amount: grossInvoice,
      total_invoice_value: grossInvoice,
      net_amount: net,
    }));
  }, [
    formData.bill_amount, formData.detention, formData.extra, formData.rto,
    formData.detention_taxable, formData.extra_taxable, formData.rto_taxable,
    formData.gst_percentage, formData.gst_type, formData.gst_tax_type,
    formData.mamool, formData.commission, formData.tds, formData.penalties, formData.party_commission_cut,
  ]);

  // ── Re-detect tax type when party GSTIN changes ──
  useEffect(() => {
    const detected = detectGstTaxType(formData.party_gstin);
    setFormData(prev => ({ ...prev, gst_tax_type: detected }));
  }, [formData.party_gstin]);

  // ── Re-populate when initialData changes (edit mode) ──
  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({
        ...prev,
        bill_number: initialData.bill_number,
        loading_slip_id: initialData.loading_slip_id,
        loading_slip_ids: initialData.loading_slip_ids || [initialData.loading_slip_id],
        linked_lr_numbers: initialData.linked_lr_numbers || [],
        date: initialData.date.split('T')[0],
        branch_code: initialData.branch_code || COMPANY_CONFIG.defaultBranchCode,
        financial_year: initialData.financial_year || getCurrentFinancialYear(),
        party: initialData.party,
        party_contact: initialData.party_contact || '',
        party_gstin: initialData.party_gstin || '',
        party_address: initialData.party_address || '',
        bill_amount: initialData.bill_amount,
        detention: initialData.detention || 0,
        extra: initialData.extra || 0,
        rto: initialData.rto || 0,
        detention_taxable: initialData.detention_taxable ?? true,
        extra_taxable: initialData.extra_taxable ?? true,
        rto_taxable: initialData.rto_taxable ?? false,
        hsn_code: initialData.hsn_code || COMPANY_CONFIG.sacCode,
        gst_type: initialData.gst_type || 'forward_charge',
        gst_percentage: initialData.gst_percentage ?? 5,
        gst_tax_type: initialData.gst_tax_type || detectGstTaxType(initialData.party_gstin || ''),
        gst_payable_by: initialData.gst_payable_by || '',
        mamool: initialData.mamool,
        tds: initialData.tds,
        penalties: initialData.penalties,
        party_commission_cut: initialData.party_commission_cut || 0,
        commission: initialData.commission || 0,
        net_amount: initialData.net_amount,
        status: initialData.status || 'pending',
        narration: initialData.narration || '',
      }));
    } else if (activeSlips.length > 0) {
      const ps = activeSlips[0];
      setFormData(prev => ({
        ...prev,
        bill_number: nextBillNumber,
        loading_slip_id: ps.id,
        loading_slip_ids: activeSlips.map(s => s.id),
        linked_lr_numbers: activeSlips.map(s => s.lr_number || s.slip_number),
        date: new Date(ps.date).toISOString().split('T')[0],
        party: ps.consignor_name || ps.party || '',
        party_contact: ps.consignor_contact || '',
        party_gstin: ps.consignor_gstin || '',
        party_address: ps.consignor_address || '',
        bill_amount: activeSlips.reduce((sum, s) => sum + (s.total_amount || s.total_freight || s.freight || 0), 0),
        rto: activeSlips.reduce((sum, s) => sum + (s.rto || 0), 0),
        detention: activeSlips.reduce((sum, s) => sum + (s.demurrage_charge || 0), 0),
        hsn_code: ps.hsn_code || COMPANY_CONFIG.sacCode,
        gst_type: ps.gst_paid_by === 'transporter' ? 'reverse_charge' : 'forward_charge',
        gst_tax_type: detectGstTaxType(ps.consignor_gstin || ''),
        gst_payable_by: ps.gst_paid_by || '',
      }));
    }
  }, [initialData, activeSlips, nextBillNumber]);

  // ── Handlers ──
  const handleNum = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: parseFloat(e.target.value) || 0 }));
  };
  const handleText = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };
  const handleBool = (name: string, value: boolean) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const applyPartyFromMaster = (name: string) => {
    const found = knownParties.find(p => p.name === name);
    if (found) {
      setFormData(prev => ({
        ...prev,
        party: found.name,
        party_gstin: found.gstin,
        party_address: found.address,
        party_contact: found.contact,
      }));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setFormData(prev => ({ ...prev, pod_image: result }));
      setPodFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (formData.pod_image) {
        try {
          await apiService.createPODFile({
            filename: podFileName || `POD_${formData.bill_number}_${Date.now()}.jpg`,
            fileData: formData.pod_image,
            fileType: 'image/jpeg',
            billNo: formData.bill_number,
            party: formData.party,
            uploadDate: new Date().toISOString(),
            created_at: new Date().toISOString(),
          });
        } catch (err) {
          console.error('POD save failed (non-blocking):', err);
        }
      }
      onSubmit(formData);
    } catch (err) {
      console.error('Bill submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white';
  const readOnlyCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700';
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1';

  const isRCM = formData.gst_type === 'reverse_charge';
  const hasGst = formData.gst_percentage > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full mx-4 max-h-[95vh] overflow-y-auto">

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-gray-900">
            {initialData ? 'Edit Invoice' : 'Create Bill / Invoice'}
          </h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* ── Section 1: Invoice Metadata ── */}
          <SectionHeader title={`Create Bill / Invoice Using : ${activeSlips.length > 0 ? 'BILTY' : 'MANUAL'}`} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className={labelCls}>Invoice No <span className="text-red-500">*</span></label>
              <input type="text" name="bill_number" value={formData.bill_number}
                onChange={handleText} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Bill Generate Date <span className="text-red-500">*</span></label>
              <input type="date" name="date" value={formData.date}
                onChange={handleText} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Branch Code</label>
              <input type="text" name="branch_code" value={formData.branch_code}
                onChange={handleText} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Financial Year</label>
              <select name="financial_year" value={formData.financial_year}
                onChange={handleText} className={inputCls}>
                {['24-25', '25-26', '26-27', '27-28'].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Section 2: Billing Company (Party) Details ── */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <SectionHeader title="Billing Company (Party) Details">
              {knownParties.length > 0 && (
                <select
                  className="text-xs border border-blue-200 bg-blue-50 text-blue-800 rounded px-2 py-1 cursor-pointer focus:outline-none"
                  onChange={e => applyPartyFromMaster(e.target.value)}
                  defaultValue=""
                >
                  <option value="">⚡ Select Saved Party…</option>
                  {knownParties.map((p, i) => (
                    <option key={i} value={p.name}>{p.name}</option>
                  ))}
                </select>
              )}
            </SectionHeader>
            <div className="px-4 pb-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className={labelCls}>Party Name <span className="text-red-500">*</span></label>
                  <input type="text" name="party" value={formData.party}
                    onChange={handleText} className={inputCls}
                    placeholder="Party / Company Name" required />
                </div>
                <div>
                  <label className={labelCls}>Contact Number</label>
                  <input type="text" name="party_contact" value={formData.party_contact}
                    onChange={handleText} className={inputCls} placeholder="Contact Number" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className={labelCls}>Address</label>
                  <textarea name="party_address" value={formData.party_address}
                    onChange={handleText} className={`${inputCls} resize-none`} rows={2}
                    placeholder="Party Address" />
                  <p className="text-xs text-red-400 mt-0.5">Please Avoid using Special Characters.</p>
                </div>
                <div>
                  <label className={labelCls}>GSTIN
                    <span className="ml-2 text-xs font-normal text-gray-400">
                      {formData.party_gstin ? (formData.gst_tax_type === 'cgst_sgst' ? '(Intra-State → CGST+SGST)' : '(Inter-State → IGST)') : ''}
                    </span>
                  </label>
                  <input type="text" name="party_gstin" value={formData.party_gstin}
                    onChange={handleText} className={inputCls} placeholder="GST Number" />
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 2B: Supplier / Lorry Owner Details ── */}
          <div className="border border-amber-200 bg-amber-50/40 rounded-lg overflow-hidden">
            <SectionHeader title="Supplier / Lorry Owner & Vehicle Details (Auto-filled from LR)" />
            <div className="px-4 pb-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className={labelCls}>Supplier / Owner Name</label>
                  <input type="text" name="supplier" value={formData.supplier}
                    onChange={handleText} className={inputCls} placeholder="Lorry Supplier Name" />
                </div>
                <div>
                  <label className={labelCls}>Vehicle / Truck No.</label>
                  <input type="text" name="vehicle_no" value={formData.vehicle_no}
                    onChange={handleText} className={`${inputCls} uppercase`} placeholder="e.g. GJ01AB1234" />
                </div>
                <div>
                  <label className={labelCls}>Supplier Contact</label>
                  <input type="text" name="supplier_contact" value={formData.supplier_contact}
                    onChange={handleText} className={inputCls} placeholder="Contact No" />
                </div>
                <div>
                  <label className={labelCls}>Supplier PAN No.</label>
                  <input type="text" name="supplier_pan" value={formData.supplier_pan}
                    onChange={handleText} className={`${inputCls} uppercase`} placeholder="PAN Number" />
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 3: LR/GR Details (per linked LR) ── */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <SectionHeader title={`LR / GR Details (${activeSlips.length} Selected)`}>
              <button
                type="button"
                onClick={() => setShowLrManager(!showLrManager)}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1 rounded transition-colors flex items-center gap-1"
              >
                {showLrManager ? 'Hide LR Selector' : `+ Add / Manage LRs (${eligibleLrsForParty.length} Available)`}
              </button>
            </SectionHeader>

            {/* LR Selector Accordion */}
            {showLrManager && (
              <div className="p-4 bg-blue-50/80 border-b border-blue-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900 uppercase tracking-wide">
                    Select LRs for {formData.party || 'Party'} (Check/Uncheck to add or remove LRs from this Bill):
                  </span>
                  <span className="text-xs text-blue-800 font-semibold bg-blue-100 px-2.5 py-0.5 rounded-full">
                    Selected: {selectedLrIds.length} LR(s)
                  </span>
                </div>
                {eligibleLrsForParty.length === 0 ? (
                  <div className="text-xs text-gray-500 py-3 text-center bg-white rounded border border-blue-100">
                    No available LRs found for {formData.party || 'this party'}.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                    {eligibleLrsForParty.map(lr => {
                      const lrId = String(lr.id || (lr as any)._id);
                      const isChecked = selectedLrIds.includes(lrId);
                      return (
                        <div
                          key={lrId}
                          onClick={() => handleToggleLrSelection(lrId)}
                          className={`p-2.5 rounded-lg border cursor-pointer transition-all text-xs flex items-start gap-2.5 ${
                            isChecked
                              ? 'bg-white border-blue-500 ring-1 ring-blue-500 shadow-sm'
                              : 'bg-white/80 border-gray-200 hover:border-blue-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="mt-0.5 text-blue-600 rounded cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between font-bold text-blue-800">
                              <span>LR: {lr.lr_number || lr.slip_number}</span>
                              <span className="font-semibold text-gray-900">
                                {formatCurrency(lr.total_amount || lr.total_freight || lr.freight || 0)}
                              </span>
                            </div>
                            <div className="text-gray-500 mt-0.5 truncate">
                              {lr.date ? new Date(lr.date).toLocaleDateString('en-IN') : ''} | Truck: {lr.vehicle_no || 'N/A'}
                            </div>
                            <div className="text-gray-600 truncate">
                              {lr.from_location} → {lr.to_location}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeSlips.length > 0 ? (
              <div className="px-4 pb-4 pt-3 space-y-4">
                {activeSlips.map((s, idx) => (
                  <div key={s.id || idx} className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className={labelCls}>Bilty Number</label>
                        <input value={s.lr_number || s.slip_number || ''} readOnly className={readOnlyCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Bilty Date</label>
                        <input value={s.date ? new Date(s.date).toLocaleDateString('en-IN') : ''} readOnly className={readOnlyCls} />
                      </div>
                      <div>
                        <label className={labelCls}>From</label>
                        <input value={s.from_location || ''} readOnly className={readOnlyCls} />
                      </div>
                      <div>
                        <label className={labelCls}>To</label>
                        <input value={s.to_location || ''} readOnly className={readOnlyCls} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div>
                        <label className={labelCls}>Material Name</label>
                        <input value={
                          s.material_type === 'multiple' && s.materials && s.materials.length > 0
                            ? s.materials.map(m => m.material_name).filter(Boolean).join(', ')
                            : s.material || ''
                        } readOnly className={readOnlyCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Weight</label>
                        <input value={s.actual_weight || s.weight || ''} readOnly className={readOnlyCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Unit</label>
                        <input value={s.weight_unit || 'MT'} readOnly className={readOnlyCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Rate</label>
                        <input value={s.freight_rate || ''} readOnly className={readOnlyCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Freight Amount</label>
                        <input value={s.total_amount || s.total_freight || s.freight || ''} readOnly className={readOnlyCls} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className={labelCls}>Vehicle Number</label>
                        <input value={s.vehicle_no || ''} readOnly className={readOnlyCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Halting Charges</label>
                        <input value={s.demurrage_charge || 0} readOnly className={readOnlyCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Other Charges</label>
                        <input value={s.other_charge || 0} readOnly className={readOnlyCls} />
                      </div>
                      <div>
                        <label className={labelCls}>HSN / SAC Code</label>
                        <input value={s.hsn_code || ''} readOnly className={readOnlyCls} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-gray-500 bg-gray-50">
                No LRs linked to this bill yet. Click "+ Add / Manage LRs" above to select LRs for {formData.party || 'this party'}.
              </div>
            )}
          </div>

          {/* ── Section 4: Freight & Charges ── */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <SectionHeader title="Freight & Charges" />
            <div className="px-4 pb-4 space-y-4">
              {/* Freight (always taxable) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>
                    Total Freight Amount (₹) <span className="text-red-500">*</span>
                    <span className="ml-2 text-xs text-green-600 font-medium">● Taxable</span>
                  </label>
                  <input type="number" name="bill_amount" value={formData.bill_amount}
                    onChange={handleNum} className={inputCls} step="0.01" min="0" required />
                </div>
                <div>
                  <label className={labelCls}>HSN / SAC Code</label>
                  <input type="text" name="hsn_code" value={formData.hsn_code}
                    onChange={handleText} className={inputCls} placeholder="e.g. 996511" />
                </div>
              </div>

              {/* Detention */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className={labelCls}>Detention / Halting (₹)</label>
                  <input type="number" name="detention" value={formData.detention}
                    onChange={handleNum} className={inputCls} step="0.01" min="0" />
                </div>
                <div>
                  <label className={labelCls}>Detention — GST Applicability</label>
                  <div className="flex gap-3 mt-1">
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="radio" checked={formData.detention_taxable === true}
                        onChange={() => handleBool('detention_taxable', true)}
                        className="text-green-600" />
                      <span className="text-green-700 font-medium">Taxable</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="radio" checked={formData.detention_taxable === false}
                        onChange={() => handleBool('detention_taxable', false)}
                        className="text-gray-600" />
                      <span className="text-gray-600">Non-Taxable</span>
                    </label>
                  </div>
                </div>
                <div className="text-xs text-gray-500 bg-gray-50 rounded p-2">
                  Detention taxable: <strong>{formData.detention_taxable ? formatCurrency(formData.detention) : '₹0'}</strong>
                </div>
              </div>

              {/* Extra */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className={labelCls}>Extra Weight Charges (₹)</label>
                  <input type="number" name="extra" value={formData.extra}
                    onChange={handleNum} className={inputCls} step="0.01" min="0" />
                </div>
                <div>
                  <label className={labelCls}>Extra Charge — GST Applicability</label>
                  <div className="flex gap-3 mt-1">
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="radio" checked={formData.extra_taxable === true}
                        onChange={() => handleBool('extra_taxable', true)}
                        className="text-green-600" />
                      <span className="text-green-700 font-medium">Taxable</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="radio" checked={formData.extra_taxable === false}
                        onChange={() => handleBool('extra_taxable', false)}
                        className="text-gray-600" />
                      <span className="text-gray-600">Non-Taxable</span>
                    </label>
                  </div>
                </div>
                <div className="text-xs text-gray-500 bg-gray-50 rounded p-2">
                  Extra taxable: <strong>{formData.extra_taxable ? formatCurrency(formData.extra) : '₹0'}</strong>
                </div>
              </div>

              {/* RTO */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className={labelCls}>RTO / Other Recovery (₹)</label>
                  <input type="number" name="rto" value={formData.rto}
                    onChange={handleNum} className={inputCls} step="0.01" min="0" />
                </div>
                <div>
                  <label className={labelCls}>RTO — GST Applicability</label>
                  <div className="flex gap-3 mt-1">
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="radio" checked={formData.rto_taxable === true}
                        onChange={() => handleBool('rto_taxable', true)}
                        className="text-green-600" />
                      <span className="text-green-700 font-medium">Taxable</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="radio" checked={formData.rto_taxable === false}
                        onChange={() => handleBool('rto_taxable', false)}
                        className="text-gray-600" />
                      <span className="text-gray-600">Non-Taxable</span>
                    </label>
                  </div>
                </div>
                <div className="text-xs text-gray-500 bg-gray-50 rounded p-2">
                  RTO taxable: <strong>{formData.rto_taxable ? formatCurrency(formData.rto) : '₹0'}</strong>
                </div>
              </div>

              {/* Taxable Value Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-blue-900">Taxable Value (GST Base):</span>
                <span className="text-lg font-bold text-blue-800">{formatCurrency(formData.taxable_value)}</span>
              </div>
            </div>
          </div>

          {/* ── Section 5: GST Details ── */}
          <div className={`border rounded-lg overflow-hidden ${isRCM ? 'border-orange-300 bg-orange-50/30' : 'border-green-200 bg-green-50/20'}`}>
            <SectionHeader title={isRCM ? '⚠ GST Details — Reverse Charge (RCM)' : '✓ GST Details — Forward Charge'}>
              {isRCM && (
                <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                  RCM
                </span>
              )}
            </SectionHeader>
            <div className="px-4 pb-4 space-y-4">

              {/* GST Charge Type */}
              <div>
                <label className={labelCls}>GST Charge Type <span className="text-red-500">*</span></label>
                <div className="flex gap-6 mt-1">
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <input type="radio" name="gst_type" value="forward_charge"
                      checked={formData.gst_type === 'forward_charge'}
                      onChange={handleText}
                      className="text-green-600 focus:ring-green-500" />
                    <span className={formData.gst_type === 'forward_charge' ? 'text-green-700 font-semibold' : 'text-gray-700'}>
                      Forward Charge
                    </span>
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <input type="radio" name="gst_type" value="reverse_charge"
                      checked={formData.gst_type === 'reverse_charge'}
                      onChange={handleText}
                      className="text-orange-600 focus:ring-orange-500" />
                    <span className={formData.gst_type === 'reverse_charge' ? 'text-orange-700 font-semibold' : 'text-gray-700'}>
                      Reverse Charge (RCM)
                    </span>
                  </label>
                </div>
                {isRCM && (
                  <div className="mt-2 flex items-start gap-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded p-2">
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>
                      Under RCM: GST is calculated for documentation purposes only. It is <strong>NOT added</strong> to the customer's payable amount. The recipient pays GST directly to the government.
                    </span>
                  </div>
                )}
              </div>

              {/* GST Rate + Tax Type */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>GST Rate</label>
                  <select name="gst_percentage"
                    value={formData.gst_percentage}
                    onChange={e => setFormData(prev => ({ ...prev, gst_percentage: parseFloat(e.target.value) || 0 }))}
                    className={inputCls}>
                    {COMPANY_CONFIG.gstRates.map(p => (
                      <option key={p} value={p}>{p}%</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Tax Type
                    <span className="ml-1 text-xs text-gray-400">(auto-detected from GSTIN)</span>
                  </label>
                  <div className="flex gap-4 mt-1">
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="radio" checked={formData.gst_tax_type === 'cgst_sgst'}
                        onChange={() => handleBool('gst_tax_type', true)}
                        onClick={() => setFormData(prev => ({ ...prev, gst_tax_type: 'cgst_sgst' }))}
                        className="text-blue-600" />
                      <span className={formData.gst_tax_type === 'cgst_sgst' ? 'text-blue-700 font-semibold' : 'text-gray-600'}>
                        CGST + SGST (Intra)
                      </span>
                    </label>
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="radio" checked={formData.gst_tax_type === 'igst'}
                        onClick={() => setFormData(prev => ({ ...prev, gst_tax_type: 'igst' }))}
                        onChange={() => {}}
                        className="text-purple-600" />
                      <span className={formData.gst_tax_type === 'igst' ? 'text-purple-700 font-semibold' : 'text-gray-600'}>
                        IGST (Inter)
                      </span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>GST Payable By</label>
                  <select name="gst_payable_by" value={formData.gst_payable_by} onChange={handleText} className={inputCls}>
                    <option value="">Select Payable By</option>
                    <option value="consignor">Consignor</option>
                    <option value="consignee">Consignee</option>
                    <option value="transporter">Transporter</option>
                  </select>
                </div>
              </div>

              {/* GST Calculation Breakdown Box */}
              {hasGst && (
                <div className={`rounded-lg border p-4 ${isRCM ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
                  <div className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wide">
                    GST Calculation Breakdown
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Taxable Value:</span>
                      <span className="font-semibold">{formatCurrency(formData.taxable_value)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">GST Rate:</span>
                      <span className="font-semibold">{formData.gst_percentage}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">GST Charge Type:</span>
                      <span className={`font-bold ${isRCM ? 'text-orange-700' : 'text-green-700'}`}>
                        {isRCM ? 'REVERSE CHARGE (RCM)' : 'FORWARD CHARGE'}
                      </span>
                    </div>
                    <div className="border-t pt-2 mt-2 space-y-1.5">
                      {formData.gst_tax_type === 'cgst_sgst' ? (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">CGST @ {formData.gst_percentage / 2}%:</span>
                            <span className="font-medium">{formatCurrency(formData.cgst_amount)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">SGST @ {formData.gst_percentage / 2}%:</span>
                            <span className="font-medium">{formatCurrency(formData.sgst_amount)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">IGST @ {formData.gst_percentage}%:</span>
                          <span className="font-medium">{formatCurrency(formData.igst_amount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-semibold border-t pt-1.5">
                        <span className="text-gray-700">Total GST:</span>
                        <span className="text-gray-900">{formatCurrency(formData.gst_amount)}</span>
                      </div>
                    </div>
                    {isRCM ? (
                      <div className="mt-2 text-xs text-orange-700 bg-orange-100 rounded px-2 py-1.5">
                        ⚠ GST Payable Under RCM by Recipient of Service — NOT included in Invoice Total
                      </div>
                    ) : (
                      <div className="flex justify-between text-sm font-bold mt-2 pt-2 border-t">
                        <span className="text-gray-800">Gross Invoice Amount:</span>
                        <span className="text-blue-700">{formatCurrency(formData.gross_invoice_amount)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!hasGst && (
                <p className="text-xs text-gray-400 italic">No GST applicable (0%). Non-taxable supply.</p>
              )}
            </div>
          </div>

          {/* ── Section 6: TDS / Deductions ── */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <SectionHeader title="Deductions (TDS, Mamool, Penalties)" />
            <div className="px-4 pb-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>TDS (₹)</label>
                  <input type="number" name="tds" value={formData.tds}
                    onChange={handleNum} className={inputCls} step="0.01" min="0" />
                  <p className="text-xs text-gray-500 mt-0.5">Deducted from net payable</p>
                </div>
                <div>
                  <label className={labelCls}>Mamool (₹)</label>
                  <input type="number" name="mamool" value={formData.mamool}
                    onChange={handleNum} className={inputCls} step="0.01" min="0" />
                </div>
                <div>
                  <label className={labelCls}>Penalties / Shortage (₹)</label>
                  <input type="number" name="penalties" value={formData.penalties}
                    onChange={handleNum} className={inputCls} step="0.01" min="0" />
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 7: Commission (separate) ── */}
          <div className="border border-yellow-200 rounded-lg overflow-hidden bg-yellow-50">
            <SectionHeader title="Commission Section" />
            <div className="px-4 pb-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Commission Amount (₹)</label>
                  <input type="number" name="commission" value={formData.commission}
                    onChange={handleNum} className={inputCls} step="0.01" min="0"
                    placeholder="Enter commission amount" />
                </div>
                <div>
                  <label className={labelCls}>Party Commission Cut (₹)</label>
                  <input type="number" name="party_commission_cut" value={formData.party_commission_cut}
                    onChange={handleNum} className={inputCls} step="0.01" min="0"
                    placeholder="Enter commission cut" />
                  <p className="text-xs text-gray-500 mt-0.5">
                    Posted to Party Commission Ledger. Excluded from Invoice PDF.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 8: Shipping Party (collapsible) ── */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button type="button"
              onClick={() => setShowShipping(v => !v)}
              className="w-full flex items-center justify-between bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700">
              <span>Shipping Company (Party) Details</span>
              {showShipping ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showShipping && (
              <div className="px-4 py-3">
                <p className="text-sm text-gray-400 italic">Shipping / consignee details (optional)</p>
              </div>
            )}
          </div>

          {/* ── Section 9: POD + Narration ── */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <SectionHeader title="Other Remarks" />
            <div className="px-4 pb-4 space-y-3">
              <div>
                <label className={labelCls}>Narration / Remarks</label>
                <textarea name="narration" value={formData.narration} onChange={handleText}
                  placeholder="Enter narration or remarks"
                  className={`${inputCls} resize-none`} rows={2} />
              </div>
              <div>
                <label className={labelCls}>POD Image</label>
                <div className="flex items-center gap-2">
                  <input type="file" accept="image/*" onChange={handleFileUpload}
                    className="hidden" id="pod-upload" />
                  <label htmlFor="pod-upload"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 flex items-center gap-2 text-sm text-gray-700">
                    <Upload className="w-4 h-4 text-gray-400" />
                    {podFileName || 'Upload POD Image'}
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* ── Calculation Summary ── */}
          <div className="bg-slate-800 text-white border border-slate-700 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <Calculator className="w-4 h-4 text-slate-300 mr-2" />
              <h3 className="text-sm font-semibold text-white">Invoice Calculation</h3>
            </div>
            <div className="space-y-2 text-sm">
              {/* Taxable charges */}
              <div className="flex justify-between">
                <span className="text-slate-400">Freight (Taxable):</span>
                <span className="font-medium">{formatCurrency(formData.bill_amount)}</span>
              </div>
              {formData.detention > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    + Detention {formData.detention_taxable ? '(Taxable)' : '(Non-Taxable)'}:
                  </span>
                  <span className="font-medium">{formatCurrency(formData.detention)}</span>
                </div>
              )}
              {formData.extra > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    + Extra {formData.extra_taxable ? '(Taxable)' : '(Non-Taxable)'}:
                  </span>
                  <span className="font-medium">{formatCurrency(formData.extra)}</span>
                </div>
              )}
              {formData.rto > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    + RTO {formData.rto_taxable ? '(Taxable)' : '(Non-Taxable)'}:
                  </span>
                  <span className="font-medium">{formatCurrency(formData.rto)}</span>
                </div>
              )}
              <div className="border-t border-slate-600 pt-2 flex justify-between font-semibold">
                <span className="text-slate-300">Taxable Value:</span>
                <span>{formatCurrency(formData.taxable_value)}</span>
              </div>

              {/* GST */}
              {hasGst && (
                <>
                  {formData.gst_tax_type === 'cgst_sgst' ? (
                    <>
                      <div className="flex justify-between text-blue-300">
                        <span>+ CGST @ {formData.gst_percentage / 2}%:</span>
                        <span>{formatCurrency(formData.cgst_amount)}</span>
                      </div>
                      <div className="flex justify-between text-blue-300">
                        <span>+ SGST @ {formData.gst_percentage / 2}%:</span>
                        <span>{formatCurrency(formData.sgst_amount)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-purple-300">
                      <span>+ IGST @ {formData.gst_percentage}%:</span>
                      <span>{formatCurrency(formData.igst_amount)}</span>
                    </div>
                  )}
                  {isRCM && (
                    <div className="text-xs text-orange-300 italic bg-orange-900/30 rounded px-2 py-1">
                      ↑ RCM: GST shown above is for documentation only — not charged to party
                    </div>
                  )}
                </>
              )}

              {/* Gross Invoice */}
              <div className="border-t border-slate-600 pt-2 flex justify-between font-bold text-base">
                <span className="text-green-300">Gross Invoice Amount:</span>
                <span className="text-green-400">{formatCurrency(formData.gross_invoice_amount)}</span>
              </div>

              {/* Deductions */}
              {(formData.tds + formData.mamool + formData.commission + formData.penalties + formData.party_commission_cut) > 0 && (
                <>
                  {formData.tds > 0 && (
                    <div className="flex justify-between text-red-400">
                      <span>− TDS:</span>
                      <span>{formatCurrency(formData.tds)}</span>
                    </div>
                  )}
                  {formData.mamool > 0 && (
                    <div className="flex justify-between text-red-400">
                      <span>− Mamool:</span>
                      <span>{formatCurrency(formData.mamool)}</span>
                    </div>
                  )}
                  {formData.commission > 0 && (
                    <div className="flex justify-between text-red-400">
                      <span>− Commission:</span>
                      <span>{formatCurrency(formData.commission)}</span>
                    </div>
                  )}
                  {formData.penalties > 0 && (
                    <div className="flex justify-between text-red-400">
                      <span>− Penalties:</span>
                      <span>{formatCurrency(formData.penalties)}</span>
                    </div>
                  )}
                  {formData.party_commission_cut > 0 && (
                    <div className="flex justify-between text-red-400">
                      <span>− Party Commission Cut:</span>
                      <span>{formatCurrency(formData.party_commission_cut)}</span>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-600 flex justify-between items-center">
              <span className="text-sm font-semibold text-white">Net Payable Amount:</span>
              <span className="text-2xl font-bold text-yellow-400">{formatCurrency(formData.net_amount)}</span>
            </div>
          </div>

          {/* ── Footer Actions ── */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div>
              {initialData && loadingSlip && (
                <PDFGenerator type="bill" data={initialData} loadingSlip={loadingSlip} size="md" />
              )}
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={onCancel}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting}
                className={`px-6 py-2 text-white rounded-lg text-sm font-medium transition-colors ${
                  isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                }`}>
                {isSubmitting ? '⏳ Submitting…' : `${initialData ? 'Update' : 'Create'} Bill`}
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};

export default BillForm;