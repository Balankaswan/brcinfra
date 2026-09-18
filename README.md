# BRC Transport Management System - LAN Deployment

A comprehensive transport and logistics management system with **full-stack Node.js + MongoDB backend** designed for **LAN (Local Network) deployment**.

## 🌟 Features

- **Loading Slip Management**: Create and manage loading slips for shipments
- **Memo & Bill Management**: Handle supplier memos and party bills with advance payments
- **Banking & Cashbook**: Track financial transactions and banking entries
- **Party & Supplier Master**: Maintain customer and supplier databases
- **Vehicle Management**: Track own and market vehicles with fuel allocation
- **Fuel Management**: Monitor fuel expenses and wallet-based allocations
- **Ledger System**: Comprehensive accounting and ledger management
- **POD Management**: Proof of delivery document handling with image upload
- **PDF Generation**: Generate professional PDFs for all documents
- **User Authentication**: JWT-based authentication with role management
- **LAN Access**: Access from multiple devices on the same WiFi network

## 🏗️ Technology Stack

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Vite** for build tooling
- **React Hook Form** with Zod validation

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose ODM
- **JWT Authentication** with bcrypt
- **CORS** configured for LAN access
- **Rate limiting** and security headers

## 🚀 Quick Start (LAN Deployment)

### Prerequisites
- Node.js (v18+)
- **Database**: Choose one option:
  - **MongoDB Atlas** (cloud-based, recommended) - See [MongoDB Atlas Migration Guide](./MONGODB_ATLAS_MIGRATION.md)
  - **Local MongoDB** (development only) - MongoDB Compass or local installation
- Git

### 1. One-Command Setup
```bash
# Make startup script executable and run
chmod +x start-lan.sh
./start-lan.sh
```

### 2. Manual Setup
```bash
# Install dependencies
npm install
cd backend && npm install && cd ..

# Start MongoDB (choose one):
mongod                                    # Direct command
brew services start mongodb/brew/mongodb-community  # macOS with Homebrew
# Or open MongoDB Compass

# Find your LAN IP and create .env
ifconfig | grep "inet " | grep -v 127.0.0.1
echo "VITE_API_URL=http://YOUR_IP:5000/api" > .env

# Start both servers
npm run start:full
```

### 3. Access from Any Device
- **Main App**: `http://YOUR_IP:3000`
- **API Health**: `http://YOUR_IP:5000/health`

## 📱 Multi-Device Access

### Supported Devices
- **Laptops/Desktops**: Any modern browser
- **Mobile Phones**: iOS Safari, Android Chrome
- **Tablets**: iPad, Android tablets
- **Any device on same WiFi network**

### First Login
1. Open `http://YOUR_IP:3000` on any device
2. Click "Don't have an account? Sign up"
3. Create admin account:
   - Username: `admin`
   - Email: `admin@company.com`
   - Password: `admin123`
   - Role: `Admin`

## 🔧 Available Scripts

### Frontend
- `npm start` - Start frontend on LAN (0.0.0.0:3000)
- `npm run dev` - Development mode
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Backend
- `npm run start:backend` - Start backend server
- `npm run start:full` - Start both frontend and backend

### Combined
- `./start-lan.sh` - One-command startup with IP detection

## 🏗️ Project Structure

```
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── lib/               # API service & auth
│   ├── types/             # TypeScript definitions
│   └── utils/             # Helper functions
├── backend/               # Node.js backend
│   ├── models/            # MongoDB models
│   ├── routes/            # API routes
│   ├── middleware/        # Auth & security
│   └── server.js          # Express server
├── LAN_DEPLOYMENT_GUIDE.md # Detailed setup guide
└── start-lan.sh           # Quick startup script
```

## 🔐 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/profile` - User profile

### Core Features
- `/api/loading-slips` - Loading slip CRUD
- `/api/bills` - Bill management
- `/api/memos` - Memo management  
- `/api/banking` - Banking entries
- `/api/parties` - Party master
- `/api/suppliers` - Supplier master
- `/api/vehicles` - Vehicle management
- `/api/fuel` - Fuel management
- `/api/ledgers` - Ledger entries
- `/api/pod` - POD file management

## 🛠️ Testing

### API Testing with curl
```bash
# Health check
curl http://YOUR_IP:5000/health

# Register user
curl -X POST http://YOUR_IP:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@test.com","password":"test123"}'
```

### Browser Testing
1. Open `http://YOUR_IP:3000` on multiple devices
2. Create different user accounts with different roles
3. Test all CRUD operations
4. Verify data sync across devices

## 🔒 Security Features

- **JWT Authentication** with secure token storage
- **Role-based access control** (Admin, Manager, Operator)
- **Password hashing** with bcrypt
- **Rate limiting** (1000 requests/15min)
- **CORS protection** for LAN-only access
- **Input validation** and sanitization

## 🐛 Troubleshooting

### Common Issues

**Cannot access from other devices:**
- Verify both devices on same WiFi
- Check firewall settings
- Use `http://` not `https://`

**Database connection failed:**

*For MongoDB Atlas:*
- Check your connection string in `.env`
- Verify IP whitelist in Atlas Network Access
- Ensure database user has correct permissions
- See [MongoDB Atlas Migration Guide](./MONGODB_ATLAS_MIGRATION.md)

*For Local MongoDB:*
```bash
# Check if MongoDB is running
ps aux | grep mongod
# Start MongoDB
brew services start mongodb/brew/mongodb-community
```

**Port conflicts:**
```bash
# Kill processes on ports
lsof -ti:3000 | xargs kill -9
lsof -ti:5000 | xargs kill -9
```

## 📖 Documentation

- **[LAN_DEPLOYMENT_GUIDE.md](./LAN_DEPLOYMENT_GUIDE.md)** - Comprehensive setup guide
- **API Documentation** - Available at `/api/health` endpoint
- **User Manual** - Built-in help in the application

## 🎯 Production Deployment

```bash
# Build for production
npm run build

# Set production environment
export NODE_ENV=production

# Start production server (serves both frontend and backend)
cd backend && npm start
```

## 📞 Support

For setup issues:
1. Check `LAN_DEPLOYMENT_GUIDE.md`
2. Verify network connectivity
3. Check browser console for errors
4. Review terminal logs

---

**🎉 Ready to use!** Your BRC Transport Management System is now accessible across your entire office network.