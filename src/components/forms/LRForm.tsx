import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Save, X, ChevronDown, ChevronUp, Building2 } from 'lucide-react';
import { apiService } from '../../lib/api';
import { useDataStore } from '../../lib/store';
import { COMPANY_CONFIG } from '../../config/companyConfig';
import type { MaterialItem } from '../../types';

interface LRFormProps {
  initialData?: any;
  onNavigate: (page: string, params?: any) => void;
}

const today = () => new Date().toISOString().split('T')[0];

const emptyMaterial = (): MaterialItem => ({
  material_name: '',
  packing_type: '',
  no_of_articles: 0,
  hsn_code: '',
  invoice_number: '',
  weight: 0,
  value_of_goods: 0,
});

const sectionClass = 'bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-4';
const labelClass = 'block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1';
const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const selectClass = inputClass;

const LRForm: React.FC<LRFormProps> = ({ initialData, onNavigate }) => {
  const { addLoadingSlip, updateLoadingSlip, loadingSlips, parties, addParty, suppliers, addSupplier, vehicles, addVehicle } = useDataStore();
  const [lrNumber, setLrNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Modal states for inline creation
  const [partyModalTarget, setPartyModalTarget] = useState<'consignor' | 'consignee' | null>(null);
  const [newPartyForm, setNewPartyForm] = useState({ name: '', contact: '', gstin: '', email: '', address: '' });
  const [partySaving, setPartySaving] = useState(false);

  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [newSupplierForm, setNewSupplierForm] = useState({ name: '', phone: '', pan: '', address: '' });
  const [supplierSaving, setSupplierSaving] = useState(false);

  // Supplier lookup from master + existing LRs
  const knownSuppliers = useMemo(() => {
    const map = new Map<string, { name: string; phone: string; pan: string; address: string }>();
    (suppliers || []).forEach(s => {
      if (s.name) {
        map.set(s.name.trim().toLowerCase(), {
          name: s.name,
          phone: s.phone || s.contact || '',
          pan: (s as any).pan || '',
          address: s.address || ''
        });
      }
    });
    (loadingSlips || []).forEach(ls => {
      const sName = ls.supplier || ls.owner_name;
      if (sName) {
        const key = sName.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            name: sName,
            phone: ls.owner_number || ls.driver_number || '',
            pan: ls.owner_pan || '',
            address: ls.owner_address || ''
          });
        }
      }
    });
    return Array.from(map.values());
  }, [suppliers, loadingSlips]);

  // Vehicle lookup from master + existing LRs
  const knownVehicles = useMemo(() => {
    const set = new Set<string>();
    (vehicles || []).forEach(v => {
      if (v.vehicle_no) set.add(v.vehicle_no.trim().toUpperCase());
    });
    (loadingSlips || []).forEach(ls => {
      if (ls.vehicle_no) set.add(ls.vehicle_no.trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [vehicles, loadingSlips]);

  // Material lookup from existing LRs
  const knownMaterials = useMemo(() => {
    const set = new Set<string>();
    (loadingSlips || []).forEach(ls => {
      if (ls.material) set.add(ls.material.trim());
      if (ls.load_material_details) set.add(ls.load_material_details.trim());
      if (ls.materials && Array.isArray(ls.materials)) {
        ls.materials.forEach((m: any) => {
          if (m.material_name) set.add(m.material_name.trim());
        });
      }
    });
    return Array.from(set).filter(Boolean).sort();
  }, [loadingSlips]);

  const handleSelectSupplier = (supplierName: string) => {
    if (!supplierName) return;
    setForm(prev => {
      const found = knownSuppliers.find(s => s.name.toLowerCase() === supplierName.trim().toLowerCase());
      return {
        ...prev,
        owner_name: supplierName,
        owner_number: found?.phone || prev.owner_number,
        owner_pan: found?.pan || prev.owner_pan,
        owner_address: found?.address || prev.owner_address,
      };
    });
  };

  const handleCreatePartyFromModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartyForm.name.trim()) return;
    setPartySaving(true);
    try {
      const res = await apiService.createParty({
        name: newPartyForm.name.trim(),
        gst_number: newPartyForm.gstin.trim(),
        gstin: newPartyForm.gstin.trim(),
        address: newPartyForm.address.trim(),
        contact: newPartyForm.contact.trim(),
        phone: newPartyForm.contact.trim(),
        email: newPartyForm.email.trim()
      });
      const createdParty = res?.party || {
        id: Date.now().toString(),
        name: newPartyForm.name.trim(),
        gstin: newPartyForm.gstin.trim(),
        address: newPartyForm.address.trim(),
        contact: newPartyForm.contact.trim(),
        email: newPartyForm.email.trim()
      };
      addParty(createdParty);

      if (partyModalTarget === 'consignor') {
        setForm(prev => ({
          ...prev,
          consignor_name: createdParty.name,
          consignor_gstin: createdParty.gstin || createdParty.gst_number || '',
          consignor_address: createdParty.address || '',
          consignor_contact: createdParty.contact || createdParty.phone || '',
          consignor_email: createdParty.email || ''
        }));
      } else if (partyModalTarget === 'consignee') {
        setForm(prev => ({
          ...prev,
          consignee_name: createdParty.name,
          consignee_gstin: createdParty.gstin || createdParty.gst_number || '',
          consignee_address: createdParty.address || '',
          consignee_contact: createdParty.contact || createdParty.phone || '',
          consignee_email: createdParty.email || '',
          delivery_address: prev.delivery_same_as_consignee ? (createdParty.address || '') : prev.delivery_address
        }));
      }
      setPartyModalTarget(null);
      setNewPartyForm({ name: '', contact: '', gstin: '', email: '', address: '' });
    } catch (err: any) {
      alert(err.message || 'Failed to create party');
    } finally {
      setPartySaving(false);
    }
  };

  const handleCreateSupplierFromModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierForm.name.trim()) return;
    setSupplierSaving(true);
    try {
      const res = await apiService.createSupplier({
        name: newSupplierForm.name.trim(),
        contact: newSupplierForm.phone.trim(),
        phone: newSupplierForm.phone.trim(),
        pan: newSupplierForm.pan.trim(),
        address: newSupplierForm.address.trim()
      } as any);
      const createdSupplier = res?.supplier || {
        id: Date.now().toString(),
        name: newSupplierForm.name.trim(),
        contact: newSupplierForm.phone.trim(),
        phone: newSupplierForm.phone.trim(),
        pan: newSupplierForm.pan.trim(),
        address: newSupplierForm.address.trim()
      };
      addSupplier(createdSupplier);

      setForm(prev => ({
        ...prev,
        owner_name: createdSupplier.name,
        owner_number: createdSupplier.contact || createdSupplier.phone || '',
        owner_pan: createdSupplier.pan || '',
        owner_address: createdSupplier.address || ''
      }));

      setShowSupplierModal(false);
      setNewSupplierForm({ name: '', phone: '', pan: '', address: '' });
    } catch (err: any) {
      alert(err.message || 'Failed to create supplier');
    } finally {
      setSupplierSaving(false);
    }
  };

  const [form, setForm] = useState({
    // LR header
    date: today(),
    branch_code: COMPANY_CONFIG.defaultBranchCode,
    financial_year: '',

    // Consignor
    consignor_name: '',
    consignor_contact: '',
    consignor_gstin: '',
    consignor_email: '',
    consignor_address: '',

    // Consignee
    consignee_name: '',
    consignee_contact: '',
    consignee_gstin: '',
    consignee_email: '',
    consignee_address: '',
    delivery_address: '',
    delivery_same_as_consignee: false,

    // Route
    from_location: '',
    to_location: '',

    // Vehicle
    vehicle_no: '',
    vehicle_type: '' as '' | 'Own Vehicle' | 'Market Vehicle',
    vehicle_size: '',
    seal_number: '',
    eway_bill_number: '',
    eway_bill_expiry: '',

    // Driver
    driver_name: '',
    driver_number: '',
    dl_number: '',

    // Owner
    owner_name: '',
    owner_number: '',
    owner_pan: '',
    owner_address: '',

    // Insurance
    insurance_status: 'not_insured' as 'not_insured' | 'insured',
    insurance_company: '',
    policy_number: '',
    insurance_amount: 0,
    insurance_date: '',
    insurance_risk: '',
    gate_pass_number: '',

    // Demurrage
    demurrage_charge: 0,
    demurrage_per: '' as '' | 'hour' | 'day',
    demurrage_after: '',

    // Material
    material_type: 'single' as 'single' | 'multiple',
    // Single item
    material: '',
    packing_type: '',
    no_of_articles: 0,
    hsn_code: '',
    invoice_number: '',
    invoice_date: '',
    goods_value: 0,
    load_material_details: '',

    // Weight
    actual_weight: 0,
    guarantee_weight: 0,
    weight_unit: 'MT' as 'KG' | 'MT' | 'TON' | 'NOS' | '',
    total_weight: 0,

    // Freight
    freight_type: 'to_be_billed' as 'to_be_billed' | 'to_pay' | 'paid',
    freight_rate: 0,
    freight_fixed: false,
    freight_amount: 0,
    halting_charge: 0,
    door_to_door_charge: 0,
    service_charge: 0,
    other_charge: 0,
    total_amount: 0,
    advance_amount: 0,
    balance_amount: 0,

    // GST
    gst_paid_by: '' as '' | 'consignor' | 'consignee' | 'transporter',

    // Remarks
    remarks: '',
    narration: '',
  });

  const [materials, setMaterials] = useState<MaterialItem[]>([emptyMaterial()]);

  // Auto-fetch LR number on mount (run once only)
  useEffect(() => {
    if (!initialData) {
      setLoading(true);
      apiService.getNextLRNumber(COMPANY_CONFIG.defaultBranchCode)
        .then(res => setLrNumber(res.nextLRNumber))
        .catch(() => setLrNumber(`${COMPANY_CONFIG.defaultBranchCode}/--/0001`))
        .finally(() => setLoading(false));
    } else {
      setLrNumber(initialData.lr_number || initialData.slip_number || '');
      setForm(prev => ({
        ...prev,
        ...initialData,
        consignor_name: initialData.consignor_name || initialData.party || prev.consignor_name,
        owner_name: initialData.owner_name || initialData.supplier || prev.owner_name,
        freight_amount: initialData.freight_amount || initialData.freight || prev.freight_amount,
        actual_weight: initialData.actual_weight || initialData.weight || prev.actual_weight,
        from_location: initialData.from_location || prev.from_location,
        to_location: initialData.to_location || prev.to_location,
        vehicle_no: initialData.vehicle_no || prev.vehicle_no,
        total_amount: initialData.total_amount || initialData.total_freight || prev.total_amount,
        advance_amount: initialData.advance_amount || initialData.advance || prev.advance_amount,
        balance_amount: initialData.balance_amount || initialData.balance || prev.balance_amount,
      }));
      if (initialData.materials && Array.isArray(initialData.materials) && initialData.materials.length > 0) {
        setMaterials(initialData.materials);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-calculate total amount and balance
  useEffect(() => {
    const total = (form.freight_amount || 0) + (form.halting_charge || 0) + (form.door_to_door_charge || 0) + (form.service_charge || 0) + (form.other_charge || 0);
    const balance = total - (form.advance_amount || 0);
    setForm(prev => ({ ...prev, total_amount: total, balance_amount: balance }));
  }, [form.freight_amount, form.halting_charge, form.door_to_door_charge, form.service_charge, form.other_charge, form.advance_amount]);

  // Auto-calculate total weight
  useEffect(() => {
    setForm(prev => ({ ...prev, total_weight: (prev.actual_weight || 0) + (prev.guarantee_weight || 0) }));
  }, [form.actual_weight, form.guarantee_weight]);

  const set = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  // Combine party master and historic LR consignors/consignees into unified party lookup list
  const knownParties = useMemo(() => {
    const map = new Map<string, { name: string; gstin: string; address: string; contact: string; email: string }>();

    (parties || []).forEach(p => {
      if (p.name) {
        const key = p.name.trim().toLowerCase();
        map.set(key, {
          name: p.name,
          gstin: p.gstin || p.gst_number || '',
          address: p.address || '',
          contact: p.contact || p.phone || '',
          email: p.email || '',
        });
      }
    });

    (loadingSlips || []).forEach(ls => {
      if (ls.consignor_name) {
        const key = ls.consignor_name.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            name: ls.consignor_name,
            gstin: ls.consignor_gstin || '',
            address: ls.consignor_address || '',
            contact: ls.consignor_contact || '',
            email: ls.consignor_email || '',
          });
        }
      }
      if (ls.consignee_name) {
        const key = ls.consignee_name.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            name: ls.consignee_name,
            gstin: ls.consignee_gstin || '',
            address: ls.consignee_address || '',
            contact: ls.consignee_contact || '',
            email: ls.consignee_email || '',
          });
        }
      }
    });

    return Array.from(map.values());
  }, [parties, loadingSlips]);

  const handleSelectConsignor = (partyName: string) => {
    if (!partyName) return;
    const found = knownParties.find(p => p.name.toLowerCase() === partyName.toLowerCase());
    if (found) {
      setForm(prev => ({
        ...prev,
        consignor_name: found.name,
        consignor_gstin: found.gstin,
        consignor_address: found.address,
        consignor_contact: found.contact,
        consignor_email: found.email,
      }));
    }
  };

  const handleSelectConsignee = (partyName: string) => {
    if (!partyName) return;
    const found = knownParties.find(p => p.name.toLowerCase() === partyName.toLowerCase());
    if (found) {
      setForm(prev => ({
        ...prev,
        consignee_name: found.name,
        consignee_gstin: found.gstin,
        consignee_address: found.address,
        consignee_contact: found.contact,
        consignee_email: found.email,
        delivery_address: prev.delivery_same_as_consignee ? found.address : prev.delivery_address,
      }));
    }
  };

  const handleConsignorGstinChange = (gstin: string) => {
    set('consignor_gstin', gstin);
    if (gstin.trim().length >= 3) {
      const match = knownParties.find(p => p.gstin && p.gstin.toLowerCase() === gstin.trim().toLowerCase());
      if (match) {
        setForm(prev => ({
          ...prev,
          consignor_name: match.name,
          consignor_address: match.address || prev.consignor_address,
          consignor_contact: match.contact || prev.consignor_contact,
          consignor_email: match.email || prev.consignor_email,
        }));
      }
    }
  };

  const handleConsigneeGstinChange = (gstin: string) => {
    set('consignee_gstin', gstin);
    if (gstin.trim().length >= 3) {
      const match = knownParties.find(p => p.gstin && p.gstin.toLowerCase() === gstin.trim().toLowerCase());
      if (match) {
        setForm(prev => ({
          ...prev,
          consignee_name: match.name,
          consignee_address: match.address || prev.consignee_address,
          consignee_contact: match.contact || prev.consignee_contact,
          consignee_email: match.email || prev.consignee_email,
          delivery_address: prev.delivery_same_as_consignee ? (match.address || prev.consignee_address) : prev.delivery_address,
        }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload: any = {
        ...form,
        slip_number: lrNumber,
        lr_number: lrNumber,
        // Sync legacy fields
        party: form.consignor_name || '',
        supplier: form.owner_name || '',
        freight: form.freight_amount || 0,
        total_freight: form.total_amount || 0,
        weight: form.actual_weight || 0,
        from_location: form.from_location || '',
        to_location: form.to_location || '',
        vehicle_no: form.vehicle_no || '',
      };

      if (form.material_type === 'multiple') {
        payload.materials = materials;
      }

      // Auto-save new Consignor & Consignee to Parties master if not already stored
      const autoSaveParty = async (name: string, gstin: string, address: string, contact: string, email: string) => {
        if (!name.trim()) return;
        const exists = (parties || []).some(p => p.name.trim().toLowerCase() === name.trim().toLowerCase());
        if (!exists) {
          try {
            const res = await apiService.createParty({
              name: name.trim(),
              gst_number: gstin,
              gstin: gstin,
              address,
              contact,
              phone: contact,
              email,
            });
            if (res?.party) addParty(res.party);
          } catch (e) {
            console.log('Auto-saved party notice:', e);
          }
        }
      };

      // Auto-save new Supplier to Supplier master if not already stored
      const autoSaveSupplier = async (name: string, phone: string, address: string, pan: string) => {
        if (!name.trim()) return;
        const exists = (suppliers || []).some(s => s.name.trim().toLowerCase() === name.trim().toLowerCase());
        if (!exists) {
          try {
            const res = await apiService.createSupplier({
              name: name.trim(),
              contact: phone,
              phone: phone,
              address,
              pan,
            } as any);
            if (res?.supplier) addSupplier(res.supplier);
          } catch (e) {
            console.log('Auto-saved supplier notice:', e);
          }
        }
      };

      if (form.consignor_name) {
        autoSaveParty(form.consignor_name, form.consignor_gstin, form.consignor_address, form.consignor_contact, form.consignor_email);
      }
      if (form.consignee_name) {
        autoSaveParty(form.consignee_name, form.consignee_gstin, form.consignee_address, form.consignee_contact, form.consignee_email);
      }
      if (form.owner_name) {
        autoSaveSupplier(form.owner_name, form.owner_number, form.owner_address, form.owner_pan);
      }

      // Auto-save new Vehicle to Vehicle master if not already stored
      if (form.vehicle_no && form.vehicle_no.trim()) {
        const vUpper = form.vehicle_no.trim().toUpperCase();
        const vExists = (vehicles || []).some(v => v.vehicle_no && v.vehicle_no.trim().toUpperCase() === vUpper);
        if (!vExists) {
          try {
            apiService.createVehicle({
              vehicle_no: vUpper,
              vehicle_type: form.vehicle_type || 'Market Vehicle',
              driver_name: form.driver_name || '',
              driver_mobile: form.driver_number || ''
            }).then(res => {
              if (res?.vehicle) addVehicle(res.vehicle);
            }).catch(e => console.log('Auto-save vehicle notice:', e));
          } catch (e) {
            console.log('Vehicle notice:', e);
          }
        }
      }

      if (initialData?.id) {
        const response = await apiService.updateLoadingSlip(initialData.id, payload);
        if (response?.loadingSlip) {
          updateLoadingSlip(response.loadingSlip);
        }
      } else {
        localStorage.setItem('lastLoadingSlipCreation', Date.now().toString());
        const response = await apiService.createLoadingSlip(payload);
        if (response?.loadingSlip) {
          addLoadingSlip(response.loadingSlip);
        }
      }
      window.dispatchEvent(new CustomEvent('data-sync-required'));

      onNavigate('loading-slip');
    } catch (err: any) {
      setError(err.message || 'Failed to save LR');
    } finally {
      setSaving(false);
    }
  };

  const addMaterial = () => setMaterials(prev => [...prev, emptyMaterial()]);
  const removeMaterial = (idx: number) => setMaterials(prev => prev.filter((_, i) => i !== idx));
  const setMaterialField = (idx: number, field: keyof MaterialItem, value: any) => {
    setMaterials(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-gray-500">Home &gt; LR &gt; {initialData ? 'Edit LR' : 'Create New LR'}</p>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            {initialData ? 'Edit LR' : 'Create New LR'}
          </h1>
        </div>
        <button onClick={() => onNavigate('loading-slip')} className="text-gray-500 hover:text-gray-700">
          <X className="w-6 h-6" />
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* 1. LR Details */}
        <div className={sectionClass}>
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
            <span className="bg-blue-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">1</span>
            LR Details
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>LR Number *</label>
              <input className={`${inputClass} bg-white font-semibold text-blue-700`} value={loading ? 'Generating...' : lrNumber} onChange={e => setLrNumber(e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>LR Date *</label>
              <input type="date" className={inputClass} value={form.date} onChange={e => set('date', e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>Branch Code</label>
              <input className={inputClass} value={form.branch_code} onChange={e => set('branch_code', e.target.value)} />
            </div>
          </div>
        </div>

        {/* 2. Consignor Details */}
        <div className={sectionClass}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
              <span className="bg-blue-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">2</span>
              Consignor (Sender) Details
            </h2>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <select
                className="text-xs border border-blue-300 bg-blue-50 text-blue-900 rounded-lg px-2.5 py-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer max-w-xs truncate"
                onChange={e => {
                  if (e.target.value === '__ADD_NEW__') {
                    setPartyModalTarget('consignor');
                    e.target.value = '';
                  } else {
                    handleSelectConsignor(e.target.value);
                  }
                }}
                value={form.consignor_name || ''}
              >
                <option value="">⚡ Select Saved Consignor / Party...</option>
                <option value="__ADD_NEW__" className="font-bold text-blue-700 bg-blue-100">
                  ➕ Add New Party
                </option>
                {knownParties.map((p, idx) => (
                  <option key={idx} value={p.name}>
                    {p.name} {p.gstin ? `(GST: ${p.gstin})` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setPartyModalTarget('consignor')}
                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> Add New Party
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Consignor Name *</label>
              <input
                className={inputClass}
                placeholder="Company / Person Name"
                value={form.consignor_name}
                onChange={e => set('consignor_name', e.target.value)}
                list="lr-consignor-parties"
                required
              />
              <datalist id="lr-consignor-parties">
                {knownParties.map((p, idx) => (
                  <option key={idx} value={p.name} />
                ))}
              </datalist>
            </div>
            <div>
              <label className={labelClass}>Contact Number</label>
              <input className={inputClass} placeholder="Mobile Number" value={form.consignor_contact} onChange={e => set('consignor_contact', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>GSTIN (Auto-imports details)</label>
              <input className={inputClass} placeholder="15-Digit GSTIN" value={form.consignor_gstin} onChange={e => handleConsignorGstinChange(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" className={inputClass} placeholder="Email" value={form.consignor_email} onChange={e => set('consignor_email', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Address</label>
              <input className={inputClass} placeholder="Full Address" value={form.consignor_address} onChange={e => set('consignor_address', e.target.value)} />
            </div>
          </div>
        </div>

        {/* 3. Consignee Details */}
        <div className={sectionClass}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
              <span className="bg-blue-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">3</span>
              Consignee (Receiver) Details
            </h2>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <select
                className="text-xs border border-blue-300 bg-blue-50 text-blue-900 rounded-lg px-2.5 py-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer max-w-xs truncate"
                onChange={e => {
                  if (e.target.value === '__ADD_NEW__') {
                    setPartyModalTarget('consignee');
                    e.target.value = '';
                  } else {
                    handleSelectConsignee(e.target.value);
                  }
                }}
                value={form.consignee_name || ''}
              >
                <option value="">⚡ Select Saved Consignee / Party...</option>
                <option value="__ADD_NEW__" className="font-bold text-blue-700 bg-blue-100">
                  ➕ Add New Party
                </option>
                {knownParties.map((p, idx) => (
                  <option key={idx} value={p.name}>
                    {p.name} {p.gstin ? `(GST: ${p.gstin})` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setPartyModalTarget('consignee')}
                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> Add New Party
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Consignee Name *</label>
              <input
                className={inputClass}
                placeholder="Company / Person Name"
                value={form.consignee_name}
                onChange={e => set('consignee_name', e.target.value)}
                list="lr-consignee-parties"
                required
              />
              <datalist id="lr-consignee-parties">
                {knownParties.map((p, idx) => (
                  <option key={idx} value={p.name} />
                ))}
              </datalist>
            </div>
            <div>
              <label className={labelClass}>Contact Number</label>
              <input className={inputClass} placeholder="Mobile Number" value={form.consignee_contact} onChange={e => set('consignee_contact', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>GSTIN (Auto-imports details)</label>
              <input className={inputClass} placeholder="15-Digit GSTIN" value={form.consignee_gstin} onChange={e => handleConsigneeGstinChange(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" className={inputClass} placeholder="Email" value={form.consignee_email} onChange={e => set('consignee_email', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Address</label>
              <input className={inputClass} placeholder="Full Address" value={form.consignee_address} onChange={e => set('consignee_address', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={form.delivery_same_as_consignee} onChange={e => { set('delivery_same_as_consignee', e.target.checked); if (e.target.checked) set('delivery_address', form.consignee_address); }} />
                Delivery address same as Consignee
              </label>
            </div>
            {!form.delivery_same_as_consignee && (
              <div className="col-span-2">
                <label className={labelClass}>Delivery Address</label>
                <input className={inputClass} placeholder="Delivery Address (if different)" value={form.delivery_address} onChange={e => set('delivery_address', e.target.value)} />
              </div>
            )}
          </div>
        </div>

        {/* 4. Route */}
        <div className={sectionClass}>
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
            <span className="bg-blue-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">4</span>
            Route Details
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>From *</label>
              <input className={inputClass} placeholder="Origin Location" value={form.from_location} onChange={e => set('from_location', e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>To *</label>
              <input className={inputClass} placeholder="Destination Location" value={form.to_location} onChange={e => set('to_location', e.target.value)} required />
            </div>
          </div>
        </div>

        {/* 5. Vehicle Details */}
        <div className={sectionClass}>
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
            <span className="bg-blue-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">5</span>
            Vehicle Details
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Vehicle No *</label>
              <input
                className={inputClass}
                placeholder="GJ-01-XX-0000"
                value={form.vehicle_no}
                onChange={e => set('vehicle_no', e.target.value)}
                list="lr-vehicles-list"
                required
              />
              <datalist id="lr-vehicles-list">
                {knownVehicles.map((v, idx) => (
                  <option key={idx} value={v} />
                ))}
              </datalist>
            </div>
            <div>
              <label className={labelClass}>Vehicle Type</label>
              <select className={selectClass} value={form.vehicle_type} onChange={e => set('vehicle_type', e.target.value)}>
                <option value="">Select</option>
                <option value="Own Vehicle">Own Vehicle</option>
                <option value="Market Vehicle">Market Vehicle</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Vehicle Size</label>
              <input className={inputClass} placeholder="e.g. 24 FT" value={form.vehicle_size} onChange={e => set('vehicle_size', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Seal Number</label>
              <input className={inputClass} value={form.seal_number} onChange={e => set('seal_number', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>E-Way Bill Number</label>
              <input className={inputClass} value={form.eway_bill_number} onChange={e => set('eway_bill_number', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>E-Way Bill Expiry</label>
              <input type="date" className={inputClass} value={form.eway_bill_expiry} onChange={e => set('eway_bill_expiry', e.target.value)} />
            </div>
          </div>
        </div>

        {/* 6. Driver Details */}
        <div className={sectionClass}>
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
            <span className="bg-blue-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">6</span>
            Driver Details
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Driver Name</label>
              <input className={inputClass} value={form.driver_name} onChange={e => set('driver_name', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Driver Mobile</label>
              <input className={inputClass} value={form.driver_number} onChange={e => set('driver_number', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>DL Number</label>
              <input className={inputClass} value={form.dl_number} onChange={e => set('dl_number', e.target.value)} />
            </div>
          </div>
        </div>

        {/* 7. Owner Details */}
        <div className={sectionClass}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
              <span className="bg-blue-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">7</span>
              Owner / Supplier Details
            </h2>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-purple-600" />
              <select
                className="text-xs border border-purple-300 bg-purple-50 text-purple-900 rounded-lg px-2.5 py-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer max-w-xs truncate"
                onChange={e => {
                  if (e.target.value === '__ADD_NEW__') {
                    setShowSupplierModal(true);
                    e.target.value = '';
                  } else {
                    handleSelectSupplier(e.target.value);
                  }
                }}
                value={form.owner_name || ''}
              >
                <option value="">⚡ Select Saved Supplier / Owner...</option>
                <option value="__ADD_NEW__" className="font-bold text-purple-700 bg-purple-100">
                  ➕ Add New Supplier
                </option>
                {knownSuppliers.map((s, idx) => (
                  <option key={idx} value={s.name}>
                    {s.name} {s.phone ? `(${s.phone})` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowSupplierModal(true)}
                className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> Add New Supplier
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Owner / Supplier Name</label>
              <input
                className={inputClass}
                list="lr-suppliers-list"
                placeholder="Type or select saved supplier"
                value={form.owner_name}
                onChange={e => handleSelectSupplier(e.target.value)}
              />
              <datalist id="lr-suppliers-list">
                {knownSuppliers.map((s, idx) => (
                  <option key={idx} value={s.name} />
                ))}
              </datalist>
            </div>
            <div>
              <label className={labelClass}>Owner / Supplier Mobile</label>
              <input className={inputClass} placeholder="Mobile Number" value={form.owner_number} onChange={e => set('owner_number', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Owner PAN</label>
              <input className={`${inputClass} uppercase`} placeholder="PAN Number" value={form.owner_pan} onChange={e => set('owner_pan', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Owner Address</label>
              <input className={inputClass} placeholder="Supplier Address" value={form.owner_address} onChange={e => set('owner_address', e.target.value)} />
            </div>
          </div>
        </div>

        {/* 8. Insurance */}
        <div className={sectionClass}>
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
            <span className="bg-blue-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">8</span>
            Insurance & Gate Pass
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Insurance Status</label>
              <select className={selectClass} value={form.insurance_status} onChange={e => set('insurance_status', e.target.value)}>
                <option value="not_insured">Not Insured</option>
                <option value="insured">Insured</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Gate Pass Number</label>
              <input className={inputClass} value={form.gate_pass_number} onChange={e => set('gate_pass_number', e.target.value)} />
            </div>
            {form.insurance_status === 'insured' && <>
              <div>
                <label className={labelClass}>Insurance Company</label>
                <input className={inputClass} value={form.insurance_company} onChange={e => set('insurance_company', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Policy Number</label>
                <input className={inputClass} value={form.policy_number} onChange={e => set('policy_number', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Insurance Amount (₹)</label>
                <input type="number" className={inputClass} value={form.insurance_amount} onChange={e => set('insurance_amount', +e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Insurance Date</label>
                <input type="date" className={inputClass} value={form.insurance_date} onChange={e => set('insurance_date', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Risk Type</label>
                <input className={inputClass} placeholder="e.g. All Risk" value={form.insurance_risk} onChange={e => set('insurance_risk', e.target.value)} />
              </div>
            </>}
          </div>
        </div>

        {/* 9. Demurrage */}
        <div className={sectionClass}>
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
            <span className="bg-blue-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">9</span>
            Demurrage
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Demurrage Charge (₹)</label>
              <input type="number" className={inputClass} value={form.demurrage_charge} onChange={e => set('demurrage_charge', +e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Per</label>
              <select className={selectClass} value={form.demurrage_per} onChange={e => set('demurrage_per', e.target.value)}>
                <option value="">Select</option>
                <option value="hour">Hour</option>
                <option value="day">Day</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>After (hours/days)</label>
              <input className={inputClass} placeholder="e.g. 48 hours" value={form.demurrage_after} onChange={e => set('demurrage_after', e.target.value)} />
            </div>
          </div>
        </div>

        {/* 10. Material Details */}
        <div className={sectionClass}>
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
            <span className="bg-blue-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">10</span>
            Material Details
          </h2>
          <div className="flex gap-4 mb-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="radio" checked={form.material_type === 'single'} onChange={() => set('material_type', 'single')} />
              Single Item
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="radio" checked={form.material_type === 'multiple'} onChange={() => set('material_type', 'multiple')} />
              Multiple Items
            </label>
          </div>

          {form.material_type === 'single' ? (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Material Description</label>
                <input
                  className={inputClass}
                  value={form.material}
                  onChange={e => set('material', e.target.value)}
                  list="lr-materials-list"
                />
              </div>
              <div>
                <label className={labelClass}>Packing Type</label>
                <input className={inputClass} placeholder="e.g. Bags, Boxes" value={form.packing_type} onChange={e => set('packing_type', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>No. of Articles</label>
                <input type="number" className={inputClass} value={form.no_of_articles} onChange={e => set('no_of_articles', +e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>HSN Code</label>
                <input className={inputClass} value={form.hsn_code} onChange={e => set('hsn_code', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Invoice Number</label>
                <input className={inputClass} value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Invoice Date</label>
                <input type="date" className={inputClass} value={form.invoice_date} onChange={e => set('invoice_date', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Value of Goods (₹)</label>
                <input type="number" className={inputClass} value={form.goods_value} onChange={e => set('goods_value', +e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Material Details / Remarks</label>
                <input className={inputClass} value={form.load_material_details} onChange={e => set('load_material_details', e.target.value)} />
              </div>
            </div>
          ) : (
            <div>
              {materials.map((mat, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4 mb-3 bg-gray-50">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-medium text-gray-600">Item {idx + 1}</span>
                    {materials.length > 1 && (
                      <button type="button" onClick={() => removeMaterial(idx)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={labelClass}>Material</label>
                      <input
                        className={inputClass}
                        value={mat.material_name || ''}
                        onChange={e => setMaterialField(idx, 'material_name', e.target.value)}
                        list="lr-materials-list"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Packing</label>
                      <input className={inputClass} value={mat.packing_type || ''} onChange={e => setMaterialField(idx, 'packing_type', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass}>Articles</label>
                      <input type="number" className={inputClass} value={mat.no_of_articles || 0} onChange={e => setMaterialField(idx, 'no_of_articles', +e.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass}>HSN Code</label>
                      <input className={inputClass} value={mat.hsn_code || ''} onChange={e => setMaterialField(idx, 'hsn_code', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass}>Invoice No</label>
                      <input className={inputClass} value={mat.invoice_number || ''} onChange={e => setMaterialField(idx, 'invoice_number', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass}>Weight</label>
                      <input type="number" className={inputClass} value={mat.weight || 0} onChange={e => setMaterialField(idx, 'weight', +e.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass}>Goods Value (₹)</label>
                      <input type="number" className={inputClass} value={mat.value_of_goods || 0} onChange={e => setMaterialField(idx, 'value_of_goods', +e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" onClick={addMaterial} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium">
                <Plus className="w-4 h-4" /> Add Another Item
              </button>
            </div>
          )}
          <datalist id="lr-materials-list">
            {knownMaterials.map((m, idx) => (
              <option key={idx} value={m} />
            ))}
          </datalist>
        </div>

        {/* 11. Weight */}
        <div className={sectionClass}>
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
            <span className="bg-blue-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">11</span>
            Weight Details
          </h2>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className={labelClass}>Actual Weight</label>
              <input type="number" step="0.01" className={inputClass} value={form.actual_weight} onChange={e => set('actual_weight', +e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Guarantee Weight</label>
              <input type="number" step="0.01" className={inputClass} value={form.guarantee_weight} onChange={e => set('guarantee_weight', +e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Weight Unit</label>
              <select className={selectClass} value={form.weight_unit} onChange={e => set('weight_unit', e.target.value)}>
                <option value="MT">MT</option>
                <option value="KG">KG</option>
                <option value="TON">TON</option>
                <option value="NOS">NOS</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Total Weight</label>
              <input type="number" step="0.01" className={`${inputClass} bg-gray-50 font-semibold`} value={form.total_weight} readOnly />
            </div>
          </div>
        </div>

        {/* 12. Freight */}
        <div className={sectionClass}>
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
            <span className="bg-blue-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">12</span>
            Freight &amp; Charges
          </h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className={labelClass}>Freight Type</label>
              <select className={selectClass} value={form.freight_type} onChange={e => set('freight_type', e.target.value)}>
                <option value="to_be_billed">To Be Billed</option>
                <option value="to_pay">To Pay</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Freight Rate (₹)</label>
              <input type="number" className={inputClass} value={form.freight_rate} onChange={e => set('freight_rate', +e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Freight Amount (₹) *</label>
              <input type="number" className={inputClass} value={form.freight_amount} onChange={e => set('freight_amount', +e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Halting Charge (₹)</label>
              <input type="number" className={inputClass} value={form.halting_charge} onChange={e => set('halting_charge', +e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Door-to-Door (₹)</label>
              <input type="number" className={inputClass} value={form.door_to_door_charge} onChange={e => set('door_to_door_charge', +e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Service Charge (₹)</label>
              <input type="number" className={inputClass} value={form.service_charge} onChange={e => set('service_charge', +e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Other Charge (₹)</label>
              <input type="number" className={inputClass} value={form.other_charge} onChange={e => set('other_charge', +e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Advance Amount (₹)</label>
              <input type="number" className={inputClass} value={form.advance_amount} onChange={e => set('advance_amount', +e.target.value)} />
            </div>
          </div>

          {/* Totals summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-xs text-gray-500 uppercase mb-1">Total Amount</div>
              <div className="text-lg font-bold text-blue-700">₹{form.total_amount.toLocaleString('en-IN')}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 uppercase mb-1">Advance</div>
              <div className="text-lg font-bold text-orange-600">₹{form.advance_amount.toLocaleString('en-IN')}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 uppercase mb-1">Balance</div>
              <div className="text-lg font-bold text-green-600">₹{form.balance_amount.toLocaleString('en-IN')}</div>
            </div>
          </div>
        </div>

        {/* 13. GST */}
        <div className={sectionClass}>
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
            <span className="bg-blue-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">13</span>
            GST Details
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>GST Paid By</label>
              <select className={selectClass} value={form.gst_paid_by} onChange={e => set('gst_paid_by', e.target.value)}>
                <option value="">Select</option>
                <option value="consignor">Consignor</option>
                <option value="consignee">Consignee</option>
                <option value="transporter">Transporter</option>
              </select>
            </div>
          </div>
        </div>

        {/* 14. Remarks */}
        <div className={sectionClass}>
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
            <span className="bg-blue-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">14</span>
            Remarks &amp; Notes
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Remarks</label>
              <textarea rows={3} className={inputClass} value={form.remarks} onChange={e => set('remarks', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Internal Narration</label>
              <textarea rows={3} className={inputClass} value={form.narration} onChange={e => set('narration', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3 pb-8">
          <button type="button" onClick={() => onNavigate('loading-slip')} className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-8 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-60">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : (initialData ? 'Update LR' : 'Create LR')}
          </button>
        </div>
      </form>

      {/* Add Party Modal */}
      {partyModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-blue-600 px-5 py-4 text-white flex justify-between items-center">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Add New Party ({partyModalTarget === 'consignor' ? 'Consignor' : 'Consignee'})
              </h3>
              <button type="button" onClick={() => setPartyModalTarget(null)} className="text-white hover:text-blue-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreatePartyFromModal} className="p-5 space-y-4">
              <div>
                <label className={labelClass}>Party / Company Name *</label>
                <input
                  className={inputClass}
                  placeholder="e.g. Sanghvi Movers Limited"
                  value={newPartyForm.name}
                  onChange={e => setNewPartyForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>GSTIN</label>
                  <input
                    className={`${inputClass} uppercase`}
                    placeholder="15-Digit GSTIN"
                    value={newPartyForm.gstin}
                    onChange={e => setNewPartyForm(prev => ({ ...prev, gstin: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelClass}>Contact Mobile</label>
                  <input
                    className={inputClass}
                    placeholder="Mobile Number"
                    value={newPartyForm.contact}
                    onChange={e => setNewPartyForm(prev => ({ ...prev, contact: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Email Address</label>
                <input
                  type="email"
                  className={inputClass}
                  placeholder="email@company.com"
                  value={newPartyForm.email}
                  onChange={e => setNewPartyForm(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelClass}>Full Address</label>
                <input
                  className={inputClass}
                  placeholder="Full Address"
                  value={newPartyForm.address}
                  onChange={e => setNewPartyForm(prev => ({ ...prev, address: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPartyModalTarget(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={partySaving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60"
                >
                  {partySaving ? 'Saving...' : 'Save & Select Party'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Supplier Modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-purple-600 px-5 py-4 text-white flex justify-between items-center">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Add New Supplier / Owner
              </h3>
              <button type="button" onClick={() => setShowSupplierModal(false)} className="text-white hover:text-purple-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSupplierFromModal} className="p-5 space-y-4">
              <div>
                <label className={labelClass}>Supplier / Owner Name *</label>
                <input
                  className={inputClass}
                  placeholder="e.g. Ramesh Transport Service"
                  value={newSupplierForm.name}
                  onChange={e => setNewSupplierForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Mobile Number</label>
                  <input
                    className={inputClass}
                    placeholder="Mobile Number"
                    value={newSupplierForm.phone}
                    onChange={e => setNewSupplierForm(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelClass}>PAN Number</label>
                  <input
                    className={`${inputClass} uppercase`}
                    placeholder="PAN Number"
                    value={newSupplierForm.pan}
                    onChange={e => setNewSupplierForm(prev => ({ ...prev, pan: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Supplier Address</label>
                <input
                  className={inputClass}
                  placeholder="Full Address"
                  value={newSupplierForm.address}
                  onChange={e => setNewSupplierForm(prev => ({ ...prev, address: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={supplierSaving}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60"
                >
                  {supplierSaving ? 'Saving...' : 'Save & Select Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LRForm;
