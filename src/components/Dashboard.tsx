import React, { useState, useMemo } from 'react';
import MonthFilterDropdown from './MonthFilterDropdown';
import { TrendingUp, Users, Truck, DollarSign, FileText, Receipt, FileDown, Table, ShieldAlert, CheckCircle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency } from '../utils/numberGenerator';
import { useDataStore } from '../lib/store';
import { getExpiryStatus } from './VehicleDocumentModal';
import type { PartyLedgerSummary, DashboardExportOptions } from '../utils/dashboardPartyLedgerExport';

interface DashboardProps {
  onNavigate?: (page: string, params?: any) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { memos, bills, bankingEntries, cashbookEntries, loadingSlips, vehicles } = useDataStore();
  
  // Multi-month filter state — default to current month
  const [selectedMonths, setSelectedMonths] = useState<string[]>(() => {
    const now = new Date();
    return [`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`];
  });

  // Helper: filter items by selected months array
  // If selectedMonths is empty → show everything (Overall mode)
  const filterByMonth = (items: any[], dateField: string = 'date') => {
    if (!selectedMonths || selectedMonths.length === 0) return items;
    return items.filter(item => {
      const itemDate = new Date(item[dateField]);
      const itemMonth = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}`;
      return selectedMonths.includes(itemMonth);
    });
  };

  // Filter data by selected month (only for profit and revenue calculations)
  const filteredBills = useMemo(() => filterByMonth(bills), [bills, selectedMonths]);
  const filteredMemos = useMemo(() => filterByMonth(memos), [memos, selectedMonths]);

  // Calculate vehicle document compliance alerts
  const vehicleExpiryAlerts = useMemo(() => {
    const alerts: Array<{
      vehicle_no: string;
      doc_name: string;
      date: string;
      status: 'expired' | 'expiring';
      label: string;
      days: number;
    }> = [];

    vehicles.forEach(vehicle => {
      const docs = [
        { doc_name: 'Insurance', date: vehicle.insurance_expiry },
        { doc_name: 'Fitness Certificate', date: vehicle.fitness_expiry },
        { doc_name: 'National/State Permit', date: vehicle.permit_expiry },
        { doc_name: 'PUC Certificate', date: vehicle.puc_expiry },
        { doc_name: 'Road Tax', date: vehicle.tax_expiry }
      ];

      docs.forEach(({ doc_name, date }) => {
        if (!date) return;
        const info = getExpiryStatus(date);
        if (info.status === 'expired' || info.status === 'expiring') {
          alerts.push({
            vehicle_no: vehicle.vehicle_no,
            doc_name,
            date,
            status: info.status as 'expired' | 'expiring',
            label: info.label,
            days: info.days || 0
          });
        }
      });
    });

    return alerts.sort((a, b) => a.days - b.days);
  }, [vehicles]);
  

  // Modal state
  const [showProfitModal, setShowProfitModal] = useState(false);

  // Calculate actual profit: Bill Net Amount (excluding TDS and Party Commission Cut) - Memo Net Amount
  const totalProfit = useMemo(() => {
    const totalBillNetAmount = filteredBills.reduce((sum, bill) => {
      const billNet = bill.bill_amount - (bill.mamool || 0) - (bill.commission || 0) + (bill.detention || 0) + (bill.rto || 0) + (bill.extra || 0) - (bill.penalties || 0) - (bill.party_commission_cut || 0);
      return sum + billNet;
    }, 0);
    const totalMemoNetAmount = filteredMemos.reduce((sum, memo) => sum + memo.net_amount, 0);
    return totalBillNetAmount - totalMemoNetAmount;
  }, [filteredBills, filteredMemos]);

  // Build per-trip profit breakdown (bill ↔ memo matched via loading_slip_id)
  const profitBreakdown = useMemo(() => {
    type ProfitRow = {
      slipId: string;
      bill: typeof filteredBills[0] | null;
      memo: typeof filteredMemos[0] | null;
      billNet: number;
      memoNet: number;
      profit: number;
      route: string;
      vehicle: string;
      party: string;
      supplier: string;
    };

    const rows: ProfitRow[] = [];
    const usedMemoIds = new Set<string>();

    // Helper: resolve loading_slip_id to string
    const resolveSlipId = (slipId: any): string => {
      if (!slipId) return '';
      if (typeof slipId === 'string') return slipId;
      return slipId._id || slipId.id || '';
    };

    filteredBills.forEach(bill => {
      const billSlipId = resolveSlipId(bill.loading_slip_id);
      const ls = loadingSlips.find(s => s.id === billSlipId || (s as any)._id === billSlipId);

      const billNet = bill.bill_amount - (bill.mamool || 0) - (bill.commission || 0)
        + (bill.detention || 0) + (bill.rto || 0) + (bill.extra || 0)
        - (bill.penalties || 0) - (bill.party_commission_cut || 0);

      // Try to find a matching memo for the same loading slip
      const matchedMemo = filteredMemos.find(m => {
        const mSlipId = resolveSlipId(m.loading_slip_id);
        return mSlipId && mSlipId === billSlipId && !usedMemoIds.has(m.id);
      });

      if (matchedMemo) usedMemoIds.add(matchedMemo.id);

      rows.push({
        slipId: billSlipId,
        bill,
        memo: matchedMemo || null,
        billNet,
        memoNet: matchedMemo ? matchedMemo.net_amount : 0,
        profit: billNet - (matchedMemo ? matchedMemo.net_amount : 0),
        route: ls ? `${ls.from_location} → ${ls.to_location}` : '—',
        vehicle: ls?.vehicle_no || bill.party || '—',
        party: bill.party,
        supplier: matchedMemo?.supplier || ls?.supplier || '—',
      });
    });

    // Unmatched memos (no corresponding bill in filtered period)
    const unmatchedMemos = filteredMemos.filter(m => !usedMemoIds.has(m.id));
    unmatchedMemos.forEach(memo => {
      const mSlipId = resolveSlipId(memo.loading_slip_id);
      const ls = loadingSlips.find(s => s.id === mSlipId || (s as any)._id === mSlipId);
      rows.push({
        slipId: mSlipId,
        bill: null,
        memo,
        billNet: 0,
        memoNet: memo.net_amount,
        profit: -memo.net_amount,
        route: ls ? `${ls.from_location} → ${ls.to_location}` : '—',
        vehicle: ls?.vehicle_no || '—',
        party: ls?.party || '—',
        supplier: memo.supplier,
      });
    });

    // Sort: matched pairs first (highest profit first), then unmatched
    rows.sort((a, b) => {
      const aMatched = a.bill && a.memo ? 1 : 0;
      const bMatched = b.bill && b.memo ? 1 : 0;
      if (aMatched !== bMatched) return bMatched - aMatched;
      return b.profit - a.profit;
    });

    return rows;
  }, [filteredBills, filteredMemos, loadingSlips]);

  // Calculate party balance (bills due from parties) - OVERALL, not filtered by month
  const partyBalance = useMemo(() => {
    const balance = bills
      .filter(bill => bill.status !== 'received') // Exclude paid/received bills
      .reduce((sum, bill) => {
      // Calculate total bill amount (what party owes)
      const billAmount = bill.bill_amount || 0;
      const detention = bill.detention || 0;
      const extra = bill.extra || 0;
      const rto = bill.rto || 0;
      const mamool = bill.mamool || 0;
      const tds = bill.tds || 0;
      const penalties = bill.penalties || 0;

      // Net amount party owes = Bill Amount + Extras - Deductions
      const partyOwes = billAmount + detention + extra + rto - mamool - tds - penalties;

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

      const billPayments = bankingPayments + cashbookPayments;
      const billBalance = partyOwes - billPayments;

      // Only include positive balances (pending amounts)
      const pendingAmount = Math.max(0, billBalance);

      return sum + pendingAmount;
    }, 0);

    // Subtract party on account payments from total balance
    const partyOnAccountPayments = bankingEntries
      .filter(entry => entry.type === 'credit' && entry.category === 'party_on_account')
      .reduce((sum, entry) => sum + entry.amount, 0);

    const partyOnAccountCashPayments = cashbookEntries
      .filter(entry => entry.type === 'credit' && entry.category === 'party_on_account')
      .reduce((sum, entry) => sum + entry.amount, 0);

    // Subtract party debit notes from total balance (debit notes reduce what party owes us)
    const partyDebitNotes = bankingEntries
      .filter(entry => entry.type === 'credit' && entry.category === 'party_debit_note')
      .reduce((sum, entry) => sum + entry.amount, 0);

    const totalOnAccountPayments = partyOnAccountPayments + partyOnAccountCashPayments;
    const totalDebitNotes = partyDebitNotes;
    const finalBalance = Math.max(0, balance - totalOnAccountPayments - totalDebitNotes);

    return finalBalance;
  }, [bills, bankingEntries, cashbookEntries]);

  // Calculate supplier balance (memos due to suppliers - EXCLUDING own vehicles) - OVERALL, not filtered by month
  const supplierBalance = useMemo(() => {
    const balance = memos
      .filter(memo => memo.status !== 'paid') // Exclude memos explicitly marked as paid
      .reduce((sum, memo) => {
        let loadingSlipId: string | undefined;
        if (typeof memo.loading_slip_id === 'string') {
          loadingSlipId = memo.loading_slip_id;
        } else if (memo.loading_slip_id && typeof memo.loading_slip_id === 'object') {
          loadingSlipId = (memo.loading_slip_id as any)._id || (memo.loading_slip_id as any).id;
        }

        // Find loading slip and vehicle to check if explicitly an OWN vehicle
        const ls = loadingSlipId
          ? loadingSlips.find(s => s.id === loadingSlipId || (s as any)._id === loadingSlipId || String((s as any)._id) === String(loadingSlipId))
          : undefined;

        const vehicleNo = ls?.vehicle_no || memo.vehicle_no;
        const vehicle = vehicleNo ? vehicles.find(v => v.vehicle_no?.trim().toUpperCase() === vehicleNo.trim().toUpperCase()) : undefined;

        // Skip ONLY if explicitly marked as an own vehicle
        if (vehicle && vehicle.ownership_type === 'own') return sum;

        // Payments from banking and cashbook for this memo
        const bankingPayments = bankingEntries
          .filter(entry => entry.reference_id === memo.memo_number && entry.type === 'debit')
          .reduce((total, entry) => total + entry.amount, 0);

        const cashbookPayments = cashbookEntries
          .filter(entry => entry.reference_id === memo.memo_number && entry.type === 'debit')
          .reduce((total, entry) => total + entry.amount, 0);

        // Include fuel / extra advances logged on memo object
        const fuelAdvances = (memo.advance_payments || []).reduce((advSum, a) => advSum + (a.amount || 0), 0);

        const memoPayments = bankingPayments + cashbookPayments + fuelAdvances;
        const memoBalance = Math.max(0, (memo.net_amount || 0) - memoPayments);

        return sum + memoBalance;
      }, 0);

    // Subtract supplier on account payments from total balance
    const supplierOnAccountPayments = bankingEntries
      .filter(entry => entry.type === 'debit' && (entry.category as any) === 'supplier_on_account')
      .reduce((sum, entry) => sum + entry.amount, 0);

    const supplierOnAccountCashPayments = cashbookEntries
      .filter(entry => entry.type === 'debit' && entry.category === 'supplier_on_account')
      .reduce((sum, entry) => sum + entry.amount, 0);

    // Subtract supplier debit notes from total balance (debit notes reduce what we owe suppliers)
    const supplierDebitNotes = bankingEntries
      .filter(entry => entry.type === 'credit' && (entry.category as any) === 'supplier_debit_note')
      .reduce((sum, entry) => sum + entry.amount, 0);

    const totalSupplierOnAccountPayments = supplierOnAccountPayments + supplierOnAccountCashPayments;
    const totalSupplierDebitNotes = supplierDebitNotes;
    const finalSupplierBalance = Math.max(0, balance - totalSupplierOnAccountPayments - totalSupplierDebitNotes);

    return finalSupplierBalance;
  }, [memos, loadingSlips, vehicles, bankingEntries, cashbookEntries]);

  // ─── Compute full per-party ledger summaries for PDF/Excel export ─────
  const allPartyLedgerSummaries = useMemo((): PartyLedgerSummary[] => {
    // Unique party names from bills
    const partyNames = Array.from(new Set(bills.map(b => b.party))).sort();

    return partyNames.map(partyName => {
      const partyBills = bills
        .filter(b => b.party === partyName)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const partyBankingEntries = bankingEntries.filter(entry => {
        if (
          (entry.category === 'bill_payment' || entry.category === 'bill_advance') &&
          partyBills.some(bill => bill.bill_number === entry.reference_id)
        ) return true;
        if (entry.category === 'party_on_account' && entry.reference_name === partyName) return true;
        if (entry.category === 'party_debit_note' && entry.reference_name === partyName) return true;
        return false;
      });

      const partyCashbookEntries = (cashbookEntries || []).filter(entry => {
        if (
          (entry.category === 'bill_payment' || entry.category === 'bill_advance') &&
          partyBills.some(bill => bill.bill_number === entry.reference_id)
        ) return true;
        if (entry.category === 'party_on_account' && entry.reference_name === partyName) return true;
        if (entry.category === 'party_commission' && entry.reference_name === partyName) return true;
        return false;
      });

      // Build combined timeline
      const allEntries: Array<{
        type: 'bill' | 'payment' | 'advance' | 'on_account' | 'debit_note';
        date: string;
        data: any;
        source?: 'bank' | 'cash';
      }> = [];

      partyBills.forEach(bill => allEntries.push({ type: 'bill', date: bill.date, data: bill }));
      partyBankingEntries.forEach(entry => {
        if (entry.category === 'bill_payment') allEntries.push({ type: 'payment', date: entry.date, data: entry, source: 'bank' });
        else if (entry.category === 'bill_advance') allEntries.push({ type: 'advance', date: entry.date, data: entry, source: 'bank' });
        else if (entry.category === 'party_on_account') allEntries.push({ type: 'on_account', date: entry.date, data: entry, source: 'bank' });
        else if (entry.category === 'party_debit_note') allEntries.push({ type: 'debit_note', date: entry.date, data: entry, source: 'bank' });
      });
      partyCashbookEntries.forEach(entry => {
        if (entry.category === 'bill_payment') allEntries.push({ type: 'payment', date: entry.date, data: entry, source: 'cash' });
        else if (entry.category === 'bill_advance') allEntries.push({ type: 'advance', date: entry.date, data: entry, source: 'cash' });
        else if (entry.category === 'party_on_account') allEntries.push({ type: 'on_account', date: entry.date, data: entry, source: 'cash' });
        else if (entry.category === 'party_commission') allEntries.push({ type: 'on_account', date: entry.date, data: entry, source: 'cash' });
      });

      allEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Build ledger rows
      let runningBalance = 0;
      let totalNetBills = 0;
      let totalPayments = 0;
      const rows: PartyLedgerSummary['entries'] = [];

      allEntries.forEach(entry => {
        const bill = entry.type === 'bill'
          ? entry.data
          : partyBills.find(b => b.bill_number === entry.data.reference_id);
        const ls = bill ? loadingSlips.find(s => s.id === bill.loading_slip_id) : null;
        const tripDetails = ls
          ? `${ls.from_location} – ${ls.to_location} / ${ls.vehicle_no}`
          : '';

        let credit = 0;
        let debitPayment = 0;
        let remarks = '';
        let billAmount = 0, detention = 0, extra = 0, rto = 0, tds = 0, mamool = 0, commission = 0, penalties = 0;

        if (entry.type === 'bill') {
          billAmount = entry.data.bill_amount || 0;
          detention = entry.data.detention || 0;
          extra = entry.data.extra || 0;
          rto = entry.data.rto || 0;
          tds = entry.data.tds || 0;
          mamool = entry.data.mamool || 0;
          commission = entry.data.commission || 0;
          penalties = entry.data.penalties || 0;
          credit = billAmount + detention + extra + rto - mamool - commission - tds - penalties;

          const billAdvances = partyBankingEntries.filter(
            be => be.category === 'bill_advance' && be.reference_id === entry.data.bill_number
          );
          const totalAdv = billAdvances.reduce((s, a) => s + a.amount, 0);
          runningBalance += credit - totalAdv;
          totalNetBills += credit;
          remarks = totalAdv > 0
            ? `Bill Created (Adv ₹${totalAdv.toLocaleString('en-IN')})`
            : 'Bill Created';
        } else if (entry.type === 'payment') {
          debitPayment = entry.data.amount;
          runningBalance -= debitPayment;
          totalPayments += debitPayment;
          remarks = `Payment (${entry.source?.toUpperCase() || ''})`;
        } else if (entry.type === 'advance') {
          return; // already accounted
        } else if (entry.type === 'on_account') {
          debitPayment = entry.data.amount;
          runningBalance -= debitPayment;
          totalPayments += debitPayment;
          remarks = `On Account (${entry.source?.toUpperCase() || ''})`;
        } else if (entry.type === 'debit_note') {
          debitPayment = entry.data.amount;
          runningBalance -= debitPayment;
          totalPayments += debitPayment;
          remarks = `Debit Note - ${entry.data.narration || 'Adj'}`;
        }

        rows.push({
          date: entry.date,
          billNo: bill?.bill_number || '',
          tripDetails,
          billAmount,
          detention,
          extra,
          rto,
          tds,
          mamool,
          commission,
          penalties,
          netBill: credit,
          debitPayment,
          runningBalance,
          remarks,
        });
      });

      return {
        partyName: partyName,
        totalBills: partyBills.length,
        totalNetBillAmount: totalNetBills,
        totalPayments: totalPayments,
        outstandingBalance: runningBalance,
        entries: rows,
      };
    });
  }, [bills, bankingEntries, cashbookEntries, loadingSlips]);

  // ─── Export handlers ──────────────────────────────────────────────────
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const { generateDashboardPartyLedgerPDF } = await import(
        '../utils/dashboardPartyLedgerExport'
      );
      await generateDashboardPartyLedgerPDF({
        parties: allPartyLedgerSummaries,
        grandTotalOutstanding: allPartyLedgerSummaries
          .filter(p => p.outstandingBalance > 0)
          .reduce((s, p) => s + p.outstandingBalance, 0),
        exportDate: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('PDF export failed:', err);
      alert(`PDF export failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const { generateDashboardPartyLedgerExcel } = await import(
        '../utils/dashboardPartyLedgerExport'
      );
      await generateDashboardPartyLedgerExcel({
        parties: allPartyLedgerSummaries,
        grandTotalOutstanding: allPartyLedgerSummaries
          .filter(p => p.outstandingBalance > 0)
          .reduce((s, p) => s + p.outstandingBalance, 0),
        exportDate: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('Excel export failed:', err);
      alert(`Excel export failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Calculate monthly revenue (total bill amounts)
  const monthlyRevenue = useMemo(() => {
    return filteredBills.reduce((sum, bill) => sum + bill.bill_amount, 0);
  }, [filteredBills]);

  const stats = [
    {
      title: 'Total Profit (Bill - Memo)',
      value: formatCurrency(totalProfit),
      icon: TrendingUp,
      color: totalProfit >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
      iconBg: totalProfit >= 0 ? 'bg-green-100' : 'bg-red-100',
      clickable: true,
      onClick: () => setShowProfitModal(true),
    },
    {
      title: 'Party Balance',
      value: formatCurrency(partyBalance),
      icon: Users,
      color: 'bg-blue-50 text-blue-700',
      iconBg: 'bg-blue-100',
      clickable: true,
      onClick: () => onNavigate?.('parties'),
    },
    {
      title: 'Supplier Balance',
      value: formatCurrency(supplierBalance),
      icon: Truck,
      color: 'bg-orange-50 text-orange-700',
      iconBg: 'bg-orange-100',
      clickable: true,
      onClick: () => onNavigate?.('suppliers'),
    },
    {
      title: selectedMonths.length === 0 ? 'Total Revenue' : selectedMonths.length === 1 ? 'Monthly Revenue' : 'Multi-Month Revenue',
      value: formatCurrency(monthlyRevenue),
      icon: DollarSign,
      color: 'bg-purple-50 text-purple-700',
      iconBg: 'bg-purple-100',
      clickable: false,
      onClick: undefined,
    },
  ];

  // Get recent bills and memos from filtered data
  const recentBills = filteredBills.slice(0, 5).map((bill, index) => ({
    id: bill.id || `bill-${index}-${Date.now()}`,
    bill_number: bill.bill_number,
    party: bill.party,
    amount: bill.net_amount,
    date: bill.date,
    status: 'Pending' // TODO: Add status tracking
  }));

  const recentMemos = filteredMemos.slice(0, 5).map((memo, index) => ({
    id: memo.id || `memo-${index}-${Date.now()}`,
    memo_number: memo.memo_number,
    supplier: memo.supplier,
    amount: memo.net_amount,
    date: memo.date,
    status: 'Pending' // TODO: Add status tracking
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center space-x-4">
          <MonthFilterDropdown
            selectedMonths={selectedMonths}
            onChange={setSelectedMonths}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={`stat-${stat.title}-${index}`}
              className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 transition-all duration-200 ${
                stat.clickable
                  ? 'cursor-pointer hover:shadow-md hover:border-blue-300 hover:scale-[1.02]'
                  : ''
              }`}
              onClick={stat.onClick}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
                  {stat.clickable && (
                    <p className="text-xs text-blue-600 mt-1">Click to view details →</p>
                  )}
                </div>
                <div className={`w-12 h-12 rounded-lg ${stat.iconBg} flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${stat.color.split(' ')[1]}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Vehicle Document & Compliance Expiry Alerts Widget ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${vehicleExpiryAlerts.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
              {vehicleExpiryAlerts.length > 0 ? <ShieldAlert className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                Vehicle Compliance & Expiry Tracker
                {vehicleExpiryAlerts.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white">
                    {vehicleExpiryAlerts.length} Action Needed
                  </span>
                )}
              </h3>
              <p className="text-sm text-gray-500">
                Track Insurance, Fitness, Permit, PUC & Tax renewal dates for your fleet
              </p>
            </div>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate('vehicle-ownership')}
              className="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1"
            >
              <Truck className="w-4 h-4" />
              <span>Manage Vehicle Expiries →</span>
            </button>
          )}
        </div>

        {vehicleExpiryAlerts.length === 0 ? (
          <div className="flex items-center space-x-3 p-4 bg-emerald-50 rounded-lg border border-emerald-100 text-emerald-800">
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span className="text-sm font-medium">All vehicle documents (Insurance, Fitness, Permits, PUC, Tax) are up to date!</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {vehicleExpiryAlerts.slice(0, 6).map((alert, idx) => (
              <div
                key={`exp-alert-${alert.vehicle_no}-${alert.doc_name}-${idx}`}
                className={`p-3.5 rounded-xl border flex items-center justify-between ${
                  alert.status === 'expired' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
                }`}
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-gray-900 text-sm">{alert.vehicle_no}</span>
                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                      alert.status === 'expired' ? 'bg-red-600 text-white' : 'bg-amber-600 text-white'
                    }`}>
                      {alert.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 font-medium mt-0.5">{alert.doc_name}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-bold block ${alert.status === 'expired' ? 'text-red-700' : 'text-amber-800'}`}>
                    {alert.label}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    {new Date(alert.date).toLocaleDateString('en-IN')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Party Ledger Export Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Party Ledger Report</h3>
              <p className="text-sm text-gray-500">
                Export all parties' ledger with bills, payments &amp; outstanding balances
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleExportPDF}
              disabled={isExporting || bills.length === 0}
              className="inline-flex items-center px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors space-x-2 shadow-sm"
            >
              <FileDown className="w-4 h-4" />
              <span>{isExporting ? 'Generating...' : 'Download PDF'}</span>
            </button>
            <button
              onClick={handleExportExcel}
              disabled={isExporting || bills.length === 0}
              className="inline-flex items-center px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors space-x-2 shadow-sm"
            >
              <Table className="w-4 h-4" />
              <span>{isExporting ? 'Generating...' : 'Download Excel'}</span>
            </button>
          </div>
        </div>

        {/* Quick party-wise outstanding preview */}
        {allPartyLedgerSummaries.filter(p => p.outstandingBalance > 0).length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Top Outstanding Parties</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {allPartyLedgerSummaries
                .filter(p => p.outstandingBalance > 0)
                .sort((a, b) => b.outstandingBalance - a.outstandingBalance)
                .slice(0, 4)
                .map((party, idx) => (
                  <div key={`top-party-${idx}`} className="bg-red-50 rounded-lg p-3 border border-red-100">
                    <div className="text-sm font-medium text-gray-800 truncate">{party.partyName}</div>
                    <div className="text-lg font-bold text-red-700 mt-1">{formatCurrency(party.outstandingBalance)}</div>
                    <div className="text-xs text-gray-500">{party.totalBills} bills</div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent Bills</h3>
          </div>
          <div className="p-6">
            {recentBills.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No recent bills found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentBills.map((bill) => (
                  <div key={`bill-${bill.id}`} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{bill.bill_number}</div>
                      <div className="text-sm text-gray-500">{bill.party}</div>
                      <div className="text-xs text-gray-400">{new Date(bill.date).toLocaleDateString('en-IN')}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-gray-900">{formatCurrency(bill.amount)}</div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        bill.status === 'Paid' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {bill.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent Memos</h3>
          </div>
          <div className="p-6">
            {recentMemos.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <Receipt className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No recent memos found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentMemos.map((memo) => (
                  <div key={`memo-${memo.id}`} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{memo.memo_number}</div>
                      <div className="text-sm text-gray-500">{memo.supplier}</div>
                      <div className="text-xs text-gray-400">{new Date(memo.date).toLocaleDateString('en-IN')}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-gray-900">{formatCurrency(memo.amount)}</div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        memo.status === 'Paid' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {memo.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Profit Breakdown Modal ── */}
      {showProfitModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-6 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-green-600 to-emerald-600 rounded-t-2xl">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Profit Breakdown — Bill vs Memo
                </h2>
                <p className="text-green-100 text-sm mt-0.5">
                  {selectedMonths.length === 0
                    ? 'All time'
                    : selectedMonths.length === 1
                    ? new Date(selectedMonths[0] + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
                    : `${selectedMonths.length} months selected`}
                  {' · '}{profitBreakdown.length} trip{profitBreakdown.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => setShowProfitModal(false)}
                className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary Bar */}
            <div className="grid grid-cols-3 gap-0 border-b border-gray-100">
              <div className="px-6 py-4 text-center border-r border-gray-100">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Total Bill (Net)</div>
                <div className="text-xl font-bold text-blue-600">
                  {formatCurrency(profitBreakdown.reduce((s, r) => s + r.billNet, 0))}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{filteredBills.length} bills</div>
              </div>
              <div className="px-6 py-4 text-center border-r border-gray-100">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Total Memo (Net)</div>
                <div className="text-xl font-bold text-orange-600">
                  {formatCurrency(profitBreakdown.reduce((s, r) => s + r.memoNet, 0))}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{filteredMemos.length} memos</div>
              </div>
              <div className="px-6 py-4 text-center">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Net Profit</div>
                <div className={`text-xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totalProfit)}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {profitBreakdown.filter(r => r.bill && r.memo).length} matched pairs
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              {profitBreakdown.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">No bills or memos found for this period.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Bill No.</th>
                      <th className="px-4 py-3 text-left">Memo No.</th>
                      <th className="px-4 py-3 text-left">Route</th>
                      <th className="px-4 py-3 text-left">Vehicle</th>
                      <th className="px-4 py-3 text-left">Party</th>
                      <th className="px-4 py-3 text-left">Supplier</th>
                      <th className="px-4 py-3 text-right">Bill Net</th>
                      <th className="px-4 py-3 text-right">Memo Net</th>
                      <th className="px-4 py-3 text-right">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {profitBreakdown.map((row, idx) => (
                      <ProfitRow key={idx} row={row} formatCurrency={formatCurrency} />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
                      <td colSpan={6} className="px-4 py-3 text-gray-700">Totals</td>
                      <td className="px-4 py-3 text-right text-blue-700">
                        {formatCurrency(profitBreakdown.reduce((s, r) => s + r.billNet, 0))}
                      </td>
                      <td className="px-4 py-3 text-right text-orange-700">
                        {formatCurrency(profitBreakdown.reduce((s, r) => s + r.memoNet, 0))}
                      </td>
                      <td className={`px-4 py-3 text-right ${
                        totalProfit >= 0 ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {formatCurrency(totalProfit)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowProfitModal(false)}
                className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Sub-component: expandable profit row ──────────────────────────────────
interface ProfitRowProps {
  row: {
    bill: any;
    memo: any;
    billNet: number;
    memoNet: number;
    profit: number;
    route: string;
    vehicle: string;
    party: string;
    supplier: string;
  };
  formatCurrency: (n: number) => string;
}

const ProfitRow: React.FC<ProfitRowProps> = ({ row, formatCurrency }) => {
  const [expanded, setExpanded] = useState(false);
  const profit = row.profit;

  return (
    <>
      <tr
        className={`hover:bg-gray-50 transition-colors cursor-pointer ${
          !row.bill ? 'bg-orange-50/40' : !row.memo ? 'bg-blue-50/40' : ''
        }`}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Bill No */}
        <td className="px-4 py-3">
          {row.bill ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold text-xs">
              {row.bill.bill_number}
            </span>
          ) : (
            <span className="text-gray-300 text-xs italic">No Bill</span>
          )}
        </td>
        {/* Memo No */}
        <td className="px-4 py-3">
          {row.memo ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-orange-100 text-orange-800 font-semibold text-xs">
              {row.memo.memo_number}
            </span>
          ) : (
            <span className="text-gray-300 text-xs italic">No Memo</span>
          )}
        </td>
        {/* Route */}
        <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate" title={row.route}>{row.route}</td>
        {/* Vehicle */}
        <td className="px-4 py-3 font-medium text-gray-800">{row.vehicle}</td>
        {/* Party */}
        <td className="px-4 py-3 text-gray-600 max-w-[120px] truncate" title={row.party}>{row.party}</td>
        {/* Supplier */}
        <td className="px-4 py-3 text-gray-600 max-w-[120px] truncate" title={row.supplier}>{row.supplier}</td>
        {/* Bill Net */}
        <td className="px-4 py-3 text-right font-medium text-blue-700">
          {row.billNet > 0 ? formatCurrency(row.billNet) : <span className="text-gray-300">—</span>}
        </td>
        {/* Memo Net */}
        <td className="px-4 py-3 text-right font-medium text-orange-700">
          {row.memoNet > 0 ? formatCurrency(row.memoNet) : <span className="text-gray-300">—</span>}
        </td>
        {/* Profit */}
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            <span className={`font-bold ${
              profit > 0 ? 'text-green-600' : profit < 0 ? 'text-red-600' : 'text-gray-500'
            }`}>
              {profit > 0 ? '+' : ''}{formatCurrency(profit)}
            </span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
          </div>
        </td>
      </tr>

      {/* Expanded details row */}
      {expanded && (
        <tr className="bg-gradient-to-r from-gray-50 to-slate-50">
          <td colSpan={9} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Bill Details */}
              {row.bill && (
                <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
                  <div className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-3 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" /> Bill Details — {row.bill.bill_number}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Date</span>
                      <span className="font-medium">{new Date(row.bill.date).toLocaleDateString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Party</span>
                      <span className="font-medium">{row.bill.party}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Bill Amount</span>
                      <span className="font-medium text-blue-700">{formatCurrency(row.bill.bill_amount)}</span>
                    </div>
                    {(row.bill.detention || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Detention</span>
                        <span className="font-medium text-green-600">+{formatCurrency(row.bill.detention)}</span>
                      </div>
                    )}
                    {(row.bill.extra || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Extra</span>
                        <span className="font-medium text-green-600">+{formatCurrency(row.bill.extra)}</span>
                      </div>
                    )}
                    {(row.bill.rto || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">RTO</span>
                        <span className="font-medium text-green-600">+{formatCurrency(row.bill.rto)}</span>
                      </div>
                    )}
                    {(row.bill.mamool || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Mamool</span>
                        <span className="font-medium text-red-500">-{formatCurrency(row.bill.mamool)}</span>
                      </div>
                    )}
                    {(row.bill.commission || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Commission</span>
                        <span className="font-medium text-red-500">-{formatCurrency(row.bill.commission)}</span>
                      </div>
                    )}
                    {(row.bill.tds || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">TDS</span>
                        <span className="font-medium text-red-500">-{formatCurrency(row.bill.tds)}</span>
                      </div>
                    )}
                    {(row.bill.penalties || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Penalties</span>
                        <span className="font-medium text-red-500">-{formatCurrency(row.bill.penalties)}</span>
                      </div>
                    )}
                    {(row.bill.party_commission_cut || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Party Comm. Cut</span>
                        <span className="font-medium text-red-500">-{formatCurrency(row.bill.party_commission_cut)}</span>
                      </div>
                    )}
                    <div className="col-span-2 border-t border-blue-200 pt-1.5 mt-0.5 flex justify-between">
                      <span className="font-semibold text-gray-700">Net Bill</span>
                      <span className="font-bold text-blue-700">{formatCurrency(row.billNet)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Status</span>
                      <span className={`font-medium ${
                        row.bill.status === 'received' ? 'text-green-600' : 'text-yellow-600'
                      }`}>{row.bill.status === 'received' ? 'Received ✓' : 'Pending'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Memo Details */}
              {row.memo && (
                <div className="bg-orange-50 rounded-xl border border-orange-100 p-4">
                  <div className="text-xs font-bold text-orange-600 uppercase tracking-wide mb-3 flex items-center gap-1">
                    <Receipt className="w-3.5 h-3.5" /> Memo Details — {row.memo.memo_number}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Date</span>
                      <span className="font-medium">{new Date(row.memo.date).toLocaleDateString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Supplier</span>
                      <span className="font-medium">{row.memo.supplier}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Freight</span>
                      <span className="font-medium text-orange-700">{formatCurrency(row.memo.freight)}</span>
                    </div>
                    {(row.memo.commission || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Commission</span>
                        <span className="font-medium text-red-500">-{formatCurrency(row.memo.commission)}</span>
                      </div>
                    )}
                    {(row.memo.mamool || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Mamool</span>
                        <span className="font-medium text-red-500">-{formatCurrency(row.memo.mamool)}</span>
                      </div>
                    )}
                    {(row.memo.detention || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Detention</span>
                        <span className="font-medium text-green-600">+{formatCurrency(row.memo.detention)}</span>
                      </div>
                    )}
                    {(row.memo.extra || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Extra</span>
                        <span className="font-medium text-green-600">+{formatCurrency(row.memo.extra)}</span>
                      </div>
                    )}
                    {(row.memo.rto || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">RTO</span>
                        <span className="font-medium text-green-600">+{formatCurrency(row.memo.rto)}</span>
                      </div>
                    )}
                    {(row.memo.deduction || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Deduction</span>
                        <span className="font-medium text-red-500">-{formatCurrency(row.memo.deduction)}</span>
                      </div>
                    )}
                    <div className="col-span-2 border-t border-orange-200 pt-1.5 mt-0.5 flex justify-between">
                      <span className="font-semibold text-gray-700">Net Memo</span>
                      <span className="font-bold text-orange-700">{formatCurrency(row.memoNet)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Status</span>
                      <span className={`font-medium ${
                        row.memo.status === 'paid' ? 'text-green-600' : 'text-yellow-600'
                      }`}>{row.memo.status === 'paid' ? 'Paid ✓' : 'Pending'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* If only bill (no memo) */}
              {row.bill && !row.memo && (
                <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-4 flex items-center justify-center">
                  <p className="text-sm text-gray-400 italic">No memo linked to this loading slip</p>
                </div>
              )}
              {/* If only memo (no bill) */}
              {row.memo && !row.bill && (
                <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-4 flex items-center justify-center">
                  <p className="text-sm text-gray-400 italic">No bill linked to this loading slip</p>
                </div>
              )}
            </div>

            {/* Profit summary for this row */}
            <div className={`mt-3 px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-between ${
              profit > 0 ? 'bg-green-100 text-green-800' : profit < 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'
            }`}>
              <span>Trip Profit</span>
              <span className="text-base">{profit > 0 ? '+' : ''}{formatCurrency(profit)}</span>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

export default Dashboard;