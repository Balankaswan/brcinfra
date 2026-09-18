import LedgerEntry from '../models/LedgerEntry.js';
import Vehicle from '../models/Vehicle.js';
import LoadingSlip from '../models/LoadingSlip.js';

/**
 * Create ledger entry with running balance calculation
 */
export const createLedgerEntry = async ({ referenceId, type, vehicleNo, partyId, supplierId, debit = 0, credit = 0, description, date, memoNumber }) => {
  try {
    // Get last entry for this vehicle to calculate running balance
    let previousBalance = 0;
    if (vehicleNo) {
      const lastEntry = await LedgerEntry.findOne({ vehicleNo }).sort({ date: -1, createdAt: -1 });
      previousBalance = lastEntry ? lastEntry.balance : 0;
    }

    // Calculate running balance: previousBalance + credit - debit
    const runningBalance = previousBalance + credit - debit;

    const entry = new LedgerEntry({
      referenceId,
      type,
      vehicleNo,
      partyId,
      supplierId,
      description,
      debit,
      credit,
      balance: runningBalance,
      date: date || new Date(),
      memoNumber
    });

    await entry.save();
    console.log(`✅ Created ${type} ledger entry:`, {
      vehicle: vehicleNo,
      credit,
      debit,
      previousBalance,
      newBalance: runningBalance
    });
    
    return entry;
  } catch (error) {
    console.error('Failed to create ledger entry:', error);
    throw error;
  }
};

/**
 * Handle Own Vehicle Memo - creates vehicle ledger entry only
 */
export const handleOwnVehicleMemo = async (memo) => {
  try {
    const loadingSlip = await LoadingSlip.findById(memo.loading_slip_id);
    if (!loadingSlip) {
      throw new Error('Loading slip not found');
    }

    // Create single consolidated entry for the memo (total amount)
  const totalAmount = memo.freight + (memo.detention || 0) + (memo.extra || 0) - (memo.commission || 0) - (memo.mamool || 0);
    
    if (totalAmount > 0) {
      // Check if ledger entry already exists for this memo to prevent duplicates
      const LedgerEntry = (await import('../models/LedgerEntry.js')).default;
      const existingEntry = await LedgerEntry.findOne({
        reference_id: memo._id.toString(),
        source_type: 'memo',
        ledger_type: 'vehicle_income'
      });
      
      if (!existingEntry) {
        await LedgerEntry.create({
          referenceId: loadingSlip.vehicle_no,
          reference_id: memo._id.toString(),
          ledger_type: 'vehicle_income',
          reference_name: `Vehicle ${loadingSlip.vehicle_no} - Memo Credit`,
          source_type: 'memo',
          type: 'payment',
          date: memo.date,
          description: `Memo ${memo.memo_number} - Total: ₹${totalAmount} (Freight: ₹${memo.freight}, Detention: ₹${memo.detention || 0}, Extra: ₹${memo.extra || 0}, Commission: -₹${memo.commission || 0}, Mamool: -₹${memo.mamool || 0})`,
          debit: 0,
          credit: totalAmount,
          vehicle_no: loadingSlip.vehicle_no,
          balance: 0,
          created_at: new Date()
        });
        console.log(`✅ Created vehicle ledger entry for memo ${memo.memo_number}: ₹${totalAmount}`);
      } else {
        console.log(`⚠️ Ledger entry already exists for memo ${memo.memo_number}, skipping duplicate`);
      }
    }

    console.log('✅ Own vehicle memo processed:', {
      memo: memo.memo_number,
      vehicle: loadingSlip.vehicle_no,
      totalAmount,
      detention: memo.detention || 0,
      extra: memo.extra || 0
    });

  } catch (error) {
    console.error('Failed to handle own vehicle memo:', error);
    throw error;
  }
};

/**
 * Handle Market Vehicle Memo - creates supplier ledger entry only
 */
export const handleMarketVehicleMemo = async (memo) => {
  try {
    const LedgerEntry = (await import('../models/LedgerEntry.js')).default;
    
    // Calculate net amount
    const netAmount = memo.freight - (memo.commission || 0) - (memo.mamool || 0) + (memo.detention || 0) + (memo.extra || 0);
    
    // Credit Supplier Ledger with net amount (after all deductions)
    try {
      const creditEntry = await LedgerEntry.create({
        referenceId: memo._id.toString(),
        reference_id: memo._id.toString(),
        ledger_type: 'supplier',
        reference_name: memo.supplier,
        source_type: 'memo',
        type: 'memo',
        description: `Memo ${memo.memo_number} - Net Amount Payable`,
        debit: 0,
        credit: netAmount,
        balance: 0, // Will be calculated by frontend
        date: memo.date,
        memo_number: memo.memo_number
      });
      console.log('✅ Created supplier credit entry:', creditEntry._id);
    } catch (error) {
      console.error('❌ Failed to create supplier credit entry:', error);
      throw error;
    }

    console.log('✅ Market vehicle memo processed:', {
      memo: memo.memo_number,
      supplier: memo.supplier,
      credit: netAmount
    });

  } catch (error) {
    console.error('Failed to handle market vehicle memo:', error);
    throw error;
  }
};

/**
 * Handle Bill Ledger Entries - creates party ledger entries
 */
export const createBillLedgerEntries = async (bill) => {
  try {
    const LedgerEntry = (await import('../models/LedgerEntry.js')).default;
    
    // Calculate total freight: freight - mamool - commission + detention + rto + extra - tds - penalties
    const totalFreight = bill.bill_amount - (bill.mamool || 0) - (bill.commission || 0) + (bill.detention || 0) + (bill.rto || 0) + (bill.extra || 0) - (bill.tds || 0) - (bill.penalties || 0);
    
    // Net amount for supplier payment (total freight minus party commission cut)
    const netAmount = totalFreight - (bill.party_commission_cut || 0);
    
    // Debit Party Ledger with total freight (amount receivable from party)
    await LedgerEntry.create({
      referenceId: bill._id.toString(),
      reference_id: bill._id.toString(),
      ledger_type: 'party',
      reference_name: bill.party,
      source_type: 'bill',
      type: 'bill',
      description: `Bill ${bill.bill_number} - Amount Receivable`,
      debit: totalFreight,
      credit: 0,
      balance: 0, // Will be calculated by frontend
      date: bill.date,
      memo_number: bill.bill_number
    });

    console.log('✅ Bill ledger entries processed:', {
      bill: bill.bill_number,
      party: bill.party,
      totalFreight: totalFreight,
      netAmount: netAmount,
      debit: totalFreight
    });

  } catch (error) {
    console.error('Failed to create bill ledger entries:', error);
    throw error;
  }
};

/**
 * Main memo ledger creation function
 */
export const createMemoLedgerEntries = async (memo) => {
  try {
    const loadingSlip = await LoadingSlip.findById(memo.loading_slip_id);
    if (!loadingSlip) {
      throw new Error('Loading slip not found');
    }

    // Check if vehicle is own or market
    const vehicle = await Vehicle.findOne({ vehicle_no: loadingSlip.vehicle_no });
    const isOwnVehicle = vehicle?.ownership_type === 'own';

    console.log('🚛 Processing memo ledger:', {
      memo: memo.memo_number,
      vehicle: loadingSlip.vehicle_no,
      ownership: vehicle?.ownership_type,
      isOwn: isOwnVehicle
    });

    if (isOwnVehicle) {
      await handleOwnVehicleMemo(memo);
    } else {
      await handleMarketVehicleMemo(memo);
    }

  } catch (error) {
    console.error('Failed to create memo ledger entries:', error);
    throw error;
  }
};
