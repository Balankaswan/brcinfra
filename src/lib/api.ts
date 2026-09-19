// API configuration and service layer for BRC backend
const API_BASE_URL = 'http://127.0.0.1:5001/api';

// For LAN access, you can override this by setting VITE_API_URL environment variable
const API_URL = import.meta.env.VITE_API_URL || API_BASE_URL;

interface ApiResponse<T> {
  data?: T;
  message?: string;
  error?: string;
}

class ApiService {
  private baseURL: string;
  private token: string | null = null;
  private pendingRequests: Map<string, Promise<any>> = new Map();

  constructor() {
    let rawUrl = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001/api').trim();
    if (rawUrl.endsWith('/')) {
      rawUrl = rawUrl.slice(0, -1);
    }
    this.baseURL = rawUrl;
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    console.log(`Making API request to: ${url}`);
    console.log('Request options:', { method: options.method, headers });
    if (options.body) {
      console.log('Request body:', options.body);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      console.log(`Response status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error response data:', errorData);
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Success response:', data);
      return data;
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      console.error('Full error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        url,
        options
      });
      throw error;
    }
  }

  // Authentication
  async login(email: string, password: string) {
    const response = await this.request<{token: string, user: any}>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (response.token) {
      this.setToken(response.token);
    }
    
    return response;
  }

  async register(userData: {name: string, email: string, password: string, role?: string}) {
    return this.request<{token: string, user: any}>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.clearToken();
    }
  }

  async getProfile() {
    return this.request<{user: any}>('/auth/profile');
  }

  async createPODFile(data: any) {
    return this.request<{podFile: any}>('/pod', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Loading Slips / LRs
  async getLoadingSlips(params?: {party?: string, vehicle_no?: string, supplier?: string, consignor_name?: string, consignee_name?: string, page?: number, limit?: number}) {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return this.request<{loadingSlips: any[], total: number, totalPages: number}>(`/loading-slips${queryString}`);
  }

  async getLoadingSlip(id: string) {
    return this.request<any>(`/loading-slips/${id}`);
  }

  async createLoadingSlip(data: any) {
    return this.request<{loadingSlip: any}>('/loading-slips', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLoadingSlip(id: string, data: any) {
    return this.request<{loadingSlip: any}>(`/loading-slips/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteLoadingSlip(id: string) {
    return this.request(`/loading-slips/${id}`, { method: 'DELETE' });
  }

  // LR — Next number for auto-fill
  async getNextLRNumber(branchCode?: string) {
    const qs = branchCode ? `?branch_code=${branchCode}` : '';
    return this.request<{nextLRNumber: string}>(`/loading-slips/next-number${qs}`);
  }

  // LR — Available for billing (unbilled LRs)
  async getLRsAvailableForBilling(params?: {
    party?: string;
    consignor_name?: string;
    consignee_name?: string;
    search?: string;
    exclude_ids?: string;
  }) {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return this.request<{loadingSlips: any[], total: number}>(`/loading-slips/available-for-billing${queryString}`);
  }

  // Bills
  async getBills(params?: {status?: string, party?: string, vehicle_no?: string, page?: number, limit?: number}) {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return this.request<{bills: any[], total: number, totalPages: number}>(`/bills${queryString}`);
  }

  async getBill(id: string) {
    return this.request<any>(`/bills/${id}`);
  }

  async createBill(data: any) {
    return this.request<{bill: any}>('/bills', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateBill(id: string, data: any) {
    return this.request<{bill: any}>(`/bills/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteBill(id: string) {
    return this.request(`/bills/${id}`, { method: 'DELETE' });
  }

  async addLrToBill(billId: string, loading_slip_ids: string[]) {
    return this.request<{bill: any}>(`/bills/${billId}/add-lr`, {
      method: 'POST',
      body: JSON.stringify({ loading_slip_ids }),
    });
  }

  async markBillAsReceived(id: string, data: {received_date: string, received_amount: number}) {
    return this.request<{bill: any}>(`/bills/${id}/received`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Memos
  async getMemos(params?: {status?: string, supplier?: string, vehicle_no?: string, page?: number, limit?: number}) {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return this.request<{memos: any[], total: number, totalPages: number}>(`/memos${queryString}`);
  }

  async getMemo(id: string) {
    return this.request<any>(`/memos/${id}`);
  }

  async createMemo(data: any) {
    return this.request<{memo: any}>('/memos', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMemo(id: string, data: any) {
    return this.request<{memo: any}>(`/memos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteMemo(id: string) {
    return this.request(`/memos/${id}`, { method: 'DELETE' });
  }

  async markMemoAsPaid(id: string, data: {paid_date: string, paid_amount: number}) {
    return this.request<{memo: any}>(`/memos/${id}/paid`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Banking
  async getBankingEntries(params?: {page?: number, limit?: number}): Promise<{ bankingEntries: any[]; total: number; totalPages: number }> {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return this.request(`/banking${queryString}`);
  }

  async getCashbookEntries(params?: {page?: number, limit?: number}): Promise<{ cashbookEntries: any[]; total: number; totalPages: number; currentBalance: number }> {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return this.request(`/cashbook${queryString}`);
  }

  async getCashbookBalance(): Promise<{ currentBalance: number; today: any; thisMonth: any }> {
    return this.request('/cashbook/balance');
  }

  async createBankingEntry(data: any) {
    // Create a unique key based on the data content only (no timestamp)
    const requestKey = `POST-/banking-${JSON.stringify(data)}`;
    
    // Check if this exact request is already pending
    if (this.pendingRequests.has(requestKey)) {
      console.log('🚫 Duplicate banking entry request detected, returning existing promise');
      return this.pendingRequests.get(requestKey);
    }
    
    // Create the request promise
    const requestPromise = this.request<{bankingEntry: any}>('/banking', {
      method: 'POST',
      body: JSON.stringify(data),
    }).finally(() => {
      // Clean up the pending request after completion (with small delay)
      setTimeout(() => {
        this.pendingRequests.delete(requestKey);
      }, 1000);
    });
    
    // Store the pending request
    this.pendingRequests.set(requestKey, requestPromise);
    
    console.log('🚀 Creating new banking entry request:', requestKey);
    return requestPromise;
  }

  async createCashbookEntry(data: any) {
    return this.request<{cashbookEntry: any}>('/cashbook', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteCashbookEntry(id: string) {
    return this.request(`/cashbook/${id}`, { method: 'DELETE' });
  }

  async updateBankingEntry(id: string, data: any) {
    return this.request<{bankingEntry: any}>(`/banking/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteBankingEntry(id: string) {
    return this.request(`/banking/${id}`, { method: 'DELETE' });
  }

  // Parties
  async getParties(params?: {search?: string, page?: number, limit?: number}) {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return this.request<{parties: any[], total: number, totalPages: number}>(`/parties${queryString}`);
  }

  async createParty(data: any) {
    return this.request<{party: any}>('/parties', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateParty(id: string, data: any) {
    return this.request<{party: any}>(`/parties/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteParty(id: string) {
    return this.request(`/parties/${id}`, { method: 'DELETE' });
  }

  async createPartyDebitNote(data: {party_name: string, amount: number, narration: string, date: string}) {
    return this.request<{ledgerEntry: any}>('/parties/debit-note', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Suppliers
  async getSuppliers(params?: {search?: string, page?: number, limit?: number}) {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return this.request<{suppliers: any[], total: number, totalPages: number}>(`/suppliers${queryString}`);
  }

  async createSupplier(data: any) {
    return this.request<{supplier: any}>('/suppliers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSupplier(id: string, data: any) {
    return this.request<{supplier: any}>(`/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSupplier(id: string) {
    return this.request(`/suppliers/${id}`, { method: 'DELETE' });
  }

  async createSupplierDebitNote(data: {supplier_name: string, amount: number, narration: string, date: string}) {
    return this.request<{ledgerEntry: any}>('/suppliers/debit-note', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Vehicles
  async getVehicles(params?: {ownership_type?: string, search?: string, page?: number, limit?: number}) {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return this.request<{vehicles: any[], total: number, totalPages: number}>(`/vehicles${queryString}`);
  }

  async createVehicle(data: any) {
    return this.request<{vehicle: any}>('/vehicles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateVehicle(id: string, data: any) {
    return this.request<{vehicle: any}>(`/vehicles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteVehicle(id: string) {
    return this.request(`/vehicles/${id}`, { method: 'DELETE' });
  }

  // Ledgers
  async getLedgerEntries(params?: {ledger_type?: string, reference_name?: string, vehicle_no?: string, page?: number, limit?: number}) {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '?limit=10000';
    return this.request<{ledgerEntries: any[], total: number, totalPages: number}>(`/ledgers${queryString}`);
  }

  async getLedgerSummary(referenceName: string, ledgerType?: string) {
    const queryString = ledgerType ? `?ledger_type=${ledgerType}` : '';
    return this.request<any>(`/ledgers/summary/${encodeURIComponent(referenceName)}${queryString}`);
  }

  async createLedgerEntry(data: any) {
    return this.request<{ledgerEntry: any}>('/ledgers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteLedgerEntry(id: string) {
    return this.request(`/ledgers/${id}`, { method: 'DELETE' });
  }

  // Fuel Management
  async getFuelWallets() {
    return this.request<{wallets: any[]}>('/fuel/wallets');
  }

  async createFuelWallet(data: any) {
    return this.request<{wallet: any}>('/fuel/wallets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateFuelWallet(id: string, data: any) {
    return this.request<{wallet: any}>(`/fuel/wallets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getFuelTransactions(params?: {wallet_name?: string, vehicle_no?: string, type?: string, page?: number, limit?: number}) {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return this.request<{transactions: any[], total: number, totalPages: number}>(`/fuel/transactions${queryString}`);
  }

  async createFuelTransaction(data: any) {
    return this.request<{transaction: any}>('/fuel/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async allocateFuel(data: {
    vehicle_no: string,
    wallet_name: string,
    amount: number,
    date: string,
    narration?: string,
    fuel_quantity?: number,
    rate_per_liter?: number,
    odometer_reading?: number,
    fuel_type?: string,
    allocated_by?: string,
    supplier_name?: string
  }) {
    return this.request<{transaction: any, wallet: any}>('/fuel/allocate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteFuelTransaction(id: string) {
    return this.request(`/fuel/transactions/${id}`, { method: 'DELETE' });
  }

  // POD Files
  async getPODFiles(params?: {billNo?: string, vehicleNo?: string, party?: string, page?: number, limit?: number}) {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return this.request<{podFiles: any[], total: number, totalPages: number}>(`/pod${queryString}`);
  }

  async uploadPODFile(data: any) {
    return this.request<{podFile: any}>('/pod', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deletePODFile(id: string) {
    return this.request(`/pod/${id}`, { method: 'DELETE' });
  }

  // Party Commission Ledger endpoints
  async getPartyCommissionLedger(filters: any = {}) {
    const params = new URLSearchParams();
    if (filters.date_from) params.append('date_from', filters.date_from);
    if (filters.date_to) params.append('date_to', filters.date_to);
    if (filters.bill_number) params.append('bill_number', filters.bill_number);
    if (filters.party_id) params.append('party_id', filters.party_id);
    
    return this.request(`/party-commission-ledger?${params}`);
  }

  async getPartyCommissionLedgerSummary(filters: any = {}) {
    const params = new URLSearchParams();
    if (filters.date_from) params.append('date_from', filters.date_from);
    if (filters.date_to) params.append('date_to', filters.date_to);
    if (filters.party_id) params.append('party_id', filters.party_id);
    
    return this.request(`/party-commission-ledger/summary?${params}`);
  }

  async getPartyCommissionLedgerParties() {
    return this.request('/party-commission-ledger/parties');
  }


  async createPartyCommissionLedgerEntry(entry: any) {
    return this.request('/party-commission-ledger', {
      method: 'POST',
      body: JSON.stringify(entry)
    });
  }

  async deletePartyCommissionLedgerEntry(id: string) {
    return this.request(`/party-commission-ledger/${id}`, {
      method: 'DELETE'
    });
  }
}

// Create and export the API service instance
export const apiService = new ApiService();

// Export types for better TypeScript support
export type { ApiResponse };

// Utility function to handle API errors
export const handleApiError = (error: any) => {
  console.error('API Error:', error);
  
  if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
    // Token expired or invalid
    apiService.clearToken();
    window.location.href = '/login';
    return 'Session expired. Please login again.';
  }
  
  return error.message || 'An unexpected error occurred';
};
