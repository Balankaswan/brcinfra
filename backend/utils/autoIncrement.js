import LoadingSlip from '../models/LoadingSlip.js';
import Memo from '../models/Memo.js';
import Bill from '../models/Bill.js';

// ─── Helper: get current financial year string e.g. "26-27" ───
const getCurrentFinancialYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-indexed
  // FY starts April 1
  const fyStart = month >= 4 ? year : year - 1;
  const fyEnd = fyStart + 1;
  return `${String(fyStart).slice(-2)}-${String(fyEnd).slice(-2)}`;
};

/**
 * Generate next LR number
 * Format: AHD/26-27/XXXX  (branch / financial-year / 4-digit sequence)
 */
export const generateLRNumber = async (branchCode = 'AHD') => {
  try {
    const fy = getCurrentFinancialYear();
    const prefix = `${branchCode}/${fy}/`;

    // Find all slips whose slip_number starts with the current FY prefix
    const allSlips = await LoadingSlip.find(
      { slip_number: { $regex: `^${prefix}`, $options: 'i' } },
      { slip_number: 1 }
    );

    let maxNumber = 0;

    allSlips.forEach(slip => {
      const match = slip.slip_number.match(/\/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) maxNumber = num;
      }
    });

    const nextNumber = maxNumber + 1;
    // Zero-pad to 4 digits minimum
    const padded = String(nextNumber).padStart(4, '0');
    return `${prefix}${padded}`;
  } catch (error) {
    console.error('Error generating LR number:', error);
    return `AHD/${getCurrentFinancialYear()}/0001`;
  }
};

/**
 * Generate next loading slip number (kept for legacy compatibility)
 * Format: LS-1, LS-2, LS-3, etc.
 */
export const generateLoadingSlipNumber = async () => {
  try {
    const allSlips = await LoadingSlip.find({}, { slip_number: 1 })
      .sort({ createdAt: -1 });

    if (!allSlips || allSlips.length === 0) {
      return 'LS-1';
    }

    let maxNumber = 0;

    allSlips.forEach(slip => {
      const slipNumber = slip.slip_number;

      const newFormatMatch = slipNumber.match(/^LS-(\d+)$/);
      if (newFormatMatch) {
        const num = parseInt(newFormatMatch[1]);
        if (num > maxNumber) maxNumber = num;
        return;
      }

      const oldFormatMatch = slipNumber.match(/^(\d+)$/);
      if (oldFormatMatch) {
        const num = parseInt(oldFormatMatch[1]);
        if (num > maxNumber) maxNumber = num;
        return;
      }
    });

    const nextNumber = maxNumber + 1;
    return `LS-${nextNumber}`;
  } catch (error) {
    console.error('Error generating loading slip number:', error);
    return 'LS-1';
  }
};

/**
 * Generate next memo number
 * Format: MM-1, MM-2, MM-3, etc.
 */
export const generateMemoNumber = async () => {
  try {
    const latestMemo = await Memo.findOne()
      .sort({ memo_number: -1 })
      .select('memo_number');

    if (!latestMemo) {
      return 'MM-1';
    }

    const match = latestMemo.memo_number.match(/MM-(\d+)/);
    if (!match) {
      return 'MM-1';
    }

    const lastNumber = parseInt(match[1]);
    const nextNumber = lastNumber + 1;

    return `MM-${nextNumber}`;
  } catch (error) {
    console.error('Error generating memo number:', error);
    return 'MM-1';
  }
};

/**
 * Generate next bill number
 * Format: BL-1, BL-2, BL-3, etc.
 */
export const generateBillNumber = async () => {
  try {
    const latestBill = await Bill.findOne()
      .sort({ bill_number: -1 })
      .select('bill_number');

    if (!latestBill) {
      return 'BL-1';
    }

    const match = latestBill.bill_number.match(/BL-(\d+)/);
    if (!match) {
      return 'BL-1';
    }

    const lastNumber = parseInt(match[1]);
    const nextNumber = lastNumber + 1;

    return `BL-${nextNumber}`;
  } catch (error) {
    console.error('Error generating bill number:', error);
    return 'BL-1';
  }
};

/**
 * Get next available numbers for all document types
 */
export const getNextNumbers = async () => {
  try {
    const [nextLRNumber, nextSlipNumber, nextMemoNumber, nextBillNumber] = await Promise.all([
      generateLRNumber(),
      generateLoadingSlipNumber(),
      generateMemoNumber(),
      generateBillNumber()
    ]);

    return {
      nextLRNumber,
      nextSlipNumber,
      nextMemoNumber,
      nextBillNumber
    };
  } catch (error) {
    console.error('Error getting next numbers:', error);
    return {
      nextLRNumber: `AHD/${getCurrentFinancialYear()}/0001`,
      nextSlipNumber: 'LS-1',
      nextMemoNumber: 'MM-1',
      nextBillNumber: 'BL-1'
    };
  }
};
