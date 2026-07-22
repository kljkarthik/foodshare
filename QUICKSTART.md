# Quick Start - 5 Minutes to Running Food Share

**TL;DR**: Get the app running in 5 minutes with these steps.

---

## Prerequisites (2 min)

✅ Have **Node.js v18+** installed? 
- Download: https://nodejs.org/
- Check: `node --version`

✅ Have **MongoDB Atlas account**?
- Create free account: https://www.mongodb.com/cloud/atlas
- Create cluster (Free tier)
- Get connection string from "Connect" button

---

## Installation (2 min)

```bash
# 1. Navigate to project
cd food-share/backend

# 2. Install dependencies
npm install
```

---

## Configuration (1 min)

```bash
# 3. Create .env file
cp .env.example .env

# 4. Edit .env and add:
#    MONGODB_URI=your_connection_string_here
#    JWT_SECRET=any_random_secret_key_here
```

---

## Run (1 min)

```bash
# 5. Start server
npm start

# You should see:
# "Food Share server running on http://localhost:3000"
```

✅ **Done!** Open browser to http://localhost:3000

---

## Common Issues

| Issue | Fix |
|-------|-----|
| "Cannot find module" | Run `npm install` again |
| "Address in use" | Change PORT in .env to 3001 |
| "MongoDB connection failed" | Check connection string in .env |

---

## Next Steps

1. Read [SETUP.md](./SETUP.md) for detailed setup
2. Read [REQUIREMENTS.md](./REQUIREMENTS.md) for full docs
3. Edit code in `backend/` and `frontend/public/`
4. For auto-reload: `npm run dev` instead of `npm start`

---

## File Guide

```
food-share/
├── REQUIREMENTS.md      ← Detailed requirements
├── SETUP.md            ← Complete setup guide  
├── DEPENDENCIES.md     ← What each package does
├── README.md           ← Project overview
├── QUICKSTART.md       ← This file
│
├── backend/
│   ├── .env.example    ← Copy to .env
│   ├── package.json    ← Dependencies list
│   ├── server.js       ← Main app
│   ├── routes.js       ← API endpoints
│   └── database.js     ← DB config
│
└── frontend/public/
    ├── index.html      ← Main page
    ├── css/styles.css  ← Styles
    └── js/app.js       ← Frontend logic
```

---

**Ready to code? Let's go! 🚀**
