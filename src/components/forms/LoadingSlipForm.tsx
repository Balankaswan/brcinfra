import React, { useState, useEffect } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { useDataStore } from '../../lib/store';
import { apiService } from '../../lib/api';
import { formatCurrency } from '../../utils/numberGenerator';
import { SORTED_CITIES } from '../../data/cities';
import type { LoadingSlip } from '../../types';

interface LoadingSlipFormProps {
  initialData?: LoadingSlip | null;
  nextSlipNumber: string;
  onSubmit: (data: Omit<LoadingSlip, 'id' | 'created_at' | 'updated_at'>) => void;
  onCancel: () => void;
}

const LoadingSlipForm: React.FC<LoadingSlipFormProps> = ({ initialData, nextSlipNumber, onSubmit, onCancel }) => {
  const { parties, suppliers, vehicles, loadingSlips, addParty, addSupplier, addVehicle } = useDataStore();
  const [formData, setFormData] = useState({
    slip_number: initialData ? initialData.slip_number : nextSlipNumber,
    date: new Date().toISOString().split('T')[0],
    party: '',
    vehicle_no: '',
    from_location: '',
    to_location: '',
    material: '',
    dimension: '',
    weight: 0,
    supplier: '',
    freight: 0,
    advance: 0,
    rto: 0,
    narration: '',
  });

  // Comprehensive Indian cities database for autocomplete - All in CAPS LOCK
  const locations = SORTED_CITIES;
  const [showNewPartyForm, setShowNewPartyForm] = useState(false);
  const [showNewSupplierForm, setShowNewSupplierForm] = useState(false);
  const [showNewVehicleForm, setShowNewVehicleForm] = useState(false);
  const [newPartyName, setNewPartyName] = useState('');
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newVehicleData, setNewVehicleData] = useState({
    vehicle_no: '',
    vehicle_type: 'Truck',
    ownership_type: 'market' as 'own' | 'market',
    owner_name: '',
    driver_name: '',
    driver_phone: ''
  });
  
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);
  const [showMaterialDropdown, setShowMaterialDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddingParty, setIsAddingParty] = useState(false);
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [isAddingVehicle, setIsAddingVehicle] = useState(false);

  // Extract unique materials from existing loading slips
  const previousMaterials = React.useMemo(() => {
    const materials = loadingSlips
      .map(slip => slip.material)
      .filter(material => material && material.trim() !== '')
      .map(material => material.toUpperCase().trim());
    
    // Remove duplicates and add common materials
    const uniqueMaterials = [...new Set(materials)];
    
    // Add common transport materials if not already present
    const commonMaterials = [
      'STEEL COILS', 'IRON ORE', 'COAL', 'CEMENT', 'MACHINERY', 'AUTOMOBILE PARTS',
      'TEXTILE GOODS', 'CHEMICALS', 'FOOD GRAINS', 'FERTILIZER', 'PETROLEUM PRODUCTS',
      'CONSTRUCTION MATERIAL', 'ELECTRONICS', 'PLASTIC GOODS', 'PAPER PRODUCTS',
      'METAL SHEETS', 'PIPES', 'TILES', 'MARBLE', 'GRANITE', 'WOOD PRODUCTS'
    ];
    
    commonMaterials.forEach(material => {
      if (!uniqueMaterials.includes(material)) {
        uniqueMaterials.push(material);
      }
    });
    
    return uniqueMaterials.sort();
  }, [loadingSlips]);

  useEffect(() => {
    if (initialData) {
      setFormData({
        slip_number: initialData.slip_number || nextSlipNumber,
        date: initialData.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        party: initialData.party || '',
        vehicle_no: initialData.vehicle_no || '',
        from_location: initialData.from_location || '',
        to_location: initialData.to_location || '',
        material: initialData.material || '',
        dimension: initialData.dimension || '',
        weight: initialData.weight || 0,
        supplier: initialData.supplier || '',
        freight: initialData.freight || 0,
        advance: initialData.advance || 0,
        rto: initialData.rto || 0,
        narration: initialData.narration || '',
      });
    }
  }, [initialData, nextSlipNumber]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setShowPartyDropdown(false);
        setShowSupplierDropdown(false);
        setShowVehicleDropdown(false);
        setShowFromDropdown(false);
        setShowToDropdown(false);
        setShowMaterialDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent double submission
    if (isSubmitting) {
      console.log('⚠️ Submission already in progress, ignoring...');
      return;
    }
    
    setIsSubmitting(true);
    console.log('📝 Starting loading slip submission...');
    
    // Auto-create vehicle if it doesn't exist
    if (!vehicles.find(v => v.vehicle_no === formData.vehicle_no)) {
      const isOwnVehicle = formData.supplier.toLowerCase().includes('bhavishya') || 
                          formData.supplier.toLowerCase().includes('brc') ||
                          formData.supplier === 'Self' ||
                          formData.supplier === 'Own';
      
      const newVehicle = {
        vehicle_no: formData.vehicle_no.trim(),
        vehicle_type: 'Truck',
        ownership_type: (isOwnVehicle ? 'own' : 'market') as 'own' | 'market',
        owner_name: isOwnVehicle ? 'Bhavishya Road Carriers' : formData.supplier,
        driver_name: '',
        driver_phone: ''
      };
      
      // Save to backend first, then add to local store - AWAIT to ensure persistence
      try {
        const response = await apiService.createVehicle(newVehicle);
        addVehicle(response.vehicle);
        console.log('✅ Vehicle auto-created and saved to backend:', response.vehicle);
      } catch (error) {
        console.error('❌ Failed to save vehicle to backend:', error);
        // Fallback to local creation with temporary ID
        const localVehicle = {
          ...newVehicle,
          id: Date.now().toString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        addVehicle(localVehicle);
        console.log('⚠️ Vehicle created locally only (backend failed):', localVehicle);
      }
    }
    
    const balance = formData.freight - formData.advance;
    const total_freight = formData.freight + formData.rto;
    
    try {
      onSubmit({
        ...formData,
        balance,
        total_freight,
      });
      console.log('✅ Loading slip submitted successfully');
    } catch (error) {
      console.error('❌ Loading slip submission failed:', error);
    } finally {
      // Always reset submitting state
      setIsSubmitting(false);
      console.log('🔄 Form submission state reset');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleDropdownSelect = (field: string, value: string) => {
    console.log(`🎯 Dropdown selection: ${field} = ${value}`);
    setFormData(prev => ({ ...prev, [field]: value }));
    // Close all dropdowns
    setShowPartyDropdown(false);
    setShowSupplierDropdown(false);
    setShowVehicleDropdown(false);
    setShowFromDropdown(false);
    setShowToDropdown(false);
    setShowMaterialDropdown(false);
  };

  const handleAddNewParty = async () => {
    if (newPartyName.trim() && !isAddingParty) {
      setIsAddingParty(true);
      console.log('🏢 Adding new party:', newPartyName.trim());
      
      const newParty = {
        name: newPartyName.trim(),
        contact: '',
        address: ''
      };
      
      try {
        // Save to backend first, then add to local store
        const response = await apiService.createParty(newParty);
        addParty(response.party);
        console.log('✅ Party auto-created and saved to backend:', response.party);
        
        setFormData(prev => ({ ...prev, party: newPartyName.trim() }));
        setNewPartyName('');
        setShowNewPartyForm(false);
      } catch (error) {
        console.error('❌ Failed to save party to backend:', error);
        // Fallback to local creation
        const localParty = {
          ...newParty,
          id: Date.now().toString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        addParty(localParty);
        console.log('⚠️ Party created locally only (backend failed):', localParty);
        
        setFormData(prev => ({ ...prev, party: newPartyName.trim() }));
        setNewPartyName('');
        setShowNewPartyForm(false);
      } finally {
        setIsAddingParty(false);
      }
    }
  };

  const handleAddNewSupplier = async () => {
    if (newSupplierName.trim() && !isAddingSupplier) {
      setIsAddingSupplier(true);
      console.log('🚚 Adding new supplier:', newSupplierName.trim());
      
      const newSupplier = {
        name: newSupplierName.trim(),
        contact: '',
        address: ''
      };
      
      try {
        // Save to backend first, then add to local store
        const response = await apiService.createSupplier(newSupplier);
        addSupplier(response.supplier);
        console.log('✅ Supplier auto-created and saved to backend:', response.supplier);
        
        setFormData(prev => ({ ...prev, supplier: newSupplierName.trim() }));
        setNewSupplierName('');
        setShowNewSupplierForm(false);
      } catch (error) {
        console.error('❌ Failed to save supplier to backend:', error);
        // Fallback to local creation
        const localSupplier = {
          ...newSupplier,
          id: Date.now().toString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        addSupplier(localSupplier);
        console.log('⚠️ Supplier created locally only (backend failed):', localSupplier);
        
        setFormData(prev => ({ ...prev, supplier: newSupplierName.trim() }));
        setNewSupplierName('');
        setShowNewSupplierForm(false);
      } finally {
        setIsAddingSupplier(false);
      }
    }
  };

  const handleAddNewVehicle = async () => {
    if (newVehicleData.vehicle_no.trim() && !isAddingVehicle) {
      setIsAddingVehicle(true);
      console.log('🚗 Adding new vehicle:', newVehicleData.vehicle_no.trim());
      
      const newVehicle = {
        ...newVehicleData,
        vehicle_no: newVehicleData.vehicle_no.trim(),
      };
      
      try {
        // Save to backend first, then add to local store
        const response = await apiService.createVehicle(newVehicle);
        addVehicle(response.vehicle);
        console.log('✅ Vehicle auto-created and saved to backend:', response.vehicle);
        
        setFormData(prev => ({ ...prev, vehicle_no: newVehicleData.vehicle_no.trim() }));
        setNewVehicleData({
          vehicle_no: '',
          vehicle_type: 'Truck',
          ownership_type: 'market',
          owner_name: '',
          driver_name: '',
          driver_phone: ''
        });
        setShowNewVehicleForm(false);
      } catch (error) {
        console.error('❌ Failed to save vehicle to backend:', error);
        // Fallback to local creation
        const localVehicle = {
          ...newVehicle,
          id: Date.now().toString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        addVehicle(localVehicle);
        console.log('⚠️ Vehicle created locally only (backend failed):', localVehicle);
        
        setFormData(prev => ({ ...prev, vehicle_no: newVehicleData.vehicle_no.trim() }));
        setNewVehicleData({
          vehicle_no: '',
          vehicle_type: 'Truck',
          ownership_type: 'market',
          owner_name: '',
          driver_name: '',
          driver_phone: ''
        });
        setShowNewVehicleForm(false);
      } finally {
        setIsAddingVehicle(false);
      }
    }
  };

  const filterOptions = (options: any[], searchTerm: string) => {
    // Remove duplicates first, then filter by search term
    const uniqueOptions = options.reduce((acc: any[], option: any) => {
      const optionValue = typeof option === 'string' ? option : option.vehicle_no || option.name || '';
      if (!acc.find((item: any) => {
        const itemValue = typeof item === 'string' ? item : item.vehicle_no || item.name || '';
        return itemValue === optionValue;
      })) {
        acc.push(option);
      }
      return acc;
    }, []);
    
    // If no search term, return all unique options
    if (!searchTerm || searchTerm.trim() === '') {
      return uniqueOptions;
    }
    
    return uniqueOptions.filter((option: any) => {
      const optionText = typeof option === 'string' ? option : option.vehicle_no || option.name || '';
      return optionText.toLowerCase().includes(searchTerm.toLowerCase());
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {initialData ? 'Edit Loading Slip' : 'New Loading Slip'}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Slip Number
              </label>
              <input
                type="text"
                name="slip_number"
                value={formData.slip_number}
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
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Party (M/S)
              </label>
              <div className="relative dropdown-container">
                <input
                  type="text"
                  name="party"
                  value={formData.party}
                  onChange={handleInputChange}
                  onFocus={() => setShowPartyDropdown(true)}
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <ChevronDown 
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 cursor-pointer"
                  onClick={() => setShowPartyDropdown(!showPartyDropdown)}
                />
                {showPartyDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filterOptions(parties.map(party => party.name), formData.party).map((partyName) => (
                      <div
                        key={partyName}
                        className="px-4 py-2 hover:bg-blue-50 cursor-pointer"
                        onClick={() => handleDropdownSelect('party', partyName)}
                      >
                        {partyName}
                      </div>
                    ))}
                    <div className="border-t border-gray-200">
                      <div
                        className="px-4 py-2 text-blue-600 hover:bg-blue-50 cursor-pointer font-medium"
                        onClick={() => {
                          setShowNewPartyForm(true);
                          setShowPartyDropdown(false);
                        }}
                      >
                        + Add New Party
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vehicle No
              </label>
              <div className="relative dropdown-container">
                <input
                  type="text"
                  name="vehicle_no"
                  value={formData.vehicle_no}
                  onChange={handleInputChange}
                  onFocus={() => setShowVehicleDropdown(true)}
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <ChevronDown 
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 cursor-pointer"
                  onClick={() => setShowVehicleDropdown(!showVehicleDropdown)}
                />
                {showVehicleDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filterOptions(vehicles, formData.vehicle_no).map((vehicle: any, index: number) => (
                      <div
                        key={`vehicle-${vehicle.id || index}`}
                        className="px-4 py-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between"
                        onClick={() => handleDropdownSelect('vehicle_no', typeof vehicle === 'string' ? vehicle : vehicle.vehicle_no)}
                      >
                        <div className="flex items-center space-x-2">
                          <span>{typeof vehicle === 'string' ? vehicle : vehicle.vehicle_no}</span>
                          {typeof vehicle !== 'string' && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              vehicle.ownership_type === 'own' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {vehicle.ownership_type === 'own' ? 'Own Vehicle' : 'Market Vehicle'}
                            </span>
                          )}
                        </div>
                        {typeof vehicle !== 'string' && vehicle.vehicle_type && (
                          <span className="text-xs text-gray-500">{vehicle.vehicle_type}</span>
                        )}
                      </div>
                    ))}
                    <div className="border-t border-gray-200">
                      <div
                        className="px-4 py-2 text-blue-600 hover:bg-blue-50 cursor-pointer font-medium"
                        onClick={() => {
                          setShowNewVehicleForm(true);
                          setShowVehicleDropdown(false);
                        }}
                      >
                        + Add New Vehicle
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Supplier
              </label>
              <div className="relative dropdown-container">
                <input
                  type="text"
                  name="supplier"
                  value={formData.supplier}
                  onChange={handleInputChange}
                  onFocus={() => setShowSupplierDropdown(true)}
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <ChevronDown 
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 cursor-pointer"
                  onClick={() => setShowSupplierDropdown(!showSupplierDropdown)}
                />
                {showSupplierDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filterOptions(suppliers.map(supplier => supplier.name), formData.supplier).map((supplierName) => (
                      <div
                        key={supplierName}
                        className="px-4 py-2 hover:bg-blue-50 cursor-pointer"
                        onClick={() => handleDropdownSelect('supplier', supplierName)}
                      >
                        {supplierName}
                      </div>
                    ))}
                    <div className="border-t border-gray-200">
                      <div
                        className="px-4 py-2 text-blue-600 hover:bg-blue-50 cursor-pointer font-medium"
                        onClick={() => {
                          setShowNewSupplierForm(true);
                          setShowSupplierDropdown(false);
                        }}
                      >
                        + Add New Supplier
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                From
              </label>
              <div className="relative dropdown-container">
                <input
                  type="text"
                  name="from_location"
                  value={formData.from_location}
                  onChange={handleInputChange}
                  onFocus={() => setShowFromDropdown(true)}
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <ChevronDown 
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 cursor-pointer"
                  onClick={() => setShowFromDropdown(!showFromDropdown)}
                />
                {showFromDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {filterOptions(locations, formData.from_location).map((location: string, index: number) => (
                      <div
                        key={`from-${index}`}
                        className="px-4 py-2 hover:bg-blue-50 cursor-pointer"
                        onClick={() => handleDropdownSelect('from_location', location)}
                      >
                        {location}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                To
              </label>
              <div className="relative dropdown-container">
                <input
                  type="text"
                  name="to_location"
                  value={formData.to_location}
                  onChange={handleInputChange}
                  onFocus={() => setShowToDropdown(true)}
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <ChevronDown 
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 cursor-pointer"
                  onClick={() => setShowToDropdown(!showToDropdown)}
                />
                {showToDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {filterOptions(locations, formData.to_location).map((location: string, index: number) => (
                      <div
                        key={`to-${index}`}
                        className="px-4 py-2 hover:bg-blue-50 cursor-pointer"
                        onClick={() => handleDropdownSelect('to_location', location)}
                      >
                        {location}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Material
              </label>
              <div className="relative dropdown-container">
                <input
                  type="text"
                  name="material"
                  value={formData.material}
                  onChange={handleInputChange}
                  onFocus={() => setShowMaterialDropdown(true)}
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Steel Coils, Iron Ore"
                />
                <ChevronDown 
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 cursor-pointer"
                  onClick={() => setShowMaterialDropdown(!showMaterialDropdown)}
                />
                {showMaterialDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {filterOptions(previousMaterials, formData.material).map((material: string, index: number) => (
                      <div
                        key={`material-${index}`}
                        className="px-4 py-2 hover:bg-blue-50 cursor-pointer"
                        onClick={() => handleDropdownSelect('material', material)}
                      >
                        {material}
                      </div>
                    ))}
                    {filterOptions(previousMaterials, formData.material).length === 0 && (
                      <div className="px-4 py-2 text-gray-500 text-sm">
                        No materials found. Type to add new material.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dimension
              </label>
              <input
                type="text"
                name="dimension"
                value={formData.dimension}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 20ft x 8ft x 8ft"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Weight (MT)
              </label>
              <input
                type="number"
                name="weight"
                value={formData.weight}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                step="0.01"
                min="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Advance (₹)
              </label>
              <input
                type="number"
                name="advance"
                value={formData.advance}
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

          {/* Calculated Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Balance (Freight - Advance)
              </label>
              <div className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700">
                {formatCurrency(formData.freight - formData.advance)}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Freight (Freight + RTO)
              </label>
              <div className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700">
                {formatCurrency(formData.freight + formData.rto)}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <div>
              {initialData && (
                <button
                  type="button"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  onClick={() => console.log('PDF generation not implemented yet')}
                >
                  Generate PDF
                </button>
              )}
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
                  : `${initialData ? 'Update' : 'Create'} Loading Slip`
                }
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* New Party Modal */}
      {showNewPartyForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Add New Party</h3>
            <input
              type="text"
              value={newPartyName}
              onChange={(e) => setNewPartyName(e.target.value)}
              placeholder="Enter party name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
              autoFocus
            />
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowNewPartyForm(false);
                  setNewPartyName('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddNewParty}
                className={`px-4 py-2 text-white rounded-lg ${
                  isAddingParty || !newPartyName.trim()
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
                disabled={isAddingParty || !newPartyName.trim()}
              >
                {isAddingParty ? '⏳ Adding...' : 'Add Party'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Supplier Modal */}
      {showNewSupplierForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Add New Supplier</h3>
            <input
              type="text"
              value={newSupplierName}
              onChange={(e) => setNewSupplierName(e.target.value)}
              placeholder="Enter supplier name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
              autoFocus
            />
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowNewSupplierForm(false);
                  setNewSupplierName('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddNewSupplier}
                className={`px-4 py-2 text-white rounded-lg ${
                  isAddingSupplier || !newSupplierName.trim()
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
                disabled={isAddingSupplier || !newSupplierName.trim()}
              >
                {isAddingSupplier ? '⏳ Adding...' : 'Add Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Vehicle Modal */}
      {showNewVehicleForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Add New Vehicle</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Number *</label>
                <input
                  type="text"
                  value={newVehicleData.vehicle_no}
                  onChange={(e) => setNewVehicleData(prev => ({ ...prev, vehicle_no: e.target.value }))}
                  placeholder="e.g., GJ01AB1234"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
                <select
                  value={newVehicleData.vehicle_type}
                  onChange={(e) => setNewVehicleData(prev => ({ ...prev, vehicle_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Truck">Truck</option>
                  <option value="Trailer">Trailer</option>
                  <option value="Container">Container</option>
                  <option value="Tanker">Tanker</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ownership Type *</label>
                <select
                  value={newVehicleData.ownership_type}
                  onChange={(e) => setNewVehicleData(prev => ({ ...prev, ownership_type: e.target.value as 'own' | 'market' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="market">Market Vehicle</option>
                  <option value="own">Own Vehicle</option>
                </select>
              </div>
              {newVehicleData.ownership_type === 'market' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Owner Name</label>
                  <input
                    type="text"
                    value={newVehicleData.owner_name}
                    onChange={(e) => setNewVehicleData(prev => ({ ...prev, owner_name: e.target.value }))}
                    placeholder="Vehicle owner name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Driver Name</label>
                <input
                  type="text"
                  value={newVehicleData.driver_name}
                  onChange={(e) => setNewVehicleData(prev => ({ ...prev, driver_name: e.target.value }))}
                  placeholder="Driver name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Driver Phone</label>
                <input
                  type="tel"
                  value={newVehicleData.driver_phone}
                  onChange={(e) => setNewVehicleData(prev => ({ ...prev, driver_phone: e.target.value }))}
                  placeholder="Driver phone number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowNewVehicleForm(false);
                  setNewVehicleData({
                    vehicle_no: '',
                    vehicle_type: 'Truck',
                    ownership_type: 'market',
                    owner_name: '',
                    driver_name: '',
                    driver_phone: ''
                  });
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddNewVehicle}
                className={`px-4 py-2 text-white rounded-lg ${
                  isAddingVehicle || !newVehicleData.vehicle_no.trim()
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
                disabled={isAddingVehicle || !newVehicleData.vehicle_no.trim()}
              >
                {isAddingVehicle ? '⏳ Adding...' : 'Add Vehicle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoadingSlipForm;