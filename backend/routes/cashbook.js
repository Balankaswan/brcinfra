import express from 'express';
import CashbookEntry from '../models/CashbookEntry.js';
import { authenticateToken } from '../middleware/auth.js';
import { generateCashbookTransactionId } from '../utils/transactionId.js';

const router = express.Router();

// Get all cashbook entries with balance summary
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Increase capacity 10x to handle larger data pulls
    const { page = 1, limit = 1000000 } = req.query;
    const skip = (page - 1) * limit;

    const cashbookEntries = await CashbookEntry.find({})
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await CashbookEntry.countDocuments();
    const totalPages = Math.ceil(total / limit);

    // Get current cash balance (latest running balance)
    const latestEntry = await CashbookEntry.findOne({}, {}, { sort: { date: -1, createdAt: -1 } });
    const currentBalance = latestEntry ? latestEntry.running_balance : 0;

    res.json({
      cashbookEntries,
      total,
      totalPages,
      currentPage: parseInt(page),
      currentBalance
    });
  } catch (error) {
    console.error('Error fetching cashbook entries:', error);
    res.status(500).json({ error: 'Failed to fetch cashbook entries' });
  }
});

// Create new cashbook entry
router.post('/', async (req, res) => {
  try {
    // Generate unique transaction ID
    const transaction_id = generateCashbookTransactionId();

    const cashbookEntry = new CashbookEntry({
      ...req.body,
      transaction_id
    });
    await cashbookEntry.save();

    // DEBUG: Log the incoming cashbook entry
    console.log('='.repeat(60));
    console.log('📥 CASHBOOK ENTRY CREATED:');
    console.log('   ID:', cashbookEntry._id);
    console.log('   Category:', cashbookEntry.category);
    console.log('   Reference ID:', cashbookEntry.reference_id);
    console.log('   Reference Name:', cashbookEntry.reference_name);
    console.log('   Type:', cashbookEntry.type);
    console.log('   Amount:', cashbookEntry.amount);
    console.log('='.repeat(60));

    // Create party on account ledger entry for on account payments
    if (cashbookEntry.category === 'party_on_account' && cashbookEntry.reference_name) {
      const LedgerEntry = (await import('../models/LedgerEntry.js')).default;
      const Party = (await import('../models/Party.js')).default;

      // Find the party by name
      const party = await Party.findOne({ name: cashbookEntry.reference_name });
      const partyId = party ? party._id : cashbookEntry.reference_name;

      const onAccountLedgerEntry = new LedgerEntry({
        referenceId: partyId,
        reference_id: cashbookEntry._id.toString(),
        ledger_type: 'party',
        reference_name: cashbookEntry.reference_name,
        source_type: 'cashbook',
        type: 'party',
        date: cashbookEntry.date,
        description: `On Account Payment – Cash Payment`,
        narration: `On Account Payment – Cash Payment`,
        debit: 0,
        credit: cashbookEntry.amount,
        balance: 0,
        partyId: partyId
      });

      await onAccountLedgerEntry.save();
      console.log('✅ Created party on account ledger entry from cashbook:', onAccountLedgerEntry._id);
    }

    // Create supplier ledger entry for supplier payments
    if (cashbookEntry.category === 'supplier_payment' && cashbookEntry.reference_name) {
      const LedgerEntry = (await import('../models/LedgerEntry.js')).default;
      const Supplier = (await import('../models/Supplier.js')).default;

      // Find the supplier by name
      const supplier = await Supplier.findOne({ name: cashbookEntry.reference_name });
      const supplierId = supplier ? supplier._id : cashbookEntry.reference_name;

      const supplierLedgerEntry = new LedgerEntry({
        referenceId: supplierId,
        reference_id: cashbookEntry._id.toString(),
        ledger_type: 'supplier',
        reference_name: cashbookEntry.reference_name,
        source_type: 'cashbook',
        type: 'payment',
        date: cashbookEntry.date,
        description: `Supplier Payment (Cash) – Cash Payment`,
        narration: `Supplier Payment (Cash) – Cash Payment`,
        debit: cashbookEntry.amount,
        credit: 0,
        balance: 0,
        supplierId: supplierId
      });

      await supplierLedgerEntry.save();
      console.log('✅ Created supplier ledger entry from cashbook:', supplierLedgerEntry._id);
    }

    // Create supplier on account ledger entry for supplier on account payments
    if (cashbookEntry.category === 'supplier_on_account' && cashbookEntry.reference_name) {
      const LedgerEntry = (await import('../models/LedgerEntry.js')).default;
      const Supplier = (await import('../models/Supplier.js')).default;

      // Find the supplier by name
      const supplier = await Supplier.findOne({ name: cashbookEntry.reference_name });
      const supplierId = supplier ? supplier._id : cashbookEntry.reference_name;

      const supplierOnAccountLedgerEntry = new LedgerEntry({
        referenceId: supplierId,
        reference_id: cashbookEntry._id.toString(),
        ledger_type: 'supplier',
        reference_name: cashbookEntry.reference_name,
        source_type: 'cashbook',
        type: 'on_account',
        date: cashbookEntry.date,
        description: `On Account Payment – Cash Payment`,
        narration: cashbookEntry.narration || `On Account Payment – Cash Payment`,
        debit: cashbookEntry.amount,
        credit: 0,
        balance: 0,
        supplier_id: supplierId,
        supplier_name: cashbookEntry.reference_name
      });

      await supplierOnAccountLedgerEntry.save();
      console.log('✅ Created supplier on account ledger entry from cashbook:', supplierOnAccountLedgerEntry._id);
    }

    // Party commission entries are now handled by the centralized ledger regeneration system
    // Commission payments will be processed during ledger regeneration

    // Handle bill and memo advance payments
    if (cashbookEntry.category === 'bill_advance' && cashbookEntry.reference_id) {
      const Bill = (await import('../models/Bill.js')).default;
      const bill = await Bill.findOne({ bill_number: cashbookEntry.reference_id });

      if (bill) {
        const advancePayment = {
          date: cashbookEntry.date,
          amount: cashbookEntry.amount,
          mode: 'cash',
          reference: `Cashbook Entry: ${cashbookEntry._id}`,
          description: cashbookEntry.narration || 'Cash advance payment'
        };

        bill.advance_payments.push(advancePayment);
        await bill.save();
        console.log('✅ Added cash advance payment to bill:', cashbookEntry.reference_id);
      }
    }

    if (cashbookEntry.category === 'memo_advance' && cashbookEntry.reference_id) {
      const Memo = (await import('../models/Memo.js')).default;
      const memo = await Memo.findOne({ memo_number: cashbookEntry.reference_id });

      if (memo) {
        const advancePayment = {
          date: cashbookEntry.date,
          amount: cashbookEntry.amount,
          mode: 'cash',
          reference: `Cashbook Entry: ${cashbookEntry._id}`,
          description: cashbookEntry.narration || 'Cash advance payment'
        };

        memo.advance_payments.push(advancePayment);
        await memo.save();
        console.log('✅ Added cash advance payment to memo:', cashbookEntry.reference_id);
      }
    }

    if (cashbookEntry.category === 'memo_payment' && cashbookEntry.reference_id) {
      try {
        console.log('🔍 DEBUG memo_payment: category=', cashbookEntry.category, 'reference_id=', cashbookEntry.reference_id);

        const Memo = (await import('../models/Memo.js')).default;
        const LedgerEntry = (await import('../models/LedgerEntry.js')).default;

        // First, try to find ALL memos to debug
        const allMemos = await Memo.find({});
        console.log('🔍 DEBUG: Total memos in DB:', allMemos.length);
        console.log('🔍 DEBUG: Looking for memo_number:', cashbookEntry.reference_id);
        console.log('🔍 DEBUG: Sample memo numbers:', allMemos.slice(0, 3).map(m => m.memo_number));

        const memo = await Memo.findOne({ memo_number: cashbookEntry.reference_id });
        console.log('🔍 DEBUG: Memo found?', !!memo);

        if (memo) {
          console.log('✅ Found memo:', memo.memo_number, 'Supplier:', memo.supplier);
          const advancePayment = {
            date: cashbookEntry.date,
            amount: cashbookEntry.amount,
            mode: 'cash',
            reference: `Cashbook Entry: ${cashbookEntry._id}`,
            description: cashbookEntry.narration || 'Cash payment'
          };

          memo.advance_payments.push(advancePayment);

          // Update paid amount - accumulate all advance payments
          memo.paid_amount = (memo.paid_amount || 0) + cashbookEntry.amount;

          // Mark as paid if paid_amount >= net_amount
          if (memo.paid_amount >= memo.net_amount) {
            memo.status = 'paid';
            memo.paid_date = new Date();
          }

          const savedMemo = await memo.save();
          console.log('✅ Memo saved. advance_payments count:', savedMemo.advance_payments.length, 'paid_amount:', savedMemo.paid_amount);

          // Create supplier ledger entry for memo payment
          const supplierLedgerEntry = new LedgerEntry({
            referenceId: memo.supplier,
            reference_id: cashbookEntry._id.toString(),
            ledger_type: 'supplier',
            reference_name: memo.supplier,
            source_type: 'cashbook',
            type: 'payment',
            date: cashbookEntry.date,
            description: `Memo Payment – Memo No ${memo.memo_number}`,
            narration: cashbookEntry.narration || `Memo Payment – Memo No ${memo.memo_number}`,
            debit: cashbookEntry.amount,
            credit: 0,
            balance: 0,
            memo_number: memo.memo_number,
            memo_id: memo._id
          });

          // Find supplier to get their ID for correct ledger mapping
          const Supplier = (await import('../models/Supplier.js')).default;
          const supplier = await Supplier.findOne({ name: memo.supplier });

          if (supplier) {
            // Create supplier ledger entry for memo payment
            const supplierLedgerEntry = new LedgerEntry({
              referenceId: supplier._id, // Use supplier's actual ID
              reference_id: cashbookEntry._id.toString(),
              ledger_type: 'supplier',
              reference_name: memo.supplier,
              source_type: 'cashbook',
              type: 'payment',
              date: cashbookEntry.date,
              description: `Memo Payment (Cash) – Memo No ${memo.memo_number}`,
              narration: cashbookEntry.narration || `Memo Payment (Cash) – Memo No ${memo.memo_number}`,
              debit: cashbookEntry.amount,
              credit: 0,
              balance: 0,
              memo_number: memo.memo_number,
              memo_id: memo._id,
              supplier_id: supplier._id // Ensure supplier_id is also set
            });

            const savedLedger = await supplierLedgerEntry.save();
            console.log('✅ Supplier ledger entry created:', savedLedger._id);
          } else {
            console.error(`❌ Could not find supplier named '${memo.supplier}' to create ledger entry.`);
          }
        } else {
          console.error('❌ MEMO NOT FOUND! reference_id:', cashbookEntry.reference_id);
        }
      } catch (memoError) {
        console.error('❌ Error processing memo_payment:', memoError.message);
      }
    }

    if (cashbookEntry.category === 'bill_payment' && cashbookEntry.reference_id) {
      const Bill = (await import('../models/Bill.js')).default;
      const bill = await Bill.findOne({ bill_number: cashbookEntry.reference_id });

      if (bill) {
        const advancePayment = {
          date: cashbookEntry.date,
          amount: cashbookEntry.amount,
          mode: 'cash',
          reference: `Cashbook Entry: ${cashbookEntry._id}`,
          description: cashbookEntry.narration || 'Cash payment'
        };

        bill.advance_payments.push(advancePayment);
        await bill.save();
        console.log('✅ Added cash payment to bill:', cashbookEntry.reference_id);
      }
    }

    // Create ledger entries automatically with duplicate prevention
    // Create appropriate ledger entries based on category
    const LedgerEntry = (await import('../models/LedgerEntry.js')).default;

    // Exclude specific categories from general ledger (these already create specific ledger entries above)
    const excludedCategories = [
      'party_commission',
      'party_on_account',
      'supplier_payment',
      'supplier_on_account',
      'memo_advance',
      'bill_advance',
      'memo_payment',
      'bill_payment',
      'on_account_advance',
      'fuel_wallet'
    ];

    if (!excludedCategories.includes(cashbookEntry.category)) {
      let ledgerType = 'general';
      let referenceName = cashbookEntry.reference_name || cashbookEntry.category || 'Cash Transaction';
      let referenceId = cashbookEntry._id;

      // Handle vehicle expenses specifically
      if (cashbookEntry.category === 'vehicle_expense' && cashbookEntry.vehicle_no) {
        ledgerType = 'vehicle_expense';
        referenceName = `Vehicle ${cashbookEntry.vehicle_no} - Cash Expense`;
        referenceId = cashbookEntry.vehicle_no;
      }

      const ledgerEntry = new LedgerEntry({
        referenceId: referenceId,
        reference_id: cashbookEntry._id.toString(),
        ledger_type: ledgerType,
        reference_name: referenceName,
        source_type: 'cashbook',
        type: cashbookEntry.type === 'debit' ? 'expense' : 'payment',
        date: cashbookEntry.date,
        description: cashbookEntry.narration || `Cash ${cashbookEntry.type} - ${cashbookEntry.category}`,
        debit: cashbookEntry.type === 'debit' ? cashbookEntry.amount : 0,
        credit: cashbookEntry.type === 'credit' ? cashbookEntry.amount : 0,
        balance: 0,
        vehicle_no: cashbookEntry.vehicle_no || undefined,
      });

      // Check if ledger entry already exists to prevent duplicates
      const existingEntry = await LedgerEntry.findOne({
        reference_id: cashbookEntry._id.toString(),
        source_type: 'cashbook',
        ledger_type: ledgerType
      });

      if (!existingEntry) {
        await ledgerEntry.save();
        console.log('✅ Created general ledger entry for cashbook transaction:', ledgerEntry._id, 'Type:', ledgerType);
      } else {
        console.log('⚠️ Ledger entry already exists for cashbook transaction, skipping duplicate');
      }
    }

    // Broadcast change to all connected clients for real-time sync
    if (global.broadcastChange) {
      global.broadcastChange('create', 'cashbook', cashbookEntry);
    }

    res.status(201).json({
      message: 'Cashbook entry created successfully',
      cashbookEntry
    });
  } catch (error) {
    console.error('Create cashbook entry error:', error);
    res.status(500).json({ message: 'Failed to create cashbook entry', error: error.message });
  }
});

// Update cashbook entry
router.put('/:id', async (req, res) => {
  try {
    const oldCashbookEntry = await CashbookEntry.findById(req.params.id);
    if (!oldCashbookEntry) {
      return res.status(404).json({ error: 'Cashbook entry not found' });
    }

    const updateData = {
      ...req.body,
      payment_mode: 'cash' // Ensure it remains a cash transaction
    };

    const cashbookEntry = await CashbookEntry.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    // Update corresponding ledger entries
    const LedgerEntry = (await import('../models/LedgerEntry.js')).default;

    // Determine ledger type based on category
    let ledgerType = 'general';
    if (cashbookEntry.category === 'party_commission') {
      ledgerType = 'commission';
    } else if (cashbookEntry.category === 'vehicle_expense') {
      ledgerType = 'vehicle_expense';
    }

    // Update all ledger entries with this cashbook entry reference_id
    const updateResult = await LedgerEntry.updateMany(
      {
        reference_id: cashbookEntry._id.toString(),
        source_type: 'cashbook'
      },
      {
        ledger_type: ledgerType,
        reference_name: cashbookEntry.reference_name || cashbookEntry.category || 'Cash Transaction',
        type: cashbookEntry.type === 'debit' ? 'expense' : 'payment',
        date: cashbookEntry.date,
        description: cashbookEntry.narration || `Cash ${cashbookEntry.type} - ${cashbookEntry.category}`,
        debit: cashbookEntry.type === 'debit' ? cashbookEntry.amount : 0,
        credit: cashbookEntry.type === 'credit' ? cashbookEntry.amount : 0,
        vehicle_no: cashbookEntry.vehicle_no || undefined,
      }
    );

    console.log('✅ Updated', updateResult.modifiedCount, 'ledger entries for cashbook entry:', req.params.id);

    // Broadcast change to all connected clients for real-time sync
    if (global.broadcastChange) {
      global.broadcastChange('update', 'cashbook', cashbookEntry);
    }

    res.json({
      message: 'Cashbook entry updated successfully',
      cashbookEntry
    });
  } catch (error) {
    console.error('Error updating cashbook entry:', error);
    res.status(500).json({ error: 'Failed to update cashbook entry' });
  }
});

// Delete cashbook entry
router.delete('/:id', async (req, res) => {
  try {
    const cashbookEntry = await CashbookEntry.findById(req.params.id);

    if (!cashbookEntry) {
      return res.status(404).json({ error: 'Cashbook entry not found' });
    }

    // Remove advance payments from bills and memos
    if (cashbookEntry.category === 'bill_advance' && cashbookEntry.reference_id) {
      const Bill = (await import('../models/Bill.js')).default;
      const bill = await Bill.findOne({ bill_number: cashbookEntry.reference_id });

      if (bill) {
        bill.advance_payments = bill.advance_payments.filter(
          payment => payment.reference !== `Cashbook Entry: ${cashbookEntry._id}`
        );
        await bill.save();
        console.log('✅ Removed cash advance payment from bill:', cashbookEntry.reference_id);
      }
    }

    if (cashbookEntry.category === 'memo_advance' && cashbookEntry.reference_id) {
      const Memo = (await import('../models/Memo.js')).default;
      const memo = await Memo.findOne({ memo_number: cashbookEntry.reference_id });

      if (memo) {
        memo.advance_payments = memo.advance_payments.filter(
          payment => payment.reference !== `Cashbook Entry: ${cashbookEntry._id}`
        );
        await memo.save();
        console.log('✅ Removed cash advance payment from memo:', cashbookEntry.reference_id);
      }
    }

    if (cashbookEntry.category === 'memo_payment' && cashbookEntry.reference_id) {
      const Memo = (await import('../models/Memo.js')).default;
      const memo = await Memo.findOne({ memo_number: cashbookEntry.reference_id });

      if (memo) {
        memo.advance_payments = memo.advance_payments.filter(
          payment => payment.reference !== `Cashbook Entry: ${cashbookEntry._id}`
        );
        await memo.save();
        console.log('✅ Removed cash payment from memo:', cashbookEntry.reference_id);
      }
    }

    if (cashbookEntry.category === 'bill_payment' && cashbookEntry.reference_id) {
      const Bill = (await import('../models/Bill.js')).default;
      const bill = await Bill.findOne({ bill_number: cashbookEntry.reference_id });

      if (bill) {
        bill.advance_payments = bill.advance_payments.filter(
          payment => payment.reference !== `Cashbook Entry: ${cashbookEntry._id}`
        );
        await bill.save();
        console.log('✅ Removed cash payment from bill:', cashbookEntry.reference_id);
      }
    }

    // Delete associated party commission ledger entries
    const PartyCommissionLedger = (await import('../models/PartyCommissionLedger.js')).default;
    await PartyCommissionLedger.deleteMany({
      cashbook_entry_id: cashbookEntry._id,
      reference_type: 'cashbook'
    });

    // Delete associated ledger entries
    const LedgerEntry = (await import('../models/LedgerEntry.js')).default;

    // Delete by reference_id (cashbook entry ID) to catch all related entries
    const deleteResult = await LedgerEntry.deleteMany({
      reference_id: cashbookEntry._id.toString(),
      source_type: 'cashbook'
    });

    console.log('✅ Deleted', deleteResult.deletedCount, 'associated ledger entries for cashbook entry:', req.params.id);

    // Delete the cashbook entry
    await CashbookEntry.findByIdAndDelete(req.params.id);

    // Broadcast change to all connected clients for real-time sync
    if (global.broadcastChange) {
      global.broadcastChange('delete', 'cashbook', { _id: req.params.id });
    }

    res.json({
      message: 'Cashbook entry deleted successfully',
      cashbookEntry
    });
  } catch (error) {
    console.error('Error deleting cashbook entry:', error);
    res.status(500).json({ error: 'Failed to delete cashbook entry' });
  }
});

// Get cashbook balance summary
router.get('/balance', async (req, res) => {
  try {
    // Get current balance
    const latestEntry = await CashbookEntry.findOne({}, {}, { sort: { date: -1, createdAt: -1 } });
    const currentBalance = latestEntry ? latestEntry.running_balance : 0;

    // Get today's transactions
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayTransactions = await CashbookEntry.find({
      date: { $gte: today, $lt: tomorrow }
    });

    const todayCredits = todayTransactions
      .filter(t => t.type === 'credit')
      .reduce((sum, t) => sum + t.amount, 0);

    const todayDebits = todayTransactions
      .filter(t => t.type === 'debit')
      .reduce((sum, t) => sum + t.amount, 0);

    // Get monthly summary
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthlyTransactions = await CashbookEntry.find({
      date: { $gte: startOfMonth }
    });

    const monthlyCredits = monthlyTransactions
      .filter(t => t.type === 'credit')
      .reduce((sum, t) => sum + t.amount, 0);

    const monthlyDebits = monthlyTransactions
      .filter(t => t.type === 'debit')
      .reduce((sum, t) => sum + t.amount, 0);

    res.json({
      currentBalance,
      today: {
        credits: todayCredits,
        debits: todayDebits,
        net: todayCredits - todayDebits,
        transactions: todayTransactions.length
      },
      thisMonth: {
        credits: monthlyCredits,
        debits: monthlyDebits,
        net: monthlyCredits - monthlyDebits,
        transactions: monthlyTransactions.length
      }
    });
  } catch (error) {
    console.error('Error fetching cashbook balance:', error);
    res.status(500).json({ error: 'Failed to fetch cashbook balance' });
  }
});

export default router;
