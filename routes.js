const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbQueryRun, dbQueryGet, dbQueryAll } = require('./database');

const JWT_SECRET = process.env.JWT_SECRET || 'foodshare-super-secret-key-2026';

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    req.user = user;
    next();
  });
}

// ----------------------------------------------------
// AUTHENTICATION ROUTES
// ----------------------------------------------------

// Register a new user
router.post('/auth/register', async (req, res) => {
  const { username, email, password, role, phone } = req.body;

  // Basic validation
  if (!username || !email || !password || !role) {
    return res.status(400).json({ error: 'Missing required fields (username, email, password, role).' });
  }

  if (role !== 'donor' && role !== 'receiver') {
    return res.status(400).json({ error: 'Role must be either "donor" or "receiver".' });
  }

  try {
    // Check if user already exists
    const existingUser = await dbQueryGet(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username]
    );
    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already exists.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user
    const result = await dbQueryRun(
      'INSERT INTO users (username, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)',
      [username, email, passwordHash, role, phone || null]
    );

    res.status(201).json({
      message: 'User registered successfully.',
      userId: result.id
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// User login
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    // Find user
    const user = await dbQueryGet('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    // Create JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        phone: user.phone
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Get current user details
router.get('/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await dbQueryGet('SELECT id, username, email, role, phone, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json(user);
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ----------------------------------------------------
// FOOD LISTINGS ROUTES
// ----------------------------------------------------

// Get all listings with optional search and filters
router.get('/listings', async (req, res) => {
  const { search, tags, status, category } = req.query;

  let query = `
    SELECT l.*, u.username as donor_name, u.phone as donor_phone, u.email as donor_email 
    FROM listings l
    JOIN users u ON l.donor_id = u.id
    WHERE 1=1
  `;
  const params = [];

  // Filter by status (default to available if not specified)
  if (status) {
    query += ' AND l.status = ?';
    params.push(status);
  } else {
    // If not specified, default to showing only available ones
    query += " AND l.status = 'available'";
  }

  // Filter by category
  if (category) {
    query += ' AND l.food_category = ?';
    params.push(category);
  }

  // Filter by search term (title or description)
  if (search) {
    query += ' AND (l.title LIKE ? OR l.description LIKE ?)';
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam);
  }

  try {
    const listings = await dbQueryAll(query, params);

    // Apply client-side tag filtering if tags are provided
    let filteredListings = listings;
    if (tags) {
      const tagList = tags.split(',').map(t => t.trim().toLowerCase());
      filteredListings = listings.filter(listing => {
        if (!listing.dietary_tags) return false;
        const listingTags = listing.dietary_tags.split(',').map(t => t.trim().toLowerCase());
        // Show listings that have ALL the specified filter tags
        return tagList.every(t => listingTags.includes(t));
      });
    }

    res.json(filteredListings);
  } catch (err) {
    console.error('Get listings error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Get a single listing
router.get('/listings/:id', async (req, res) => {
  try {
    const listing = await dbQueryGet(
      `SELECT l.*, u.username as donor_name, u.phone as donor_phone, u.email as donor_email 
       FROM listings l
       JOIN users u ON l.donor_id = u.id
       WHERE l.id = ?`,
      [req.params.id]
    );

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    res.json(listing);
  } catch (err) {
    console.error('Get listing detail error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Create a new listing (Donor only)
router.post('/listings', authenticateToken, async (req, res) => {
  if (req.user.role !== 'donor') {
    return res.status(403).json({ error: 'Forbidden. Only donors can create listings.' });
  }

  const { title, description, quantity, pickup_location, pickup_start, pickup_end, expiry_time, dietary_tags, image_url, food_category } = req.body;

  if (!title || !quantity || !pickup_location || !pickup_start || !pickup_end || !expiry_time) {
    return res.status(400).json({ error: 'Missing required listing fields.' });
  }

  try {
    const result = await dbQueryRun(
      `INSERT INTO listings (donor_id, title, description, quantity, pickup_location, pickup_start, pickup_end, expiry_time, status, dietary_tags, image_url, food_category) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available', ?, ?, ?)`,
      [
        req.user.id,
        title,
        description || '',
        quantity,
        pickup_location,
        pickup_start,
        pickup_end,
        expiry_time,
        dietary_tags || '',
        image_url || '',
        food_category || 'Other'
      ]
    );

    res.status(201).json({
      message: 'Listing created successfully.',
      listingId: result.id
    });
  } catch (err) {
    console.error('Create listing error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Update an existing listing (Donor only, and must own it)
router.put('/listings/:id', authenticateToken, async (req, res) => {
  const { title, description, quantity, pickup_location, pickup_start, pickup_end, expiry_time, status, dietary_tags, image_url, food_category } = req.body;

  try {
    // Verify ownership
    const listing = await dbQueryGet('SELECT * FROM listings WHERE id = ?', [req.params.id]);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    if (listing.donor_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden. You do not own this listing.' });
    }

    await dbQueryRun(
      `UPDATE listings 
       SET title = ?, description = ?, quantity = ?, pickup_location = ?, pickup_start = ?, pickup_end = ?, expiry_time = ?, status = ?, dietary_tags = ?, image_url = ?, food_category = ? 
       WHERE id = ?`,
      [
        title || listing.title,
        description !== undefined ? description : listing.description,
        quantity || listing.quantity,
        pickup_location || listing.pickup_location,
        pickup_start || listing.pickup_start,
        pickup_end || listing.pickup_end,
        expiry_time || listing.expiry_time,
        status || listing.status,
        dietary_tags !== undefined ? dietary_tags : listing.dietary_tags,
        image_url !== undefined ? image_url : listing.image_url,
        food_category || listing.food_category,
        req.params.id
      ]
    );

    res.json({ message: 'Listing updated successfully.' });
  } catch (err) {
    console.error('Update listing error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Delete a listing (Donor owner only)
router.delete('/listings/:id', authenticateToken, async (req, res) => {
  try {
    const listing = await dbQueryGet('SELECT * FROM listings WHERE id = ?', [req.params.id]);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    if (listing.donor_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden. You do not own this listing.' });
    }

    // We can soft-delete by setting status to 'cancelled', or hard-delete. Let's do hard delete, SQLite CASCADE takes care of reservations.
    await dbQueryRun('DELETE FROM listings WHERE id = ?', [req.params.id]);
    res.json({ message: 'Listing deleted successfully.' });
  } catch (err) {
    console.error('Delete listing error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ----------------------------------------------------
// RESERVATION / CLAIM SYSTEM ROUTES
// ----------------------------------------------------

// Reserve an available listing (Receiver only)
router.post('/listings/:id/reserve', authenticateToken, async (req, res) => {
  if (req.user.role !== 'receiver') {
    return res.status(403).json({ error: 'Forbidden. Only receivers can reserve food listings.' });
  }

  try {
    // Start transaction style check
    const listing = await dbQueryGet('SELECT * FROM listings WHERE id = ?', [req.params.id]);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    if (listing.status !== 'available') {
      return res.status(400).json({ error: `Cannot reserve listing. Current status is: ${listing.status}` });
    }

    // Check if food is already expired
    if (new Date(listing.expiry_time) < new Date()) {
      // Auto-update to expired
      await dbQueryRun("UPDATE listings SET status = 'expired' WHERE id = ?", [listing.id]);
      return res.status(400).json({ error: 'This listing has already expired.' });
    }

    // Generate unique 6-character reservation code
    const reservationCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Create reservation record
    const resResult = await dbQueryRun(
      'INSERT INTO reservations (listing_id, receiver_id, reservation_code, status) VALUES (?, ?, ?, ?)',
      [listing.id, req.user.id, reservationCode, 'active']
    );

    // Update listing status
    await dbQueryRun("UPDATE listings SET status = 'reserved' WHERE id = ?", [listing.id]);

    res.json({
      message: 'Food successfully reserved.',
      reservationId: resResult.id,
      reservationCode
    });
  } catch (err) {
    console.error('Reserve error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Claim/Complete listing (Receiver completes the pickup)
router.post('/listings/:id/claim', authenticateToken, async (req, res) => {
  const { reservationCode } = req.body;

  if (!reservationCode) {
    return res.status(400).json({ error: 'Reservation code is required to claim the food.' });
  }

  try {
    const listing = await dbQueryGet('SELECT * FROM listings WHERE id = ?', [req.params.id]);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    // Find the active reservation
    const reservation = await dbQueryGet(
      'SELECT * FROM reservations WHERE listing_id = ? AND status = ?',
      [listing.id, 'active']
    );

    if (!reservation) {
      return res.status(404).json({ error: 'No active reservation found for this listing.' });
    }

    // Verify reservation code matches
    if (reservation.reservation_code !== reservationCode.trim().toUpperCase()) {
      return res.status(400).json({ error: 'Invalid reservation code. Please check with your app dashboard.' });
    }

    // Verify user authorization:
    // Only the receiver who reserved it, the donor who listed it, or an admin can complete the claim.
    if (reservation.receiver_id !== req.user.id && listing.donor_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    // Complete the reservation
    await dbQueryRun(
      "UPDATE reservations SET status = 'completed', claimed_at = ? WHERE id = ?",
      [new Date().toISOString(), reservation.id]
    );

    // Set listing status to claimed
    await dbQueryRun("UPDATE listings SET status = 'claimed' WHERE id = ?", [listing.id]);

    res.json({ message: 'Food successfully claimed! Thank you for reducing food waste.' });
  } catch (err) {
    console.error('Claim error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Release reservation (Cancel reservation and make available again)
router.post('/listings/:id/release', authenticateToken, async (req, res) => {
  try {
    const listing = await dbQueryGet('SELECT * FROM listings WHERE id = ?', [req.params.id]);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    const reservation = await dbQueryGet(
      "SELECT * FROM reservations WHERE listing_id = ? AND status = 'active'",
      [listing.id]
    );

    if (!reservation) {
      return res.status(404).json({ error: 'No active reservation found.' });
    }

    // Check authorization: must be the reserving receiver, the donor, or admin
    if (reservation.receiver_id !== req.user.id && listing.donor_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to cancel reservation.' });
    }

    // Update reservation to cancelled
    await dbQueryRun("UPDATE reservations SET status = 'cancelled' WHERE id = ?", [reservation.id]);

    // Check if the food is already expired. If expired, update status to expired. Otherwise available.
    if (new Date(listing.expiry_time) < new Date()) {
      await dbQueryRun("UPDATE listings SET status = 'expired' WHERE id = ?", [listing.id]);
      res.json({ message: 'Reservation cancelled, but item has expired.' });
    } else {
      await dbQueryRun("UPDATE listings SET status = 'available' WHERE id = ?", [listing.id]);
      res.json({ message: 'Reservation cancelled successfully. Item is available again.' });
    }
  } catch (err) {
    console.error('Release reservation error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Get reservations associated with the authenticated user
router.get('/reservations/my', authenticateToken, async (req, res) => {
  try {
    let reservations = [];

    if (req.user.role === 'receiver') {
      // Show listings reserved by this receiver
      reservations = await dbQueryAll(
        `SELECT r.*, l.title, l.quantity, l.pickup_location, l.expiry_time, u.username as donor_name, u.phone as donor_phone, u.email as donor_email
         FROM reservations r
         JOIN listings l ON r.listing_id = l.id
         JOIN users u ON l.donor_id = u.id
         WHERE r.receiver_id = ?
         ORDER BY r.reserved_at DESC`,
        [req.user.id]
      );
    } else if (req.user.role === 'donor') {
      // Show listings owned by this donor that have a reservation
      reservations = await dbQueryAll(
        `SELECT r.*, l.title, l.quantity, l.pickup_location, l.expiry_time, u.username as receiver_name, u.phone as receiver_phone, u.email as receiver_email
         FROM reservations r
         JOIN listings l ON r.listing_id = l.id
         JOIN users u ON r.receiver_id = u.id
         WHERE l.donor_id = ?
         ORDER BY r.reserved_at DESC`,
        [req.user.id]
      );
    }

    res.json(reservations);
  } catch (err) {
    console.error('Get my reservations error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Admin stats endpoint (simple anti-spam dashboard view)
router.get('/admin/stats', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.username !== 'admin') {
    // Allow standard admin checking
    return res.status(403).json({ error: 'Unauthorized. Admin role required.' });
  }

  try {
    const userCount = await dbQueryGet('SELECT COUNT(*) as count FROM users');
    const listingCount = await dbQueryGet('SELECT COUNT(*) as count FROM listings');
    const activeReservations = await dbQueryGet("SELECT COUNT(*) as count FROM reservations WHERE status = 'active'");
    const completedReservations = await dbQueryGet("SELECT COUNT(*) as count FROM reservations WHERE status = 'completed'");

    res.json({
      totalUsers: userCount.count,
      totalListings: listingCount.count,
      activeReservations: activeReservations.count,
      completedClaims: completedReservations.count
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
