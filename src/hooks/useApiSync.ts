import { useEffect, useRef, useState } from 'react';
import { apiService } from '../lib/api';
import { useDataStore } from '../lib/store';

export const useApiSync = () => {
  const store = useDataStore();
  const [isRealTimeConnected, setIsRealTimeConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const syncDataRef = useRef<any>(null); // Store syncData function reference

  useEffect(() => {
    const syncData = async () => {
      try {
        // Define handleSyncEvent here so we can reference it
        const handleSyncEvent = () => {
          if (syncTimeoutRef.current) {
            clearTimeout(syncTimeoutRef.current);
          }
          syncTimeoutRef.current = setTimeout(() => {
            if (syncDataRef.current) {
              syncDataRef.current();
            }
          }, 1000);
        };

        // Store reference to current handleSyncEvent so we can remove it later
        (window as any).__cashbookSyncHandler = handleSyncEvent;

        // Add listener for sync events from other components
        window.addEventListener('data-sync-required', handleSyncEvent);

        // Fetch ALL data from API with high limits to ensure complete import
        const [
          billsResponse,
          partiesResponse,
          suppliersResponse,
          vehiclesResponse,
          memosResponse,
          loadingSlipsResponse,
          bankingEntriesResponse,
          cashbookEntriesResponse,
          ledgerEntriesResponse,
          fuelWalletsResponse,
          fuelTransactionsResponse
        ] = await Promise.allSettled([
          apiService.getBills({ limit: 10000 }),
          apiService.getParties({ limit: 10000 }),
          apiService.getSuppliers({ limit: 10000 }),
          apiService.getVehicles({ limit: 10000 }),
          apiService.getMemos({ limit: 10000 }),
          apiService.getLoadingSlips({ limit: 10000 }),
          apiService.getBankingEntries({ limit: 1000000 }),
          apiService.getCashbookEntries({ limit: 1000000 }),
          apiService.getLedgerEntries(),
          apiService.getFuelWallets(),
          apiService.getFuelTransactions()
        ]);

        // Clear legacy blacklists from localStorage if present
        try {
          localStorage.removeItem('brc_deleted_bills');
          localStorage.removeItem('brc_deleted_memos');
        } catch (e) {}

        // ── BULLETPROOF BILLS SYNC ──
        // Strategy: LOCAL is the floor — never drop anything saved locally.
        // Backend updates existing items (by ID/number) and adds new ones.
        // Items are only removed when the user explicitly deletes them.
        if (billsResponse.status === 'fulfilled') {
          const fetchedBills = billsResponse.value.bills || [];
          const currentBills = store.bills;

          // Build a map starting from ALL current local bills
          // Key: canonical bill_number (upper). Value: best version of the bill.
          const mergedBillMap = new Map<string, any>();

          // Step 1 — seed with every local bill (they are the floor)
          currentBills.forEach(bill => {
            const billNo = bill.bill_number ? bill.bill_number.trim().toUpperCase() : null;
            const id = bill.id || (bill as any)._id;
            if (billNo) mergedBillMap.set(billNo, { ...bill, id: id || billNo });
            else if (id) mergedBillMap.set(String(id), bill);
          });

          // Step 2 — upsert from backend: if backend has a newer/confirmed version, use it
          fetchedBills.forEach(fetched => {
            const billNo = fetched.bill_number ? fetched.bill_number.trim().toUpperCase() : null;
            const id = fetched.id || (fetched as any)._id;
            const normalized = { ...fetched, id: id || billNo };
            if (billNo) mergedBillMap.set(billNo, normalized); // backend wins for same bill_number
            else if (id) mergedBillMap.set(String(id), normalized);
          });

          const completeBills = Array.from(mergedBillMap.values()).sort((a, b) => {
            const dateA = new Date(a.created_at || a.date || 0).getTime();
            const dateB = new Date(b.created_at || b.date || 0).getTime();
            return dateB - dateA;
          });

          // Only call setBills if the result is non-empty OR we have no local data
          if (completeBills.length > 0 || currentBills.length === 0) {
            store.setBills(completeBills);
          }
        }

        // ── BULLETPROOF MEMOS SYNC ──
        // Same union strategy as bills above.
        if (memosResponse.status === 'fulfilled') {
          const fetchedMemos = memosResponse.value.memos || [];
          const currentMemos = store.memos;

          const mergedMemoMap = new Map<string, any>();

          // Step 1 — seed with all local memos
          currentMemos.forEach(memo => {
            const memoNo = memo.memo_number ? memo.memo_number.trim().toUpperCase() : null;
            const id = memo.id || (memo as any)._id;
            if (memoNo) mergedMemoMap.set(memoNo, { ...memo, id: id || memoNo });
            else if (id) mergedMemoMap.set(String(id), memo);
          });

          // Step 2 — upsert from backend
          fetchedMemos.forEach(fetched => {
            const memoNo = fetched.memo_number ? fetched.memo_number.trim().toUpperCase() : null;
            const id = fetched.id || (fetched as any)._id;
            const normalized = { ...fetched, id: id || memoNo };
            if (memoNo) mergedMemoMap.set(memoNo, normalized);
            else if (id) mergedMemoMap.set(String(id), normalized);
          });

          const completeMemos = Array.from(mergedMemoMap.values()).sort((a, b) => {
            const dateA = new Date(a.created_at || a.date || 0).getTime();
            const dateB = new Date(b.created_at || b.date || 0).getTime();
            return dateB - dateA;
          });

          if (completeMemos.length > 0 || currentMemos.length === 0) {
            store.setMemos(completeMemos);
          }
        }

        // BULLETPROOF LOADING SLIPS IMPORT AND SYNC
        if (loadingSlipsResponse.status === 'fulfilled') {
          const fetchedSlips = loadingSlipsResponse.value.loadingSlips || [];
          const currentSlips = store.loadingSlips;

          // SAFETY GUARD: If backend returns 0 LRs but we have local data, preserve it
          if (fetchedSlips.length === 0 && currentSlips.length > 0) {
            console.log('[Sync] Backend returned 0 LRs but local has', currentSlips.length, '— preserving local state');
          } else {
            const recentSlipCreation = localStorage.getItem('lastLoadingSlipCreation');
            // 30s guard for LRs
            const isRecentSlipCreation = recentSlipCreation && (Date.now() - parseInt(recentSlipCreation)) < 30000;

            const slipMap = new Map<string, any>();
            const seenNumbers = new Set<string>();

            fetchedSlips.forEach(fetchedSlip => {
              const id = fetchedSlip.id || (fetchedSlip as any)._id;
              const slipNo = fetchedSlip.slip_number || fetchedSlip.lr_number;
              const normalized = {
                ...fetchedSlip,
                id: id || (fetchedSlip as any)._id || slipNo
              };
              if (id) slipMap.set(String(id), normalized);
              if ((fetchedSlip as any)._id) slipMap.set(String((fetchedSlip as any)._id), normalized);
              if (slipNo) {
                slipMap.set(`num:${String(slipNo).trim().toUpperCase()}`, normalized);
                seenNumbers.add(String(slipNo).trim().toUpperCase());
              }
            });

            if (isRecentSlipCreation) {
              currentSlips.forEach(slip => {
                const id = slip.id || (slip as any)._id;
                const slipNo = (slip.slip_number || slip.lr_number) ? String(slip.slip_number || slip.lr_number).trim().toUpperCase() : '';

                const isAlreadyInBackend = (id && slipMap.has(String(id))) || (slipNo && seenNumbers.has(slipNo));
                const isMongoId = id && String(id).match(/^[0-9a-fA-F]{24}$/);

                if (!isAlreadyInBackend && !isMongoId) {
                  if (slipNo) {
                    slipMap.set(`num:${slipNo}`, slip);
                    seenNumbers.add(slipNo);
                  } else if (id) {
                    slipMap.set(String(id), slip);
                  }
                }
              });
            }

            const uniqueSlipsMap = new Map<string, any>();
            slipMap.forEach((slip) => {
              const key = slip.id || (slip as any)._id || slip.slip_number || slip.lr_number;
              if (key && !uniqueSlipsMap.has(String(key))) {
                uniqueSlipsMap.set(String(key), slip);
              }
            });

            const completeSlips = Array.from(uniqueSlipsMap.values()).sort((a, b) => {
              const dateA = new Date(a.created_at || a.date || 0).getTime();
              const dateB = new Date(b.created_at || b.date || 0).getTime();
              return dateB - dateA;
            });

            store.setLoadingSlips(completeSlips);
          }
        }

        if (bankingEntriesResponse.status === 'fulfilled') {
          // Check if banking entry was recently created (within last 5 seconds)
          const recentBankingCreation = localStorage.getItem('lastBankingCreation');
          const isRecentCreation = recentBankingCreation && (Date.now() - parseInt(recentBankingCreation)) < 5000;

          if (!(isRecentCreation && store.bankingEntries.length > 0)) {
            const fetchedBankingEntries = bankingEntriesResponse.value.bankingEntries || [];

            const normalizedBankingEntries = fetchedBankingEntries.map((entry: any) => ({
              ...entry,
              id: entry.id || entry._id,
            }));

            const uniqueBankingEntries = normalizedBankingEntries.filter((entry: any, index: number, self: any[]) => {
              const entryId = entry.id || entry._id;
              return index === self.findIndex((e: any) => (e.id || e._id) === entryId);
            });

            const mergedMap = new Map<string, any>();

            // CRITICAL: Preserve ALL store entries first - never lose data!
            store.bankingEntries.forEach((entry: any) => {
              const entryId = entry.id || entry._id;
              if (entryId) mergedMap.set(entryId, entry);
            });

            // Then update with backend entries - backend is authoritative for updated data
            uniqueBankingEntries.forEach((entry: any) => {
              const entryId = entry.id || entry._id;
              if (entryId) {
                const existingEntry = mergedMap.get(entryId);
                if (!existingEntry || (entry.updated_at && existingEntry.updated_at && new Date(entry.updated_at) > new Date(existingEntry.updated_at))) {
                  mergedMap.set(entryId, entry);
                }
              }
            });

            const mergedBanking = Array.from(mergedMap.values());

            if (mergedBanking.length > 0 || store.bankingEntries.length === 0) {
              store.setBankingEntries(mergedBanking);
            }
          }
        }

        if (cashbookEntriesResponse.status === 'fulfilled') {
          // Check if cashbook entry was recently created (within last 8 seconds)
          const recentCashbookCreation = localStorage.getItem('lastCashbookCreation');
          const isRecentCreation = recentCashbookCreation && (Date.now() - parseInt(recentCashbookCreation)) < 8000;

          if (!(isRecentCreation && store.cashbookEntries.length > 0)) {
            const fetchedCashbookEntries = cashbookEntriesResponse.value.cashbookEntries || [];

            const normalizedCashbookEntries = fetchedCashbookEntries.map((entry: any) => ({
              ...entry,
              id: entry.id || entry._id,
            }));

            const uniqueCashbookEntries = normalizedCashbookEntries.filter((entry: any, index: number, self: any[]) => {
              const entryId = entry.id || entry._id;
              return index === self.findIndex((e: any) => (e.id || e._id) === entryId);
            });

            const mergedCashMap = new Map<string, any>();

            // CRITICAL: Preserve ALL store entries first - never lose data!
            store.cashbookEntries.forEach((entry: any) => {
              const entryId = entry.id || entry._id;
              if (entryId) mergedCashMap.set(entryId, entry);
            });

            uniqueCashbookEntries.forEach((entry: any) => {
              const entryId = entry.id || entry._id;
              if (entryId) {
                const existingEntry = mergedCashMap.get(entryId);
                if (!existingEntry || (entry.updated_at && existingEntry.updated_at && new Date(entry.updated_at) > new Date(existingEntry.updated_at))) {
                  mergedCashMap.set(entryId, entry);
                }
              }
            });

            const mergedCashbook = Array.from(mergedCashMap.values());

            if (mergedCashbook.length > 0 || store.cashbookEntries.length === 0) {
              store.setCashbookEntries(mergedCashbook);
            }
          }
        }

        if (partiesResponse.status === 'fulfilled') {
          const fetchedParties = partiesResponse.value.parties || [];
          // Single batch update instead of N delete + N add calls
          store.setParties(fetchedParties);
        }

        if (suppliersResponse.status === 'fulfilled') {
          const fetchedSuppliers = suppliersResponse.value.suppliers || [];
          store.setSuppliers(fetchedSuppliers);
        } else {
          console.error('❌ Failed to fetch suppliers:', (suppliersResponse as PromiseRejectedResult).reason);
        }

        if (vehiclesResponse.status === 'fulfilled') {
          const fetchedVehicles = vehiclesResponse.value.vehicles || [];
          store.setVehicles(fetchedVehicles);
        }

        if (fuelWalletsResponse.status === 'fulfilled') {
          const fetchedWallets = fuelWalletsResponse.value.wallets || [];
          store.setFuelWallets(fetchedWallets);
        }

        if (ledgerEntriesResponse.status === 'fulfilled') {
          const fetchedLedgerEntries = ledgerEntriesResponse.value.ledgerEntries || [];
          store.setLedgerEntries(fetchedLedgerEntries);
        }

        if (fuelTransactionsResponse.status === 'fulfilled') {
          // Check if fuel allocation was recently created (within last 8 seconds)
          const recentFuelAllocation = localStorage.getItem('lastFuelAllocation');
          const isRecentAllocation = recentFuelAllocation && (Date.now() - parseInt(recentFuelAllocation)) < 8000;

          if (!isRecentAllocation) {
            const fetchedTransactions = fuelTransactionsResponse.value.transactions || [];
            store.setFuelTransactions(fetchedTransactions);
          }
        }

      } catch (error) {
        console.error('Failed to sync data from API:', error);
      }
    };

    // Real-time sync connection
    const connectToRealTimeSync = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const baseUrl = process.env.NODE_ENV === 'production'
        ? window.location.origin
        : 'http://localhost:5001';

      const eventSource = new EventSource(`${baseUrl}/api/sync/events`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsRealTimeConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const syncEvent = JSON.parse(event.data);
          if (syncEvent.type === 'data_change') {
            setTimeout(() => syncData(), 500);
          }
        } catch (error) {
          console.error('Error parsing sync event:', error);
        }
      };

      eventSource.onerror = () => {
        setIsRealTimeConnected(false);
        setTimeout(() => {
          if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
            connectToRealTimeSync();
          }
        }, 5000);
      };
    };

    // Store reference to syncData so handleSyncEvent can call it
    syncDataRef.current = syncData;

    syncData();
    connectToRealTimeSync();

    // Cleanup event listener and EventSource
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }

      const handler = (window as any).__cashbookSyncHandler;
      if (handler) {
        window.removeEventListener('data-sync-required', handler);
        delete (window as any).__cashbookSyncHandler;
      }

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // Periodic sync every 5 minutes to keep data fresh when SSE misses an event
  useEffect(() => {
    const intervalId = setInterval(() => {
      window.dispatchEvent(new CustomEvent('data-sync-required'));
    }, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(intervalId);
  }, []);

  // Return functions to sync data after mutations
  const syncAfterCreate = async (type: string, data: any) => {
    try {
      switch (type) {
        case 'bill':
          localStorage.setItem('lastBillCreation', Date.now().toString());
          const billResponse = await apiService.createBill(data);
          store.addBill(billResponse.bill);
          window.dispatchEvent(new CustomEvent('data-sync-required'));
          break;
        case 'memo':
          if (!data.loading_slip_id && (!data.loading_slip_ids || data.loading_slip_ids.length === 0)) {
            throw new Error('loading_slip_id or loading_slip_ids is required for memo creation');
          }
          if (!data.loading_slip_id && data.loading_slip_ids && data.loading_slip_ids.length > 0) {
            data.loading_slip_id = data.loading_slip_ids[0];
          }
          localStorage.setItem('lastMemoCreation', Date.now().toString());
          const memoResponse = await apiService.createMemo(data);
          store.addMemo(memoResponse.memo);
          window.dispatchEvent(new CustomEvent('data-sync-required'));
          break;
        case 'loadingSlip':
          localStorage.setItem('lastLoadingSlipCreation', Date.now().toString());
          const slipResponse = await apiService.createLoadingSlip(data);
          store.addLoadingSlip(slipResponse.loadingSlip);
          window.dispatchEvent(new CustomEvent('data-sync-required'));
          break;
        case 'party':
          const partyResponse = await apiService.createParty(data);
          store.addParty(partyResponse.party);
          window.dispatchEvent(new CustomEvent('data-sync-required'));
          break;
        case 'supplier':
          const supplierResponse = await apiService.createSupplier(data);
          store.addSupplier(supplierResponse.supplier);
          window.dispatchEvent(new CustomEvent('data-sync-required'));
          break;
        case 'vehicle':
          const vehicleResponse = await apiService.createVehicle(data);
          store.addVehicle(vehicleResponse.vehicle);
          window.dispatchEvent(new CustomEvent('data-sync-required'));
          break;
        case 'bankingEntry':
          // Banking entries are handled directly by Banking component
          break;
        default:
          console.warn('Unknown sync type:', type);
      }
    } catch (error) {
      console.error(`Failed to create ${type}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      window.dispatchEvent(new CustomEvent('sync-error', {
        detail: { type: 'create', entity: type, error: errorMessage }
      }));
      throw error;
    }
  };

  const syncAfterUpdate = async (type: string, id: string, data: any) => {
    try {
      switch (type) {
        case 'bill':
          const billResponse = await apiService.updateBill(id, data);
          store.updateBill(billResponse.bill);
          window.dispatchEvent(new CustomEvent('data-sync-required'));
          break;
        case 'memo':
          const memoResponse = await apiService.updateMemo(id, data);
          store.updateMemo(memoResponse.memo);
          window.dispatchEvent(new CustomEvent('data-sync-required'));
          break;
        case 'loadingSlip':
          const slipResponse = await apiService.updateLoadingSlip(id, data);
          store.updateLoadingSlip(slipResponse.loadingSlip);
          window.dispatchEvent(new CustomEvent('data-sync-required'));
          break;
        case 'party':
          const partyResponse = await apiService.updateParty(id, data);
          store.updateParty(partyResponse.party);
          window.dispatchEvent(new CustomEvent('data-sync-required'));
          break;
        case 'supplier':
          const supplierResponse = await apiService.updateSupplier(id, data);
          store.updateSupplier(supplierResponse.supplier);
          window.dispatchEvent(new CustomEvent('data-sync-required'));
          break;
        case 'vehicle':
          const vehicleResponse = await apiService.updateVehicle(id, data);
          store.updateVehicle(vehicleResponse.vehicle);
          window.dispatchEvent(new CustomEvent('data-sync-required'));
          break;
        case 'bankingEntry':
          const bankingResponse = await apiService.updateBankingEntry(id, data);
          store.updateBankingEntry(id, bankingResponse.bankingEntry);
          window.dispatchEvent(new CustomEvent('data-sync-required'));
          break;
        default:
          console.warn('Unknown sync type:', type);
      }
    } catch (error) {
      console.error(`Failed to update ${type}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      window.dispatchEvent(new CustomEvent('sync-error', {
        detail: { type: 'update', entity: type, error: errorMessage }
      }));
      throw error;
    }
  };

  const syncAfterDelete = async (type: string, id: string) => {
    try {
      switch (type) {
        case 'bill':
          await apiService.deleteBill(id);
          store.deleteBill(id);
          window.dispatchEvent(new CustomEvent('data-sync-required'));
          break;
        case 'memo':
          await apiService.deleteMemo(id);
          store.deleteMemo(id);
          window.dispatchEvent(new CustomEvent('data-sync-required'));
          break;
        case 'loadingSlip':
          await apiService.deleteLoadingSlip(id);
          store.deleteLoadingSlip(id);
          window.dispatchEvent(new CustomEvent('data-sync-required'));
          break;
        case 'party':
          await apiService.deleteParty(id);
          store.deleteParty(id);
          window.dispatchEvent(new CustomEvent('data-sync-required'));
          break;
        case 'supplier':
          await apiService.deleteSupplier(id);
          store.deleteSupplier(id);
          window.dispatchEvent(new CustomEvent('data-sync-required'));
          break;
        case 'vehicle':
          await apiService.deleteVehicle(id);
          store.deleteVehicle(id);
          window.dispatchEvent(new CustomEvent('data-sync-required'));
          break;
        case 'bankingEntry':
          await apiService.deleteBankingEntry(id);
          store.deleteBankingEntry(id);
          window.dispatchEvent(new CustomEvent('data-sync-required'));
          break;
        default:
          console.warn('Unknown sync type:', type);
      }
    } catch (error) {
      console.error(`Failed to delete ${type}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      window.dispatchEvent(new CustomEvent('sync-error', {
        detail: { type: 'delete', entity: type, error: errorMessage }
      }));
      throw error;
    }
  };

  const retrySync = async () => {
    try {
      window.dispatchEvent(new CustomEvent('data-sync-required'));
    } catch (error) {
      console.error('Failed to retry sync:', error);
    }
  };

  return {
    syncAfterCreate,
    syncAfterUpdate,
    syncAfterDelete,
    retrySync,
    isRealTimeConnected
  };
};
