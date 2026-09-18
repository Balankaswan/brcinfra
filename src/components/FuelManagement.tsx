import React, { useState, useMemo } from 'react';
import { Plus, Fuel, Truck, UserPlus, Wallet, BarChart3 } from 'lucide-react';
import { useDataStore } from '../lib/store';
import { apiService } from '../lib/api';
import FuelAllocationLedger from './FuelAllocationLedger';
import { formatCurrency } from '../utils/numberGenerator';
import type { BankingEntry, Vehicle } from '../types';

const FuelManagement: React.FC = () => {
  const {
    fuelWallets,
    vehicleFuelExpenses,
    vehicles,
    suppliers,
    memos,
    updateMemo,
    addBankingEntry,
    allocateFuelToVehicle,
    getVehicleFuelExpenses,
    addVehicle
  } = useDataStore();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'allocate' | 'wallets' | 'vehicles' | 'add-vehicle' | 'ledger'>('dashboard');
  const [selectedWallet, setSelectedWallet] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedMemo, setSelectedMemo] = useState('');
  const [allocationForm, setAllocationForm] = useState({
    amount: '',
    fuelQuantity: '',
    ratePerLiter: '',
    odometerReading: '',
    narration: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [walletCreditForm, setWalletCreditForm] = useState({
    walletName: 'BPCL',
    amount: '',
    narration: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [newVehicleForm, setNewVehicleForm] = useState({
    vehicleNo: '',
    vehicleType: 'Truck',
    ownerName: '',
    driverName: '',
    driverPhone: ''
  });

  // Calculate totals - divide by 2 to compensate for double counting
  const totalWalletBalance = fuelWallets.reduce((sum, wallet) => sum + wallet.balance, 0) / 2;
  const totalFuelAllocated = vehicleFuelExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const totalVehicles = vehicles.length;

  // Handle new vehicle registration
  const handleAddVehicle = () => {
    if (!newVehicleForm.vehicleNo) return;

    const newVehicle: Vehicle = {
      id: Date.now().toString(),
      vehicle_no: newVehicleForm.vehicleNo.toUpperCase(),
      vehicle_type: newVehicleForm.vehicleType,
      ownership_type: 'own',
      owner_name: newVehicleForm.ownerName || undefined,
      driver_name: newVehicleForm.driverName || undefined,
      driver_phone: newVehicleForm.driverPhone || undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    addVehicle(newVehicle);
    setNewVehicleForm({
      vehicleNo: '',
      vehicleType: 'Truck',
      ownerName: '',
      driverName: '',
      driverPhone: ''
    });
    setActiveTab('vehicles');
  };

  // Handle wallet credit (from bank)
  const handleWalletCredit = () => {
    if (!walletCreditForm.amount || !walletCreditForm.walletName) return;

    const bankingEntry: BankingEntry = {
      id: Date.now().toString(),
      type: 'debit',
      category: 'fuel_wallet',
      amount: parseFloat(walletCreditForm.amount),
      date: walletCreditForm.date,
      reference_name: walletCreditForm.walletName,
      narration: walletCreditForm.narration || `Fuel wallet credit to ${walletCreditForm.walletName}`,
      created_at: new Date().toISOString()
    };

    addBankingEntry(bankingEntry);
    setWalletCreditForm({
      walletName: 'BPCL',
      amount: '',
      narration: '',
      date: new Date().toISOString().split('T')[0]
    });
  };

  // Handle fuel allocation to vehicle
  const handleFuelAllocation = async () => {
    // Validation checks
    if (!selectedWallet || !allocationForm.amount) {
      alert('Please select a fuel wallet and enter an amount');
      return;
    }

    if (!selectedVehicle && !selectedSupplier && !selectedMemo) {
      alert('Please select either a Vehicle, a Supplier, or a Memo');
      return;
    }

    if ((selectedVehicle && selectedSupplier) || (selectedVehicle && selectedMemo) || (selectedSupplier && selectedMemo)) {
      alert('Please select only ONE of: Vehicle, Supplier, or Memo');
      return;
    }

    // Parse and validate numeric inputs
    const amount = parseFloat(allocationForm.amount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount greater than 0');
      return;
    }

    const fuelQuantity = allocationForm.fuelQuantity ? parseFloat(allocationForm.fuelQuantity) : 0;
    const ratePerLiter = allocationForm.ratePerLiter ? parseFloat(allocationForm.ratePerLiter) : 0;
    const odometerReading = allocationForm.odometerReading ? parseInt(allocationForm.odometerReading) : 0;

    // Validate parsed numbers
    if (allocationForm.fuelQuantity && (isNaN(fuelQuantity) || fuelQuantity < 0)) {
      alert('Please enter a valid fuel quantity');
      return;
    }

    if (allocationForm.ratePerLiter && (isNaN(ratePerLiter) || ratePerLiter < 0)) {
      alert('Please enter a valid rate per liter');
      return;
    }

    if (allocationForm.odometerReading && (isNaN(odometerReading) || odometerReading < 0)) {
      alert('Please enter a valid odometer reading');
      return;
    }

    // Disable button to prevent double submission
    const submitButton = document.querySelector('[data-fuel-submit]') as HTMLButtonElement;
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Allocating...';
    }

    try {
      console.log('🚛 Fuel allocation started:', {
        selectedVehicle,
        selectedWallet,
        selectedSupplier,
        selectedMemo,
        amount,
        date: allocationForm.date,
        narration: allocationForm.narration
      });

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 30000)
      );

      if (selectedMemo) {
        // ===== MEMO FLOW: Fuel allocated against a memo =====
        const memo = memos.find(m => (m.id || (m as any)._id) === selectedMemo);
        if (!memo) {
          alert('Error: Selected memo not found.');
          return;
        }

        const memoId = memo.id || (memo as any)._id;

        // Step 1: Deduct from fuel wallet via the allocateFuel API
        const walletDeductPromise = allocateFuelToVehicle(
          `MEMO-${memo.memo_number}`,
          selectedWallet,
          amount,
          allocationForm.date,
          `Fuel advance for Memo ${memo.memo_number} - ${memo.supplier}`,
          fuelQuantity,
          ratePerLiter,
          odometerReading,
          'Diesel',
          'System',
          memo.supplier
        );
        await Promise.race([walletDeductPromise, timeoutPromise]);

        // Step 2: Add fuel as advance_payment on the memo (tagged with fuel- prefix)
        const fuelAdvance = {
          id: `fuel-${Date.now()}`,
          date: allocationForm.date || new Date().toISOString().split('T')[0],
          amount: amount,
          mode: 'other' as const,
          reference: selectedWallet,
          description: `Fuel - ${selectedWallet}`
        };

        const updatedMemo = {
          ...memo,
          advance_payments: [...(memo.advance_payments || []), fuelAdvance]
        };

        await apiService.updateMemo(memoId, updatedMemo);
        updateMemo(updatedMemo);
        console.log('✅ Fuel advance recorded on memo:', memo.memo_number, 'Amount:', amount);

        // Trigger data sync so other components refresh
        window.dispatchEvent(new CustomEvent('data-sync-required'));

      } else {
        // ===== VEHICLE/SUPPLIER FLOW: Original logic =====
        const allocationPromise = allocateFuelToVehicle(
          selectedVehicle || 'N/A',
          selectedWallet,
          amount,
          allocationForm.date,
          allocationForm.narration || 'Fuel allocation',
          fuelQuantity,
          ratePerLiter,
          odometerReading,
          'Diesel',
          'System',
          selectedSupplier || undefined
        );

        await Promise.race([allocationPromise, timeoutPromise]);
      }

      // Reset form on success
      setAllocationForm({
        amount: '',
        fuelQuantity: '',
        ratePerLiter: '',
        odometerReading: '',
        narration: '',
        date: new Date().toISOString().split('T')[0]
      });
      setSelectedVehicle('');
      setSelectedWallet('');
      setSelectedSupplier('');
      setSelectedMemo('');

      console.log('✅ Fuel allocation completed, wallet balances should be updated immediately');
      alert('✅ Fuel allocated successfully!');
    } catch (error) {
      console.error('❌ Fuel allocation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`❌ Failed to allocate fuel: ${errorMessage}. Please try again.`);
    } finally {
      // Re-enable button
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = '<svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>Allocate Fuel';
      }
    }
  };

  // Get vehicle fuel summary with error handling
  const fuelSummary = useMemo(() => {
    try {
      if (!vehicles || !Array.isArray(vehicles)) {
        console.warn('Vehicles data is not available or not an array');
        return [];
      }

      return vehicles.map(vehicle => {
        try {
          // Safely get expenses with fallback
          const expenses = getVehicleFuelExpenses ? getVehicleFuelExpenses() : [];
          const safeExpenses = Array.isArray(expenses) ? expenses : [];

          const totalExpense = safeExpenses.reduce((sum, exp) => {
            const amount = exp && typeof exp.amount === 'number' ? exp.amount : 0;
            return sum + amount;
          }, 0);

          const totalQuantity = safeExpenses.reduce((sum, exp) => {
            const quantity = exp && typeof exp.fuel_quantity === 'number' ? exp.fuel_quantity : 0;
            return sum + quantity;
          }, 0);

          return {
            vehicleNo: vehicle.vehicle_no || 'Unknown',
            vehicle,
            totalExpense,
            totalQuantity,
            expenseCount: safeExpenses.length,
            lastFuelDate: safeExpenses.length > 0 && safeExpenses[0] ? safeExpenses[0].date : null
          };
        } catch (vehicleError) {
          console.error('Error processing vehicle:', vehicle, vehicleError);
          return {
            vehicleNo: vehicle?.vehicle_no || 'Error',
            vehicle,
            totalExpense: 0,
            totalQuantity: 0,
            expenseCount: 0,
            lastFuelDate: null
          };
        }
      });
    } catch (error) {
      console.error('Error calculating fuel summary:', error);
      return [];
    }
  }, [vehicles, vehicleFuelExpenses, getVehicleFuelExpenses]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Fuel Management</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'dashboard'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('allocate')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'allocate'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            Allocate Fuel
          </button>
          <button
            onClick={() => setActiveTab('wallets')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'wallets'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            Fuel Wallets
          </button>
          <button
            onClick={() => setActiveTab('vehicles')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'vehicles'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            Vehicles
          </button>
          <button
            onClick={() => setActiveTab('add-vehicle')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'add-vehicle'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            <UserPlus className="w-4 h-4 inline-block mr-2" />
            Add Vehicle
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'ledger'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            <BarChart3 className="w-4 h-4 inline-block mr-2" />
            Allocation Ledger
          </button>
        </div>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Wallet Balance</p>
                  <p className="text-2xl font-bold text-blue-600 mt-2">{formatCurrency(totalWalletBalance)}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Fuel Allocated</p>
                  <p className="text-2xl font-bold text-green-600 mt-2">{formatCurrency(totalFuelAllocated)}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Fuel className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Vehicles</p>
                  <p className="text-2xl font-bold text-purple-600 mt-2">{totalVehicles}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Truck className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Fuel Wallets Overview */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Fuel Wallets</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {fuelWallets.map((wallet) => (
                  <div key={wallet.id || `wallet-${wallet.name}`} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">{wallet.name}</h4>
                      <Fuel className="w-5 h-5 text-gray-400" />
                    </div>
                    <p className={`text-xl font-bold ${wallet.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(wallet.balance)}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Updated: {new Date(wallet.updated_at).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Allocate Fuel Tab */}
      {activeTab === 'allocate' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Allocate Fuel</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle (Own Vehicles)</label>
                <select
                  value={selectedVehicle}
                  onChange={(e) => {
                    setSelectedVehicle(e.target.value);
                    if (e.target.value) setSelectedSupplier(''); // Clear supplier when vehicle is selected
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Vehicle (Optional)</option>
                  {vehicles.filter(v => v.ownership_type === 'own').map((vehicle, index) => (
                    <option key={vehicle._id || vehicle.id || `vehicle-${vehicle.vehicle_no}-${index}`} value={vehicle.vehicle_no}>{vehicle.vehicle_no}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fuel Wallet *</label>
                <select
                  value={selectedWallet}
                  onChange={(e) => setSelectedWallet(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Fuel Wallet</option>
                  {fuelWallets.map((wallet, index) => (
                    <option key={wallet.id || wallet.name || `wallet-${index}`} value={wallet.name}>
                      {wallet.name} - {formatCurrency(wallet.balance)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Supplier (Market Vehicles)</label>
                <select
                  value={selectedSupplier}
                  onChange={(e) => {
                    setSelectedSupplier(e.target.value);
                    if (e.target.value) { setSelectedVehicle(''); setSelectedMemo(''); }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Supplier (Optional)</option>
                  {suppliers.map((supplier, index) => (
                    <option key={supplier._id || supplier.id || `supplier-${index}`} value={supplier.name}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Memo No (Optional)</label>
                <select
                  value={selectedMemo}
                  onChange={(e) => {
                    setSelectedMemo(e.target.value);
                    if (e.target.value) { setSelectedVehicle(''); setSelectedSupplier(''); }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Memo (Optional)</option>
                  {memos
                    .filter(m => m.status !== 'paid')
                    .sort((a, b) => (b.memo_number || '').localeCompare(a.memo_number || ''))
                    .map((memo, index) => (
                      <option key={memo.id || (memo as any)._id || `memo-${index}`} value={memo.id || (memo as any)._id}>
                        {memo.memo_number} — {memo.supplier}
                      </option>
                    ))}
                </select>
                {selectedMemo && (() => {
                  const m = memos.find(x => (x.id || (x as any)._id) === selectedMemo);
                  return m ? (
                    <p className="text-xs text-gray-500 mt-1">
                      Supplier: <span className="font-medium">{m.supplier}</span> | Net: <span className="font-medium">{formatCurrency(m.net_amount || 0)}</span>
                    </p>
                  ) : null;
                })()}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
                <input
                  type="number"
                  value={allocationForm.amount}
                  onChange={(e) => setAllocationForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter amount"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={allocationForm.date}
                  onChange={(e) => setAllocationForm(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fuel Quantity (Liters)</label>
                <input
                  type="number"
                  value={allocationForm.fuelQuantity}
                  onChange={(e) => setAllocationForm(prev => ({ ...prev, fuelQuantity: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rate per Liter</label>
                <input
                  type="number"
                  value={allocationForm.ratePerLiter}
                  onChange={(e) => setAllocationForm(prev => ({ ...prev, ratePerLiter: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Odometer Reading</label>
                <input
                  type="number"
                  value={allocationForm.odometerReading}
                  onChange={(e) => setAllocationForm(prev => ({ ...prev, odometerReading: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Narration</label>
                <input
                  type="text"
                  value={allocationForm.narration}
                  onChange={(e) => setAllocationForm(prev => ({ ...prev, narration: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional notes"
                />
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={handleFuelAllocation}
                disabled={(!selectedVehicle && !selectedSupplier && !selectedMemo) || !selectedWallet || !allocationForm.amount}
                data-fuel-submit
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Fuel className="w-4 h-4" />
                <span>Allocate Fuel</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fuel Wallets Tab */}
      {activeTab === 'wallets' && (
        <div className="space-y-6">
          {/* Add Credit to Wallet */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Add Credit to Fuel Wallet</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fuel Wallet</label>
                <select
                  value={walletCreditForm.walletName}
                  onChange={(e) => setWalletCreditForm(prev => ({ ...prev, walletName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {fuelWallets.map((wallet) => (
                    <option key={wallet.id || `wallet-${wallet.name}`} value={wallet.name}>{wallet.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
                <input
                  type="number"
                  value={walletCreditForm.amount}
                  onChange={(e) => setWalletCreditForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter amount"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={walletCreditForm.date}
                  onChange={(e) => setWalletCreditForm(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Narration</label>
                <input
                  type="text"
                  value={walletCreditForm.narration}
                  onChange={(e) => setWalletCreditForm(prev => ({ ...prev, narration: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Payment reference or notes"
                />
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={handleWalletCredit}
                disabled={!walletCreditForm.amount || !walletCreditForm.walletName}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Credit</span>
              </button>
            </div>
          </div>

          {/* Wallet Details */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Wallet Details</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Wallet Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Current Balance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Updated
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {fuelWallets.map((wallet) => (
                    <tr key={wallet.id || `wallet-row-${wallet.name}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {wallet.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`font-semibold ${wallet.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(wallet.balance)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(wallet.updated_at).toLocaleDateString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Vehicle Reports Tab */}
      {activeTab === 'vehicles' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Vehicle Fuel Summary</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vehicle No
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Expense
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Quantity (L)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fuel Entries
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Fuel Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {fuelSummary.map((summary, index) => {
                    // Safe rendering with fallbacks
                    const vehicleNo = summary?.vehicleNo || `Vehicle-${index}`;
                    const totalExpense = typeof summary?.totalExpense === 'number' ? summary.totalExpense : 0;
                    const totalQuantity = typeof summary?.totalQuantity === 'number' ? summary.totalQuantity : 0;
                    const expenseCount = typeof summary?.expenseCount === 'number' ? summary.expenseCount : 0;

                    return (
                      <tr key={`${vehicleNo}-${index}`} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          <div className="flex items-center space-x-2">
                            <Truck className="w-4 h-4 text-gray-400" />
                            <span>{vehicleNo}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                          {formatCurrency(totalExpense)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {totalQuantity.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {expenseCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {summary?.lastFuelDate ? (() => {
                            try {
                              return new Date(summary.lastFuelDate).toLocaleDateString('en-IN');
                            } catch {
                              return 'Invalid date';
                            }
                          })() : 'No fuel records'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Vehicle Tab */}
      {activeTab === 'add-vehicle' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Register New Vehicle</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle Number *</label>
              <input
                type="text"
                value={newVehicleForm.vehicleNo}
                onChange={(e) => setNewVehicleForm(prev => ({ ...prev, vehicleNo: e.target.value.toUpperCase() }))}
                placeholder="e.g., GJ01AB1234"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle Type</label>
              <select
                value={newVehicleForm.vehicleType}
                onChange={(e) => setNewVehicleForm(prev => ({ ...prev, vehicleType: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option key="truck" value="Truck">Truck</option>
                <option key="trailer" value="Trailer">Trailer</option>
                <option key="container" value="Container">Container</option>
                <option key="tanker" value="Tanker">Tanker</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Owner Name</label>
              <input
                type="text"
                value={newVehicleForm.ownerName}
                onChange={(e) => setNewVehicleForm(prev => ({ ...prev, ownerName: e.target.value }))}
                placeholder="Vehicle owner name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Driver Name</label>
              <input
                type="text"
                value={newVehicleForm.driverName}
                onChange={(e) => setNewVehicleForm(prev => ({ ...prev, driverName: e.target.value }))}
                placeholder="Driver name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Driver Phone</label>
              <input
                type="tel"
                value={newVehicleForm.driverPhone}
                onChange={(e) => setNewVehicleForm(prev => ({ ...prev, driverPhone: e.target.value }))}
                placeholder="Driver phone number"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={handleAddVehicle}
              disabled={!newVehicleForm.vehicleNo}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-4 h-4 inline-block mr-2" />
              Register Vehicle
            </button>
          </div>
        </div>
      )}

      {/* Fuel Allocation Ledger Tab */}
      {activeTab === 'ledger' && (
        <FuelAllocationLedger />
      )}
    </div>
  );
};

export default FuelManagement;
