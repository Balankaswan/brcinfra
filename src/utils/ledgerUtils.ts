import type { Bill, Memo, BankingEntry, LoadingSlip, Vehicle } from '../types';

export interface OutstandingBalance {
  partyName: string;
  totalBills: number;
  totalPayments: number;
  totalAdvances: number;
  outstandingAmount: number;
}

export interface SupplierOutstandingBalance {
  supplierName: string;
  totalMemos: number;
  totalDetention: number;
  totalExtraWeight: number;
  totalPayments: number;
  totalAdvances: number;
  totalCommission: number;
  totalMamul: number;
  outstandingAmount: number;
}

/**
 * Calculate outstanding balance for a specific party
 */
export const calculatePartyBalance = (
  partyName: string,
  bills: Bill[],
  bankingEntries: BankingEntry[]
): OutstandingBalance => {
  // Get all bills for this party
  const partyBills = bills.filter(bill => bill.party === partyName);
  
  // Calculate total bill amounts including detention, extra, RTO minus deductions
  const totalBills = partyBills.reduce((sum, bill) => {
    const netAmount = bill.bill_amount + (bill.detention || 0) + (bill.extra || 0) + (bill.rto || 0) - (bill.mamool || 0) - (bill.penalties || 0) - (bill.tds || 0);
    return sum + netAmount;
  }, 0);
  
  // Get all payments and advances for this party's bills
  const partyBankingEntries = bankingEntries.filter(entry => 
    (entry.category === 'bill_payment' || entry.category === 'bill_advance') &&
    partyBills.some(bill => bill.bill_number === entry.reference_id)
  );
  
  const totalPayments = partyBankingEntries
    .filter(entry => entry.category === 'bill_payment')
    .reduce((sum, entry) => sum + entry.amount, 0);
    
  const totalAdvances = partyBankingEntries
    .filter(entry => entry.category === 'bill_advance')
    .reduce((sum, entry) => sum + entry.amount, 0);
  
  // Balance = Total Bill Amount – (Payments Received + Advance Received)
  const outstandingAmount = totalBills - (totalPayments + totalAdvances);
  
  return {
    partyName,
    totalBills,
    totalPayments,
    totalAdvances,
    outstandingAmount
  };
};

/**
 * Calculate outstanding balance for a specific supplier
 */
export const calculateSupplierBalance = (
  supplierName: string,
  memos: Memo[],
  bankingEntries: BankingEntry[]
): SupplierOutstandingBalance => {
  const sNameLower = (supplierName || '').trim().toLowerCase();

  // Get all memos for this supplier (case-insensitive)
  const supplierMemos = memos.filter(memo => memo.supplier && memo.supplier.trim().toLowerCase() === sNameLower);

  // Calculate totals from memos using Freight Memo formula
  const totalFreight = supplierMemos.reduce((sum, memo) => sum + (memo.freight || 0), 0);
  const totalDetention = supplierMemos.reduce((sum, memo) => sum + (memo.detention || 0), 0);
  const totalExtraWeight = supplierMemos.reduce((sum, memo) => sum + (memo.extra || 0), 0);
  const totalCommission = supplierMemos.reduce((sum, memo) => sum + (memo.commission || 0), 0);
  const totalMamul = supplierMemos.reduce((sum, memo) => sum + (memo.mamool || 0), 0);
  
  // Get all advances and payments for this supplier
  const supplierBankingEntries = bankingEntries.filter(entry => 
    (entry.category === 'memo_payment' || entry.category === 'memo_advance' || 
     entry.category === 'Memo Payment' || entry.category === 'Memo Advance' ||
     entry.category === 'Freight Memo Payment' || entry.category === 'Freight Memo Advance' ||
     (entry.reference_name && entry.reference_name.trim().toLowerCase() === sNameLower)) &&
    (supplierMemos.some(memo => memo.memo_number === entry.reference_id) || (entry.reference_name && entry.reference_name.trim().toLowerCase() === sNameLower))
  );
  
  const totalPayments = supplierBankingEntries
    .filter(entry => entry.category === 'memo_payment' || entry.category === 'Memo Payment' || entry.category === 'Freight Memo Payment' || entry.type === 'debit')
    .reduce((sum, entry) => sum + entry.amount, 0);
    
  const bankingAdvances = supplierBankingEntries
    .filter(entry => entry.category === 'memo_advance' || entry.category === 'Memo Advance' || entry.category === 'Freight Memo Advance')
    .reduce((sum, entry) => sum + entry.amount, 0);

  // Direct fuel / extra advances logged on memo objects
  const memoDirectAdvances = supplierMemos.reduce((sum, memo) => {
    const advs = memo.advance_payments || [];
    return sum + advs.reduce((aSum, a) => aSum + (a.amount || 0), 0);
  }, 0);

  const totalAdvances = bankingAdvances + memoDirectAdvances;

  // Net Freight Memos Total = Freight - Commission - Mamool + Extra + Detention
  const totalNetMemos = totalFreight - totalCommission - totalMamul + totalExtraWeight + totalDetention;
  
  // Outstanding Amount = Net Freight Memos - Advances - Payments
  const outstandingAmount = totalNetMemos - totalAdvances - totalPayments;
  
  return {
    supplierName,
    totalMemos: totalNetMemos,
    totalDetention,
    totalExtraWeight,
    totalPayments,
    totalAdvances,
    totalCommission,
    totalMamul,
    outstandingAmount
  };
};

/**
 * Get all party outstanding balances
 */
export const getAllPartyBalances = (
  bills: Bill[],
  bankingEntries: BankingEntry[]
): OutstandingBalance[] => {
  const parties = Array.from(new Set(bills.map(bill => bill.party)));
  
  return parties.map(party => calculatePartyBalance(party, bills, bankingEntries))
    .sort((a, b) => b.outstandingAmount - a.outstandingAmount);
};

/**
 * Get all supplier outstanding balances (excluding own vehicles)
 */
export const getAllSupplierBalances = (
  memos: Memo[],
  bankingEntries: BankingEntry[],
  loadingSlips?: LoadingSlip[],
  vehicles?: Vehicle[],
  masterSuppliers?: any[]
): SupplierOutstandingBalance[] => {
  // Filter out memos from own vehicles if loading slips and vehicles data is available
  let filteredMemos = memos;
  if (loadingSlips && vehicles) {
    filteredMemos = memos.filter(memo => {
      const loadingSlipId = typeof memo.loading_slip_id === 'string' ? memo.loading_slip_id : (memo.loading_slip_id as any)?._id || (memo.loading_slip_id as any)?.id;
      const ls = loadingSlips.find(s => s.id === loadingSlipId || (s as any)._id === loadingSlipId);
      const vehicle = vehicles.find(v => v.vehicle_no === ls?.vehicle_no);
      const isOwnVehicle = vehicle?.ownership_type === 'own';
      
      return !isOwnVehicle;
    });
  }
  
  const supplierNamesSet = new Set<string>();
  if (masterSuppliers && Array.isArray(masterSuppliers)) {
    masterSuppliers.forEach(s => {
      const name = typeof s === 'string' ? s : s?.name || s?.supplierName;
      if (name) supplierNamesSet.add(name);
    });
  }
  filteredMemos.forEach(memo => {
    if (memo.supplier) supplierNamesSet.add(memo.supplier);
  });

  const suppliers = Array.from(supplierNamesSet);
  
  return suppliers.map(supplier => calculateSupplierBalance(supplier, filteredMemos, bankingEntries))
    .sort((a, b) => b.outstandingAmount - a.outstandingAmount);
};

/**
 * Format currency for display
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Get ledger summary for a party
 */
export const getPartyLedgerSummary = (
  partyName: string,
  bills: Bill[],
  bankingEntries: BankingEntry[]
) => {
  const balance = calculatePartyBalance(partyName, bills, bankingEntries);
  const partyBills = bills.filter(bill => bill.party === partyName);
  
  return {
    ...balance,
    totalBillCount: partyBills.length,
    lastBillDate: partyBills.length > 0 ? 
      Math.max(...partyBills.map(bill => new Date(bill.date).getTime())) : null,
    status: balance.outstandingAmount > 0 ? 'pending' : 'cleared'
  };
};

/**
 * Get ledger summary for a supplier
 */
export const getSupplierLedgerSummary = (
  supplierName: string,
  memos: Memo[],
  bankingEntries: BankingEntry[]
) => {
  const balance = calculateSupplierBalance(supplierName, memos, bankingEntries);
  const supplierMemos = memos.filter(memo => memo.supplier === supplierName);
  
  return {
    ...balance,
    totalMemoCount: supplierMemos.length,
    lastMemoDate: supplierMemos.length > 0 ? 
      Math.max(...supplierMemos.map(memo => new Date(memo.date).getTime())) : null,
    status: balance.outstandingAmount > 0 ? 'pending' : 'cleared'
  };
};
