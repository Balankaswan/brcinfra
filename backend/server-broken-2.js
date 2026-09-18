import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes
import authRoutes from './routes/auth.js';
import loadingSlipRoutes from './routes/loadingSlips.js';
import billRoutes from './routes/bills.js';
import memoRoutes from './routes/memos.js';
import partyRoutes from './routes/parties.js';
import supplierRoutes from './routes/suppliers.js';
import vehicleRoutes from './routes/vehicles.js';
import bankingRoutes from './routes/banking.js';
import cashbookRoutes from './routes/cashbook.js';
import ledgerRoutes from './routes/ledgers.js';
import fuelRoutes from './routes/fuel.js';
import podRoutes from './routes/pod.js';
import partyCommissionLedgerRoutes from './routes/partyCommissionLedger.js';


// ES module dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// Security middleware
app.use(helmet());

// Rate limiting - increased limits for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // limit each IP to 5000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => {
    // Skip rate limiting for local development
    const ip = req.ip || req.connection.remoteAddress;
    return ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.');
  }
});
app.use(limiter);

// CORS configuration - Allow all origins for development to prevent recurring issues
const corsOptions = {
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB connection with Atlas support
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/brc_transport';
    
    // MongoDB connection options optimized for Atlas
    const options = {
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      maxPoolSize: 10, // Maintain up to 10 socket connections
      bufferCommands: false // Disable mongoose buffering
    };

    await mongoose.connect(mongoURI, options);
    
    // Connection event handlers
    mongoose.connection.on('connected', () => {
      console.log('✅ MongoDB connected successfully');
      console.log(`📍 Database: ${mongoose.connection.name}`);
      console.log(`🌐 Host: ${mongoose.connection.host}:${mongoose.connection.port}`);
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
    });

    // Handle connection errors after initial connection
    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    
    // More detailed error logging for Atlas connections
    if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      console.error('💡 Connection tips:');
      console.error('   - Check your MongoDB Atlas connection string');
      console.error('   - Verify network access settings in Atlas');
      console.error('   - Ensure your IP is whitelisted');
      console.error('   - Check username/password in connection string');
    }
    
    process.exit(1);
  }
};

// Connect to database
connectDB();
// Health check// Test route
app.get('/test', (req, res) => {
  res.json({ message: 'Server is running!', timestamp: new Date().toISOString() });
});

// Add migration endpoint for fixing vehicle income entries
app.post('/api/migrate/fix-vehicle-income', async (req, res) => {
  try {
    console.log('Starting migration to fix vehicle income entries...');
    
    // Find all vehicle_expense entries from memos with credit > 0
    const incorrectEntries = await LedgerEntry.find({
      ledger_type: 'vehicle_expense',
      source_type: 'memo',
      credit: { $gt: 0 }
    });
    
    console.log(`Found ${incorrectEntries.length} incorrect vehicle expense entries from memos`);
    
    // Update them to vehicle_income
    const updateResult = await LedgerEntry.updateMany(
      {
        ledger_type: 'vehicle_expense',
        source_type: 'memo',
        credit: { $gt: 0 }
      },
      {
        $set: { ledger_type: 'vehicle_income' }
      }
    );
    
    console.log(`Updated ${updateResult.modifiedCount} entries from vehicle_expense to vehicle_income`);
app.post('/api/migrate/regenerate-vehicle-ledgers', async (req, res) => {
  try {
    const LedgerEntry = (await import('./models/LedgerEntry.js')).default;
    const Memo = (await import('./models/Memo.js')).default;
    const BankingEntry = (await import('./models/BankingEntry.js')).default;
    const CashbookEntry = (await import('./models/CashbookEntry.js')).default;
    const FuelTransaction = (await import('./models/FuelTransaction.js')).default;
    const Vehicle = (await import('./models/Vehicle.js')).default;
    const LoadingSlip = (await import('./models/LoadingSlip.js')).default;

    let createdCount = 0;
    const results = {
      memos: 0,
      banking: 0,
      cashbook: 0,
      fuel: 0
    };

    // 1. Process Own Vehicle Memos (create vehicle_income entries)
    console.log('🚛 Processing own vehicle memos...');
    const ownVehicles = await Vehicle.find({ ownership_type: 'own' });
    const ownVehicleNumbers = ownVehicles.map(v => v.vehicle_no);
    
    const memosWithLoadingSlips = await Memo.find().populate('loading_slip_id');
    const ownVehicleMemos = memosWithLoadingSlips.filter(memo => 
      memo.loading_slip_id && ownVehicleNumbers.includes(memo.loading_slip_id.vehicle_no)
    );

    for (const memo of ownVehicleMemos) {
      const existingEntry = await LedgerEntry.findOne({
        reference_id: memo._id.toString(),
        source_type: 'memo',
        ledger_type: 'vehicle_income'
      });

      if (!existingEntry) {
        const totalAmount = memo.freight + (memo.detention || 0) + (memo.extra || 0) - (memo.commission || 0) - (memo.mamool || 0);
        
        if (totalAmount > 0) {
          await LedgerEntry.create({
            referenceId: memo.loading_slip_id.vehicle_no,
            reference_id: memo._id.toString(),
            ledger_type: 'vehicle_income',
            reference_name: `Vehicle ${memo.loading_slip_id.vehicle_no} - Memo Credit`,
            source_type: 'memo',
            type: 'payment',
            date: memo.date,
            description: `Memo ${memo.memo_number} - Total: ₹${totalAmount}`,
            debit: 0,
            credit: totalAmount,
            vehicle_no: memo.loading_slip_id.vehicle_no,
            balance: 0
          });
          results.memos++;
          createdCount++;
        }
      }
    }

    // 2. Process Banking Vehicle Expenses
    console.log('🏦 Processing banking vehicle expenses...');
    const bankingVehicleExpenses = await BankingEntry.find({
      category: 'vehicle_expense',
      vehicle_no: { $exists: true, $ne: null }
    });

    for (const entry of bankingVehicleExpenses) {
      const existingEntry = await LedgerEntry.findOne({
        reference_id: entry._id.toString(),
        source_type: 'banking',
        ledger_type: 'vehicle_expense'
      });

      if (!existingEntry) {
        await LedgerEntry.create({
          referenceId: entry.vehicle_no,
          reference_id: entry._id.toString(),
          ledger_type: 'vehicle_expense',
          reference_name: `Vehicle ${entry.vehicle_no} - Bank Expense`,
          source_type: 'banking',
          type: entry.type === 'debit' ? 'expense' : 'payment',
          date: entry.date,
          description: entry.narration || `Bank ${entry.type} - ${entry.category}`,
          debit: entry.type === 'debit' ? entry.amount : 0,
          credit: entry.type === 'credit' ? entry.amount : 0,
          vehicle_no: entry.vehicle_no,
          balance: 0
        });
        results.banking++;
        createdCount++;
      }
    }

    // 3. Process Cashbook Vehicle Expenses
    console.log('💰 Processing cashbook vehicle expenses...');
    const cashbookVehicleExpenses = await CashbookEntry.find({
      category: 'vehicle_expense',
      vehicle_no: { $exists: true, $ne: null }
    });

    for (const entry of cashbookVehicleExpenses) {
      const existingEntry = await LedgerEntry.findOne({
        reference_id: entry._id.toString(),
        source_type: 'cashbook',
        ledger_type: 'vehicle_expense'
      });

      if (!existingEntry) {
        await LedgerEntry.create({
          referenceId: entry.vehicle_no,
          reference_id: entry._id.toString(),
          ledger_type: 'vehicle_expense',
          reference_name: `Vehicle ${entry.vehicle_no} - Cash Expense`,
          source_type: 'cashbook',
          type: entry.type === 'debit' ? 'expense' : 'payment',
          date: entry.date,
          description: entry.narration || `Cash ${entry.type} - ${entry.category}`,
          debit: entry.type === 'debit' ? entry.amount : 0,
          credit: entry.type === 'credit' ? entry.amount : 0,
          vehicle_no: entry.vehicle_no,
          balance: 0
        });
        results.cashbook++;
        createdCount++;
      }
    }

    // 4. Process Fuel Vehicle Expenses
    console.log('⛽ Processing fuel vehicle expenses...');
    const fuelTransactions = await FuelTransaction.find({
      vehicle_no: { $exists: true, $ne: null }
    });

    for (const fuel of fuelTransactions) {
      const existingEntry = await LedgerEntry.findOne({
        reference_id: fuel._id.toString(),
        source_type: 'fuel',
        ledger_type: 'vehicle_expense'
      });

      if (!existingEntry) {
        await LedgerEntry.create({
          referenceId: fuel._id,
          reference_id: fuel._id.toString(),
          ledger_type: 'vehicle_expense',
          reference_name: `Vehicle ${fuel.vehicle_no} - Fuel Expense`,
          source_type: 'fuel',
          type: 'expense',
          date: fuel.date,
          description: fuel.narration || `Fuel expense for vehicle ${fuel.vehicle_no}`,
          debit: fuel.amount,
          credit: 0,
          vehicle_no: fuel.vehicle_no,
          balance: 0
        });
        results.fuel++;
        createdCount++;
      }
    }

    console.log(`✅ Vehicle ledger regeneration completed. Created ${createdCount} entries.`);

    res.json({
      message: 'Vehicle ledger regeneration completed successfully',
      totalCreated: createdCount,
      breakdown: results,
      summary: {
        ownVehicles: ownVehicleNumbers.length,
        processedMemos: ownVehicleMemos.length,
        processedBanking: bankingVehicleExpenses.length,
        processedCashbook: cashbookVehicleExpenses.length,
        processedFuel: fuelTransactions.length
      }
    });

  } catch (error) {
    console.error('Vehicle ledger regeneration failed:', error);
    res.status(500).json({ 
      message: 'Vehicle ledger regeneration failed', 
      error: error.message 
    });
  }
});

// Manual endpoint to refresh vehicle ledger entry for a specific memo
app.post('/api/refresh-memo-ledger/:memoId', async (req, res) => {
  try {
    const { memoId } = req.params;
    const LedgerEntry = (await import('./models/LedgerEntry.js')).default;
    const Memo = (await import('./models/Memo.js')).default;
    const { createMemoLedgerEntries } = await import('./services/ledgerService.js');

    console.log(`🔄 Manually refreshing ledger for memo: ${memoId}`);

    // Delete existing ledger entries for this memo
    const deleteResult = await LedgerEntry.deleteMany({ 
      $or: [
        { referenceId: memoId },
        { reference_id: memoId.toString() }
      ]
    });
    console.log(`🗑️ Deleted ${deleteResult.deletedCount} existing ledger entries`);

    // Get memo with populated loading slip
    const memo = await Memo.findById(memoId).populate('loading_slip_id');
    
    if (!memo) {
      return res.status(404).json({ message: 'Memo not found' });
    }

    // Recreate ledger entries
    await createMemoLedgerEntries(memo);
    console.log(`✅ Recreated ledger entries for memo ${memo.memo_number}`);

    // Get the newly created entries to return
    const newEntries = await LedgerEntry.find({
      reference_id: memoId.toString()
    });

    res.json({
      message: 'Memo ledger entries refreshed successfully',
      memo_number: memo.memo_number,
      deleted: deleteResult.deletedCount,
      created: newEntries.length,
      entries: newEntries
    });
  } catch (error) {
    console.error('Failed to refresh memo ledger:', error);
    res.status(500).json({ 
      message: 'Failed to refresh memo ledger', 
      error: error.message 
    });
  }
});

// Import vehicle income from own vehicle memos
app.post('/api/migrate/import-vehicle-income-memos', async (req, res) => {
  try {
    const LedgerEntry = (await import('./models/LedgerEntry.js')).default;
    const Memo = (await import('./models/Memo.js')).default;
    const Vehicle = (await import('./models/Vehicle.js')).default;
    const LoadingSlip = (await import('./models/LoadingSlip.js')).default;

    console.log('🚛 Starting vehicle income import from own vehicle memos...');

    // Get all own vehicles
    const ownVehicles = await Vehicle.find({ ownership_type: 'own' });
    const ownVehicleNumbers = ownVehicles.map(v => v.vehicle_no);
    
    console.log(`Found ${ownVehicles.length} own vehicles:`, ownVehicleNumbers);

    // Get all memos with loading slip data
    const memosWithLoadingSlips = await Memo.find().populate('loading_slip_id');
    console.log(`Found ${memosWithLoadingSlips.length} total memos`);

    // Filter for own vehicle memos
    const ownVehicleMemos = memosWithLoadingSlips.filter(memo => 
      memo.loading_slip_id && ownVehicleNumbers.includes(memo.loading_slip_id.vehicle_no)
    );

    console.log(`Found ${ownVehicleMemos.length} own vehicle memos`);

    let createdCount = 0;
    let skippedCount = 0;
    const createdEntries = [];

    for (const memo of ownVehicleMemos) {
      try {
        // Check if ledger entry already exists
        const existingEntry = await LedgerEntry.findOne({
          reference_id: memo._id.toString(),
          source_type: 'memo',
          ledger_type: 'vehicle_income'
        });

        if (existingEntry) {
          console.log(`⚠️ Skipping memo ${memo.memo_number} - ledger entry already exists`);
          skippedCount++;
          continue;
        }

        // Calculate total amount (freight + detention + extra - commission - mamool)
        const totalAmount = memo.freight + (memo.detention || 0) + (memo.extra || 0) - (memo.commission || 0) - (memo.mamool || 0);
        
        if (totalAmount <= 0) {
          console.log(`⚠️ Skipping memo ${memo.memo_number} - total amount is ${totalAmount}`);
          skippedCount++;
          continue;
        }

        // Create vehicle income ledger entry
        const ledgerEntry = await LedgerEntry.create({
          referenceId: memo.loading_slip_id.vehicle_no,
          reference_id: memo._id.toString(),
          ledger_type: 'vehicle_income',
          reference_name: `Vehicle ${memo.loading_slip_id.vehicle_no} - Memo Credit`,
          source_type: 'memo',
          type: 'payment',
          date: memo.date,
          description: `Memo ${memo.memo_number} - ${memo.loading_slip_id.from_location} to ${memo.loading_slip_id.to_location} (Freight: ₹${memo.freight}, Detention: ₹${memo.detention || 0}, Extra: ₹${memo.extra || 0}, Commission: -₹${memo.commission || 0}, Mamool: -₹${memo.mamool || 0})`,
          debit: 0,
          credit: totalAmount,
          vehicle_no: memo.loading_slip_id.vehicle_no,
          balance: 0,
          memo_number: memo.memo_number
        });

        createdEntries.push({
          memo_number: memo.memo_number,
          vehicle_no: memo.loading_slip_id.vehicle_no,
          amount: totalAmount,
          route: `${memo.loading_slip_id.from_location} to ${memo.loading_slip_id.to_location}`,
          date: memo.date,
          ledger_id: ledgerEntry._id
        });

        createdCount++;
        console.log(`✅ Created vehicle income entry for memo ${memo.memo_number}: ₹${totalAmount} for vehicle ${memo.loading_slip_id.vehicle_no}`);

      } catch (error) {
        console.error(`❌ Error processing memo ${memo.memo_number}:`, error);
      }
    }

    console.log(`✅ Vehicle income import completed. Created ${createdCount} entries, skipped ${skippedCount}.`);

    res.json({
      message: 'Vehicle income import from own vehicle memos completed successfully',
      summary: {
        totalOwnVehicles: ownVehicles.length,
        totalMemos: memosWithLoadingSlips.length,
        ownVehicleMemos: ownVehicleMemos.length,
        created: createdCount,
        skipped: skippedCount
      },
      ownVehicles: ownVehicleNumbers,
      createdEntries: createdEntries
    });

  } catch (error) {
    console.error('Vehicle income import failed:', error);
    res.status(500).json({ 
      message: 'Vehicle income import failed', 
      error: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'BRC Backend API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});


// API routes
app.use('/api/auth', authRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/memos', memoRoutes);
app.use('/api/loading-slips', loadingSlipRoutes);
app.use('/api/banking', bankingRoutes);
app.use('/api/cashbook', cashbookRoutes);
app.use('/api/parties', partyRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/ledgers', ledgerRoutes);
app.use('/api/fuel', fuelRoutes);
app.use('/api/pod', podRoutes);
app.use('/api/party-commission-ledger', partyCommissionLedgerRoutes);

// Store connected clients for real-time updates
const connectedClients = new Set();

// SSE endpoint for real-time sync
app.get('/api/sync/events', (req, res) => {
  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send initial connection message
  res.write('data: {"type":"connected","message":"Real-time sync connected"}\n\n');

  // Add client to connected clients
  connectedClients.add(res);

  // Handle client disconnect
  req.on('close', () => {
    connectedClients.delete(res);
  });

  req.on('aborted', () => {
    connectedClients.delete(res);
  });
});

// Broadcast changes to all connected clients
const broadcastChange = (changeType, collection, data) => {
  const message = JSON.stringify({
    type: 'data_change',
    changeType,
    collection,
    data,
    timestamp: new Date().toISOString()
  });

  console.log(`📡 Broadcasting ${changeType} change for ${collection} to ${connectedClients.size} clients`);

  connectedClients.forEach(client => {
    try {
      client.write(`data: ${message}\n\n`);
    } catch (error) {
      // Remove disconnected clients
      connectedClients.delete(client);
    }
  });
};

// Make broadcastChange available globally for routes
global.broadcastChange = broadcastChange;

// Sync status endpoint
app.get('/api/sync/status', (req, res) => {
  res.json({
    connectedClients: connectedClients.size,
    serverTime: new Date().toISOString(),
    status: 'active'
  });
});

// Export broadcast function for use in routes
app.locals.broadcastChange = broadcastChange;

// Serve React frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Start server - bind to 0.0.0.0 for both LAN and cloud access
const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`🚀 BRC Backend server running on http://${HOST}:${PORT}`);
  
  if (process.env.NODE_ENV === 'production') {
    console.log(`🌐 Production URL: ${process.env.RENDER_EXTERNAL_URL || `https://your-app.onrender.com`}`);
    console.log(`📊 Health check: ${process.env.RENDER_EXTERNAL_URL || `https://your-app.onrender.com`}/health`);
  } else {
    console.log(`🌐 Local access: http://localhost:${PORT}`);
    console.log(`🏠 LAN access: http://[YOUR_LAN_IP]:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});
