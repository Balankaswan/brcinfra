import React, { createContext, useContext, useState, useMemo } from 'react';
import { apiService } from './api';
import type { Bill, LoadingSlip, Memo, Party, Supplier, Vehicle, BankingEntry, CashbookEntry, LedgerEntry, PODFile, FuelWallet, FuelTransaction, VehicleFuelExpense } from '../types';

interface DataStoreState {
  loadingSlips: LoadingSlip[];
  memos: Memo[];
  bills: Bill[];
  bankingEntries: BankingEntry[];
  cashbookEntries: CashbookEntry[];
  ledgerEntries: LedgerEntry[];
  parties: Party[];
  suppliers: Supplier[];
  vehicles: Vehicle[];
  fuelWallets: FuelWallet[];
  fuelTransactions: FuelTransaction[];
  vehicleFuelExpenses: VehicleFuelExpense[];
  podFiles: PODFile[];
  // actions
  addLoadingSlip: (slip: LoadingSlip) => void;
  updateLoadingSlip: (slip: LoadingSlip) => void;
  deleteLoadingSlip: (id: string) => void;
  addMemo: (memo: Memo) => void;
  updateMemo: (memo: Memo) => void;
  deleteMemo: (id: string) => void;
  markMemoAsPaid: (id: string, paidDate: string, paidAmount: number) => void;
  addBill: (bill: Bill) => void;
  updateBill: (bill: Bill) => void;
  deleteBill: (id: string) => void;
  markBillAsReceived: (id: string, receivedDate: string, receivedAmount: number) => void;
  addBankingEntry: (entry: BankingEntry) => void;
  updateBankingEntry: (id: string, entry: BankingEntry) => void;
  deleteBankingEntry: (id: string) => void;
  setBankingEntries: (entries: BankingEntry[]) => void;
  setBills: (bills: Bill[]) => void;
  setMemos: (memos: Memo[]) => void;
  setLoadingSlips: (slips: LoadingSlip[]) => void;
  setLedgerEntries: (entries: LedgerEntry[]) => void;
  setCashbookEntries: (entries: CashbookEntry[]) => void;
  setPODFiles: (files: PODFile[]) => void;
  addCashbookEntry: (entry: CashbookEntry) => void;
  updateCashbookEntry: (entry: CashbookEntry) => void;
  deleteCashbookEntry: (id: string) => void;
  addParty: (party: Party) => void;
  updateParty: (party: Party) => void;
  deleteParty: (id: string) => void;
  setParties: (parties: Party[]) => void;
  addSupplier: (supplier: Supplier) => void;
  updateSupplier: (supplier: Supplier) => void;
  deleteSupplier: (id: string) => void;
  setSuppliers: (suppliers: Supplier[]) => void;
  addVehicle: (vehicle: Vehicle) => void;
  updateVehicle: (vehicle: Vehicle) => void;
  deleteVehicle: (id: string) => void;
  setVehicles: (vehicles: Vehicle[]) => void;
  addFuelWallet: (wallet: FuelWallet) => void;
  setFuelWallets: (wallets: FuelWallet[]) => void;
  setFuelTransactions: (transactions: FuelTransaction[]) => void;
  getFuelWalletBalance: (walletName: string) => number;
  getVehicleFuelExpenses: () => VehicleFuelExpense[];
  addPODFile: (file: PODFile) => void;
  deletePODFile: (id: string) => void;
  getPODFiles: () => PODFile[];
  allocateFuelToVehicle: (vehicleNo: string, walletName: string, amount: number, date: string, narration: string, fuelQuantity: number, ratePerLiter: number, odometerReading: number, fuelType: string, allocatedBy: string, supplier?: string) => void;
  bulkPaySupplierMemos: (memoIds: string[], paymentData: any) => void;
  bulkPayBills: (billIds: string[], paymentData: any) => void;
  cleanupSupplierLedgerForOwnVehicles: () => void;
}

const DataStoreContext = createContext<DataStoreState | null>(null);

export const DataStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loadingSlips, setLoadingSlipsState] = useState<LoadingSlip[]>(() => {
    try {
      const saved = localStorage.getItem('brc_loading_slips');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [memos, setMemosState] = useState<Memo[]>(() => {
    try {
      const saved = localStorage.getItem('brc_memos');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [bills, setBillsState] = useState<Bill[]>(() => {
    try {
      const saved = localStorage.getItem('brc_bills');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [bankingEntries, setBankingEntries] = useState<BankingEntry[]>([]);
  const [cashbookEntries, setCashbookEntries] = useState<CashbookEntry[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [fuelWallets, setFuelWallets] = useState<FuelWallet[]>([]);
  const [fuelTransactions, setFuelTransactions] = useState<FuelTransaction[]>([]);
  const [vehicleFuelExpenses] = useState<VehicleFuelExpense[]>([]);
  const [podFiles, setPodFiles] = useState<PODFile[]>([]);

  const setLoadingSlips = (slips: LoadingSlip[] | ((prev: LoadingSlip[]) => LoadingSlip[])) => {
    setLoadingSlipsState(prev => {
      const next = typeof slips === 'function' ? slips(prev) : slips;
      try { localStorage.setItem('brc_loading_slips', JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };

  const setMemos = (memos: Memo[] | ((prev: Memo[]) => Memo[])) => {
    setMemosState(prev => {
      const next = typeof memos === 'function' ? memos(prev) : memos;
      try { localStorage.setItem('brc_memos', JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };

  const setBills = (bills: Bill[] | ((prev: Bill[]) => Bill[])) => {
    setBillsState(prev => {
      const next = typeof bills === 'function' ? bills(prev) : bills;
      try { localStorage.setItem('brc_bills', JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };

  const contextValue: DataStoreState = useMemo(() => ({
    loadingSlips,
    memos,
    bills,
    bankingEntries,
    cashbookEntries,
    ledgerEntries,
    parties,
    suppliers,
    vehicles,
    fuelWallets,
    fuelTransactions,
    vehicleFuelExpenses,
    podFiles,

    // Loading slip actions
    addLoadingSlip: (slip) => {
      try { localStorage.setItem('lastLoadingSlipCreation', Date.now().toString()); } catch (e) {}
      setLoadingSlips(prev => [
        slip,
        ...prev.filter(s => s.id !== slip.id && (s as any)._id !== (slip as any)._id && (s.slip_number || s.lr_number) !== (slip.slip_number || slip.lr_number))
      ]);
    },
    updateLoadingSlip: (slip) => setLoadingSlips(prev => prev.map(s => (s.id === slip.id || (s as any)._id === (slip as any)._id || (s.slip_number && s.slip_number === slip.slip_number)) ? slip : s)),
    deleteLoadingSlip: (id) => {
      const slipToDelete = loadingSlips.find(s => s.id === id || (s as any)._id === id);
      const slipNoToDelete = slipToDelete?.slip_number || slipToDelete?.lr_number;
      setLoadingSlips(prev => prev.filter(s => {
        const matchesId = s.id === id || (s as any)._id === id;
        const matchesNo = slipNoToDelete && (s.slip_number === slipNoToDelete || s.lr_number === slipNoToDelete);
        return !matchesId && !matchesNo;
      }));
    },
    setLoadingSlips: (slips) => setLoadingSlips(slips),

    // Memo actions
    addMemo: (memo) => {
      try { localStorage.setItem('lastMemoCreation', Date.now().toString()); } catch (e) {}
      setMemos(prev => [
        memo,
        ...prev.filter(m => m.id !== memo.id && (m as any)._id !== (memo as any)._id && m.memo_number !== memo.memo_number)
      ]);
      const linkedIds = memo.loading_slip_ids && memo.loading_slip_ids.length > 0
        ? memo.loading_slip_ids
        : (memo.loading_slip_id ? [typeof memo.loading_slip_id === 'object' ? (memo.loading_slip_id as any)._id || (memo.loading_slip_id as any).id : memo.loading_slip_id] : []);
      if (linkedIds.length > 0) {
        setLoadingSlips(prev => prev.map(s => {
          const sId = s.id || (s as any)._id;
          if (linkedIds.includes(sId)) {
            return { ...s, memo_number: memo.memo_number, memo_id: memo.id || (memo as any)._id };
          }
          return s;
        }));
      }
    },
    updateMemo: (memo) => {
      setMemos(prev => prev.map(m => (m.id === memo.id || (m as any)._id === (memo as any)._id || m.memo_number === memo.memo_number) ? memo : m));
      const linkedIds = memo.loading_slip_ids && memo.loading_slip_ids.length > 0
        ? memo.loading_slip_ids
        : (memo.loading_slip_id ? [typeof memo.loading_slip_id === 'object' ? (memo.loading_slip_id as any)._id || (memo.loading_slip_id as any).id : memo.loading_slip_id] : []);
      if (linkedIds.length > 0) {
        setLoadingSlips(prev => prev.map(s => {
          const sId = s.id || (s as any)._id;
          if (linkedIds.includes(sId)) {
            return { ...s, memo_number: memo.memo_number, memo_id: memo.id || (memo as any)._id };
          }
          return s;
        }));
      }
    },
    deleteMemo: (id) => {
      const memoToDelete = memos.find(m => m.id === id || (m as any)._id === id || m.memo_number === id);
      const memoNoToDelete = memoToDelete?.memo_number || id;
      const linkedIds = memoToDelete?.loading_slip_ids || (memoToDelete?.loading_slip_id ? [typeof memoToDelete.loading_slip_id === 'object' ? (memoToDelete.loading_slip_id as any)._id || (memoToDelete.loading_slip_id as any).id : memoToDelete.loading_slip_id] : []);

      setMemos(prev => prev.filter(m => {
        const matchesId = m.id === id || (m as any)._id === id;
        const matchesNo = memoNoToDelete && m.memo_number === memoNoToDelete;
        return !matchesId && !matchesNo;
      }));
      if (memoToDelete) {
        setLoadingSlips(prev => prev.map(s => {
          const sId = s.id || (s as any)._id;
          const matchNo = s.memo_number && s.memo_number === memoNoToDelete;
          const matchId = (s.memo_id && (s.memo_id === id || s.memo_id === (memoToDelete as any)._id)) || (sId && linkedIds.includes(sId));
          if (matchNo || matchId) {
            return { ...s, memo_number: undefined, memo_id: undefined };
          }
          return s;
        }));
      }
      setTimeout(() => window.dispatchEvent(new CustomEvent('data-sync-required')), 100);
    },
    markMemoAsPaid: (id, paidDate, paidAmount) => {
      setMemos(prev => prev.map(m =>
        (m.id === id || (m as any)._id === id || m.memo_number === id) ? { ...m, status: 'paid', paid_date: paidDate, paid_amount: paidAmount } : m
      ));
    },
    setMemos: (memos) => setMemos(memos),

    // Bill actions
    addBill: (bill) => {
      try { localStorage.setItem('lastBillCreation', Date.now().toString()); } catch (e) {}
      setBills(prev => [
        bill,
        ...prev.filter(b => b.id !== bill.id && (b as any)._id !== (bill as any)._id && b.bill_number !== bill.bill_number)
      ]);
    },
    updateBill: (bill) => setBills(prev => prev.map(b => (b.id === bill.id || (b as any)._id === (bill as any)._id || b.bill_number === bill.bill_number) ? bill : b)),
    deleteBill: (id) => {
      const billToDelete = bills.find(b => b.id === id || (b as any)._id === id || b.bill_number === id);
      const billNoToDelete = billToDelete?.bill_number || id;

      setBills(prev => prev.filter(b => {
        const matchesId = b.id === id || (b as any)._id === id;
        const matchesNo = billNoToDelete && b.bill_number === billNoToDelete;
        return !matchesId && !matchesNo;
      }));
      if (billToDelete) {
        setLoadingSlips(prev => prev.map(s => {
          const matchNo = s.bill_number && s.bill_number === billNoToDelete;
          const matchId = (s.bill_id && (s.bill_id === id || s.bill_id === (billToDelete as any)._id)) || s.id === billToDelete.loading_slip_id;
          const matchLRs = billToDelete.loading_slip_ids?.includes(s.id || '') || billToDelete.loading_slip_ids?.includes((s as any)._id || '');
          if (matchNo || matchId || matchLRs) {
            return { ...s, bill_number: undefined, bill_id: undefined };
          }
          return s;
        }));
      }
      setTimeout(() => window.dispatchEvent(new CustomEvent('data-sync-required')), 100);
    },
    markBillAsReceived: (id, receivedDate, receivedAmount) => {
      setBills(prev => prev.map(b =>
        (b.id === id || (b as any)._id === id || b.bill_number === id) ? { ...b, status: 'received', received_date: receivedDate, received_amount: receivedAmount } : b
      ));
    },
    setBills: (bills) => setBills(bills),

    // Banking actions
    addBankingEntry: (entry) => {
      setBankingEntries(prev => {
        const entryId = entry.id || entry._id;
        const exists = prev.some(e => (e.id || e._id) === entryId);
        if (exists) return prev;
        return [entry, ...prev];
      });
      if (entry.reference_id) {
        if (entry.category === 'bill_advance' || entry.category === 'bill_payment') {
          setBills(prev => prev.map(b => {
            if (b.bill_number === entry.reference_id) {
              const currentAdvances = b.advance_payments || [];
              const alreadyHas = currentAdvances.some(a => (a as any).reference?.includes(String(entry.id || entry._id)));
              if (!alreadyHas) {
                const newAdv = {
                  id: String(entry.id || entry._id),
                  bill_id: b.id,
                  date: entry.date,
                  amount: entry.amount,
                  mode: (entry.payment_mode as any) || 'bank',
                  reference: `Banking Entry: ${entry.id || entry._id}`,
                  description: entry.narration || 'Bank payment'
                };
                const updatedAdvances = [...currentAdvances, newAdv];
                const newReceived = (b.received_amount || 0) + entry.amount;
                const isFullyReceived = newReceived >= (b.net_amount || b.bill_amount || 0);
                return {
                  ...b,
                  advance_payments: updatedAdvances,
                  received_amount: newReceived,
                  status: isFullyReceived ? 'received' : b.status,
                  received_date: isFullyReceived ? entry.date : b.received_date
                };
              }
            }
            return b;
          }));
        } else if (entry.category === 'memo_advance' || entry.category === 'memo_payment') {
          setMemos(prev => prev.map(m => {
            if (m.memo_number === entry.reference_id) {
              const currentAdvances = m.advance_payments || [];
              const alreadyHas = currentAdvances.some(a => (a as any).reference?.includes(String(entry.id || entry._id)));
              if (!alreadyHas) {
                const newAdv = {
                  id: String(entry.id || entry._id),
                  memo_id: m.id,
                  date: entry.date,
                  amount: entry.amount,
                  mode: (entry.payment_mode as any) || 'bank',
                  reference: `Banking Entry: ${entry.id || entry._id}`,
                  description: entry.narration || 'Bank payment'
                };
                const updatedAdvances = [...currentAdvances, newAdv];
                const newPaid = (m.paid_amount || 0) + entry.amount;
                const isFullyPaid = newPaid >= (m.net_amount || 0);
                return {
                  ...m,
                  advance_payments: updatedAdvances,
                  paid_amount: newPaid,
                  status: isFullyPaid ? 'paid' : m.status,
                  paid_date: isFullyPaid ? entry.date : m.paid_date
                };
              }
            }
            return m;
          }));
        }
      }
    },
    updateBankingEntry: (id, entry) => setBankingEntries(prev => prev.map(e => (e.id === id || e._id === id) ? entry : e)),
    deleteBankingEntry: (id) => setBankingEntries(prev => prev.filter(e => (e.id !== id && e._id !== id))),
    setBankingEntries: (entries) => {
      const uniqueEntries = entries.filter((entry: any, index: number, self: any[]) => {
        const entryId = entry.id || entry._id;
        return index === self.findIndex((e: any) => (e.id || e._id) === entryId);
      });
      setBankingEntries(uniqueEntries);
    },

    // Cashbook actions - simplified, backend handles all ledger logic
    addCashbookEntry: (entry) => {
      setCashbookEntries(prev => {
        const entryId = entry.id || entry._id;
        const exists = prev.some(e => (e.id || e._id) === entryId);
        if (exists) return prev;
        return [entry, ...prev];
      });
    },
    updateCashbookEntry: (entry) => {
      setCashbookEntries(prev => prev.map(e => (e.id === entry.id || e._id === entry._id) ? entry : e));
    },
    deleteCashbookEntry: (id) => {
      setCashbookEntries(prev => prev.filter(e => (e.id !== id && e._id !== id)));
    },
    setCashbookEntries: (entries) => setCashbookEntries(entries),

    // Ledger actions
    setLedgerEntries: (entries) => setLedgerEntries(entries),

    // Party actions
    addParty: (party) => setParties(prev => [party, ...prev]),
    updateParty: (party) => setParties(prev => prev.map(p => p.id === party.id ? party : p)),
    deleteParty: (id) => setParties(prev => prev.filter(p => p.id !== id)),
    setParties: (parties) => setParties(parties),

    // Supplier actions
    addSupplier: (supplier) => setSuppliers(prev => [supplier, ...prev]),
    updateSupplier: (supplier) => setSuppliers(prev => prev.map(s => s.id === supplier.id ? supplier : s)),
    deleteSupplier: (id) => setSuppliers(prev => prev.filter(s => s.id !== id)),
    setSuppliers: (suppliers) => setSuppliers(suppliers),

    // Vehicle actions
    addVehicle: (vehicle) => setVehicles(prev => [vehicle, ...prev]),
    updateVehicle: (vehicle) => setVehicles(prev => prev.map(v => v.id === vehicle.id ? vehicle : v)),
    deleteVehicle: (id) => setVehicles(prev => prev.filter(v => v.id !== id)),
    setVehicles: (vehicles) => setVehicles(vehicles),

    // Fuel actions
    addFuelWallet: (wallet) => setFuelWallets(prev => [wallet, ...prev]),
    setFuelWallets: (wallets) => setFuelWallets(wallets),
    setFuelTransactions: (transactions) => setFuelTransactions(transactions),
    getFuelWalletBalance: (walletName) => {
      const wallet = fuelWallets.find(w => w.name === walletName);
      return wallet ? wallet.balance : 0;
    },
    getVehicleFuelExpenses: () => vehicleFuelExpenses.filter(expense => expense.vehicle_no),

    // POD actions
    addPODFile: (file) => setPodFiles(prev => [file, ...prev]),
    deletePODFile: (id) => setPodFiles(prev => prev.filter(pod => pod.id !== id)),
    getPODFiles: () => podFiles,
    setPODFiles: (files) => setPodFiles(files),

    // Complex operations
    allocateFuelToVehicle: async (vehicleNo: string, walletName: string, amount: number, date: string, narration: string, fuelQuantity?: number, ratePerLiter?: number, odometerReading?: number, fuelType?: string, allocatedBy?: string, supplier?: string) => {
      try {
        const response = await apiService.allocateFuel({
          vehicle_no: vehicleNo,
          wallet_name: walletName,
          amount,
          date,
          narration,
          fuel_quantity: fuelQuantity,
          rate_per_liter: ratePerLiter,
          odometer_reading: odometerReading,
          fuel_type: fuelType,
          allocated_by: allocatedBy,
          supplier_name: supplier
        });

        // Set timestamp to prevent sync override
        localStorage.setItem('lastFuelAllocation', Date.now().toString());

        // Immediately update local state with the new transaction
        if (response.transaction) {
          setFuelTransactions(prev => [...prev, response.transaction]);
        }

        // Update fuel wallet balance immediately
        if (response.wallet) {
          setFuelWallets(prev => prev.map(wallet =>
            wallet.name === walletName
              ? { ...wallet, balance: response.wallet.balance }
              : wallet
          ));
        } else {
          setFuelWallets(prev => prev.map(wallet =>
            wallet.name === walletName
              ? { ...wallet, balance: wallet.balance - amount }
              : wallet
          ));
        }

        // Trigger data sync to refresh other components
        window.dispatchEvent(new CustomEvent('data-sync-required'));

        return response;
      } catch (error) {
        console.error('❌ Fuel allocation failed:', error);
        throw error;
      }
    },
    bulkPaySupplierMemos: () => {},
    bulkPayBills: () => {},
    cleanupSupplierLedgerForOwnVehicles: () => {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [loadingSlips, memos, bills, bankingEntries, cashbookEntries, ledgerEntries, parties, suppliers, vehicles, fuelWallets, fuelTransactions, vehicleFuelExpenses, podFiles]);

  return (
    <DataStoreContext.Provider value={contextValue}>
      {children}
    </DataStoreContext.Provider>
  );
};

export const useDataStore = (): DataStoreState => {
  const context = useContext(DataStoreContext);
  if (!context) {
    throw new Error('useDataStore must be used within a DataStoreProvider');
  }
  return context;
};
