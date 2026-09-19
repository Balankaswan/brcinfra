import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Edit, Trash2, FileText, Eye, Download, CheckCircle, FileSearch, X } from 'lucide-react';
import { useDataStore } from '../lib/store';
import { apiService } from '../lib/api';
import { getNextSequenceNumber } from '../utils/sequenceGenerator';
import { formatCurrency } from '../utils/numberGenerator';
import MemoForm from './forms/MemoForm';
import PDFPreviewModal from './PDFPreviewModal';
import MonthFilterDropdown from './MonthFilterDropdown';
import type { Memo } from '../types';

interface MemoListProps {
  showOnlyFullyPaid?: boolean;
  highlightMemo?: string;
  createForSlip?: any;
}

export const isFuelAdvance = (a: any): boolean => {
  if (!a) return false;
  if (typeof a.id === 'string' && a.id.startsWith('fuel-')) return true;
  if (typeof a.description === 'string' && a.description.toLowerCase().includes('fuel')) return true;
  if (typeof a.reference === 'string' && (
    a.reference.toLowerCase().includes('bpcl') ||
    a.reference.toLowerCase().includes('hpcl') ||
    a.reference.toLowerCase().includes('fuel') ||
    a.reference.toLowerCase().includes('wallet')
  )) return true;
  if (typeof a.mode === 'string' && a.mode.toLowerCase() === 'other' && a.reference) return true;
  return false;
};

const MemoComponent: React.FC<MemoListProps> = ({ showOnlyFullyPaid = false, highlightMemo, createForSlip }) => {
  const { memos, addMemo, updateMemo, deleteMemo, bankingEntries, cashbookEntries, markMemoAsPaid, setLedgerEntries, loadingSlips, updateLoadingSlip, vehicles } = useDataStore();
  const [showForm, setShowForm] = useState(false);
  const [editingMemo, setEditingMemo] = useState<Memo | null>(null);
  const [viewMemo, setViewMemo] = useState<Memo | null>(null);
  const [previewMemo, setPreviewMemo] = useState<Memo | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showPaidModal, setShowPaidModal] = useState<Memo | null>(null);
  const [paidDate, setPaidDate] = useState('');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'pending' | 'paid'>('pending');
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  // Auto-scroll to highlighted memo
  useEffect(() => {
    if (highlightMemo) {
      const timer = setTimeout(() => {
        const element = document.getElementById(`memo-${highlightMemo}`);
        if (element) {
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      }, 100); // Small delay to ensure DOM is rendered
      return () => clearTimeout(timer);
    }
  }, [highlightMemo]);

  const handleCreateMemo = async (memoData: Omit<Memo, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const response = await apiService.createMemo(memoData);
      addMemo(response.memo);
      console.log('Memo created and synced to MongoDB:', response.memo);

      // Update linked loading slips
      const slipIds = memoData.loading_slip_ids && memoData.loading_slip_ids.length > 0
        ? memoData.loading_slip_ids
        : (memoData.loading_slip_id ? [memoData.loading_slip_id] : []);
      await Promise.all(slipIds.map(async (id) => {
        const slip = loadingSlips.find(s => s.id === id || (s as any)._id === id);
        if (slip) {
          const updatedSlip = { ...slip, memo_number: response.memo.memo_number, memo_id: response.memo.id };
          try {
            await apiService.updateLoadingSlip(slip.id, updatedSlip);
          } catch (e) {
            console.warn('Could not sync memo tag to LR on server, updating locally:', e);
          }
          updateLoadingSlip(updatedSlip);
        }
      }));

      // Create ledger entries for own vehicles after memo creation
      // CRITICAL FIX: Check both frontend store and backend memo data for loading slip
      let ls = loadingSlips.find(s => s.id === memoData.loading_slip_id || (s as any)._id === memoData.loading_slip_id);

      // If not found in store, check if memo has embedded loading slip data
      if (!ls && response.memo.loading_slip_id) {
        const backendLsId = typeof response.memo.loading_slip_id === 'object'
          ? response.memo.loading_slip_id._id
          : response.memo.loading_slip_id;
        ls = loadingSlips.find(s => s.id === backendLsId || (s as any)._id === backendLsId);

        // If still not found, use embedded loading slip data from backend
        if (!ls && typeof response.memo.loading_slip_id === 'object') {
          ls = response.memo.loading_slip_id;
        }
      }

      const vehicle = vehicles.find((v: any) => v.vehicle_no === ls?.vehicle_no);
      const isOwnVehicle = vehicle?.ownership_type === 'own';

      console.log('🚛 MEMO LEDGER DEBUG:', {
        memoId: response.memo.id,
        memoNumber: response.memo.memo_number,
        loadingSlipId: memoData.loading_slip_id,
        loadingSlipFound: !!ls,
        vehicleNo: ls?.vehicle_no,
        vehicleFound: !!vehicle,
        vehicleOwnership: vehicle?.ownership_type,
        isOwnVehicle,
        freight: memoData.freight,
        commission: memoData.commission,
        mamool: memoData.mamool,
        netAmount: memoData.freight - (memoData.commission || 0) - (memoData.mamool || 0),
        allVehicles: vehicles.map(v => ({ no: v.vehicle_no, ownership: v.ownership_type }))
      });

      // Backend automatically creates ledger entries, just sync the data
      try {
        const ledgerResponse = await apiService.getLedgerEntries();
        setLedgerEntries(ledgerResponse.ledgerEntries || []);
        console.log('🔄 Synced ledger entries after memo creation');
      } catch (error) {
        console.error('Failed to sync ledger entries:', error);
      }

      // Sync completed
    } catch (error) {
      console.error('Failed to create memo:', error);
      const newMemo: Memo = {
        ...memoData,
        id: Date.now().toString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      addMemo(newMemo);
    }
    setShowForm(false);
  };

  const handleShowForm = () => {
    setEditingMemo(null);
    setShowForm(true);
  };

  const getNextMemoNumber = () => {
    // Format: FM-XXXX (4-digit zero-padded)
    const prefix = 'FM-';
    const highest = memos.reduce((max, m) => {
      if (m.memo_number && m.memo_number.startsWith(prefix)) {
        const n = parseInt(m.memo_number.slice(prefix.length), 10);
        if (!isNaN(n) && n > max) return n;
      }
      return max;
    }, 0);
    const next = highest + 1;
    return `${prefix}${String(next).padStart(4, '0')}`;
  };

  const handleEditMemo = (memo: Memo) => {
    setEditingMemo(memo);
    setShowForm(true);
  };

  const handleUpdateMemo = async (memoData: Omit<Memo, 'id' | 'created_at' | 'updated_at'>) => {
    if (editingMemo) {
      try {
        const response = await apiService.updateMemo(editingMemo.id, memoData);
        updateMemo(response.memo);
        console.log('Memo updated and synced:', response.memo);

        // Sync ledger entries after memo update
        try {
          const ledgerResponse = await apiService.getLedgerEntries();
          setLedgerEntries(ledgerResponse.ledgerEntries || []);
          console.log('🔄 Synced ledger entries after memo update');
        } catch (error) {
          console.error('Failed to sync ledger entries:', error);
        }
      } catch (error) {
        console.error('Failed to update memo:', error);
        const updatedMemo: Memo = {
          ...editingMemo,
          ...memoData,
          updated_at: new Date().toISOString(),
        };
        updateMemo(updatedMemo);
      }
      setEditingMemo(null);
      setShowForm(false);
    }
  };

  // Helper: resolve all loading slips linked to a memo
  const resolveLinkedSlips = (memo: Memo) => {
    if (memo.loading_slip_ids && memo.loading_slip_ids.length > 0) {
      const resolved = memo.loading_slip_ids
        .map(id => loadingSlips.find(ls => ls.id === id || (ls as any)._id === id))
        .filter(Boolean) as typeof loadingSlips;
      if (resolved.length > 0) return resolved;
    }
    if (typeof memo.loading_slip_id === 'object' && memo.loading_slip_id !== null) {
      return [memo.loading_slip_id as unknown as typeof loadingSlips[0]];
    }
    const single = loadingSlips.find(ls => ls.id === memo.loading_slip_id || (ls as any)._id === memo.loading_slip_id);
    return single ? [single] : [];
  };

  const handleDownloadPDF = async (memo: Memo) => {
    try {
      const { generateMemoPDF } = await import('../utils/pdfGenerator');
      const allLinkedSlips = resolveLinkedSlips(memo);
      if (allLinkedSlips.length > 0) {
        await generateMemoPDF(memo, allLinkedSlips.length === 1 ? allLinkedSlips[0] : allLinkedSlips, bankingEntries, cashbookEntries);
        
        // Update is_downloaded status
        if (!memo.is_downloaded) {
          const updatedMemoData = { ...memo, is_downloaded: true };
          try {
            await apiService.updateMemo(memo.id, updatedMemoData);
            updateMemo(updatedMemoData);
          } catch (e) {
            console.error('Failed to update download status', e);
          }
        }
      } else {
        console.error('Related loading slip not found for memo:', memo.id);
        alert('Related loading slip not found. Cannot generate PDF.');
      }
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const handlePreviewPDF = async (memo: Memo) => {
    setPreviewLoading(true);
    setPreviewMemo(memo);
    try {
      const { generateMemoPDF } = await import('../utils/pdfGenerator');
      const allLinkedSlips = resolveLinkedSlips(memo);
      if (allLinkedSlips.length > 0) {
        const blobUrl = await generateMemoPDF(memo, allLinkedSlips.length === 1 ? allLinkedSlips[0] : allLinkedSlips, bankingEntries, cashbookEntries, { preview: true });
        if (blobUrl) setPreviewBlobUrl(blobUrl as string);
      } else {
        alert('Related loading slip not found. Cannot generate preview.');
        setPreviewMemo(null);
      }
    } catch (error) {
      console.error('Error generating PDF preview:', error);
      alert('Error generating PDF preview. Please try again.');
      setPreviewMemo(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleMarkAsPaid = (memo: Memo) => {
    setShowPaidModal(memo);
    setPaidDate(new Date().toISOString().split('T')[0]);
  };

  const handleDeleteMemo = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this memo?')) {
      const targetMemo = memos.find(m => m.id === id || (m as any)._id === id || m.memo_number === id);
      const targetId = (targetMemo as any)?._id || targetMemo?.id || id;
      try {
        await apiService.deleteMemo(targetId);
        deleteMemo(targetId);
        console.log('Memo deleted and synced');
      } catch (error) {
        console.error('Failed to delete memo:', error);
        deleteMemo(targetId);
      }
    }
  };

  const confirmMarkAsPaid = async () => {
    if (showPaidModal && paidDate) {
      try {
        // Only update memo status to paid - no banking entry creation
        const updatedMemoData = {
          ...showPaidModal,
          status: 'paid',
          paid_date: paidDate,
          paid_amount: showPaidModal.net_amount
        };

        await apiService.updateMemo(showPaidModal.id, updatedMemoData);
        markMemoAsPaid(showPaidModal.id, paidDate, showPaidModal.net_amount);

        console.log('✅ Memo marked as paid successfully (no banking entry created)');
      } catch (error) {
        console.error('Failed to mark memo as paid:', error);
        // Fallback to local update only
        markMemoAsPaid(showPaidModal.id, paidDate, showPaidModal.net_amount);
      }
      setShowPaidModal(null);
      setPaidDate('');
    }
  };


  const filteredMemos = useMemo(() => {
    // If month filter is active → show ALL memos (pending + paid) for those months
    const monthFilterActive = selectedMonths.length > 0;

    let base: Memo[];
    if (monthFilterActive) {
      // Show all memos regardless of status, filtered by selected months
      base = memos.filter(m => {
        const memoMonth = m.date ? m.date.substring(0, 7) : '';
        return selectedMonths.includes(memoMonth);
      });
    } else {
      // Original tab behavior (pending / paid)
      const showPaid = showOnlyFullyPaid || viewMode === 'paid';
      base = showPaid ? memos.filter(m => m.status === 'paid') : memos.filter(m => m.status !== 'paid');
    }

    // Sort memos by document number (numeric part) in descending order, then by date
    base = [...base].sort((a, b) => {
      const getNumericPart = (memoNumber: string) => {
        const match = memoNumber.match(/(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      };
      const aNum = getNumericPart(a.memo_number);
      const bNum = getNumericPart(b.memo_number);
      if (aNum !== bNum) return bNum - aNum;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    // Optional strict settlement check (only when not using month filter)
    if (!monthFilterActive && showOnlyFullyPaid) {
      base = base.filter(m => {
        const bankingPayments = bankingEntries
          .filter(e => (e.category === 'memo_advance' || e.category === 'memo_payment') && e.reference_id === m.memo_number)
          .reduce((sum, e) => sum + e.amount, 0);
        const cashbookPayments = cashbookEntries
          .filter(e => (e.category === 'memo_advance' || e.category === 'memo_payment') && e.reference_id === m.memo_number)
          .reduce((sum, e) => sum + e.amount, 0);
        const fuelAdvances = (m.advance_payments || []).filter(isFuelAdvance).reduce((sum, a) => sum + (a.amount || 0), 0);
        const paid = bankingPayments + cashbookPayments + fuelAdvances;
        return (m.net_amount || 0) - paid <= 0;
      });
    }

    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(m => {
      const ls = loadingSlips.find(ls => ls.id === m.loading_slip_id);
      const haystack = [
        m.memo_number,
        m.supplier,
        new Date(m.date).toLocaleDateString('en-IN'),
        String(m.freight),
        String(m.net_amount),
        ls?.slip_number || '',
        ls?.party || '',
        ls?.vehicle_no || '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [memos, bankingEntries, cashbookEntries, showOnlyFullyPaid, viewMode, search, loadingSlips, selectedMonths]);

  const monthFilterActive = selectedMonths.length > 0;
  const { suppliers } = useDataStore();
  const [showSelectorModal, setShowSelectorModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedLrIds, setSelectedLrIds] = useState<string[]>([]);
  const [slipsForForm, setSlipsForForm] = useState<LoadingSlip[]>([]);

  // Unique suppliers from suppliers master & loading slips
  const uniqueSuppliers = useMemo(() => {
    const set = new Set<string>();
    (suppliers || []).forEach(s => { if (s.name) set.add(s.name); });
    (loadingSlips || []).forEach(ls => {
      if (ls.supplier) set.add(ls.supplier);
      if (ls.owner_name) set.add(ls.owner_name);
    });
    return Array.from(set).sort();
  }, [suppliers, loadingSlips]);

  // Eligible un-memoed LRs for selected Supplier
  const eligibleLrsForSupplier = useMemo(() => {
    if (!selectedSupplier) return [];
    return loadingSlips.filter(ls => {
      const match = (ls.supplier && ls.supplier.toLowerCase() === selectedSupplier.toLowerCase()) ||
                    (ls.owner_name && ls.owner_name.toLowerCase() === selectedSupplier.toLowerCase());
      const isMemoed = memos.some(m =>
        m.loading_slip_id === ls.id ||
        (m as any).loading_slip_id === (ls as any)._id ||
        (m.loading_slip_ids && (m.loading_slip_ids.includes(ls.id) || m.loading_slip_ids.includes((ls as any)._id))) ||
        (ls.memo_number && m.memo_number === ls.memo_number)
      );
      return match && !isMemoed;
    });
  }, [selectedSupplier, loadingSlips, memos]);

  useEffect(() => {
    if (createForSlip) {
      const supplierName = createForSlip.supplier || createForSlip.owner_name || '';
      setSelectedSupplier(supplierName);
      const slipId = createForSlip.id || (createForSlip as any)._id;
      if (slipId) setSelectedLrIds([slipId]);
      setShowSelectorModal(true);
    }
  }, [createForSlip]);

  const handleStartCreateMemo = () => {
    setSelectedSupplier('');
    setSelectedLrIds([]);
    setSlipsForForm([]);
    setShowSelectorModal(true);
  };

  const toggleSelectLr = (id: string) => {
    if (!id) return;
    setSelectedLrIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleProceedToMemoForm = () => {
    const chosenSlips = loadingSlips.filter(ls => {
      const sId = ls.id || (ls as any)._id;
      return sId && selectedLrIds.includes(sId);
    });
    setSlipsForForm(chosenSlips);
    setShowSelectorModal(false);
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-gray-900">Freight Memo</h1>
          {/* Month filter active badge */}
          {monthFilterActive && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
              All freight memos • {selectedMonths.length} month{selectedMonths.length > 1 ? 's' : ''} selected
              <button onClick={() => setSelectedMonths([])} className="hover:text-blue-900">
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <MonthFilterDropdown selectedMonths={selectedMonths} onChange={setSelectedMonths} />
          <button
            onClick={handleStartCreateMemo}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Create Freight Memo</span>
          </button>
        </div>
      </div>

      {/* Selector Modal: Create Freight Memo Using LR */}
      {showSelectorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200 mb-4">
              <h2 className="text-xl font-bold text-gray-900">Create Freight Memo</h2>
              <button onClick={() => setShowSelectorModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Step 1: Select Supplier */}
            <div className="mb-5">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Select Supplier / Vehicle Owner *</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                value={selectedSupplier}
                onChange={e => {
                  setSelectedSupplier(e.target.value);
                  setSelectedLrIds([]);
                }}
              >
                <option value="">-- Choose Supplier --</option>
                {uniqueSuppliers.map((s, idx) => (
                  <option key={idx} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Step 2: Eligible LRs List */}
            {selectedSupplier && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Eligible LRs for {selectedSupplier}</h3>
                  <span className="text-xs bg-blue-100 text-blue-800 font-semibold px-2.5 py-1 rounded-full">
                    Selected LR List: {selectedLrIds.length}
                  </span>
                </div>

                {eligibleLrsForSupplier.length === 0 ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-sm text-gray-500">
                    No un-memoed LRs found for {selectedSupplier}.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
                    {eligibleLrsForSupplier.map((lr) => {
                      const lrId = lr.id || (lr as any)._id;
                      const isChecked = selectedLrIds.includes(lrId);
                      return (
                        <div
                          key={lrId}
                          onClick={() => toggleSelectLr(lrId)}
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
                                Freight Amount : {formatCurrency(lr.freight || lr.total_amount || 0)}
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
                  onClick={handleProceedToMemoForm}
                  className={`px-5 py-2 text-white rounded-lg text-sm font-medium transition-colors ${
                    selectedLrIds.length === 0
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  Proceed to Generate Freight Memo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <MemoForm
          initialData={editingMemo}
          slips={slipsForForm}
          nextMemoNumber={getNextMemoNumber()}
          onSubmit={editingMemo ? handleUpdateMemo : handleCreateMemo}
          onCancel={() => {
            setShowForm(false);
            setEditingMemo(null);
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
          placeholder="Search by memo number, supplier name, or route..."
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
      </div>

      {/* Header Section */}
      <div className="bg-blue-600 rounded-xl shadow-sm p-6 text-white">
        <h2 className="text-xl font-bold mb-2">
          {monthFilterActive
            ? 'Freight Memos (Month Filter)'
            : showOnlyFullyPaid || viewMode === 'paid'
              ? 'Paid Freight Memos'
              : 'Freight Memos (Supplier)'}
        </h2>
        <p className="text-blue-100">
          {monthFilterActive
            ? 'Showing all memos (pending + paid) for selected month(s)'
            : showOnlyFullyPaid || viewMode === 'paid'
              ? 'Manage settled supplier memos'
              : 'Manage supplier transportation memos'}
        </p>
        <div className="mt-4 text-sm text-blue-100">
          {filteredMemos.length} memo{filteredMemos.length !== 1 ? 's' : ''} found
        </div>
      </div>

      {/* Memos Cards */}
      {filteredMemos.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No memos found</h3>
          <p className="text-gray-500">Create memos from loading slips</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMemos.map((memo: Memo, index: number) => {
            // Handle both cases: loading_slip_id as string or populated object
            const loadingSlip = typeof memo.loading_slip_id === 'object' && memo.loading_slip_id !== null
              ? memo.loading_slip_id
              : loadingSlips.find(ls => ls.id === memo.loading_slip_id);
            const bankingPayments = bankingEntries
              .filter(e => (e.category === 'memo_advance' || e.category === 'memo_payment') && e.reference_id === memo.memo_number)
              .reduce((sum, e) => sum + e.amount, 0);

            const cashbookPayments = cashbookEntries
              .filter(e => (e.category === 'memo_advance' || e.category === 'memo_payment') && e.reference_id === memo.memo_number)
              .reduce((sum, e) => sum + e.amount, 0);

            // Count fuel-tagged advance_payments to avoid double counting banking/cashbook advances
            const fuelAdvances = (memo.advance_payments || []).filter(isFuelAdvance).reduce((sum, a) => sum + (a.amount || 0), 0);
            const paid = bankingPayments + cashbookPayments + fuelAdvances;
            // Balance = Net Amount - all payments (banking + cashbook + fuel advances)
            const rawBalance = (memo.net_amount || 0) - paid;
            const isFullyPaid = rawBalance <= 0;
            const balance = Math.max(0, rawBalance);
            const isHighlighted = highlightMemo === memo.memo_number;

            return (
              <div
                key={memo.id || `memo-${index}-${memo.memo_number}`}
                id={`memo-${memo.memo_number}`}
                className={`bg-white rounded-xl shadow-sm border transition-shadow ${isHighlighted
                  ? 'border-blue-500 ring-2 ring-blue-200 shadow-lg'
                  : 'border-gray-200 hover:shadow-md'
                  }`}>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="text-lg font-semibold text-blue-600">
                          Memo #{memo.memo_number}
                        </h3>
                        {memo.is_downloaded && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            Downloaded
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {new Date(memo.date).toLocaleDateString('en-IN')} • {loadingSlip ? `${loadingSlip.from_location} → ${loadingSlip.to_location}` : 'N/A'}
                      </p>
                    </div>
                    <div className="text-right">
                      {isFullyPaid ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Settled
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Due
                        </span>
                      )}
                      {(showOnlyFullyPaid || viewMode === 'paid') && memo.paid_date && (
                        <div className="text-xs text-green-600 mt-1">
                          Paid: {new Date(memo.paid_date).toLocaleDateString('en-IN')}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Vehicle & Material</div>
                      <div className="font-medium text-gray-900">{loadingSlip?.vehicle_no || 'N/A'}</div>
                      <div className="text-sm text-gray-600">{loadingSlip?.material || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Supplier & Weight</div>
                      <div className="font-medium text-gray-900">{loadingSlip?.supplier || memo.supplier}</div>
                      <div className="text-sm text-gray-600">{loadingSlip?.weight || 0} MT</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Freight</div>
                      <div className="text-lg font-bold text-green-600">{formatCurrency(memo.freight)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Balance</div>
                      <div className="text-lg font-bold text-green-600">{formatCurrency(balance)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4 text-sm">
                    <div>
                      <span className="text-gray-500">Commission:</span>
                      <span className="ml-1 font-medium">{formatCurrency(memo.commission || 0)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Mamool:</span>
                      <span className="ml-1 font-medium">{formatCurrency(memo.mamool || 0)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Detention:</span>
                      <span className="ml-1 font-medium">{formatCurrency(memo.detention || 0)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Extra:</span>
                      <span className="ml-1 font-medium">{formatCurrency(memo.extra || 0)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">RTO:</span>
                      <span className="ml-1 font-medium">{formatCurrency(memo.rto || 0)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Deduction:</span>
                      <span className="ml-1 font-medium">{formatCurrency((memo as any).deduction || 0)}</span>
                    </div>
                  </div>

                  {memo.advance_payments && memo.advance_payments.length > 0 && (
                    <div className="mb-4 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-gray-500 font-medium">Advance Payments:</span>
                      {memo.advance_payments.map((adv: any, i: number) => (
                        <span key={adv._id || adv.id || i} className="bg-blue-50 border border-blue-200 text-blue-800 font-semibold px-2.5 py-1 rounded-md flex items-center gap-1">
                          <span>{adv.reference || adv.description || 'Fuel/BPCL'}:</span>
                          <span className="text-blue-900 font-bold">{formatCurrency(adv.amount)}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex items-center space-x-4">
                      <div className="text-sm">
                        <span className="text-gray-500">Net Amount:</span>
                        <span className="ml-1 font-bold text-green-600">{formatCurrency(memo.net_amount)}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-500">Paid:</span>
                        <span className="ml-1 font-medium">{formatCurrency(paid)}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handlePreviewPDF(memo)}
                        className="p-2 text-purple-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Preview PDF"
                        disabled={previewLoading}
                      >
                        <FileSearch className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewMemo(memo)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEditMemo(memo)}
                        className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDownloadPDF(memo)}
                        className="p-2 text-green-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Download PDF"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      {!showOnlyFullyPaid && viewMode !== 'paid' && !isFullyPaid && (
                        <button
                          onClick={() => handleMarkAsPaid(memo)}
                          className="p-2 text-purple-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Mark as Paid"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteMemo(memo.id)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMemo && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">Memo #{viewMemo.memo_number}</h3>
              <button onClick={() => setViewMemo(null)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Date:</span> {new Date(viewMemo.date).toLocaleDateString('en-IN')}</div>
              <div><span className="text-gray-500">Supplier:</span> {viewMemo.supplier}</div>
              <div><span className="text-gray-500">Freight:</span> {formatCurrency(viewMemo.freight)}</div>
              <div><span className="text-gray-500">Commission:</span> {formatCurrency(viewMemo.commission)}</div>
              <div><span className="text-gray-500">Mamool:</span> {formatCurrency(viewMemo.mamool)}</div>
              <div><span className="text-gray-500">Detention:</span> {formatCurrency(viewMemo.detention)}</div>
              <div><span className="text-gray-500">Extra:</span> {formatCurrency(viewMemo.extra)}</div>
              <div><span className="text-gray-500">RTO:</span> {formatCurrency(viewMemo.rto)}</div>
              <div><span className="text-gray-500">Deduction:</span> {formatCurrency((viewMemo as any).deduction || 0)}</div>
              <div className="col-span-2"><span className="text-gray-500">Net Amount:</span> {formatCurrency(viewMemo.net_amount)}</div>
              {viewMemo.advance_payments && viewMemo.advance_payments.length > 0 && (
                <div className="col-span-2 border-t pt-3 mt-2">
                  <span className="text-gray-700 font-semibold block mb-2">Advance Payments / Fuel Advances:</span>
                  <div className="space-y-1.5">
                    {viewMemo.advance_payments.map((adv: any, i: number) => (
                      <div key={adv._id || adv.id || i} className="flex justify-between items-center bg-gray-50 p-2.5 rounded border border-gray-200 text-xs">
                        <span>{new Date(adv.date).toLocaleDateString('en-IN')} • <strong className="text-blue-600">{adv.reference || adv.description || 'Fuel Advance'}</strong></span>
                        <span className="font-bold text-green-700">{formatCurrency(adv.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {viewMemo.narration && (
                <div className="col-span-2">
                  <span className="text-gray-500">Narration:</span>
                  <p className="mt-1 text-gray-900">{viewMemo.narration}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t flex justify-end">
              <button onClick={() => setViewMemo(null)} className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Mark as Paid Modal */}
      {showPaidModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">Mark Memo as Paid</h3>
              <button onClick={() => setShowPaidModal(null)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  Memo #{showPaidModal.memo_number} - {showPaidModal.supplier}
                </p>
                <p className="text-lg font-semibold text-green-600">
                  Amount: {formatCurrency(showPaidModal.net_amount)}
                </p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Date
                </label>
                <input
                  type="date"
                  value={paidDate}
                  onChange={(e) => setPaidDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end space-x-3">
              <button
                onClick={() => setShowPaidModal(null)}
                className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmMarkAsPaid}
                className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
              >
                Mark as Paid
              </button>
            </div>
          </div>
        </div>
      )}
      {/* PDF Preview Modal */}
      {previewMemo && previewBlobUrl && (
        <PDFPreviewModal
          blobUrl={previewBlobUrl}
          title={`Memo #${previewMemo.memo_number} — ${previewMemo.supplier}`}
          onDownload={() => handleDownloadPDF(previewMemo)}
          onClose={() => {
            setPreviewMemo(null);
            setPreviewBlobUrl(null);
          }}
        />
      )}
    </div>
  );
};

export default MemoComponent;