# BRC Transport Management System - Cloud Deployment Guide

Complete guide for deploying your BRC Transport Management System to the cloud using Vercel (Frontend) and Render (Backend).

## 🏗️ Architecture Overview

- **Frontend**: React app deployed on Vercel
- **Backend**: Node.js API deployed on Render  
- **Database**: MongoDB Atlas (already configured)

## 🚀 Step 1: Deploy Backend to Render

### 1.1 Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up with GitHub (recommended)
3. Connect your GitHub repository

### 1.2 Deploy Backend Service
1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure deployment:
   - **Name**: `brc-backend` (or your preferred name)
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (for testing)
   - **Auto-Deploy**: Yes (recommended)

### 1.3 Set Environment Variables
In Render dashboard, add these environment variables:

```env
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/brc_transport_copy?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production
FRONTEND_URL=https://your-frontend-app.vercel.app
ALLOWED_ORIGINS=https://your-frontend-app.vercel.app
```

### 1.4 Deploy
1. Click "Create Web Service"
2. Wait for deployment (5-10 minutes)
3. Note your backend URL: `https://your-backend-app.onrender.com`

## 🌐 Step 2: Deploy Frontend to Vercel

### 2.1 Create Vercel Account
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Install Vercel CLI (optional): `npm i -g vercel`

### 2.2 Deploy Frontend
**Option A: GitHub Integration (Recommended)**
1. Push your code to GitHub
2. In Vercel dashboard: "New Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (project root)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

**Option B: Vercel CLI**
```bash
cd /path/to/your/project
vercel
```

### 2.3 Set Environment Variables
In Vercel dashboard → Settings → Environment Variables:

```env
VITE_API_URL=https://your-backend-app.onrender.com/api
VITE_APP_NAME=BRC Transport Management
VITE_NODE_ENV=production
```

### 2.4 Update Backend CORS
After getting your Vercel URL, update your backend environment variables:
```env
FRONTEND_URL=https://your-frontend-app.vercel.app
ALLOWED_ORIGINS=https://your-frontend-app.vercel.app
```

## 🔧 Step 3: Update Configuration Files

### 3.1 Update Frontend Environment
Create/update `.env.production`:
```env
VITE_API_URL=https://your-actual-backend-url.onrender.com/api
```

### 3.2 Update Backend Environment  
Update `backend/.env.production`:
```env
FRONTEND_URL=https://your-actual-frontend-url.vercel.app
ALLOWED_ORIGINS=https://your-actual-frontend-url.vercel.app
```

## 🧪 Step 4: Testing Cloud Deployment

### 4.1 Test Backend
1. Visit: `https://your-backend-app.onrender.com/health`
2. Should return: `{"status":"OK","message":"BRC Backend API is running"}`

### 4.2 Test Frontend
1. Visit: `https://your-frontend-app.vercel.app`
2. Test user registration/login
3. Create a loading slip to test full functionality

### 4.3 Test Integration
1. Register a new user account
2. Create parties, suppliers, vehicles
3. Generate loading slips and memos
4. Verify data persistence across sessions

## 🔒 Step 5: Production Security

### 5.1 Update JWT Secret
```bash
# Generate a strong JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Update in Render environment variables.

### 5.2 Configure HTTPS
- Vercel: Automatic HTTPS
- Render: Automatic HTTPS
- MongoDB Atlas: Already uses SSL/TLS

### 5.3 Environment Variables Security
- Never commit `.env` files to Git
- Use Render/Vercel dashboards for production variables
- Rotate secrets regularly

## 📊 Step 6: Monitoring & Maintenance

### 6.1 Render Monitoring
- Check logs in Render dashboard
- Monitor resource usage
- Set up alerts for downtime

### 6.2 Vercel Analytics
- Enable Vercel Analytics for performance insights
- Monitor build times and deployment status

### 6.3 MongoDB Atlas Monitoring
- Monitor database performance
- Set up backup schedules
- Configure alerts for high usage

## 🚨 Troubleshooting

### Common Issues

**CORS Errors:**
- Verify ALLOWED_ORIGINS includes your Vercel URL
- Check both HTTP and HTTPS variants
- Ensure no trailing slashes

**API Connection Failed:**
- Verify VITE_API_URL points to correct Render URL
- Check Render service is running
- Verify MongoDB Atlas connection

**Build Failures:**
- Check Node.js version compatibility
- Verify all dependencies in package.json
- Review build logs for specific errors

### Quick Fixes

**Backend not starting:**
```bash
# Check Render logs for MongoDB connection issues
# Verify MONGODB_URI environment variable
```

**Frontend API calls failing:**
```bash
# Check browser network tab
# Verify API URL in environment variables
# Check CORS configuration
```

## 🎯 Production Checklist

- [ ] Backend deployed to Render
- [ ] Frontend deployed to Vercel  
- [ ] MongoDB Atlas connected
- [ ] Environment variables configured
- [ ] CORS settings updated
- [ ] JWT secret updated
- [ ] HTTPS enabled
- [ ] User registration/login tested
- [ ] Core features tested
- [ ] Performance monitoring enabled

## 🔗 Useful Links

- [Render Documentation](https://render.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review deployment logs in respective dashboards
3. Verify all environment variables are set correctly
4. Test each component individually (database → backend → frontend)

---

**🎉 Your BRC Transport Management System is now fully cloud-deployed and production-ready!**
