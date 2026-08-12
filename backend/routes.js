const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { User, Listing, Reservation, Message } = require('./database');

const JWT_SECRET = process.env.JWT_SECRET || 'foodshare-secret-key-2026';

// Helper to escape HTML to prevent XSS in demo
function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// Middleware: Authenticate JWT Token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. Token missing.' });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified; // { id, role, username }
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid or expired token.' });
  }
}

// ----------------------------------------------------
// AUTHENTICATION ROUTES
// ----------------------------------------------------

// User Registration
router.post('/auth/register', async (req, res) => {
  const { username, email, password, role, phone } = req.body;

  if (!username || !email || !password || !role) {
    return res.status(400).json({ error: 'Please enter all required fields.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  try {
    // Check if email already registered
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    // Check if username already taken
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ error: 'Username already taken.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Save User
    const newUser = await User.create({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password_hash: hashedPassword,
      role,
      phone: phone || ''
    });

    res.status(201).json({
      message: 'Registration successful.',
      userId: newUser._id.toString()
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// User Sign In
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Please enter email and password.' });
  }

  try {
    // Find User
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials. User not found.' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials. Password mismatch.' });
    }

    // Generate JWT Token
    const token = jwt.sign(
      { id: user._id.toString(), username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
        phone: user.phone || ''
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Get currently authenticated user details
router.get('/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password_hash');
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    res.json({
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
      phone: user.phone || '',
      verification_doc: user.verification_doc || '',
      xp_points: user.xp_points || 0
    });
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

  const filter = {};

  // Filter by status (default to available if not specified)
  if (status) {
    filter.status = status;
  } else {
    filter.status = 'available';
  }

  // Filter by category
  if (category && category !== 'all') {
    filter.food_category = category;
  }

  // Filter by search term (title or description)
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  try {
    let listings = await Listing.find(filter).populate('donor_id', 'username phone email rating_sum rating_count');

    // Apply client-side tag filtering if tags are provided
    if (tags) {
      const tagList = tags.split(',').map(t => t.trim().toLowerCase());
      listings = listings.filter(l => {
        if (!l.dietary_tags) return false;
        const listingTags = l.dietary_tags.split(',').map(t => t.trim().toLowerCase());
        return tagList.every(t => listingTags.includes(t));
      });
    }

    const formattedListings = listings.map(l => {
      const obj = l.toObject();
      return {
        ...obj,
        id: obj._id.toString(),
        donor_name: l.donor_id ? l.donor_id.username : 'Unknown',
        donor_phone: l.donor_id ? l.donor_id.phone : '',
        donor_email: l.donor_id ? l.donor_id.email : '',
        donor_rating: l.donor_id && l.donor_id.rating_count > 0 ? (l.donor_id.rating_sum / l.donor_id.rating_count).toFixed(1) : 'New',
        donor_rating_count: l.donor_id ? l.donor_id.rating_count : 0
      };
    });

    res.json(formattedListings);
  } catch (err) {
    console.error('Get listings error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Get CSR statistics for the logged-in donor
router.get('/listings/stats', authenticateToken, async (req, res) => {
  try {
    const totalClaimed = await Listing.countDocuments({ status: 'claimed', donor_id: req.user.id });
    const totalPending = await Listing.countDocuments({ status: 'reserved', donor_id: req.user.id });
    
    const meals = totalClaimed || 0;
    const co2 = (meals * 2.5).toFixed(1);
    const water = meals * 300;

    // Monthly claimed history breakdown using aggregation
    const monthlyDataRaw = await Listing.aggregate([
      { $match: { status: 'claimed', donor_id: new mongoose.Types.ObjectId(req.user.id) } },
      { $group: {
          _id: { $dateToString: { format: "%m", date: "$created_at" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const monthlyData = monthlyDataRaw.map(r => ({
      month: r._id,
      count: r.count
    }));

    res.json({
      meals,
      co2,
      water,
      pending: totalPending || 0,
      monthlyData
    });
  } catch (err) {
    console.error('Stats query error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Get a single listing
router.get('/listings/:id', async (req, res) => {
  try {
    const l = await Listing.findById(req.params.id).populate('donor_id', 'username phone email');

    if (!l) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    const listing = {
      ...l.toObject(),
      id: l._id.toString(),
      donor_name: l.donor_id ? l.donor_id.username : 'Unknown',
      donor_phone: l.donor_id ? l.donor_id.phone : '',
      donor_email: l.donor_id ? l.donor_id.email : ''
    };

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

  const { title, description, quantity, pickup_location, pickup_start, pickup_end, expiry_time, dietary_tags, image_url, food_category, latitude, longitude } = req.body;

  if (!title || !quantity || !pickup_location || !pickup_start || !pickup_end || !expiry_time) {
    return res.status(400).json({ error: 'Missing required listing fields.' });
  }

  let lat = parseFloat(latitude);
  let lng = parseFloat(longitude);
  if (isNaN(lat)) lat = 19.0760;
  if (isNaN(lng)) lng = 72.8777;

  // Fallback server-side geocoding if coordinates are default and pickup_location is provided
  if ((lat === 19.0760 && lng === 72.8777) && pickup_location) {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(pickup_location)}&limit=1`, {
        headers: { 'User-Agent': 'FoodShare-App' }
      });
      const data = await response.json();
      if (data && data.length > 0) {
        lat = parseFloat(data[0].lat);
        lng = parseFloat(data[0].lon);
        console.log(`Server-side geocoded "${pickup_location}" to [${lat}, ${lng}]`);
      }
    } catch (geocodeErr) {
      console.warn('Server-side geocoding fallback failed:', geocodeErr);
    }
  }

  try {
    const newListing = await Listing.create({
      donor_id: req.user.id,
      title,
      description: description || '',
      quantity,
      pickup_location,
      pickup_start: new Date(pickup_start),
      pickup_end: new Date(pickup_end),
      expiry_time: new Date(expiry_time),
      dietary_tags: dietary_tags || '',
      image_url: image_url || '',
      food_category: food_category || 'Other',
      latitude: lat,
      longitude: lng
    });

    res.status(201).json({
      message: 'Listing created successfully.',
      listingId: newListing._id.toString()
    });
  } catch (err) {
    console.error('Create listing error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Update an existing listing (Donor owner or Admin only)
router.put('/listings/:id', authenticateToken, async (req, res) => {
  const { title, description, quantity, pickup_location, pickup_start, pickup_end, expiry_time, status, dietary_tags, image_url, food_category, latitude, longitude } = req.body;

  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    if (listing.donor_id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden. You do not own this listing.' });
    }

    Object.assign(listing, {
      title: title || listing.title,
      description: description !== undefined ? description : listing.description,
      quantity: quantity || listing.quantity,
      pickup_location: pickup_location || listing.pickup_location,
      pickup_start: pickup_start ? new Date(pickup_start) : listing.pickup_start,
      pickup_end: pickup_end ? new Date(pickup_end) : listing.pickup_end,
      expiry_time: expiry_time ? new Date(expiry_time) : listing.expiry_time,
      status: status || listing.status,
      dietary_tags: dietary_tags !== undefined ? dietary_tags : listing.dietary_tags,
      image_url: image_url !== undefined ? image_url : listing.image_url,
      food_category: food_category || listing.food_category,
      latitude: latitude && !isNaN(parseFloat(latitude)) ? parseFloat(latitude) : listing.latitude,
      longitude: longitude && !isNaN(parseFloat(longitude)) ? parseFloat(longitude) : listing.longitude
    });

    await listing.save();

    res.json({ message: 'Listing updated successfully.' });
  } catch (err) {
    console.error('Update listing error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Delete a listing (Donor owner or Admin only)
router.delete('/listings/:id', authenticateToken, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    if (listing.donor_id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden. You do not own this listing.' });
    }

    await Listing.findByIdAndDelete(req.params.id);
    // Remove associated reservations
    await Reservation.deleteMany({ listing_id: req.params.id });

    res.json({ message: 'Listing deleted successfully.' });
  } catch (err) {
    console.error('Delete listing error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ----------------------------------------------------
// RESERVATIONS & BOOKING ROUTES
// ----------------------------------------------------

// Book/Reserve a food listing
router.post('/listings/:id/reserve', authenticateToken, async (req, res) => {
  if (req.user.role !== 'receiver') {
    return res.status(403).json({ error: 'Only Food Receivers can reserve listings.' });
  }

  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    if (listing.status !== 'available') {
      return res.status(400).json({ error: 'Food is no longer available.' });
    }

    // Generate random 6-character reservation code
    const reservationCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const resResult = await Reservation.create({
      listing_id: listing._id,
      receiver_id: req.user.id,
      reservation_code: reservationCode,
      status: 'active'
    });

    listing.status = 'reserved';
    await listing.save();

    res.status(201).json({
      message: 'Food reserved successfully.',
      reservationId: resResult._id.toString(),
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
    return res.status(400).json({ error: 'Reservation code is required to claim.' });
  }

  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    // Find active reservation
    const reservation = await Reservation.findOne({ listing_id: listing._id, status: 'active' });
    if (!reservation) {
      return res.status(404).json({ error: 'No active reservation found.' });
    }

    if (reservation.reservation_code !== reservationCode.trim().toUpperCase()) {
      return res.status(400).json({ error: 'Invalid reservation code.' });
    }

    if (reservation.receiver_id.toString() !== req.user.id && listing.donor_id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    // Complete reservation
    reservation.status = 'completed';
    reservation.claimed_at = new Date();
    await reservation.save();

    // Complete listing
    listing.status = 'claimed';
    await listing.save();

    // Reward +50 XP points
    try {
      await User.findByIdAndUpdate(reservation.receiver_id, { $inc: { xp_points: 50 } });
    } catch (xpErr) {
      console.warn('Failed to award XP:', xpErr);
    }

    res.json({ message: 'Food successfully claimed! Thank you.' });
  } catch (err) {
    console.error('Claim error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Release reservation (Cancel reservation and make available again)
router.post('/listings/:id/release', authenticateToken, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    const reservation = await Reservation.findOne({ listing_id: listing._id, status: 'active' });
    if (!reservation) {
      return res.status(404).json({ error: 'No active reservation found.' });
    }

    if (reservation.receiver_id.toString() !== req.user.id && listing.donor_id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    reservation.status = 'cancelled';
    await reservation.save();

    listing.status = 'available';
    await listing.save();

    res.json({ message: 'Reservation cancelled successfully. Item is available again.' });
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
      // Find reservations made by this receiver
      const rawRes = await Reservation.find({ receiver_id: req.user.id })
        .populate('listing_id')
        .sort({ reserved_at: -1 });

      for (let r of rawRes) {
        if (!r.listing_id) continue;
        const donor = await User.findById(r.listing_id.donor_id);
        reservations.push({
          ...r.toObject(),
          id: r._id.toString(),
          listing_id: r.listing_id._id.toString(),
          title: r.listing_id.title,
          quantity: r.listing_id.quantity,
          pickup_location: r.listing_id.pickup_location,
          expiry_time: r.listing_id.expiry_time,
          donor_name: donor ? donor.username : 'Unknown',
          donor_phone: donor ? donor.phone : '',
          donor_email: donor ? donor.email : ''
        });
      }
    } else if (req.user.role === 'donor') {
      // Find reservations for listings owned by this donor
      const donorListings = await Listing.find({ donor_id: req.user.id });
      const listingIds = donorListings.map(l => l._id);

      const rawRes = await Reservation.find({ listing_id: { $in: listingIds } })
        .populate('listing_id')
        .populate('receiver_id', 'username phone email verification_doc')
        .sort({ reserved_at: -1 });

      reservations = rawRes.map(r => ({
        ...r.toObject(),
        id: r._id.toString(),
        listing_id: r.listing_id ? r.listing_id._id.toString() : '',
        title: r.listing_id ? r.listing_id.title : 'Deleted Listing',
        quantity: r.listing_id ? r.listing_id.quantity : '',
        pickup_location: r.listing_id ? r.listing_id.pickup_location : '',
        expiry_time: r.listing_id ? r.listing_id.expiry_time : '',
        receiver_name: r.receiver_id ? r.receiver_id.username : 'Unknown',
        receiver_phone: r.receiver_id ? r.receiver_id.phone : '',
        receiver_email: r.receiver_id ? r.receiver_id.email : '',
        receiver_verified: r.receiver_id ? (r.receiver_id.verification_doc === 'verified') : false
      }));
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
    return res.status(403).json({ error: 'Unauthorized. Admin role required.' });
  }

  try {
    const userCount = await User.countDocuments();
    const listingCount = await Listing.countDocuments();
    const activeReservations = await Reservation.countDocuments({ status: 'active' });
    const completedReservations = await Reservation.countDocuments({ status: 'completed' });

    const donors = await User.countDocuments({ role: 'donor' });
    const receivers = await User.countDocuments({ role: 'receiver' });
    const admins = await User.countDocuments({ role: 'admin' });

    const availableListings = await Listing.countDocuments({ status: 'available' });
    const reservedListings = await Listing.countDocuments({ status: 'reserved' });
    const claimedListings = await Listing.countDocuments({ status: 'claimed' });
    const expiredListings = await Listing.countDocuments({ status: 'expired' });

    res.json({
      totalUsers: userCount,
      totalListings: listingCount,
      activeReservations: activeReservations,
      completedClaims: completedReservations,
      roles: {
        donor: donors,
        receiver: receivers,
        admin: admins
      },
      listings: {
        available: availableListings,
        reserved: reservedListings,
        claimed: claimedListings,
        expired: expiredListings
      }
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});



// Rate and review a reservation
router.post('/reservations/:id/rate', authenticateToken, async (req, res) => {
  const { rating, review } = req.body;
  const reservationId = req.params.id;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5 stars.' });
  }

  try {
    const reservation = await Reservation.findById(reservationId);
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found.' });
    }

    reservation.rating = parseInt(rating);
    reservation.review = review || '';
    await reservation.save();

    // Update donor user aggregate rating score for double-blind trust metrics
    try {
      const listing = await Listing.findById(reservation.listing_id);
      if (listing) {
        const donor = await User.findById(listing.donor_id);
        if (donor) {
          donor.rating_sum += parseInt(rating);
          donor.rating_count += 1;
          await donor.save();
        }
      }
    } catch (rateErr) {
      console.warn('Failed to aggregate donor rating on reservation review:', rateErr);
    }

    res.json({ message: 'Feedback submitted successfully. Thank you!' });
  } catch (err) {
    console.error('Rate reservation error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// NGO document verification upload
router.post('/users/verify-doc', authenticateToken, async (req, res) => {
  const { verificationDoc } = req.body;
  if (!verificationDoc) {
    return res.status(400).json({ error: 'Verification document data is required.' });
  }

  try {
    await User.findByIdAndUpdate(req.user.id, { verification_doc: verificationDoc });
    res.json({ message: 'Verification document submitted successfully for admin review.' });
  } catch (err) {
    console.error('Verify doc error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Get top volunteer leaderboard (Top 5 users by XP points)
router.get('/users/leaderboard', async (req, res) => {
  try {
    const topUsers = await User.find({ role: 'receiver' })
      .select('username xp_points')
      .sort({ xp_points: -1 })
      .limit(5);
    res.json(topUsers);
  } catch (err) {
    console.error('Leaderboard query error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ----------------------------------------------------
// MESSAGING & CHAT COORDINATION ROUTES
// ----------------------------------------------------

// Send a new chat message for coordination
router.post('/messages', authenticateToken, async (req, res) => {
  const { listingId, text } = req.body;
  if (!listingId || !text) {
    return res.status(400).json({ error: 'listingId and text are required.' });
  }

  try {
    const message = await Message.create({
      listing_id: listingId,
      sender_id: req.user.id,
      sender_name: req.user.username,
      text: text.trim()
    });
    res.status(201).json(message);
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Retrieve message logs for a transaction
router.get('/messages/:listingId', authenticateToken, async (req, res) => {
  const { listingId } = req.params;
  try {
    const messages = await Message.find({ listing_id: listingId })
      .sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    console.error('Fetch messages error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ----------------------------------------------------
// DOUBLE-BLIND USER RATINGS ROUTES
// ----------------------------------------------------

// Submit behavior rating for a user (donor/receiver)
router.post('/users/:id/rate', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { rating } = req.body;

  const score = parseInt(rating);
  if (isNaN(score) || score < 1 || score > 5) {
    return res.status(400).json({ error: 'Rating must be an integer between 1 and 5.' });
  }

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User to rate not found.' });
    }

    // Increment rating counters in User document
    user.rating_sum += score;
    user.rating_count += 1;
    await user.save();

    res.json({
      message: 'Rating submitted successfully.',
      avgRating: (user.rating_sum / user.rating_count).toFixed(1)
    });
  } catch (err) {
    console.error('Rate user error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Middleware to require Admin privileges
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Access denied. Administrative credentials required.' });
  }
}

// ----------------------------------------------------
// ADMINISTRATIVE CONSOLE CONTROL PANEL ROUTES
// ----------------------------------------------------

// Retrieve all user profiles
router.get('/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-password_hash').sort({ created_at: -1 });
    res.json(users);
  } catch (err) {
    console.error('Fetch admin users error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Admin-forced registration of a new user
router.post('/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  const { username, email, role, phone, password } = req.body;
  if (!username || !email || !role || !password) {
    return res.status(400).json({ error: 'Username, email, role, and password are required.' });
  }

  try {
    const existing = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
    if (existing) {
      return res.status(400).json({ error: 'User with this email or username already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      username,
      email: email.toLowerCase(),
      role,
      phone: phone || '',
      password_hash: hashedPassword
    });

    res.status(201).json({
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
      phone: user.phone
    });
  } catch (err) {
    console.error('Admin create user error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Admin-forced updating of any user details
router.put('/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { username, email, role, phone } = req.body;

  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (username) user.username = username;
    if (email) user.email = email.toLowerCase();
    if (role) user.role = role;
    if (phone !== undefined) user.phone = phone;

    await user.save();
    res.json({
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
      phone: user.phone
    });
  } catch (err) {
    console.error('Admin update user error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Admin-forced deletion of a user profile
router.delete('/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ message: 'User deleted successfully.' });
  } catch (err) {
    console.error('Admin delete user error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Verify/approve/reject receiver documentation
router.post('/admin/users/:id/verify', authenticateToken, requireAdmin, async (req, res) => {
  const { approve } = req.body;

  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User to verify not found.' });
    }

    if (approve) {
      user.verification_doc = 'verified'; // Marks verified
    } else {
      user.verification_doc = ''; // Reset rejection
    }

    await user.save();
    res.json({ message: approve ? 'User verification approved.' : 'User verification rejected.' });
  } catch (err) {
    console.error('Verify user document error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
