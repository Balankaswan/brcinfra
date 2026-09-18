import React, { useState } from 'react';
import { X, Save, AlertTriangle, CheckCircle, ShieldAlert, FileText } from 'lucide-react';
import { apiService } from '../lib/api';
import { useDataStore } from '../lib/store';
import type { Vehicle } from '../types';


interface VehicleDocumentModalProps {
  vehicle: Vehicle;
  onClose: () => void;
}

export const getExpiryStatus = (dateString?: string) => {
  if (!dateString) return { status: 'none', label: 'Not Set', color: 'bg-gray-100 text-gray-600 border-gray-200', days: null };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(dateString);
  expiry.setHours(0, 0, 0, 0);
  
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return { status: 'expired', label: `Expired (${Math.abs(diffDays)}d ago)`, color: 'bg-red-100 text-red-700 border-red-200 font-semibold', days: diffDays };
  } else if (diffDays <= 30) {
    return { status: 'expiring', label: `Expiring in ${diffDays}d`, color: 'bg-amber-100 text-amber-800 border-amber-300 font-medium', days: diffDays };
  } else {
    return { status: 'valid', label: `Valid (${diffDays}d left)`, color: 'bg-emerald-100 text-emerald-800 border-emerald-200', days: diffDays };
  }
};

const VehicleDocumentModal: React.FC<VehicleDocumentModalProps> = ({ vehicle, onClose }) => {
  const { updateVehicle } = useDataStore();
  
  const formatDateForInput = (d?: string) => {
    if (!d) return '';
    return new Date(d).toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    driver_name: vehicle.driver_name || '',
    driver_phone: vehicle.driver_phone || '',
    fitness_expiry: formatDateForInput(vehicle.fitness_expiry),
    insurance_expiry: formatDateForInput(vehicle.insurance_expiry),
    permit_expiry: formatDateForInput(vehicle.permit_expiry),
    puc_expiry: formatDateForInput(vehicle.puc_expiry),
    tax_expiry: formatDateForInput(vehicle.tax_expiry),
  });

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const updatedData = {
      ...vehicle,
      driver_name: formData.driver_name,
      driver_phone: formData.driver_phone,
      fitness_expiry: formData.fitness_expiry || undefined,
      insurance_expiry: formData.insurance_expiry || undefined,
      permit_expiry: formData.permit_expiry || undefined,
      puc_expiry: formData.puc_expiry || undefined,
      tax_expiry: formData.tax_expiry || undefined,
    };

    try {
      const vehicleId = vehicle._id || vehicle.id;
      const res = await apiService.updateVehicle(vehicleId, updatedData);
      updateVehicle(res.vehicle || updatedData);
      onClose();
    } catch (err) {
      console.error('Failed to update vehicle document expiries:', err);
      updateVehicle(updatedData); // Optimistic local fallback
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const docFields = [
    { key: 'insurance_expiry', label: 'Insurance Expiry' },
    { key: 'fitness_expiry', label: 'Fitness Certificate Expiry' },
    { key: 'permit_expiry', label: 'National/State Permit Expiry' },
    { key: 'puc_expiry', label: 'PUC Expiry' },
    { key: 'tax_expiry', label: 'Road Tax Expiry' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-gray-100">
        
        {/* Header */}
        <div className="p-6 bg-gray-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-600 rounded-xl text-white">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{vehicle.vehicle_no}</h2>
              <p className="text-xs text-gray-400">Document Expiry & Compliance Management</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* Driver Information */}
          <div className="grid grid-cols-2 gap-4 pb-4 border-b border-gray-100">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Driver Name</label>
              <input
                type="text"
                value={formData.driver_name}
                onChange={(e) => setFormData(prev => ({ ...prev, driver_name: e.target.value }))}
                placeholder="e.g. Ramesh Kumar"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Driver Contact Phone</label>
              <input
                type="text"
                value={formData.driver_phone}
                onChange={(e) => setFormData(prev => ({ ...prev, driver_phone: e.target.value }))}
                placeholder="e.g. 9876543210"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Document Expiries */}
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Compliance Expiry Dates</h3>
            {docFields.map(({ key, label }) => {
              const val = (formData as any)[key];
              const info = getExpiryStatus(val);

              return (
                <div key={key} className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between sm:justify-start gap-2 mb-1">
                      <label className="text-sm font-semibold text-gray-800">{label}</label>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border ${info.color}`}>
                        {info.status === 'expired' && <ShieldAlert className="w-3 h-3 mr-1" />}
                        {info.status === 'expiring' && <AlertTriangle className="w-3 h-3 mr-1" />}
                        {info.status === 'valid' && <CheckCircle className="w-3 h-3 mr-1" />}
                        {info.label}
                      </span>
                    </div>
                  </div>
                  <input
                    type="date"
                    value={val}
                    onChange={(e) => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              );
            })}
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center space-x-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Expiries'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

export default VehicleDocumentModal;
