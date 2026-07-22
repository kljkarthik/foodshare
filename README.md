# Food Share - Monorepo Structure

A web application that connects food donors with food receivers to reduce food waste.

## Project Structure

```
food-share/
├── backend/                    # Node.js/Express API Server
│   ├── server.js              # Main server file
│   ├── database.js            # Database configuration & setup
│   ├── routes.js              # API routes
│   ├── verify_api.js          # API verification script
│   ├── package.json           # Backend dependencies
│   ├── package-lock.json
│   ├── node_modules/          # Backend dependencies
│   ├── foodshare.db           # SQLite database
│   └── logs/                  # Log files
├── frontend/                  # Frontend (HTML/CSS/JS)
│   ├── public/                # Static assets
│   │   ├── index.html         # Main HTML file
│   │   ├── css/
│   │   │   └── styles.css     # Styles
│   │   └── js/
│   │       └── app.js         # Frontend JavaScript
│   └── package.json           # Frontend metadata
├── .git/                      # Git repository
├── .gitignore
├── package.json               # Root package.json
└── README.md                  # This file
```

## Getting Started

### Prerequisites
- Node.js 14+ installed
- npm installed

### Installation

#### Install Backend Dependencies
```bash
cd backend
npm install
```

#### Or use the root-level command
```bash
npm run backend:install
```

### Running the Project

#### Start the Backend Server
```bash
cd backend
npm start
```

Or from the root:
```bash
npm run backend:start
```

#### Development Mode (with auto-reload)
```bash
cd backend
npm run dev
```

Or from the root:
```bash
npm run backend:dev
```

#### Access the Frontend
Once the backend server is running on `http://localhost:3000`, open your browser and navigate to:
```
http://localhost:3000
```

The frontend files are served from the `backend/server.js` configuration.

## Backend

**Location:** `/backend`

The backend is built with:
- **Express.js** - Web framework
- **SQLite3** - Database
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **CORS** - Cross-Origin Resource Sharing

### Key Files
- `server.js` - Express server configuration and startup
- `database.js` - SQLite database initialization
- `routes.js` - API endpoints
- `package.json` - Dependencies and scripts

### Running Backend Tests
```bash
cd backend
node verify_api.js
```

## Frontend

**Location:** `/frontend/public`

The frontend is a static website with:
- `index.html` - Main page
- `css/styles.css` - Styling
- `js/app.js` - Frontend logic

The backend serves these static files automatically.

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run backend:install` | Install backend dependencies |
| `npm run backend:start` | Start backend server |
| `npm run backend:dev` | Start backend with auto-reload |
| `npm run frontend:start` | Open frontend in browser |

## Database

SQLite database file: `backend/foodshare.db`

Tables are automatically created on first run.

## API Endpoints

See `backend/routes.js` for available endpoints. Key features:
- User authentication (login/register)
- Food listings (create, read, update, delete)
- Food matching between donors and receivers

## Notes

- The backend serves both API endpoints and static frontend files
- Frontend is served from the `public/` folder configured in `server.js`
- All database interactions use SQLite
- JWT tokens are used for authentication

## License

ISC
