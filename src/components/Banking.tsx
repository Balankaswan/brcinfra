import React, { useState, useMemo } from 'react';
import { Plus, Edit, CreditCard, Search, Filter, Download, TrendingUp, TrendingDown, Calendar, Trash } from 'lucide-react';
import { useDataStore } from '../lib/store';
import { apiService } from '../lib/api';
import { formatCurrency } from '../utils/numberGenerator';
import BankingForm from './forms/BankingForm';
import type { BankingEntry } from '../types';

type DateFilter = 'all' | 'today' | 'week' | 'month' | 'specific' | 'custom';

const BankingComponent: React.FC = () => {
  const { bankingEntries: entries, addBankingEntry, updateBankingEntry, deleteBankingEntry } = useDataStore();
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BankingEntry | null>(null);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [specificDate, setSpecificDate] = useState('');
  const [viewMode, setViewMode] = useState<'statement' | 'list'>('statement');


  const handleCreateEntry = async (entryData: Omit<BankingEntry, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      console.log('🚀 Creating banking entry:', entryData);
      const response = await apiService.createBankingEntry(entryData);
      console.log('✅ Banking entry created in backend:', response.bankingEntry);
      
      // Set timestamp to prevent sync override
      localStorage.setItem('lastBankingCreation', Date.now().toString());
      
      // Add the entry directly to store to show immediately
      const backendEntry = {
        ...response.bankingEntry,
        id: response.bankingEntry._id || response.bankingEntry.id
      };
      addBankingEntry(backendEntry);
      
      // DO NOT trigger sync event to prevent duplicates
      console.log('✅ Banking entry added to store, skipping sync to prevent duplicates');
    } catch (error) {
      console.error('❌ Failed to create banking entry:', error);
      // Only add manually if API call failed
      const newEntry: BankingEntry = {
        ...entryData,
        id: Date.now().toString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      addBankingEntry(newEntry);
    }
    setShowForm(false);
  };

  const handleUpdateEntry = async (entryData: Omit<BankingEntry, 'id' | 'created_at'>) => {
    if (!editingEntry || !editingEntry.id) {
      console.error('No editing entry or ID provided for update');
      return;
    }
    
    try {
      const response = await apiService.updateBankingEntry(editingEntry.id, entryData);
      const backendEntry = {
        ...response.bankingEntry,
        id: response.bankingEntry._id || response.bankingEntry.id
      };
      updateBankingEntry(editingEntry.id, backendEntry);
      console.log('Banking entry updated and synced:', backendEntry);
      
      // Trigger data sync to refresh all components
      window.dispatchEvent(new CustomEvent('data-sync-required'));
    } catch (error) {
      console.error('Failed to update banking entry:', error);
      const updatedEntry: BankingEntry = {
        ...entryData,
        id: editingEntry.id,
        created_at: editingEntry.created_at,
        updated_at: new Date().toISOString(),
      };
      updateBankingEntry(editingEntry.id, updatedEntry);
    }
    setEditingEntry(null);
    setShowForm(false);
  };

  const handleEditEntry = (entry: BankingEntry) => {
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setEditingEntry(null);
    setShowForm(false);
  };

  const handleDeleteEntry = async (id: string) => {
    if (!id) {
      console.error('No ID provided for deletion');
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this entry?')) {
      try {
        console.log('Attempting to delete banking entry with ID:', id);
        
        // First update local state optimistically
        deleteBankingEntry(id);
        console.log('Banking entry deleted locally');
        
        // Then try to delete from backend
        await apiService.deleteBankingEntry(id);
        console.log('Banking entry deleted from backend');
        
        window.dispatchEvent(new CustomEvent('data-sync-required'));
      } catch (error) {
        console.error('Failed to delete banking entry from backend:', error);
        // Refresh data to restore state if backend deletion failed
        window.dispatchEvent(new CustomEvent('data-sync-required'));
      }
    }
  };

  const filteredEntries = useMemo(() => {
    let filtered = [...entries];

    // Apply date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      filtered = filtered.filter(entry => {
        const entryDate = new Date(entry.date);
        const entryDateOnly = new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate());
        
        switch (dateFilter) {
          case 'today':
            return entryDateOnly.getTime() === today.getTime();
          case 'week':
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return entryDateOnly >= weekAgo;
          case 'month':
            return entryDate.getMonth() === now.getMonth() && entryDate.getFullYear() === now.getFullYear();
          case 'specific':
            if (!specificDate) return true;
            const selectedDate = new Date(specificDate);
            const selectedDateOnly = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
            return entryDateOnly.getTime() === selectedDateOnly.getTime();
          case 'custom':
            if (!customDateRange.start || !customDateRange.end) return true;
            const startDate = new Date(customDateRange.start);
            const endDate = new Date(customDateRange.end);
            return entryDateOnly >= startDate && entryDateOnly <= endDate;
          default:
            return true;
        }
      });
    }

    // Apply search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter((entry) => {
        const dateStr = new Date(entry.date).toLocaleDateString('en-IN');
        const amountStr = String(entry.amount);
        const formattedAmount = formatCurrency(entry.amount);
        const haystack = [
          dateStr,
          entry.type,
          entry.category,
          entry.reference_id || '',
          entry.reference_name || '',
          amountStr,
          formattedAmount,
          entry.narration || '',
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    // Sort banking entries by date (descending - latest first) for better transaction visibility
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [entries, search, dateFilter, customDateRange, specificDate]);

  // Calculate balances for bank entries only (exclude cash)
  const bankEntries = filteredEntries.filter(entry => entry.payment_mode !== 'cash');
  
  const totalCredits = bankEntries
    .filter(entry => entry.type === 'credit')
    .reduce((sum, entry) => sum + entry.amount, 0);

  const totalDebits = bankEntries
    .filter(entry => entry.type === 'debit')
    .reduce((sum, entry) => sum + entry.amount, 0);

  const netBalance = totalCredits - totalDebits;

  const dailyStatements = useMemo(() => {
    
    // Group entries by date
    const groupedByDate = bankEntries.reduce((acc, entry) => {
      const dateKey = new Date(entry.date).toDateString();
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(entry);
      return acc;
    }, {} as Record<string, BankingEntry[]>);

    // Calculate running balances for bank entries only
    let runningBalance = 0;
    const statements = Object.keys(groupedByDate)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime()) // Latest first for display
      .map(dateKey => {
        const dayEntries = groupedByDate[dateKey];
        const openingBalance = runningBalance;
        
        // Sort entries within the day by created_at to maintain chronological order
        const sortedDayEntries = dayEntries.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        
        // Calculate day's transactions
        const dayCredits = sortedDayEntries
          .filter(e => e.type === 'credit')
          .reduce((sum, e) => sum + e.amount, 0);
        const dayDebits = sortedDayEntries
          .filter(e => e.type === 'debit')
          .reduce((sum, e) => sum + e.amount, 0);
        
        const closingBalance = openingBalance + dayCredits - dayDebits;
        runningBalance = closingBalance;
        
        return {
          date: dateKey,
          entries: sortedDayEntries,
          openingBalance,
          closingBalance,
          dayCredits,
          dayDebits
        };
      });

    return statements;
  }, [bankEntries]);

  const exportStatement = () => {
    const csvContent = dailyStatements.map(day => {
      const dayRows = [
        `Date: ${new Date(day.date).toLocaleDateString('en-IN')}`,,,,,,
        `Opening Balance:,${formatCurrency(day.openingBalance)}`,,,,,,
        'Time,Type,Category,Reference,Amount,Narration,Running Balance'
      ];
      
      let runningBalance = day.openingBalance;
      day.entries.forEach(entry => {
        const amount = entry.type === 'credit' ? entry.amount : -entry.amount;
        runningBalance += amount;
        dayRows.push(
          `${new Date(entry.created_at).toLocaleTimeString('en-IN')},${entry.type},${entry.category},${entry.reference_id || entry.reference_name || ''},${formatCurrency(entry.amount)},${entry.narration || ''},${formatCurrency(runningBalance)}`
        );
      });
      
      dayRows.push(`Closing Balance:,${formatCurrency(day.closingBalance)}`);
      dayRows.push(''); // Empty line between days
      
      return dayRows.join('\n');
    }).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bank-statement-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">Banking</h1>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[240px] max-w-xl">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by narration, category, type, amount, reference, date"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          </div>
          
          {/* Date Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="specific">Specific Day</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          
          {/* Specific Date */}
          {dateFilter === 'specific' && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={specificDate}
                onChange={(e) => setSpecificDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="Select specific date"
              />
            </div>
          )}
          
          {/* Custom Date Range */}
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customDateRange.start}
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={customDateRange.end}
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          )}
          
          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('statement')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'statement'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Statement
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              List
            </button>
          </div>
          
          {/* Export Button */}
          <button
            onClick={exportStatement}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
          
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>New Entry</span>
          </button>
        </div>
      </div>

      {showForm && (
        <BankingForm
          onSubmit={editingEntry ? handleUpdateEntry : handleCreateEntry}
          onCancel={handleCancelEdit}
          editingEntry={editingEntry}
        />
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Credits</p>
              <p className="text-2xl font-bold text-green-600 mt-2">{formatCurrency(totalCredits)}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Debits</p>
              <p className="text-2xl font-bold text-red-600 mt-2">{formatCurrency(totalDebits)}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Net Balance</p>
              <p className={`text-2xl font-bold mt-2 ${netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(netBalance)}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Banking Entries */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {viewMode === 'statement' ? 'Bank Statement' : 'Banking Entries'}
          </h3>
        </div>
        <div className="overflow-x-auto">
          {entries.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <CreditCard className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No banking entries found</p>
              <p className="text-sm">Add your first banking entry to get started</p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <CreditCard className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No entries match your search</p>
              <p className="text-sm">Try adjusting your search terms</p>
            </div>
          ) : viewMode === 'statement' ? (
            <div className="space-y-6 p-6">
              {dailyStatements.map((dayStatement) => (
                <div key={dayStatement.date} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Day Header */}
                  <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Calendar className="w-5 h-5 text-gray-400" />
                        <h4 className="text-lg font-semibold text-gray-900">
                          {new Date(dayStatement.date).toLocaleDateString('en-IN', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </h4>
                      </div>
                      <div className="text-sm text-gray-600">
                        {dayStatement.entries.length} transaction{dayStatement.entries.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  
                  {/* Opening Balance */}
                  <div className="px-6 py-3 bg-blue-50 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-blue-900">Opening Balance</span>
                      <span className={`text-sm font-semibold ${
                        dayStatement.openingBalance >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(dayStatement.openingBalance)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Transactions */}
                  <div className="divide-y divide-gray-200">
                    {dayStatement.entries.map((entry, entryIndex) => {
                      let runningBalance = dayStatement.openingBalance;
                      // Calculate running balance up to this entry
                      for (let i = 0; i <= entryIndex; i++) {
                        const e = dayStatement.entries[i];
                        runningBalance += e.type === 'credit' ? e.amount : -e.amount;
                      }
                      
                      return (
                        <div key={`${entry._id || entry.id}-${entryIndex}`} className="px-6 py-4 hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-3">
                                <span className="text-xs text-gray-500">
                                  {new Date(entry.created_at).toLocaleTimeString('en-IN')}
                                </span>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  entry.type === 'credit' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {entry.type === 'credit' ? 'Credit' : 'Debit'}
                                </span>
                                <span className="text-sm text-gray-900 capitalize">
                                  {entry.category.replace('_', ' ')}
                                </span>
                              </div>
                              <div className="mt-1 flex items-center space-x-2">
                                {entry.reference_id && (
                                  <span className="text-sm font-medium text-gray-900">{entry.reference_id}</span>
                                )}
                                {entry.reference_name && (
                                  <span className="text-sm text-gray-500">{entry.reference_name}</span>
                                )}
                                {entry.narration && (
                                  <span className="text-sm text-gray-600">• {entry.narration}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-4">
                              <span className={`text-sm font-semibold ${
                                entry.type === 'credit' ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {entry.type === 'credit' ? '+' : '-'}{formatCurrency(entry.amount)}
                              </span>
                              <span className={`text-sm font-medium ${
                                runningBalance >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {formatCurrency(runningBalance)}
                              </span>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleEditEntry({...entry, id: entry._id || entry.id})}
                                  className="inline-flex items-center px-2 py-1 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded"
                                  title="Edit entry"
                                >
                                  <Edit className="w-3 h-3 mr-1" /> Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteEntry(entry._id || entry.id)}
                                  className="inline-flex items-center px-2 py-1 text-xs text-white bg-red-600 hover:bg-red-700 rounded"
                                  title="Delete entry"
                                >
                                  <Trash className="w-3 h-3 mr-1" /> Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Closing Balance */}
                  <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <span className="text-sm font-medium text-gray-900">Closing Balance</span>
                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                          <span>Credits: {formatCurrency(dayStatement.dayCredits)}</span>
                          <span>•</span>
                          <span>Debits: {formatCurrency(dayStatement.dayDebits)}</span>
                        </div>
                      </div>
                      <span className={`text-sm font-semibold ${
                        dayStatement.closingBalance >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(dayStatement.closingBalance)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reference
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Narration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEntries.map((entry) => (
                  <tr key={entry._id || entry.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span>{new Date(entry.date).toLocaleDateString('en-IN')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        entry.type === 'credit' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {entry.type === 'credit' ? 'Credit' : 'Debit'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                      {entry.category.replace('_', ' ')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        {entry.reference_id && (
                          <div className="font-medium">{entry.reference_id}</div>
                        )}
                        <div className="text-gray-500">{entry.reference_name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <span className={entry.type === 'credit' ? 'text-green-600' : 'text-red-600'}>
                        {entry.type === 'credit' ? '+' : '-'}{formatCurrency(entry.amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {entry.narration}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEditEntry({...entry, id: entry._id || entry.id})}
                          className="inline-flex items-center px-2 py-1 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded"
                          title="Edit entry"
                        >
                          <Edit className="w-3 h-3 mr-1" /> Edit
                        </button>
                        <button
                          onClick={() => handleDeleteEntry(entry._id || entry.id)}
                          className="inline-flex items-center px-2 py-1 text-xs text-white bg-red-600 hover:bg-red-700 rounded"
                          title="Delete entry"
                        >
                          <Trash className="w-3 h-3 mr-1" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default BankingComponent;