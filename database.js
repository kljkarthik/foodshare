const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'foodshare.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON;');

// Helper wrappers to use async/await
const dbQueryRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const dbQueryGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbQueryAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Initialize schema and seed data
async function initializeDatabase() {
  try {
    // Create Users table
    await dbQueryRun(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT CHECK(role IN ('donor', 'receiver', 'admin')) NOT NULL,
        phone TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Listings table
    await dbQueryRun(`
      CREATE TABLE IF NOT EXISTS listings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        donor_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        quantity TEXT NOT NULL,
        pickup_location TEXT NOT NULL,
        pickup_start DATETIME NOT NULL,
        pickup_end DATETIME NOT NULL,
        expiry_time DATETIME NOT NULL,
        status TEXT CHECK(status IN ('available', 'reserved', 'claimed', 'expired', 'cancelled')) DEFAULT 'available',
        dietary_tags TEXT,
        image_url TEXT,
        food_category TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (donor_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create Reservations table
    await dbQueryRun(`
      CREATE TABLE IF NOT EXISTS reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        listing_id INTEGER NOT NULL,
        receiver_id INTEGER NOT NULL,
        reservation_code TEXT NOT NULL,
        reserved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        claimed_at DATETIME,
        status TEXT CHECK(status IN ('active', 'completed', 'cancelled')) DEFAULT 'active',
        FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Table migration safety check
    try {
      await dbQueryRun('ALTER TABLE listings ADD COLUMN food_category TEXT;');
    } catch (e) {
      // Column already exists
    }

    console.log('Database tables verified/created successfully.');

    // Seed mock data if database is empty
    const userCount = await dbQueryGet('SELECT COUNT(*) as count FROM users');
    if (userCount.count === 0) {
      console.log('Seeding initial mock data...');

      // Hashed password for 'password123'
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('password123', salt);

      // Seed Users
      const donorResult = await dbQueryRun(
        `INSERT INTO users (username, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)`,
        ['GreenGrocer', 'greengrocer@example.com', hashedPassword, 'donor', '555-0199']
      );
      const receiverResult = await dbQueryRun(
        `INSERT INTO users (username, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)`,
        ['CommunityKitchen', 'kitchen@example.com', hashedPassword, 'receiver', '555-0244']
      );
      const receiver2Result = await dbQueryRun(
        `INSERT INTO users (username, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)`,
        ['JohnDoe', 'john@example.com', hashedPassword, 'receiver', '555-0100']
      );

      const donorId = donorResult.id;

      // Seed Listings
      const now = new Date();
      const formatOffsetDate = (hours) => {
        const d = new Date(now.getTime() + hours * 60 * 60 * 1000);
        return d.toISOString();
      };

      await dbQueryRun(
        `INSERT INTO listings (donor_id, title, description, quantity, pickup_location, pickup_start, pickup_end, expiry_time, status, dietary_tags, food_category) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          donorId,
          'Fresh Organic Bananas',
          'Slightly freckled organic bananas, perfectly sweet and ready to eat or use in baking.',
          '2 bunches (approx. 12 bananas)',
          'Organic Market, 452 Broadway St',
          formatOffsetDate(1),
          formatOffsetDate(4),
          formatOffsetDate(6),
          'available',
          'Vegan,Gluten-Free',
          'Fruits & Vegetables'
        ]
      );

      await dbQueryRun(
        `INSERT INTO listings (donor_id, title, description, quantity, pickup_location, pickup_start, pickup_end, expiry_time, status, dietary_tags, food_category) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          donorId,
          'Fresh Whole Wheat Sourdough Bread',
          'Baked fresh daily. We have three surplus loaves from yesterday\'s batch. Still soft and crusty.',
          '3 loaves',
          'Baker\'s Corner, 12 Bakery Lane',
          formatOffsetDate(2),
          formatOffsetDate(5),
          formatOffsetDate(24),
          'available',
          'Vegan',
          'Bakery & Bread'
        ]
      );

      await dbQueryRun(
        `INSERT INTO listings (donor_id, title, description, quantity, pickup_location, pickup_start, pickup_end, expiry_time, status, dietary_tags, food_category) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          donorId,
          'Veggie Pasta Trays',
          'Prepared trays of vegetable baked ziti. Kept refrigerated under health safety guidelines.',
          '2 large trays (feeds 10-12)',
          'Organic Market, 452 Broadway St',
          formatOffsetDate(-2), // started in past
          formatOffsetDate(2),
          formatOffsetDate(3),
          'available',
          'Vegetarian',
          'Cooked Meals'
        ]
      );

      console.log('Mock data seeded successfully.');
    }
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

module.exports = {
  db,
  dbQueryRun,
  dbQueryGet,
  dbQueryAll,
  initializeDatabase
};
