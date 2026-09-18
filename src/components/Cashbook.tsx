import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, CreditCard, TrendingUp, TrendingDown, Calendar, Trash, Edit, Search, Filter } from 'lucide-react';
import { formatCurrency } from '../utils/numberGenerator';
import BankingForm from './forms/BankingForm';
import type { CashbookEntry } from '../types';
import { useDataStore } from '../lib/store';
import { apiService } from '../lib/api';

type DateFilter = 'all' | 'today' | 'week' | 'month' | 'specific' | 'custom';

export default function Cashbook() {
  const { 
    cashbookEntries: entries, 
    setCashbookEntries, 
    addCashbookEntry,
    updateCashbookEntry
  } = useDataStore();
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CashbookEntry | null>(null);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [specificDate, setSpecificDate] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Force refresh cashbook data on component mount to ensure data persistence
  useEffect(() => {
    const refreshCashbookData = async () => {
      try {
        console.log('🔄 Refreshing cashbook data on component mount...');
        const response = await apiService.getCashbookEntries({ limit: 100000 });
        if (response.cashbookEntries) {
          setCashbookEntries(response.cashbookEntries);
          console.log('✅ Cashbook data refreshed:', response.cashbookEntries.length, 'entries');
        }
      } catch (error) {
        console.error('❌ Failed to refresh cashbook data:', error);
      }
    };
    
    refreshCashbookData();
  }, [setCashbookEntries]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateEntry = async (entryData: Omit<CashbookEntry, 'id' | 'created_at' | 'running_balance'>) => {
    // Prevent double submission
    if (isSubmitting) {
      console.warn('⚠️ Entry creation already in progress, ignoring duplicate request');
      return;
    }

    try {
      setIsSubmitting(true);
      
      if (editingEntry) {
        // Update existing entry with cash payment mode
        const updatedEntry: CashbookEntry = {
          ...entryData,
          payment_mode: 'cash', // Force cash mode for cashbook entries
          id: editingEntry.id,
          created_at: editingEntry.created_at,
          running_balance: editingEntry.running_balance // Preserve existing balance
        };
        updateCashbookEntry(updatedEntry);
        setEditingEntry(null);
      } else {
        // Create new entry via API
        const entryToCreate = {
          ...entryData,
          payment_mode: 'cash', // Force cash mode for cashbook entries
        };
        
        console.log('💰 Creating cashbook entry:', entryToCreate);
        const response = await apiService.createCashbookEntry(entryToCreate);
        const savedEntry = response.cashbookEntry;
        console.log('✅ Cashbook entry created successfully:', savedEntry.transaction_id);
        
        // Set timestamp to prevent sync override
        localStorage.setItem('lastCashbookCreation', Date.now().toString());
        
        // Add to local store using addCashbookEntry to ensure proper processing
        addCashbookEntry(savedEntry);
        
        console.log('💰 Cashbook entry added to local state via addCashbookEntry');
        
        // All ledger entries (including party commission) are now created automatically by the backend
        // No need to create any ledger entries manually in the frontend
        
        console.log('💰 Cashbook entry added to local state, triggering UI refresh');
        
        // Reset form state immediately after successful creation
        setShowForm(false);
        setEditingEntry(null);
        
        // Trigger data sync for other components (delayed to allow UI update first)
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('data-sync-required'));
        }, 100);
      }
    } catch (error) {
      console.error('❌ Failed to create cashbook entry:', error);
      // Ensure form state is reset even on error
      setShowForm(false);
      setEditingEntry(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditEntry = (entry: CashbookEntry) => {
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setEditingEntry(null);
    setShowForm(false);
  };

  // Memoize date calculations to avoid recalculating on every render
  const dateCalculations = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    return {
      now,
      today,
      weekAgo,
      specificDateObj: specificDate ? new Date(specificDate) : null,
      startDateObj: customDateRange.start ? new Date(customDateRange.start) : null,
      endDateObj: customDateRange.end ? new Date(customDateRange.end) : null
    };
  }, [specificDate, customDateRange.start, customDateRange.end]);

  // Add debounced search to improve performance
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  
  // Use debouncedSearch instead of searchTerm for better performance
  const finalSearchTerm = useMemo(() => {
    return debouncedSearch.trim().toLowerCase();
  }, [debouncedSearch]);

  // Memoize filtered entries with optimized filtering
  const filteredEntries = useMemo(() => {
    if (!Array.isArray(entries) || entries.length === 0) {
      return [];
    }

    let filtered = entries;

    // Apply date filter with optimized date comparisons
    if (dateFilter !== 'all') {
      const { now, today, weekAgo, specificDateObj, startDateObj, endDateObj } = dateCalculations;
      
      filtered = filtered.filter(entry => {
        try {
          const entryDate = new Date(entry.date);
          if (isNaN(entryDate.getTime())) return false;
          
          const entryDateOnly = new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate());
          
          switch (dateFilter) {
            case 'today':
              return entryDateOnly.getTime() === today.getTime();
            case 'week':
              return entryDateOnly >= weekAgo;
            case 'month':
              return entryDate.getMonth() === now.getMonth() && entryDate.getFullYear() === now.getFullYear();
            case 'specific':
              if (!specificDateObj) return true;
              const selectedDateOnly = new Date(specificDateObj.getFullYear(), specificDateObj.getMonth(), specificDateObj.getDate());
              return entryDateOnly.getTime() === selectedDateOnly.getTime();
            case 'custom':
              if (!startDateObj || !endDateObj) return true;
              return entryDateOnly >= startDateObj && entryDateOnly <= endDateObj;
            default:
              return true;
          }
        } catch (error) {
          console.warn('Error filtering entry by date:', entry, error);
          return false;
        }
      });
    }

    // Apply search filter with optimized string operations
    if (finalSearchTerm) {
      filtered = filtered.filter((entry) => {
        try {
          // Pre-compute searchable strings only once per entry
          const searchableText = [
            entry.type || '',
            entry.category || '',
            entry.reference_id || '',
            entry.reference_name || '',
            String(entry.amount || 0),
            entry.narration || '',
            new Date(entry.date).toLocaleDateString('en-IN')
          ].join(' ').toLowerCase();
          
          return searchableText.includes(finalSearchTerm);
        } catch (error) {
          console.warn('Error filtering entry by search:', entry, error);
          return false;
        }
      });
    }

    // Sort entries by date (descending - latest first) with error handling
    return filtered.sort((a, b) => {
      try {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        
        if (isNaN(dateA) || isNaN(dateB)) {
          return 0; // Keep original order if dates are invalid
        }
        
        return dateB - dateA;
      } catch (error) {
        console.warn('Error sorting entries:', error);
        return 0;
      }
    });
  }, [entries, dateFilter, dateCalculations, finalSearchTerm]);


  // Optimize calculations by combining operations
  const { totalCredits, totalDebits, netBalance } = useMemo(() => {
    let credits = 0;
    let debits = 0;
    
    for (const entry of filteredEntries) {
      const amount = typeof entry.amount === 'number' ? entry.amount : 0;
      if (entry.type === 'credit') {
        credits += amount;
      } else if (entry.type === 'debit') {
        debits += amount;
      }
    }
    
    return {
      totalCredits: credits,
      totalDebits: debits,
      netBalance: credits - debits
    };
  }, [filteredEntries]);

  // Optimize delete function with better error handling and performance
  const confirmAndDelete = useCallback(async (id: string) => {
    if (isDeleting === id) {
      console.warn('Delete already in progress for entry:', id);
      return;
    }

    if (!window.confirm('Delete this cashbook entry? This will also remove related ledger entries.')) {
      return;
    }

    try {
      setIsDeleting(id);
      console.log('🗑️ Attempting to delete cashbook entry with ID:', id);
      
      // Find the entry to get the correct ID
      const entryToDelete = entries.find(entry => entry._id === id || entry.id === id);
      if (!entryToDelete) {
        console.error('Entry not found in local store:', id);
        alert('Entry not found. Please refresh and try again.');
        return;
      }
      
      const deleteId = entryToDelete._id || entryToDelete.id;
      console.log('Using delete ID:', deleteId);
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Delete operation timeout')), 15000)
      );

      // Delete from backend first with timeout
      const deletePromise = apiService.deleteCashbookEntry(deleteId);
      const deleteResponse = await Promise.race([deletePromise, timeoutPromise]);
      console.log('Delete response:', deleteResponse);
      
      // Remove from local store immediately for better UX
      setCashbookEntries(entries.filter((entry: CashbookEntry) => entry._id !== deleteId && entry.id !== deleteId));
      
      // Handle commission ledger entry creation in background
      if (entryToDelete.category === 'party_commission' && entryToDelete.reference_name) {
        const commissionLedgerEntry = {
          ledger_type: 'commission',
          reference_id: entryToDelete.reference_id || `CASH-COMM-${Date.now()}`,
          reference_name: entryToDelete.reference_name,
          date: entryToDelete.date,
          description: entryToDelete.narration || `Party commission payment to ${entryToDelete.reference_name}`,
          debit: entryToDelete.amount,
          credit: 0,
          balance: 0,
          source_type: 'cashbook',
        };
        
        // Run in background without blocking UI
        apiService.createLedgerEntry(commissionLedgerEntry)
          .then(() => console.log('✅ Party commission ledger entry created from cashbook'))
          .catch(error => console.error('❌ Failed to create party commission ledger entry from cashbook:', error));
      }
      
      // Handle related ledger entries deletion in background
      apiService.getLedgerEntries()
        .then(ledgerResponse => {
          const relatedLedgers = ledgerResponse.ledgerEntries.filter(
            ledger => (ledger.reference_id === deleteId || ledger.reference_id === id) && ledger.source_type === 'cashbook'
          );
          
          console.log('Found related ledger entries:', relatedLedgers.length);
          
          // Delete each related ledger entry in parallel
          const deletePromises = relatedLedgers.map(ledger => 
            apiService.deleteLedgerEntry(ledger._id)
              .then(() => console.log('Deleted ledger entry:', ledger._id))
              .catch(error => console.warn('Failed to delete ledger entry:', ledger._id, error))
          );
          
          return Promise.allSettled(deletePromises);
        })
        .catch(error => console.error('Error handling related ledger entries:', error));
      
      // Trigger data sync
      window.dispatchEvent(new CustomEvent('data-sync-required'));
      
      console.log('✅ Cashbook entry deleted successfully');
      
    } catch (error) {
      console.error('❌ Failed to delete cashbook entry:', error);
      
      // Check if it's a 404 error (entry already deleted)
      if (error instanceof Error && (error.message.includes('404') || error.message.includes('timeout'))) {
        // Remove from local store anyway since it's likely already gone
        setCashbookEntries(entries.filter((entry: CashbookEntry) => entry._id !== id && entry.id !== id));
        window.dispatchEvent(new CustomEvent('data-sync-required'));
        console.log('Entry was already deleted or timed out, removed from local store');
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        alert(`Failed to delete cashbook entry: ${errorMessage}. Please try again.`);
      }
    } finally {
      setIsDeleting(null);
    }
  }, [entries, isDeleting, setCashbookEntries]);


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Cashbook</h1>
        <button 
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>New Entry</span>
        </button>
      </div>

      {showForm && (
        <BankingForm
          onSubmit={handleCreateEntry as any}
          onCancel={handleCancelEdit}
          editingEntry={editingEntry as any}
        />
      )}

      {/* Search and Filter Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
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
        </div>
      </div>

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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Cashbook Entries</h3>
        </div>
        <div className="overflow-x-auto">
          {filteredEntries.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <CreditCard className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No cashbook entries found</p>
              <p className="text-sm">Add your first cashbook entry to get started</p>
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
                  <tr key={entry._id || entry.id || `cashbook-${Date.now()}-${Math.random()}`} className="hover:bg-gray-50">
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
                          onClick={() => handleEditEntry(entry)}
                          className="inline-flex items-center px-2 py-1 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded"
                          title="Edit entry"
                        >
                          <Edit className="w-3 h-3 mr-1" /> Edit
                        </button>
                        <button
                          onClick={() => confirmAndDelete(entry._id || entry.id)}
                          disabled={isDeleting === (entry._id || entry.id)}
                          className="text-red-600 hover:text-red-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={isDeleting === (entry._id || entry.id) ? "Deleting..." : "Delete entry"}
                        >
                          <Trash className="w-4 h-4" />
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

// Export removed - using default export above
