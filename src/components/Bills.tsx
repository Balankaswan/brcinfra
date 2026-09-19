import React, { useState, useMemo, useEffect } from 'react';
import { Plus, FileText, Edit, Download, Eye, Trash2, FileSearch, X } from 'lucide-react';
import { formatCurrency } from '../utils/numberGenerator';
import { getNextSequenceNumber } from '../utils/sequenceGenerator';
import BillForm from './forms/BillForm';
import PDFPreviewModal from './PDFPreviewModal';
import MonthFilterDropdown from './MonthFilterDropdown';
import { useDataStore } from '../lib/store';
import { apiService } from '../lib/api';
import type { Bill } from '../types';

interface BillsListProps {
  showOnlyFullyReceived?: boolean;
  highlightBill?: string;
  createForSlip?: any;
}

const BillsComponent: React.FC<BillsListProps> = ({ showOnlyFullyReceived = false, highlightBill, createForSlip }) => {
  const { bills, addBill, updateBill, deleteBill, bankingEntries, cashbookEntries, loadingSlips, updateLoadingSlip, markBillAsReceived } = useDataStore();
  const [showForm, setShowForm] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [viewBill, setViewBill] = useState<Bill | null>(null);
  const [previewBill, setPreviewBill] = useState<Bill | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showReceivedModal, setShowReceivedModal] = useState<Bill | null>(null);
  const [receivedDate, setReceivedDate] = useState('');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'pending' | 'received'>('pending');
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  // Auto-scroll to highlighted bill
  useEffect(() => {
    if (highlightBill) {
      const timer = setTimeout(() => {
        const element = document.getElementById(`bill-${highlightBill}`);
        if (element) {
          element.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
        }
      }, 100); // Small delay to ensure DOM is rendered
      return () => clearTimeout(timer);
    }
  }, [highlightBill]);

  const handleCreateBill = async (billData: Omit<Bill, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const response = await apiService.createBill(billData);
      addBill(response.bill);
      console.log('✅ Bill created successfully:', response.bill);
      
      // Update ALL linked loading slips with the new bill reference
      const slipIds = billData.loading_slip_ids && billData.loading_slip_ids.length > 0
        ? billData.loading_slip_ids
        : (billData.loading_slip_id ? [billData.loading_slip_id] : []);
      await Promise.all(slipIds.map(async (id) => {
        const slip = loadingSlips.find(s => s.id === id);
        if (slip) {
          const updatedSlip = { ...slip, bill_number: response.bill.bill_number, bill_id: response.bill.id };
          try {
            await apiService.updateLoadingSlip(id, updatedSlip);
          } catch (e) {
            console.warn('Could not sync bill tag to LR on server, updating locally:', e);
          }
          updateLoadingSlip(updatedSlip);
        }
      }));

      // Reset form state immediately
      setShowForm(false);
      setEditingBill(null);
    } catch (error) {
      console.error('❌ Failed to create bill:', error);
      // Fallback to local storage
      const newBill: Bill = {
        ...billData,
        id: Date.now().toString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      addBill(newBill);
      console.log('⚠️ Bill created locally only:', newBill);
      
      // Reset form state even on error
      setShowForm(false);
      setEditingBill(null);
    }
  };


  const getNextBillNumber = () => {
    // Format: AHD/2026-27/N
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const fyStart = month >= 4 ? year : year - 1;
    const fyEnd = fyStart + 1;
    const fy = `${fyStart}-${String(fyEnd).slice(-2)}`;
    const prefix = `AHD/${fy}/`;

    // Find highest number for current FY
    const highest = bills.reduce((max, b) => {
      if (b.bill_number && b.bill_number.startsWith(prefix)) {
        const n = parseInt(b.bill_number.slice(prefix.length), 10);
        if (!isNaN(n) && n > max) return n;
      }
      return max;
    }, 0);
    return `${prefix}${highest + 1}`;
  };

  const handleUpdateBill = async (billData: Omit<Bill, 'id' | 'created_at' | 'updated_at'>) => {
    if (editingBill) {
      try {
        const response = await apiService.updateBill(editingBill.id, billData);
        updateBill(response.bill);
        console.log('✅ Bill updated successfully:', response.bill);
        
        // Reset form state immediately
        setShowForm(false);
        setEditingBill(null);
      } catch (error) {
        console.error('❌ Failed to update bill:', error);
        const updatedBill: Bill = {
          ...billData,
          id: editingBill.id,
          created_at: editingBill.created_at,
          updated_at: new Date().toISOString(),
        };
        updateBill(updatedBill);
        console.log('⚠️ Bill updated locally only:', updatedBill);
        
        // Reset form state even on error
        setShowForm(false);
        setEditingBill(null);
      }
    }
  };

  const handleDownloadPDF = async (bill: Bill) => {
    try {
      // Get advance payments from banking entries for this bill
      const advancePayments = bankingEntries
        .filter(e => e.category === 'bill_advance' && e.reference_id === bill.bill_number)
        .map(e => ({
          id: e.id || e._id || `advance-${Date.now()}-${Math.random()}`,
          bill_id: bill.id,
          date: e.date,
          amount: e.amount,
          mode: (e.payment_mode as 'cash' | 'bank' | 'other') || 'bank',
          reference: e.narration || e.reference_id
        }));

      const enhancedBill = { ...bill, advance_payments: advancePayments };
      const { generateBillPDF } = await import('../utils/pdfGenerator');

      // ── Multi-LR: collect all linked slips ──
      const allLinkedSlips = resolveLinkedSlips(bill);

      if (allLinkedSlips.length > 0) {
        await generateBillPDF(enhancedBill, allLinkedSlips.length === 1 ? allLinkedSlips[0] : allLinkedSlips, bankingEntries, cashbookEntries);

        // Update is_downloaded status
        if (!bill.is_downloaded) {
          const updatedBillData = { ...bill, is_downloaded: true };
          try {
            await apiService.updateBill(bill.id, updatedBillData);
            updateBill(updatedBillData);
          } catch (e) {
            console.error('Failed to update download status', e);
          }
        }
      } else {
        console.error('No linked loading slips found for bill:', bill.id);
        alert('Related loading slip not found. Cannot generate PDF.');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };
  // ── Helper: resolve all loading slips linked to a bill ──
  const resolveLinkedSlips = (bill: Bill) => {
    // Multi-LR case: use loading_slip_ids array
    if (bill.loading_slip_ids && bill.loading_slip_ids.length > 0) {
      const resolved = bill.loading_slip_ids
        .map(id => loadingSlips.find(ls => ls.id === id || (ls as any)._id === id))
        .filter(Boolean) as typeof loadingSlips;
      if (resolved.length > 0) return resolved;
    }
    // Single-LR fallback
    if (typeof bill.loading_slip_id === 'object' && bill.loading_slip_id !== null) {
      return [bill.loading_slip_id as unknown as typeof loadingSlips[0]];
    }
    const single = loadingSlips.find(ls => ls.id === bill.loading_slip_id || (ls as any)._id === bill.loading_slip_id);
    return single ? [single] : [];
  };

  const handlePreviewPDF = async (bill: Bill) => {
    setPreviewLoading(true);
    setPreviewBill(bill);
    try {
      const advancePayments = bankingEntries
        .filter(e => e.category === 'bill_advance' && e.reference_id === bill.bill_number)
        .map(e => ({
          id: e.id || e._id || `advance-${Date.now()}-${Math.random()}`,
          bill_id: bill.id,
          date: e.date,
          amount: e.amount,
          mode: (e.payment_mode as 'cash' | 'bank' | 'other') || 'bank',
          reference: e.narration || e.reference_id
        }));
      const enhancedBill = { ...bill, advance_payments: advancePayments };
      const { generateBillPDF } = await import('../utils/pdfGenerator');

      // ── Multi-LR: collect all linked slips ──
      const allLinkedSlips = resolveLinkedSlips(bill);

      if (allLinkedSlips.length > 0) {
        const blobUrl = await generateBillPDF(
          enhancedBill,
          allLinkedSlips.length === 1 ? allLinkedSlips[0] : allLinkedSlips,
          bankingEntries,
          cashbookEntries,
          { preview: true }
        );
        if (blobUrl) setPreviewBlobUrl(blobUrl as string);
      } else {
        alert('Related loading slip not found. Cannot generate preview.');
        setPreviewBill(null);
      }
    } catch (error) {
      console.error('Error generating PDF preview:', error);
      alert('Error generating PDF preview. Please try again.');
      setPreviewBill(null);
    } finally {
      setPreviewLoading(false);
    }
  };


  const handleMarkAsReceived = (bill: Bill) => {
    setShowReceivedModal(bill);
    setReceivedDate(new Date().toISOString().split('T')[0]);
  };

  const confirmMarkAsReceived = async () => {
    if (showReceivedModal && receivedDate) {
      try {
        // Only update bill status to received - no banking entry creation
        const updatedBillData = {
          ...showReceivedModal,
          status: 'received',
          received_date: receivedDate,
          received_amount: showReceivedModal.bill_amount
        };
        
        await apiService.updateBill(showReceivedModal.id, updatedBillData);
        markBillAsReceived(showReceivedModal.id, receivedDate, showReceivedModal.bill_amount);
        
        console.log('Bill marked as received successfully (no banking entry created)');
      } catch (error) {
        console.error('Failed to mark bill as received:', error);
        // Fallback to local update only
        markBillAsReceived(showReceivedModal.id, receivedDate, showReceivedModal.bill_amount);
      }
      setShowReceivedModal(null);
      setReceivedDate('');
    }
  };

  const handleDeleteBill = async (bill: Bill) => {
    if (window.confirm(`Are you sure you want to delete Bill #${bill.bill_number}?`)) {
      const targetId = (bill as any)._id || bill.id || bill.bill_number;
      try {
        console.log('Deleting bill with ID:', targetId);
        await apiService.deleteBill(targetId);
        deleteBill(targetId);
        console.log('Bill deleted successfully');
      } catch (error) {
        console.error('Failed to delete bill:', error);
        deleteBill(targetId); // Fallback to local deletion
      }
    }
  };

  const filteredBills = useMemo(() => {
    // If month filter is active → show ALL bills (pending + received) for those months
    const monthFilterActive = selectedMonths.length > 0;

    let base: Bill[];
    if (monthFilterActive) {
      base = bills.filter((b: any) => {
        const billMonth = b.date ? b.date.substring(0, 7) : '';
        return selectedMonths.includes(billMonth);
      });
    } else {
      // Original tab behavior
      const showReceived = showOnlyFullyReceived || viewMode === 'received';
      base = showReceived ? bills.filter((b: any) => b.status === 'received') : bills.filter((b: any) => b.status !== 'received');
    }

    // Sort bills by document number (numeric part) in descending order, then by date
    base = [...base].sort((a, b) => {
      const getNumericPart = (billNumber: string) => {
        const match = billNumber.match(/(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      };
      const aNum = getNumericPart(a.bill_number);
      const bNum = getNumericPart(b.bill_number);
      if (aNum !== bNum) return bNum - aNum;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    // Optional strict settlement check (only when not using month filter)
    if (!monthFilterActive && showOnlyFullyReceived) {
      base = base.filter(b => {
        const bankingReceived = bankingEntries
          .filter(e => (e.category === 'bill_advance' || e.category === 'bill_payment') && e.reference_id === b.bill_number)
          .reduce((sum, e) => sum + e.amount, 0);
        const cashbookReceived = (cashbookEntries || [])
          .filter(e => (e.category === 'bill_advance' || e.category === 'bill_payment') && e.reference_id === b.bill_number)
          .reduce((sum, e) => sum + e.amount, 0);
        const totalReceived = bankingReceived + cashbookReceived;
        return totalReceived >= b.net_amount && b.net_amount > 0;
      });
    }

    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(b => {
      const ls = typeof b.loading_slip_id === 'object' && b.loading_slip_id !== null
        ? b.loading_slip_id
        : loadingSlips.find(ls => ls.id === b.loading_slip_id);
      const haystack = [
        b.bill_number,
        b.party,
        new Date(b.date).toLocaleDateString('en-IN'),
        String(b.bill_amount),
        String(b.net_amount),
        ls?.vehicle_no || '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [bills, bankingEntries, cashbookEntries, showOnlyFullyReceived, viewMode, search, loadingSlips, selectedMonths]);

  const monthFilterActive = selectedMonths.length > 0;
  const { parties } = useDataStore();
  const [showSelectorModal, setShowSelectorModal] = useState(false);
  const [createMode, setCreateMode] = useState<'lr' | 'manual'>('lr');
  const [selectedParty, setSelectedParty] = useState('');
  const [selectedLrIds, setSelectedLrIds] = useState<string[]>([]);
  const [slipsForForm, setSlipsForForm] = useState<any[]>([]);

  // Unique billing parties from parties master & loading slips
  const uniqueBillingParties = useMemo(() => {
    const set = new Set<string>();
    (parties || []).forEach(p => { if (p.name) set.add(p.name); });
    (loadingSlips || []).forEach(ls => {
      if (ls.consignor_name) set.add(ls.consignor_name);
      if (ls.party) set.add(ls.party);
    });
    return Array.from(set).sort();
  }, [parties, loadingSlips]);

  // Eligible unbilled LRs for the selected Party
  const eligibleLrsForParty = useMemo(() => {
    if (!selectedParty) return [];
    return loadingSlips.filter(ls => {
      const partyMatch = (ls.consignor_name && ls.consignor_name.toLowerCase() === selectedParty.toLowerCase()) ||
                         (ls.party && ls.party.toLowerCase() === selectedParty.toLowerCase());
      // Billed iff an active bill references this loading slip
      const isBilled = bills.some(b =>
        b.loading_slip_id === ls.id ||
        (b as any).loading_slip_id === (ls as any)._id ||
        (b.loading_slip_ids && (b.loading_slip_ids.includes(ls.id) || b.loading_slip_ids.includes((ls as any)._id))) ||
        (ls.bill_number && b.bill_number === ls.bill_number)
      );
      return partyMatch && !isBilled;
    });
  }, [selectedParty, loadingSlips, bills]);

  useEffect(() => {
    if (createForSlip) {
      const partyName = createForSlip.consignor_name || createForSlip.party || '';
      setCreateMode('lr');
      setSelectedParty(partyName);
      setSelectedLrIds([createForSlip.id]);
      setShowSelectorModal(true);
    }
  }, [createForSlip]);

  const handleStartCreateBill = () => {
    setCreateMode('lr');
    setSelectedParty('');
    setSelectedLrIds([]);
    setSlipsForForm([]);
    setShowSelectorModal(true);
  };

  const toggleSelectLr = (id: string) => {
    setSelectedLrIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleProceedToBillForm = () => {
    const chosenSlips = loadingSlips.filter(ls => selectedLrIds.includes(ls.id));
    setSlipsForForm(chosenSlips);
    setShowSelectorModal(false);
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-gray-900">Bills</h1>
          {/* Month filter active badge */}
          {monthFilterActive && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
              All bills • {selectedMonths.length} month{selectedMonths.length > 1 ? 's' : ''} selected
              <button onClick={() => setSelectedMonths([])} className="hover:text-blue-900">
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <MonthFilterDropdown selectedMonths={selectedMonths} onChange={setSelectedMonths} />
          <button
            onClick={handleStartCreateBill}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Create Invoice</span>
          </button>
        </div>
      </div>

      {/* Selector Modal: Create Invoice Using LR / Manual */}
      {showSelectorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200 mb-4">
              <h2 className="text-xl font-bold text-gray-900">Create Invoice</h2>
              <button onClick={() => setShowSelectorModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Step 1: Create Invoice Using */}
            <div className="mb-5">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Create Invoice Using:</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input
                    type="radio"
                    name="createMode"
                    value="lr"
                    checked={createMode === 'lr'}
                    onChange={() => setCreateMode('lr')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  LR (Bilty)
                </label>
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input
                    type="radio"
                    name="createMode"
                    value="manual"
                    checked={createMode === 'manual'}
                    onChange={() => setCreateMode('manual')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  Manual
                </label>
              </div>
            </div>

            {createMode === 'manual' ? (
              <div className="pt-4 border-t flex justify-end gap-3">
                <button
                  onClick={() => setShowSelectorModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowSelectorModal(false);
                    setSlipsForForm([]);
                    setShowForm(true);
                  }}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  Proceed to Manual Invoice
                </button>
              </div>
            ) : (
              <>
                {/* Step 2: Select Billing Party */}
                <div className="mb-5">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Select Party *</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    value={selectedParty}
                    onChange={e => {
                      setSelectedParty(e.target.value);
                      setSelectedLrIds([]);
                    }}
                  >
                    <option value="">-- Choose Party --</option>
                    {uniqueBillingParties.map((p, idx) => (
                      <option key={idx} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                {/* Step 3: Eligible LRs List */}
                {selectedParty && (
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Eligible LRs for {selectedParty}</h3>
                      <span className="text-xs bg-blue-100 text-blue-800 font-semibold px-2.5 py-1 rounded-full">
                        Selected LR List: {selectedLrIds.length}
                      </span>
                    </div>

                    {eligibleLrsForParty.length === 0 ? (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-sm text-gray-500">
                        No unbilled LRs found for {selectedParty}.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
                        {eligibleLrsForParty.map((lr) => {
                          const isChecked = selectedLrIds.includes(lr.id);
                          return (
                            <div
                              key={lr.id}
                              onClick={() => toggleSelectLr(lr.id)}
                              className={`p-3 rounded-lg border cursor-pointer transition-colors text-xs ${
                                isChecked ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white border-gray-200 hover:border-blue-300'
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}} // Handled by parent div
                                  className="mt-0.5 text-blue-600 rounded"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="font-bold text-blue-800 text-sm">
                                    LR : {lr.lr_number || lr.slip_number}
                                  </div>
                                  <div className="text-gray-600 mt-0.5">
                                    Date : {lr.date ? new Date(lr.date).toLocaleDateString('en-IN') : ''}
                                  </div>
                                  <div className="text-gray-600">
                                    Vehicle : {lr.vehicle_no || 'N/A'}
                                  </div>
                                  <div className="text-gray-600 truncate">
                                    From : {lr.from_location} | To : {lr.to_location}
                                  </div>
                                  <div className="font-semibold text-gray-900 mt-1">
                                    Freight Amount : {formatCurrency(lr.total_amount || lr.total_freight || lr.freight || 0)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-4 border-t flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-medium">
                    {selectedLrIds.length > 0 ? `${selectedLrIds.length} LR(s) selected` : 'Select at least 1 LR'}
                  </span>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowSelectorModal(false)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={selectedLrIds.length === 0}
                      onClick={handleProceedToBillForm}
                      className={`px-5 py-2 text-white rounded-lg text-sm font-medium transition-colors ${
                        selectedLrIds.length === 0
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      Proceed to Generate Bill/Invoice
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      {!showOnlyFullyReceived && !monthFilterActive && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1">
          <div className="flex space-x-1">
            <button
              onClick={() => setViewMode('pending')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'pending'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Pending ({bills.filter(b => b.status !== 'received').length})
            </button>
            <button
              onClick={() => setViewMode('received')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'received'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Received ({bills.filter(b => b.status === 'received').length})
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <BillForm
          initialData={editingBill}
          selectedSlips={slipsForForm}
          nextBillNumber={getNextBillNumber()}
          onSubmit={editingBill ? handleUpdateBill : handleCreateBill}
          onCancel={() => {
            setShowForm(false);
            setEditingBill(null);
            setSlipsForForm([]);
          }}
        />
      )}

      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search bills by bill number, party name, route, or vehicle..."
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
      </div>

      {/* Bills Cards */}
      {filteredBills.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No bills found</h3>
          <p className="text-gray-500">Create bills from loading slips</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBills.map((bill: Bill, index: number) => {
            // Resolve all linked loading slips (multi-LR aware)
            const linkedSlips = resolveLinkedSlips(bill);
            const primarySlip = linkedSlips[0] ?? null;
            // Calculate received from both banking and cashbook entries
            const bankingReceived = bankingEntries
              .filter(e => (e.category === 'bill_advance' || e.category === 'bill_payment') && e.reference_id === bill.bill_number)
              .reduce((sum, e) => sum + e.amount, 0);

            const cashbookReceived = (cashbookEntries || [])
              .filter(e => (e.category === 'bill_advance' || e.category === 'bill_payment') && e.reference_id === bill.bill_number)
              .reduce((sum, e) => sum + e.amount, 0);

            const received = bankingReceived + cashbookReceived;
            // Calculate net amount: freight - mamool - commission + detention + rto + extra - tds - penalties
            const netAmount = bill.bill_amount - (bill.mamool || 0) - (bill.commission || 0) + (bill.detention || 0) + (bill.rto || 0) + (bill.extra || 0) - (bill.tds || 0) - (bill.penalties || 0);
            const balance = netAmount - received;
            const trips = linkedSlips.length || 1;
            
            const isHighlighted = highlightBill === bill.bill_number;
            
            return (
              <div 
                key={bill.id || `bill-${index}-${bill.bill_number}`} 
                id={`bill-${bill.bill_number}`}
                className={`bg-white rounded-xl shadow-sm border transition-shadow ${
                  isHighlighted 
                    ? 'border-blue-500 ring-2 ring-blue-200 shadow-lg' 
                    : 'border-gray-200 hover:shadow-md'
                }`}>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-2">
                        <h3 className="text-lg font-semibold text-blue-600">
                          Bill #{bill.bill_number}
                        </h3>
                        {bill.is_downloaded && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            Downloaded
                          </span>
                        )}
                        <div className="flex items-center space-x-3 text-sm text-gray-600">
                          <span>Trips: {trips}</span>
                          <span className={`font-medium ${
                            balance > 0 ? 'text-red-600' : balance < 0 ? 'text-green-600' : 'text-gray-600'
                          }`}>
                            Balance: {formatCurrency(Math.abs(balance))}
                          </span>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500 mb-2">
                        {new Date(bill.date).toLocaleDateString('en-IN')} • {bill.party}
                        {(showOnlyFullyReceived || viewMode === 'received') && bill.received_date && (
                          <span className="text-green-600 ml-2">
                            • Received: {new Date(bill.received_date).toLocaleDateString('en-IN')}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        Total Freight: <span className="font-medium">{formatCurrency(netAmount)}</span>
                        <span className="ml-4">Advances: {received > 0 ? formatCurrency(received) : '0'}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handlePreviewPDF(bill)}
                        className="p-2 text-purple-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Preview PDF"
                        disabled={previewLoading}
                      >
                        <FileSearch className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewBill(bill)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingBill(bill);
                          setShowForm(true);
                        }}
                        className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDownloadPDF(bill)}
                        className="p-2 text-green-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Download PDF"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      {!showOnlyFullyReceived && viewMode === 'pending' && (
                        <button
                          onClick={() => handleMarkAsReceived(bill)}
                          className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition-colors"
                          title="Mark as Received"
                        >
                          Mark as Received
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteBill(bill)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Linked LR / Loading Slip Details */}
                  {linkedSlips.length > 0 && (
                    <div className="bg-blue-50 rounded-lg p-4 mt-4 border border-blue-200">
                      <div className="text-xs text-blue-600 uppercase tracking-wide mb-2 font-medium">
                        Linked LR Details ({linkedSlips.length} LR{linkedSlips.length > 1 ? 's' : ''}):
                      </div>
                      {linkedSlips.length === 1 ? (
                        // Single LR — original detailed view
                        <>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Route</div>
                              <div className="text-sm font-medium text-gray-900">{primarySlip!.from_location} → {primarySlip!.to_location}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Vehicle</div>
                              <div className="text-sm font-medium text-gray-900">{primarySlip!.vehicle_no}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Material</div>
                              <div className="text-sm font-medium text-gray-900">{primarySlip!.material || 'N/A'}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Weight</div>
                              <div className="text-sm font-medium text-gray-900">{primarySlip!.weight} MT</div>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-blue-200 flex justify-between items-center">
                            <div>
                              <div className="text-xs text-gray-500">Supplier</div>
                              <div className="text-sm font-medium text-gray-900">{primarySlip!.supplier}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-gray-500">Bill Amount</div>
                              <div className="text-lg font-bold text-blue-600">{formatCurrency(bill.bill_amount)}</div>
                            </div>
                          </div>
                        </>
                      ) : (
                        // Multi-LR — compact table
                        <>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {linkedSlips.map((ls, idx) => (
                              <div key={idx} className="bg-white rounded border border-blue-100 px-3 py-1.5 text-xs flex items-center gap-4">
                                <span className="font-bold text-blue-800 w-28 shrink-0">
                                  LR: {ls.lr_number || ls.slip_number}
                                </span>
                                <span className="text-gray-600 truncate">{ls.from_location} → {ls.to_location}</span>
                                <span className="text-gray-500 shrink-0">{ls.vehicle_no}</span>
                                <span className="font-semibold text-gray-900 ml-auto shrink-0">
                                  {formatCurrency(ls.total_amount || ls.total_freight || ls.freight || 0)}
                                </span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 pt-3 border-t border-blue-200 flex justify-end">
                            <div className="text-right">
                              <div className="text-xs text-gray-500">Total Bill Amount</div>
                              <div className="text-lg font-bold text-blue-600">{formatCurrency(bill.bill_amount)}</div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewBill && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">Bill #{viewBill.bill_number}</h3>
              <button onClick={() => setViewBill(null)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Date:</span> {new Date(viewBill.date).toLocaleDateString('en-IN')}</div>
              <div><span className="text-gray-500">Party:</span> {viewBill.party}</div>
              <div><span className="text-gray-500">Bill Amount:</span> {formatCurrency(viewBill.bill_amount)}</div>
              <div><span className="text-gray-500">Deductions:</span> {formatCurrency(viewBill.mamool + viewBill.tds + viewBill.penalties)}</div>
              <div className="col-span-2"><span className="text-gray-500">Net Amount:</span> {formatCurrency(viewBill.net_amount)}</div>
              <div className="col-span-2 flex items-center space-x-2">
                <span className="text-gray-500">POD:</span>
                <span className="text-green-600 flex items-center space-x-1"><FileText className="w-4 h-4" /><span>Available</span></span>
              </div>
              {viewBill.narration && (
                <div className="col-span-2">
                  <span className="text-gray-500">Narration:</span>
                  <p className="mt-1 text-gray-900">{viewBill.narration}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t flex justify-end">
              <button onClick={() => setViewBill(null)} className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Mark as Received Modal */}
      {showReceivedModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">Mark Bill as Received</h3>
              <button onClick={() => setShowReceivedModal(null)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  Bill #{showReceivedModal.bill_number} - {showReceivedModal.party}
                </p>
                <p className="text-lg font-semibold text-green-600">
                  Amount: {formatCurrency(showReceivedModal.bill_amount)}
                </p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Received Date
                </label>
                <input
                  type="date"
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end space-x-3">
              <button 
                onClick={() => setShowReceivedModal(null)}
                className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button 
                onClick={confirmMarkAsReceived}
                className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
              >
                Mark as Received
              </button>
            </div>
          </div>
        </div>
      )}
      {/* PDF Preview Modal */}
      {previewBill && previewBlobUrl && (
        <PDFPreviewModal
          blobUrl={previewBlobUrl}
          title={`Bill #${previewBill.bill_number} — ${previewBill.party}`}
          onDownload={() => handleDownloadPDF(previewBill)}
          onClose={() => {
            setPreviewBill(null);
            setPreviewBlobUrl(null);
          }}
        />
      )}
    </div>
  );
};

export default BillsComponent;