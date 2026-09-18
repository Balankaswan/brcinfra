import express from 'express';
import FuelWallet from '../models/FuelWallet.js';
import FuelTransaction from '../models/FuelTransaction.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Disable authentication for all routes temporarily for debugging
router.use((req, res, next) => {
  console.log(`Fuel route: ${req.method} ${req.path}`);
  next(); // Skip authentication completely
});

// Get all fuel wallets
router.get('/wallets', async (req, res) => {
  try {
    const wallets = await FuelWallet.find().sort({ name: 1 });
    res.json({ wallets });
  } catch (error) {
    console.error('Get fuel wallets error:', error);
    res.status(500).json({ message: 'Failed to fetch fuel wallets', error: error.message });
  }
});

// Create new fuel wallet
router.post('/wallets', async (req, res) => {
  try {
    const wallet = new FuelWallet(req.body);
    await wallet.save();

    res.status(201).json({
      message: 'Fuel wallet created successfully',
      wallet
    });
  } catch (error) {
    console.error('Create fuel wallet error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Fuel wallet with this name already exists' });
    }
    res.status(500).json({ message: 'Failed to create fuel wallet', error: error.message });
  }
});

// Update fuel wallet
router.put('/wallets/:id', async (req, res) => {
  try {
    const wallet = await FuelWallet.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!wallet) {
      return res.status(404).json({ message: 'Fuel wallet not found' });
    }

    res.json({
      message: 'Fuel wallet updated successfully',
      wallet
    });
  } catch (error) {
    console.error('Update fuel wallet error:', error);
    res.status(500).json({ message: 'Failed to update fuel wallet', error: error.message });
  }
});

// Get all fuel transactions
router.get('/transactions', async (req, res) => {
  try {
    const { wallet_name, vehicle_no, type, page = 1, limit = 50 } = req.query;
    
    const filter = {};
    if (wallet_name) filter.wallet_name = wallet_name;
    if (vehicle_no) filter.vehicle_no = new RegExp(vehicle_no, 'i');
    if (type) filter.type = type;

    const transactions = await FuelTransaction.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await FuelTransaction.countDocuments(filter);

    res.json({
      transactions,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get fuel transactions error:', error);
    res.status(500).json({ message: 'Failed to fetch fuel transactions', error: error.message });
  }
});

// Create fuel transaction (credit wallet or allocate fuel)
router.post('/transactions', async (req, res) => {
  try {
    const transaction = new FuelTransaction(req.body);
    await transaction.save();

    // Update or create wallet balance
    let wallet = await FuelWallet.findOne({ name: transaction.wallet_name });
    if (!wallet && transaction.type === 'wallet_credit') {
      // Create new wallet if it doesn't exist and this is a credit transaction
      wallet = new FuelWallet({
        name: transaction.wallet_name,
        balance: 0
      });
    }
    
    if (wallet) {
      if (transaction.type === 'wallet_credit') {
        wallet.balance += transaction.amount;
      } else if (transaction.type === 'fuel_allocation') {
        wallet.balance -= transaction.amount;
      }
      await wallet.save();
      console.log(`✅ Updated wallet ${wallet.name} balance: ${wallet.balance}`);
    }

    res.status(201).json({
      message: 'Fuel transaction created successfully',
      transaction
    });
  } catch (error) {
    console.error('Create fuel transaction error:', error);
    res.status(500).json({ message: 'Failed to create fuel transaction', error: error.message });
  }
});

// Allocate fuel to vehicle
router.post('/allocate', async (req, res) => {
  try {
    const { 
      vehicle_no, 
      wallet_name, 
      amount, 
      date, 
      narration, 
      fuel_quantity, 
      rate_per_liter, 
      odometer_reading,
      fuel_type,
      allocated_by,
      supplier_name
    } = req.body;

    // Check wallet balance
    const wallet = await FuelWallet.findOne({ name: wallet_name });
    if (!wallet) {
      return res.status(404).json({ message: 'Fuel wallet not found' });
    }

    if (wallet.balance < amount) {
      return res.status(400).json({ message: 'Insufficient wallet balance' });
    }

    // Create fuel transaction record
    const fuelTransaction = new FuelTransaction({
      type: 'fuel_allocation',
      wallet_name,
      amount,
      date: new Date(date),
      vehicle_no,
      narration,
      fuel_quantity,
      rate_per_liter,
      odometer_reading,
      fuel_type: fuel_type || 'Diesel',
      allocated_by: allocated_by || 'System',
      supplier_name: supplier_name || undefined
    });

    await fuelTransaction.save();

    // Update wallet balance
    wallet.balance -= amount;
    await wallet.save();

    const LedgerEntry = (await import('../models/LedgerEntry.js')).default;

    // Create corresponding ledger entry for vehicle fuel expense
    if (vehicle_no) {
      const vehicleFuelExpenseEntry = new LedgerEntry({
        referenceId: fuelTransaction._id,
        reference_id: fuelTransaction._id.toString(),
        ledger_type: 'vehicle_expense',
        reference_name: `Vehicle ${vehicle_no} - Fuel Expense`,
        source_type: 'fuel',
        type: 'expense',
        date: date,
        description: narration || `Fuel expense for vehicle ${vehicle_no} from ${wallet_name}`,
        debit: amount,
        credit: 0,
        balance: 0,
        vehicle_no: vehicle_no,
      });
      
      await vehicleFuelExpenseEntry.save();
      console.log('✅ Created vehicle ledger entry for fuel expense:', vehicleFuelExpenseEntry._id);
    }

    // Create supplier ledger entry if supplier is specified
    if (supplier_name) {
      const Supplier = (await import('../models/Supplier.js')).default;
      
      // Find supplier by name
      const supplier = await Supplier.findOne({ name: supplier_name });
      
      if (supplier) {
        // Create supplier ledger entry for fuel allocation
        const supplierFuelEntry = new LedgerEntry({
          referenceId: supplier._id,
          reference_id: fuelTransaction._id.toString(),
          ledger_type: 'supplier',
          reference_name: supplier_name,
          source_type: 'fuel',
          type: 'expense',
          date: date,
          description: `Fuel Being Allocated - Vehicle: ${vehicle_no}${narration ? ' - ' + narration : ''}`,
          debit: amount,
          credit: 0,
          balance: 0,
          supplierId: supplier._id,
          vehicle_no: vehicle_no
        });
        
        await supplierFuelEntry.save();
        console.log('✅ Created supplier ledger entry for fuel allocation:', supplierFuelEntry._id, 'Supplier:', supplier_name);
      } else {
        console.warn('⚠️ Supplier not found for fuel allocation:', supplier_name);
      }
    }

    res.status(201).json({
      message: 'Fuel allocated successfully',
      transaction: fuelTransaction,
      wallet
    });
  } catch (error) {
    console.error('Allocate fuel error:', error);
    res.status(500).json({ message: 'Failed to allocate fuel', error: error.message });
  }
});

// Clean up test fuel data
router.post('/cleanup-test-data', async (req, res) => {
  try {
    console.log('🧹 Starting fuel test data cleanup...');
    
    let deletedCount = 0;
    
    // 1. Remove test fuel transactions
    const testTransactions = await FuelTransaction.find({
      $or: [
        { narration: { $regex: /test/i } },
        { description: { $regex: /test/i } },
        { vehicle_no: { $regex: /test/i } },
        { narration: { $regex: /frontend.*test/i } }
      ]
    });
    
    for (const transaction of testTransactions) {
      await FuelTransaction.findByIdAndDelete(transaction._id);
      deletedCount++;
      console.log('🗑️ Deleted test fuel transaction:', transaction._id, transaction.narration);
    }
    
    // 2. Clean up any related ledger entries for deleted fuel transactions
    const LedgerEntry = (await import('../models/LedgerEntry.js')).default;
    const testLedgerEntries = await LedgerEntry.find({
      $and: [
        { ledger_type: 'vehicle_expense' },
        { source_type: 'fuel' },
        { narration: { $regex: /test/i } }
      ]
    });
    
    for (const ledgerEntry of testLedgerEntries) {
      await LedgerEntry.findByIdAndDelete(ledgerEntry._id);
      deletedCount++;
      console.log('🗑️ Deleted test fuel ledger entry:', ledgerEntry._id);
    }
    
    console.log('✅ Fuel test data cleanup completed');
    console.log('🗑️ Total deleted entries:', deletedCount);
    
    res.json({
      message: 'Fuel test data cleanup completed successfully',
      summary: {
        deletedEntries: deletedCount,
        testTransactions: testTransactions.length,
        testLedgerEntries: testLedgerEntries.length
      }
    });
    
  } catch (error) {
    console.error('Fuel cleanup error:', error);
    res.status(500).json({ 
      message: 'Failed to cleanup fuel test data', 
      error: error.message 
    });
  }
});

// Update fuel transaction
router.put('/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔄 Updating fuel transaction:', id);
    
    const oldTransaction = await FuelTransaction.findById(id);
    if (!oldTransaction) {
      return res.status(404).json({ message: 'Fuel transaction not found' });
    }
    
    const updatedTransaction = await FuelTransaction.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );
    
    // Update corresponding vehicle ledger entries
    const LedgerEntry = (await import('../models/LedgerEntry.js')).default;
    
    if (updatedTransaction.vehicle_no) {
      const updateResult = await LedgerEntry.updateMany(
        { 
          reference_id: id,
          source_type: 'fuel',
          ledger_type: 'vehicle_expense'
        },
        {
          reference_name: `Vehicle ${updatedTransaction.vehicle_no} - Fuel Expense`,
          date: updatedTransaction.date,
          description: updatedTransaction.narration || `Fuel expense for vehicle ${updatedTransaction.vehicle_no}`,
          debit: updatedTransaction.amount,
          credit: 0,
          vehicle_no: updatedTransaction.vehicle_no,
        }
      );
      
      console.log('✅ Updated', updateResult.modifiedCount, 'vehicle ledger entries for fuel transaction:', id);
    }
    
    res.json({
      message: 'Fuel transaction updated successfully',
      transaction: updatedTransaction
    });
  } catch (error) {
    console.error('Update fuel transaction error:', error);
    res.status(500).json({ message: 'Failed to update fuel transaction', error: error.message });
  }
});

// Delete individual fuel transaction
router.delete('/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ Deleting fuel transaction:', id);
    
    const deletedTransaction = await FuelTransaction.findByIdAndDelete(id);
    
    if (!deletedTransaction) {
      return res.status(404).json({ message: 'Fuel transaction not found' });
    }
    
    // Also delete any related ledger entries
    const LedgerEntry = (await import('../models/LedgerEntry.js')).default;
    await LedgerEntry.deleteMany({
      source_type: 'fuel',
      reference_id: id
    });
    
    console.log('✅ Fuel transaction deleted successfully:', id);
    res.json({
      message: 'Fuel transaction deleted successfully',
      transaction: deletedTransaction
    });
  } catch (error) {
    console.error('Delete fuel transaction error:', error);
    res.status(500).json({ message: 'Failed to delete fuel transaction', error: error.message });
  }
});

// Clear all fuel allocation data
router.delete('/clear-all-data', async (req, res) => {
  try {
    console.log('🧹 Starting complete fuel data cleanup...');
    
    let deletedCount = 0;
    
    // 1. Remove all fuel transactions
    const allTransactions = await FuelTransaction.find({});
    for (const transaction of allTransactions) {
      await FuelTransaction.findByIdAndDelete(transaction._id);
      deletedCount++;
      console.log('🗑️ Deleted fuel transaction:', transaction._id, transaction.narration);
    }
    
    // 2. Remove all vehicle fuel expenses
    const VehicleFuelExpense = (await import('../models/VehicleFuelExpense.js')).default;
    const allExpenses = await VehicleFuelExpense.find({});
    for (const expense of allExpenses) {
      await VehicleFuelExpense.findByIdAndDelete(expense._id);
      deletedCount++;
      console.log('🗑️ Deleted vehicle fuel expense:', expense._id);
    }
    
    // 3. Remove all fuel-related ledger entries
    const LedgerEntry = (await import('../models/LedgerEntry.js')).default;
    const fuelLedgerEntries = await LedgerEntry.find({
      source_type: 'fuel'
    });
    for (const entry of fuelLedgerEntries) {
      await LedgerEntry.findByIdAndDelete(entry._id);
      deletedCount++;
      console.log('🗑️ Deleted fuel ledger entry:', entry._id, entry.description);
    }
    
    // 4. Reset all fuel wallet balances to 0 (but keep the wallets)
    const resetWallets = await FuelWallet.updateMany({}, { balance: 0 });
    console.log('🔄 Reset fuel wallet balances:', resetWallets.modifiedCount);
    
    console.log('✅ Complete fuel data cleanup completed');
    console.log('🗑️ Total deleted entries:', deletedCount);
    
    res.json({
      message: 'All fuel data cleared successfully',
      summary: {
        deletedEntries: deletedCount,
        transactions: allTransactions.length,
        expenses: allExpenses.length,
        ledgerEntries: fuelLedgerEntries.length,
        walletsReset: resetWallets.modifiedCount
      }
    });
  } catch (error) {
    console.error('Fuel data cleanup error:', error);
    res.status(500).json({ 
      message: 'Failed to clear fuel data', 
      error: error.message 
    });
  }
});

export default router;
