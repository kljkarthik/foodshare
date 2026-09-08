const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes');
const { connectDatabase } = require('./database');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Ensure active database connection before processing API routes
  app.use(async (req, res, next) => {
    if (req.url.startsWith('/api') || req.path.startsWith('/api')) {
      try {
        await connectDatabase();
      } catch (err) {
        console.error('Database connection error in serverless request middleware:', err);
        return res.status(500).json({ error: 'Database connection failed.' });
      }
    }
    next();
  });

  app.use(express.static(path.join(__dirname, '../frontend/public')));
  app.use('/api', apiRoutes);

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public', 'index.html'));
  });

  return app;
}

module.exports = { createApp };