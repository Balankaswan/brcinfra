# MongoDB Atlas Migration Guide

This guide will help you migrate your BRC Transport Management System from local MongoDB to MongoDB Atlas (cloud-based).

## Prerequisites

- MongoDB Atlas account (free tier available)
- Internet connection
- Current local MongoDB data (optional backup)

## Step 1: Create MongoDB Atlas Account

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Sign up for a free account
3. Verify your email address

## Step 2: Create a New Cluster

1. Click "Create a New Cluster"
2. Choose **M0 Sandbox** (Free tier)
3. Select your preferred cloud provider and region
4. Name your cluster (e.g., "brc-transport-cluster")
5. Click "Create Cluster" (takes 1-3 minutes)

## Step 3: Configure Database Access

1. Go to **Database Access** in the left sidebar
2. Click "Add New Database User"
3. Choose **Password** authentication
4. Create username and password (save these!)
5. Set privileges to **Read and write to any database**
6. Click "Add User"

## Step 4: Configure Network Access

1. Go to **Network Access** in the left sidebar
2. Click "Add IP Address"
3. Choose one option:
   - **Add Current IP Address** (for specific IP)
   - **Allow Access from Anywhere** (0.0.0.0/0) - for development
4. Click "Confirm"

## Step 5: Get Connection String

1. Go to **Clusters** and click "Connect" on your cluster
2. Choose "Connect your application"
3. Select **Node.js** and version **4.1 or later**
4. Copy the connection string (looks like):
   ```
   mongodb+srv://username:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

## Step 6: Update Your Application

1. Open your `.env` file in the backend folder
2. Replace the `MONGODB_URI` with your Atlas connection string:
   ```env
   MONGODB_URI=mongodb+srv://your_username:your_password@cluster0.xxxxx.mongodb.net/brc_transport?retryWrites=true&w=majority
   ```
3. Replace `your_username`, `your_password`, and cluster details with actual values

## Step 7: Test Connection

1. Start your backend server:
   ```bash
   cd backend
   npm start
   ```
2. Look for successful connection messages:
   ```
   ✅ MongoDB connected successfully
   📍 Database: brc_transport
   🌐 Host: cluster0-shard-00-00.xxxxx.mongodb.net:27017
   ```

## Step 8: Data Migration (Optional)

If you have existing local data to migrate:

### Option A: MongoDB Compass (GUI)
1. Install [MongoDB Compass](https://www.mongodb.com/products/compass)
2. Connect to your local MongoDB
3. Export collections as JSON
4. Connect to Atlas and import the JSON files

### Option B: MongoDB Tools (Command Line)
```bash
# Export from local MongoDB
mongodump --host localhost:27017 --db brc_transport --out ./backup

# Import to Atlas
mongorestore --uri "mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/brc_transport" ./backup/brc_transport
```

## Troubleshooting

### Connection Issues
- **ENOTFOUND error**: Check your connection string format
- **Authentication failed**: Verify username/password in connection string
- **Timeout errors**: Check network access settings in Atlas

### Common Fixes
1. Ensure IP address is whitelisted in Network Access
2. Verify database user has correct permissions
3. Check connection string format (include database name)
4. Ensure password doesn't contain special characters that need URL encoding

## Benefits of MongoDB Atlas

- ✅ **Automatic backups** and point-in-time recovery
- ✅ **High availability** with replica sets
- ✅ **Scalability** - easily upgrade as you grow
- ✅ **Security** - built-in encryption and access controls
- ✅ **Monitoring** - performance insights and alerts
- ✅ **Global deployment** - deploy closer to users

## Environment Configuration

Your `.env` file should look like:

```env
# MongoDB Atlas Configuration
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/brc_transport?retryWrites=true&w=majority
DB_NAME=brc_transport
PORT=5001
NODE_ENV=production
JWT_SECRET=your_secure_jwt_secret
```

## Production Considerations

1. **Security**: Use strong passwords and limit IP access
2. **Monitoring**: Set up Atlas alerts for performance
3. **Backups**: Configure automatic backup schedules
4. **Scaling**: Monitor usage and upgrade tier as needed

## Support

- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [MongoDB University](https://university.mongodb.com/) - Free courses
- [Community Forums](https://community.mongodb.com/)

---

**Note**: The free M0 tier includes 512MB storage and shared RAM/CPU, which is perfect for development and small applications. You can upgrade to dedicated clusters as your application grows.
