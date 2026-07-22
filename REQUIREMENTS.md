# Food Share - Project Requirements

## System Requirements

### Minimum Requirements
- **Node.js**: v14.0.0 or higher (recommended v18.0.0+)
- **npm**: v6.0.0 or higher
- **OS**: Windows, macOS, or Linux
- **RAM**: 512 MB minimum
- **Storage**: 500 MB for node_modules + database

### Recommended Setup
- **Node.js**: v20.0.0+
- **npm**: v10.0.0+
- **VS Code** or similar code editor
- **MongoDB Atlas** account (cloud database)

---

## Backend Dependencies

### Production Dependencies
```
bcryptjs@^2.4.3       - Password hashing and salting
cors@^2.8.5           - Cross-Origin Resource Sharing middleware
express@^4.19.2       - Web framework for Node.js
jsonwebtoken@^9.0.2   - JWT authentication tokens
mongoose@^9.8.0       - MongoDB object modeling
```

### Development Dependencies
```
nodemon@^3.1.0        - Auto-reload server during development
```

---

## Frontend Requirements

### Browser Support
- **Chrome**: v90+
- **Firefox**: v88+
- **Safari**: v14+
- **Edge**: v90+

### Frontend Technologies
- **HTML5** - Markup
- **CSS3** - Styling
- **Vanilla JavaScript** - Client-side logic (ES6+)
- **No frameworks** - Pure frontend (lightweight)

---

## Database Requirements

### Option 1: MongoDB Atlas (Cloud - Current Setup)
- **Connection String** required in environment variables
- **Free Tier**: Adequate for development/small deployment
- **Automatic backups** included

### Option 2: SQLite (Local Alternative)
- **No installation** needed
- **File-based** database
- **Suitable** for development/testing

---

## Environment Variables

Create a `.env` file in the `backend/` directory with:

```env
# Server Configuration
NODE_ENV=development
PORT=3000

# MongoDB Atlas Connection
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/food-share

# JWT Secret
JWT_SECRET=your_secret_key_here_change_this_in_production

# Optional: Database Name
DB_NAME=food-share
```

**Important**: 
- Never commit `.env` to version control
- Change JWT_SECRET in production
- Use strong MongoDB credentials

---

## Installation Instructions

### Step 1: Prerequisites Check
```bash
node --version      # Should be v14.0.0 or higher
npm --version       # Should be v6.0.0 or higher
```

### Step 2: Clone/Setup Project
```bash
cd food-share
```

### Step 3: Install Backend Dependencies
```bash
cd backend
npm install
```

### Step 4: Setup Environment Variables
```bash
# In backend/ directory, create .env file with:
NODE_ENV=development
PORT=3000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key_here
```

### Step 5: Start the Server
```bash
# From backend/ directory
npm start          # Production mode
# OR
npm run dev        # Development mode with auto-reload
```

---

## Running the Application

### Quick Start (from root directory)
```bash
npm run backend:install    # Install dependencies
npm run backend:start      # Start the server
```

### Development Mode (auto-reload on file changes)
```bash
cd backend
npm run dev
```

### Access the Application
```
Frontend: http://localhost:3000
API Base: http://localhost:3000/api
```

---

## Project Structure

```
food-share/
├── backend/                    # Node.js/Express backend
│   ├── server.js              # Express server setup
│   ├── database.js            # MongoDB/Database config
│   ├── routes.js              # API endpoints
│   ├── package.json           # Dependencies
│   ├── .env                   # Environment variables (NOT in git)
│   └── node_modules/          # npm packages
│
├── frontend/                  # Frontend application
│   ├── public/
│   │   ├── index.html         # Main HTML
│   │   ├── css/styles.css     # Styles
│   │   └── js/app.js          # JavaScript logic
│   └── package.json
│
├── package.json               # Root config
└── README.md                  # Documentation
```

---

## API Endpoints

### Base URL
```
http://localhost:3000/api
```

### Available Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/food` - List all food items
- `POST /api/food` - Create food listing
- `GET /api/food/:id` - Get specific food item
- `PUT /api/food/:id` - Update food listing
- `DELETE /api/food/:id` - Delete food listing

*See `backend/routes.js` for detailed API documentation*

---

## Development Tools

### Recommended VS Code Extensions
- **ES7+ React/Redux/React-Native snippets**
- **Prettier - Code formatter**
- **ESLint**
- **Thunder Client** or **REST Client** (API testing)
- **MongoDB for VS Code**

### Testing APIs
```bash
# Using curl
curl http://localhost:3000/api

# Using REST Client (VS Code extension)
# Create requests.http file in project root
```

---

## Troubleshooting

### Issue: "Cannot find module"
**Solution**: 
```bash
cd backend
rm -rf node_modules package-lock.json
npm install
```

### Issue: Port 3000 already in use
**Solution**: 
```bash
# Change PORT in .env file to another port (e.g., 3001)
PORT=3001
```

### Issue: MongoDB connection failed
**Solution**:
- Verify MongoDB Atlas credentials
- Check internet connection
- Ensure IP whitelist on MongoDB Atlas includes your IP
- Verify `.env` file has correct connection string

### Issue: CORS errors
**Solution**: CORS is already enabled in `server.js`. Ensure:
- Backend is running
- Frontend uses correct API base URL

---

## Performance Considerations

- **Node.js Caching**: Enabled by default
- **Database Indexing**: Configure in MongoDB Atlas for better query performance
- **Image Upload Limit**: 10MB (configured in express middleware)
- **Session Management**: JWT tokens (stateless)

---

## Security Requirements

### Authentication
- ✅ JWT tokens for API authentication
- ✅ bcryptjs for password hashing
- ✅ CORS enabled for trusted domains
- ⚠️ **TODO**: Implement rate limiting
- ⚠️ **TODO**: Add HTTPS in production
- ⚠️ **TODO**: Implement request validation middleware

### Best Practices
1. Never expose `.env` file
2. Use strong JWT_SECRET (32+ characters)
3. Enable HTTPS in production
4. Regularly update dependencies: `npm audit fix`
5. Implement rate limiting for API endpoints

---

## Deployment Requirements

### For Production Deployment
- Node.js v18+ on server
- MongoDB Atlas cluster (or self-managed MongoDB)
- Environment variables configured on host
- SSL/TLS certificate for HTTPS
- Process manager (PM2 recommended)

### Production Server Setup Example
```bash
# Install PM2 globally
npm install -g pm2

# Start application with PM2
pm2 start backend/server.js --name "food-share"

# Setup auto-restart on server reboot
pm2 startup
pm2 save
```

---

## Maintenance & Updates

### Regular Tasks
- **Weekly**: Check for security updates with `npm audit`
- **Monthly**: Update dependencies with `npm update`
- **Quarterly**: Full security review and dependency audit

### Update Dependencies
```bash
cd backend
npm update                  # Update to latest compatible versions
npm audit fix              # Fix security vulnerabilities
```

---

## Support & Documentation

- **API Documentation**: See `backend/routes.js`
- **Database Schema**: See `backend/database.js`
- **Frontend Code**: See `frontend/public/js/app.js`
- **Project README**: See `README.md`

---

## Version History

- **v1.0.0** (2026-07-22): Initial release
  - User authentication system
  - Food listing management
  - MongoDB Atlas integration
  - REST API
  - Static frontend

---

## License

ISC License - See LICENSE file for details

---

**Last Updated**: 2026-07-22  
**Maintained By**: Food Share Team
