import React, { useMemo, useState, useEffect } from 'react';
import { Users, Truck, Building, Download, Eye, Receipt } from 'lucide-react';
import { useDataStore } from '../lib/store';
import { getAllPartyBalances, getAllSupplierBalances } from '../utils/ledgerUtils';
import { formatCurrency } from '../utils/numberGenerator';
import { apiService } from '../lib/api';
import PartyLedger from './PartyLedger';
import SupplierLedger from './SupplierLedger';
import GeneralLedger from './GeneralLedger';
import TDSLedger from './TDSLedger';

interface LedgersProps {
  onViewLedger?: (name: string, type: 'party' | 'supplier' | 'general' | 'tds') => void;
  onNavigate?: (page: string, params?: any) => void;
}

const LedgersComponent: React.FC<LedgersProps> = ({ onViewLedger, onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'party' | 'supplier' | 'general' | 'tds'>('party');
  const [selectedLedger, setSelectedLedger] = useState<{ name: string; type: 'party' | 'supplier' | 'general' | 'tds' } | null>(null);
  const { ledgerEntries, bills, memos, bankingEntries, setLedgerEntries } = useDataStore();

  // Force refresh ledger data on component mount to ensure data persistence
  useEffect(() => {
    const refreshLedgerData = async () => {
      try {
        console.log('Refreshing ledger data on Ledgers component mount...');
        const response = await apiService.getLedgerEntries();
        if (response.ledgerEntries) {
          setLedgerEntries(response.ledgerEntries);
          console.log('✅ Ledger data refreshed:', response.ledgerEntries.length, 'entries');
        }
      } catch (error) {
        console.error('❌ Failed to refresh ledger data:', error);
      }
    };

    refreshLedgerData();
  }, [setLedgerEntries]);

  // Get party and supplier balances using the new utility functions
  const partyBalances = useMemo(() => getAllPartyBalances(bills, bankingEntries), [bills, bankingEntries]);
  const supplierBalances = useMemo(() => getAllSupplierBalances(memos, bankingEntries), [memos, bankingEntries]);
  const grouped = useMemo(() => {
    if (activeTab === 'general') {
      const generalEntries = ledgerEntries.filter(entry => entry.ledger_type === 'general');
      const groupedGeneral = generalEntries.reduce((acc, entry) => {
        const name = entry.reference_name || 'Unknown';
        if (!acc[name]) {
          acc[name] = {
            name,
            entries: [],
            totalDebit: 0,
            totalCredit: 0,
            outstandingAmount: 0
          };
        }
        acc[name].entries.push(entry);
        acc[name].totalDebit += entry.debit || 0;
        acc[name].totalCredit += entry.credit || 0;
        acc[name].outstandingAmount = acc[name].totalDebit - acc[name].totalCredit;
        return acc;
      }, {} as Record<string, any>);
      return Object.values(groupedGeneral);
    }

    if (activeTab === 'party') {
      return partyBalances.map(balance => ({
        name: balance.partyName,
        entries: [],
        totalDebit: balance.totalBills,
        totalCredit: balance.totalPayments + balance.totalAdvances,
        outstandingAmount: balance.outstandingAmount
      }));
    }

    if (activeTab === 'supplier') {
      return supplierBalances.map(balance => ({
        name: balance.supplierName,
        entries: [],
        totalDebit: balance.totalMemos + balance.totalDetention + balance.totalExtraWeight,
        totalCredit: balance.totalPayments + balance.totalAdvances - balance.totalCommission - balance.totalMamul,
        outstandingAmount: balance.outstandingAmount
      }));
    }

    if (activeTab === 'tds') {
      return bills
        .filter(bill => (bill.tds || 0) > 0)
        .map(bill => ({
          name: bill.bill_number,
          partyName: bill.party,
          date: bill.date,
          totalDebit: bill.bill_amount,
          totalCredit: (bill.bill_amount || 0) + (bill.detention || 0) + (bill.extra || 0) + (bill.rto || 0) - (bill.tds || 0),
          outstandingAmount: bill.tds || 0
        }));
    }

    return [];
  }, [activeTab, partyBalances, supplierBalances, ledgerEntries, bills]);

  const counts = useMemo(() => {
    const generalEntries = ledgerEntries.filter(entry => entry.ledger_type === 'general');
    const uniqueGeneralNames = new Set(generalEntries.map(entry => entry.reference_name)).size;
    const tdsCount = bills.filter(bill => (bill.tds || 0) > 0).length;
    return {
      party: partyBalances.length,
      supplier: supplierBalances.length,
      general: uniqueGeneralNames,
      tds: tdsCount
    };
  }, [partyBalances, supplierBalances, ledgerEntries, bills]);

  const tabs = [
    { id: 'party', label: 'Party Ledgers', count: counts.party, icon: Users },
    { id: 'supplier', label: 'Supplier Freight Memo Ledgers', count: counts.supplier, icon: Truck },
    { id: 'general', label: 'General Ledgers', count: counts.general, icon: Building },
    { id: 'tds', label: 'TDS Ledger', count: counts.tds, icon: Receipt },
  ];

  // Handle viewing detailed ledger
  const handleViewLedger = (name: string, type: 'party' | 'supplier' | 'general' | 'tds') => {
    setSelectedLedger({ name, type });
    if (onViewLedger) {
      onViewLedger(name, type);
    }
  };

  // If a ledger is selected, show the detailed view
  if (selectedLedger) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedLedger(null)}
          className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
        >
          <span>← Back to Ledger Management</span>
        </button>
        {selectedLedger.type === 'party' ? (
          <PartyLedger selectedParty={selectedLedger.name} onNavigate={onNavigate} />
        ) : selectedLedger.type === 'supplier' ? (
          <SupplierLedger selectedSupplier={selectedLedger.name} onNavigate={onNavigate} />
        ) : selectedLedger.type === 'tds' ? (
          <TDSLedger />
        ) : (
          <GeneralLedger selectedPerson={selectedLedger.name} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Ledger Management</h1>
        <div className="text-sm text-gray-600">
          {activeTab === 'supplier' ? 'Supplier' : activeTab === 'party' ? 'Party' : 'General'} Ledgers: {
            tabs.find(tab => tab.id === activeTab)?.count || 0
          }
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">
                  {tab.count}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Summary Cards */}
      {activeTab === 'supplier' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Supplier Outstanding</p>
                <p className="text-2xl font-bold text-orange-600 mt-2">
                  {formatCurrency(supplierBalances.reduce((sum, balance) => sum + balance.outstandingAmount, 0))}
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
                <p className="text-sm font-medium text-gray-600">Active Supplier Ledgers</p>
                <p className="text-2xl font-bold text-red-600 mt-2">{supplierBalances.length}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl font-bold text-red-600">{supplierBalances.length}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex items-center justify-between">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder={`Search ${activeTab} ledgers...`}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center space-x-4">
          <input
            type="date"
            defaultValue="2025-08-16"
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            defaultValue="2025-08-16"
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Ledgers Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {activeTab === 'party' ? 'Party' : activeTab === 'supplier' ? 'Supplier' : 'Ledger'} Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total {activeTab === 'party' ? 'Bills' : activeTab === 'supplier' ? 'Freight Memos' : 'Entries'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Entries
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Outstanding Balance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {grouped.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    {activeTab === 'general' ? (
                      <>
                        <Building className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>No general ledger entries found</p>
                        <p className="text-sm">Create expense transactions in Banking to generate general ledger entries</p>
                      </>
                    ) : (
                      'No entries'
                    )}
                  </td>
                </tr>
              )}
              {grouped.map((g, index) => (
                <tr key={`${activeTab}-${g.name}-${index}`} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{g.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {activeTab === 'party' ?
                      partyBalances.find(p => p.partyName === g.name)?.totalBills || 0 :
                      activeTab === 'supplier' ?
                        supplierBalances.find(s => s.supplierName === g.name)?.totalMemos || 0 :
                        formatCurrency(g.totalDebit)
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {activeTab === 'party' ? 'Bills' : activeTab === 'supplier' ? 'Freight Memos' : g.entries.length + ' Entries'}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${g.outstandingAmount > 0 ? 'text-red-600' :
                    g.outstandingAmount < 0 ? 'text-green-600' : 'text-gray-600'
                    }`}>
                    {formatCurrency(Math.abs(g.outstandingAmount))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center space-x-2">
                      <button
                        className="text-blue-600 hover:text-blue-800"
                        onClick={() => handleViewLedger(g.name, activeTab as 'party' | 'supplier' | 'general')}
                        title="View Ledger"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="text-green-600 hover:text-green-800">
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LedgersComponent;
