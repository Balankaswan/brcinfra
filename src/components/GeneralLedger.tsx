import React, { useState, useMemo } from 'react';
import { Filter, Download, Table, Building } from 'lucide-react';
import { useDataStore } from '../lib/store';
import { formatCurrency } from '../utils/numberGenerator';

interface GeneralLedgerEntry {
  id: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
  reference: string;
}

interface GeneralLedgerProps {
  selectedPerson?: string;
}

const GeneralLedger: React.FC<GeneralLedgerProps> = ({ selectedPerson }) => {
  const { ledgerEntries } = useDataStore();
  
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [personFilter, setPersonFilter] = useState(selectedPerson || '');

  // Get unique persons from general ledger entries
  const persons = useMemo(() => {
    const generalEntries = ledgerEntries.filter(entry => entry.ledger_type === 'general');
    const personSet = new Set(generalEntries.map(entry => entry.reference_name));
    return Array.from(personSet).sort();
  }, [ledgerEntries]);

  // Generate ledger entries for selected person or all entries
  const personLedgerEntries = useMemo(() => {
    const entries: GeneralLedgerEntry[] = [];
    let runningBalance = 0;

    // Get all general ledger entries (filtered by person if selected)
    const filteredEntries = ledgerEntries
      .filter(entry => {
        if (entry.ledger_type !== 'general') return false;
        if (personFilter && entry.reference_name !== personFilter) return false;
        return true;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Generate ledger entries with running balance
    filteredEntries.forEach((entry: any) => {
      runningBalance += entry.debit - entry.credit;

      entries.push({
        id: entry.id,
        date: entry.date,
        description: entry.description || entry.narration || '',
        debit: entry.debit,
        credit: entry.credit,
        runningBalance,
        reference: entry.reference_id || ''
      });
    });

    return entries;
  }, [personFilter, ledgerEntries]);

  // Filter by date range
  const filteredEntries = useMemo(() => {
    let filtered = personLedgerEntries;

    if (dateFrom) {
      filtered = filtered.filter(entry => entry.date >= dateFrom);
    }

    if (dateTo) {
      filtered = filtered.filter(entry => entry.date <= dateTo);
    }

    return filtered;
  }, [personLedgerEntries, dateFrom, dateTo]);

  // Calculate totals
  const totals = useMemo(() => {
    return filteredEntries.reduce((acc, entry) => ({
      debit: acc.debit + entry.debit,
      credit: acc.credit + entry.credit,
    }), { debit: 0, credit: 0 });
  }, [filteredEntries]);

  const finalBalance = filteredEntries.length > 0 ? filteredEntries[filteredEntries.length - 1].runningBalance : 0;

  const exportToCSV = () => {
    if (!filteredEntries.length) return;

    const headers = ['Date', 'Description', 'Reference', 'Debit (₹)', 'Credit (₹)', 'Running Balance (₹)'];
    const csvContent = [
      headers.join(','),
      ...filteredEntries.map(entry => [
        entry.date,
        `"${entry.description}"`,
        entry.reference,
        entry.debit,
        entry.credit,
        entry.runningBalance,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `general-ledger-${personFilter}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Building className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">General Ledger</h1>
            <p className="text-gray-600">Track expenses and transactions by person/vendor</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900">Filters</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Person/Vendor
            </label>
            <select
              value={personFilter}
              onChange={(e) => setPersonFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Transactions</option>
              {persons.map((person, index) => (
                <option key={`${person}-${index}`} value={person}>{person}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              From Date
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              To Date
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-end space-x-2">
            <button
              onClick={exportToCSV}
              disabled={!filteredEntries.length}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {personFilter && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <div className="text-sm text-red-600 font-medium">Total Expenses</div>
            <div className="text-2xl font-bold text-red-900">{formatCurrency(totals.debit)}</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <div className="text-sm text-green-600 font-medium">Total Credits</div>
            <div className="text-2xl font-bold text-green-900">{formatCurrency(totals.credit)}</div>
          </div>
          <div className={`p-4 rounded-lg border ${finalBalance >= 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <div className={`text-sm font-medium ${finalBalance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
              Net Balance
            </div>
            <div className={`text-2xl font-bold ${finalBalance >= 0 ? 'text-red-900' : 'text-green-900'}`}>
              {formatCurrency(Math.abs(finalBalance))}
            </div>
          </div>
        </div>
      )}

      {/* Ledger Table */}
      {personFilter ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              General Ledger for {personFilter}
            </h3>
          </div>
          
          {filteredEntries.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Debit (₹)</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Credit (₹)</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Running Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredEntries.map((entry, index) => (
                    <tr key={entry.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(entry.date).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {entry.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                        {entry.reference}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 font-medium">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-medium">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : '—'}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${
                        entry.runningBalance >= 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {formatCurrency(Math.abs(entry.runningBalance))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100">
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-sm font-bold text-gray-900">Total</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-red-600">
                      {formatCurrency(totals.debit)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-green-600">
                      {formatCurrency(totals.credit)}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${
                      finalBalance >= 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {formatCurrency(Math.abs(finalBalance))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <Table className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No ledger entries found for the selected criteria</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Building className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Person/Vendor</h3>
          <p className="text-gray-500">Choose a person or vendor from the dropdown to view their general ledger</p>
        </div>
      )}
    </div>
  );
};

export default GeneralLedger;
