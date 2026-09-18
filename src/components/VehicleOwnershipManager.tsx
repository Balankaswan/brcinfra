import React, { useState } from 'react';
import { Truck, Edit2, Save, X, FileText } from 'lucide-react';
import { useDataStore } from '../lib/store';
import { apiService } from '../lib/api';
import VehicleDocumentModal, { getExpiryStatus } from './VehicleDocumentModal';

const VehicleOwnershipManager: React.FC = () => {
  const { vehicles, updateVehicle, cleanupSupplierLedgerForOwnVehicles } = useDataStore();
  const [editingVehicle, setEditingVehicle] = useState<string | null>(null);
  const [tempOwnership, setTempOwnership] = useState<'own' | 'market'>('market');
  const [selectedVehicleForDocs, setSelectedVehicleForDocs] = useState<any | null>(null);

  const handleEditOwnership = (vehicleId: string, currentOwnership: 'own' | 'market') => {
    setEditingVehicle(vehicleId);
    setTempOwnership(currentOwnership);
  };

  const handleSaveOwnership = async (vehicle: any) => {
    const updatedVehicle = {
      ...vehicle,
      ownership_type: tempOwnership,
      owner_name: tempOwnership === 'own' ? 'Bhavishya Road Carriers' : vehicle.owner_name
    };
    
    try {
      const vehicleId = vehicle._id || vehicle.id;
      if (!vehicleId) {
        console.error('Vehicle ID is missing:', vehicle);
        return;
      }
      const response = await apiService.updateVehicle(vehicleId, updatedVehicle);
      updateVehicle(response.vehicle);
      console.log('Vehicle ownership updated and synced:', response.vehicle);
    } catch (error) {
      console.error('Failed to update vehicle ownership:', error);
      updateVehicle(updatedVehicle);
    }
    
    // Clean up incorrect supplier ledger entries after updating ownership
    cleanupSupplierLedgerForOwnVehicles();
    
    setEditingVehicle(null);
  };

  const handleCancel = () => {
    setEditingVehicle(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Vehicle Ownership & Document Manager</h1>
        <div className="text-sm text-gray-600">
          Manage ownership types, driver details & document expiry dates
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">All Vehicles</h3>
          <p className="text-sm text-gray-600 mt-1">
            Update ownership status or set Insurance, Fitness, Permit, PUC, and Tax expiry dates
          </p>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {vehicles.map((vehicle, index) => {
              const vehicleId = vehicle.id || vehicle._id;
              return (
                <div key={vehicleId || `vehicle-${vehicle.vehicle_no}-${index}`} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 rounded-lg gap-4">
                  <div className="flex items-start space-x-4">
                    <Truck className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-gray-900 text-base">{vehicle.vehicle_no}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${vehicle.ownership_type === 'own' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                          {vehicle.ownership_type === 'own' ? 'Own Vehicle' : 'Market Vehicle'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500 mt-0.5">
                        Owner: {vehicle.owner_name || 'Not specified'} {vehicle.driver_name ? `• Driver: ${vehicle.driver_name}` : ''} {vehicle.driver_phone ? `(${vehicle.driver_phone})` : ''}
                      </div>

                      {/* Expiry Pill Badges Summary */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {[
                          { label: 'Ins', date: vehicle.insurance_expiry },
                          { label: 'Fit', date: vehicle.fitness_expiry },
                          { label: 'Permit', date: vehicle.permit_expiry },
                          { label: 'PUC', date: vehicle.puc_expiry },
                          { label: 'Tax', date: vehicle.tax_expiry }
                        ].map(({ label, date }) => {
                          const info = getExpiryStatus(date);
                          return (
                            <span key={label} className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs border ${info.color}`}>
                              <span className="font-semibold mr-1">{label}:</span> {date ? info.label : 'Not set'}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3 self-end sm:self-center">
                    {editingVehicle === vehicleId ? (
                      <div className="flex items-center space-x-2">
                        <select
                          value={tempOwnership}
                          onChange={(e) => setTempOwnership(e.target.value as 'own' | 'market')}
                          className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="own">Own Vehicle</option>
                          <option value="market">Market Vehicle</option>
                        </select>
                        <button
                          onClick={() => handleSaveOwnership(vehicle)}
                          className="p-1 text-green-600 hover:text-green-800"
                          title="Save"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={handleCancel}
                          className="p-1 text-gray-600 hover:text-gray-800"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setSelectedVehicleForDocs(vehicle)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5 shadow-sm"
                          title="Manage Documents & Expiries"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Manage Expiries</span>
                        </button>

                        <button
                          onClick={() => handleEditOwnership(vehicleId, vehicle.ownership_type || 'market')}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-white rounded-md transition-colors"
                          title="Edit ownership"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {vehicles.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              <Truck className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No vehicles found</p>
            </div>
          )}
        </div>
      </div>

      {/* Vehicle Document Expiry Modal */}
      {selectedVehicleForDocs && (
        <VehicleDocumentModal
          vehicle={selectedVehicleForDocs}
          onClose={() => setSelectedVehicleForDocs(null)}
        />
      )}
    </div>
  );
};

export default VehicleOwnershipManager;
