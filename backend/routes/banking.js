import express from 'express';
import BankingEntry from '../models/BankingEntry.js';
import PartyCommissionLedger from '../models/PartyCommissionLedger.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Disable authentication for all routes temporarily for debugging
router.use((req, res, next) => {
  console.log(`Banking route: ${req.method} ${req.path}`);
  next(); // Skip authentication completely
});

// Get all banking entries
router.get('/', async (req, res) => {
  try {
    console.log('Banking GET request received');
    // Increase capacity 10x to handle larger data pulls
    const { type, category, vehicle_no, page = 1, limit = 1000000 } = req.query;

    const filter = {};
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (vehicle_no) filter.vehicle_no = new RegExp(vehicle_no, 'i');

    console.log('Banking filter:', filter);
    const bankingEntries = await BankingEntry.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await BankingEntry.countDocuments(filter);
    console.log('Banking entries found:', bankingEntries.length, 'total:', total);

    res.json({
      bankingEntries,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get banking entries error:', error);
    res.status(500).json({ message: 'Failed to fetch banking entries', error: error.message });
  }
});

// Get banking entry by ID
router.get('/:id', async (req, res) => {
  try {
    const bankingEntry = await BankingEntry.findById(req.params.id);

    if (!bankingEntry) {
      return res.status(404).json({ message: 'Banking entry not found' });
    }

    res.json(bankingEntry);
  } catch (error) {
    console.error('Get banking entry error:', error);
    res.status(500).json({ message: 'Failed to fetch banking entry', error: error.message });
  }
});

// Helper function to create party commission ledger entry for payments
const createPartyCommissionPaymentEntry = async (bankingEntry) => {
  if (bankingEntry.category === 'party_commission' && bankingEntry.type === 'debit' && bankingEntry.amount > 0) {
    // Extract party info from reference_name or narration
    let partyId = bankingEntry.party_id;
    let partyName = bankingEntry.reference_name || bankingEntry.party_name || bankingEntry.narration;

    // If party info not provided, try to extract from narration
    if (!partyId && partyName) {
      // Try to find party by name
      const Party = (await import('../models/Party.js')).default;
      const party = await Party.findOne({ name: partyName });
      if (party) {
        partyId = party._id;
        partyName = party.name;
      }
    }

    if (partyId && partyName) {
      const commissionEntry = new PartyCommissionLedger({
        party_id: partyId,
        party_name: partyName,
        date: bankingEntry.date,
        bill_number: '',
        reference_id: bankingEntry._id.toString(),
        entry_type: 'debit',
        amount: bankingEntry.amount,
        narration: `Commission Payment – Bank Ref #${bankingEntry._id.toString().slice(-6)}`,
        banking_entry_id: bankingEntry._id,
        reference_type: 'banking'
      });

      await commissionEntry.save();
      console.log('✅ Created party commission payment entry:', commissionEntry._id);
    }
  }
};

// Create new banking entry
router.post('/', async (req, res) => {
  try {
    const bankingEntry = new BankingEntry(req.body);
    await bankingEntry.save();

    // Party on account entries are now handled by the centralized ledger regeneration system
    // On account entries will be created during manual regeneration

    // Party commission entries are now handled by the centralized ledger regeneration system
    await createPartyCommissionPaymentEntry(bankingEntry);

    // Broadcast change moved to the end to ensure all side effects (ledger entries) are created first

    // Handle fuel wallet credits for banking transactions
    if (bankingEntry.category === 'fuel_wallet' && bankingEntry.reference_name && bankingEntry.type === 'debit') {
      const FuelWallet = (await import('../models/FuelWallet.js')).default;
      const FuelTransaction = (await import('../models/FuelTransaction.js')).default;

      // Find or create the fuel wallet
      let wallet = await FuelWallet.findOne({ name: bankingEntry.reference_name });
      if (!wallet) {
        wallet = new FuelWallet({
          name: bankingEntry.reference_name,
          balance: 0
        });
      }

      // Credit the wallet
      wallet.balance += bankingEntry.amount;
      await wallet.save();

      // Create fuel transaction record
      const fuelTransaction = new FuelTransaction({
        type: 'wallet_credit',
        wallet_name: bankingEntry.reference_name,
        amount: bankingEntry.amount,
        date: bankingEntry.date,
        narration: bankingEntry.narration || `Bank debit for fuel - ${bankingEntry.reference_name}`,
        fuel_type: 'Diesel'
      });

      await fuelTransaction.save();
      console.log('✅ Credited fuel wallet from banking:', bankingEntry.reference_name, 'Amount:', bankingEntry.amount);
    }

    // Handle supplier payments - create ledger entry
    if (bankingEntry.category === 'supplier_payment' && bankingEntry.reference_name) {
      const LedgerEntry = (await import('../models/LedgerEntry.js')).default;
      const Supplier = (await import('../models/Supplier.js')).default;

      // Find the supplier by name
      const supplier = await Supplier.findOne({ name: bankingEntry.reference_name });
      const supplierId = supplier ? supplier._id : bankingEntry.reference_name;

      const supplierLedgerEntry = new LedgerEntry({
        referenceId: supplierId,
        reference_id: bankingEntry._id.toString(),
        ledger_type: 'supplier',
        reference_name: bankingEntry.reference_name,
        source_type: 'banking',
        type: 'payment',
        date: bankingEntry.date,
        description: `Supplier Payment (Banking) – Bank Payment`,
        narration: bankingEntry.narration || `Supplier Payment (Banking) – Bank Payment`,
        debit: bankingEntry.amount,
        credit: 0,
        balance: 0,
        supplierId: supplierId,
        supplier_id: supplierId
      });

      await supplierLedgerEntry.save();
      console.log('✅ Created supplier ledger entry from banking:', supplierLedgerEntry._id);
    }

    // Handle memo and bill payments - add to advance_payments array
    if (bankingEntry.category === 'memo_advance' && bankingEntry.reference_id) {
      const Memo = (await import('../models/Memo.js')).default;
      const LedgerEntry = (await import('../models/LedgerEntry.js')).default;
      const Supplier = (await import('../models/Supplier.js')).default;

      const memo = await Memo.findOne({ memo_number: bankingEntry.reference_id });

      if (memo) {
        const advancePayment = {
          date: bankingEntry.date,
          amount: bankingEntry.amount,
          mode: 'bank',
          reference: `Banking Entry: ${bankingEntry._id}`,
          description: bankingEntry.narration || 'Bank advance payment'
        };

        memo.advance_payments.push(advancePayment);
        await memo.save();
        console.log('✅ Added bank advance payment to memo:', bankingEntry.reference_id);

        // Create supplier ledger entry for memo advance
        const supplier = await Supplier.findOne({ name: memo.supplier });

        if (supplier) {
          const supplierLedgerEntry = new LedgerEntry({
            referenceId: supplier._id,
            reference_id: bankingEntry._id.toString(),
            ledger_type: 'supplier',
            reference_name: memo.supplier,
            source_type: 'banking',
            type: 'payment',
            date: bankingEntry.date,
            description: `Memo Advance (Banking) – Memo No ${memo.memo_number}`,
            narration: bankingEntry.narration || `Memo Advance (Banking) – Memo No ${memo.memo_number}`,
            debit: bankingEntry.amount,
            credit: 0,
            balance: 0,
            memo_number: memo.memo_number,
            memo_id: memo._id,
            supplier_id: supplier._id
          });

          await supplierLedgerEntry.save();
          console.log('✅ Supplier ledger entry created for banking memo advance:', supplierLedgerEntry._id);
        } else {
          console.error(`❌ Could not find supplier named '${memo.supplier}' to create ledger entry for advance.`);
        }
      }
    }

    if (bankingEntry.category === 'memo_payment' && bankingEntry.reference_id) {
      const Memo = (await import('../models/Memo.js')).default;
      const LedgerEntry = (await import('../models/LedgerEntry.js')).default;
      const memo = await Memo.findOne({ memo_number: bankingEntry.reference_id });

      if (memo) {
        const advancePayment = {
          date: bankingEntry.date,
          amount: bankingEntry.amount,
          mode: 'bank',
          reference: `Banking Entry: ${bankingEntry._id}`,
          description: bankingEntry.narration || 'Bank payment'
        };

        memo.advance_payments.push(advancePayment);

        // Update paid amount - accumulate all advance payments
        memo.paid_amount = (memo.paid_amount || 0) + bankingEntry.amount;

        // Mark as paid if paid_amount >= net_amount
        if (memo.paid_amount >= memo.net_amount) {
          memo.status = 'paid';
          memo.paid_date = new Date();
        }

        await memo.save();
        console.log('✅ Added bank payment to memo:', bankingEntry.reference_id);

        // Create supplier ledger entry for memo payment
        const Supplier = (await import('../models/Supplier.js')).default;
        const supplier = await Supplier.findOne({ name: memo.supplier });

        if (supplier) {
          const supplierLedgerEntry = new LedgerEntry({
            referenceId: supplier._id,
            reference_id: bankingEntry._id.toString(),
            ledger_type: 'supplier',
            reference_name: memo.supplier,
            source_type: 'banking',
            type: 'payment',
            date: bankingEntry.date,
            description: `Memo Payment (Banking) – Memo No ${memo.memo_number}`,
            narration: bankingEntry.narration || `Memo Payment (Banking) – Memo No ${memo.memo_number}`,
            debit: bankingEntry.amount,
            credit: 0,
            balance: 0,
            memo_number: memo.memo_number,
            memo_id: memo._id,
            supplier_id: supplier._id
          });

          await supplierLedgerEntry.save();
          console.log('✅ Supplier ledger entry created for banking memo payment:', supplierLedgerEntry._id);
        } else {
          console.error(`❌ Could not find supplier named '${memo.supplier}' to create ledger entry.`);
        }
      }
    }

    if ((bankingEntry.category === 'bill_advance' || bankingEntry.category === 'bill_payment') && bankingEntry.reference_id) {
      const Bill = (await import('../models/Bill.js')).default;
      const LedgerEntry = (await import('../models/LedgerEntry.js')).default;
      const Party = (await import('../models/Party.js')).default;

      const bill = await Bill.findOne({ bill_number: bankingEntry.reference_id });

      if (bill) {
        const advancePayment = {
          date: bankingEntry.date,
          amount: bankingEntry.amount,
          mode: 'bank',
          reference: `Banking Entry: ${bankingEntry._id}`,
          description: bankingEntry.narration || (bankingEntry.category === 'bill_payment' ? 'Bank payment' : 'Bank advance payment')
        };

        if (!bill.advance_payments) bill.advance_payments = [];
        bill.advance_payments.push(advancePayment);
        bill.received_amount = (bill.received_amount || 0) + bankingEntry.amount;

        const totalBillVal = bill.net_amount || bill.bill_amount || 0;
        if (totalBillVal > 0 && bill.received_amount >= totalBillVal) {
          bill.status = 'received';
          bill.received_date = new Date(bankingEntry.date);
        }

        await bill.save();
        console.log('✅ Added bank payment/advance to bill:', bankingEntry.reference_id, 'Received Amount:', bill.received_amount, 'Status:', bill.status);

        // Create party ledger entry for bill payment/advance
        const party = await Party.findOne({ name: bill.party });

        if (party) {
          const partyLedgerEntry = new LedgerEntry({
            referenceId: party._id,
            reference_id: bankingEntry._id.toString(),
            ledger_type: 'party',
            reference_name: bill.party,
            source_type: 'banking',
            type: 'payment',
            date: bankingEntry.date,
            description: `${bankingEntry.category === 'bill_payment' ? 'Bill Payment' : 'Bill Advance'} (Banking) – Bill No ${bill.bill_number}`,
            narration: bankingEntry.narration || `${bankingEntry.category === 'bill_payment' ? 'Bill Payment' : 'Bill Advance'} (Banking) – Bill No ${bill.bill_number}`,
            debit: 0,
            credit: bankingEntry.amount,
            balance: 0,
            bill_number: bill.bill_number,
            bill_id: bill._id,
            party_id: party._id
          });

          await partyLedgerEntry.save();
          console.log('✅ Party ledger entry created for banking bill payment/advance:', partyLedgerEntry._id);
        } else {
          console.error(`❌ Could not find party named '${bill.party}' to create ledger entry.`);
        }
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

    if (!excludedCategories.includes(bankingEntry.category)) {
      let ledgerType = 'general';
      let referenceName = bankingEntry.reference_name || bankingEntry.category || 'Bank Transaction';
      let referenceId = bankingEntry._id;

      // Handle vehicle expenses specifically
      if (bankingEntry.category === 'vehicle_expense' && bankingEntry.vehicle_no) {
        ledgerType = 'vehicle_expense';
        referenceName = `Vehicle ${bankingEntry.vehicle_no} - Bank Expense`;
        referenceId = bankingEntry.vehicle_no;
      }

      const ledgerEntry = new LedgerEntry({
        referenceId: referenceId,
        reference_id: bankingEntry._id.toString(),
        ledger_type: ledgerType,
        reference_name: referenceName,
        source_type: 'banking',
        type: bankingEntry.type === 'debit' ? 'expense' : 'payment',
        date: bankingEntry.date,
        description: bankingEntry.narration || `Bank ${bankingEntry.type} - ${bankingEntry.category}`,
        debit: bankingEntry.type === 'debit' ? bankingEntry.amount : 0,
        credit: bankingEntry.type === 'credit' ? bankingEntry.amount : 0,
        balance: 0,
        vehicle_no: bankingEntry.vehicle_no || undefined,
      });

      // Check if ledger entry already exists to prevent duplicates
      const existingEntry = await LedgerEntry.findOne({
        reference_id: bankingEntry._id.toString(),
        source_type: 'banking',
        ledger_type: ledgerType
      });

      if (!existingEntry) {
        await ledgerEntry.save();
        console.log('✅ Created general ledger entry for banking transaction:', ledgerEntry._id, 'Type:', ledgerType);
      } else {
        console.log('⚠️ Ledger entry already exists for banking transaction, skipping duplicate');
      }
    }

    // Handle supplier on account transactions
    if (bankingEntry.category === 'supplier_on_account' && bankingEntry.reference_name) {
      try {
        const Supplier = (await import('../models/Supplier.js')).default;

        // Find supplier by name
        const supplier = await Supplier.findOne({ name: bankingEntry.reference_name });

        if (supplier) {
          // Create supplier ledger entry
          const supplierLedgerEntry = new LedgerEntry({
            referenceId: supplier._id,
            reference_id: bankingEntry._id.toString(),
            ledger_type: 'supplier',
            reference_name: supplier.name,
            source_type: 'banking',
            type: 'on_account',
            date: bankingEntry.date,
            description: `On Account Payment - Bank Ref #${bankingEntry._id.toString().slice(-6)}`,
            debit: bankingEntry.type === 'debit' ? bankingEntry.amount : 0,
            credit: bankingEntry.type === 'credit' ? bankingEntry.amount : 0,
            balance: 0,
            supplier_id: supplier._id,
            supplier_name: supplier.name
          });

          // Check if ledger entry already exists to prevent duplicates
          const existingSupplierEntry = await LedgerEntry.findOne({
            reference_id: bankingEntry._id.toString(),
            source_type: 'banking',
            ledger_type: 'supplier',
            supplier_id: supplier._id
          });

          if (!existingSupplierEntry) {
            await supplierLedgerEntry.save();
            console.log('✅ Created supplier ledger entry for on account payment:', supplierLedgerEntry._id, 'Supplier:', supplier.name);
          } else {
            console.log('⚠️ Supplier ledger entry already exists for banking transaction, skipping duplicate');
          }
        } else {
          console.warn('⚠️ Supplier not found for supplier_on_account transaction:', bankingEntry.reference_name);
        }
      } catch (error) {
        console.error('❌ Failed to create supplier ledger entry:', error);
      }
    }

    // Broadcast change to all connected clients for real-time sync - moved to end to ensure all side effects are complete
    if (global.broadcastChange) {
      global.broadcastChange('create', 'banking', bankingEntry);
    }

    res.status(201).json({
      message: 'Banking entry created successfully',
      bankingEntry
    });
  } catch (error) {
    console.error('Create banking entry error:', error);
    res.status(500).json({ message: 'Failed to create banking entry', error: error.message });
  }
});

// Update banking entry
router.put('/:id', async (req, res) => {
  try {
    const oldBankingEntry = await BankingEntry.findById(req.params.id);
    if (!oldBankingEntry) {
      return res.status(404).json({ message: 'Banking entry not found' });
    }

    const bankingEntry = await BankingEntry.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    // Update corresponding ledger entries
    const LedgerEntry = (await import('../models/LedgerEntry.js')).default;

    // Determine ledger type based on category
    let ledgerType = 'general';
    if (bankingEntry.category === 'party_commission') {
      ledgerType = 'commission';
    } else if (bankingEntry.category === 'vehicle_expense') {
      ledgerType = 'vehicle_expense';
    }

    // Update all ledger entries with this banking entry reference_id
    const updateResult = await LedgerEntry.updateMany(
      {
        reference_id: bankingEntry._id.toString(),
        source_type: 'banking'
      },
      {
        ledger_type: ledgerType,
        reference_name: bankingEntry.reference_name || bankingEntry.category || 'Bank Transaction',
        type: bankingEntry.type === 'debit' ? 'expense' : 'payment',
        date: bankingEntry.date,
        description: bankingEntry.narration || `Bank ${bankingEntry.type} - ${bankingEntry.category}`,
        debit: bankingEntry.type === 'debit' ? bankingEntry.amount : 0,
        credit: bankingEntry.type === 'credit' ? bankingEntry.amount : 0,
        vehicle_no: bankingEntry.vehicle_no || undefined,
      }
    );

    console.log('✅ Updated', updateResult.modifiedCount, 'ledger entries for banking entry:', req.params.id);

    // Broadcast change to all connected clients for real-time sync
    if (global.broadcastChange) {
      global.broadcastChange('update', 'banking', bankingEntry);
    }

    res.json({
      message: 'Banking entry updated successfully',
      bankingEntry
    });
  } catch (error) {
    console.error('Update banking entry error:', error);
    res.status(500).json({ message: 'Failed to update banking entry', error: error.message });
  }
});

// Delete banking entry
router.delete('/:id', async (req, res) => {
  try {
    console.log('DELETE request for banking entry:', req.params.id);

    const bankingEntry = await BankingEntry.findById(req.params.id);
    if (!bankingEntry) {
      return res.status(404).json({ message: 'Banking entry not found' });
    }

    // Delete associated party commission ledger entries
    const PartyCommissionLedger = (await import('../models/PartyCommissionLedger.js')).default;
    await PartyCommissionLedger.deleteMany({
      banking_entry_id: bankingEntry._id,
      reference_type: 'banking'
    });

    // Delete associated ledger entries
    const LedgerEntry = (await import('../models/LedgerEntry.js')).default;

    // Delete by reference_id (banking entry ID) to catch all related entries
    const deleteResult = await LedgerEntry.deleteMany({
      reference_id: bankingEntry._id.toString(),
      source_type: 'banking'
    });

    console.log('✅ Deleted', deleteResult.deletedCount, 'associated ledger entries for banking entry:', req.params.id);

    // Delete the banking entry
    await BankingEntry.findByIdAndDelete(req.params.id);

    // Broadcast change to all connected clients for real-time sync
    if (global.broadcastChange) {
      global.broadcastChange('delete', 'banking', { _id: req.params.id });
    }

    res.json({ message: 'Banking entry deleted successfully' });
  } catch (error) {
    console.error('Delete banking entry error:', error);
    res.status(500).json({ message: 'Failed to delete banking entry', error: error.message });
  }
});

export default router;
