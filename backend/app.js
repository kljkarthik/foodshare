const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  app.use(express.static(path.join(__dirname, '../frontend/public')));
  app.use('/api', apiRoutes);

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public', 'index.html'));
  });

  return app;
}

module.exports = { createApp };