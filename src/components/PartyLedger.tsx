import React, { useState, useMemo, useEffect } from 'react';
import { Filter, Download, FileText, Table, FileDown, Plus, MessageCircle } from 'lucide-react';
import { useDataStore } from '../lib/store';
import { formatCurrency } from '../utils/numberGenerator';
import { apiService } from '../lib/api';

interface PartyLedgerEntry {
  id: string;
  date: string;
  particulars: string[];
  invoiceNo: string;
  debit: number;
  credit: number;
  runningBalance: number;
  entryType: 'invoice' | 'payment_bank' | 'payment_cash' | 'debit_note' | 'opening_balance';
  remarks?: string;
  // Breakdown fields preserved for exports
  billAmount?: number;
  detention?: number;
  extra?: number;
  rto?: number;
  tds?: number;
  mamool?: number;
  commission?: number;
  penalties?: number;
}

interface PartyLedgerProps {
  selectedParty?: string;
  onNavigate?: (page: string, params?: any) => void;
}

const PartyLedger: React.FC<PartyLedgerProps> = ({ selectedParty, onNavigate }) => {
  const { bills, bankingEntries, cashbookEntries, loadingSlips, parties: masterParties } = useDataStore();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [partyFilter, setPartyFilter] = useState(selectedParty || '');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<'all' | 'invoice' | 'bank' | 'cash'>('all');
  const [showDebitNoteModal, setShowDebitNoteModal] = useState(false);
  const [debitNoteForm, setDebitNoteForm] = useState({
    amount: 0,
    narration: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Sync selectedParty prop
  useEffect(() => {
    if (selectedParty) {
      setPartyFilter(selectedParty);
    }
  }, [selectedParty]);

  // Navigate to Bills page
  const handleBillClick = (billNumber: string) => {
    if (onNavigate) {
      onNavigate('bills', { highlight: billNumber });
    }
  };

  // Get unique parties from bills and master parties list
  const parties = useMemo(() => {
    const partySet = new Set<string>();
    (masterParties || []).forEach(p => {
      const name = typeof p === 'string' ? p : p?.name;
      if (name) partySet.add(name);
    });
    (bills || []).forEach(bill => {
      if (bill.party) partySet.add(bill.party);
    });
    return Array.from(partySet).sort();
  }, [bills, masterParties]);

  // Find party master info (for GSTIN, contact)
  const partyMaster = useMemo(() => {
    if (!partyFilter) return null;
    const lower = partyFilter.trim().toLowerCase();
    return (masterParties || []).find(p => (p.name || '').trim().toLowerCase() === lower) || null;
  }, [partyFilter, masterParties]);

  // Calculate total outstanding across all parties
  const totalOutstanding = useMemo(() => {
    let grandTotal = 0;

    parties.forEach(party => {
      const partyLower = party.trim().toLowerCase();
      const pBills = bills.filter(b => b.party && b.party.trim().toLowerCase() === partyLower);

      let running = 0;
      pBills.forEach(b => {
        const gross = b.total_invoice_value || b.gross_amount || b.total_amount || b.bill_amount || 0;
        running += gross;
      });

      const pBanking = bankingEntries.filter(e =>
        (e.reference_name && e.reference_name.trim().toLowerCase() === partyLower) ||
        (pBills.some(b => b.bill_number === e.reference_id))
      );

      pBanking.forEach(e => {
        if (e.category === 'bill_payment' || e.category === 'bill_advance' || e.category === 'party_on_account') {
          running -= e.amount;
        } else if (e.category === 'party_debit_note') {
          running += e.amount;
        }
      });

      const pCashbook = (cashbookEntries || []).filter(e =>
        (e.reference_name && e.reference_name.trim().toLowerCase() === partyLower) ||
        (pBills.some(b => b.bill_number === e.reference_id))
      );

      pCashbook.forEach(e => {
        if (e.category === 'bill_payment' || e.category === 'bill_advance' || e.category === 'party_on_account' || e.category === 'party_commission') {
          running -= e.amount;
        }
      });

      if (running > 0) {
        grandTotal += running;
      }
    });

    return grandTotal;
  }, [parties, bills, bankingEntries, cashbookEntries]);

  // Generate Tally-style ledger entries for selected party
  const partyLedgerEntries = useMemo((): PartyLedgerEntry[] => {
    if (!partyFilter) return [];

    const partyLower = partyFilter.trim().toLowerCase();
    const entries: PartyLedgerEntry[] = [];
    let runningBalance = 0;

    // Get all bills for this party
    const partyBills = bills
      .filter(b => b.party && b.party.trim().toLowerCase() === partyLower)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Get all banking entries for this party
    const partyBanking = bankingEntries
      .filter(entry => {
        if (entry.reference_name && entry.reference_name.trim().toLowerCase() === partyLower) return true;
        if ((entry.category === 'bill_payment' || entry.category === 'bill_advance') && partyBills.some(b => b.bill_number === entry.reference_id)) return true;
        return false;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Get all cashbook entries for this party
    const partyCashbook = (cashbookEntries || [])
      .filter(entry => {
        if (entry.reference_name && entry.reference_name.trim().toLowerCase() === partyLower) return true;
        if ((entry.category === 'bill_payment' || entry.category === 'bill_advance') && partyBills.some(b => b.bill_number === entry.reference_id)) return true;
        return false;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Timeline event type
    type TimelineItem = {
      type: 'bill' | 'bank_payment' | 'cash_payment' | 'debit_note';
      date: string;
      data: any;
    };

    const timeline: TimelineItem[] = [];

    // 1. Add Bills
    partyBills.forEach(bill => {
      timeline.push({ type: 'bill', date: bill.date, data: bill });
    });

    // 2. Add Banking entries
    partyBanking.forEach(entry => {
      if (entry.category === 'party_debit_note') {
        timeline.push({ type: 'debit_note', date: entry.date, data: entry });
      } else {
        timeline.push({ type: 'bank_payment', date: entry.date, data: entry });
      }
    });

    // 3. Add Cashbook entries
    partyCashbook.forEach(entry => {
      timeline.push({ type: 'cash_payment', date: entry.date, data: entry });
    });

    // Sort timeline chronologically by date
    timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Build ledger entries row by row
    timeline.forEach((item, idx) => {
      if (item.type === 'bill') {
        const bill = item.data;
        // Full Gross Invoice Amount without deductions
        const grossAmount = bill.total_invoice_value || bill.gross_amount || bill.total_amount || bill.bill_amount || 0;
        const debit = grossAmount;
        const credit = 0;
        runningBalance += debit;

        // Build route / vehicle details for Particulars column
        const particularsLines: string[] = [];

        // Check for multiple LRs in bill
        let linkedSlips: typeof loadingSlips = [];
        if (bill.loading_slip_ids && Array.isArray(bill.loading_slip_ids) && bill.loading_slip_ids.length > 0) {
          linkedSlips = bill.loading_slip_ids
            .map((id: string) => loadingSlips.find(s => s.id === id || (s as any)._id === id))
            .filter(Boolean) as typeof loadingSlips;
        } else if (bill.loading_slip_id) {
          const lsId = typeof bill.loading_slip_id === 'object' ? (bill.loading_slip_id as any)._id || (bill.loading_slip_id as any).id : bill.loading_slip_id;
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
          if (bill.from_location || bill.to_location) {
            particularsLines.push(`${bill.from_location || ''} → ${bill.to_location || ''}`);
          }
          if (bill.vehicle_no) {
            particularsLines.push(`${bill.vehicle_no}`);
          }
          if (particularsLines.length === 0) {
            particularsLines.push(`Invoice ${bill.bill_number}`);
          }
        }

        entries.push({
          id: bill.id || (bill as any)._id || `party-bill-${idx}`,
          date: bill.date,
          particulars: particularsLines,
          invoiceNo: bill.bill_number,
          debit,
          credit: 0,
          runningBalance,
          entryType: 'invoice',
          remarks: bill.narration || '',
          billAmount: bill.bill_amount,
          detention: bill.detention,
          extra: bill.extra,
          rto: bill.rto,
          tds: bill.tds,
          mamool: bill.mamool,
          commission: bill.commission,
          penalties: bill.penalties
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
          id: entry.id || (entry as any)._id || `party-bank-${idx}`,
          date: entry.date,
          particulars: particularsLines,
          invoiceNo: entry.reference_id || '',
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
          id: entry.id || (entry as any)._id || `party-cash-${idx}`,
          date: entry.date,
          particulars: particularsLines,
          invoiceNo: entry.reference_id || '',
          debit: 0,
          credit,
          runningBalance,
          entryType: 'payment_cash',
          remarks: entry.narration || 'Cash Payment'
        });
      } else if (item.type === 'debit_note') {
        const entry = item.data;
        const debit = entry.amount;
        const credit = 0;
        runningBalance += debit;

        entries.push({
          id: entry.id || (entry as any)._id || `party-dn-${idx}`,
          date: entry.date,
          particulars: ['DEBIT NOTE', entry.narration || 'Adjustment'],
          invoiceNo: '',
          debit,
          credit: 0,
          runningBalance,
          entryType: 'debit_note',
          remarks: entry.narration || 'Debit Note'
        });
      }
    });

    return entries;
  }, [partyFilter, bills, bankingEntries, cashbookEntries, loadingSlips]);

  // Filter entries by date range & transaction type
  const filteredEntries = useMemo(() => {
    let filtered = partyLedgerEntries;

    if (dateFrom) {
      filtered = filtered.filter(entry => entry.date >= dateFrom);
    }

    if (dateTo) {
      filtered = filtered.filter(entry => entry.date <= dateTo);
    }

    if (transactionTypeFilter === 'invoice') {
      filtered = filtered.filter(entry => entry.entryType === 'invoice');
    } else if (transactionTypeFilter === 'bank') {
      filtered = filtered.filter(entry => entry.entryType === 'payment_bank');
    } else if (transactionTypeFilter === 'cash') {
      filtered = filtered.filter(entry => entry.entryType === 'payment_cash');
    }

    return filtered;
  }, [partyLedgerEntries, dateFrom, dateTo, transactionTypeFilter]);

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
    if (!partyFilter) {
      alert('Please select a party first');
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
        party_name: partyFilter,
        amount: debitNoteForm.amount,
        date: debitNoteForm.date,
        narration: debitNoteForm.narration
      };

      await apiService.createPartyDebitNote(debitNoteData);

      setDebitNoteForm({
        amount: 0,
        narration: '',
        date: new Date().toISOString().split('T')[0]
      });
      setShowDebitNoteModal(false);

      alert(`Debit note of ₹${debitNoteForm.amount.toLocaleString('en-IN')} created successfully for ${partyFilter}`);
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
      const invoiceStr = `"${entry.invoiceNo || ''}"`;
      const creditStr = entry.credit > 0 ? entry.credit.toString() : '';
      const debitStr = entry.debit > 0 ? entry.debit.toString() : '';
      const balStr = `"${formatCurrency(Math.abs(entry.runningBalance))} ${entry.runningBalance >= 0 ? 'Dr' : 'Cr'}"`;

      csvRows.push([dateStr, particularsStr, invoiceStr, creditStr, debitStr, balStr].join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `party-ledger-${partyFilter}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // PDF Export
  const exportToPDF = async () => {
    if (!filteredEntries.length || !partyFilter) {
      alert('Please select a party and ensure there are entries to export.');
      return;
    }

    try {
      const { generateProfessionalLedgerPDF, testLibraries } = await import('../utils/simpleProfessionalLedgerPdf');
      const librariesWork = testLibraries();
      if (!librariesWork) {
        throw new Error('Required libraries (jsPDF, XLSX) are not working properly');
      }

      await generateProfessionalLedgerPDF({
        type: 'PARTY',
        name: partyFilter,
        entries: filteredEntries as any,
        totals: {
          credit: totals.credit,
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
    if (!filteredEntries.length || !partyFilter) {
      alert('Please select a party and ensure there are entries to export.');
      return;
    }

    try {
      const { exportLedgerToExcel, testLibraries } = await import('../utils/simpleProfessionalLedgerPdf');
      const librariesWork = testLibraries();
      if (!librariesWork) {
        throw new Error('Required libraries (jsPDF, XLSX) are not working properly');
      }

      await exportLedgerToExcel({
        type: 'PARTY',
        name: partyFilter,
        entries: filteredEntries as any,
        totals: {
          credit: totals.credit,
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
    if (!partyFilter || !filteredEntries.length) return;

    const startDate = dateFrom ? new Date(dateFrom).toLocaleDateString('en-IN') : 'Start';
    const endDate = dateTo ? new Date(dateTo).toLocaleDateString('en-IN') : 'Present';

    const message = `*Party Ledger Statement*\n` +
      `Party: *${partyFilter}*\n` +
      `Period: ${startDate} to ${endDate}\n\n` +
      `*Summary:*\n` +
      `Total Debit (Billed): ${formatCurrency(totals.debit)}\n` +
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
          <h1 className="text-2xl font-bold text-gray-900">Party Ledger</h1>
          <p className="text-gray-600 text-sm">Tally-style customer account statement and payment tracking</p>
        </div>

        {partyFilter && (
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
              Select Party *
            </label>
            <select
              value={partyFilter}
              onChange={(e) => setPartyFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- Choose Party --</option>
              {parties.map(p => (
                <option key={p} value={p}>{p}</option>
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Transaction Type
            </label>
            <select
              value={transactionTypeFilter}
              onChange={(e) => setTransactionTypeFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Transactions</option>
              <option value="invoice">Invoices Only</option>
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

      {/* Global Outstanding Banner (when no party filter selected) */}
      {!partyFilter && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 p-6 rounded-xl shadow-sm border border-red-200 flex items-center justify-between">
          <div>
            <div className="text-xs text-red-600 font-bold uppercase tracking-wider">Total Receivable (Across All Parties)</div>
            <div className="text-3xl font-bold text-red-900 mt-1 font-mono">{formatCurrency(totalOutstanding)}</div>
            <div className="text-xs text-red-500 mt-1">Select a party from the dropdown above to view their detailed Tally ledger</div>
          </div>
          <FileText className="w-12 h-12 text-red-400 opacity-60" />
        </div>
      )}

      {/* Tally-Style Ledger Section */}
      {partyFilter ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-300 overflow-hidden">
          {/* Tally Header Bar */}
          <div className="bg-gray-800 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between text-white gap-3 border-b border-gray-700">
            <div>
              <div className="text-xs text-orange-400 font-bold uppercase tracking-widest">PARTY LEDGER</div>
              <h2 className="text-xl font-bold text-white mt-0.5">{partyFilter}</h2>
              <div className="text-xs text-gray-300 mt-1 flex flex-wrap gap-4">
                <span><strong className="text-gray-400">GSTIN:</strong> {partyMaster?.gstin || (partyMaster as any)?.gst_number || 'N/A'}</span>
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
            <div className="bg-blue-50 p-4">
              <div className="text-xs text-blue-700 font-bold uppercase tracking-wide">Total Debited (Full Invoices)</div>
              <div className="text-xl font-bold text-blue-900 mt-0.5 font-mono">{formatCurrency(totals.debit)}</div>
            </div>
            <div className="bg-green-50 p-4">
              <div className="text-xs text-green-700 font-bold uppercase tracking-wide">Total Credited (Payments Received)</div>
              <div className="text-xl font-bold text-green-900 mt-0.5 font-mono">{formatCurrency(totals.credit)}</div>
            </div>
            <div className={`p-4 ${finalBalance >= 0 ? 'bg-red-50' : 'bg-green-50'}`}>
              <div className={`text-xs font-bold uppercase tracking-wide ${finalBalance >= 0 ? 'text-red-700' : 'text-green-700'}`}>
                Net Balance Due
              </div>
              <div className={`text-xl font-bold mt-0.5 font-mono ${finalBalance >= 0 ? 'text-red-900' : 'text-green-900'}`}>
                {formatCurrency(Math.abs(finalBalance))} {finalBalance >= 0 ? 'Dr (Receivable)' : 'Cr (Overpaid)'}
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

                        {/* 3. Invoice No. */}
                        <td className="px-4 py-3 border-r border-gray-200 align-top font-mono">
                          {entry.invoiceNo ? (
                            <button
                              onClick={() => handleBillClick(entry.invoiceNo)}
                              className="text-blue-600 hover:text-blue-800 hover:underline font-bold transition-colors"
                              title="Click to view Invoice"
                            >
                              {entry.invoiceNo}
                            </button>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>

                        {/* 4. Credit (Payment Received) */}
                        <td className="px-4 py-3 text-right border-r border-gray-200 align-top font-bold text-green-700">
                          {entry.credit > 0 ? formatCurrency(entry.credit) : <span className="text-gray-300 font-normal">—</span>}
                        </td>

                        {/* 5. Debit (Full Gross Invoice Amount) */}
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
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No transactions found for the selected filter criteria.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900 mb-1">Select a Party</h3>
          <p className="text-gray-500 text-xs">Choose a party from the dropdown filter above to open their Tally-style ledger.</p>
        </div>
      )}

      {/* Debit Note Modal */}
      {showDebitNoteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">Create Party Debit Note for {partyFilter}</h3>
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
                  placeholder="Enter reason for debit note (e.g. Shortage, Damage, Penalty)"
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

export default PartyLedger;
