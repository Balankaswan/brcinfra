import React, { createContext, useContext, useState } from 'react';
import { apiService } from './api';
import type { LoadingSlip, Memo, Bill, BankingEntry, CashbookEntry, LedgerEntry, Party, Supplier, Vehicle, FuelWallet, VehicleFuelExpense, FuelTransaction, PODFile, AdvancePayment } from '../types';

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
  addSupplier: (supplier: Supplier) => void;
  updateSupplier: (supplier: Supplier) => void;
  deleteSupplier: (id: string) => void;
  // Vehicle management actions
  addVehicle: (vehicle: Vehicle) => void;
  updateVehicle: (vehicle: Vehicle) => void;
  deleteVehicle: (id: string) => void;
  setVehicles: (vehicles: Vehicle[]) => void;
  // Fuel accounting actions
  addFuelWallet: (wallet: FuelWallet) => void;
  setFuelWallets: (wallets: FuelWallet[]) => void;
  setFuelTransactions: (transactions: FuelTransaction[]) => void;
  allocateFuelToVehicle: (vehicleNo: string, walletName: string, amount: number, date: string, narration?: string, fuelQuantity?: number, ratePerLiter?: number, odometerReading?: number, fuelType?: string, allocatedBy?: string) => void;
  getFuelWalletBalance: (walletName: string) => number;
  getVehicleFuelExpenses: (vehicleNo: string) => VehicleFuelExpense[];
  bulkPaySupplierMemos: (supplierName: string, memoIds: string[], paymentAmount: number, paymentDate: string, bankAccount: string, paymentMode: 'cash' | 'bank' | 'cheque' | 'bank_transfer' | 'upi', narration?: string) => void;
  bulkPayBills: (partyName: string, billIds: string[], paymentAmount: number, paymentDate: string, bankAccount: string, paymentMode: 'cash' | 'bank' | 'cheque' | 'bank_transfer' | 'upi', narration?: string) => void;
  cleanupSupplierLedgerForOwnVehicles: () => void;
  // POD management actions
  addPODFile: (podFile: PODFile) => void;
  deletePODFile: (id: string) => void;
  getPODFiles: () => PODFile[];
}

const DataStoreContext = createContext<DataStoreState | null>(null);

export const DataStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }): JSX.Element => {
  const [loadingSlips, setLoadingSlips] = useState<LoadingSlip[]>([]);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [bankingEntries, setBankingEntries] = useState<BankingEntry[]>([]);
  const [cashbookEntries, setCashbookEntries] = useState<CashbookEntry[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [fuelWallets, setFuelWallets] = useState<FuelWallet[]>([]);
  const [fuelTransactions, setFuelTransactions] = useState<FuelTransaction[]>([]);
  const [vehicleFuelExpenses, setVehicleFuelExpenses] = useState<VehicleFuelExpense[]>([]);
  const [podFiles, setPodFiles] = useState<PODFile[]>([]);


  const contextValue: DataStoreState = {
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
    setBankingEntries: (entries) => setBankingEntries(entries),
    setBills: (bills) => setBills(bills),
    setMemos: (memos) => {
      console.log('📋 Setting memos in store:', memos.length);
      setMemos(memos);
    },
    setLoadingSlips: (slips) => {
      console.log('🚛 Setting loading slips in store:', slips.length);
      console.log('🚛 First loading slip:', slips[0] ? {
        id: slips[0].id,
        _id: (slips[0] as any)._id,
        vehicle_no: slips[0].vehicle_no
      } : 'No loading slips');
      setLoadingSlips(slips);
    },
    setLedgerEntries: (entries) => setLedgerEntries(entries),
    addLoadingSlip: (slip) => {
      setLoadingSlips(prev => [slip, ...prev]);
    },
    updateLoadingSlip: (slip) => {
      setLoadingSlips(prev => prev.map(s => s.id === slip.id ? slip : s));
    },
    deleteLoadingSlip: (id) => {
      setLoadingSlips(prev => prev.filter(s => s.id !== id));
      setMemos(prev => prev.filter(m => m.loading_slip_id !== id));
      setBills(prev => prev.filter(b => b.loading_slip_id !== id));
      setLedgerEntries(prev => prev.filter(l => l.loading_slip_id !== id));
    },
    addMemo: (memo) => {
      setMemos(prev => [memo, ...prev]);
      
      const ls = loadingSlips.find(s => s.id === memo.loading_slip_id);
      const vehicle = vehicles.find(v => v.vehicle_no === ls?.vehicle_no);
      const isOwnVehicle = vehicle?.ownership_type === 'own';
      
      console.log('🚛 MEMO CREATION DEBUG:', {
        memo: memo.memo_number,
        vehicle: ls?.vehicle_no,
        vehicleFound: !!vehicle,
        ownership: vehicle?.ownership_type,
        isOwn: isOwnVehicle,
        supplier: memo.supplier,
        willCreateSupplierEntry: !isOwnVehicle,
        allVehicles: vehicles.map(v => ({ no: v.vehicle_no, ownership: v.ownership_type }))
      });
      
      if (isOwnVehicle) {
        console.log('✅ Own vehicle detected - creating vehicle income only, NO supplier entry');
        
        const netMemoAmount = memo.freight - (memo.commission || 0) - (memo.mamool || 0);
        
        const vehicleIncomeEntry: LedgerEntry = {
          id: `${memo.id}-vehicle-income`,
          ledger_type: 'vehicle_income',
          reference_id: memo.memo_number,
          reference_name: `Vehicle ${ls?.vehicle_no} - Net Freight`,
          date: memo.date,
          description: `Net freight from memo ${memo.memo_number} (after commission & mamool)`,
          debit: 0,
          credit: netMemoAmount,
          balance: 0,
          created_at: new Date().toISOString(),
          loading_slip_id: memo.loading_slip_id,
          memo_number: memo.memo_number,
          from_location: ls?.from_location,
          to_location: ls?.to_location,
          vehicle_no: ls?.vehicle_no,
        };
        
        const ledgerEntries = [vehicleIncomeEntry];
        
        if (memo.detention && memo.detention > 0) {
          const detentionEntry: LedgerEntry = {
            id: `${memo.id}-detention`,
            ledger_type: 'vehicle_income',
            reference_id: memo.memo_number,
            reference_name: `Vehicle ${ls?.vehicle_no} - Detention`,
            date: memo.date,
            description: `Detention charges from memo ${memo.memo_number}`,
            debit: 0,
            credit: memo.detention,
            balance: 0,
            created_at: new Date().toISOString(),
            loading_slip_id: memo.loading_slip_id,
            memo_number: memo.memo_number,
            from_location: ls?.from_location,
            to_location: ls?.to_location,
            vehicle_no: ls?.vehicle_no,
          };
          ledgerEntries.push(detentionEntry);
        }
        
        if (memo.extra && memo.extra > 0) {
          const extraEntry: LedgerEntry = {
            id: `${memo.id}-extra`,
            ledger_type: 'vehicle_income',
            reference_id: memo.memo_number,
            reference_name: `Vehicle ${ls?.vehicle_no} - Extra Charges`,
            date: memo.date,
            description: `Extra charges from memo ${memo.memo_number}`,
            debit: 0,
            credit: memo.extra,
            balance: 0,
            created_at: new Date().toISOString(),
            loading_slip_id: memo.loading_slip_id,
            memo_number: memo.memo_number,
            from_location: ls?.from_location,
            to_location: ls?.to_location,
            vehicle_no: ls?.vehicle_no,
          };
          ledgerEntries.push(extraEntry);
        }
        
        setLedgerEntries(prev => [...ledgerEntries, ...prev]);
      } else {
        console.log('📋 Market vehicle detected - creating supplier entry');
        const supplierCreditAmount = memo.freight - (memo.commission || 0) - (memo.mamool || 0) + (memo.detention || 0) + (memo.extra || 0);
        
        const supplierEntry: LedgerEntry = {
          id: `${memo.id}-supplier`,
          ledger_type: 'supplier',
          reference_id: memo.memo_number,
          reference_name: memo.supplier,
          date: memo.date,
          description: 'Market vehicle memo - supplier amount',
          debit: 0,
          credit: supplierCreditAmount,
          balance: 0,
          created_at: new Date().toISOString(),
          loading_slip_id: memo.loading_slip_id,
          memo_number: memo.memo_number,
          from_location: ls?.from_location,
          to_location: ls?.to_location,
          vehicle_no: ls?.vehicle_no,
        };
        
        setLedgerEntries(prev => [supplierEntry, ...prev]);
      }
    },
    updateMemo: (memo) => {
      setMemos(prev => prev.map(m => m.id === memo.id ? memo : m));
      
      // Update corresponding ledger entries when memo is updated
      const ls = loadingSlips.find(s => s.id === memo.loading_slip_id);
      const vehicle = vehicles.find(v => v.vehicle_no === ls?.vehicle_no);
      const isOwnVehicle = vehicle?.ownership_type === 'own';
      
      // Remove old ledger entries for this memo (improved filtering)
      setLedgerEntries(prev => prev.filter(entry => 
        !(entry.memo_number === memo.memo_number || 
          entry.reference_id === memo.memo_number ||
          entry.id?.startsWith(`${memo.id}-`))
      ));
      
      if (isOwnVehicle) {
        // For own vehicles: Credit net memo amount after deductions
        const netMemoAmount = memo.freight - (memo.commission || 0) - (memo.mamool || 0);
        
        const vehicleIncomeEntry: LedgerEntry = {
          id: `${memo.id}-vehicle-income`,
          ledger_type: 'vehicle_income',
          reference_id: memo.memo_number,
          reference_name: `Vehicle ${ls?.vehicle_no} - Net Freight`,
          date: memo.date,
          description: `Net freight from memo ${memo.memo_number} (after commission & mamool)`,
          debit: 0,
          credit: netMemoAmount,
          balance: 0,
          created_at: new Date().toISOString(),
          loading_slip_id: memo.loading_slip_id,
          memo_number: memo.memo_number,
          from_location: ls?.from_location,
          to_location: ls?.to_location,
          vehicle_no: ls?.vehicle_no,
        };
        
        const ledgerEntries = [vehicleIncomeEntry];
        
        // Add separate credit entries for detention and extra charges
        if (memo.detention && memo.detention > 0) {
          const detentionEntry: LedgerEntry = {
            id: `${memo.id}-detention`,
            ledger_type: 'vehicle_income',
            reference_id: memo.memo_number,
            reference_name: `Vehicle ${ls?.vehicle_no} - Detention`,
            date: memo.date,
            description: `Detention charges from memo ${memo.memo_number}`,
            debit: 0,
            credit: memo.detention,
            balance: 0,
            created_at: new Date().toISOString(),
            loading_slip_id: memo.loading_slip_id,
            memo_number: memo.memo_number,
            from_location: ls?.from_location,
            to_location: ls?.to_location,
            vehicle_no: ls?.vehicle_no,
          };
          ledgerEntries.push(detentionEntry);
        }
        
        if (memo.extra && memo.extra > 0) {
          const extraEntry: LedgerEntry = {
            id: `${memo.id}-extra`,
            ledger_type: 'vehicle_income',
            reference_id: memo.memo_number,
            reference_name: `Vehicle ${ls?.vehicle_no} - Extra Charges`,
            date: memo.date,
            description: `Extra charges from memo ${memo.memo_number}`,
            debit: 0,
            credit: memo.extra,
            balance: 0,
            created_at: new Date().toISOString(),
            loading_slip_id: memo.loading_slip_id,
            memo_number: memo.memo_number,
            from_location: ls?.from_location,
            to_location: ls?.to_location,
            vehicle_no: ls?.vehicle_no,
          };
          ledgerEntries.push(extraEntry);
        }
        
        setLedgerEntries(prev => [...ledgerEntries, ...prev]);
      } else {
        // Market Vehicle: Single supplier credit entry
        const supplierCreditAmount = memo.freight - (memo.commission || 0) - (memo.mamool || 0) + (memo.detention || 0) + (memo.extra || 0);
        
        const supplierEntry: LedgerEntry = {
          id: `${memo.id}-supplier`,
          ledger_type: 'supplier',
          reference_id: memo.memo_number,
          reference_name: memo.supplier,
          date: memo.date,
          description: 'Market vehicle memo - supplier amount',
          debit: 0,
          credit: supplierCreditAmount,
          balance: 0,
          created_at: new Date().toISOString(),
          loading_slip_id: memo.loading_slip_id,
          memo_number: memo.memo_number,
          from_location: ls?.from_location,
          to_location: ls?.to_location,
          vehicle_no: ls?.vehicle_no,
        };
        
        setLedgerEntries(prev => [supplierEntry, ...prev]);
      }
    },
    deleteMemo: (id) => {
      const memo = memos.find(m => m.id === id);
      setMemos(prev => prev.filter(m => m.id !== id));
      
      // Remove corresponding ledger entries (improved filtering)
      setLedgerEntries(prev => prev.filter(entry => 
        !(entry.memo_number === memo?.memo_number || 
          entry.reference_id === memo?.memo_number ||
          entry.id?.startsWith(`${id}-`))
      ));
    },
    markMemoAsPaid: (id, paidDate, paidAmount) => {
      setMemos(prev => prev.map(m => 
        m.id === id ? { ...m, paid_date: paidDate, paid_amount: paidAmount, status: 'paid', is_paid: true } : m
      ));
    },
    addBill: (bill) => {
      setBills(prev => [bill, ...prev]);
      
      const ls = loadingSlips.find(s => s.id === bill.loading_slip_id);
      
      // POD system removed to optimize storage
      
      // Create professional party ledger entries for bill
      const ledgerEntries: LedgerEntry[] = [];
      
      // 1. Main Bill Entry (Credit to Party)
      const mainBillEntry: LedgerEntry = {
        id: `${bill.id}-main`,
        ledger_type: 'party',
        reference_id: bill.bill_number,
        reference_name: bill.party,
        date: bill.date,
        description: `Bill No: ${bill.bill_number} | Date: ${bill.date} | Freight Charges`,
        credit: bill.bill_amount,
        debit: 0,
        balance: 0,
        created_at: new Date().toISOString(),
        loading_slip_id: bill.loading_slip_id,
        bill_number: bill.bill_number,
        from_location: ls?.from_location,
        to_location: ls?.to_location,
        vehicle_no: ls?.vehicle_no,
        source_type: 'bill',
        partyId: bill.party
      };
      ledgerEntries.push(mainBillEntry);
      
      // 2. Detention Charges (Credit to Party)
      if (bill.detention && bill.detention > 0) {
        const detentionEntry: LedgerEntry = {
          id: `${bill.id}-detention`,
          ledger_type: 'party',
          reference_id: bill.bill_number,
          reference_name: bill.party,
          date: bill.date,
          description: `Bill No: ${bill.bill_number} | Date: ${bill.date} | Detention Charges`,
          credit: bill.detention,
          debit: 0,
          balance: 0,
          created_at: new Date().toISOString(),
          loading_slip_id: bill.loading_slip_id,
          bill_number: bill.bill_number,
          from_location: ls?.from_location,
          to_location: ls?.to_location,
          vehicle_no: ls?.vehicle_no,
          source_type: 'bill',
          partyId: bill.party
        };
        ledgerEntries.push(detentionEntry);
      }
      
      // 3. Extra Charges (Credit to Party)
      if (bill.extra && bill.extra > 0) {
        const extraEntry: LedgerEntry = {
          id: `${bill.id}-extra`,
          ledger_type: 'party',
          reference_id: bill.bill_number,
          reference_name: bill.party,
          date: bill.date,
          description: `Bill No: ${bill.bill_number} | Date: ${bill.date} | Extra Charges`,
          credit: bill.extra,
          debit: 0,
          balance: 0,
          created_at: new Date().toISOString(),
          loading_slip_id: bill.loading_slip_id,
          bill_number: bill.bill_number,
          from_location: ls?.from_location,
          to_location: ls?.to_location,
          vehicle_no: ls?.vehicle_no,
          source_type: 'bill',
          partyId: bill.party
        };
        ledgerEntries.push(extraEntry);
      }
      
      // 4. RTO Charges (Credit to Party)
      if (bill.rto && bill.rto > 0) {
        const rtoEntry: LedgerEntry = {
          id: `${bill.id}-rto`,
          ledger_type: 'party',
          reference_id: bill.bill_number,
          reference_name: bill.party,
          date: bill.date,
          description: `Bill No: ${bill.bill_number} | Date: ${bill.date} | RTO Charges`,
          credit: bill.rto,
          debit: 0,
          balance: 0,
          created_at: new Date().toISOString(),
          loading_slip_id: bill.loading_slip_id,
          bill_number: bill.bill_number,
          from_location: ls?.from_location,
          to_location: ls?.to_location,
          vehicle_no: ls?.vehicle_no,
          source_type: 'bill',
          partyId: bill.party
        };
        ledgerEntries.push(rtoEntry);
      }
      
      // 5. TDS Deduction (Debit from Party)
      if (bill.tds && bill.tds > 0) {
        const tdsEntry: LedgerEntry = {
          id: `${bill.id}-tds`,
          ledger_type: 'party',
          reference_id: bill.bill_number,
          reference_name: bill.party,
          date: bill.date,
          description: `Bill No: ${bill.bill_number} | Date: ${bill.date} | TDS Deduction`,
          debit: bill.tds,
          credit: 0,
          balance: 0,
          created_at: new Date().toISOString(),
          loading_slip_id: bill.loading_slip_id,
          bill_number: bill.bill_number,
          from_location: ls?.from_location,
          to_location: ls?.to_location,
          vehicle_no: ls?.vehicle_no,
          source_type: 'bill',
          partyId: bill.party
        };
        ledgerEntries.push(tdsEntry);
      }
      
      // 6. Penalty Deduction (Debit from Party)
      if (bill.penalties && bill.penalties > 0) {
        const penaltyEntry: LedgerEntry = {
          id: `${bill.id}-penalty`,
          ledger_type: 'party',
          reference_id: bill.bill_number,
          reference_name: bill.party,
          date: bill.date,
          description: `Bill No: ${bill.bill_number} | Date: ${bill.date} | Penalty Deduction`,
          debit: bill.penalties,
          credit: 0,
          balance: 0,
          created_at: new Date().toISOString(),
          loading_slip_id: bill.loading_slip_id,
          bill_number: bill.bill_number,
          from_location: ls?.from_location,
          to_location: ls?.to_location,
          vehicle_no: ls?.vehicle_no,
          source_type: 'bill',
          partyId: bill.party
        };
        ledgerEntries.push(penaltyEntry);
      }
      
      // 7. Mamul Deduction (Debit from Party)
      if (bill.mamool && bill.mamool > 0) {
        const mamulEntry: LedgerEntry = {
          id: `${bill.id}-mamul`,
          ledger_type: 'party',
          reference_id: bill.bill_number,
          reference_name: bill.party,
          date: bill.date,
          description: `Bill No: ${bill.bill_number} | Date: ${bill.date} | Mamul Deduction`,
          debit: bill.mamool,
          credit: 0,
          balance: 0,
          created_at: new Date().toISOString(),
          loading_slip_id: bill.loading_slip_id,
          bill_number: bill.bill_number,
          from_location: ls?.from_location,
          to_location: ls?.to_location,
          vehicle_no: ls?.vehicle_no,
          source_type: 'bill',
          partyId: bill.party
        };
        ledgerEntries.push(mamulEntry);
      }
      
      setLedgerEntries(prev => [...ledgerEntries, ...prev]);
    },
    updateBill: (bill) => {
      setBills(prev => prev.map(b => b.id === bill.id ? bill : b));
      
      const ls = loadingSlips.find(s => s.id === bill.loading_slip_id);
      
      // POD system removed to optimize storage
      
      // Remove old ledger entries for this bill
      setLedgerEntries(prev => prev.filter(entry => 
        !entry.bill_number || entry.bill_number !== bill.bill_number
      ));
      
      // Create updated professional party ledger entries for bill
      const ledgerEntries: LedgerEntry[] = [];
      
      // 1. Main Bill Entry (Credit to Party)
      const mainBillEntry: LedgerEntry = {
        id: `${bill.id}-main`,
        ledger_type: 'party',
        reference_id: bill.bill_number,
        reference_name: bill.party,
        date: bill.date,
        description: `Bill No: ${bill.bill_number} | Date: ${bill.date} | Freight Charges`,
        credit: bill.bill_amount,
        debit: 0,
        balance: 0,
        created_at: new Date().toISOString(),
        loading_slip_id: bill.loading_slip_id,
        bill_number: bill.bill_number,
        from_location: ls?.from_location,
        to_location: ls?.to_location,
        vehicle_no: ls?.vehicle_no,
        source_type: 'bill',
        partyId: bill.party
      };
      ledgerEntries.push(mainBillEntry);
      
      // 2. Detention Charges (Credit to Party)
      if (bill.detention && bill.detention > 0) {
        const detentionEntry: LedgerEntry = {
          id: `${bill.id}-detention`,
          ledger_type: 'party',
          reference_id: bill.bill_number,
          reference_name: bill.party,
          date: bill.date,
          description: `Bill No: ${bill.bill_number} | Date: ${bill.date} | Detention Charges`,
          credit: bill.detention,
          debit: 0,
          balance: 0,
          created_at: new Date().toISOString(),
          loading_slip_id: bill.loading_slip_id,
          bill_number: bill.bill_number,
          from_location: ls?.from_location,
          to_location: ls?.to_location,
          vehicle_no: ls?.vehicle_no,
          source_type: 'bill',
          partyId: bill.party
        };
        ledgerEntries.push(detentionEntry);
      }
      
      // 3. Extra Charges (Credit to Party)
      if (bill.extra && bill.extra > 0) {
        const extraEntry: LedgerEntry = {
          id: `${bill.id}-extra`,
          ledger_type: 'party',
          reference_id: bill.bill_number,
          reference_name: bill.party,
          date: bill.date,
          description: `Bill No: ${bill.bill_number} | Date: ${bill.date} | Extra Charges`,
          credit: bill.extra,
          debit: 0,
          balance: 0,
          created_at: new Date().toISOString(),
          loading_slip_id: bill.loading_slip_id,
          bill_number: bill.bill_number,
          from_location: ls?.from_location,
          to_location: ls?.to_location,
          vehicle_no: ls?.vehicle_no,
          source_type: 'bill',
          partyId: bill.party
        };
        ledgerEntries.push(extraEntry);
      }
      
      // 4. RTO Charges (Credit to Party)
      if (bill.rto && bill.rto > 0) {
        const rtoEntry: LedgerEntry = {
          id: `${bill.id}-rto`,
          ledger_type: 'party',
          reference_id: bill.bill_number,
          reference_name: bill.party,
          date: bill.date,
          description: `Bill No: ${bill.bill_number} | Date: ${bill.date} | RTO Charges`,
          credit: bill.rto,
          debit: 0,
          balance: 0,
          created_at: new Date().toISOString(),
          loading_slip_id: bill.loading_slip_id,
          bill_number: bill.bill_number,
          from_location: ls?.from_location,
          to_location: ls?.to_location,
          vehicle_no: ls?.vehicle_no,
          source_type: 'bill',
          partyId: bill.party
        };
        ledgerEntries.push(rtoEntry);
      }
      
      // 5. TDS Deduction (Debit from Party)
      if (bill.tds && bill.tds > 0) {
        const tdsEntry: LedgerEntry = {
          id: `${bill.id}-tds`,
          ledger_type: 'party',
          reference_id: bill.bill_number,
          reference_name: bill.party,
          date: bill.date,
          description: `Bill No: ${bill.bill_number} | Date: ${bill.date} | TDS Deduction`,
          debit: bill.tds,
          credit: 0,
          balance: 0,
          created_at: new Date().toISOString(),
          loading_slip_id: bill.loading_slip_id,
          bill_number: bill.bill_number,
          from_location: ls?.from_location,
          to_location: ls?.to_location,
          vehicle_no: ls?.vehicle_no,
          source_type: 'bill',
          partyId: bill.party
        };
        ledgerEntries.push(tdsEntry);
      }
      
      // 6. Penalty Deduction (Debit from Party)
      if (bill.penalties && bill.penalties > 0) {
        const penaltyEntry: LedgerEntry = {
          id: `${bill.id}-penalty`,
          ledger_type: 'party',
          reference_id: bill.bill_number,
          reference_name: bill.party,
          date: bill.date,
          description: `Bill No: ${bill.bill_number} | Date: ${bill.date} | Penalty Deduction`,
          debit: bill.penalties,
          credit: 0,
          balance: 0,
          created_at: new Date().toISOString(),
          loading_slip_id: bill.loading_slip_id,
          bill_number: bill.bill_number,
          from_location: ls?.from_location,
          to_location: ls?.to_location,
          vehicle_no: ls?.vehicle_no,
          source_type: 'bill',
          partyId: bill.party
        };
        ledgerEntries.push(penaltyEntry);
      }
      
      // 7. Mamul Deduction (Debit from Party)
      if (bill.mamool && bill.mamool > 0) {
        const mamulEntry: LedgerEntry = {
          id: `${bill.id}-mamul`,
          ledger_type: 'party',
          reference_id: bill.bill_number,
          reference_name: bill.party,
          date: bill.date,
          description: `Bill No: ${bill.bill_number} | Date: ${bill.date} | Mamul Deduction`,
          debit: bill.mamool,
          credit: 0,
          balance: 0,
          created_at: new Date().toISOString(),
          loading_slip_id: bill.loading_slip_id,
          bill_number: bill.bill_number,
          from_location: ls?.from_location,
          to_location: ls?.to_location,
          vehicle_no: ls?.vehicle_no,
          source_type: 'bill',
          partyId: bill.party
        };
        ledgerEntries.push(mamulEntry);
      }
      
      setLedgerEntries(prev => [...ledgerEntries, ...prev]);
    },
    deleteBill: (id) => {
      const bill = bills.find(b => b.id === id);
      setBills(prev => prev.filter(b => b.id !== id));
      
      // Remove corresponding ledger entries
      setLedgerEntries(prev => prev.filter(entry => 
        !entry.bill_number || entry.bill_number !== bill?.bill_number
      ));
    },
    markBillAsReceived: (id, receivedDate, receivedAmount) => {
      setBills(prev => prev.map(b => 
        b.id === id ? { ...b, received_date: receivedDate, received_amount: receivedAmount, status: 'received', is_received: true } : b
      ));
    },
    addBankingEntry: (entry) => {
      console.log('🔥 Processing banking entry:', entry);
      
      // Check if entry already exists to avoid duplicates
      const exists = bankingEntries.some(e => e.id === entry.id || e._id === entry._id);
      if (exists) {
        console.log('🔄 Banking entry already exists, skipping ALL processing:', entry.id || entry._id);
        return;
      }
      
      setBankingEntries(prev => {
        console.log('🔥 Adding new banking entry:', entry);
        return [entry, ...prev];
      });
      
      // Handle memo/bill advance payments - create advance payment records and link to memo/bill
      if (entry.category === 'memo_advance' && entry.reference_id) {
        const advancePayment: AdvancePayment = {
          id: `${entry.id}-advance`,
          memo_id: entry.reference_id,
          date: entry.date,
          amount: entry.amount,
          mode: entry.payment_mode === 'cash' ? 'cash' : 'bank',
          reference: entry.narration,
          description: `Advance payment via ${entry.type === 'debit' ? 'bank debit' : 'bank credit'}`,
          created_at: new Date().toISOString()
        };
        
        // Add advance payment to memo
        setMemos(prev => prev.map(memo => 
          memo.memo_number === entry.reference_id 
            ? { ...memo, advance_payments: [...(memo.advance_payments || []), advancePayment] }
            : memo
        ));
        
        // Store advance ID in banking entry for future reference
        setBankingEntries(prev => prev.map(be => 
          be.id === entry.id ? { ...be, memo_advance_id: advancePayment.id } : be
        ));
        return;
      }
      
      if (entry.category === 'bill_advance' && entry.reference_id) {
        const advancePayment: AdvancePayment = {
          id: `${entry.id}-advance`,
          bill_id: entry.reference_id,
          date: entry.date,
          amount: entry.amount,
          mode: entry.payment_mode === 'cash' ? 'cash' : 'bank',
          reference: entry.narration,
          description: `Advance payment via ${entry.type === 'debit' ? 'bank debit' : 'bank credit'}`,
          created_at: new Date().toISOString()
        };
        
        // Add advance payment to bill
        setBills(prev => prev.map(bill => 
          bill.bill_number === entry.reference_id 
            ? { ...bill, advance_payments: [...(bill.advance_payments || []), advancePayment] }
            : bill
        ));
        
        // Store advance ID in banking entry for future reference
        setBankingEntries(prev => prev.map(be => 
          be.id === entry.id ? { ...be, bill_advance_id: advancePayment.id } : be
        ));
        return;
      }
      
      // Handle bill payment - mark bill as paid and update payment details
      if (entry.category === 'bill_payment' && entry.reference_id) {
        setBills(prev => prev.map(bill => 
          bill.bill_number === entry.reference_id 
            ? { 
                ...bill, 
                status: 'received',
                received_date: entry.date,
                received_amount: (bill.received_amount || 0) + entry.amount
              }
            : bill
        ));
        
        // Save bill payment to backend
        try {
          const billToUpdate = bills.find(b => b.bill_number === entry.reference_id);
          if (billToUpdate) {
            const updatedBill = {
              ...billToUpdate,
              status: 'received',
              received_date: entry.date,
              received_amount: (billToUpdate.received_amount || 0) + entry.amount
            };
            
            apiService.updateBill(billToUpdate.id, updatedBill).then(() => {
              console.log('✅ Bill payment updated in backend:', updatedBill);
            }).catch(error => {
              console.error('❌ Failed to update bill payment in backend:', error);
            });
          }
        } catch (error) {
          console.error('❌ Error updating bill payment:', error);
        }
        return;
      }
      
      // Skip ledger entries for memo payment category to avoid duplicates
      if (entry.category === 'memo_payment') {
        return;
      }
      
      // Handle general expense category - create ledger entry with expense name
      if (entry.category === 'expense' && entry.reference_name && entry.reference_name.trim()) {
        const expenseName = entry.reference_name.trim();
        
        const expenseLedgerEntry: LedgerEntry = {
          id: `${entry.id}-expense-ledger`,
          referenceId: entry.id,
          reference_id: entry.id,
          ledger_type: 'general',
          reference_name: expenseName,
          source_type: 'banking',
          type: 'expense',
          date: entry.date,
          description: `${entry.type === 'debit' ? 'Expense' : 'Income'} - ${expenseName} - ${entry.narration || ''}`,
          debit: entry.type === 'debit' ? entry.amount : 0,
          credit: entry.type === 'credit' ? entry.amount : 0,
          balance: 0,
          created_at: new Date().toISOString(),
          vehicle_no: entry.vehicle_no,
        };
        
        setLedgerEntries(prev => [expenseLedgerEntry, ...prev]);
        
        // Save expense ledger entry to backend
        try {
          const backendLedgerEntry = {
            ...expenseLedgerEntry,
            referenceId: expenseLedgerEntry.reference_id || expenseLedgerEntry.id,
            type: expenseLedgerEntry.type || 'expense'
          };
          apiService.createLedgerEntry(backendLedgerEntry).then(() => {
            console.log('✅ Expense ledger entry saved to backend:', backendLedgerEntry);
          }).catch(error => {
            console.error('❌ Failed to save expense ledger entry:', error);
          });
        } catch (error) {
          console.error('❌ Error saving expense ledger entry:', error);
        }
        
        return; // Don't create additional general ledger entry
      }
      
      // Handle vehicle expenses for own vehicles - create vehicle ledger debit entry
      if (entry.vehicle_no && entry.category === 'vehicle_expense') {
        const vehicle = vehicles.find(v => v.vehicle_no === entry.vehicle_no);
        const isOwnVehicle = vehicle?.ownership_type === 'own';
        
        if (isOwnVehicle) {
          const vehicleExpenseEntry: LedgerEntry = {
            id: `${entry.id}-vehicle-expense`,
            referenceId: entry.id,
            reference_id: entry.id,
            ledger_type: 'vehicle_expense',
            reference_name: `Vehicle ${entry.vehicle_no} - Expense`,
            source_type: 'banking',
            type: 'expense',
            date: entry.date,
            description: entry.narration || 'Vehicle expense',
            debit: entry.amount,
            credit: 0,
            balance: 0,
            created_at: new Date().toISOString(),
            vehicle_no: entry.vehicle_no,
          };
          
          setLedgerEntries(prev => [vehicleExpenseEntry, ...prev]);
          return; // Don't create general ledger entry for vehicle expenses
        }
      }
      
      // Create fuel wallet credit entry for fuel company debits
      if (entry.type === 'debit' && entry.category === 'fuel_wallet') {
        console.log('🔥 FUEL WALLET PROCESSING - Entry:', entry);
        const walletName = entry.reference_name || entry.narration || 'BPCL';
        console.log('🔥 FUEL WALLET - Wallet Name:', walletName, 'Amount:', entry.amount);
        
        const fuelTransaction: FuelTransaction = {
          id: `${entry.id}-fuel-tx`,
          wallet_name: walletName,
          type: 'wallet_credit',
          amount: entry.amount,
          date: entry.date,
          narration: `Bank debit for fuel - ${walletName}`,
          created_at: new Date().toISOString(),
          vehicle_no: entry.vehicle_no,
        };
        
        setFuelTransactions(prev => {
          console.log('🔥 Adding fuel transaction:', fuelTransaction);
          return [fuelTransaction, ...prev];
        });
        
        // Update fuel wallet balance
        const existingWallet = fuelWallets.find(w => w.name === walletName);
        if (existingWallet) {
          const newBalance = existingWallet.balance + entry.amount;
          console.log('🔥 Updating existing wallet:', walletName, 'Current balance:', existingWallet.balance, 'Adding:', entry.amount, 'New balance:', newBalance);
          setFuelWallets(prev => prev.map(wallet => 
            wallet.name === walletName 
              ? { ...wallet, balance: newBalance, updated_at: new Date().toISOString() }
              : wallet
          ));
          
          // Update wallet balance in backend
          try {
            const walletId = (existingWallet as any)._id || existingWallet.id;
            if (walletId) {
              apiService.updateFuelWallet(walletId, {
                name: existingWallet.name,
                balance: newBalance,
                updated_at: new Date().toISOString()
              }).then(() => {
                console.log('✅ Fuel wallet balance updated in backend');
              }).catch((error: any) => {
                console.error('❌ Failed to update fuel wallet in backend:', error);
              });
            } else {
              console.error('❌ No valid wallet ID found for update');
            }
          } catch (error) {
            console.error('❌ Error updating fuel wallet:', error);
          }
        } else {
          console.log('🔥 Creating new fuel wallet:', walletName, 'Initial balance:', entry.amount);
          // Create new fuel wallet
          const newWallet = { 
            id: `wallet-${Date.now()}`,
            name: walletName, 
            balance: entry.amount,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          setFuelWallets(prev => {
            console.log('🔥 Adding new wallet to state:', newWallet);
            return [...prev, newWallet];
          });
          
          // Also create wallet in backend
          try {
            apiService.createFuelWallet(newWallet).then(() => {
              console.log('✅ Fuel wallet created in backend:', newWallet);
            }).catch((error: any) => {
              console.error('❌ Failed to create fuel wallet in backend:', error);
            });
          } catch (error) {
            console.error('❌ Error creating fuel wallet:', error);
          }
        }
        
        // Create fuel transaction in backend
        try {
          apiService.createFuelTransaction(fuelTransaction).then(() => {
            console.log('✅ Fuel transaction created in backend:', fuelTransaction);
          }).catch((error: any) => {
            console.error('❌ Failed to create fuel transaction in backend:', error);
          });
        } catch (error) {
          console.error('❌ Error creating fuel transaction:', error);
        }
        
        return; // Don't create general ledger entry for fuel wallet credits
      }
      
      // Create person-specific ledger entry if reference_name contains a person's name
      if (entry.reference_name && entry.reference_name.trim() && 
          !['fuel_wallet', 'vehicle_expense', 'vehicle_credit_note'].includes(entry.category)) {
        
        const personName = entry.reference_name.trim();
        
        // Create person ledger entry - BRC perspective
        // When BRC pays someone (debit), it's a debit in that person's ledger (BRC owes less/person owes more)
        // When BRC receives from someone (credit), it's a credit in that person's ledger (BRC owes more/person owes less)
        const personLedgerEntry: LedgerEntry = {
          id: `${entry.id}-person-ledger`,
          referenceId: entry.id,
          reference_id: entry.id,
          ledger_type: 'general',
          reference_name: personName,
          source_type: 'banking',
          type: entry.type === 'debit' ? 'payment' : 'payment',
          date: entry.date,
          description: `${entry.type === 'debit' ? 'Payment to' : 'Receipt from'} ${personName} - ${entry.narration || entry.category}`,
          debit: entry.type === 'debit' ? entry.amount : 0,
          credit: entry.type === 'credit' ? entry.amount : 0,
          balance: 0,
          created_at: new Date().toISOString(),
          vehicle_no: entry.vehicle_no,
        };
        
        setLedgerEntries(prev => [personLedgerEntry, ...prev]);
      } else {
        // Create general ledger entry for other banking transactions (without person names)
        const ledgerEntry: LedgerEntry = {
          id: `${entry.id}-ledger`,
          referenceId: entry.id,
          reference_id: entry.id,
          ledger_type: 'general',
          reference_name: entry.reference_name || entry.category || 'Other Income',
          source_type: 'banking',
          type: entry.type === 'debit' ? 'payment' : 'payment',
          date: entry.date,
          description: entry.narration || entry.category,
          debit: entry.type === 'debit' ? entry.amount : 0,
          credit: entry.type === 'credit' ? entry.amount : 0,
          balance: 0,
          created_at: new Date().toISOString(),
          vehicle_no: entry.vehicle_no,
        };
        
        setLedgerEntries(prev => [ledgerEntry, ...prev]);
        
        // Save ledger entry to backend with required fields
        try {
          const backendLedgerEntry = {
            ...ledgerEntry,
            referenceId: ledgerEntry.reference_id || ledgerEntry.id,
            type: ledgerEntry.type || 'payment'
          };
          apiService.createLedgerEntry(backendLedgerEntry).then(() => {
            console.log('✅ General ledger entry saved to backend:', backendLedgerEntry);
          }).catch(error => {
            console.error('❌ Failed to save general ledger entry:', error);
          });
        } catch (error) {
          console.error('❌ Error saving general ledger entry:', error);
        }
      }
    },
    updateBankingEntry: (id, entry) => {
      const oldEntry = bankingEntries.find(e => e.id === id);
      setBankingEntries(prev => prev.map(e => e.id === id ? entry : e));
      
      // Remove old related entries first
      if (oldEntry) {
        // Remove old ledger entries
        setLedgerEntries(prev => prev.filter(l => l.reference_id !== entry.id || l.source_type !== 'banking'));
        
        // Reverse old fuel wallet effects if applicable
        if (oldEntry.type === 'debit' && oldEntry.category === 'fuel_wallet') {
          const walletName = oldEntry.reference_name || oldEntry.narration || 'BPCL';
          setFuelWallets(prev => prev.map(wallet => 
            wallet.name === walletName 
              ? { ...wallet, balance: wallet.balance - oldEntry.amount }
              : wallet
          ));
          setFuelTransactions(prev => prev.filter(ft => ft.id !== `${oldEntry.id}-fuel-tx`));
        }
        
        // Remove old party commission ledger entries if applicable
        if (oldEntry.category === 'party_commission' && oldEntry.reference_name) {
          setLedgerEntries(prev => prev.filter(l => !(
            l.ledger_type === 'commission' && 
            l.reference_name === oldEntry.reference_name && 
            l.source_type === 'banking'
          )));
        }
      }
      
      // Handle memo/bill advance payment updates
      if (entry.category === 'memo_advance' && entry.reference_id) {
        // Remove old advance payment if it exists
        if (oldEntry?.memo_advance_id) {
          setMemos(prev => prev.map(memo => 
            memo.advance_payments?.some(a => a.id === oldEntry.memo_advance_id) 
              ? { ...memo, advance_payments: memo.advance_payments?.filter(a => a.id !== oldEntry.memo_advance_id) }
              : memo
          ));
        }
        
        // Create new advance payment
        const advancePayment: AdvancePayment = {
          id: `${entry.id}-advance`,
          memo_id: entry.reference_id,
          date: entry.date,
          amount: entry.amount,
          mode: entry.payment_mode === 'cash' ? 'cash' : 'bank',
          reference: entry.narration,
          description: `Advance payment via ${entry.type === 'debit' ? 'bank debit' : 'bank credit'}`,
          created_at: new Date().toISOString()
        };
        
        // Add advance payment to memo
        setMemos(prev => prev.map(memo => 
          memo.memo_number === entry.reference_id 
            ? { ...memo, advance_payments: [...(memo.advance_payments?.filter(a => a.id !== `${entry.id}-advance`) || []), advancePayment] }
            : memo
        ));
        
        // Update banking entry with advance ID
        setBankingEntries(prev => prev.map(be => 
          be.id === entry.id ? { ...be, memo_advance_id: advancePayment.id } : be
        ));
        return;
      }
      
      if (entry.category === 'bill_advance' && entry.reference_id) {
        // Remove old advance payment if it exists
        if (oldEntry?.bill_advance_id) {
          setBills(prev => prev.map(bill => 
            bill.advance_payments?.some(a => a.id === oldEntry.bill_advance_id) 
              ? { ...bill, advance_payments: bill.advance_payments?.filter(a => a.id !== oldEntry.bill_advance_id) }
              : bill
          ));
        }
        
        // Create new advance payment
        const advancePayment: AdvancePayment = {
          id: `${entry.id}-advance`,
          bill_id: entry.reference_id,
          date: entry.date,
          amount: entry.amount,
          mode: entry.payment_mode === 'cash' ? 'cash' : 'bank',
          reference: entry.narration,
          description: `Advance payment via ${entry.type === 'debit' ? 'bank debit' : 'bank credit'}`,
          created_at: new Date().toISOString()
        };
        
        // Add advance payment to bill
        setBills(prev => prev.map(bill => 
          bill.bill_number === entry.reference_id 
            ? { ...bill, advance_payments: [...(bill.advance_payments?.filter(a => a.id !== `${entry.id}-advance`) || []), advancePayment] }
            : bill
        ));
        
        // Update banking entry with advance ID
        setBankingEntries(prev => prev.map(be => 
          be.id === entry.id ? { ...be, bill_advance_id: advancePayment.id } : be
        ));
        return;
      }
      
      // Handle bill payment - mark bill as paid and update payment details
      if (entry.category === 'bill_payment' && entry.reference_id) {
        setBills(prev => prev.map(bill => 
          bill.bill_number === entry.reference_id 
            ? { 
                ...bill, 
                status: 'received',
                received_date: entry.date,
                received_amount: (bill.received_amount || 0) + entry.amount
              }
            : bill
        ));
        
        // Save bill payment to backend
        try {
          const billToUpdate = bills.find(b => b.bill_number === entry.reference_id);
          if (billToUpdate) {
            const updatedBill = {
              ...billToUpdate,
              status: 'received',
              received_date: entry.date,
              received_amount: (billToUpdate.received_amount || 0) + entry.amount
            };
            
            apiService.updateBill(billToUpdate.id, updatedBill).then(() => {
              console.log('✅ Bill payment updated in backend:', updatedBill);
            }).catch(error => {
              console.error('❌ Failed to update bill payment in backend:', error);
            });
          }
        } catch (error) {
          console.error('❌ Error updating bill payment:', error);
        }
        return;
      }
      
      // Skip ledger entries for memo payment category to avoid duplicates
      if (entry.category === 'memo_payment') {
        return;
      }
      
      // Handle vehicle expenses for own vehicles
      if (entry.vehicle_no && entry.category === 'vehicle_expense') {
        const vehicle = vehicles.find(v => v.vehicle_no === entry.vehicle_no);
        const isOwnVehicle = vehicle?.ownership_type === 'own';
        
        if (isOwnVehicle) {
          const vehicleExpenseEntry: LedgerEntry = {
            id: `${entry.id}-vehicle-expense`,
            referenceId: entry.id,
            reference_id: entry.id,
            ledger_type: 'vehicle_expense',
            reference_name: `Vehicle ${entry.vehicle_no} - Expense`,
            source_type: 'banking',
            type: 'expense',
            date: entry.date,
            description: entry.narration || 'Vehicle expense',
            debit: entry.amount,
            credit: 0,
            balance: 0,
            created_at: new Date().toISOString(),
            vehicle_no: entry.vehicle_no,
          };
          
          setLedgerEntries(prev => [vehicleExpenseEntry, ...prev]);
          return;
        }
      }
      
      // Fuel wallet credits are handled in addBankingEntry to avoid duplication
      if (entry.type === 'debit' && entry.category === 'fuel_wallet') {
        return; // Don't create general ledger entry for fuel wallet credits
      }
      
      // Create person-specific ledger entry if reference_name contains a person's name
      if (entry.reference_name && entry.reference_name.trim() && 
          !['fuel_wallet', 'vehicle_expense', 'vehicle_credit_note'].includes(entry.category)) {
        
        const personName = entry.reference_name.trim();
        
        // Create person ledger entry - BRC perspective
        const personLedgerEntry: LedgerEntry = {
          id: `${entry.id}-person-ledger`,
          referenceId: entry.id,
          reference_id: entry.id,
          ledger_type: 'general',
          reference_name: personName,
          source_type: 'banking',
          type: entry.type === 'debit' ? 'payment' : 'payment',
          date: entry.date,
          description: `${entry.type === 'debit' ? 'Payment to' : 'Receipt from'} ${personName} - ${entry.narration || entry.category}`,
          debit: entry.type === 'debit' ? entry.amount : 0,
          credit: entry.type === 'credit' ? entry.amount : 0,
          balance: 0,
          created_at: new Date().toISOString(),
          vehicle_no: entry.vehicle_no,
        };
        
        setLedgerEntries(prev => [personLedgerEntry, ...prev]);
      } else {
        // Create general ledger entry for other banking transactions (without person names)
        const ledgerEntry: LedgerEntry = {
          id: `${entry.id}-ledger`,
          referenceId: entry.id,
          reference_id: entry.id,
          ledger_type: 'general',
          reference_name: entry.category,
          source_type: 'banking',
          type: entry.type === 'debit' ? 'payment' : 'payment',
          date: entry.date,
          description: entry.narration || entry.category,
          debit: entry.type === 'debit' ? entry.amount : 0,
          credit: entry.type === 'credit' ? entry.amount : 0,
          balance: 0,
          created_at: new Date().toISOString(),
        };
        
        setLedgerEntries(prev => [ledgerEntry, ...prev]);
      }
      
      // Create party commission ledger entry for commission payments
      if (entry.category === 'party_commission' && entry.reference_name) {
        // Find the party ID for the reference
        const selectedParty = parties.find(p => p.name === entry.reference_name);
        const partyId = selectedParty ? selectedParty.id : entry.reference_name;
        
        const commissionLedgerEntry: LedgerEntry = {
          id: `${entry.id}-commission-ledger`,
          referenceId: partyId,
          reference_id: entry.id,
          ledger_type: 'commission',
          reference_name: selectedParty ? selectedParty.name : entry.reference_name,
          source_type: 'banking',
          type: 'commission',
          date: entry.date,
          description: `Commission Payment – Bank Transfer`,
          narration: `Commission Payment – Bank Transfer`,
          debit: entry.amount,
          credit: 0,
          balance: 0,
          created_at: new Date().toISOString(),
          partyId: partyId
        };
        
        setLedgerEntries(prev => [commissionLedgerEntry, ...prev]);
      }
    },
    deleteBankingEntry: (id) => {
      const entry = bankingEntries.find(e => e.id === id);
      setBankingEntries(prev => prev.filter(e => e.id !== id));
      
      // Remove related ledger entries - fix to use reference_id instead of source_id
      setLedgerEntries(prev => prev.filter(l => !(l.reference_id === id && l.source_type === 'banking')));
      
      // Reverse fuel wallet effects if applicable
      if (entry && entry.type === 'debit' && entry.category === 'fuel_wallet') {
        const walletName = entry.narration || 'BPCL';
        const existingWallet = fuelWallets.find(w => w.name === walletName);
        if (existingWallet) {
          setFuelWallets(prev => prev.map(wallet => 
            wallet.name === walletName 
              ? { ...wallet, balance: wallet.balance - entry.amount }
              : wallet
          ));
        }
        
        // Remove fuel transaction
        setFuelTransactions(prev => prev.filter(t => t.id !== `${entry.id}-fuel-tx`));
      }
      
      // Unlink memo/bill advances if applicable
      if (entry && entry.memo_advance_id) {
        setMemos(prev => prev.map(m => 
          m.advance_payments?.some(a => a.id === entry.memo_advance_id) 
            ? { ...m, advance_payments: m.advance_payments?.filter(a => a.id !== entry.memo_advance_id) }
            : m
        ));
      }
      
      if (entry && entry.bill_advance_id) {
        setBills(prev => prev.map(b => 
          b.advance_payments?.some(a => a.id === entry.bill_advance_id) 
            ? { ...b, advance_payments: b.advance_payments?.filter(a => a.id !== entry.bill_advance_id) }
            : b
        ));
      }
    },
    addCashbookEntry: (entry) => {
      setCashbookEntries(prev => [entry, ...prev]);
      // All ledger creation is now handled by the backend
      console.log('✅ Cashbook entry added to store:', entry.id);
    },
    updateCashbookEntry: (entry) => {
      setCashbookEntries(prev => prev.map(e => e.id === entry.id ? entry : e));
      // All ledger updates are now handled by the backend
      console.log('✅ Cashbook entry updated in store:', entry.id);
    },
    deleteCashbookEntry: (id) => {
      setCashbookEntries(prev => prev.filter(e => e.id !== id));
      // All ledger cleanup is now handled by the backend
      console.log('✅ Cashbook entry deleted from store:', id);
    },
    // Simplified party/supplier/vehicle management
    addParty: (party) => setParties(prev => [party, ...prev]),
    updateParty: (party) => setParties(prev => prev.map(p => p.id === party.id ? party : p)),
    deleteParty: (id) => setParties(prev => prev.filter(p => p.id !== id)),
    addSupplier: (supplier) => setSuppliers(prev => [supplier, ...prev]),
    updateSupplier: (supplier) => setSuppliers(prev => prev.map(s => s.id === supplier.id ? supplier : s)),
    deleteSupplier: (id) => setSuppliers(prev => prev.filter(s => s.id !== id)),
    addVehicle: (vehicle) => setVehicles(prev => [vehicle, ...prev]),
    updateVehicle: (vehicle) => setVehicles(prev => prev.map(v => v.id === vehicle.id ? vehicle : v)),
    deleteVehicle: (id) => setVehicles(prev => prev.filter(v => v.id !== id)),
    setVehicles: (vehicles) => setVehicles(vehicles),
    addFuelWallet: (wallet) => setFuelWallets(prev => [wallet, ...prev]),
    setFuelWallets: (wallets) => setFuelWallets(wallets),
    setFuelTransactions: (transactions) => setFuelTransactions(transactions),
    getFuelWalletBalance: (walletName) => {
      const wallet = fuelWallets.find(w => w.name === walletName);
      return wallet ? wallet.balance : 0;
    },
    getVehicleFuelExpenses: () => vehicleFuelExpenses.filter(expense => expense.vehicle_no),
    addPODFile: (file) => setPodFiles(prev => [file, ...prev]),
    deletePODFile: (id) => setPodFiles(prev => prev.filter(pod => pod.id !== id)),
    getPODFiles: () => podFiles,
    // Simplified bulk operations
    bulkPaySupplierMemos: () => console.log('Bulk pay supplier memos'),
    bulkPayBills: () => console.log('Bulk pay bills'),
    setCashbookEntries: (entries) => setCashbookEntries(entries),
    setPODFiles: (files) => setPodFiles(files),
    cleanupSupplierLedgerForOwnVehicles: () => console.log('Cleanup supplier ledger')
  };

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
          const vehicleExpenseEntry: LedgerEntry = {
            id: `${entry.id}-vehicle-expense`,
            referenceId: entry.id,
            reference_id: entry.id,
            ledger_type: 'vehicle_expense',
            reference_name: `Vehicle ${entry.vehicle_no} - Expense`,
            source_type: 'cashbook',
            type: 'expense',
            date: entry.date,
            description: entry.narration || 'Vehicle expense',
            debit: entry.amount,
            credit: 0,
            balance: 0,
            created_at: new Date().toISOString(),
            vehicle_no: entry.vehicle_no,
          };
          
          setLedgerEntries(prev => [vehicleExpenseEntry, ...prev]);
          return;
        }
      }
      
      // Create person-specific ledger entry if reference_name contains a person's name
      if (entry.reference_name && entry.reference_name.trim() && 
          !['fuel_wallet', 'vehicle_expense', 'vehicle_credit_note'].includes(entry.category)) {
        
        const personName = entry.reference_name.trim();
        
        // Create person ledger entry - BRC perspective
        const personLedgerEntry: LedgerEntry = {
          id: `${entry.id}-person-ledger`,
          ledger_type: 'general',
          reference_id: entry.id,
          reference_name: personName,
          date: entry.date,
          description: `${entry.type === 'debit' ? 'Cash payment to' : 'Cash receipt from'} ${personName} - ${entry.narration || entry.category}`,
          debit: entry.type === 'debit' ? entry.amount : 0,
          credit: entry.type === 'credit' ? entry.amount : 0,
          balance: 0,
          created_at: new Date().toISOString(),
          vehicle_no: entry.vehicle_no,
          source_type: 'cashbook',
        };
        
        setLedgerEntries(prev => [personLedgerEntry, ...prev]);
      } else {
        // Create general ledger entry for other cashbook transactions (without person names)
        const ledgerEntry: LedgerEntry = {
          id: `${entry.id}-ledger`,
          ledger_type: 'general',
          reference_id: entry.id,
          reference_name: entry.category,
          date: entry.date,
          description: entry.narration || entry.category,
          debit: entry.type === 'debit' ? entry.amount : 0,
          credit: entry.type === 'credit' ? entry.amount : 0,
          balance: 0,
          source_type: 'cashbook',
          source_id: entry.id,
          created_at: new Date().toISOString(),
        };
        
        setLedgerEntries(prev => [ledgerEntry, ...prev]);
      }
      
      // Fuel wallet processing is handled in addBankingEntry only
      if (entry.type === 'debit' && entry.category === 'fuel_wallet') {
        return; // Skip fuel wallet processing in addCashbookEntry
      }
      
      // Create party commission ledger entry for commission payments
      if (entry.category === 'party_commission' && entry.reference_name) {
        // Find the party ID for the reference
        const selectedParty = parties.find(p => p.name === entry.reference_name);
        const partyId = selectedParty ? selectedParty.id : entry.reference_name;
        
        const commissionLedgerEntry: LedgerEntry = {
          id: `${entry.id}-commission-ledger`,
          referenceId: partyId,
          reference_id: entry.id,
          ledger_type: 'commission',
          reference_name: selectedParty ? selectedParty.name : entry.reference_name,
          source_type: 'cashbook',
          type: 'commission',
          date: entry.date,
          description: `Commission Payment – Cash`,
          narration: `Commission Payment – Cash`,
          debit: entry.amount,
          credit: 0,
          balance: 0,
          created_at: new Date().toISOString(),
          partyId: partyId
        };
        
        setLedgerEntries(prev => [commissionLedgerEntry, ...prev]);
      }
    },
    deleteCashbookEntry: (id) => {
      setCashbookEntries(prev => prev.filter(e => e.id !== id));
      setLedgerEntries(prev => prev.filter(l => !(l.source_id === id && l.source_type === 'cashbook')));
    },
    addParty: (party) => setParties(prev => [party, ...prev]),
    updateParty: (party) => setParties(prev => prev.map(p => p.id === party.id ? party : p)),
    deleteParty: (id) => setParties(prev => prev.filter(p => p.id !== id)),
    addSupplier: (supplier) => setSuppliers(prev => [supplier, ...prev]),
    updateSupplier: (supplier) => setSuppliers(prev => prev.map(s => s.id === supplier.id ? supplier : s)),
    deleteSupplier: (id) => setSuppliers(prev => prev.filter(s => s.id !== id)),
    addVehicle: (vehicle) => setVehicles(prev => [vehicle, ...prev]),
    updateVehicle: (vehicle) => setVehicles(prev => prev.map(v => v.id === vehicle.id ? vehicle : v)),
    deleteVehicle: (id) => setVehicles(prev => prev.filter(v => v.id !== id)),
    setVehicles: (vehicles) => setVehicles(vehicles),
    addFuelWallet: (wallet) => setFuelWallets(prev => [wallet, ...prev]),
    setFuelWallets: (wallets) => setFuelWallets(wallets),
    setFuelTransactions: (transactions) => setFuelTransactions(transactions),
    getFuelWalletBalance: (walletName) => {
      const wallet = fuelWallets.find(w => w.name === walletName);
      return wallet ? wallet.balance : 0;
    },
    getVehicleFuelExpenses: (vehicleNo: string) => {
      return vehicleFuelExpenses.filter(expense => expense.vehicle_no === vehicleNo);
    },
    // POD management functions
    addPODFile: (podFile: PODFile) => {
      setPodFiles(prev => [podFile, ...prev]);
    },
    deletePODFile: (id: string) => {
      setPodFiles(prev => prev.filter(pod => pod.id !== id));
    },
    getPODFiles: () => {
      return podFiles;
    },
    allocateFuelToVehicle: async (vehicleNo, walletName, amount, date, narration, fuelQuantity, ratePerLiter, odometerReading, fuelType, allocatedBy) => {
      try {
        // Call backend API to allocate fuel
        const response = await apiService.allocateFuel({
          vehicle_no: vehicleNo,
          wallet_name: walletName,
          amount: amount,
          date: date,
          narration: narration || `Fuel allocation from ${walletName}`,
          fuel_quantity: fuelQuantity,
          rate_per_liter: ratePerLiter,
          odometer_reading: odometerReading,
          fuel_type: fuelType || 'Diesel',
          allocated_by: allocatedBy || 'System'
        });

        console.log('✅ Fuel allocated successfully via backend:', response);

        // Update local state with backend response - ONLY if not already exists
        if (response.transaction) {
          const existingExpense = vehicleFuelExpenses.find(exp => 
            exp.id === response.transaction._id || 
            (exp.vehicle_no === vehicleNo && exp.amount === amount && exp.date === date)
          );
          
          if (!existingExpense) {
            const vehicleFuelExpense: VehicleFuelExpense = {
              id: response.transaction._id || Date.now().toString(),
              vehicle_no: vehicleNo,
              wallet_name: walletName,
              amount: amount,
              date: date,
              narration: narration || `Fuel allocation from ${walletName}`,
              fuel_quantity: fuelQuantity,
              rate_per_liter: ratePerLiter,
              odometer_reading: odometerReading,
              created_at: new Date().toISOString(),
            };
            
            setVehicleFuelExpenses(prev => [vehicleFuelExpense, ...prev]);
          }
        }

        // Update wallet balance from backend response
        if (response.wallet) {
          setFuelWallets(prev => prev.map(wallet => 
            wallet.name === walletName 
              ? { ...wallet, balance: response.wallet.balance }
              : wallet
          ));
        }

        // Create ledger entry for fuel allocation - only vehicle expense for own vehicles
        const vehicle = vehicles.find(v => v.vehicle_no === vehicleNo);
        const isOwnVehicle = vehicle?.ownership_type === 'own';
        
        console.log('🚛 Fuel allocation debug:', {
          vehicleNo,
          vehicle: vehicle?.vehicle_no,
          ownership: vehicle?.ownership_type,
          isOwnVehicle,
          amount
        });
        
        if (isOwnVehicle) {
          // Check if ledger entry already exists to prevent duplicates
          const existingLedgerEntry = ledgerEntries.find(entry => 
            entry.reference_id === (response.transaction._id || Date.now().toString()) &&
            entry.ledger_type === 'vehicle_expense' &&
            entry.vehicle_no === vehicleNo
          );
          
          if (!existingLedgerEntry) {
            // For own vehicles: Create vehicle expense entry
            const vehicleExpenseEntry: LedgerEntry = {
              id: `${response.transaction._id || Date.now()}-ledger`,
              referenceId: response.transaction._id || Date.now().toString(),
              reference_id: response.transaction._id || Date.now().toString(),
              ledger_type: 'vehicle_expense',
              reference_name: `Vehicle ${vehicleNo} - Fuel Expense`,
              source_type: 'fuel',
              type: 'expense',
              date: date,
              description: `Fuel expense for vehicle ${vehicleNo} from ${walletName}`,
              debit: amount,
              credit: 0,
              balance: 0,
              created_at: new Date().toISOString(),
              vehicle_no: vehicleNo,
            };
            
            setLedgerEntries(prev => [vehicleExpenseEntry, ...prev]);
            console.log('✅ Created fuel expense ledger entry:', vehicleExpenseEntry);
          }
        }

        // Only trigger data sync, don't manually refresh to avoid duplicates
        console.log('🔄 Triggering data sync after successful fuel allocation');
        window.dispatchEvent(new CustomEvent('data-sync-required'));
        
      } catch (error) {
        console.error('❌ Failed to allocate fuel via backend:', error);
        
        // Fallback to local state update if backend fails
        const vehicleFuelExpense: VehicleFuelExpense = {
          id: Date.now().toString(),
          vehicle_no: vehicleNo,
          wallet_name: walletName,
          amount: amount,
          date: date,
          narration: narration || `Fuel allocation from ${walletName}`,
          fuel_quantity: fuelQuantity,
          rate_per_liter: ratePerLiter,
          odometer_reading: odometerReading,
          created_at: new Date().toISOString(),
        };
        
        setVehicleFuelExpenses(prev => [vehicleFuelExpense, ...prev]);
        
        // Update fuel wallet balance (decrease)
        setFuelWallets(prev => prev.map(wallet => 
          wallet.name === walletName 
            ? { ...wallet, balance: wallet.balance - amount }
            : wallet
        ));
        
        // Create ledger entry for fuel allocation - only vehicle expense for own vehicles
        const vehicle = vehicles.find(v => v.vehicle_no === vehicleNo);
        const isOwnVehicle = vehicle?.ownership_type === 'own';
        
        if (isOwnVehicle) {
          // For own vehicles: Only create vehicle expense entry
          const vehicleExpenseEntry: LedgerEntry = {
            id: `${vehicleFuelExpense.id}-ledger`,
            referenceId: vehicleFuelExpense.id,
            reference_id: vehicleFuelExpense.id,
            ledger_type: 'vehicle_expense',
            reference_name: `Vehicle ${vehicleNo} - Fuel Expense`,
            source_type: 'fuel',
            type: 'expense',
            date: date,
            description: `Fuel expense for vehicle ${vehicleNo} from ${walletName}`,
            debit: amount,
            credit: 0,
            balance: 0,
            created_at: new Date().toISOString(),
            vehicle_no: vehicleNo,
          };
          
          setLedgerEntries(prev => [vehicleExpenseEntry, ...prev]);
          
          // Save to backend
          try {
            apiService.createLedgerEntry(vehicleExpenseEntry).then(() => {
              console.log('✅ Fuel expense ledger entry saved to backend:', vehicleExpenseEntry);
            }).catch(error => {
              console.error('❌ Failed to save fuel expense ledger entry:', error);
            });
          } catch (error) {
            console.error('❌ Error creating fuel expense ledger entry:', error);
          }
        }
        
        // Trigger sync even in fallback scenario
        console.log('🔄 Triggering data sync after fallback fuel allocation');
        window.dispatchEvent(new CustomEvent('data-sync-required'));
      }
      
      // Create fuel transaction for tracking
      const fuelTransaction: FuelTransaction = {
        id: `fuel-tx-${Date.now()}`,
        type: 'fuel_allocation',
        wallet_name: walletName,
        amount: amount,
        date: date,
        vehicle_no: vehicleNo,
        narration: narration || `Fuel allocation from ${walletName}`,
        created_at: new Date().toISOString(),
      };
      
      setFuelTransactions(prev => [fuelTransaction, ...prev]);
    },
    bulkPaySupplierMemos: (supplierName: string, memoIds: string[], paymentAmount: number, paymentDate: string, bankAccount: string, paymentMode: 'cash' | 'bank' | 'cheque' | 'bank_transfer' | 'upi', narration?: string, transactionId?: string) => {
      // Create banking entry for bulk payment
      const bankingEntry: BankingEntry = {
        id: transactionId || `bulk-pay-supplier-${Date.now()}`,
        date: paymentDate,
        type: 'debit',
        category: 'supplier_payment',
        amount: paymentAmount,
        narration: narration || `Bulk payment to ${supplierName} for ${memoIds.length} memos`,
        bank_account: bankAccount,
        payment_mode: paymentMode,
        created_at: new Date().toISOString(),
      };
      
      setBankingEntries(prev => [bankingEntry, ...prev]);
      
      // Mark selected memos as paid
      setMemos(prev => prev.map(memo => 
        memoIds.includes(memo.id) 
          ? { ...memo, paid_date: paymentDate, paid_amount: paymentAmount / memoIds.length }
          : memo
      ));
      
      // Create ledger entry for supplier payment
      const supplierLedgerEntry: LedgerEntry = {
        id: `${bankingEntry.id}-supplier-ledger`,
        ledger_type: 'supplier',
        reference_id: bankingEntry.id,
        reference_name: supplierName,
        date: paymentDate,
        description: `Bulk payment to ${supplierName}`,
        debit: paymentAmount,
        credit: 0,
        balance: 0,
        created_at: new Date().toISOString(),
      };
      
      setLedgerEntries(prev => [supplierLedgerEntry, ...prev]);
    },
    bulkPayBills: (partyName: string, billIds: string[], paymentAmount: number, paymentDate: string, bankAccount: string, paymentMode: 'cash' | 'bank' | 'cheque' | 'bank_transfer' | 'upi', narration?: string) => {
      // Create banking entry for bulk payment
      const bankingEntry: BankingEntry = {
        id: `bulk-pay-bills-${Date.now()}`,
        date: paymentDate,
        type: 'credit',
        category: 'bill_payment',
        amount: paymentAmount,
        narration: narration || `Bulk payment from ${partyName} for ${billIds.length} bills`,
        bank_account: bankAccount,
        payment_mode: paymentMode,
        created_at: new Date().toISOString(),
      };
      
      setBankingEntries(prev => [bankingEntry, ...prev]);
      
      // Mark selected bills as received
      setBills(prev => prev.map(bill => 
        billIds.includes(bill.id) 
          ? { ...bill, received_date: paymentDate, received_amount: paymentAmount / billIds.length }
          : bill
      ));
      
      // Create ledger entry for party payment
      const partyLedgerEntry: LedgerEntry = {
        id: `${bankingEntry.id}-party-ledger`,
        ledger_type: 'party',
        reference_id: bankingEntry.id,
        reference_name: partyName,
        date: paymentDate,
        description: `Bulk payment from ${partyName}`,
        debit: 0,
        credit: paymentAmount,
        balance: 0,
        created_at: new Date().toISOString(),
      };
      
      setLedgerEntries(prev => [partyLedgerEntry, ...prev]);
    },
    setCashbookEntries: (entries: any[]) => setCashbookEntries(entries),
    setPODFiles: (files: any[]) => setPodFiles(files),
    cleanupSupplierLedgerForOwnVehicles: () => {
      // Remove supplier ledger entries for own vehicles
      setLedgerEntries(prev => prev.filter(entry => {
        if (entry.ledger_type !== 'supplier') return true;
        
        // Find the memo for this ledger entry
        const memo = memos.find(m => m.memo_number === entry.memo_number);
        if (!memo) return true;
        
        // Find the loading slip and vehicle
        const ls = loadingSlips.find(s => s.id === memo.loading_slip_id);
        const vehicle = vehicles.find(v => v.vehicle_no === ls?.vehicle_no);
        
        // If it's an own vehicle, remove this supplier ledger entry
        if (vehicle?.ownership_type === 'own') {
          console.log('🧹 Removing incorrect supplier ledger entry for own vehicle:', {
            memo: memo.memo_number,
            vehicle: ls?.vehicle_no,
            supplier: memo.supplier
          });
          return false;
        }
        
        return true;
      }));
    },
  };

  return (
    <DataStoreContext.Provider value={contextValue}>
      {children}
    </DataStoreContext.Provider>
  );
};

export const useDataStore = () => {
  const context = useContext(DataStoreContext);
  if (!context) {
    throw new Error('useDataStore must be used within a DataStoreProvider');
  }
  return context;
};
