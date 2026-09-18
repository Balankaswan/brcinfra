import crypto from 'crypto';

/**
 * Generate a unique transaction ID for banking entries
 * Format: BANK-YYYYMMDD-HHMMSS-RANDOM
 */
export function generateBankingTransactionId() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  
  return `BANK-${dateStr}-${timeStr}-${random}`;
}

/**
 * Generate a unique transaction ID for cashbook entries
 * Format: CASH-YYYYMMDD-HHMMSS-RANDOM
 */
export function generateCashbookTransactionId() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  
  return `CASH-${dateStr}-${timeStr}-${random}`;
}

/**
 * Validate transaction ID format
 */
export function isValidTransactionId(transactionId) {
  if (!transactionId || typeof transactionId !== 'string') {
    return false;
  }
  
  const bankingPattern = /^BANK-\d{8}-\d{6}-[A-F0-9]{8}$/;
  const cashbookPattern = /^CASH-\d{8}-\d{6}-[A-F0-9]{8}$/;
  
  return bankingPattern.test(transactionId) || cashbookPattern.test(transactionId);
}
