import React, { useState, useMemo, useEffect } from 'react';
import { TrendingUp, TrendingDown, Download, Truck, FileText } from 'lucide-react';
import { formatCurrency } from '../utils/numberGenerator';
import { useDataStore } from '../lib/store';
import { apiService } from '../lib/api';

const VehicleLedger: React.FC = () => {
  const { ledgerEntries, vehicles, setLedgerEntries, memos, loadingSlips } = useDataStore();
  
  // Force refresh ledger data on component mount and periodically
  useEffect(() => {
    const refreshLedgerData = async () => {
      try {
        const data = await apiService.getLedgerEntries({ limit: 10000 });
        if (data && data.ledgerEntries) {
          setLedgerEntries(data.ledgerEntries);
          console.log('💰 Ledger data refreshed:', data.ledgerEntries.length, 'entries');
          
          // Debug vehicle entries for GJ27TG9764
          const gj27tg9764Entries = data.ledgerEntries.filter((e: any) => e.vehicle_no === 'GJ27TG9764');
          console.log('🎯 GJ27TG9764 ALL ENTRIES:', gj27tg9764Entries.length);
          console.log('🎯 GJ27TG9764 INCOME ENTRIES:', gj27tg9764Entries.filter((e: any) => e.ledger_type === 'vehicle_income').length);
          console.log('🎯 GJ27TG9764 EXPENSE ENTRIES:', gj27tg9764Entries.filter((e: any) => e.ledger_type === 'vehicle_expense').length);
          
          // Debug vehicle entries for DD01Y9406
          const dd01y9406Entries = data.ledgerEntries.filter((e: any) => e.vehicle_no === 'DD01Y9406');
          console.log('🚛 DD01Y9406 ALL ENTRIES:', dd01y9406Entries.length);
          console.log('🚛 DD01Y9406 INCOME ENTRIES:', dd01y9406Entries.filter((e: any) => e.ledger_type === 'vehicle_income').length);
          console.log('🚛 DD01Y9406 EXPENSE ENTRIES:', dd01y9406Entries.filter((e: any) => e.ledger_type === 'vehicle_expense').length);
          console.log('🚛 DD01Y9406 MEMO ENTRIES:', dd01y9406Entries.filter((e: any) => e.source_type === 'memo').length);
          
          if (dd01y9406Entries.length > 0) {
            console.log('🚛 DD01Y9406 SAMPLE MEMO ENTRIES:', dd01y9406Entries.filter(e => e.source_type === 'memo').slice(0, 5).map(e => ({
              type: e.ledger_type,
              credit: e.credit,
              debit: e.debit,
              memo: e.description?.split(' ')[1],
              date: e.date
            })));
          }
        }
      } catch (error) {
        console.error('Failed to refresh ledger data:', error);
        // Fallback: try to get data from store
        console.log('Using existing ledger data from store:', ledgerEntries.length, 'entries');
      }
    };
    
    // Initial refresh
    refreshLedgerData();
    
    // Auto-refresh every 10 seconds (less frequent to reduce errors)
    const interval = setInterval(refreshLedgerData, 10000);
    
    return () => clearInterval(interval);
  }, [setLedgerEntries, ledgerEntries.length]);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Filter own vehicles only
  const ownVehicles = vehicles.filter(v => v.ownership_type === 'own');
  
  // Set default vehicle to GJ27TG9764 if available (vehicle with test expenses)
  useEffect(() => {
    if (!selectedVehicle && ownVehicles.length > 0) {
      const targetVehicle = ownVehicles.find(v => v.vehicle_no === 'GJ27TG9764') || ownVehicles[0];
      if (targetVehicle) {
        setSelectedVehicle(targetVehicle.vehicle_no);
        console.log('🎯 Auto-selected vehicle for testing:', targetVehicle.vehicle_no);
      }
    }
  }, [ownVehicles, selectedVehicle]);

  const filteredData = useMemo(() => {
    if (!selectedVehicle) return [];

    // Get vehicle expense entries and vehicle-specific entries
    const vehicleLedgerEntries = ledgerEntries.filter(entry => {
      // Check if it's a vehicle expense entry for this vehicle
      const isVehicleExpense = entry.ledger_type === 'vehicle_expense' && 
                               (entry.vehicle_no === selectedVehicle || entry.vehicleNo === selectedVehicle);
      
      // Check if it's a vehicle income entry for this vehicle
      const isVehicleIncome = entry.ledger_type === 'vehicle_income' && 
                             (entry.vehicle_no === selectedVehicle || entry.vehicleNo === selectedVehicle);
      
      // Check if it's any entry with this vehicle number
      const hasVehicleNumber = entry.vehicle_no === selectedVehicle || entry.vehicleNo === selectedVehicle;
      
      // Date filter
      const dateMatch = (!dateFrom || entry.date >= dateFrom) && (!dateTo || entry.date <= dateTo);
      
      return (isVehicleExpense || isVehicleIncome || hasVehicleNumber) && dateMatch;
    });
    
    console.log('🚛 Vehicle Ledger Debug:', {
      selectedVehicle,
      totalLedgerEntries: ledgerEntries.length,
      vehicleLedgerEntries: vehicleLedgerEntries.length,
      vehicleIncomeEntries: vehicleLedgerEntries.filter(e => e.ledger_type === 'vehicle_income').length,
      vehicleExpenseEntries: vehicleLedgerEntries.filter(e => e.ledger_type === 'vehicle_expense').length,
      fuelExpenseEntries: vehicleLedgerEntries.filter(e => e.source_type === 'fuel').length,
      bankingExpenseEntries: vehicleLedgerEntries.filter(e => e.source_type === 'banking').length,
      cashbookExpenseEntries: vehicleLedgerEntries.filter(e => e.source_type === 'cashbook').length,
      allVehicleExpenses: vehicleLedgerEntries.filter(e => e.ledger_type === 'vehicle_expense').map(e => ({
        source: e.source_type,
        type: e.ledger_type,
        credit: e.credit,
        debit: e.debit,
        date: e.date,
        desc: e.description?.substring(0, 50)
      })),
      
      // Check DD01Y9406 memo entries specifically
      dd01y9406MemoEntries: ledgerEntries.filter(e => 
        (e.vehicle_no === 'DD01Y9406' || e.vehicleNo === 'DD01Y9406') && e.source_type === 'memo'
      ).length,
      filteredEntries: vehicleLedgerEntries.map(e => ({
        type: e.ledger_type,
        source: e.source_type,
        vehicle: e.vehicle_no || e.vehicleNo,
        credit: e.credit,
        debit: e.debit,
        ref: e.reference_id,
        date: e.date,
        desc: e.description
      }))
    });

    // Map ledger entries to display format with running balance calculation
    let runningBalance = 0;
    const displayData = vehicleLedgerEntries
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((entry) => {
        runningBalance += (entry.credit || 0) - (entry.debit || 0);
        
        // Enhanced description with memo number and trip details
        let enhancedDescription = entry.description || '';
        
        // Extract memo number from description if it's a memo entry
        if (entry.source_type === 'memo' && entry.description) {
          const memoMatch = entry.description.match(/Memo (MO-\d+)/);
          if (memoMatch) {
            const memoNumber = memoMatch[1];
            // Find the memo to get loading slip details
            const memo = memos.find((m: any) => m.memo_number === memoNumber);
            if (memo && memo.loading_slip_id && typeof memo.loading_slip_id === 'object') {
              const ls = memo.loading_slip_id as any;
              enhancedDescription = `${memoNumber} - ${ls.from_location} to ${ls.to_location}`;
            } else if (memo) {
              // Try to find loading slip by memo number
              const loadingSlip = loadingSlips.find((ls: any) => ls.memo_number === memoNumber);
              if (loadingSlip) {
                enhancedDescription = `${memoNumber} - ${loadingSlip.from_location} to ${loadingSlip.to_location}`;
              } else {
                enhancedDescription = `${memoNumber} - Vehicle Income`;
              }
            }
          }
        }
        
        return {
          ...entry,
          balance: runningBalance,
          type: entry.ledger_type || entry.type || 'unknown',
          enhancedDescription
        };
      });

    return displayData;
  }, [selectedVehicle, dateFrom, dateTo, ledgerEntries]);

  const calculateVehicleSummary = (vehicleNo: string) => {
    const vehicleLedgerEntries = ledgerEntries.filter(entry => {
      // Include vehicle expense entries
      const isVehicleExpense = entry.ledger_type === 'vehicle_expense' && 
                               (entry.vehicle_no === vehicleNo || entry.vehicleNo === vehicleNo);
      
      // Include vehicle income entries
      const isVehicleIncome = entry.ledger_type === 'vehicle_income' && 
                             (entry.vehicle_no === vehicleNo || entry.vehicleNo === vehicleNo);
      
      // Include any entry with this vehicle number
      const hasVehicleNumber = entry.vehicle_no === vehicleNo || entry.vehicleNo === vehicleNo;
      
      // Date filter
      const dateMatch = (!dateFrom || entry.date >= dateFrom) && (!dateTo || entry.date <= dateTo);
      
      return (isVehicleExpense || isVehicleIncome || hasVehicleNumber) && dateMatch;
    });


    // Total income from all credit entries (freight, detention, extra charges)
    const totalIncome = vehicleLedgerEntries
      .filter(entry => entry.credit > 0)
      .reduce((sum, entry) => sum + entry.credit, 0);
    
    // Breakdown for display - use ledger_type instead of description keywords
    const commission = 0; // Commission is deducted, not shown as separate income
    const mamul = 0; // Mamool is deducted, not shown as separate income

    // Detention charges (should be added to profit)
    const detention = vehicleLedgerEntries
      .filter(entry => entry.ledger_type === 'detention' ||
                      entry.description?.toLowerCase().includes('detention'))
      .reduce((sum, entry) => sum + (entry.credit || 0), 0);

    // Extra charges (toll, RTO fine, POD charges - should be added to profit)
    const extraCharges = vehicleLedgerEntries
      .filter(entry => entry.ledger_type === 'toll' || 
                      entry.ledger_type === 'rto_fine' ||
                      entry.ledger_type === 'pod_charges' ||
                      entry.description?.toLowerCase().includes('extra'))
      .reduce((sum, entry) => sum + (entry.credit || 0), 0);

    // Commission and Mamul are shown separately but NOT double-counted in total expenses
    // They are already deducted from the running balance concept
    const commissionExpense = commission;
    const mamulExpense = mamul;
    
    // Vehicle expenses from ledger entries (includes fuel, banking expenses, etc.)
    const vehicleExpenses = vehicleLedgerEntries
      .filter(entry => entry.debit > 0)
      .reduce((sum, entry) => sum + entry.debit, 0);

    // Fuel expenses (subset of vehicle expenses for display)
    const fuelExpensesFromLedger = vehicleLedgerEntries
      .filter(entry => entry.debit > 0 && 
                      (entry.description?.toLowerCase().includes('fuel') || 
                       entry.reference_name?.toLowerCase().includes('fuel')))
      .reduce((sum, entry) => sum + entry.debit, 0);

    // Other vehicle expenses (non-fuel)
    const otherVehicleExpenses = vehicleExpenses - fuelExpensesFromLedger;

    // Total expenses from vehicle ledger only (for own vehicles)
    const totalExpenses = vehicleExpenses;

    // For breakdown display
    const fuelExpenses = fuelExpensesFromLedger;
    const otherExpenses = otherVehicleExpenses;
    
    // Net profit calculation: Total Income - Total Expenses
    // If expenses > income, this will be negative (loss)
    const netProfit = totalIncome - totalExpenses;

    return {
      totalIncome,
      fuelExpenses,
      otherExpenses,
      totalExpenses,
      netProfit,
      commissionExpense,
      mamulExpense,
      detention,
      extraCharges
    };
  };

  const summary = useMemo(() => {
    const vehicleSummary = calculateVehicleSummary(selectedVehicle);

    return {
      totalIncome: vehicleSummary.totalIncome,
      fuelExpenses: vehicleSummary.fuelExpenses,
      otherExpenses: vehicleSummary.otherExpenses,
      totalExpenses: vehicleSummary.totalExpenses,
      netProfit: vehicleSummary.netProfit
    };
  }, [selectedVehicle, dateFrom, dateTo, ledgerEntries]);

  const exportToCSV = () => {
    if (!selectedVehicle || filteredData.length === 0) return;

    const headers = ['Date', 'Description', 'Type', 'Income', 'Expense', 'Balance'];
    let runningBalance = 0;
    
    const csvData = filteredData.map(entry => {
      runningBalance += (entry.credit || 0) - (entry.debit || 0);
      return [
        entry.date,
        entry.description,
        entry.type,
        entry.credit > 0 ? formatCurrency(entry.credit) : '',
        entry.debit > 0 ? formatCurrency(entry.debit) : '',
        formatCurrency(runningBalance)
      ];
    });

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vehicle-ledger-${selectedVehicle}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Vehicle Ledger</h1>
        <div className="flex items-center space-x-2">
          <button
            onClick={exportToCSV}
            disabled={!selectedVehicle || filteredData.length === 0}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Vehicle (Own Vehicles Only)
            </label>
            <select
              value={selectedVehicle}
              onChange={(e) => setSelectedVehicle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Vehicle</option>
              {ownVehicles.map((vehicle, index) => (
                <option key={vehicle.id || `vehicle-${index}`} value={vehicle.vehicle_no}>
                  {vehicle.vehicle_no} ({vehicle.vehicle_type})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {selectedVehicle && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Income</p>
                  <p className="text-2xl font-bold text-green-600 mt-2">
                    {formatCurrency(summary.totalIncome)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-600 mt-2">
                    {formatCurrency(summary.totalExpenses)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <TrendingDown className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Net Profit/Loss</p>
                  <p className={`text-2xl font-bold mt-2 ${summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(summary.netProfit)}
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${summary.netProfit >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                  {summary.netProfit >= 0 ? 
                    <TrendingUp className="w-6 h-6 text-green-600" /> : 
                    <TrendingDown className="w-6 h-6 text-red-600" />
                  }
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <button
                    onClick={exportToCSV}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Expense Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Fuel Expenses</p>
                  <p className="text-2xl font-bold text-orange-600 mt-2">
                    {formatCurrency(summary.fuelExpenses)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Truck className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Other Expenses</p>
                  <p className="text-2xl font-bold text-red-600 mt-2">
                    {formatCurrency(summary.otherExpenses)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <TrendingDown className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Ledger Entries Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Ledger Entries for {selectedVehicle}
              </h3>
            </div>
            <div className="overflow-x-auto">
              {filteredData.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">No entries found for the selected criteria</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reference ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Route
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Debit
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Credit
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Balance
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredData.map((entry, index) => (
                      <tr key={entry.id || index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{new Date(entry.date).toLocaleDateString('en-GB')}</td>
                        <td className="px-4 py-3 text-sm text-blue-600 font-medium">{entry.memoNumber || entry.memo_number || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {entry.enhancedDescription || entry.description || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {'-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {entry.debit > 0 ? (
                            <span className="text-red-600 font-medium">{formatCurrency(entry.debit)}</span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {entry.credit > 0 ? (
                            <span className="text-green-600 font-medium">{formatCurrency(entry.credit)}</span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium">
                          <span className={entry.balance >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(Math.abs(entry.balance))}
                            {entry.balance < 0 ? ' Dr' : ' Cr'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default VehicleLedger;
