import React, { useState, useMemo } from 'react';
import { Plus, Search, AlertCircle, FileText, CreditCard, Truck } from 'lucide-react';
import { useDataStore } from '../lib/store';
import type { Supplier } from '../types';
import { formatCurrency } from '../utils/numberGenerator';
import { getAllSupplierBalances } from '../utils/ledgerUtils';
import SupplierLedger from './SupplierLedger';

interface SupplierMasterProps {
  onAddSupplier?: () => void;
}

const SupplierMaster: React.FC<SupplierMasterProps> = ({ onAddSupplier }) => {
  const { memos, bankingEntries, loadingSlips, vehicles, suppliers: masterSuppliers } = useDataStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const [showLedger, setShowLedger] = useState(false);

  // Get all supplier balances (excluding own vehicles, combining master suppliers and memos)
  const supplierBalances = useMemo(() => {
    return getAllSupplierBalances(memos, bankingEntries, loadingSlips, vehicles, masterSuppliers);
  }, [memos, bankingEntries, loadingSlips, vehicles, masterSuppliers]);

  // Filter suppliers based on search term
  const filteredSuppliers = useMemo(() => {
    if (!searchTerm.trim()) return supplierBalances;
    const term = searchTerm.toLowerCase().trim();
    return supplierBalances.filter((supplier) => 
      supplier.supplierName.toLowerCase().includes(term)
    );
  }, [supplierBalances, searchTerm]);

  // Calculate summary statistics
  const totalOutstanding = useMemo(() => {
    return filteredSuppliers.reduce((acc, supplier) => {
      return acc + Math.max(0, supplier.outstandingAmount);
    }, 0);
  }, [filteredSuppliers]);

  const handleViewLedger = (supplierName: string) => {
    setSelectedSupplier(supplierName);
    setShowLedger(true);
  };

  if (showLedger && selectedSupplier) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => { setShowLedger(false); setSelectedSupplier(null); }}
          className="flex items-center space-x-2 text-orange-600 hover:text-orange-800 font-medium px-4 py-2 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
        >
          <span>← Back to Supplier Master</span>
        </button>
        <SupplierLedger selectedSupplier={selectedSupplier} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Truck className="w-8 h-8 text-orange-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Supplier Master</h1>
            <p className="text-gray-600">Manage transporters and track outstanding balances</p>
          </div>
        </div>
        {onAddSupplier && (
          <button
            onClick={onAddSupplier}
            className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            <Plus className="w-4 h-4" />
            <span>Add Supplier</span>
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
          <div className="text-sm text-orange-600 font-medium">Total Suppliers</div>
          <div className="text-2xl font-bold text-orange-900">{filteredSuppliers.length}</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <div className="text-sm text-red-600 font-medium">Total Outstanding</div>
          <div className="text-2xl font-bold text-red-900">{formatCurrency(totalOutstanding)}</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search suppliers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Supplier List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Supplier List ({filteredSuppliers.length})
          </h3>
        </div>
        
        {filteredSuppliers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier Name</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Freight Memos (₹)</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Detention (₹)</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Extra Weight (₹)</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Payments (₹)</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Outstanding Balance (₹)</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSuppliers.map((supplier: any, index: number) => (
                  <tr key={supplier.supplierName} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{supplier.supplierName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-orange-600 font-medium">
                      {formatCurrency(supplier.totalMemos)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-purple-600 font-medium">
                      {formatCurrency(supplier.totalDetention)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-indigo-600 font-medium">
                      {formatCurrency(supplier.totalExtraWeight)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-medium">
                      {formatCurrency(supplier.totalPayments)}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${
                      supplier.outstandingAmount > 0 ? 'text-red-600' : 
                      supplier.outstandingAmount < 0 ? 'text-green-600' : 'text-gray-600'
                    }`}>
                      {formatCurrency(Math.abs(supplier.outstandingAmount))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {supplier.outstandingAmount > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Pending
                        </span>
                      ) : supplier.outstandingAmount < 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Overpaid
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Cleared
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => handleViewLedger(supplier.supplierName)}
                          className="text-orange-600 hover:text-orange-900"
                          title="View Ledger"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        {supplier.outstandingAmount > 0 && (
                          <button
                            onClick={() => console.log('Bulk payment:', supplier.supplierName)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Bulk Payment"
                          >
                            <CreditCard className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <Truck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {searchTerm ? 'No suppliers found matching your search' : 'No suppliers found'}
            </p>
          </div>
        )}
      </div>

    </div>
  );
};

export default SupplierMaster;
