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

  const fs = require('fs');
  const publicDir = path.join(__dirname, '../public');
  const frontendPublicDir = path.join(__dirname, '../frontend/public');

  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
  }
  if (fs.existsSync(frontendPublicDir)) {
    app.use(express.static(frontendPublicDir));
  }

  app.use('/api', apiRoutes);

  // Client-side SPA fallback for local development
  app.get('*', (req, res, next) => {
    if (req.url.startsWith('/api') || req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API endpoint not found.' });
    }

    const publicIndexPath = path.join(__dirname, '../public', 'index.html');
    const frontendIndexPath = path.join(__dirname, '../frontend/public', 'index.html');

    if (fs.existsSync(publicIndexPath)) {
      return res.sendFile(publicIndexPath);
    } else if (fs.existsSync(frontendIndexPath)) {
      return res.sendFile(frontendIndexPath);
    }
    next();
  });

  // Global Error Handler
  app.use((err, req, res, next) => {
    console.error('Unhandled server error:', err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(500).json({ error: 'Internal server error.' });
  });

  return app;
}

module.exports = { createApp };