import React, { useState, useEffect, useMemo } from 'react';
import { X, Calculator, Truck, UserCheck } from 'lucide-react';
import { formatCurrency } from '../../utils/numberGenerator';
import { useDataStore } from '../../lib/store';
import type { LoadingSlip, Memo, AdvancePayment } from '../../types';

interface MemoFormProps {
  slip?: LoadingSlip;
  slips?: LoadingSlip[];
  nextMemoNumber?: string;
  initialData?: Memo | null;
  onSubmit: (data: Omit<Memo, 'id' | 'created_at' | 'updated_at'>) => void;
  onCancel: () => void;
}

type MemoFormState = {
  memo_number: string;
  loading_slip_id: string;
  loading_slip_ids?: string[];
  linked_lr_numbers?: string[];
  date: string;
  supplier: string;
  supplier_contact: string;
  supplier_pan: string;
  supplier_address: string;
  vehicle_no: string;
  driver_name: string;
  driver_number: string;
  freight: number;
  commission_rate: number;
  commission: number;
  mamool: number;
  detention: number;
  extra: number;
  rto: number;
  deduction: number;
  net_amount: number;
  advance_payments: AdvancePayment[];
  status: 'pending' | 'paid';
  narration: string;
};

const MemoForm: React.FC<MemoFormProps> = ({ slip, slips, nextMemoNumber, initialData, onSubmit, onCancel }) => {
  const { suppliers, loadingSlips } = useDataStore();

  const activeSlips = useMemo(() => {
    if (slips && slips.length > 0) return slips;
    if (slip) return [slip];
    return [];
  }, [slips, slip]);

  const primarySlip = activeSlips[0];

  // Supplier master lookup for auto-populating contact, PAN, address
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
      if (sName && !map.has(sName.trim().toLowerCase())) {
        map.set(sName.trim().toLowerCase(), {
          name: sName,
          phone: ls.owner_number || ls.driver_number || '',
          pan: ls.owner_pan || '',
          address: ls.owner_address || ''
        });
      }
    });
    return Array.from(map.values());
  }, [suppliers, loadingSlips]);

  const [formData, setFormData] = useState<MemoFormState>({
    memo_number: initialData?.memo_number || nextMemoNumber || '',
    loading_slip_id: initialData?.loading_slip_id || primarySlip?.id || (primarySlip as any)?._id || '',
    loading_slip_ids: initialData?.loading_slip_ids || activeSlips.map(s => s.id || (s as any)._id).filter(Boolean),
    linked_lr_numbers: initialData?.linked_lr_numbers || activeSlips.map(s => s.lr_number || s.slip_number).filter(Boolean),
    date: initialData ? initialData.date.split('T')[0] : (primarySlip?.date ? new Date(primarySlip.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
    supplier: initialData?.supplier || primarySlip?.supplier || primarySlip?.owner_name || '',
    supplier_contact: initialData?.supplier_contact || initialData?.supplier_phone || primarySlip?.owner_number || primarySlip?.driver_number || '',
    supplier_pan: initialData?.supplier_pan || primarySlip?.owner_pan || '',
    supplier_address: initialData?.supplier_address || primarySlip?.owner_address || '',
    vehicle_no: initialData?.vehicle_no || primarySlip?.vehicle_no || (primarySlip as any)?.truck_number || '',
    driver_name: initialData?.driver_name || primarySlip?.driver_name || '',
    driver_number: initialData?.driver_number || primarySlip?.driver_number || '',
    freight: initialData?.freight || activeSlips.reduce((sum, s) => sum + (s.freight || s.total_amount || 0), 0),
    commission_rate: 0,
    commission: 0,
    mamool: initialData?.mamool || 0,
    detention: initialData?.detention || activeSlips.reduce((sum, s) => sum + (s.demurrage_charge || 0), 0),
    extra: initialData?.extra || 0,
    rto: initialData?.rto || activeSlips.reduce((sum, s) => sum + (s.rto || 0), 0),
    deduction: initialData?.deduction || 0,
    net_amount: initialData?.net_amount || 0,
    advance_payments: initialData?.advance_payments || [] as AdvancePayment[],
    status: initialData?.status || 'pending' as const,
    narration: initialData?.narration || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-populate form when activeSlips change
  useEffect(() => {
    if (activeSlips.length > 0 && !initialData) {
      const p = activeSlips[0];
      const match = knownSuppliers.find(s => s.name.toLowerCase() === (p.supplier || p.owner_name || '').toLowerCase());
      setFormData(prev => ({
        ...prev,
        memo_number: nextMemoNumber || '',
        loading_slip_id: p.id || (p as any)._id || '',
        loading_slip_ids: activeSlips.map(s => s.id || (s as any)._id).filter(Boolean),
        linked_lr_numbers: activeSlips.map(s => s.lr_number || s.slip_number).filter(Boolean),
        date: new Date(p.date).toISOString().split('T')[0],
        supplier: p.supplier || p.owner_name || '',
        supplier_contact: match?.phone || p.owner_number || p.driver_number || prev.supplier_contact,
        supplier_pan: match?.pan || p.owner_pan || prev.supplier_pan,
        supplier_address: match?.address || p.owner_address || prev.supplier_address,
        vehicle_no: p.vehicle_no || (p as any).truck_number || prev.vehicle_no,
        driver_name: p.driver_name || prev.driver_name,
        driver_number: p.driver_number || prev.driver_number,
        freight: activeSlips.reduce((sum, s) => sum + (s.freight || s.total_amount || 0), 0),
        rto: activeSlips.reduce((sum, s) => sum + (s.rto || 0), 0),
        detention: activeSlips.reduce((sum, s) => sum + (s.demurrage_charge || 0), 0),
      }));
    }
  }, [activeSlips, nextMemoNumber, initialData, knownSuppliers]);

  // Handle supplier name change & auto-populate details
  const handleSupplierChange = (val: string) => {
    const match = knownSuppliers.find(s => s.name.toLowerCase() === val.trim().toLowerCase());
    setFormData(prev => ({
      ...prev,
      supplier: val,
      supplier_contact: match?.phone || prev.supplier_contact,
      supplier_pan: match?.pan || prev.supplier_pan,
      supplier_address: match?.address || prev.supplier_address,
    }));
  };

  // Compute net_amount without commission deduction (freight + detention + extra + rto - mamool - deduction)
  useEffect(() => {
    const netAmount = formData.freight - formData.mamool + formData.detention + formData.extra + formData.rto - (formData.deduction || 0);
    setFormData(prev => ({
      ...prev,
      net_amount: netAmount,
    }));
  }, [formData.freight, formData.mamool, formData.detention, formData.extra, formData.rto, formData.deduction]);

  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      onSubmit(formData);
    } catch (error) {
      console.error('❌ Memo submission failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {initialData ? 'Edit Freight Memo' : 'New Freight Memo'}
          </h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Memo Number
              </label>
              <input
                type="text"
                name="memo_number"
                value={formData.memo_number}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date
              </label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Supplier & Lorry Owner Details Section */}
          <div className="bg-amber-50/60 border border-amber-200 p-4 rounded-lg space-y-4">
            <div className="flex items-center space-x-2 text-amber-900 border-b border-amber-200 pb-2">
              <Truck className="w-4 h-4 text-amber-700" />
              <h3 className="text-sm font-semibold">Supplier / Lorry Owner Details (Auto-filled from LR)</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Supplier / Owner Name
                </label>
                <input
                  type="text"
                  name="supplier"
                  list="memo-suppliers-list"
                  value={formData.supplier}
                  onChange={(e) => handleSupplierChange(e.target.value)}
                  placeholder="Type or select supplier"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
                <datalist id="memo-suppliers-list">
                  {knownSuppliers.map((s, idx) => (
                    <option key={idx} value={s.name} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Supplier Phone / Mobile
                </label>
                <input
                  type="text"
                  name="supplier_contact"
                  value={formData.supplier_contact}
                  onChange={handleInputChange}
                  placeholder="Owner mobile number"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Supplier PAN No.
                </label>
                <input
                  type="text"
                  name="supplier_pan"
                  value={formData.supplier_pan}
                  onChange={handleInputChange}
                  placeholder="PAN Number"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Vehicle / Truck No.
                </label>
                <input
                  type="text"
                  name="vehicle_no"
                  value={formData.vehicle_no}
                  onChange={handleInputChange}
                  placeholder="e.g. GJ01AB1234"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Driver Name
                </label>
                <input
                  type="text"
                  name="driver_name"
                  value={formData.driver_name}
                  onChange={handleInputChange}
                  placeholder="Driver Name"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Driver Phone
                </label>
                <input
                  type="text"
                  name="driver_number"
                  value={formData.driver_number}
                  onChange={handleInputChange}
                  placeholder="Driver Phone"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {activeSlips.length > 0 && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-blue-900 mb-2 flex items-center justify-between">
                <span>Linked LR Details ({activeSlips.length} LR{activeSlips.length > 1 ? 's' : ''})</span>
                <span className="text-xs font-medium text-blue-700">Total Freight: {formatCurrency(formData.freight)}</span>
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {activeSlips.map((s, idx) => (
                  <div key={idx} className="bg-white p-2.5 rounded border border-blue-200 text-xs grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div>
                      <span className="text-gray-500">LR No:</span>
                      <span className="ml-1 font-bold text-blue-800">{s.lr_number || s.slip_number}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Vehicle:</span>
                      <span className="ml-1 font-medium">{s.vehicle_no || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Route:</span>
                      <span className="ml-1 font-medium">{s.from_location} → {s.to_location}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Freight:</span>
                      <span className="ml-1 font-bold text-gray-900">{formatCurrency(s.freight || s.total_amount || 0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Freight (₹)
              </label>
              <input
                type="number"
                name="freight"
                value={formData.freight}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                step="0.01"
                min="0"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mamool (₹)
              </label>
              <input
                type="number"
                name="mamool"
                value={formData.mamool}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                step="0.01"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Detention (₹)
              </label>
              <input
                type="number"
                name="detention"
                value={formData.detention}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                step="0.01"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Extra (₹)
              </label>
              <input
                type="number"
                name="extra"
                value={formData.extra}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                step="0.01"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                RTO (₹)
              </label>
              <input
                type="number"
                name="rto"
                value={formData.rto}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                step="0.01"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deduction (₹)
              </label>
              <input
                type="number"
                name="deduction"
                value={formData.deduction}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                step="0.01"
                min="0"
              />
            </div>
          </div>

          {/* Narration Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Narration
            </label>
            <textarea
              name="narration"
              value={formData.narration}
              onChange={(e) => setFormData(prev => ({ ...prev, narration: e.target.value }))}
              placeholder="Enter narration or remarks"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
            />
          </div>

          {/* Calculation Summary */}
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center mb-3">
              <Calculator className="w-5 h-5 text-green-600 mr-2" />
              <h3 className="text-sm font-medium text-green-900">Calculation Summary</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-green-700">Freight:</span>
                <span className="ml-2 font-medium">{formatCurrency(formData.freight)}</span>
              </div>
              <div>
                <span className="text-red-700">Mamool:</span>
                <span className="ml-2 font-medium">-{formatCurrency(formData.mamool)}</span>
              </div>
              <div>
                <span className="text-green-700">Detention + Extra + RTO:</span>
                <span className="ml-2 font-medium">+{formatCurrency(formData.detention + formData.extra + formData.rto)}</span>
              </div>
              <div>
                <span className="text-red-700">Deduction:</span>
                <span className="ml-2 font-medium">-{formatCurrency(formData.deduction)}</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-green-200">
              <div className="flex justify-between items-center">
                <span className="text-green-900 font-medium">Net Amount:</span>
                <span className="text-xl font-bold text-green-900">{formatCurrency(formData.net_amount)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                type="button"
                onClick={onCancel}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-6 py-2 text-white rounded-lg transition-colors ${
                  isSubmitting 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isSubmitting 
                  ? '⏳ Submitting...' 
                  : `${initialData ? 'Update' : 'Create'} Freight Memo`
                }
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MemoForm;