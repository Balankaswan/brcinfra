# BRC Transport Management - LAN Deployment Guide

This guide will help you deploy the BRC Transport Management System on your local network (LAN) so multiple devices can access it.

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher)
- MongoDB (running locally)
- Git

### 1. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

### 2. Setup Environment

```bash
# Copy environment template
cp .env.example .env

# Find your LAN IP address
# On Mac/Linux:
ifconfig | grep "inet " | grep -v 127.0.0.1

# On Windows:
ipconfig | findstr "IPv4"
```

Edit `.env` file and replace `192.168.1.100` with your actual LAN IP:
```env
VITE_API_URL=http://YOUR_ACTUAL_IP:5001/api
```

### 3. Start MongoDB
```bash
# Start MongoDB service
mongod

# Or if using MongoDB Compass, just open it
```

### 4. Start the Application

**Option A: Start both frontend and backend together**
```bash
npm run start:full
```

**Option B: Start separately**
```bash
# Terminal 1 - Backend
npm run start:backend

# Terminal 2 - Frontend  
npm start
```

### 5. Access from Other Devices

- **Frontend**: `http://YOUR_IP:3000`
- **Backend API**: `http://YOUR_IP:5001`
- **Health Check**: `http://YOUR_IP:5001/health`

## 📱 Device Access

### Same WiFi Network Access
Any device connected to the same WiFi network can access:
- Laptops: Open browser → `http://YOUR_IP:3000`
- Mobile phones: Open browser → `http://YOUR_IP:3000`
- Tablets: Open browser → `http://YOUR_IP:3000`

### First Time Setup
1. Open `http://YOUR_IP:3000` in any browser
2. Click "Don't have an account? Sign up"
3. Create admin account:
   - Username: `admin`
   - Email: `admin@brc.com`
   - Password: `admin123`
   - Role: `Admin`

## 🔧 Configuration Details

### Backend Configuration (Port 5001)
- **Database**: MongoDB on `mongodb://localhost:27017/brc_transport`
- **CORS**: Configured for LAN access
- **Authentication**: JWT-based
- **File Uploads**: Base64 encoded (POD images)

### Frontend Configuration (Port 3000)
- **Framework**: React + TypeScript + Vite
- **Styling**: Tailwind CSS
- **API**: REST API calls to backend
- **State**: React Context (replacing Supabase)

## 🛠️ API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/profile` - Get user profile

### Core Entities
- `GET|POST|PUT|DELETE /api/loading-slips` - Loading slips
- `GET|POST|PUT|DELETE /api/bills` - Bills management
- `GET|POST|PUT|DELETE /api/memos` - Memos management
- `GET|POST|PUT|DELETE /api/banking` - Banking entries
- `GET|POST|PUT|DELETE /api/parties` - Party master
- `GET|POST|PUT|DELETE /api/suppliers` - Supplier master
- `GET|POST|PUT|DELETE /api/vehicles` - Vehicle master

### Advanced Features
- `GET /api/ledgers` - Ledger entries
- `GET /api/ledgers/summary/:name` - Ledger summary
- `GET|POST /api/fuel/wallets` - Fuel wallet management
- `POST /api/fuel/allocate` - Fuel allocation
- `GET|POST|DELETE /api/pod` - POD file management

## 🧪 Testing API

### Using curl
```bash
# Health check
curl http://YOUR_IP:5001/health

# Register user
curl -X POST http://YOUR_IP:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@test.com","password":"test123"}'

# Login
curl -X POST http://YOUR_IP:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}'
```

### Using Postman
1. Import the collection from `postman_collection.json` (if available)
2. Set base URL to `http://YOUR_IP:5001/api`
3. Test authentication endpoints first
4. Use the JWT token in Authorization header for other endpoints

## 🔒 Security Features

### Authentication
- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control (Admin, Manager, Operator)
- Session management

### Network Security
- CORS configured for LAN access only
- Rate limiting (1000 requests per 15 minutes)
- Helmet.js security headers
- Input validation and sanitization

## 📊 Production Deployment

### Build for Production
```bash
# Build frontend
npm run build

# The built files will be in 'dist' folder
# Backend can serve these static files in production mode
```

### Environment Variables for Production
```env
NODE_ENV=production
MONGODB_URI=mongodb://localhost:27017/brc_transport_prod
JWT_SECRET=your_super_secure_secret_key_here
PORT=5001
```

### Serve Frontend via Backend (Production)
When `NODE_ENV=production`, the backend automatically serves the built React app from the `dist` folder.

## 🐛 Troubleshooting

### Common Issues

**1. Cannot access from other devices**
- Check firewall settings
- Ensure both devices are on same WiFi
- Verify IP address is correct
- Try `http://` not `https://`

**2. MongoDB connection failed**
```bash
# Check if MongoDB is running
ps aux | grep mongod

# Start MongoDB
brew services start mongodb/brew/mongodb-community
# or
sudo systemctl start mongod
```

**3. Port already in use**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Kill process on port 5001  
lsof -ti:5001 | xargs kill -9
```

**4. CORS errors**
- Verify VITE_API_URL in .env file
- Check backend CORS configuration
- Ensure IP addresses match

### Network Discovery
```bash
# Find all devices on network
nmap -sn 192.168.1.0/24

# Check if ports are open
nmap -p 3000,5001 YOUR_IP
```

## 📱 Mobile Access Tips

1. **Add to Home Screen**: Most mobile browsers allow adding web apps to home screen
2. **Bookmark**: Save `http://YOUR_IP:3000` as bookmark
3. **QR Code**: Generate QR code for easy sharing
4. **Network Stability**: Ensure stable WiFi connection

## 🔄 Data Migration

### From Supabase to Local MongoDB
The application now uses local MongoDB instead of Supabase. All data structures remain the same:
- Loading slips, bills, memos
- Banking entries, parties, suppliers
- Vehicles, fuel management, POD files
- User authentication and roles

### Backup and Restore
```bash
# Backup MongoDB
mongodump --db brc_transport --out ./backup

# Restore MongoDB
mongorestore --db brc_transport ./backup/brc_transport
```

## 📞 Support

For issues or questions:
1. Check this guide first
2. Verify network connectivity
3. Check browser console for errors
4. Review backend logs in terminal

---

**🎉 Congratulations!** Your BRC Transport Management System is now running on your LAN and accessible to all devices on your network.
