# Food Share - Setup Guide

Complete step-by-step instructions to get the Food Share application running on your machine.

## Prerequisites

Before starting, ensure you have:
- **Node.js** v18+ installed ([Download](https://nodejs.org/))
- **npm** v10+ (comes with Node.js)
- **Git** installed ([Download](https://git-scm.com/))
- **MongoDB Atlas** account ([Create free account](https://www.mongodb.com/cloud/atlas))
- A code editor (VS Code recommended)

---

## Part 1: Initial Setup

### 1. Clone the Repository
```bash
# Navigate to where you want the project
cd your_projects_folder

# Clone the project (or extract if ZIP)
git clone <repository-url> food-share
cd food-share
```

### 2. Verify Installation
```bash
# Check Node.js version (should be v18+)
node --version

# Check npm version (should be v10+)
npm --version
```

---

## Part 2: Backend Setup

### 1. Navigate to Backend Directory
```bash
cd backend
```

### 2. Install Dependencies
```bash
npm install
```

This will install:
- Express.js (web framework)
- Mongoose (MongoDB driver)
- bcryptjs (password hashing)
- JWT (authentication)
- CORS (cross-origin requests)
- Nodemon (development tool)

### 3. Create Environment File
```bash
# Copy the example file
cp .env.example .env

# Or on Windows:
copy .env.example .env
```

### 4. Configure MongoDB Connection

**Step 1:** Create a MongoDB Atlas account
- Go to https://www.mongodb.com/cloud/atlas
- Sign up for free
- Create a new cluster (choose Free tier)

**Step 2:** Get your connection string
- In MongoDB Atlas dashboard, click "Connect"
- Choose "Connect your application"
- Copy the connection string

**Step 3:** Update .env file
Open `backend/.env` and update:
```env
MONGODB_URI=mongodb+srv://your_username:your_password@cluster-name.mongodb.net/food-share
JWT_SECRET=change_this_to_a_random_long_string
```

### 5. Whitelist Your IP (MongoDB Atlas)
- In MongoDB Atlas, go to "Network Access"
- Add your current IP address
- Or click "Allow access from anywhere" for development (NOT recommended for production)

---

## Part 3: Running the Application

### Option A: Production Mode
```bash
# From backend/ directory
npm start
```

Expected output:
```
Connected to MongoDB Atlas successfully.
==================================================
Food Share server running on http://localhost:3000
==================================================
```

### Option B: Development Mode (Auto-reload)
```bash
# From backend/ directory
npm run dev
```

Server will auto-restart when you make code changes.

---

## Part 4: Access the Application

### 1. Open Browser
```
http://localhost:3000
```

You should see the Food Share homepage with:
- Navigation menu
- Welcome banner
- "Find Food Near You" button
- "Share Your Leftovers" button
- Impact calculator
- Footer with links

### 2. Test API (Optional)
Using a REST client (VS Code extension: REST Client or Thunder Client):

```http
### Get all food items
GET http://localhost:3000/api/food

### Verify server
GET http://localhost:3000/api
```

---

## Part 5: First-Time Usage

### Create a Test Account

**Note:** Authentication endpoints are available. Refer to `backend/routes.js` for current API endpoints.

### Add Food Listings
- Click "Share Your Leftovers" button
- Fill in food details (name, quantity, location, description)
- Submit to share with community

### Find Food
- Click "Find Food Near You"
- Browse available food items
- Claim or contact donors

---

## Troubleshooting

### Issue: "Cannot find module 'express'"
```bash
# Fix: Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Issue: "EADDRINUSE: address already in use :::3000"
```bash
# Port 3000 is already in use
# Option 1: Stop other application using port 3000
# Option 2: Change port in .env file
# Update REQUIREMENTS.md for how to find process using port
```

**On Windows:**
```powershell
# Find process using port 3000
netstat -ano | findstr :3000

# Kill process (replace PID with the number found)
taskkill /PID <PID> /F
```

**On macOS/Linux:**
```bash
# Find and kill process
lsof -ti:3000 | xargs kill -9
```

### Issue: "MongoAuthenticationError"
```
Error: authentication failed
```
**Fix:**
- Verify MONGODB_URI in `.env` is correct
- Check username and password (especially special characters - must be URL encoded)
- Ensure IP is whitelisted in MongoDB Atlas

### Issue: "Cannot GET /"
- Ensure backend server is running
- Check that port 3000 is correct in browser
- Verify frontend files exist in `frontend/public/`

### Issue: "Module not found" after npm install
```bash
cd backend
npm cache clean --force
npm install
```

---

## Development Workflow

### 1. Start the Server
```bash
cd backend
npm run dev  # Will auto-reload on changes
```

### 2. Make Code Changes
- Edit files in `backend/` or `frontend/public/`
- For backend: Changes auto-reload with nodemon
- For frontend: Refresh browser (Ctrl+R or Cmd+R)

### 3. Test Your Changes
- Use browser to test UI
- Use REST client to test API endpoints
- Check browser console for errors (F12)

### 4. Commit Changes
```bash
git add .
git commit -m "Describe your changes"
git push
```

---

## Useful Commands

```bash
# Start server (production)
npm start

# Start server (development with auto-reload)
npm run dev

# Check for security issues
npm audit

# Update dependencies
npm update

# Reinstall from scratch
rm -rf node_modules package-lock.json
npm install
```

---

## Environment Variables Reference

| Variable | Purpose | Example |
|----------|---------|---------|
| `MONGODB_URI` | Database connection | `mongodb+srv://user:pass@cluster.mongodb.net/db` |
| `JWT_SECRET` | Token signing key | `your_random_secret_key_here` |
| `NODE_ENV` | Environment type | `development` or `production` |
| `PORT` | Server port | `3000` |

---

## Next Steps

1. ✅ Install dependencies
2. ✅ Configure MongoDB
3. ✅ Start the server
4. ✅ Access http://localhost:3000
5. 📖 Read [REQUIREMENTS.md](./REQUIREMENTS.md) for detailed documentation
6. 📖 Read [README.md](./README.md) for project overview
7. 🔍 Explore `backend/routes.js` to understand API endpoints
8. 💻 Start developing!

---

## Getting Help

- **API Documentation**: See `backend/routes.js`
- **Database Schema**: See `backend/database.js`
- **Frontend Code**: See `frontend/public/app.js`
- **Errors**: Check browser console (F12) and server terminal
- **Documentation**: See REQUIREMENTS.md

---

## Security Reminder

⚠️ **IMPORTANT**: 
- Never commit `.env` file to Git
- Never share `JWT_SECRET` with anyone
- Change `JWT_SECRET` before production deployment
- Keep `node_modules/` in `.gitignore`
- Regularly run `npm audit fix` to patch vulnerabilities

---

## Quick Reference

| Task | Command | Location |
|------|---------|----------|
| Install | `npm install` | `/backend` |
| Run (dev) | `npm run dev` | `/backend` |
| Run (prod) | `npm start` | `/backend` |
| Access app | Browser | `http://localhost:3000` |
| View API | Files | `/backend/routes.js` |
| Frontend | Files | `/frontend/public/` |
| Config | `.env` | `/backend` |

---

**Happy Coding! 🚀**

Last Updated: 2026-07-22
