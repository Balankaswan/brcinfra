import React, { useState } from 'react';
import { Plus, Edit, Trash2, FileText, Eye, Download, FileSearch } from 'lucide-react';
import { useDataStore } from '../lib/store';
import { apiService } from '../lib/api';
import { getNextSequenceNumber } from '../utils/sequenceGenerator';
import { formatCurrency } from '../utils/numberGenerator';
import LoadingSlipForm from './forms/LoadingSlipForm';
import MemoForm from './forms/MemoForm';
import BillForm from './forms/BillForm';
import PDFPreviewModal from './PDFPreviewModal';
import type { LoadingSlip } from '../types';

interface LoadingSlipComponentProps {
  onNavigate?: (page: string, params?: any) => void;
}

// Helper to check if a string is a valid MongoDB ObjectId (24-char hex)
const isValidMongoId = (id: string): boolean => {
  return /^[a-f\d]{24}$/i.test(id);
};

const LoadingSlipComponent: React.FC<LoadingSlipComponentProps> = ({ onNavigate }) => {
  const { loadingSlips, memos, bills, vehicles, addLoadingSlip, updateLoadingSlip, deleteLoadingSlip, addMemo, addBill } = useDataStore();
  const [showForm, setShowForm] = useState(false);
  const [editingSlip, setEditingSlip] = useState<LoadingSlip | null>(null);
  const [viewSlip, setViewSlip] = useState<LoadingSlip | null>(null);
  const [previewSlip, setPreviewSlip] = useState<LoadingSlip | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showMemoForm, setShowMemoForm] = useState(false);
  const [showBillForm, setShowBillForm] = useState(false);
  const [selectedSlipForMemo, setSelectedSlipForMemo] = useState<LoadingSlip | null>(null);
  const [selectedSlipForBill, setSelectedSlipForBill] = useState<LoadingSlip | null>(null);

  const getNextSlipNumber = () => {
    return getNextSequenceNumber(loadingSlips, 'slip_number', 'LS');
  };

  const getNextMemoNumber = () => {
    return getNextSequenceNumber(memos, 'memo_number', 'MO');
  };

  const getNextBillNumber = () => {
    return getNextSequenceNumber(bills, 'bill_number', 'BL');
  };

  const handleShowForm = () => {
    console.log('🔄 Create button clicked - Opening form');
    setEditingSlip(null);
    setShowForm(true);
  };

  const handleCreateLoadingSlip = async (slipData: Omit<LoadingSlip, 'id' | 'created_at' | 'updated_at'>) => {
    console.log('📝 Creating loading slip:', slipData.slip_number);
    try {
      // Mark loading slip creation timestamp to prevent immediate sync overwrite
      localStorage.setItem('lastLoadingSlipCreation', Date.now().toString());
      const response = await apiService.createLoadingSlip(slipData);
      addLoadingSlip(response.loadingSlip);
      console.log('✅ Loading slip created successfully:', response.loadingSlip.slip_number);
    } catch (error) {
      console.error('❌ Failed to create loading slip (attempt 1):', error);
      
      // Retry once after a short delay
      try {
        console.log('🔄 Retrying loading slip creation...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        localStorage.setItem('lastLoadingSlipCreation', Date.now().toString());
        const retryResponse = await apiService.createLoadingSlip(slipData);
        addLoadingSlip(retryResponse.loadingSlip);
        console.log('✅ Loading slip created successfully on retry:', retryResponse.loadingSlip.slip_number);
      } catch (retryError) {
        console.error('❌ Failed to create loading slip (attempt 2):', retryError);
        // Show clear error to user - do NOT create local-only slip with invalid ID
        // because it would break memo/bill creation later
        alert(`Failed to save loading slip ${slipData.slip_number} to the server. Please check your internet connection and try again.\n\nError: ${retryError instanceof Error ? retryError.message : 'Unknown error'}`);
      }
    }
    console.log('🔄 Resetting form state');
    setShowForm(false);
    setEditingSlip(null);
  };

  const handleUpdateLoadingSlip = async (loadingSlipData: Omit<LoadingSlip, 'id' | 'created_at' | 'updated_at'>) => {
    if (editingSlip) {
      try {
        const response = await apiService.updateLoadingSlip(editingSlip.id, loadingSlipData);
        updateLoadingSlip(response.loadingSlip);
        console.log('Loading slip updated and synced:', response.loadingSlip);
      } catch (error) {
        console.error('Failed to update loading slip:', error);
        const updatedLoadingSlip: LoadingSlip = {
          ...editingSlip,
          ...loadingSlipData,
          updated_at: new Date().toISOString(),
        };
        updateLoadingSlip(updatedLoadingSlip);
      }
      setEditingSlip(null);
      setShowForm(false);
    }
  };

  const handleEditClick = (slip: LoadingSlip) => {
    // LR slips (with lr_number) open the full LRForm; old loading slips use LoadingSlipForm modal
    if (slip.lr_number && onNavigate) {
      onNavigate('lr-edit', { slip });
    } else {
      setEditingSlip(slip);
      setShowForm(true);
    }
  };

  const handleDownloadPDF = async (slip: LoadingSlip) => {
    try {
      const { generateLoadingSlipPDF, generateLRPDF } = await import('../utils/pdfGenerator');
      if (slip.lr_number) {
        await generateLRPDF(slip);
      } else {
        await generateLoadingSlipPDF(slip);
      }
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const handlePreviewPDF = async (slip: LoadingSlip) => {
    setPreviewLoading(true);
    setPreviewSlip(slip);
    try {
      const { generateLoadingSlipPDF, generateLRPDF } = await import('../utils/pdfGenerator');
      const blobUrl = slip.lr_number
        ? await generateLRPDF(slip, { preview: true })
        : await generateLoadingSlipPDF(slip, { preview: true });
      if (blobUrl) setPreviewBlobUrl(blobUrl as string);
    } catch (error) {
      console.error('Error generating PDF preview:', error);
      alert('Error generating PDF preview. Please try again.');
      setPreviewSlip(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDeleteLoadingSlip = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this loading slip?')) {
      try {
        await apiService.deleteLoadingSlip(id);
        deleteLoadingSlip(id);
        console.log('Loading slip deleted and synced');
      } catch (error) {
        console.error('Failed to delete loading slip:', error);
        deleteLoadingSlip(id);
      }
    }
  };

  // Sort loading slips by document number (numeric part) in descending order, then by date
  const sortedSlips = [...loadingSlips].sort((a, b) => {
    // Extract numeric part from slip numbers for proper sorting
    const getNumericPart = (slipNumber: string) => {
      const match = slipNumber.match(/(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    };

    const aNum = getNumericPart(a.slip_number);
    const bNum = getNumericPart(b.slip_number);

    // Primary sort: by numeric part of slip number (descending)
    if (aNum !== bNum) {
      return bNum - aNum;
    }

    // Secondary sort: by date (descending - latest first)
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const filteredSlips = sortedSlips.filter((slip) => {
    if (!search.trim()) return true;
    const slipIdStr = (slip.id || (slip as any)._id || '').toString();
    const memoNumber = memos.find(m =>
      m.loading_slip_id === slipIdStr ||
      (m as any).loading_slip_id === slipIdStr ||
      (m.loading_slip_ids && (m.loading_slip_ids.includes(slipIdStr) || m.loading_slip_ids.includes(slip.id))) ||
      (m.memo_number && m.memo_number === slip.memo_number)
    )?.memo_number || slip.memo_number || '';
    const billNumber = bills.find(b =>
      b.loading_slip_id === slipIdStr ||
      (b as any).loading_slip_id === slipIdStr ||
      (b.loading_slip_ids && (b.loading_slip_ids.includes(slipIdStr) || b.loading_slip_ids.includes(slip.id))) ||
      (b.bill_number && b.bill_number === slip.bill_number)
    )?.bill_number || slip.bill_number || '';
    const haystack = [
      slip.slip_number,
      slip.lr_number || '',
      memoNumber,
      billNumber,
      slip.consignor_name || slip.party || '',
      slip.consignee_name || '',
      slip.vehicle_no,
      slip.from_location,
      slip.to_location,
      new Date(slip.date).toLocaleDateString('en-IN'),
      String(slip.total_freight || slip.total_amount || ''),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">
            Bilty List
            <span className="ml-2 text-sm font-normal bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {filteredSlips.length}
            </span>
          </h1>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">List Sort By:</label>
            <select className="text-xs border border-gray-300 rounded px-2 py-1 text-gray-700 bg-white">
              <option>Document Number</option>
              <option>Date</option>
              <option>Vehicle</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded transition-colors">
            Delete
          </button>
          <button className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded transition-colors">
            Report
          </button>
          <button className="px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white text-sm font-medium rounded transition-colors">
            Filter
          </button>
          <button
            onClick={() => {
              if (onNavigate) onNavigate('lr-create');
              else handleShowForm();
            }}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded transition-colors flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Create New Bilty
          </button>
        </div>
      </div>

      {showForm && (
        <LoadingSlipForm
          initialData={editingSlip}
          nextSlipNumber={getNextSlipNumber()}
          onSubmit={editingSlip ? handleUpdateLoadingSlip : handleCreateLoadingSlip}
          onCancel={() => { setShowForm(false); setEditingSlip(null); }}
        />
      )}

      {/* Search */}
      <div className="bg-white rounded border border-gray-200 px-3 py-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search bilty no., vehicle, consignor, route, date..."
          className="w-full text-sm outline-none text-gray-700 placeholder-gray-400"
        />
      </div>

      {/* Empty state */}
      {filteredSlips.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No bilties found</h3>
          <p className="text-gray-500 text-sm">Create your first bilty to get started</p>
        </div>
      ) : (
        /* 2-column grid */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filteredSlips.map((slip, index) => {
            const slipIdStr = (slip.id || (slip as any)._id || '').toString();
            const linkedBill = bills.find(b =>
              b.loading_slip_id === slipIdStr ||
              (b as any).loading_slip_id === slipIdStr ||
              (b.loading_slip_ids && (b.loading_slip_ids.includes(slipIdStr) || b.loading_slip_ids.includes(slip.id))) ||
              (b.bill_number && b.bill_number === slip.bill_number)
            );
            const linkedMemo = memos.find(m =>
              m.loading_slip_id === slipIdStr ||
              (m as any).loading_slip_id === slipIdStr ||
              (m.loading_slip_ids && (m.loading_slip_ids.includes(slipIdStr) || m.loading_slip_ids.includes(slip.id))) ||
              (m.memo_number && m.memo_number === slip.memo_number)
            );
            const invoiceNo = linkedBill ? linkedBill.bill_number : (slip.bill_number && bills.length > 0 && bills.some(b => b.bill_number === slip.bill_number) ? slip.bill_number : null);
            const memoNo = linkedMemo ? linkedMemo.memo_number : (slip.memo_number && memos.length > 0 && memos.some(m => m.memo_number === slip.memo_number) ? slip.memo_number : null);
            const isLR = !!slip.lr_number;
            const docNumber = slip.lr_number || slip.slip_number || '';
            const vehicleDisplay = slip.vehicle_no || '';
            const consignorDisplay = slip.consignor_name || slip.party || '';
            const toBilled = slip.total_amount || slip.total_freight || slip.freight_amount || slip.freight || 0;


            return (
              <div
                key={slip.id || `slip-${index}`}
                className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Card top: BILTY NO + Date */}
                <div className="flex items-start justify-between px-3 pt-3 pb-1">
                  <div>
                    <p className="text-[10px] text-gray-500 font-semibold tracking-wide">
                      LR NO.: {isLR ? `${slip.lr_number}` : docNumber}
                    </p>
                    {/* Vehicle Number — large, orange/red */}
                    <p className="text-xl font-bold text-orange-500 leading-tight mt-0.5">
                      {vehicleDisplay}
                    </p>
                    <p className="text-[11px] text-gray-700 mt-1">
                      TO BE BILLED : <span className="font-semibold">₹ {(toBilled).toLocaleString('en-IN')}/-</span>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-[11px] text-gray-500">
                      {slip.date ? new Date(slip.date).toLocaleDateString('en-IN') : ''}
                    </p>
                    {/* Paid toggle (visual only) */}
                    <div className="flex items-center gap-1 mt-1">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center cursor-pointer ${memoNo ? 'border-green-500 bg-green-500' : 'border-gray-300 bg-white'}`}>
                        {memoNo && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <span className="text-[11px] text-gray-500">{memoNo ? 'PAID' : 'UNPAID'}</span>
                    </div>
                  </div>
                </div>

                {/* Add Expense btn + Consignor/route */}
                <div className="flex items-start gap-3 px-3 pb-2">
                  <div className="flex-shrink-0">
                    <button className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded transition-colors">
                      Add Expense
                    </button>
                  </div>
                  <div className="text-[11px] text-gray-700 min-w-0 flex-1">
                    <p className="font-semibold text-gray-800 truncate">
                      CONSIGNOR : {consignorDisplay}
                    </p>
                    <p className="text-gray-600 truncate">FROM : {slip.from_location || ''}</p>
                    <p className="text-gray-600 truncate">TO : {slip.to_location || ''}</p>
                    
                    {/* Linked Document Links (Points 48 & 51) */}
                    <div className="mt-1 pt-1 border-t border-gray-100 space-y-0.5 text-[10px]">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">Invoice No. :</span>
                        {invoiceNo ? (
                          <button
                            onClick={() => onNavigate?.('bills', { highlight: invoiceNo })}
                            className="font-bold text-blue-600 hover:underline flex items-center gap-0.5"
                          >
                            {invoiceNo} 🔗
                          </button>
                        ) : (
                          <span className="text-gray-400 italic">Not Created</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">Freight Memo :</span>
                        {memoNo ? (
                          <button
                            onClick={() => onNavigate?.('memo', { highlight: memoNo })}
                            className="font-bold text-purple-600 hover:underline flex items-center gap-0.5"
                          >
                            {memoNo} 🔗
                          </button>
                        ) : (
                          <span className="text-gray-400 italic">Not Created</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action buttons row + Shortcuts (Point 52) */}
                <div className="flex items-center justify-between px-3 pb-2 border-t border-gray-50 pt-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setViewSlip(slip)}
                      title="View Details"
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleEditClick(slip)}
                      title="Edit"
                      className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handlePreviewPDF(slip)}
                      title="Preview PDF"
                      disabled={previewLoading}
                      className="p-1.5 text-purple-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                    >
                      <FileSearch className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDownloadPDF(slip)}
                      title="Download PDF"
                      className="p-1.5 text-green-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteLoadingSlip(slip.id)}
                      title="Delete"
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Shortcuts for downstream creation */}
                  <div className="flex items-center gap-1.5">
                    {!invoiceNo && (
                      <button
                        onClick={() => {
                          if (onNavigate) {
                            onNavigate('bills', { createForSlip: slip });
                          } else {
                            setSelectedSlipForBill(slip);
                            setShowBillForm(true);
                          }
                        }}
                        className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold rounded border border-blue-200 transition-colors"
                      >
                        + Create Invoice
                      </button>
                    )}
                    {!memoNo && (
                      <button
                        onClick={() => {
                          if (onNavigate) {
                            onNavigate('memo', { createForSlip: slip });
                          } else {
                            setSelectedSlipForMemo(slip);
                            setShowMemoForm(true);
                          }
                        }}
                        className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 text-[10px] font-bold rounded border border-purple-200 transition-colors"
                      >
                        + Create Freight Memo
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View Details Modal */}
      {viewSlip && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setViewSlip(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50 rounded-t-xl">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {viewSlip.lr_number ? `LR #${viewSlip.lr_number}` : `Loading Slip #${viewSlip.slip_number}`}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(viewSlip.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <button onClick={() => setViewSlip(null)} className="text-gray-400 hover:text-gray-700 text-xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200">✕</button>
            </div>
            <div className="p-6 space-y-4 text-sm">
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-700 uppercase mb-1">Route</p>
                <p className="font-medium text-gray-900">{viewSlip.from_location} → {viewSlip.to_location}</p>
              </div>
              {viewSlip.lr_number ? (
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-gray-500 text-xs">Consignor:</span><p className="font-medium">{viewSlip.consignor_name || viewSlip.party || '-'}</p></div>
                  <div><span className="text-gray-500 text-xs">Consignee:</span><p className="font-medium">{viewSlip.consignee_name || '-'}</p></div>
                  {viewSlip.consignor_address && <div><span className="text-gray-500 text-xs">Consignor Address:</span><p>{viewSlip.consignor_address}</p></div>}
                  {viewSlip.consignee_address && <div><span className="text-gray-500 text-xs">Consignee Address:</span><p>{viewSlip.consignee_address}</p></div>}
                  {viewSlip.consignor_gstin && <div><span className="text-gray-500 text-xs">Consignor GSTIN:</span><p>{viewSlip.consignor_gstin}</p></div>}
                  {viewSlip.consignee_gstin && <div><span className="text-gray-500 text-xs">Consignee GSTIN:</span><p>{viewSlip.consignee_gstin}</p></div>}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-gray-500 text-xs">Party:</span><p className="font-medium">{viewSlip.party}</p></div>
                  <div><span className="text-gray-500 text-xs">Supplier:</span><p className="font-medium">{viewSlip.supplier}</p></div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-start gap-2">
                  <div>
                    <span className="text-gray-500 text-xs">Vehicle No:</span>
                    <p className="font-bold text-orange-500">{viewSlip.vehicle_no}</p>
                  </div>
                  {(() => {
                    const vehicle = vehicles.find(v => v.vehicle_no === viewSlip.vehicle_no);
                    return vehicle ? (
                      <span className={`mt-3 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${vehicle.ownership_type === 'own' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                        {vehicle.ownership_type === 'own' ? 'Own' : 'Market'}
                      </span>
                    ) : null;
                  })()}
                </div>
                {viewSlip.vehicle_size && <div><span className="text-gray-500 text-xs">Vehicle Size:</span><p>{viewSlip.vehicle_size}</p></div>}
                {viewSlip.driver_name && <div><span className="text-gray-500 text-xs">Driver:</span><p>{viewSlip.driver_name} {viewSlip.driver_number ? `(${viewSlip.driver_number})` : ''}</p></div>}
                {viewSlip.owner_name && <div><span className="text-gray-500 text-xs">Owner:</span><p>{viewSlip.owner_name}</p></div>}
                {viewSlip.eway_bill_number && <div><span className="text-gray-500 text-xs">E-Way Bill:</span><p>{viewSlip.eway_bill_number}</p></div>}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><span className="text-gray-500 text-xs">Weight:</span><p className="font-medium">{viewSlip.actual_weight || viewSlip.weight} {viewSlip.weight_unit || 'MT'}</p></div>
                <div><span className="text-gray-500 text-xs">Material:</span><p>{viewSlip.material || '-'}</p></div>
                {viewSlip.no_of_articles != null && <div><span className="text-gray-500 text-xs">Articles:</span><p>{viewSlip.no_of_articles}</p></div>}
              </div>
              <div className="bg-green-50 rounded-lg p-3 grid grid-cols-3 gap-3">
                <div><span className="text-gray-500 text-xs">Freight:</span><p className="font-semibold">{formatCurrency(viewSlip.freight_amount || viewSlip.freight || 0)}</p></div>
                <div><span className="text-gray-500 text-xs">Advance:</span><p className="font-semibold">{formatCurrency(viewSlip.advance_amount || viewSlip.advance || 0)}</p></div>
                <div><span className="text-gray-500 text-xs">Total:</span><p className="font-bold text-green-700">{formatCurrency(viewSlip.total_amount || viewSlip.total_freight || 0)}</p></div>
              </div>
              {viewSlip.freight_type && (
                <div><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">{viewSlip.freight_type.replace(/_/g, ' ').toUpperCase()}</span></div>
              )}
              {viewSlip.insurance_status === 'insured' && (
                <div><span className="text-gray-500 text-xs">Insurance:</span><p>{viewSlip.insurance_company} — Policy {viewSlip.policy_number}</p></div>
              )}
              {viewSlip.remarks && <div><span className="text-gray-500 text-xs">Remarks:</span><p>{viewSlip.remarks}</p></div>}
              {viewSlip.narration && <div><span className="text-gray-500 text-xs">Narration:</span><p>{viewSlip.narration}</p></div>}
            </div>
            <div className="px-6 py-4 border-t flex items-center justify-between gap-3">
              <button
                onClick={() => { handleEditClick(viewSlip); setViewSlip(null); }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >Edit</button>
              <div className="flex gap-2">
                <button onClick={() => handleDownloadPDF(viewSlip)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
                  Download PDF (5 Copies)
                </button>
                <button onClick={() => setViewSlip(null)} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Memo Form Modal */}
      {showMemoForm && selectedSlipForMemo && (
        <MemoForm
          slip={selectedSlipForMemo}
          nextMemoNumber={getNextMemoNumber()}
          onSubmit={async (memoData) => {
            try {
              const token = localStorage.getItem('auth_token');
              if (!token) throw new Error('Authentication required - please log in');
              const memoDataWithSlipId = { ...memoData, loading_slip_id: selectedSlipForMemo?.id };
              localStorage.setItem('lastMemoCreation', Date.now().toString());
              const response = await apiService.createMemo(memoDataWithSlipId);
              if (response?.memo) {
                addMemo(response.memo);
                if (selectedSlipForMemo) updateLoadingSlip({ ...selectedSlipForMemo, memo_number: response.memo.memo_number });
              }
              setShowMemoForm(false);
              setSelectedSlipForMemo(null);
            } catch (error) {
              alert(`Failed to create memo: ${error instanceof Error ? error.message : 'Unknown error'}`);
              setShowMemoForm(false);
              setSelectedSlipForMemo(null);
            }
          }}
          onCancel={() => { setShowMemoForm(false); setSelectedSlipForMemo(null); }}
        />
      )}

      {/* Bill Form Modal */}
      {showBillForm && selectedSlipForBill && (
        <BillForm
          loadingSlip={selectedSlipForBill}
          nextBillNumber={getNextBillNumber()}
          onSubmit={async (billData) => {
            try {
              const billDataWithSlipId = { ...billData, loading_slip_id: selectedSlipForBill?.id };
              if (!billDataWithSlipId.loading_slip_id) throw new Error('Loading slip ID is missing');
              localStorage.setItem('lastBillCreation', Date.now().toString());
              const response = await apiService.createBill(billDataWithSlipId);
              if (response?.bill) {
                addBill(response.bill);
                if (selectedSlipForBill) updateLoadingSlip({ ...selectedSlipForBill, bill_number: response.bill.bill_number });
              }
              setShowBillForm(false);
              setSelectedSlipForBill(null);
            } catch (error) {
              console.error('Failed to create bill:', error);
              setShowBillForm(false);
              setSelectedSlipForBill(null);
            }
          }}
          onCancel={() => { setShowBillForm(false); setSelectedSlipForBill(null); }}
        />
      )}

      {/* PDF Preview Modal */}
      {previewSlip && previewBlobUrl && (
        <PDFPreviewModal
          blobUrl={previewBlobUrl}
          title={`${previewSlip.lr_number ? `LR #${previewSlip.lr_number}` : `Slip #${previewSlip.slip_number}`} — ${previewSlip.consignor_name || previewSlip.party}`}
          onDownload={() => handleDownloadPDF(previewSlip)}
          onClose={() => { setPreviewSlip(null); setPreviewBlobUrl(null); }}
        />
      )}
    </div>
  );
};

export default LoadingSlipComponent;
