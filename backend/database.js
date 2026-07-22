const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Node v18 Global Crypto polyfill for modern MongoDB drivers
if (!global.crypto) {
  global.crypto = require('crypto');
}

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://kljkarthik:kljkarthik@foodshare.5nr7wjq.mongodb.net/foodshare?retryWrites=true&w=majority&appName=foodshare';

// ----------------------------------------------------
// SCHEMAS & MODELS
// ----------------------------------------------------

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  email: { type: String, unique: true, required: true },
  password_hash: { type: String, required: true },
  role: { type: String, enum: ['donor', 'receiver', 'admin'], required: true },
  phone: { type: String },
  verification_doc: { type: String },
  xp_points: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now }
});

const ListingSchema = new mongoose.Schema({
  donor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String },
  quantity: { type: String, required: true },
  pickup_location: { type: String, required: true },
  pickup_start: { type: Date, required: true },
  pickup_end: { type: Date, required: true },
  expiry_time: { type: Date, required: true },
  status: { type: String, enum: ['available', 'reserved', 'claimed', 'expired', 'cancelled'], default: 'available' },
  dietary_tags: { type: String },
  image_url: { type: String },
  food_category: { type: String },
  latitude: { type: Number },
  longitude: { type: Number },
  created_at: { type: Date, default: Date.now }
});

const ReservationSchema = new mongoose.Schema({
  listing_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
  receiver_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reservation_code: { type: String, required: true },
  reserved_at: { type: Date, default: Date.now },
  claimed_at: { type: Date },
  status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
  rating: { type: Number },
  review: { type: String }
});

const User = mongoose.model('User', UserSchema);
const Listing = mongoose.model('Listing', ListingSchema);
const Reservation = mongoose.model('Reservation', ReservationSchema);

// Helper function to seed mock data
async function seedMockData() {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('Seeding initial mock data to MongoDB...');

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('password123', salt);

      // Seed Users
      const donor = await User.create({
        username: 'Taj Food Services',
        email: 'greengrocer@example.com',
        password_hash: hashedPassword,
        role: 'donor',
        phone: '+91 98765 43210'
      });

      const receiver = await User.create({
        username: 'Robin Hood Army NGO',
        email: 'kitchen@example.com',
        password_hash: hashedPassword,
        role: 'receiver',
        phone: '+91 98765 01234'
      });

      await User.create({
        username: 'Aarav Patel',
        email: 'john@example.com',
        password_hash: hashedPassword,
        role: 'receiver',
        phone: '+91 98765 99999'
      });

      // Seed Listings
      const now = new Date();
      const getOffsetDate = (hours) => new Date(now.getTime() + hours * 60 * 60 * 1000);

      await Listing.create({
        donor_id: donor._id,
        title: 'Surplus Veg Biryani Handis',
        description: 'Prepared fresh for an event, kept hot and hygienic. Feeds up to 30 people.',
        quantity: '3 large Handis (approx. 15 kg)',
        pickup_location: 'Taj Mahal Palace, Colaba, Mumbai',
        pickup_start: getOffsetDate(1),
        pickup_end: getOffsetDate(4),
        expiry_time: getOffsetDate(6),
        status: 'available',
        dietary_tags: 'Vegetarian',
        food_category: 'Cooked Meals',
        latitude: 18.9220,
        longitude: 72.8347
      });

      await Listing.create({
        donor_id: donor._id,
        title: 'Fresh pav & buns leftovers',
        description: 'Baked Pav buns leftover from bakery sales. Soft and perfect for Vada Pav or Pav Bhaji.',
        quantity: '50 Pav units (4 packets)',
        pickup_location: 'Mumbai Pav Express, Marine Drive, Churchgate',
        pickup_start: getOffsetDate(2),
        pickup_end: getOffsetDate(5),
        expiry_time: getOffsetDate(24),
        status: 'available',
        dietary_tags: 'Vegan,Vegetarian',
        food_category: 'Bakery & Bread',
        latitude: 18.9431,
        longitude: 72.8230
      });

      await Listing.create({
        donor_id: donor._id,
        title: 'Organic Alphonso Mangoes',
        description: 'Slightly overripe but extremely sweet and delicious Alphonso mangoes, perfect for directly eating or milkshakes.',
        quantity: '2 crates (approx. 50 mangoes)',
        pickup_location: 'Juhu Fruit Bazaar, Juhu Tara Road, Mumbai',
        pickup_start: getOffsetDate(-2),
        pickup_end: getOffsetDate(2),
        expiry_time: getOffsetDate(3),
        status: 'available',
        dietary_tags: 'Vegan,Gluten-Free',
        food_category: 'Fruits & Vegetables',
        latitude: 19.0988,
        longitude: 72.8264
      });

      console.log('Mock data seeded to MongoDB successfully.');
    }
  } catch (err) {
    console.error('Error seeding data:', err);
  }
}

// Connect Database wrapper
async function connectDatabase() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB Atlas successfully.');
    await seedMockData();
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}

module.exports = {
  connectDatabase,
  User,
  Listing,
  Reservation
};
