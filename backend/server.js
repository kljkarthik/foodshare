const express = require('express');
const cors = require('cors');
const path = require('path');
const { connectDatabase } = require('./database');
const apiRoutes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all requests
app.use(cors());

// Parse JSON and URL-encoded bodies with 10mb limit for base64 image uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve static files from the frontend public folder
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Mount API routes
app.use('/api', apiRoutes);

// Fallback to serving public/index.html for client-side SPA routing if any
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public', 'index.html'));
});

// Connect to MongoDB Atlas then start the server
connectDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`Food Share server running on http://localhost:${PORT}`);
    console.log(`==================================================`);
  });
}).catch(err => {
  console.error('Failed to connect to MongoDB on server startup:', err);
  process.exit(1);
});
