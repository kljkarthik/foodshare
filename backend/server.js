const { createApp } = require('./app');
const { connectDatabase } = require('./database');

const app = createApp();
const PORT = process.env.PORT || 3000;

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
