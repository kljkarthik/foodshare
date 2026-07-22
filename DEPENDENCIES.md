# Dependency Reference Guide

Quick reference for all dependencies used in the Food Share project.

---

## Backend Dependencies

### Production Dependencies

#### **express** (v4.19.2)
- **Purpose**: Web framework for Node.js
- **What it does**: Handles HTTP requests, routing, and middleware
- **Usage**: 
  ```javascript
  const express = require('express');
  const app = express();
  app.get('/api/food', (req, res) => { ... });
  ```
- **Documentation**: https://expressjs.com/

---

#### **mongoose** (v9.8.0)
- **Purpose**: MongoDB object modeling for Node.js
- **What it does**: Provides schema-based solutions for database modeling
- **Usage**:
  ```javascript
  const mongoose = require('mongoose');
  const foodSchema = new mongoose.Schema({ name: String });
  ```
- **Documentation**: https://mongoosejs.com/

---

#### **bcryptjs** (v2.4.3)
- **Purpose**: Password hashing library
- **What it does**: Securely hashes passwords with salt
- **Usage**:
  ```javascript
  const bcrypt = require('bcryptjs');
  const hashedPassword = await bcrypt.hash(password, 10);
  const isMatch = await bcrypt.compare(password, hashedPassword);
  ```
- **Documentation**: https://www.npmjs.com/package/bcryptjs

---

#### **jsonwebtoken** (v9.0.2)
- **Purpose**: JWT (JSON Web Token) creation and verification
- **What it does**: Signs and verifies authentication tokens
- **Usage**:
  ```javascript
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ userId: 123 }, process.env.JWT_SECRET);
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  ```
- **Documentation**: https://www.npmjs.com/package/jsonwebtoken

---

#### **cors** (v2.8.5)
- **Purpose**: Enable Cross-Origin Resource Sharing
- **What it does**: Allows frontend to make requests to backend from different domains
- **Usage**:
  ```javascript
  const cors = require('cors');
  app.use(cors());
  ```
- **Documentation**: https://www.npmjs.com/package/cors

---

### Development Dependencies

#### **nodemon** (v3.1.0)
- **Purpose**: Auto-restart development server
- **What it does**: Watches for file changes and automatically restarts Node.js
- **Usage**: `npm run dev` (instead of `npm start`)
- **Benefits**:
  - No manual restart needed when editing code
  - Speeds up development workflow
- **Documentation**: https://nodemon.io/

---

## Frontend Dependencies

Currently, the frontend uses **vanilla JavaScript** with:
- **HTML5** - Markup structure
- **CSS3** - Styling
- **JavaScript (ES6+)** - Client logic

**No npm packages required** - Frontend is lightweight and dependency-free!

---

## Optional/Future Dependencies

### For Future Enhancements

#### **dotenv** (When using .env files)
```bash
npm install dotenv
```
- Loads environment variables from `.env` file
- Usage: `require('dotenv').config();`

#### **validator** (Input validation)
```bash
npm install validator
```
- Validates emails, URLs, strings, etc.

#### **multer** (File uploads)
```bash
npm install multer
```
- Middleware for handling file uploads

#### **helmet** (Security headers)
```bash
npm install helmet
```
- Sets various HTTP headers for security

#### **rate-limit** (API rate limiting)
```bash
npm install express-rate-limit
```
- Prevents abuse by limiting requests per IP

---

## Dependency Size Reference

| Package | Size | Purpose |
|---------|------|---------|
| express | ~50KB | Web framework |
| mongoose | ~1.2MB | Database ORM |
| bcryptjs | ~100KB | Password hashing |
| jsonwebtoken | ~50KB | JWT tokens |
| cors | ~15KB | CORS handling |
| nodemon | ~4MB | Dev tool (not in production) |

**Total production size**: ~1.4MB

---

## Checking for Vulnerabilities

### Run Security Audit
```bash
# Check for security issues
npm audit

# Fix vulnerabilities automatically
npm audit fix

# Dry run (see what would be fixed)
npm audit fix --dry-run
```

### Update Dependencies
```bash
# Check outdated packages
npm outdated

# Update all to latest compatible versions
npm update

# Update specific package
npm install package-name@latest
```

---

## Installation Troubleshooting

### "npm ERR! code EACCES"
**Problem**: Permission denied
**Solution**:
```bash
# On macOS/Linux
sudo npm install

# Or fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
```

### "npm ERR! 404 Not Found"
**Problem**: Package doesn't exist or network error
**Solution**:
```bash
npm cache clean --force
npm install
```

### "npm WARN deprecated"
**Problem**: Some packages are outdated
**Solution**: Usually safe to ignore, but can update:
```bash
npm update
```

---

## Version Management

### Understanding Version Numbers

Example: `^4.19.2`
- `4` = Major version (breaking changes)
- `19` = Minor version (new features)
- `2` = Patch version (bug fixes)

### Version Symbols

| Symbol | Meaning | Example |
|--------|---------|---------|
| `^` | Up to next major | `^4.19.2` means `4.x.x` |
| `~` | Up to next minor | `~4.19.2` means `4.19.x` |
| `=` or no symbol | Exact version | `4.19.2` |
| `*` | Any version | `*` |

---

## Lock File (package-lock.json)

**What it is**: Records exact versions of all installed packages

**Why it matters**: 
- Ensures consistency across team members
- Prevents breaking changes from auto-updates
- Should be committed to Git

**When it's created**: 
- Automatically when you run `npm install`

---

## Node Modules Folder

**What it is**: Contains all installed packages

**Size**: ~350MB+ (typical)

**Should NOT be committed to Git** (use `.gitignore`)

**Regenerate anytime**:
```bash
rm -rf node_modules
npm install
```

---

## Quick Reference: Common npm Commands

```bash
# Install all dependencies
npm install

# Install specific package
npm install package-name

# Install as dev dependency
npm install package-name --save-dev

# Uninstall package
npm uninstall package-name

# List installed packages
npm list

# Check for outdated packages
npm outdated

# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Run scripts defined in package.json
npm run script-name

# Clear cache
npm cache clean --force
```

---

## Architecture Overview

```
Food Share Application
│
├── Frontend (No dependencies)
│   ├── HTML5 files
│   ├── CSS3 stylesheets
│   └── Vanilla JavaScript
│
└── Backend (Node.js)
    ├── Core
    │   ├── express - Server framework
    │   └── cors - Cross-origin support
    │
    ├── Database
    │   └── mongoose - MongoDB driver
    │
    └── Security
        ├── bcryptjs - Password hashing
        └── jsonwebtoken - Token auth
```

---

## Security Best Practices

1. **Keep dependencies updated**
   ```bash
   npm audit fix  # Regularly
   ```

2. **Check for vulnerabilities before deployment**
   ```bash
   npm audit
   ```

3. **Don't commit node_modules** to Git
   - Included in `.gitignore`
   - Regenerate with `npm install`

4. **Use exact versions in production**
   - Remove `^` and `~` symbols
   - Use exact version numbers

---

## Performance Tips

1. **Use production mode**
   ```bash
   NODE_ENV=production npm start
   ```

2. **Remove dev dependencies from production**
   ```bash
   npm install --production
   ```

3. **Monitor package sizes**
   ```bash
   npm ls  # See dependency tree
   ```

---

## Resources

- **npm Registry**: https://www.npmjs.com/
- **Node.js Docs**: https://nodejs.org/docs/
- **npm Docs**: https://docs.npmjs.com/
- **Snyk Vulnerability DB**: https://snyk.io/vulnerability-scanner/

---

**Last Updated**: 2026-07-22

For more information, see:
- [REQUIREMENTS.md](./REQUIREMENTS.md) - Full requirements
- [SETUP.md](./SETUP.md) - Setup instructions
- [README.md](./README.md) - Project overview
