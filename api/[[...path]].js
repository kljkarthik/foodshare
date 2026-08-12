const { createApp } = require('../backend/app');
const { connectDatabase } = require('../backend/database');

const app = createApp();

module.exports = async (req, res) => {
  try {
    await connectDatabase();
    return app(req, res);
  } catch (err) {
    console.error('Serverless handler error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
};