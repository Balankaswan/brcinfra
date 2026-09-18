import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

// Import routes
import bankingRoutes from './routes/banking.js';
import memoRoutes from './routes/memos.js';
import billRoutes from './routes/bills.js';
import partyRoutes from './routes/parties.js';
import supplierRoutes from './routes/suppliers.js';
import vehicleRoutes from './routes/vehicles.js';
import loadingSlipRoutes from './routes/loadingSlips.js';
import cashbookRoutes from './routes/cashbook.js';
import ledgerRoutes from './routes/ledgers.js';
import fuelRoutes from './routes/fuel.js';
import podRoutes from './routes/pod.js';
import authRoutes from './routes/auth.js';
import partyCommissionLedgerRoutes from './routes/partyCommissionLedger.js';
import autoIncrementRoutes from './routes/autoIncrement.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173'];

if (process.env.FRONTEND_URL && !allowedOrigins.includes(process.env.FRONTEND_URL.trim())) {
  allowedOrigins.push(process.env.FRONTEND_URL.trim());
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) {
      console.warn('⚠️ MONGODB_URI environment variable is not set!');
      return;
    }
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB Atlas successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
  }
};

connectDB();

// Root & Health checks
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'BRC Transport API Service is running',
    dbState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

app.get(['/health', '/api/health'], (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'BRC Backend API is running',
    dbState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Store connected clients for real-time updates
const connectedClients = new Set();

// SSE endpoint for real-time sync - MUST be before other routes
app.get('/api/sync/events', (req, res) => {
  console.log('📡 SSE connection request received');
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
app.use('/api/auto-increment', autoIncrementRoutes);

// Error handling
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 BRC Backend server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});
