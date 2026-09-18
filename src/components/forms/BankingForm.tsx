import React, { useState, useMemo } from 'react';
import { X, ChevronDown, Plus, CreditCard } from 'lucide-react';
import { useDataStore } from '../../lib/store';
import { apiService } from '../../lib/api';
import { formatCurrency } from '../../utils/numberGenerator';
import { isFuelAdvance } from '../Memo';
import type { BankingEntry } from '../../types';

interface BankingFormProps {
  onSubmit: (data: Omit<BankingEntry, 'id' | 'created_at'>) => void;
  onCancel: () => void;
  editingEntry?: BankingEntry | null;
}

const BankingForm: React.FC<BankingFormProps> = ({ onSubmit, onCancel, editingEntry }) => {
  const { memos, bills, ledgerEntries, parties, vehicles, loadingSlips, suppliers, bankingEntries, cashbookEntries } = useDataStore();
  
  // Load saved preferences from localStorage
  const getSavedPreferences = () => {
    if (editingEntry) {
      // If editing, use existing entry data
      return {
        type: editingEntry.type,
        date: editingEntry.date
      };
    }
    
    // For new entries, load from localStorage
    const savedType = localStorage.getItem('banking_last_type') as 'credit' | 'debit' || 'credit';
    const savedDate = localStorage.getItem('banking_last_date') || new Date().toISOString().split('T')[0];
    
    return {
      type: savedType,
      date: savedDate
    };
  };

  const preferences = getSavedPreferences();
  
  const [formData, setFormData] = useState({
    type: preferences.type,
    category: editingEntry?.category || 'other' as 'bill_advance' | 'bill_payment' | 'memo_advance' | 'memo_payment' | 'expense' | 'fuel_wallet' | 'vehicle_expense' | 'vehicle_credit_note' | 'party_commission' | 'party_on_account' | 'supplier_on_account' | 'other',
    amount: editingEntry?.amount || 0,
    date: preferences.date,
    reference_id: editingEntry?.reference_id || '',
    reference_name: editingEntry?.reference_name || '',
    narration: editingEntry?.narration || '',
    vehicle_no: editingEntry?.vehicle_no || '',
  });

  const existingMemos = useMemo(() => memos.map(m => m.memo_number), [memos]);
  const existingBills = useMemo(() => bills.map(b => b.bill_number), [bills]);
  const [showReferenceDropdown, setShowReferenceDropdown] = useState(false);
  const [showNewLedgerModal, setShowNewLedgerModal] = useState(false);
  const [newLedgerData, setNewLedgerData] = useState({
    name: '',
    type: 'expense' as 'expense' | 'income' | 'asset' | 'liability',
    description: '',
  });
  
  // Get existing general ledger names for expense dropdown
  const existingLedgerNames = useMemo(() => {
    const generalEntries = ledgerEntries.filter(entry => entry.ledger_type === 'general');
    const partyNames = parties.map(p => p.name).filter(Boolean);
    const ledgerNames = Array.from(new Set(
      generalEntries
        .map(entry => entry.reference_name)
        .filter(Boolean)
    ));
    return Array.from(new Set([...partyNames, ...ledgerNames])).sort();
  }, [ledgerEntries, parties]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Function to calculate actual bill balance
  const calculateBillBalance = (bill: any) => {
    // Calculate what party owes: freight - mamool - commission + detention + rto + extra - tds - penalties
    const partyOwes = bill.bill_amount - (bill.mamool || 0) - (bill.commission || 0) + (bill.detention || 0) + (bill.rto || 0) + (bill.extra || 0) - (bill.tds || 0) - (bill.penalties || 0);
    
    // Find all payments for this bill from banking entries
    const bankingPayments = bankingEntries
      .filter(entry => {
        const matchesReference = entry.reference_id === bill.bill_number;
        const isCredit = entry.type === 'credit';
        return matchesReference && isCredit;
      })
      .reduce((total, entry) => total + entry.amount, 0);
    
    // Find all payments for this bill from cashbook entries
    const cashbookPayments = cashbookEntries
      .filter(entry => {
        const matchesReference = entry.reference_id === bill.bill_number;
        const isCredit = entry.type === 'credit';
        return matchesReference && isCredit;
      })
      .reduce((total, entry) => total + entry.amount, 0);
    
    const totalPayments = bankingPayments + cashbookPayments;
    const pendingBalance = Math.max(0, partyOwes - totalPayments);
    
    return {
      partyOwes,
      totalPayments,
      pendingBalance
    };
  };

  // Function to calculate pending amount owed to supplier for a memo
  const calculateMemoBalance = (memo: any) => {
    // Net amount the company owes the supplier
    const supplierOwed = memo.net_amount || 0;

    // Payments already made via banking debit entries
    const bankingPayments = bankingEntries
      .filter(e =>
        (e.category === 'memo_advance' || e.category === 'memo_payment') &&
        e.reference_id === memo.memo_number
      )
      .reduce((sum, e) => sum + e.amount, 0);

    // Payments already made via cashbook debit entries
    const cashbookPayments = cashbookEntries
      .filter(e =>
        (e.category === 'memo_advance' || e.category === 'memo_payment') &&
        e.reference_id === memo.memo_number
      )
      .reduce((sum, e) => sum + e.amount, 0);

    // Fuel advances already tagged to this memo
    const fuelAdvances = (memo.advance_payments || [])
      .filter(isFuelAdvance)
      .reduce((sum: number, a: any) => sum + (a.amount || 0), 0);

    const totalPaid = bankingPayments + cashbookPayments + fuelAdvances;
    const pendingBalance = Math.max(0, supplierOwed - totalPaid);

    return { supplierOwed, totalPaid, pendingBalance };
  };

  // All pending memos — enriched with loading slip data, sorted newest-first
  const pendingMemosEnriched = useMemo(() => {
    return memos
      .map(memo => {
        const { pendingBalance } = calculateMemoBalance(memo);
        // Resolve loading slip (may be populated object or string ID)
        const slip = typeof memo.loading_slip_id === 'object' && memo.loading_slip_id !== null
          ? memo.loading_slip_id as any
          : loadingSlips.find(ls => ls.id === memo.loading_slip_id || (ls as any)._id === memo.loading_slip_id);
        return { memo, pendingBalance, slip };
      })
      .filter(({ pendingBalance }) => pendingBalance > 0)
      // Newest memo first (highest memo number / latest created_at)
      .sort((a, b) => {
        const dateA = new Date(a.memo.created_at || a.memo.date || 0).getTime();
        const dateB = new Date(b.memo.created_at || b.memo.date || 0).getTime();
        return dateB - dateA;
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memos, loadingSlips, bankingEntries, cashbookEntries]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double submission
    if (isSubmitting) {
      console.warn('⚠️ Form submission already in progress, ignoring duplicate request');
      return;
    }
    
    // Validate required fields
    if (!formData.amount || !formData.date || !formData.narration) {
      alert('Please fill in all required fields');
      return;
    }
    
    setIsSubmitting(true);
    console.log('📝 Submitting banking form:', formData);
    
    try {
      await onSubmit(formData as any);
      
      // Save preferences to localStorage for next time (only for new entries, not edits)
      if (!editingEntry) {
        localStorage.setItem('banking_last_type', formData.type);
        localStorage.setItem('banking_last_date', formData.date);
        console.log('💾 Saved banking preferences:', { type: formData.type, date: formData.date });
      }
      
    } catch (error) {
      console.error('❌ Form submission failed:', error);
    } finally {
      // Reset submitting state after a short delay
      setTimeout(() => setIsSubmitting(false), 500);
    }

    // Note: Vehicle ledger entries are now automatically created by the backend banking route
    
    // Create party commission ledger entry for commission payments
    if (formData.category === 'party_commission' && formData.reference_name) {
      // Find the party ID for the reference
      const selectedParty = parties.find(p => p.name === formData.reference_name);
      const partyId = selectedParty ? selectedParty.id : formData.reference_name;
      
      const commissionLedgerEntry = {
        referenceId: partyId || selectedParty?.id || 'unknown',
        reference_id: `banking-${Date.now()}`,
        ledger_type: 'commission',
        reference_name: selectedParty ? selectedParty.name : formData.reference_name,
        type: 'commission',
        date: formData.date,
        description: `Commission Payment – Bank Transfer`,
        debit: formData.amount,
        credit: 0,
        balance: 0,
        source_type: 'banking',
        partyId: partyId || selectedParty?.id
      };
      
      console.log('🔍 Commission ledger entry to create:', commissionLedgerEntry);
      console.log('🔍 Party ID found:', partyId);
      
      try {
        await apiService.createLedgerEntry(commissionLedgerEntry);
        console.log('✅ Party commission ledger entry created:', commissionLedgerEntry);
      } catch (error) {
        console.error('❌ Failed to create party commission ledger entry:', error);
      }
    }
    
    // Party on account ledger entries are now created automatically by the backend
    // No need to create them manually in the frontend
    
    // onSubmit already called above - removing duplicate call to prevent double entries
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => {
      // if category changes, clear reference fields
      if (name === 'category') {
        return {
          ...prev,
          category: value as typeof prev.category,
          reference_id: '',
          reference_name: '',
        };
      }
      return {
        ...prev,
        [name]: type === 'number' ? parseFloat(value) || 0 : value,
      } as typeof prev;
    });
  };

  const getCategoryOptions = () => {
    if (formData.type === 'credit') {
      return [
        { value: 'bill_advance', label: 'Bill Advance' },
        { value: 'bill_payment', label: 'Bill Payment' },
        { value: 'party_on_account', label: 'Party On Account' },
        { value: 'vehicle_credit_note', label: 'Vehicle Credit Note (Insurance/Cashback)' },
        { value: 'other', label: 'Other Income' },
      ];
    } else {
      return [
        { value: 'memo_advance', label: 'Memo Advance' },
        { value: 'memo_payment', label: 'Memo Payment' },
        { value: 'expense', label: 'General Expense' },
        { value: 'vehicle_expense', label: 'Vehicle Expense' },
        { value: 'fuel_wallet', label: 'Fuel Wallet Credit' },
        { value: 'party_commission', label: 'Party Commission Payment' },
        { value: 'party_on_account', label: 'Party On Account Payment' },
        { value: 'supplier_on_account', label: 'Supplier On Account Payment' },
        { value: 'other', label: 'Other Expense' },
      ];
    }
  };

  const needsReference = () => {
    return ['bill_advance', 'bill_payment', 'memo_advance', 'memo_payment', 'party_commission'].includes(formData.category);
  };


  const needsVehicle = () => {
    return formData.category === 'vehicle_expense' || formData.category === 'vehicle_credit_note';
  };

  const getOwnVehicles = () => {
    return vehicles.filter(v => v.ownership_type === 'own');
  };

  const getReferenceOptions = () => {
    if (formData.category.includes('bill')) {
      return existingBills;
    } else if (formData.category.includes('memo')) {
      console.log(`📋 Memo search: Found ${existingMemos.length} memos:`, existingMemos);
      return existingMemos;
    } else if (formData.category === 'party_commission' || formData.category === 'party_on_account') {
      return parties.map(p => p.name).filter(Boolean);
    }
    return [];
  };

  const handleReferenceSelect = (value: string) => {
    setFormData(prev => {
      let reference_name = prev.reference_name;
      if (prev.category.includes('bill')) {
        const bill = bills.find(b => b.bill_number === value);
        reference_name = bill?.party || '';
      } else if (prev.category.includes('memo')) {
        const memo = memos.find(m => m.memo_number === value);
        reference_name = memo?.supplier || '';
      } else if (prev.category === 'party_commission' || prev.category === 'party_on_account') {
        reference_name = value; // Party name is the reference_name for commission/on account payments
      }
      return {
        ...prev,
        reference_id: value,
        reference_name,
      };
    });
    setShowReferenceDropdown(false);
  };

  const handleCreateNewLedger = () => {
    setNewLedgerData({
      name: formData.reference_name,
      type: formData.type === 'debit' ? 'expense' : 'income',
      description: '',
    });
    setShowNewLedgerModal(true);
    setShowReferenceDropdown(false);
  };

  const handleNewLedgerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Add the new ledger name to form data
    setFormData(prev => ({ ...prev, reference_name: newLedgerData.name }));
    setShowNewLedgerModal(false);
    setNewLedgerData({ name: '', type: 'expense', description: '' });
  };

  const handleNewLedgerInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewLedgerData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {editingEntry ? 'Edit Banking Entry' : 'New Banking Entry'}
          </h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Entry Type
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="credit">Credit (Money In)</option>
                <option value="debit">Debit (Money Out)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                {getCategoryOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* SUPPLIER DROPDOWN - MOVED HERE FOR BETTER VISIBILITY */}
          {formData.category === 'supplier_on_account' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Supplier
              </label>
              <select
                name="reference_name"
                value={formData.reference_name}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select Supplier</option>
                {suppliers && suppliers.map((supplier: any, index: number) => (
                  <option key={supplier.id || supplier._id || `supplier-${index}-${supplier.name}`} value={supplier.name}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount (₹)
              </label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                step="0.01"
                min="0"
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
              {/* Party On Account - Special handling */}
              {formData.category === 'party_on_account' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Party
                  </label>
                  <select
                    name="reference_name"
                    value={formData.reference_name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option key="select-party-commission" value="">Select Party</option>
                    {parties.map((party, index) => (
                      <option key={party.id || `party-commission-${index}-${party.name}`} value={party.name}>
                        {party.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {needsReference() && (
            <>
              {/* Party Selection for Bill Advance, Bill Payment, and Party Commission */}
              {(formData.category === 'bill_advance' || formData.category === 'bill_payment' || formData.category === 'party_commission' || formData.category === 'party_on_account') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Party
                  </label>
                  <div className="relative">
                    <select
                      name="reference_name"
                      value={formData.reference_name}
                      onChange={(e) => {
                        const selectedParty = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          reference_name: selectedParty,
                          reference_id: '' // Clear bill selection when party changes
                        }));
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option key="select-party" value="">Select Party</option>
                      {parties.map((party, index) => (
                        <option key={party.id || `party-on-account-${index}-${party.name}`} value={party.name}>
                          {party.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Bill Selection for Bill Advance and Bill Payment */}
              {(formData.category === 'bill_advance' || formData.category === 'bill_payment') && formData.reference_name && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Bill for {formData.reference_name}
                  </label>
                  <div className="relative">
                    <select
                      name="reference_id"
                      value={formData.reference_id}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option key="select-bill" value="">Select Bill</option>
                      {bills
                        .filter(bill => bill.party === formData.reference_name)
                        .filter(bill => {
                          // Only show bills with pending balance > 0
                          const { pendingBalance } = calculateBillBalance(bill);
                          return pendingBalance > 0;
                        })
                        .map((bill, index) => {
                          // Calculate actual pending balance
                          const { pendingBalance } = calculateBillBalance(bill);
                          
                          return (
                            <option 
                              key={bill.id || bill.bill_number || `bill-${index}-${bill.bill_number}`} 
                              value={bill.bill_number}
                            >
                              {bill.bill_number} - {(bill.loading_slip_id as any)?.vehicle_no || 'No Vehicle'} - ₹{pendingBalance.toLocaleString('en-IN')} (Pending)
                            </option>
                          );
                        })}
                    </select>
                    {bills.filter(bill => bill.party === formData.reference_name && calculateBillBalance(bill).pendingBalance > 0).length === 0 && (
                      <p className="text-sm text-gray-500 mt-1">
                        {bills.filter(bill => bill.party === formData.reference_name).length === 0 
                          ? `No bills found for ${formData.reference_name}`
                          : `No pending bills for ${formData.reference_name} (all bills are fully paid)`
                        }
                      </p>
                    )}
                  </div>
                </div>
              )}


              {/* Memo selection — rich dropdown for memo_advance / memo_payment */}
              {(formData.category === 'memo_advance' || formData.category === 'memo_payment') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Memo
                    <span className="ml-2 text-xs text-gray-400 font-normal">(pending memos, newest first)</span>
                  </label>
                  <select
                    name="reference_id"
                    value={formData.reference_id}
                    onChange={(e) => {
                      const selected = pendingMemosEnriched.find(({ memo }) => memo.memo_number === e.target.value);
                      setFormData(prev => ({
                        ...prev,
                        reference_id: e.target.value,
                        reference_name: selected?.memo.supplier || prev.reference_name,
                      }));
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select Memo</option>
                    {pendingMemosEnriched.map(({ memo, pendingBalance, slip }) => {
                      const vehicleNo = slip?.vehicle_no || memo.supplier || 'N/A';
                      const from = slip?.from_location ? slip.from_location.substring(0, 10) : '—';
                      const to   = slip?.to_location   ? slip.to_location.substring(0, 10)   : '—';
                      const pending = pendingBalance.toLocaleString('en-IN');
                      return (
                        <option key={memo.id || memo.memo_number} value={memo.memo_number}>
                          {memo.memo_number} | {vehicleNo} | {from}→{to} | ₹{pending} Pending
                        </option>
                      );
                    })}
                  </select>
                  {pendingMemosEnriched.length === 0 && (
                    <p className="text-sm text-gray-500 mt-1">No pending memos found</p>
                  )}
                  {formData.reference_id && (
                    <p className="text-xs text-gray-500 mt-1">
                      Supplier: <span className="font-medium text-gray-700">{formData.reference_name}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Reference fields for other non-memo, non-bill, non-party categories */}
              {formData.category !== 'bill_advance' && formData.category !== 'bill_payment' &&
               formData.category !== 'memo_advance' && formData.category !== 'memo_payment' &&
               formData.category !== 'party_on_account' && formData.category !== 'party_commission' &&
               String(formData.category) !== 'supplier_on_account' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {formData.category.includes('bill') ? 'Bill Number' : 'Reference Number'}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        name="reference_id"
                        value={formData.reference_id}
                        onChange={handleInputChange}
                        onFocus={() => setShowReferenceDropdown(true)}
                        className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={formData.category.includes('bill') ? 'Select Bill Number' : 'Enter Reference'}
                        required
                      />
                      <ChevronDown
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 cursor-pointer"
                        onClick={() => setShowReferenceDropdown(!showReferenceDropdown)}
                      />
                      {showReferenceDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                          {getReferenceOptions()
                            .filter(option => option && option.toLowerCase().includes((formData.reference_id || '').toLowerCase()))
                            .map((option, index) => (
                              <div
                                key={`reference-${index}-${option}`}
                                className="px-4 py-2 hover:bg-blue-50 cursor-pointer"
                                onClick={() => handleReferenceSelect(option)}
                              >
                                {option}
                              </div>
                            ))}
                          {getReferenceOptions()
                            .filter(option => option && option.toLowerCase().includes((formData.reference_id || '').toLowerCase()))
                            .length === 0 && formData.reference_id && (
                            <div className="px-4 py-2 text-gray-500 text-sm">
                              No matches for "{formData.reference_id}"
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {formData.category.includes('bill') ? 'Party Name' : 'Supplier Name'}
                    </label>
                    <input
                      type="text"
                      name="reference_name"
                      value={formData.reference_name}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={formData.category.includes('bill') ? 'Enter Party Name' : 'Enter Supplier Name'}
                      required
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {needsVehicle() && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Vehicle (Own Vehicles Only)
              </label>
              <select
                name="vehicle_no"
                value={formData.vehicle_no}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option key="select-vehicle" value="">Select Vehicle</option>
                {getOwnVehicles().map((vehicle, index) => (
                  <option key={vehicle.id || `vehicle-${index}-${vehicle.vehicle_no}`} value={vehicle.vehicle_no}>
                    {vehicle.vehicle_no} ({vehicle.vehicle_type})
                  </option>
                ))}
              </select>
            </div>
          )}

          {!needsReference() && !needsVehicle() && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {formData.category === 'fuel_wallet' ? 'Fuel Wallet Name' :
                 ((formData.type === 'debit' && (formData.category === 'expense' || formData.category === 'other')) || 
                  (formData.type === 'credit' && formData.category === 'other'))
                  ? 'Select Ledger Account' : 'Reference Name'}
              </label>
              {formData.category === 'fuel_wallet' ? (
                <select
                  name="reference_name"
                  value={formData.reference_name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option key="select-fuel" value="">Select Fuel Wallet</option>
                  <option key="BPCL" value="BPCL">BPCL</option>
                  <option key="HPCL" value="HPCL">HPCL</option>
                  <option key="IOCL" value="IOCL">IOCL</option>
                  <option key="Shell" value="Shell">Shell</option>
                  <option key="Essar" value="Essar">Essar</option>
                </select>
              ) : ((formData.type === 'debit' && (formData.category === 'expense' || formData.category === 'other')) || 
                     (formData.type === 'credit' && formData.category === 'other')) ? (
                <div className="relative">
                  <input
                    type="text"
                    name="reference_name"
                    value={formData.reference_name}
                    onChange={handleInputChange}
                    onFocus={() => setShowReferenceDropdown(true)}
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={formData.type === 'credit' ? "Select income ledger or enter new name" : "Select existing ledger or enter new name"}
                    required
                  />
                  <ChevronDown 
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 cursor-pointer"
                    onClick={() => setShowReferenceDropdown(!showReferenceDropdown)}
                  />
                  {showReferenceDropdown && existingLedgerNames.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {existingLedgerNames
                        .filter(name => name && name.toLowerCase().includes((formData.reference_name || '').toLowerCase()))
                        .map((name, index) => (
                        <div
                          key={`ledger-${index}-${name}`}
                          className="px-4 py-2 hover:bg-blue-50 cursor-pointer"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, reference_name: name || '' }));
                            setShowReferenceDropdown(false);
                          }}
                        >
                          {name}
                        </div>
                      ))}
                      {formData.reference_name && !existingLedgerNames.some(name => 
                        name && name.toLowerCase() === formData.reference_name.toLowerCase()) && (
                        <div 
                          className="px-4 py-2 text-blue-600 hover:bg-blue-50 cursor-pointer border-t flex items-center space-x-2"
                          onClick={handleCreateNewLedger}
                        >
                          <Plus className="w-4 h-4" />
                          <span>Create new ledger: "{formData.reference_name}"</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <input
                  type="text"
                  name="reference_name"
                  value={formData.reference_name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter name or description"
                  required
                />
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Narration
            </label>
            <textarea
              name="narration"
              value={formData.narration}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter transaction details..."
              required
            />
          </div>

          {/* Summary */}
          <div className={`p-4 rounded-lg ${formData.type === 'credit' ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CreditCard className={`w-5 h-5 ${formData.type === 'credit' ? 'text-green-600' : 'text-red-600'}`} />
                <span className={`font-medium ${formData.type === 'credit' ? 'text-green-900' : 'text-red-900'}`}>
                  {formData.type === 'credit' ? 'Credit Entry' : 'Debit Entry'}
                </span>
              </div>
              <span className={`text-xl font-bold ${formData.type === 'credit' ? 'text-green-900' : 'text-red-900'}`}>
                {formData.type === 'credit' ? '+' : '-'}{formatCurrency(formData.amount)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
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
              className={`w-full py-2 px-4 rounded-lg focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors ${
                isSubmitting 
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isSubmitting 
                ? 'Creating...' 
                : editingEntry 
                  ? 'Update Entry' 
                  : 'Create Entry'
              }
            </button>
          </div>
        </form>
      </div>

      {/* New Ledger Creation Modal */}
      {showNewLedgerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Create New Ledger Account</h3>
              <button 
                onClick={() => setShowNewLedgerModal(false)} 
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleNewLedgerSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ledger Account Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={newLedgerData.name}
                  onChange={handleNewLedgerInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter ledger account name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Type
                </label>
                <select
                  name="type"
                  value={newLedgerData.type}
                  onChange={handleNewLedgerInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option key="expense" value="expense">Expense Account</option>
                  <option key="income" value="income">Income Account</option>
                  <option key="asset" value="asset">Asset Account</option>
                  <option key="liability" value="liability">Liability Account</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  name="description"
                  value={newLedgerData.description}
                  onChange={handleNewLedgerInputChange}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter description for this ledger account"
                />
              </div>

              <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowNewLedgerModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                    isSubmitting 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Ledger</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankingForm;