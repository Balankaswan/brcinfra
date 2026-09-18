import React, { useState, useMemo, useEffect } from 'react';
import { Truck, Filter, Download, FileDown, Plus, MessageCircle, Table, FileText } from 'lucide-react';
import { useDataStore } from '../lib/store';
import { formatCurrency } from '../utils/numberGenerator';
import { apiService } from '../lib/api';

interface SupplierLedgerEntry {
  id: string;
  date: string;
  particulars: string[];
  memoNo: string;
  debit: number;
  credit: number;
  runningBalance: number;
  entryType: 'memo' | 'payment_bank' | 'payment_cash' | 'debit_note' | 'opening_balance';
  remarks?: string;
  // Breakdown fields preserved for exports
  freight?: number;
  commission?: number;
  mamool?: number;
  detention?: number;
  extra?: number;
  rto?: number;
  deduction?: number;
  netAmount?: number;
}

interface SupplierLedgerProps {
  selectedSupplier?: string;
  onNavigate?: (page: string, params?: any) => void;
}

const SupplierLedger: React.FC<SupplierLedgerProps> = ({ selectedSupplier, onNavigate }) => {
  const { memos, loadingSlips, suppliers: masterSuppliers, bankingEntries, cashbookEntries } = useDataStore();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [supplierFilter, setSupplierFilter] = useState(selectedSupplier || '');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<'all' | 'memo' | 'bank' | 'cash'>('all');
  const [showDebitNoteModal, setShowDebitNoteModal] = useState(false);
  const [debitNoteForm, setDebitNoteForm] = useState({
    amount: 0,
    narration: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Sync selectedSupplier prop
  useEffect(() => {
    if (selectedSupplier) {
      setSupplierFilter(selectedSupplier);
    }
  }, [selectedSupplier]);

  // Navigate to Memos page
  const handleMemoClick = (memoNumber: string) => {
    if (onNavigate) {
      onNavigate('memo', { highlight: memoNumber });
    }
  };

  // Get unique suppliers from memos and master suppliers
  const suppliers = useMemo(() => {
    const supplierSet = new Set<string>();
    (masterSuppliers || []).forEach(s => {
      const name = typeof s === 'string' ? s : s?.name;
      if (name) supplierSet.add(name);
    });
    (memos || []).forEach(memo => {
      if (memo.supplier) supplierSet.add(memo.supplier);
    });
    return Array.from(supplierSet).sort();
  }, [memos, masterSuppliers]);

  // Find supplier master info
  const supplierMaster = useMemo(() => {
    if (!supplierFilter) return null;
    const lower = supplierFilter.trim().toLowerCase();
    return (masterSuppliers || []).find(s => (s.name || '').trim().toLowerCase() === lower) || null;
  }, [supplierFilter, masterSuppliers]);

  // Calculate total supplier payable across all suppliers
  const totalPayable = useMemo(() => {
    let grandTotal = 0;

    suppliers.forEach(supp => {
      const suppLower = supp.trim().toLowerCase();
      const sMemos = memos.filter(m => m.supplier && m.supplier.trim().toLowerCase() === suppLower);

      let running = 0;
      sMemos.forEach(m => {
        const net = m.net_amount || ((m.freight || 0) - (m.commission || 0) - (m.mamool || 0) + (m.detention || 0) + (m.extra || 0) + (m.rto || 0) - (m.deduction || 0));
        running += net;
      });

      const sBanking = bankingEntries.filter(e =>
        (e.reference_name && e.reference_name.trim().toLowerCase() === suppLower) ||
        (sMemos.some(m => m.memo_number === e.reference_id))
      );

      sBanking.forEach(e => {
        if (e.category === 'memo_payment' || e.category === 'memo_advance' || e.category === 'supplier_on_account') {
          running -= e.amount;
        } else if (e.category === 'supplier_debit_note') {
          running -= e.amount;
        }
      });

      const sCashbook = (cashbookEntries || []).filter(e =>
        (e.reference_name && e.reference_name.trim().toLowerCase() === suppLower) ||
        (sMemos.some(m => m.memo_number === e.reference_id))
      );

      sCashbook.forEach(e => {
        if (e.category === 'memo_payment' || e.category === 'memo_advance' || e.category === 'supplier_on_account') {
          running -= e.amount;
        }
      });

      if (running > 0) {
        grandTotal += running;
      }
    });

    return grandTotal;
  }, [suppliers, memos, bankingEntries, cashbookEntries]);

  // Generate Tally-style ledger entries for selected supplier
  const supplierLedgerEntries = useMemo((): SupplierLedgerEntry[] => {
    if (!supplierFilter) return [];

    const suppLower = supplierFilter.trim().toLowerCase();
    const entries: SupplierLedgerEntry[] = [];
    let runningBalance = 0;

    // Get all memos for this supplier
    const supplierMemos = memos
      .filter(m => m.supplier && m.supplier.trim().toLowerCase() === suppLower)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Get all banking entries for this supplier
    const supplierBanking = bankingEntries
      .filter(entry => {
        if (entry.reference_name && entry.reference_name.trim().toLowerCase() === suppLower) return true;
        if ((entry.category === 'memo_payment' || entry.category === 'memo_advance') && supplierMemos.some(m => m.memo_number === entry.reference_id)) return true;
        return false;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Get all cashbook entries for this supplier
    const supplierCashbook = (cashbookEntries || [])
      .filter(entry => {
        if (entry.reference_name && entry.reference_name.trim().toLowerCase() === suppLower) return true;
        if ((entry.category === 'memo_payment' || entry.category === 'memo_advance') && supplierMemos.some(m => m.memo_number === entry.reference_id)) return true;
        return false;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Timeline event type
    type TimelineItem = {
      type: 'memo' | 'bank_payment' | 'cash_payment' | 'debit_note';
      date: string;
      data: any;
    };

    const timeline: TimelineItem[] = [];

    // 1. Add Memos
    supplierMemos.forEach(memo => {
      timeline.push({ type: 'memo', date: memo.date, data: memo });
    });

    // 2. Add Banking entries
    supplierBanking.forEach(entry => {
      if (entry.category === 'supplier_debit_note') {
        timeline.push({ type: 'debit_note', date: entry.date, data: entry });
      } else {
        timeline.push({ type: 'bank_payment', date: entry.date, data: entry });
      }
    });

    // 3. Add Cashbook entries
    supplierCashbook.forEach(entry => {
      timeline.push({ type: 'cash_payment', date: entry.date, data: entry });
    });

    // Sort timeline chronologically by date
    timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Build ledger entries row by row
    timeline.forEach((item, idx) => {
      if (item.type === 'memo') {
        const memo = item.data;
        const netPayable = memo.net_amount || ((memo.freight || 0) - (memo.commission || 0) - (memo.mamool || 0) + (memo.detention || 0) + (memo.extra || 0) + (memo.rto || 0) - (memo.deduction || 0));
        const debit = netPayable;
        const credit = 0;
        runningBalance += debit;

        // Build route / vehicle details for Particulars column
        const particularsLines: string[] = [];

        // Check for multiple LRs in memo
        let linkedSlips: typeof loadingSlips = [];
        if (memo.loading_slip_ids && Array.isArray(memo.loading_slip_ids) && memo.loading_slip_ids.length > 0) {
          linkedSlips = memo.loading_slip_ids
            .map((id: string) => loadingSlips.find(s => s.id === id || (s as any)._id === id))
            .filter(Boolean) as typeof loadingSlips;
        } else if (memo.loading_slip_id) {
          const lsId = typeof memo.loading_slip_id === 'object' ? (memo.loading_slip_id as any)._id || (memo.loading_slip_id as any).id : memo.loading_slip_id;
          const found = loadingSlips.find(s => s.id === lsId || (s as any)._id === lsId);
          if (found) linkedSlips = [found];
        }

        if (linkedSlips.length > 1) {
          linkedSlips.forEach(ls => {
            particularsLines.push(`${ls.from_location || ''} → ${ls.to_location || ''} (${ls.vehicle_no || 'N/A'})`);
          });
        } else if (linkedSlips.length === 1) {
          const ls = linkedSlips[0];
          particularsLines.push(`${ls.from_location || ''} → ${ls.to_location || ''}`);
          particularsLines.push(`${ls.vehicle_no || 'N/A'}`);
        } else {
          // Fallback if loading slip object not found in store
          if (memo.from_location || memo.to_location) {
            particularsLines.push(`${memo.from_location || ''} → ${memo.to_location || ''}`);
          }
          if (memo.vehicle_no) {
            particularsLines.push(`${memo.vehicle_no}`);
          }
          if (particularsLines.length === 0) {
            particularsLines.push(`Freight Memo ${memo.memo_number}`);
          }
        }

        entries.push({
          id: memo.id || (memo as any)._id || `supplier-memo-${idx}`,
          date: memo.date,
          particulars: particularsLines,
          memoNo: memo.memo_number,
          debit,
          credit: 0,
          runningBalance,
          entryType: 'memo',
          remarks: memo.narration || '',
          freight: memo.freight,
          commission: memo.commission,
          mamool: memo.mamool,
          detention: memo.detention,
          extra: memo.extra,
          rto: memo.rto,
          deduction: memo.deduction,
          netAmount: netPayable
        });
      } else if (item.type === 'bank_payment') {
        const entry = item.data;
        const debit = 0;
        const credit = entry.amount;
        runningBalance -= credit;

        const particularsLines: string[] = ['BANK TRANSFER'];
        if (entry.narration && !entry.narration.toLowerCase().includes('bank transfer')) {
          particularsLines.push(entry.narration);
        }

        entries.push({
          id: entry.id || (entry as any)._id || `supplier-bank-${idx}`,
          date: entry.date,
          particulars: particularsLines,
          memoNo: entry.reference_id || '',
          debit: 0,
          credit,
          runningBalance,
          entryType: 'payment_bank',
          remarks: entry.narration || 'Bank Transfer'
        });
      } else if (item.type === 'cash_payment') {
        const entry = item.data;
        const debit = 0;
        const credit = entry.amount;
        runningBalance -= credit;

        const particularsLines: string[] = ['CASH'];
        if (entry.narration && !entry.narration.toLowerCase().includes('cash')) {
          particularsLines.push(entry.narration);
        }

        entries.push({
          id: entry.id || (entry as any)._id || `supplier-cash-${idx}`,
          date: entry.date,
          particulars: particularsLines,
          memoNo: entry.reference_id || '',
          debit: 0,
          credit,
          runningBalance,
          entryType: 'payment_cash',
          remarks: entry.narration || 'Cash Payment'
        });
      } else if (item.type === 'debit_note') {
        const entry = item.data;
        const debit = 0;
        const credit = entry.amount; // Debit note reduces supplier balance owed
        runningBalance -= credit;

        entries.push({
          id: entry.id || (entry as any)._id || `supplier-dn-${idx}`,
          date: entry.date,
          particulars: ['DEBIT NOTE', entry.narration || 'Adjustment'],
          memoNo: '',
          debit: 0,
          credit,
          runningBalance,
          entryType: 'debit_note',
          remarks: entry.narration || 'Debit Note'
        });
      }
    });

    return entries;
  }, [supplierFilter, memos, bankingEntries, cashbookEntries, loadingSlips]);

  // Filter entries by date range & transaction type
  const filteredEntries = useMemo(() => {
    let filtered = supplierLedgerEntries;

    if (dateFrom) {
      filtered = filtered.filter(entry => entry.date >= dateFrom);
    }

    if (dateTo) {
      filtered = filtered.filter(entry => entry.date <= dateTo);
    }

    if (transactionTypeFilter === 'memo') {
      filtered = filtered.filter(entry => entry.entryType === 'memo');
    } else if (transactionTypeFilter === 'bank') {
      filtered = filtered.filter(entry => entry.entryType === 'payment_bank');
    } else if (transactionTypeFilter === 'cash') {
      filtered = filtered.filter(entry => entry.entryType === 'payment_cash');
    }

    return filtered;
  }, [supplierLedgerEntries, dateFrom, dateTo, transactionTypeFilter]);

  // Calculate totals
  const totals = useMemo(() => {
    return filteredEntries.reduce((acc, entry) => ({
      debit: acc.debit + entry.debit,
      credit: acc.credit + entry.credit,
    }), { debit: 0, credit: 0 });
  }, [filteredEntries]);

  // Final Closing Balance
  const finalBalance = useMemo(() => {
    return filteredEntries.length > 0 ? filteredEntries[filteredEntries.length - 1].runningBalance : 0;
  }, [filteredEntries]);

  // Handle Debit Note creation
  const handleCreateDebitNote = async () => {
    if (!supplierFilter) {
      alert('Please select a supplier first');
      return;
    }

    if (!debitNoteForm.amount || debitNoteForm.amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (!debitNoteForm.narration.trim()) {
      alert('Please enter a narration for the debit note');
      return;
    }

    try {
      const debitNoteData = {
        supplier_name: supplierFilter,
        amount: debitNoteForm.amount,
        date: debitNoteForm.date,
        narration: debitNoteForm.narration
      };

      await apiService.createSupplierDebitNote(debitNoteData);

      setDebitNoteForm({
        amount: 0,
        narration: '',
        date: new Date().toISOString().split('T')[0]
      });
      setShowDebitNoteModal(false);

      alert(`Debit note of ₹${debitNoteForm.amount.toLocaleString('en-IN')} created successfully for ${supplierFilter}`);
    } catch (error) {
      console.error('Failed to create debit note:', error);
      alert('Failed to create debit note. Please try again.');
    }
  };

  // CSV Export
  const exportToCSV = () => {
    if (!filteredEntries.length) return;

    const headers = ['Date', 'Particulars', 'Invoice No.', 'Credit (₹)', 'Debit (₹)', 'Balance (₹)'];
    const csvRows: string[] = [headers.join(',')];

    filteredEntries.forEach(entry => {
      const dateStr = new Date(entry.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const particularsStr = `"${entry.particulars.join(' / ')}"`;
      const memoStr = `"${entry.memoNo || ''}"`;
      const creditStr = entry.credit > 0 ? entry.credit.toString() : '';
      const debitStr = entry.debit > 0 ? entry.debit.toString() : '';
      const balStr = `"${formatCurrency(Math.abs(entry.runningBalance))} ${entry.runningBalance >= 0 ? 'Dr' : 'Cr'}"`;

      csvRows.push([dateStr, particularsStr, memoStr, creditStr, debitStr, balStr].join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supplier-ledger-${supplierFilter}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // PDF Export
  const exportToPDF = async () => {
    if (!filteredEntries.length || !supplierFilter) {
      alert('Please select a supplier and ensure there are entries to export.');
      return;
    }

    try {
      const { generateProfessionalLedgerPDF, testLibraries } = await import('../utils/simpleProfessionalLedgerPdf');
      const librariesWork = testLibraries();
      if (!librariesWork) {
        throw new Error('Required libraries (jsPDF, XLSX) are not working properly');
      }

      await generateProfessionalLedgerPDF({
        type: 'SUPPLIER',
        name: supplierFilter,
        entries: filteredEntries as any,
        totals: {
          credit: totals.debit,
          debitPayment: totals.credit,
          billAmount: totals.debit
        },
        dateRange: { from: dateFrom, to: dateTo },
        currentBalance: finalBalance
      });
    } catch (error: any) {
      console.error('Failed to generate PDF:', error);
      alert(`Failed to generate PDF: ${error?.message || 'Unknown error'}`);
    }
  };

  // Excel Export
  const exportToExcel = async () => {
    if (!filteredEntries.length || !supplierFilter) {
      alert('Please select a supplier and ensure there are entries to export.');
      return;
    }

    try {
      const { exportLedgerToExcel, testLibraries } = await import('../utils/simpleProfessionalLedgerPdf');
      const librariesWork = testLibraries();
      if (!librariesWork) {
        throw new Error('Required libraries (jsPDF, XLSX) are not working properly');
      }

      await exportLedgerToExcel({
        type: 'SUPPLIER',
        name: supplierFilter,
        entries: filteredEntries as any,
        totals: {
          credit: totals.debit,
          debitPayment: totals.credit,
          billAmount: totals.debit
        },
        dateRange: { from: dateFrom, to: dateTo },
        currentBalance: finalBalance
      });
    } catch (error: any) {
      console.error('Failed to export Excel:', error);
      alert(`Failed to export Excel: ${error?.message || 'Unknown error'}`);
    }
  };

  // WhatsApp Share
  const handleWhatsAppShare = () => {
    if (!supplierFilter || !filteredEntries.length) return;

    const startDate = dateFrom ? new Date(dateFrom).toLocaleDateString('en-IN') : 'Start';
    const endDate = dateTo ? new Date(dateTo).toLocaleDateString('en-IN') : 'Present';

    const message = `*Supplier Ledger Statement*\n` +
      `Supplier: *${supplierFilter}*\n` +
      `Period: ${startDate} to ${endDate}\n\n` +
      `*Summary:*\n` +
      `Total Debit (Memo Amount): ${formatCurrency(totals.debit)}\n` +
      `Total Credit (Paid): ${formatCurrency(totals.credit)}\n` +
      `*Closing Balance: ${formatCurrency(Math.abs(finalBalance))} ${finalBalance >= 0 ? 'Dr' : 'Cr'}*\n\n` +
      `Generated via BRC Management`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Supplier Ledger</h1>
          <p className="text-gray-600 text-sm">Tally-style supplier freight memo statement and payment tracking</p>
        </div>

        {supplierFilter && (
          <button
            onClick={() => setShowDebitNoteModal(true)}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            <span>Create Debit Note</span>
          </button>
        )}
      </div>

      {/* Filter Controls */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center space-x-2 mb-3">
          <Filter className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Filters</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Select Supplier *
            </label>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="">-- Choose Supplier --</option>
              {suppliers.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Transaction Type
            </label>
            <select
              value={transactionTypeFilter}
              onChange={(e) => setTransactionTypeFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">All Transactions</option>
              <option value="memo">Freight Memos</option>
              <option value="bank">Bank Transfers</option>
              <option value="cash">Cash Payments</option>
            </select>
          </div>

          <div className="flex items-end space-x-1.5">
            <button
              onClick={exportToCSV}
              disabled={!filteredEntries.length}
              className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-1 text-xs font-medium"
              title="Export CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
            <button
              onClick={exportToPDF}
              disabled={!filteredEntries.length}
              className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-1 text-xs font-medium"
              title="Export PDF"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
            <button
              onClick={exportToExcel}
              disabled={!filteredEntries.length}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-1 text-xs font-medium"
              title="Export Excel"
            >
              <Table className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
            <button
              onClick={handleWhatsAppShare}
              disabled={!filteredEntries.length}
              className="px-3 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#128C7E] disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-1 text-xs font-medium"
              title="Share on WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Global Payable Banner (when no supplier filter selected) */}
      {!supplierFilter && (
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-6 rounded-xl shadow-sm border border-orange-200 flex items-center justify-between">
          <div>
            <div className="text-xs text-orange-600 font-bold uppercase tracking-wider">Total Supplier Payable (Across All Suppliers)</div>
            <div className="text-3xl font-bold text-orange-900 mt-1 font-mono">{formatCurrency(totalPayable)}</div>
            <div className="text-xs text-orange-600 mt-1">Select a supplier from the dropdown above to view their detailed Tally ledger</div>
          </div>
          <Truck className="w-12 h-12 text-orange-400 opacity-60" />
        </div>
      )}

      {/* Tally-Style Ledger Section */}
      {supplierFilter ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-300 overflow-hidden">
          {/* Tally Header Bar */}
          <div className="bg-gray-800 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between text-white gap-3 border-b border-gray-700">
            <div>
              <div className="text-xs text-orange-400 font-bold uppercase tracking-widest">SUPPLIER LEDGER</div>
              <h2 className="text-xl font-bold text-white mt-0.5">{supplierFilter}</h2>
              <div className="text-xs text-gray-300 mt-1 flex flex-wrap gap-4">
                <span><strong className="text-gray-400">Contact:</strong> {supplierMaster?.phone || supplierMaster?.contact || 'N/A'}</span>
                <span><strong className="text-gray-400">Period:</strong> {dateFrom ? new Date(dateFrom).toLocaleDateString('en-IN') : '01/04/2026'} - {dateTo ? new Date(dateTo).toLocaleDateString('en-IN') : '31/03/2027'}</span>
              </div>
            </div>
            <div className="text-right border-t md:border-t-0 pt-2 md:pt-0 border-gray-700">
              <div className="text-xs text-gray-400 uppercase tracking-wide">Closing Balance</div>
              <div className={`text-2xl font-bold font-mono ${finalBalance >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                {formatCurrency(Math.abs(finalBalance))} {finalBalance >= 0 ? 'Dr' : 'Cr'}
              </div>
            </div>
          </div>

          {/* Ledger Summary Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-gray-200 border-b border-gray-300">
            <div className="bg-orange-50 p-4">
              <div className="text-xs text-orange-700 font-bold uppercase tracking-wide">Total Debited (Freight Memos)</div>
              <div className="text-xl font-bold text-orange-900 mt-0.5 font-mono">{formatCurrency(totals.debit)}</div>
            </div>
            <div className="bg-green-50 p-4">
              <div className="text-xs text-green-700 font-bold uppercase tracking-wide">Total Credited (Payments Made)</div>
              <div className="text-xl font-bold text-green-900 mt-0.5 font-mono">{formatCurrency(totals.credit)}</div>
            </div>
            <div className={`p-4 ${finalBalance >= 0 ? 'bg-red-50' : 'bg-green-50'}`}>
              <div className={`text-xs font-bold uppercase tracking-wide ${finalBalance >= 0 ? 'text-red-700' : 'text-green-700'}`}>
                Net Balance Due
              </div>
              <div className={`text-xl font-bold mt-0.5 font-mono ${finalBalance >= 0 ? 'text-red-900' : 'text-green-900'}`}>
                {formatCurrency(Math.abs(finalBalance))} {finalBalance >= 0 ? 'Dr (Payable)' : 'Cr (Overpaid)'}
              </div>
            </div>
          </div>

          {/* Tally 6-Column Ledger Table */}
          {filteredEntries.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b-2 border-gray-300 text-gray-700 uppercase tracking-wider font-bold">
                    <th className="px-4 py-3 text-left border-r border-gray-300 w-28">DATE</th>
                    <th className="px-4 py-3 text-left border-r border-gray-300">PARTICULARS</th>
                    <th className="px-4 py-3 text-left border-r border-gray-300 w-36">INVOICE NO.</th>
                    <th className="px-4 py-3 text-right border-r border-gray-300 w-36">CREDIT (₹)</th>
                    <th className="px-4 py-3 text-right border-r border-gray-300 w-36">DEBIT (₹)</th>
                    <th className="px-4 py-3 text-right w-40">BALANCE (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 font-mono">
                  {filteredEntries.map((entry, index) => {
                    const isBalDr = entry.runningBalance >= 0;
                    return (
                      <tr key={entry.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                        {/* 1. Date */}
                        <td className="px-4 py-3 text-gray-800 border-r border-gray-200 whitespace-nowrap align-top font-semibold">
                          {new Date(entry.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>

                        {/* 2. Particulars */}
                        <td className="px-4 py-3 border-r border-gray-200 align-top font-sans">
                          {entry.particulars.map((line, lIdx) => (
                            <div
                              key={lIdx}
                              className={lIdx === 0 ? "text-gray-900 font-bold text-xs" : "text-gray-600 text-[11px] font-mono mt-0.5"}
                            >
                              {line}
                            </div>
                          ))}
                        </td>

                        {/* 3. Invoice No. / Memo No. */}
                        <td className="px-4 py-3 border-r border-gray-200 align-top font-mono">
                          {entry.memoNo ? (
                            <button
                              onClick={() => handleMemoClick(entry.memoNo)}
                              className="text-orange-700 hover:text-orange-900 hover:underline font-bold transition-colors"
                              title="Click to view Freight Memo"
                            >
                              {entry.memoNo}
                            </button>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>

                        {/* 4. Credit (Payments Paid) */}
                        <td className="px-4 py-3 text-right border-r border-gray-200 align-top font-bold text-green-700">
                          {entry.credit > 0 ? formatCurrency(entry.credit) : <span className="text-gray-300 font-normal">—</span>}
                        </td>

                        {/* 5. Debit (Freight Memo Payable Amount) */}
                        <td className="px-4 py-3 text-right border-r border-gray-200 align-top font-bold text-gray-900">
                          {entry.debit > 0 ? formatCurrency(entry.debit) : <span className="text-gray-300 font-normal">—</span>}
                        </td>

                        {/* 6. Balance */}
                        <td className={`px-4 py-3 text-right align-top font-bold ${isBalDr ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(Math.abs(entry.runningBalance))}
                          <span className="ml-1 text-[10px] font-semibold">{isBalDr ? 'Dr' : 'Cr'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Tally Totals Footer */}
                <tfoot>
                  <tr className="bg-gray-800 text-white font-mono border-t-2 border-gray-600">
                    <td colSpan={3} className="px-4 py-3 font-bold text-xs uppercase border-r border-gray-600 tracking-wider">
                      TOTAL
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-xs text-green-400 border-r border-gray-600">
                      {formatCurrency(totals.credit)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-xs text-white border-r border-gray-600">
                      {formatCurrency(totals.debit)}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold text-xs ${finalBalance >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {formatCurrency(Math.abs(finalBalance))} {finalBalance >= 0 ? 'Dr' : 'Cr'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <Truck className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No transactions found for the selected filter criteria.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Truck className="w-16 h-16 text-gray-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900 mb-1">Select a Supplier</h3>
          <p className="text-gray-500 text-xs">Choose a supplier from the dropdown filter above to open their Tally-style ledger.</p>
        </div>
      )}

      {/* Debit Note Modal */}
      {showDebitNoteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">Create Supplier Debit Note for {supplierFilter}</h3>
              <button onClick={() => setShowDebitNoteModal(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  value={debitNoteForm.amount || ''}
                  onChange={(e) => setDebitNoteForm(prev => ({ ...prev, amount: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
                  placeholder="Enter amount"
                  min="0"
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  value={debitNoteForm.date}
                  onChange={(e) => setDebitNoteForm(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Narration / Reason *
                </label>
                <textarea
                  value={debitNoteForm.narration}
                  onChange={(e) => setDebitNoteForm(prev => ({ ...prev, narration: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
                  placeholder="Enter reason for debit note (e.g., Quality issues, Delivery delay, etc.)"
                  rows={3}
                />
              </div>

              <div className="flex space-x-3 pt-3">
                <button
                  onClick={handleCreateDebitNote}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-semibold transition-colors"
                >
                  Create Debit Note
                </button>
                <button
                  onClick={() => setShowDebitNoteModal(false)}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierLedger;
